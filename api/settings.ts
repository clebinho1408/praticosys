
import { db } from '../db/index.js';
import { systemSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      if (data.length === 0) {
        return res.status(200).json({
          agencyName: 'Detran de Balneário Camboriú',
          agencyAddress: 'Av. do Estado Dalmo Vieira, 4281 - Centro, Balneário Camboriú - SC',
          maintenanceMode: false,
          maxDailySlots: 50,
          defaultMaxSlotsA: 10,
          defaultMaxSlotsB: 10,
          minDaysForScheduling: 2,
          whatsappMessageTemplate: 'Olá, *{CANDIDATO}*! 👋😊\n\nAqui é do {AGENCIA} – Setor CNH.\nEstamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* 🚗, marcada para:\n\n📅 *{DATA}*\n⏰ *{HORA}*\n📍 *{ENDERECO}*\n\n⚠️ Não esqueça:\n🪪 _*Documento com foto (válido)*_\n🚘 _*Veículo ou moto em condições para a prova*_\n\n✅ *Posso confirmar sua presença?*\n\n⏳ _*Confirmação até amanhã às 18:00*_',
          defaultExamAddress: 'Av. do Estado Dalmo Vieira, 4281 - Centro, Balneário Camboriú - SC',
          defaultExamAddressLink: 'https://maps.google.com'
        });
      }
      return res.status(200).json(data[0]);
    }

    if (req.method === 'PUT') {
      const updates = parseBody(req);
      const existing = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      let result;
      if (existing.length === 0) {
        result = await db.insert(systemSettings).values({ id: 1, ...updates }).returning();
      } else {
        result = await db.update(systemSettings).set(updates).where(eq(systemSettings.id, 1)).returning();
      }
      return res.status(200).json(result[0]);
    }
  } catch (error) {
    console.error("Settings API Error:", error);
    return res.status(500).json({ error: 'Database error' });
  }
}
