import { db } from '../db';
import { examSchedules, examRequests } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      let schedules = await db.select().from(examSchedules);
      
      // Lógica de Atualização Automática de Status (Concluded/Closed)
      const now = new Date();
      const updatesPromises = [];

      for (const s of schedules) {
        if (s.status === 'CANCELLED') continue;

        const examDate = new Date(`${s.date}T${s.time}`);
        const concludedThreshold = new Date(examDate.getTime() + (4 * 60 * 60 * 1000)); // +4 horas

        let newStatus = null;

        if (now > concludedThreshold && s.status !== 'CONCLUDED') {
           newStatus = 'CONCLUDED';
           // Atualizar candidatos para WAITING_RESULT
           // (Idealmente faria isso em uma transação, mas simplificando para serverless)
           await db.update(examRequests)
             .set({ status: 'WAITING_RESULT', updatedAt: new Date() })
             .where(and(eq(examRequests.scheduleId, s.id), eq(examRequests.status, 'SCHEDULED')));
        } 
        
        // Regra de fechamento (1 dia antes)
        // const closedThreshold = new Date(examDate);
        // closedThreshold.setDate(closedThreshold.getDate() - 1);
        // if (now >= closedThreshold && s.status === 'OPEN') {
        //    newStatus = 'CLOSED';
        // }

        if (newStatus) {
            updatesPromises.push(
                db.update(examSchedules).set({ status: newStatus }).where(eq(examSchedules.id, s.id))
            );
            s.status = newStatus; // Atualiza objeto de retorno local
        }
      }

      await Promise.all(updatesPromises);
      return res.status(200).json(schedules);
    }

    if (req.method === 'POST') {
      const body = JSON.parse(req.body);
      const newItem = await db.insert(examSchedules).values({
        id: crypto.randomUUID(),
        status: 'OPEN',
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    if (req.method === 'PUT') {
      const { id, action, reason, ...updates } = JSON.parse(req.body);
      
      // Rota Especial para Cancelamento
      if (action === 'CANCEL') {
          const updated = await db.update(examSchedules)
             .set({ status: 'CANCELLED', cancellationReason: reason })
             .where(eq(examSchedules.id, id))
             .returning();
             
          // Liberar alunos
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

      // Edição Normal
      const updated = await db.update(examSchedules)
        .set(updates)
        .where(eq(examSchedules.id, id))
        .returning();
        
      // Se alterou data/hora, atualizar alunos vinculados
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