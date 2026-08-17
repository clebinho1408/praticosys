import { Router } from "express";
import { db } from "@workspace/db";
import {
  users, drivingSchools, examiners, instructors, vehicles,
  examSchedules, examRequests, systemSettings, blockedDates,
  cities, examScheduleSlots, bancaResults, examLocations, otpCodes, auditLogs,
  cnhbrasilRequests, cfcRequests, pcdRequests,
  cfcScheduleSlots, pcdScheduleSlots,
} from "@workspace/db";
import { eq, and, like, isNotNull, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import { createHash } from "crypto";
import type { Response } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

import { hashPassword, verifyPassword } from '../password.js';

const OTP_MAX_ATTEMPTS = 5;

// ─── BACKUP ───────────────────────────────────────────────────────────────────
const BACKUP_TABLES = [
  "driving_schools", "examiners", "instructors", "vehicles", "cities",
  // Tabelas separadas por módulo (novas)
  "cnhbrasil_requests", "cfc_requests", "pcd_requests",
  "cfc_schedule_slots", "pcd_schedule_slots",
  "banca_results", "exam_locations", "blocked_dates", "system_settings",
  // Tabelas legadas mantidas para segurança/rollback
  "exam_requests", "exam_schedules", "exam_schedule_slots",
];
const MAX_BACKUPS = 15;

async function createBackupSnapshot(trigger: "auto" | "manual"): Promise<{ skipped?: boolean; id?: string }> {
  if (trigger === "auto") {
    const existing = await db.execute(sql`
      SELECT id FROM backups WHERE trigger_type = 'auto' AND created_at::date = CURRENT_DATE LIMIT 1
    `);
    const rows = (existing as any).rows ?? existing;
    if (rows && rows.length > 0) return { skipped: true };
  }

  const payload: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    try {
      const res = await db.execute(sql.raw(`SELECT * FROM ${t}`));
      payload[t] = (res as any).rows ?? res;
    } catch { payload[t] = []; }
  }
  // Usuários sem senhas
  try {
    const res = await db.execute(sql`
      SELECT id, name, login, role, school_id, examiner_id, instructor_id,
             email, phone, two_factor_enabled, force_password_change,
             allowed_modules, allowed_location_ids, created_at
      FROM users
    `);
    payload["users"] = (res as any).rows ?? res;
  } catch { payload["users"] = []; }

  const id = crypto.randomUUID();
  const jsonStr = JSON.stringify(payload);
  const size = Buffer.byteLength(jsonStr, "utf8");
  // ON CONFLICT DO NOTHING + índice único parcial garantem no máx. 1 backup 'auto' por dia,
  // mesmo com logins de admin concorrentes.
  const inserted = await db.execute(sql`
    INSERT INTO backups (id, trigger_type, payload, size_bytes)
    VALUES (${id}, ${trigger}, ${jsonStr}::jsonb, ${size})
    ON CONFLICT DO NOTHING
    RETURNING id
  `);
  const insertedRows = (inserted as any).rows ?? inserted;
  if (!insertedRows || insertedRows.length === 0) return { skipped: true };
  await db.execute(sql`
    DELETE FROM backups
    WHERE id NOT IN (SELECT id FROM backups ORDER BY created_at DESC LIMIT ${MAX_BACKUPS})
  `);
  return { id };
}

/** Dispara backup automático em segundo plano (não bloqueia o login) */
function triggerAutoBackup() {
  void createBackupSnapshot("auto").catch(() => {});
}

async function createSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8h
  await db.execute(sql`
    INSERT INTO sessions (id, user_id, expires_at, created_at)
    VALUES (${sessionId}, ${userId}, ${expiresAt.toISOString()}, now())
  `);
  return sessionId;
}

const router = Router();

