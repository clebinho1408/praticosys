import { db } from '../db/index.js';
import { examSchedules, examRequests } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    // --- GET: Lista Agendamentos e Aplica Regras de Tempo ---
    if (req.method === 'GET') {
      const schedules = await db.select().from(examSchedules);
      const now = new Date();
      const updatesPromises = [];

      for (const s of schedules) {
        if (s.status === 'CANCELLED' || s.status === 'CONCLUDED') continue;

        // Combina data e hora para objeto Date
        const examDate = new Date(`${s.date}T${s.time}`);
        
        // Regras de Tempo
        const msPerHr = 60 * 60 * 1000;
        const closeThreshold = new Date(examDate.getTime() - (24 * msPerHr)); // 24h antes
        const concludedThreshold = new Date(examDate.getTime() + (4 * msPerHr)); // 4h depois

        let newStatus = null;

        // 1. Conclusão Automática (4h após o horário)
        if (now > concludedThreshold) {
           newStatus = 'CONCLUDED';
           // Move candidatos de 'SCHEDULED' para 'WAITING_RESULT'
           await db.update(examRequests)
             .set({ status: 'WAITING_RESULT', updatedAt: new Date() })
             .where(and(eq(examRequests.scheduleId, s.id), eq(examRequests.status, 'SCHEDULED')));
        } 
        // 2. Fechamento Automático (24h antes do horário)
        else if (now > closeThreshold && s.status === 'OPEN') {
           newStatus = 'CLOSED';
        }
        
        // Aplica atualização se houve mudança
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

    // --- POST: Criar Nova Banca ---
    if (req.method === 'POST') {
      const body = parseBody(req);
      const newItem = await db.insert(examSchedules).values({
        id: crypto.randomUUID(),
        status: 'OPEN',
        ...body
      }).returning();
      return res.status(200).json(newItem[0]);
    }

    // --- PUT: Atualizar ou Cancelar Banca ---
    if (req.method === 'PUT') {
      const { id, action, reason, ...updates } = parseBody(req);
      
      // Ação Especial: Cancelamento
      if (action === 'CANCEL') {
          const updated = await db.update(examSchedules)
             .set({ status: 'CANCELLED', cancellationReason: reason })
             .where(eq(examSchedules.id, id))
             .returning();
             
          // Retorna todos os candidatos desta banca para a fila de espera
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
        
      // Se alterou data/hora, reflete nos candidatos agendados
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