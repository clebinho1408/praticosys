
import { db } from '../db/index.js';
import { instructors, vehicles } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const allInstructors = await db.select().from(instructors);
      const allVehicles = await db.select().from(vehicles);
      
      // Agrupa veículos por instrutor
      const data = allInstructors.map(inst => ({
          ...inst,
          vehicles: allVehicles.filter(v => v.instructorId === inst.id)
      }));
      
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const { vehicles: vehiclesList, ...instructorData } = body;
      
      const newInstructorId = crypto.randomUUID();
      
      // Cria o instrutor
      const newItem = await db.insert(instructors).values({
        id: newInstructorId,
        ...instructorData
      }).returning();
      
      // Cria os veículos se houver
      if (vehiclesList && Array.isArray(vehiclesList)) {
          for (const v of vehiclesList) {
              await db.insert(vehicles).values({
                  id: crypto.randomUUID(),
                  instructorId: newInstructorId,
                  type: v.type,
                  brand: v.brand,
                  model: v.model,
                  plate: v.plate,
                  active: v.active ?? true
              });
          }
      }
      
      // Retorna objeto completo (mockado o retorno dos veículos para economizar query)
      return res.status(200).json({ ...newItem[0], vehicles: vehiclesList || [] });
    }

    if (req.method === 'PUT') {
      const { id, vehicles: vehiclesList, ...updates } = parseBody(req);
      
      // Atualiza dados básicos
      const updated = await db.update(instructors)
        .set(updates)
        .where(eq(instructors.id, id))
        .returning();
      
      // Sincronização Simplificada de Veículos (Apaga tudo e recria)
      // Em produção usaria transação e diff, mas aqui simplificamos.
      if (vehiclesList && Array.isArray(vehiclesList)) {
          await db.delete(vehicles).where(eq(vehicles.instructorId, id));
          
          for (const v of vehiclesList) {
              await db.insert(vehicles).values({
                  id: v.id || crypto.randomUUID(),
                  instructorId: id,
                  type: v.type,
                  brand: v.brand,
                  model: v.model,
                  plate: v.plate,
                  active: v.active ?? true
              });
          }
      }
        
      return res.status(200).json({ ...updated[0], vehicles: vehiclesList || [] });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      // Remove veículos primeiro (constraint manual)
      await db.delete(vehicles).where(eq(vehicles.instructorId, id));
      await db.delete(instructors).where(eq(instructors.id, id));
      return res.status(200).json({ success: true });
    }
  } catch (error: any) {
    console.error("Instructors API Error:", error);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
