
// Requests API Handler
import { db } from '../../db/index.js';
import { examRequests } from '../../db/schema.js';
import { eq, like, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { broadcast } from '../sse.js';

const parseBody = (req: any) => {
    try {
        return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
        return req.body;
    }
};

export default async function handler(req: any, res: any) {
  console.log("[API/Requests] Handler called. examRequests defined:", !!examRequests);
  if (examRequests) {
    console.log("[API/Requests] examRequests name:", (examRequests as any)[Symbol.for('drizzle:Name')]);
  }
  try {
    if (req.method === 'GET') {
      try {
        await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS city text`);
        await db.execute(sql`ALTER TABLE exam_requests ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'EXTRA'`);
      } catch (e) {
        console.warn("[API Requests] Schema sync warning:", e);
      }
      const { cpf } = req.query;
      if (cpf) {
         const cleanCpf = cpf.replace(/\D/g, '');
         const data = await db.select().from(examRequests).where(like(examRequests.cpf, `%${cleanCpf}%`));
         return res.status(200).json(data);
      }
      const data = await db.select().from(examRequests);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      console.log("[API/Requests] POST Body:", JSON.stringify(body));

      // Filtrar apenas campos que existem no schema para evitar erro do Drizzle
      const allowedFields = [
        'id', 'studentName', 'socialName', 'cpf', 'phone', 'email', 'address', 'city',
        'requestType', 'examType', 'intendedCategory', 'source', 'schoolId',
        'paidFee', 'completedPracticalCourse', 'practicalHours', 'hasVehicle',
        'cnhRestriction', 'instructor', 'vehiclePlate', 'disabilityType',
        'specialNeeds', 'status', 'result', 'scheduleId', 'scheduledDate',
        'scheduledTime', 'scheduledCategory', 'examinerId', 'attendanceConfirmed',
        'cancellationReason', 'observation', 'examHistory'
      ];

      const filteredBody: any = {};
      for (const key of allowedFields) {
        if (body[key] !== undefined) {
          filteredBody[key] = body[key];
        }
      }

      const newItem = await db.insert(examRequests).values({
        id: filteredBody.id || crypto.randomUUID(),
        ...filteredBody,
        // Fallbacks para evitar erro de NOT NULL no banco de dados de produção (Vercel)
        studentName: filteredBody.studentName || 'Vaga Disponível',
        cpf: filteredBody.cpf || '00000000000',
        phone: filteredBody.phone || '00000000000',
        // Ensure dates are Date objects if they were passed as strings
        createdAt: filteredBody.createdAt ? new Date(filteredBody.createdAt) : new Date(),
        updatedAt: new Date()
      }).returning();

      if (!newItem || newItem.length === 0) {
        const fallback = { 
          id: body.id || crypto.randomUUID(), 
          ...body,
          createdAt: body.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        broadcast('requests_updated', fallback);
        return res.status(200).json(fallback);
      }

      broadcast('requests_updated', newItem[0]);
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const body = parseBody(req);
      console.log("[API/Requests] PUT Body:", JSON.stringify(body));
      if (!body || !body.id) {
        return res.status(400).json({ error: 'ID is required for update' });
      }

      const { id, updatedAt, ...updates } = body;
      
      // Prevent nulling out required fields on Vercel
      if (updates.studentName === null || updates.studentName === '') updates.studentName = 'Vaga Disponível';
      if (updates.cpf === null || updates.cpf === '') updates.cpf = '00000000000';
      if (updates.phone === null || updates.phone === '') updates.phone = '00000000000';

      // Filtrar apenas campos que existem no schema para evitar erro do Drizzle
      // "Cannot read properties of undefined (reading 'name')"
      const allowedFields = [
        'studentName', 'socialName', 'cpf', 'phone', 'email', 'address', 'city',
        'requestType', 'examType', 'intendedCategory', 'source', 'schoolId',
        'paidFee', 'completedPracticalCourse', 'practicalHours', 'hasVehicle',
        'cnhRestriction', 'instructor', 'vehiclePlate', 'disabilityType',
        'specialNeeds', 'status', 'result', 'scheduleId', 'scheduledDate',
        'scheduledTime', 'scheduledCategory', 'examinerId', 'attendanceConfirmed',
        'cancellationReason', 'observation', 'examHistory', 'createdAt'
      ];

      const filteredUpdates: any = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          if (key === 'createdAt') {
            filteredUpdates[key] = new Date(updates[key]);
          } else {
            filteredUpdates[key] = updates[key];
          }
        }
      }

      console.log("[API/Requests] Filtered Updates:", JSON.stringify(filteredUpdates));

      try {
        const updated = await db.update(examRequests)
          .set({ ...filteredUpdates, updatedAt: new Date() })
          .where(eq(examRequests.id, id))
          .returning();

        if (!updated || updated.length === 0) {
          // Fallback for mock mode or databases that don't support returning
          // We try to return the updates object at least
          const fallback = { id, ...updates, updatedAt: new Date().toISOString() };
          broadcast('requests_updated', fallback);
          return res.status(200).json(fallback);
        }

        broadcast('requests_updated', updated[0]);
        return res.status(200).json(updated[0]);
      } catch (err: any) {
        console.error("[API/Requests] Update Error:", err);
        throw err; // Re-throw to be caught by the outer catch
      }
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      await db.delete(examRequests).where(eq(examRequests.id, id));
      broadcast('requests_updated', { id, deleted: true });
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error("[API/Requests] Error:", error.message);
    return res.status(500).json({ error: 'Database error', details: error.message });
  }
}
