import { db } from '../db/index.js';
import { examSchedules, examRequests } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      let schedules = await db.select().from(examSchedules);
      const now = new Date();
      const updatesPromises = [];

      for (const s of schedules) {
        if (s.status === 'CANCELLED') continue;

        const examDate = new Date(`${s.date}T${s.time}`);
        // Fechar 24h antes
        const closeThreshold = new Date(examDate.getTime() - (24 * 60 * 60 * 1000));
        // Concluir 4h depois
        const concludedThreshold = new Date(examDate.getTime() + (4 * 60 * 60 * 1000)); 

        let newStatus = null;

        if (now > concludedThreshold && s.status !== 'CONCLUDED') {
           newStatus = 'CONCLUDED';
           // Move candidatos agendados para Aguardando Resultado
           await db.update(examRequests)
             .set({ status: 'WAITING_RESULT', updatedAt: new Date() })
             .where(and(eq(examRequests.scheduleId, s.id), eq(examRequests.status, 'SCHEDULED')));
        } else if (now > closeThreshold && now < concludedThreshold && s.status === 'OPEN') {
           // Apenas fecha a banca para edições, candidatos permanecem Agendados
           newStatus = 'CLOSED';
        }
        
        if (newStatus) {
            updatesPromises.push(
                db.update(examSchedules).set({ status: newStatus }).where(eq(examSchedules.id, s.id))
            );
            s.status = newStatus; 
        }
      }

      if (updatesPromises.length > 0) {
          await Promise.all(updatesPromises);
      }
      return res.status(200).json(schedules);
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const newItem = await db.insert(examSchedules).values({
        id: crypto.randomUUID(),
        status: 'OPEN',
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, action, reason, ...updates } = parseBody(req);
      
      if (action === 'CANCEL') {
          const updated = await db.update(examSchedules)
             .set({ status: 'CANCELLED', cancellationReason: reason })
             .where(eq(examSchedules.id, id))
             .returning();
             
          // Retorna candidatos para Aguardando Agendamento
          await db.update(examRequests)
             .set({ 
                 status: 'WAITING_SCHEDULING',
                 scheduleId: null,
                 scheduledDate: null,
                 scheduledTime: null,
                 scheduledCategory: null,
                 examinerId: null,
                 attendanceConfirmed: false,
                 updatedAt: new Date()
             })
             .where(eq(examRequests.scheduleId, id));

          return res.status(200).json(updated[0]);
      }

      const updated = await db.update(examSchedules)
        .set(updates)
        .where(eq(examSchedules.id, id))
        .returning();
        
      if (updates.date || updates.time) {
         await db.update(examRequests)
            .set({ scheduledDate: updates.date, scheduledTime: updates.time })
            .where(eq(examRequests.scheduleId, id));
      }

      return res.status(200).json(updated[0]);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error' });
  }
}