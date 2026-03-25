
import { db } from '../db/index.js';
import { systemSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const parseBody = (req: any) => typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

// Template oficial usando tags de texto seguras para evitar corrupção por codificação no banco de dados
const getDefaultTemplate = () => {
  return `Olá, *{CANDIDATO}*! [WAVE][SMILE]

Aqui é do {AGENCIA} – Setor CNH.
Estamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* [CAR], marcada para:

[CALENDAR] *{DATA}*
[CLOCK] *{HORA}*
[MAP] *{ENDERECO}*

[WARNING] Não esqueça:
[ID] _*Documento com foto (válido)*_
[CAR_FRONT] _*Veículo ou moto em condições para a prova*_

[CHECK] *Posso confirmar sua presença?*

[HOURGLASS] _*Confirmação até amanhã às 18:00*_`;
};

const getCfcDefaultTemplate = () => {
  return `Olá, *{AUTOESCOLA}*! [WAVE][SMILE]

Aqui é do {AGENCIA} – Setor Prova Prática CFC.
Estamos confirmando o agendamento da Prova Prática (Tipo: *{TIPO}*), marcada para:

[CALENDAR] *{DATA}*
[CLOCK] *{HORARIO}*
[EXAM] Exame: *{EXAME}*
[USER] Examinador: *{EXAMINADOR}*

[CHECK] *Por favor, confirme o recebimento.*`;
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
          cfcWhatsappMessageTemplate: getCfcDefaultTemplate(),
          defaultExamAddress: addr,
          defaultExamAddressLink: 'https://maps.google.com',
          pcdExamName: 'Prova Prática PCD',
          pcdDefaultExamAddress: addr,
          pcdDefaultExamAddressLink: 'https://maps.google.com',
          pcdMainSchedule: { frequency: '1_WEEK', days: [], slots: [], active: false }
        });
      }
      
      const settings = data[0];
      if (!settings.cfcWhatsappMessageTemplate) {
        settings.cfcWhatsappMessageTemplate = getCfcDefaultTemplate();
      }
      if (!settings.pcdExamName) {
        settings.pcdExamName = 'Prova Prática PCD';
      }
      if (!settings.pcdDefaultExamAddress) {
        settings.pcdDefaultExamAddress = settings.defaultExamAddress;
      }
      if (!settings.pcdDefaultExamAddressLink) {
        settings.pcdDefaultExamAddressLink = settings.defaultExamAddressLink;
      }
      if (!settings.pcdMainSchedule) {
        settings.pcdMainSchedule = { frequency: '1_WEEK', days: [], slots: [], active: false };
      }
      
      return res.status(200).json(settings);
    }

    if (req.method === 'PUT') {
      const updates = parseBody(req);
      
      // Filter out fields that don't exist in the database table
      const { enableEmailNotifications, enableSmsNotifications, createdAt, updatedAt, ...validUpdates } = updates;
      
      const existing = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      let result;
      if (existing.length === 0) {
        result = await db.insert(systemSettings).values({ id: 1, ...validUpdates }).returning();
      } else {
        result = await db.update(systemSettings).set(validUpdates).where(eq(systemSettings.id, 1)).returning();
      }
      return res.status(200).json(result[0]);
    }
  } catch (error) {
    console.error("Settings API Error:", error);
    return res.status(500).json({ error: 'Database error' });
  }
}
