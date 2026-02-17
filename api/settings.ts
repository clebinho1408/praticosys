
import { db } from '../db/index.js';
import { systemSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

// Template oficial usando marcadores de texto seguros para evitar corrupção no banco de dados
const getDefaultTemplate = () => {
  return `Olá, *{CANDIDATO}*! [WAVE][SMILE]
Aqui é do {AGENCIA} – Setor CNH.
Estamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* [CAR_SIDE], marcada para:
[CALENDAR] *{DATA}*
[CLOCK] *{HORA}*
[MAP] *{ENDERECO}*

[WARNING] Não esqueça:
[ID_CARD] _*Documento com foto (válido)*_
[CAR_FRONT] _*Veículo ou moto em condições para a prova*_

[CHECK] *Posso confirmar sua presença?*

[HOURGLASS] _*Confirmação até amanhã às 18:00*_`;
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
      
      // Se o template vier com caracteres de erro, forçamos o padrão limpo
      if (updates.whatsappMessageTemplate && updates.whatsappMessageTemplate.includes('\uFFFD')) {
          updates.whatsappMessageTemplate = getDefaultTemplate();
      }

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
