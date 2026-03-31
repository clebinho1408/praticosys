
// Schedules API Handler
import { db } from '../db/index.js';
import { examSchedules, examRequests } from '../db/schema.js';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
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

      // Generate Unique Code (e.g., B6324)
      const lastSchedule = await db.select({ code: examSchedules.code })
          .from(examSchedules)
          .where(isNotNull(examSchedules.code)) // Ensure we only look at records with codes
          .orderBy(desc(examSchedules.createdAt))
          .limit(1);

      let nextCode = 'B1000';
      if (lastSchedule.length > 0 && lastSchedule[0].code) {
          const lastCode = lastSchedule[0].code;
          const numberPart = parseInt(lastCode.replace('B', ''), 10);
          if (!isNaN(numberPart)) {
              nextCode = `B${numberPart + 1}`;
          }
      }

      const newItem = await db.insert(examSchedules).values({
        id: crypto.randomUUID(),
        code: nextCode,
        status: initialStatus,
        ...body,
        date: cleanDate // Salva apenas a data limpa
      }).returning();
      
      return res.status(200).json(newItem[0]);
    }

    // --- PUT: Atualizar ou Cancelar Banca ---
    if (req.method === 'PUT') {
      const body = parseBody(req);
      console.log("[API/Schedules] PUT Body:", JSON.stringify(body));
      const { id, action, reason, createdAt, updatedAt, ...updates } = body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID is required for update' });
      }

      // Ação Especial: Cancelamento
      if (action === 'CANCEL') {
        try {
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

          if (!updated || updated.length === 0) {
            return res.status(200).json({ id, status: 'CANCELLED', cancellationReason: reason });
          }

          return res.status(200).json(updated[0]);
        } catch (err: any) {
          console.error("[API/Schedules] Cancel Update Error:", err);
          throw err;
        }
      }

      // Sanitização se houver update de data
      if (updates.date) {
          updates.date = updates.date.split('T')[0];
      }

      // Filtrar apenas campos que existem no schema para evitar erro do Drizzle
      const allowedFields = [
        'code', 'date', 'time', 'examinerIds', 'maxSlotsA', 'maxSlotsB',
        'type', 'status', 'cancellationReason'
      ];

      const filteredUpdates: any = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      }

      console.log("[API/Schedules] Filtered Updates:", JSON.stringify(filteredUpdates));

      try {
        // Edição Normal
        const updated = await db.update(examSchedules)
          .set(filteredUpdates)
          .where(eq(examSchedules.id, id))
          .returning();
        
        if (!updated || updated.length === 0) {
          return res.status(200).json({ id, ...updates });
        }

        const current = updated[0];
        // Recalcula status caso a data tenha mudado na edição
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
      } catch (err: any) {
        console.error("[API/Schedules] General Update Error:", err);
        throw err;
      }
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