// ─── SSE ─────────────────────────────────────────────────────────────────────
let sseClients: Response[] = [];
const addSseClient = (res: Response) => {
  sseClients.push(res);
  res.on("close", () => { sseClients = sseClients.filter(c => c !== res); });
};
const broadcast = (event: string, data: any) => {
  sseClients.forEach(c => c.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
};

router.get("/events", (_req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  addSseClient(res);
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────
router.post("/auth", async (req, res) => {
  try {
    const { login, password } = req.body ?? {};
    if (!login || !password) {
      return res.status(400).json({ error: "Login e senha são obrigatórios" });
    }
    const result = await db.select().from(users).where(eq(users.login, login));
    if (result.length === 0) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }
    const user = result[0] as any;

    // Helper local para gerar e enviar OTP (reutilizado no bootstrap e login normal)
    const do2FA = async (u: any) => {
      const rawCode = String(crypto.randomInt(100000, 1000000));
      const hashedCode = hashCode(rawCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db.execute(sql`UPDATE otp_codes SET used = true WHERE user_id = ${u.id} AND used = false`);
      let emailSent = false;
      let devCode: string | undefined;
      try {
        const connectors = new ReplitConnectors();
        const resp = await connectors.proxy("resend", "/emails", {
          method: "POST",
          body: JSON.stringify({
            from: "PráticoSys <onboarding@resend.dev>",
            to: [u.email],
            subject: `[PráticoSys] Código de verificação: ${rawCode}`,
            html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;"><h2 style="color:#1e40af">Verificação em 2 etapas</h2><p>Seu código:</p><div style="font-size:2.5rem;font-weight:900;letter-spacing:0.35em;text-align:center;padding:20px;background:#eff6ff;border-radius:12px;color:#1e40af;border:2px solid #bfdbfe;">${rawCode}</div><p style="color:#6b7280;font-size:0.875rem;">⏱️ Expira em <strong>10 minutos</strong>. 🔒 Não compartilhe.</p></div>`,
          }),
          headers: { "Content-Type": "application/json" },
        });
        emailSent = resp.ok;
      } catch {}
      if (!emailSent) {
        if (process.env.NODE_ENV === "development") devCode = rawCode;
        else throw new Error("SEND_FAILED");
      }
      await db.insert(otpCodes).values({ id: crypto.randomUUID(), userId: u.id, code: hashedCode, expiresAt, used: false, failedAttempts: 0 });
      const maskEmail = (e: string) => { const [l, d] = e.split("@"); return `${l.slice(0, 2)}***@${d}`; };
      return { requiresOtp: true, userId: u.id, sentTo: maskEmail(u.email), ...(devCode ? { devCode } : {}) };
    };

    // Bootstrap admin sem senha — define senha inicial (já armazena hash)
    if (login === "admin" && !user.password) {
      const hashed = await hashPassword(password);
      const updated = await db.update(users)
        .set({ password: hashed, forcePasswordChange: false })
        .where(eq(users.id, user.id))
        .returning();
      const u = (updated[0] || user) as any;

      // Mesmo no bootstrap, 2FA deve ser honrado se configurado
      if (u.twoFactorEnabled && !u.email) {
        return res.status(403).json({ error: "2FA ativo sem e-mail cadastrado. Contate o administrador." });
      }
      if (u.twoFactorEnabled && u.email) {
        try { return res.json(await do2FA(u)); }
        catch { return res.status(502).json({ error: "Falha ao enviar código de verificação." }); }
      }

      const sessionToken = await createSession(u.id);
      triggerAutoBackup(); // backup automático no acesso do admin
      const { password: _p, ...safe } = u;
      return res.status(200).json({ ...safe, sessionToken });
    }

    // Verifica senha (suporta migração transparente de texto puro → bcrypt)
    if (user.password) {
      const check = await verifyPassword(password, user.password);
      if (!check.ok) return res.status(401).json({ error: "Senha incorreta" });
      if (check.needsRehash && check.hash) {
        // Re-criptografa silenciosamente (migração de senha legada)
        await db.update(users).set({ password: check.hash }).where(eq(users.login, login));
      }
    }

    // 2FA ativo mas sem e-mail — bloqueia para evitar bypass silencioso
    if (user.twoFactorEnabled && !user.email) {
      return res.status(403).json({ error: "2FA ativo sem e-mail cadastrado. Contate o administrador." });
    }

    // Verificação em 2 etapas
    if (user.twoFactorEnabled && user.email) {
      try { return res.json(await do2FA(user)); }
      catch { return res.status(502).json({ error: "Falha ao enviar código de verificação. Tente novamente." }); }
    }

    // Login direto (sem 2FA)
    const sessionToken = await createSession(user.id);
    if (user.role === "ADMIN") triggerAutoBackup();
    const { password: _p, ...safe } = user as any;
    return res.status(200).json({ ...safe, sessionToken });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro interno", details: err.message });
  }
});

// Logout — invalida sessão no servidor
router.delete("/session", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      await db.execute(sql`DELETE FROM sessions WHERE id = ${token}`);
    }
    return res.json({ success: true });
  } catch { return res.json({ success: true }); }
});

// Validação do código OTP (consumo atômico + rate limiting)
router.post("/verify-otp", async (req, res) => {
  try {
    const { userId, code } = req.body ?? {};
    if (!userId || !code) return res.status(400).json({ error: "userId e code são obrigatórios" });

    const inputHash = hashCode(code.trim());

    const consumed = await db.execute(sql`
      UPDATE otp_codes
      SET used = true
      WHERE user_id = ${userId}
        AND code = ${inputHash}
        AND used = false
        AND expires_at > NOW()
        AND failed_attempts < ${OTP_MAX_ATTEMPTS}
      RETURNING id
    `);

    const rows = (consumed as any).rows ?? consumed;
    if (!rows || rows.length === 0) {
      await db.execute(sql`
        UPDATE otp_codes
        SET
          failed_attempts = COALESCE(failed_attempts, 0) + 1,
          used = CASE
            WHEN COALESCE(failed_attempts, 0) + 1 >= ${OTP_MAX_ATTEMPTS} THEN true
            ELSE used
          END
        WHERE user_id = ${userId} AND used = false AND expires_at > NOW()
      `);
      return res.status(401).json({ error: "Código inválido, expirado ou tentativas esgotadas. Faça login novamente." });
    }

    const result = await db.select().from(users).where(eq(users.id, userId));
    if (result.length === 0) return res.status(404).json({ error: "Usuário não encontrado" });

    const sessionToken = await createSession(userId);
    if ((result[0] as any).role === "ADMIN") triggerAutoBackup();
    const { password: _p, ...safe } = result[0] as any;
    return res.json({ ...safe, sessionToken });
  } catch (err: any) {
    return res.status(500).json({ error: "Erro interno", details: err.message });
  }
});

