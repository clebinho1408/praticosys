
import { db } from '../db/index.js';
import { systemSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

// Template seguro com escapes Unicode para evitar caracteres corrompidos
const getSafeTemplate = (agencyName: string, address: string) => {
  return `Olá, *{CANDIDATO}*! \u{1F44B}\u{1F60A}\n\nAqui é do ${agencyName} \u{2013} Setor CNH.\nEstamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* \u{1F697}, marcada para:\n\n\u{1F4C5} *{DATA}*\n\u{23F0} *{HORA}*\n\u{1F4CD} *${address}*\n\n\u{26A0}\u{FE0F} Não esqueça:\n\u{1FAAA} _*Documento com foto (válido)*_\n\u{1F698} _*Veículo ou moto em condições para a prova*_\n\n\u{2705} *Posso confirmar sua presença?*\n\n\u{23F3} _*Confirmação até amanhã às 18:00*_`;
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
          whatsappMessageTemplate: getSafeTemplate(agency, addr),
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
