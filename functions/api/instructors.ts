// functions/api/instructors.ts  →  GET|POST|PUT|DELETE /api/instructors
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { instructors, vehicles } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { encryptCpf, decryptCpfInRows, validateCpfKey } from '../_cpf.js';

export const onRequest: PagesFunction<{ DATABASE_URL: string; DATA_ENCRYPTION_KEY?: string }> = async ({ request, env }) => {
  const encKey = (env as any).DATA_ENCRYPTION_KEY ?? '';
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    try {
      await db.execute(sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS duplo_comando boolean DEFAULT false`);
      await db.execute(sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS procuracao boolean DEFAULT false`);
    } catch {}

    if (method === 'GET') {
      const allInstructors = await decryptCpfInRows(await db.select().from(instructors), encKey);
      const allVehicles = await db.select().from(vehicles);
      const data = allInstructors.map((inst: any) => ({
        ...inst,
        vehicles: allVehicles.filter((v: any) => v.instructorId === inst.id),
      }));
      return json(data);
    }

    if (method === 'POST') {
      const body = await parseBody<any>(request);
      const { vehicles: vehiclesList, ...instructorData } = body;
      const newId = crypto.randomUUID();
      if (instructorData.cpf) {
        const keyErr = validateCpfKey(encKey);
        if (keyErr) return error(`Proteção de dados indisponível: ${keyErr}`, 503);
        const r = await encryptCpf(instructorData.cpf, encKey);
        instructorData.cpf = r?.enc ?? null;
        (instructorData as any).cpfHash = r?.hash ?? null;
      }
      const newItem = await db.insert(instructors).values({ id: newId, ...instructorData }).returning();

      if (Array.isArray(vehiclesList)) {
        for (const v of vehiclesList) {
          await db.insert(vehicles).values({
            id: crypto.randomUUID(), instructorId: newId, type: v.type, brand: v.brand,
            model: v.model, plate: v.plate, active: v.active ?? true,
            transmission: v.transmission, accessories: v.accessories || [],
            duploComando: v.duploComando ?? false,
            procuracao: v.procuracao ?? false,
          });
        }
      }
      const decryptedNew = (await decryptCpfInRows([newItem[0]], encKey))[0];
      return json({ ...decryptedNew, vehicles: vehiclesList || [] });
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const { id, vehicles: vehiclesList, createdAt, updatedAt, ...updates } = body;
      let newCpfHmac: string | null | undefined;
      if (updates.cpf !== undefined) {
        if (updates.cpf) {
          const keyErr = validateCpfKey(encKey);
          if (keyErr) return error(`Proteção de dados indisponível: ${keyErr}`, 503);
          const r = await encryptCpf(updates.cpf, encKey);
          updates.cpf = r?.enc ?? null;
          updates.cpfHash = r?.hash ?? null;
          newCpfHmac = r?.hash ?? null;
        } else {
          updates.cpf = null;
          updates.cpfHash = null;
          newCpfHmac = null;
        }
      }
      const updated = await db.update(instructors).set(updates).where(eq(instructors.id, id)).returning();
      // Sincronizar login do usuário instrutor vinculado quando o CPF muda
      if (newCpfHmac !== undefined) {
        try {
          await db.execute(sql`
            UPDATE users SET login = ${newCpfHmac}
            WHERE instructor_id = ${id} AND role = 'INSTRUCTOR'
          `);
        } catch {}
      }

      if (Array.isArray(vehiclesList)) {
        await db.delete(vehicles).where(eq(vehicles.instructorId, id));
        for (const v of vehiclesList) {
          await db.insert(vehicles).values({
            id: (!v.id || v.id.startsWith('temp_')) ? crypto.randomUUID() : v.id,
            instructorId: id, type: v.type, brand: v.brand, model: v.model,
            plate: v.plate, active: v.active ?? true, transmission: v.transmission,
            accessories: v.accessories || [],
            duploComando: v.duploComando ?? false,
            procuracao: v.procuracao ?? false,
          });
        }
      }
      const decryptedUpdated = (await decryptCpfInRows([updated[0]], encKey))[0];
      return json({ ...decryptedUpdated, vehicles: vehiclesList || [] });
    }

    if (method === 'DELETE') {
      const id = query.id;
      if (!id) return error('ID obrigatório', 400);
      await db.delete(vehicles).where(eq(vehicles.instructorId, id));
      await db.delete(instructors).where(eq(instructors.id, id));
      return json({ success: true });
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
