
import { db } from '../db/index.js';
import { systemSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

// Template oficial usando marcadores ASCII (Incorruptíveis)
const getDefaultTemplate = () => {
  return `Olá, *{CANDIDATO}*! [WAVE][SMILE]\n\nAqui é do {AGENCIA} – Setor CNH.\nEstamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* [CAR_SIDE], marcada para:\n\n[CALENDAR] *{DATA}*\n[CLOCK] *{HORA}*\n[MAP] *{ENDERECO}*\n\n[WARNING] Não esqueça:\n[ID_CARD] _*Documento com foto (válido)*_\n[CAR_FRONT] _*Veículo ou moto em condições para a prova*_\n\n[CHECK] *Posso confirmar sua presença?*\n\n[HOURGLASS] _*Confirmação até amanhã às 18:00*_`;
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const data = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      if (data.length === 0) {
        const agency = 'Detran de Balneário Camboriú';
        const addr = 'Av. do Estado Dalmo Vieira, 4281 - Centro, Balneário Camboriú - SC';
        return res.status(200).json({
          agencyName: agency,
          agencyAddress: addr,
          maintenanceMode: false,
          maxDailySlots: 50,
          defaultMaxSlotsA: 10,
          defaultMaxSlotsB: 10,
          minDaysForScheduling: 2,
          whatsappMessageTemplate: getDefaultTemplate(),
          defaultExamAddress: addr,
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