// ─── BACKUPS (somente ADMIN) ─────────────────────────────────────────────────
router.get("/backups", async (req, res) => {
  if ((req as any).sessionUser?.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado — apenas administradores" });
  try {
    const { id } = req.query as any;
    if (id) {
      const result = await db.execute(sql`SELECT id, payload, created_at FROM backups WHERE id = ${id} LIMIT 1`);
      const rows = (result as any).rows ?? result;
      if (!rows || rows.length === 0) return res.status(404).json({ error: "Backup não encontrado" });
      return res.json(rows[0]);
    }
    const result = await db.execute(sql`
      SELECT id, trigger_type, size_bytes, created_at FROM backups ORDER BY created_at DESC
    `);
    return res.json((result as any).rows ?? result);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/backups", async (req, res) => {
  if ((req as any).sessionUser?.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado — apenas administradores" });
  try {
    const result = await createBackupSnapshot("manual");
    return res.json({ success: true, ...result });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── USERS ────────────────────────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  const role = (req as any).sessionUser?.role;
  if (!["ADMIN", "SUPERVISOR"].includes(role)) return res.status(403).json({ error: "Acesso negado" });
  try {
    const data = await db.select().from(users);
    return res.json(data.map(({ password: _p, ...rest }: any) => rest));
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/users", async (req, res) => {
  if ((req as any).sessionUser?.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado — apenas administradores" });
  try {
    const body = req.body;
    if (body.twoFactorEnabled && !body.email) return res.status(400).json({ error: "Verificação em 2 etapas requer e-mail cadastrado." });
    const hashedDefault = await hashPassword("123456");
    const item = await db.insert(users).values({ id: crypto.randomUUID(), password: hashedDefault, ...body }).returning();
    const { password: _p, ...safe } = item[0] as any;
    return res.json(safe);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
// Qualquer usuário autenticado pode alterar APENAS a própria senha
// (usado no primeiro acesso e após reset pelo admin)
router.post("/users/change-own-password", async (req, res) => {
  try {
    const sessionUser = (req as any).sessionUser;
    if (!sessionUser?.id) return res.status(401).json({ error: "Não autenticado." });
    const { password } = req.body as { password?: string };
    if (!password || password.length < 6) return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
    const hashed = await hashPassword(password);
    const item = await db.update(users)
      .set({ password: hashed, forcePasswordChange: false })
      .where(eq(users.id, sessionUser.id))
      .returning();
    if (!item.length) return res.status(404).json({ error: "Usuário não encontrado." });
    const { password: _p, ...safe } = item[0] as any;
    return res.json(safe);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

router.put("/users", async (req, res) => {
  if ((req as any).sessionUser?.role !== "ADMIN") return res.status(403).json({ error: "Acesso negado — apenas administradores" });
  try {
    const { id, createdAt, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: "ID obrigatório" });
    // 2FA exige e-mail
    if (updates.twoFactorEnabled && !updates.email) {
      const existing = await db.select().from(users).where(eq(users.id, id));
      if (!((existing[0] as any)?.email)) return res.status(400).json({ error: "Verificação em 2 etapas requer e-mail cadastrado." });
    }
    // Se a atualização inclui senha em texto puro, criptografar antes de salvar
    if (updates.password && !updates.password.startsWith("$2b$") && !updates.password.startsWith("$2a$")) {
      updates.password = await hashPassword(updates.password);
    }
    const item = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    const { password: _p, ...safe } = item[0] as any;
    return res.json(safe);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/users", async (req, res) => {
  try {
    const { id } = req.query as any;
    await db.delete(users).where(eq(users.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── SCHOOLS ──────────────────────────────────────────────────────────────────
router.get("/schools", async (_req, res) => {
  try { return res.json(await db.select().from(drivingSchools)); }
  catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/schools", async (req, res) => {
  try {
    const item = await db.insert(drivingSchools).values({ id: crypto.randomUUID(), ...req.body }).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/schools", async (req, res) => {
  try {
    const { id, createdAt, ...updates } = req.body;
    const item = await db.update(drivingSchools).set(updates).where(eq(drivingSchools.id, id)).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/schools", async (req, res) => {
  try {
    const { id } = req.query as any;
    await db.delete(drivingSchools).where(eq(drivingSchools.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── EXAMINERS ────────────────────────────────────────────────────────────────
router.get("/examiners", async (_req, res) => {
  try {
    try { await db.execute(sql`ALTER TABLE examiners ADD COLUMN IF NOT EXISTS default_max_slots_mudanca integer`); } catch {}
    return res.json(await db.select().from(examiners));
  }
  catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/examiners", async (req, res) => {
  try {
    const item = await db.insert(examiners).values({ id: crypto.randomUUID(), ...req.body }).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/examiners", async (req, res) => {
  try {
    const { id, createdAt, ...updates } = req.body;
    const item = await db.update(examiners).set(updates).where(eq(examiners.id, id)).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/examiners", async (req, res) => {
  try {
    const { id } = req.query as any;
    await db.delete(examiners).where(eq(examiners.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── INSTRUCTORS ──────────────────────────────────────────────────────────────
router.get("/instructors", async (_req, res) => {
  try {
    const allInstructors = await db.select().from(instructors);
    const allVehicles = await db.select().from(vehicles);
    const data = allInstructors.map((inst: any) => ({
      ...inst,
      vehicles: allVehicles.filter((v: any) => v.instructorId === inst.id)
    }));
    return res.json(data);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/instructors", async (req, res) => {
  try {
    const { vehicles: vList, ...instructorData } = req.body;
    const newId = crypto.randomUUID();
    const item = await db.insert(instructors).values({ id: newId, ...instructorData }).returning();
    if (instructorData.cpf) {
      const cpfNum = instructorData.cpf.replace(/\D/g, "");
      if (cpfNum) {
        await db.insert(users).values({
          id: crypto.randomUUID(), name: instructorData.name,
          login: cpfNum, password: await hashPassword("123456"), role: "INSTRUCTOR", instructorId: newId
        }).onConflictDoNothing();
      }
    }
    if (vList && Array.isArray(vList)) {
      for (const v of vList) {
        await db.insert(vehicles).values({ id: crypto.randomUUID(), instructorId: newId, ...v });
      }
    }
    const allVehicles = await db.select().from(vehicles).where(eq(vehicles.instructorId, newId));
    return res.json({ ...item[0], vehicles: allVehicles });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/instructors", async (req, res) => {
  try {
    const { id, createdAt, vehicles: vList, ...updates } = req.body;
    const item = await db.update(instructors).set(updates).where(eq(instructors.id, id)).returning();
    // Sincronizar login do usuário instrutor vinculado quando o CPF muda
    if (updates.cpf !== undefined) {
      try {
        const cpfNum = (updates.cpf ?? '').replace(/\D/g, '');
        if (cpfNum) {
          await db.execute(sql`
            UPDATE users SET login = ${cpfNum}
            WHERE instructor_id = ${id} AND role = 'INSTRUCTOR'
          `);
        }
      } catch {}
    }
    if (vList && Array.isArray(vList)) {
      for (const v of vList) {
        if (v.id) {
          const { id: vid, instructorId, createdAt: _c, ...vUpdates } = v;
          await db.update(vehicles).set(vUpdates).where(eq(vehicles.id, vid));
        } else {
          await db.insert(vehicles).values({ id: crypto.randomUUID(), instructorId: id, ...v });
        }
      }
    }
    const allVehicles = await db.select().from(vehicles).where(eq(vehicles.instructorId, id));
    return res.json({ ...item[0], vehicles: allVehicles });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/instructors", async (req, res) => {
  try {
    const { id } = req.query as any;
    await db.delete(vehicles).where(eq(vehicles.instructorId, id));
    await db.delete(instructors).where(eq(instructors.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── SCHEDULES ────────────────────────────────────────────────────────────────
const calcStatus = (dateStr: string, timeStr: string, cur: string) => {
  if (cur === "CANCELLED") return "CANCELLED";
  const cleanDate = dateStr.split("T")[0];
  const now = new Date();
  const examDate = new Date(`${cleanDate}T${timeStr}`);
  const ms = 60 * 60 * 1000;
  if (now > new Date(examDate.getTime() + 4 * ms)) return "CONCLUDED";
  if (now > new Date(examDate.getTime() - 12 * ms)) return "CLOSED";
  return "OPEN";
};

router.get("/schedules", async (_req, res) => {
  try {
    const schedules = await db.select().from(examSchedules);
    for (const s of schedules) {
      const calc = calcStatus(s.date, s.time, s.status);
      if (calc !== s.status) {
        if (calc === "CONCLUDED" && s.status !== "CONCLUDED") {
          // Atualiza status nas 3 tabelas de módulo (e na legada por segurança)
          for (const t of [cnhbrasilRequests, cfcRequests, pcdRequests, examRequests] as any[]) {
            await db.update(t)
              .set({ status: "WAITING_RESULT", updatedAt: new Date() })
              .where(and(eq(t.scheduleId, s.id), eq(t.status, "SCHEDULED")));
          }
        }
        await db.update(examSchedules).set({ status: calc }).where(eq(examSchedules.id, s.id));
        s.status = calc;
      }
    }
    return res.json(schedules);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/schedules", async (req, res) => {
  try {
    const body = req.body;
    const cleanDate = body.date.split("T")[0];
    const initialStatus = calcStatus(cleanDate, body.time, "OPEN");
    const last = await db.select({ code: examSchedules.code }).from(examSchedules)
      .where(isNotNull(examSchedules.code)).orderBy(desc(examSchedules.createdAt)).limit(1);
    let nextNum = 1001;
    if (last[0]?.code) {
      const num = parseInt(last[0].code.replace(/\D/g, ""), 10);
      if (!isNaN(num)) nextNum = num + 1;
    }
    const code = `B${nextNum}`;
    const item = await db.insert(examSchedules).values({
      id: crypto.randomUUID(), code, ...body, date: cleanDate, status: initialStatus
    }).returning();
    broadcast("schedules_updated", item[0]);
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/schedules", async (req, res) => {
  try {
    const body = req.body;
    const { id, action, reason, createdAt, ...updates } = body;
    if (action === "CANCEL") {
      const item = await db.update(examSchedules)
        .set({ status: "CANCELLED", cancellationReason: reason })
        .where(eq(examSchedules.id, id)).returning();
      broadcast("schedules_updated", item[0]);
      return res.json(item[0]);
    }
    const item = await db.update(examSchedules).set(updates).where(eq(examSchedules.id, id)).returning();
    broadcast("schedules_updated", item[0]);
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/schedules", async (req, res) => {
  try {
    const { id } = req.query as any;
    await db.delete(examSchedules).where(eq(examSchedules.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── REQUESTS ─────────────────────────────────────────────────────────────────
const ALLOWED_REQ_FIELDS = [
  "id", "studentName", "socialName", "cpf", "phone", "email", "address", "city",
  "requestType", "examType", "intendedCategory", "source", "schoolId",
  "paidFee", "completedPracticalCourse", "practicalHours", "hasVehicle",
  "cnhRestriction", "instructor", "vehiclePlate", "semDuploComando", "checklistVehicle",
  "practicalCourseInserted", "taxaPaga", "disabilityType", "specialNeeds",
  "status", "result", "scheduleId", "scheduledDate", "scheduledTime",
  "scheduledCategory", "examinerId", "attendanceConfirmed", "cancellationReason",
  "observation", "categoryQuantities", "examHistory", "scheduledBy", "queueUpdatedAt",
  "modulo", "rowColor"
];

/** Campos removidos de cada tabela de módulo — não podem ser gravados nelas */
const MODULE_DROPPED_FIELDS: Record<string, string[]> = {
  CNH_BRASIL: ['disabilityType', 'specialNeeds', 'semDuploComando', 'categoryQuantities'],
  CFC:        ['disabilityType', 'specialNeeds'],
  PCD:        ['semDuploComando', 'categoryQuantities'],
};

/** Remove campos que não existem mais na tabela do módulo alvo */
function stripDroppedFields(obj: any, modulo: string): any {
  const dropped = MODULE_DROPPED_FIELDS[modulo] ?? [];
  if (dropped.length === 0) return obj;
  const out = { ...obj };
  for (const f of dropped) delete out[f];
  return out;
}

function deriveModulo(data: any): string {
  if (data.examType === 'PCD' || data.schoolId === 'PCD') return 'PCD';
  if (!data.schoolId || data.schoolId === '' || data.schoolId === 'CNH_BRASIL') return 'CNH_BRASIL';
  return 'CFC';
}

/** Retorna a tabela Drizzle correta conforme o módulo */
function getRequestTable(modulo: string) {
  if (modulo === 'PCD') return pcdRequests;
  if (modulo === 'CFC') return cfcRequests;
  return cnhbrasilRequests;
}

/** Retorna a tabela de slots correta conforme o examType */
function getSlotTable(examType: string) {
  return examType === 'PCD' ? pcdScheduleSlots : cfcScheduleSlots;
}

/** Encontra um request pelo ID em qualquer das 3 tabelas de módulo (retorna camelCase via ORM) */
async function findRequestById(id: string): Promise<{ row: any; modulo: string } | null> {
  const [cnhRows, cfcRows, pcdRows] = await Promise.all([
    db.select().from(cnhbrasilRequests).where(eq(cnhbrasilRequests.id, id)).limit(1),
    db.select().from(cfcRequests).where(eq(cfcRequests.id, id)).limit(1),
    db.select().from(pcdRequests).where(eq(pcdRequests.id, id)).limit(1),
  ]);
  if (cnhRows.length > 0) return { row: cnhRows[0], modulo: 'CNH_BRASIL' };
  if (cfcRows.length > 0) return { row: cfcRows[0], modulo: 'CFC' };
  if (pcdRows.length > 0) return { row: pcdRows[0], modulo: 'PCD' };
  return null;
}

/** Encontra um slot pelo ID em qualquer das 2 tabelas de slots (retorna camelCase via ORM) */
async function findSlotById(id: string): Promise<{ row: any; module: 'CFC' | 'PCD' } | null> {
  const [cfcRows, pcdRows] = await Promise.all([
    db.select().from(cfcScheduleSlots).where(eq(cfcScheduleSlots.id, id)).limit(1),
    db.select().from(pcdScheduleSlots).where(eq(pcdScheduleSlots.id, id)).limit(1),
  ]);
  if (cfcRows.length > 0) return { row: cfcRows[0], module: 'CFC' };
  if (pcdRows.length > 0) return { row: pcdRows[0], module: 'PCD' };
  return null;
}

router.get("/requests", async (req, res) => {
  try {
    const { cpf } = req.query as any;
    if (cpf) {
      const clean = cpf.replace(/\D/g, "");
      const pattern = `%${clean}%`;
      const [cnhRows, cfcRows, pcdRows] = await Promise.all([
        db.select().from(cnhbrasilRequests).where(like(cnhbrasilRequests.cpf, pattern)),
        db.select().from(cfcRequests).where(like(cfcRequests.cpf, pattern)),
        db.select().from(pcdRequests).where(like(pcdRequests.cpf, pattern)),
      ]);
      return res.json([...cnhRows, ...cfcRows, ...pcdRows]);
    }
    const [cnhRows, cfcRows, pcdRows] = await Promise.all([
      db.select().from(cnhbrasilRequests),
      db.select().from(cfcRequests),
      db.select().from(pcdRequests),
    ]);
    return res.json([...cnhRows, ...cfcRows, ...pcdRows]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/requests", async (req, res) => {
  try {
    const body = req.body;
    const filtered: any = {};
    for (const k of ALLOWED_REQ_FIELDS) { if (body[k] !== undefined) filtered[k] = body[k]; }
    if (!filtered.modulo) filtered.modulo = deriveModulo(filtered);
    const safeFiltered = stripDroppedFields(filtered, filtered.modulo);
    const table = getRequestTable(safeFiltered.modulo);
    const item = await db.insert(table).values({
      id: safeFiltered.id || crypto.randomUUID(), ...safeFiltered,
      createdAt: new Date(), updatedAt: new Date()
    }).returning();
    const record = item[0] as any;
    if (record?.modulo === 'CNH_BRASIL') {
      try {
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          userId: req.headers['x-user-id'] as string || null,
          userName: req.headers['x-user-name'] as string || null,
          userRole: req.headers['x-user-role'] as string || null,
          action: 'Foi cadastrado', entity: 'CNH_BRASIL_CANDIDATO', entityId: record.id,
          details: { cpf: record.cpf ?? null, name: record.studentName ?? null },
        });
      } catch {}
    }
    broadcast("requests_updated", record);
    return res.json(record);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
// Campos que representam edição real do cadastro do candidato
// (excluem campos de banca, cores, presença e estado interno)
const AUDIT_TRACKED_FIELDS = [
  'studentName','socialName','cpf','phone','email','address','city',
  'requestType','examType','intendedCategory','source',
  'paidFee','completedPracticalCourse','practicalHours','hasVehicle',
  'cnhRestriction','instructor','vehiclePlate','checklistVehicle',
  'practicalCourseInserted','taxaPaga','disabilityType','specialNeeds',
  'observation','cancellationReason',
];

router.put("/requests", async (req, res) => {
  try {
    const body = req.body;
    if (!body?.id) return res.status(400).json({ error: "ID required" });
    const { id, createdAt, ...rawUpdates } = body;
    const updates: any = {};
    for (const k of ALLOWED_REQ_FIELDS) { if (rawUpdates[k] !== undefined) updates[k] = rawUpdates[k]; }
    updates.updatedAt = new Date();

    // Busca registro para saber qual tabela atualizar e para auditoria
    const found = await findRequestById(id);
    const oldModulo = found?.modulo ?? deriveModulo(rawUpdates);
    // Deriva módulo destino a partir dos dados mesclados (old + incoming)
    // para capturar mudanças em examType/schoolId sem campo modulo explícito
    const mergedExamType = rawUpdates.examType ?? found?.row?.examType;
    const mergedSchoolId = rawUpdates.schoolId ?? found?.row?.schoolId;
    const newModulo = updates.modulo || deriveModulo({ examType: mergedExamType, schoolId: mergedSchoolId });
    const oldTable = getRequestTable(oldModulo);
    const newTable = getRequestTable(newModulo);

    let record: any;
    if (oldModulo !== newModulo) {
      // Módulo mudou: mover linha atomicamente para a tabela destino
      // Merge do registro antigo (camelCase do ORM) com as atualizações
      const merged = stripDroppedFields(
        { ...found?.row, ...updates, modulo: newModulo, updatedAt: new Date() },
        newModulo
      );
      await db.transaction(async (tx) => {
        await (tx.insert(newTable) as any).values(merged).onConflictDoNothing();
        await tx.delete(oldTable).where(eq(oldTable.id, id));
      });
      record = merged;
    } else {
      const safeUpdates = stripDroppedFields(updates, newModulo);
      const item = await db.update(oldTable).set(safeUpdates).where(eq(oldTable.id, id)).returning();
      record = item[0];
    }
    if (record?.modulo === 'CNH_BRASIL') {
      try {
        let action: string | null = null;
        if (body.scheduleId && body.status === 'SCHEDULED') {
          action = 'Foi adicionado na Banca';
        } else if (body.scheduleId === null && body.status === 'WAITING_SCHEDULING') {
          action = 'Foi excluído da Banca';
        } else {
          const changed = AUDIT_TRACKED_FIELDS.some(f => {
            const oldVal = (found?.row as any)?.[f];
            const newVal = rawUpdates[f];
            if (newVal === undefined) return false;
            return String(oldVal ?? '') !== String(newVal ?? '');
          });
          if (changed) action = 'Foi modificado';
        }
        if (action) {
          await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            userId: req.headers['x-user-id'] as string || null,
            userName: req.headers['x-user-name'] as string || null,
            userRole: req.headers['x-user-role'] as string || null,
            action, entity: 'CNH_BRASIL_CANDIDATO', entityId: record.id,
            details: { cpf: record.cpf ?? null, name: record.studentName ?? null },
          });
        }
      } catch {}
    }
    broadcast("requests_updated", record);
    return res.json(record);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/requests", async (req, res) => {
  try {
    const { id } = req.query as any;
    const found = await findRequestById(id);
    // Apaga da tabela correta (e das outras como segurança)
    await db.delete(cnhbrasilRequests).where(eq(cnhbrasilRequests.id, id));
    await db.delete(cfcRequests).where(eq(cfcRequests.id, id));
    await db.delete(pcdRequests).where(eq(pcdRequests.id, id));
    if (found?.modulo === 'CNH_BRASIL') {
      try {
        await db.insert(auditLogs).values({
          id: crypto.randomUUID(),
          userId: req.headers['x-user-id'] as string || null,
          userName: req.headers['x-user-name'] as string || null,
          userRole: req.headers['x-user-role'] as string || null,
          action: 'Foi excluído', entity: 'CNH_BRASIL_CANDIDATO', entityId: id,
          details: { cpf: found.row?.cpf ?? null, name: found.row?.studentName ?? null },
        });
      } catch {}
    }
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
router.get("/settings", async (_req, res) => {
  try {
    const data = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
    if (data.length === 0) {
      const def = await db.insert(systemSettings).values({ id: 1, agencyName: "DETRAN" }).returning();
      return res.json(def[0]);
    }
    return res.json(data[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/settings", async (req, res) => {
  try {
    const { id: _id, ...updates } = req.body;
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
    if (existing.length === 0) {
      const item = await db.insert(systemSettings).values({ id: 1, ...updates }).returning();
      return res.json(item[0]);
    }
    const item = await db.update(systemSettings).set(updates).where(eq(systemSettings.id, 1)).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── BLOCKED DATES ────────────────────────────────────────────────────────────
router.get("/blocked-dates", async (_req, res) => {
  try { return res.json(await db.select().from(blockedDates).orderBy(blockedDates.date)); }
  catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/blocked-dates", async (req, res) => {
  try {
    const { date, description, isHoliday } = req.body;
    if (!date) return res.status(400).json({ error: "Data é obrigatória" });
    const existing = await db.select().from(blockedDates).where(eq(blockedDates.date, date));
    if (existing.length > 0) return res.status(400).json({ error: "Data já bloqueada" });
    const item = { id: crypto.randomUUID(), date, description: description || "", isHoliday: !!isHoliday, createdAt: new Date() };
    await db.insert(blockedDates).values(item);
    return res.status(201).json(item);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/blocked-dates", async (req, res) => {
  try {
    const { id } = req.query as any;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.update(blockedDates).set(req.body).where(eq(blockedDates.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/blocked-dates", async (req, res) => {
  try {
    const { id } = req.query as any;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.delete(blockedDates).where(eq(blockedDates.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── CITIES ───────────────────────────────────────────────────────────────────
router.get("/cities", async (_req, res) => {
  try { return res.json(await db.select().from(cities)); }
  catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/cities", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
    const norm = name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const item = { id: crypto.randomUUID(), name: norm, createdAt: new Date() };
    await db.insert(cities).values(item);
    return res.status(201).json(item);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/cities", async (req, res) => {
  try {
    const { id, name } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    const norm = name?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    await db.update(cities).set({ name: norm }).where(eq(cities.id, id));
    return res.json({ id, name: norm });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/cities", async (req, res) => {
  try {
    const { id } = req.query as any;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.delete(cities).where(eq(cities.id, id));
    return res.status(204).end();
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── BANCA RESULTS ────────────────────────────────────────────────────────────
router.get("/banca-results", async (req, res) => {
  try {
    const { scheduleId, schoolId } = req.query as any;
    let q = db.select().from(bancaResults);
    if (scheduleId && schoolId) {
      // @ts-ignore
      q = q.where(and(eq(bancaResults.scheduleId, scheduleId), eq(bancaResults.schoolId, schoolId)));
    } else if (scheduleId) {
      // @ts-ignore
      q = q.where(eq(bancaResults.scheduleId, scheduleId));
    } else if (schoolId) {
      // @ts-ignore
      q = q.where(eq(bancaResults.schoolId, schoolId));
    }
    return res.json(await q);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/banca-results", async (req, res) => {
  try {
    const { scheduleId, schoolId, category, ...rest } = req.body;
    if (!scheduleId || !schoolId || !category) return res.status(400).json({ error: "scheduleId, schoolId, category required" });
    const existing = await db.select().from(bancaResults)
      .where(and(eq(bancaResults.scheduleId, scheduleId), eq(bancaResults.schoolId, schoolId), eq(bancaResults.category, category)));
    if (existing.length > 0) {
      const updated = await db.update(bancaResults).set({ ...rest, updatedAt: new Date() })
        .where(eq(bancaResults.id, existing[0].id)).returning();
      return res.json(updated[0]);
    }
    const item = await db.insert(bancaResults).values({ id: crypto.randomUUID(), scheduleId, schoolId, category, ...rest }).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/banca-results", async (req, res) => {
  try {
    const { id, createdAt, ...updates } = req.body;
    const item = await db.update(bancaResults).set({ ...updates, updatedAt: new Date() })
      .where(eq(bancaResults.id, id)).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── RISK AREA ────────────────────────────────────────────────────────────────
router.get("/risk-area", (_req, res) => res.json({ enabled: false, areas: [] }));
router.post("/risk-area", (_req, res) => res.json({ success: true }));

// ─── VEHICLE LOOKUP ───────────────────────────────────────────────────────────
import https from "https";
const PLATE_RE = /^[A-Z]{3}[0-9]{4}$|^[A-Z]{3}[0-9][A-Z][0-9]{2}$|^[A-Z]{3}[0-9]{2}[A-Z][0-9]$/;

router.get("/vehicle-lookup", async (req, res) => {
  const plate = ((req.query as any).plate || "").toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!plate || plate.length < 7) return res.status(400).json({ error: "Placa inválida" });
  if (!PLATE_RE.test(plate)) return res.status(400).json({ error: "Formato de placa inválido" });
  try {
    const data = await new Promise<any>((resolve, reject) => {
      const r = https.get(`https://apicarros.com/v1/consulta/${plate}/json`, {
        headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
        rejectUnauthorized: false,
      }, (resp) => {
        let body = "";
        resp.on("data", (c) => { body += c; });
        resp.on("end", () => resolve({ status: resp.statusCode, body }));
      });
      r.on("error", reject);
      r.setTimeout(9000, () => r.destroy(new Error("timeout")));
    });
    if (data.status === 404) return res.status(404).json({ error: "Veículo não encontrado" });
    if (data.status !== 200) return res.status(503).json({ error: "Serviço indisponível" });
    const d = JSON.parse(data.body);
    return res.json({
      plate: d.placa || plate, brand: d.marca || "", model: d.modelo || "",
      color: d.cor || "", year: d.anoModelo || "", state: d.uf || "", city: d.municipio || "",
    });
  } catch (err: any) { return res.status(503).json({ error: "Serviço indisponível" }); }
});

// ─── SCHEDULE SLOTS ───────────────────────────────────────────────────────────
router.get("/schedule-slots", async (req, res) => {
  try {
    const { schoolId, scheduledDate } = req.query as any;
    // UNION das tabelas CFC e PCD via ORM (CNH Brasil não usa slots)
    let cfcQ = db.select().from(cfcScheduleSlots) as any;
    let pcdQ = db.select().from(pcdScheduleSlots) as any;
    if (schoolId) {
      cfcQ = cfcQ.where(eq(cfcScheduleSlots.schoolId, schoolId));
      pcdQ = pcdQ.where(eq(pcdScheduleSlots.schoolId, schoolId));
    }
    if (scheduledDate) {
      cfcQ = cfcQ.where(eq(cfcScheduleSlots.scheduledDate, scheduledDate));
      pcdQ = pcdQ.where(eq(pcdScheduleSlots.scheduledDate, scheduledDate));
    }
    const [cfcRows, pcdRows] = await Promise.all([cfcQ, pcdQ]);
    return res.json([...(cfcRows as any[]), ...(pcdRows as any[])]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/schedule-slots", async (req, res) => {
  try {
    const body = req.body;
    const table = getSlotTable(body.examType || '');
    const item = await db.insert(table).values({
      id: body.id || crypto.randomUUID(),
      schoolId: body.schoolId, examType: body.examType,
      requestType: body.requestType || "FIXA", intendedCategory: body.intendedCategory,
      scheduledDate: body.scheduledDate, scheduledTime: body.scheduledTime,
      examinerId: body.examinerId, scheduleId: body.scheduleId,
      scheduledCategory: body.scheduledCategory, status: body.status || "SCHEDULED",
      attendanceConfirmed: body.attendanceConfirmed ?? false,
      cancellationReason: body.cancellationReason, observation: body.observation,
      createdAt: new Date(), updatedAt: new Date(),
    }).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/schedule-slots", async (req, res) => {
  try {
    const { id, createdAt, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    const allowed = ["schoolId","examType","requestType","intendedCategory","scheduledDate",
      "scheduledTime","examinerId","scheduleId","scheduledCategory","status",
      "attendanceConfirmed","cancellationReason","observation"];
    const filtered: any = {};
    for (const k of allowed) { if (updates[k] !== undefined) filtered[k] = updates[k]; }
    // Descobre em qual tabela está o slot e atualiza (ORM devolve camelCase)
    const foundSlot = await findSlotById(id);
    const oldSlotModule = foundSlot?.module;
    const newExamType = filtered.examType ?? foundSlot?.row?.examType ?? '';
    const newSlotModule: 'CFC' | 'PCD' = newExamType === 'PCD' ? 'PCD' : 'CFC';
    const oldSlotTable = oldSlotModule === 'PCD' ? pcdScheduleSlots : cfcScheduleSlots;
    const newSlotTable = newSlotModule === 'PCD' ? pcdScheduleSlots : cfcScheduleSlots;

    let slotResult: any;
    if (oldSlotModule && oldSlotModule !== newSlotModule) {
      // examType mudou de categoria: mover slot atomicamente para a tabela correta
      const merged = { ...foundSlot!.row, ...filtered, updatedAt: new Date() };
      await db.transaction(async (tx) => {
        await (tx.insert(newSlotTable) as any).values(merged).onConflictDoNothing();
        await tx.delete(oldSlotTable).where(eq(oldSlotTable.id, id));
      });
      slotResult = merged;
    } else {
      const item = await db.update(oldSlotTable).set({ ...filtered, updatedAt: new Date() })
        .where(eq(oldSlotTable.id, id)).returning();
      slotResult = item[0] ?? { id, ...updates };
    }
    return res.json(slotResult);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/schedule-slots", async (req, res) => {
  try {
    const { id } = req.query as any;
    if (!id) return res.status(400).json({ error: "ID required" });
    // Apaga das 2 tabelas — apenas uma terá o registro
    await db.delete(cfcScheduleSlots).where(eq(cfcScheduleSlots.id, id));
    await db.delete(pcdScheduleSlots).where(eq(pcdScheduleSlots.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── EXAM LOCATIONS ───────────────────────────────────────────────────────────
router.get("/exam-locations", async (_req, res) => {
  try {
    return res.json(await db.select().from(examLocations));
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/exam-locations", async (req, res) => {
  try {
    const { cityId, address, mapsUrl, regionsServed } = req.body;
    if (!cityId) return res.status(400).json({ error: "cityId é obrigatório" });
    const item = await db.insert(examLocations).values({
      id: crypto.randomUUID(), cityId, address: address || null,
      mapsUrl: mapsUrl || null, regionsServed: regionsServed || [],
    }).returning();
    return res.status(201).json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/exam-locations", async (req, res) => {
  try {
    const { id, createdAt, ...updates } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    const item = await db.update(examLocations).set(updates).where(eq(examLocations.id, id)).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/exam-locations", async (req, res) => {
  try {
    const { id } = req.query as any;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.delete(examLocations).where(eq(examLocations.id, id));
    return res.status(204).end();
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── CNH BRASIL LOGS ──────────────────────────────────────────────────────────
router.get("/cnh-logs", async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || "300");
    const offset = parseInt((req.query.offset as string) || "0");
    const rows = await db.execute(sql`
      SELECT id, user_id, user_name, user_role, action, entity, entity_id, details, created_at
      FROM audit_logs
      WHERE entity LIKE 'CNH_BRASIL%'
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return res.json((rows as any).rows ?? rows);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── SETUP (protegido por SESSION_SECRET) ─────────────────────────────────────
// Requer header Authorization: Bearer <SESSION_SECRET>.
// Cria usuário admin apenas se não existir — não define senha (definida no primeiro login).
router.all("/setup", async (req, res) => {
  const sessionSecret = process.env.SESSION_SECRET;
  const authHeader = req.headers["authorization"] ?? "";
  if (!sessionSecret || authHeader !== `Bearer ${sessionSecret}`) {
    return res.status(401).json({ error: "Acesso não autorizado. Forneça o header Authorization: Bearer <SESSION_SECRET>." });
  }
  try {
    const existing = await db.select().from(users).where(eq(users.login, "admin"));
    if (existing.length === 0) {
      await db.insert(users).values({
        id: crypto.randomUUID(), name: "Administrador", login: "admin",
        password: null, role: "ADMIN", forcePasswordChange: false,
      });
    }
    return res.json({ success: true, message: "Setup ok" });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
