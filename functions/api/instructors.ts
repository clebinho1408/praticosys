// functions/api/instructors.ts  →  GET|POST|PUT|DELETE /api/instructors
import { getDb, json, error, parseBody, getQuery } from '../_db.js';
import { instructors, vehicles } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;
    const query = getQuery(request.url);

    if (method === 'GET') {
      const allInstructors = await db.select().from(instructors);
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
      const newItem = await db.insert(instructors).values({ id: newId, ...instructorData }).returning();

      if (Array.isArray(vehiclesList)) {
        for (const v of vehiclesList) {
          await db.insert(vehicles).values({
            id: crypto.randomUUID(), instructorId: newId, type: v.type, brand: v.brand,
            model: v.model, plate: v.plate, active: v.active ?? true,
            transmission: v.transmission, accessories: v.accessories || [],
          });
        }
      }
      return json({ ...newItem[0], vehicles: vehiclesList || [] });
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const { id, vehicles: vehiclesList, createdAt, updatedAt, ...updates } = body;
      const updated = await db.update(instructors).set(updates).where(eq(instructors.id, id)).returning();

      if (Array.isArray(vehiclesList)) {
        await db.delete(vehicles).where(eq(vehicles.instructorId, id));
        for (const v of vehiclesList) {
          await db.insert(vehicles).values({
            id: (!v.id || v.id.startsWith('temp_')) ? crypto.randomUUID() : v.id,
            instructorId: id, type: v.type, brand: v.brand, model: v.model,
            plate: v.plate, active: v.active ?? true, transmission: v.transmission,
            accessories: v.accessories || [],
          });
        }
      }
      return json({ ...updated[0], vehicles: vehiclesList || [] });
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
