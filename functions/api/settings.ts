// functions/api/settings.ts  →  GET|PUT /api/settings
import { getDb, json, error, parseBody } from '../_db.js';
import { systemSettings } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';

const DEFAULT_AGENCY = 'Detran de Balneário Camboriú';
const DEFAULT_ADDR = 'Av. do Estado Dalmo Vieira, 4281 - Centro, Balneário Camboriú - SC';

const getDefaultTemplate = () =>
  `Olá, *{CANDIDATO}*! [WAVE][SMILE]\n\nAqui é do {AGENCIA} – Setor CNH.\nEstamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* [CAR], marcada para:\n\n[CALENDAR] *{DATA}*\n[CLOCK] *{HORA}*\n[MAP] *{ENDERECO}*\n\n[WARNING] Não esqueça:\n[ID] _*Documento com foto (válido)*_\n[CAR_FRONT] _*Veículo ou moto em condições para a prova*_\n\n[CHECK] *Posso confirmar sua presença?*\n\n[HOURGLASS] _*Confirmação até amanhã às 18:00*_`;

const getCfcTemplate = () =>
  `Olá, *{AUTOESCOLA}*! [WAVE][SMILE]\n\nAqui é do {AGENCIA} – Setor Prova Prática CFC.\nEstamos confirmando o agendamento da Prova Prática (Tipo: *{TIPO}*), marcada para:\n\n[CALENDAR] *{DATA}*\n[CLOCK] *{HORARIO}*\n[EXAM] Exame: *{EXAME}*\n[USER] Examinador: *{EXAMINADOR}*\n\n[CHECK] *Por favor, confirme o recebimento.*`;

const DEFAULTS = {
  agencyName: DEFAULT_AGENCY, agencyAddress: DEFAULT_ADDR, maintenanceMode: false,
  maxDailySlots: 50, defaultMaxSlotsA: 10, defaultMaxSlotsB: 10, defaultMaxSlotsMudanca: 10,
  minDaysForScheduling: 2, whatsappMessageTemplate: getDefaultTemplate(),
  cfcWhatsappMessageTemplate: getCfcTemplate(), defaultExamAddress: DEFAULT_ADDR,
  defaultExamAddressLink: 'https://maps.google.com', pcdExamName: 'PROVA DIRECAO PCD',
  pcdDefaultExamAddress: DEFAULT_ADDR, pcdDefaultExamAddressLink: 'https://maps.google.com',
  pcdMainSchedule: { frequency: '1_WEEK', days: [], slots: [], active: false },
  cnhBrasilMainSchedule: { frequency: '1_WEEK', days: [], slots: [], active: false },
};

export const onRequest: PagesFunction<{ DATABASE_URL: string }> = async ({ request, env }) => {
  try {
    const db = getDb(env as any);
    const method = request.method;

    try {
      await db.execute(sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS cnh_brasil_main_schedule JSONB`);
      await db.execute(sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS default_max_slots_mudanca INTEGER DEFAULT 10`);
    } catch {}

    if (method === 'GET') {
      const data = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      if (data.length === 0) return json(DEFAULTS);
      const s = data[0] as any;
      if (!s.cfcWhatsappMessageTemplate) s.cfcWhatsappMessageTemplate = getCfcTemplate();
      if (!s.pcdExamName || ['Prova Prática PCD','PROVA DIRECTAO PCD','PROVA DIREÇÃO PCD','Prova Direção PCD'].includes(s.pcdExamName)) s.pcdExamName = 'PROVA DIRECAO PCD';
      if (!s.pcdDefaultExamAddress) s.pcdDefaultExamAddress = s.defaultExamAddress;
      if (!s.pcdDefaultExamAddressLink) s.pcdDefaultExamAddressLink = s.defaultExamAddressLink;
      if (!s.pcdMainSchedule) s.pcdMainSchedule = DEFAULTS.pcdMainSchedule;
      if (!s.cnhBrasilMainSchedule) s.cnhBrasilMainSchedule = DEFAULTS.cnhBrasilMainSchedule;
      if (s.defaultMaxSlotsA == null) s.defaultMaxSlotsA = 10;
      if (s.defaultMaxSlotsB == null) s.defaultMaxSlotsB = 10;
      if (s.defaultMaxSlotsMudanca == null) s.defaultMaxSlotsMudanca = 10;
      return json(s);
    }

    if (method === 'PUT') {
      const body = await parseBody<any>(request);
      const { enableEmailNotifications, enableSmsNotifications, createdAt, updatedAt, ...valid } = body;
      const existing = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
      let result;
      if (existing.length === 0) result = await db.insert(systemSettings).values({ id: 1, ...valid }).returning();
      else result = await db.update(systemSettings).set(valid).where(eq(systemSettings.id, 1)).returning();
      return json(result[0]);
    }

    return error('Method Not Allowed', 405);
  } catch (e: any) {
    return error(e.message ?? 'Erro interno', 500);
  }
};
