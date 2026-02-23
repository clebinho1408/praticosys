
// Schedules API Handler
import { db } from '../db/index.js';
import { examSchedules, examRequests } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

// Função auxiliar para calcular status baseado no tempo
const calculateStatus = (dateStr: string, timeStr: string, currentStatus: string) => {
    if (currentStatus === 'CANCELLED') return 'CANCELLED';
    
    // Garantia de formato limpo
    const cleanDate = dateStr.split('T')[0];
    const now = new Date();
    const examDate = new Date(`${cleanDate}T${timeStr}`);
    
    // Regras de Tempo
    const msPerHr = 60 * 60 * 1000;
    const closeThreshold = new Date(examDate.getTime() - (24 * msPerHr)); // 24h antes
    const concludedThreshold = new Date(examDate.getTime() + (4 * msPerHr)); // 4h depois

    if (now > concludedThreshold) return 'CONCLUDED';
    if (now > closeThreshold) return 'CLOSED';
    
    // Se não caiu nas regras acima e não está cancelada, deve estar Aberta (ou manter o status atual se for OPEN)
    return 'OPEN';
};

export default async function handler(req: any, res: any) {
  try {
    // --- GET: Lista Agendamentos e Aplica Regras de Tempo ---
    if (req.method === 'GET') {
      const schedules = await db.select().from(examSchedules);
      const updatesPromises = [];

      for (const s of schedules) {
        const calculatedStatus = calculateStatus(s.date, s.time, s.status);

        // Se o status calculado for diferente do atual, atualiza
        if (calculatedStatus !== s.status) {
           // Se mudou para CONCLUDED, atualiza os candidatos
           if (calculatedStatus === 'CONCLUDED' && s.status !== 'CONCLUDED') {
               await db.update(examRequests)
                 .set({ status: 'WAITING_RESULT', updatedAt: new Date() })
                 .where(and(eq(examRequests.scheduleId, s.id), eq(examRequests.status, 'SCHEDULED')));
           }

           updatesPromises.push(
               db.update(examSchedules).set({ status: calculatedStatus }).where(eq(examSchedules.id, s.id))
           );
           s.status = calculatedStatus; 
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
      
      // Sanitização de Data
      const cleanDate = body.date.split('T')[0];
      
      // Calcula o status inicial baseado na data inserida
      const initialStatus = calculateStatus(cleanDate, body.time, 'OPEN');

      const newItem = await db.insert(examSchedules).values({
        id: crypto.randomUUID(),
        status: initialStatus,
        ...body,
        date: cleanDate // Salva apenas a data limpa
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

      // Sanitização se houver update de data
      if (updates.date) {
          updates.date = updates.date.split('T')[0];
      }

      // Edição Normal
      const updated = await db.update(examSchedules)
        .set(updates)
        .where(eq(examSchedules.id, id))
        .returning();
      
      // Recalcula status caso a data tenha mudado na edição
      const current = updated[0];
      const newStatus = calculateStatus(current.date, current.time, current.status);
      
      if (newStatus !== current.status) {
         await db.update(examSchedules).set({ status: newStatus }).where(eq(examSchedules.id, id));
         current.status = newStatus;
      }

      // Se alterou data/hora, reflete nos candidatos agendados
      if (updates.date || updates.time) {
         await db.update(examRequests)
            .set({ scheduledDate: updates.date, scheduledTime: updates.time })
            .where(eq(examRequests.scheduleId, id));
      }

      return res.status(200).json(current);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      await db.delete(examSchedules).where(eq(examSchedules.id, id));
      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error' });
  }
}
