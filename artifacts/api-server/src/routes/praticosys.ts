import { Router } from "express";
import { db } from "@workspace/db";
import {
  users, drivingSchools, examiners, instructors, vehicles,
  examSchedules, examRequests, systemSettings, blockedDates,
  cities, examScheduleSlots, bancaResults
} from "@workspace/db";
import { eq, and, like, isNotNull, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import type { Response } from "express";

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
    if (login === "admin" && !user.password) {
      const updated = await db.update(users)
        .set({ password, forcePasswordChange: false })
        .where(eq(users.id, user.id))
        .returning();
      const { password: _p, ...safe } = (updated[0] || user) as any;
      return res.status(200).json(safe);
    }
    if (user.password && user.password !== password) {
      return res.status(401).json({ error: "Senha incorreta" });
    }
    const { password: _p, ...safe } = user;
    return res.status(200).json(safe);
  } catch (err: any) {
    return res.status(500).json({ error: "Erro interno", details: err.message });
  }
});

// ─── USERS ────────────────────────────────────────────────────────────────────
router.get("/users", async (_req, res) => {
  try {
    const data = await db.select().from(users);
    return res.json(data.map(({ password: _p, ...rest }: any) => rest));
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/users", async (req, res) => {
  try {
    const body = req.body;
    const item = await db.insert(users).values({ id: crypto.randomUUID(), password: "123456", ...body }).returning();
    const { password: _p, ...safe } = item[0] as any;
    return res.json(safe);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/users", async (req, res) => {
  try {
    const { id, createdAt, ...updates } = req.body;
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
  try { return res.json(await db.select().from(examiners)); }
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
          login: cpfNum, password: "123456", role: "INSTRUCTOR", instructorId: newId
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
          await db.update(examRequests)
            .set({ status: "WAITING_RESULT", updatedAt: new Date() })
            .where(and(eq(examRequests.scheduleId, s.id), eq(examRequests.status, "SCHEDULED")));
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
  "cnhRestriction", "instructor", "vehiclePlate", "checklistVehicle",
  "practicalCourseInserted", "taxaPaga", "disabilityType", "specialNeeds",
  "status", "result", "scheduleId", "scheduledDate", "scheduledTime",
  "scheduledCategory", "examinerId", "attendanceConfirmed", "cancellationReason",
  "observation", "categoryQuantities", "examHistory", "scheduledBy", "queueUpdatedAt",
  "modulo"
];

function deriveModulo(data: any): string {
  if (data.examType === 'PCD') return 'PCD';
  if (!data.schoolId || data.schoolId === 'CNH_BRASIL') return 'CNH_BRASIL';
  return 'CFC';
}

router.get("/requests", async (req, res) => {
  try {
    // Migration: add modulo column and backfill existing records
    try {
      await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS modulo text`);
      await db.execute(sql`
        UPDATE exam_requests
        SET modulo = CASE
          WHEN exam_type = 'PCD' THEN 'PCD'
          WHEN school_id IS NULL OR school_id = 'CNH_BRASIL' THEN 'CNH_BRASIL'
          ELSE 'CFC'
        END
        WHERE modulo IS NULL
      `);
    } catch {}
    const { cpf } = req.query as any;
    if (cpf) {
      const clean = cpf.replace(/\D/g, "");
      return res.json(await db.select().from(examRequests).where(like(examRequests.cpf, `%${clean}%`)));
    }
    return res.json(await db.select().from(examRequests));
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/requests", async (req, res) => {
  try {
    const body = req.body;
    const filtered: any = {};
    for (const k of ALLOWED_REQ_FIELDS) { if (body[k] !== undefined) filtered[k] = body[k]; }
    if (!filtered.modulo) filtered.modulo = deriveModulo(filtered);
    const item = await db.insert(examRequests).values({
      id: filtered.id || crypto.randomUUID(), ...filtered,
      createdAt: new Date(), updatedAt: new Date()
    }).returning();
    broadcast("requests_updated", item[0]);
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.put("/requests", async (req, res) => {
  try {
    const body = req.body;
    if (!body?.id) return res.status(400).json({ error: "ID required" });
    const { id, createdAt, ...rawUpdates } = body;
    const updates: any = {};
    for (const k of ALLOWED_REQ_FIELDS) { if (rawUpdates[k] !== undefined) updates[k] = rawUpdates[k]; }
    updates.updatedAt = new Date();
    const item = await db.update(examRequests).set(updates).where(eq(examRequests.id, id)).returning();
    broadcast("requests_updated", item[0]);
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/requests", async (req, res) => {
  try {
    const { id } = req.query as any;
    await db.delete(examRequests).where(eq(examRequests.id, id));
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
    let q = db.select().from(examScheduleSlots) as any;
    if (schoolId) q = q.where(eq(examScheduleSlots.schoolId, schoolId));
    if (scheduledDate) q = q.where(eq(examScheduleSlots.scheduledDate, scheduledDate));
    return res.json(await q);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.post("/schedule-slots", async (req, res) => {
  try {
    const body = req.body;
    const item = await db.insert(examScheduleSlots).values({
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
    const item = await db.update(examScheduleSlots).set({ ...filtered, updatedAt: new Date() })
      .where(eq(examScheduleSlots.id, id)).returning();
    return res.json(item[0]);
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});
router.delete("/schedule-slots", async (req, res) => {
  try {
    const { id } = req.query as any;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.delete(examScheduleSlots).where(eq(examScheduleSlots.id, id));
    return res.json({ success: true });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

// ─── SETUP (diagnostics) ──────────────────────────────────────────────────────
router.all("/setup", async (_req, res) => {
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
