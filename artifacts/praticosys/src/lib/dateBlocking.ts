import { BlockedDate, SystemSettings } from '../types';

export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateInPast(dateStr: string): boolean {
  const cleanDate = dateStr?.split('T')[0] ?? '';
  return /^\d{4}-\d{2}-\d{2}$/.test(cleanDate) && cleanDate < getTodayDateString();
}

export function isDateBlocked(dateStr: string, blockedDates: BlockedDate[], settings?: SystemSettings | null): { blocked: boolean; reason?: string } {
  const cleanDate = dateStr?.split('T')[0] ?? '';
  if (!cleanDate) return { blocked: false };

  if (settings?.blockWeekends) {
    const d = new Date(cleanDate + 'T00:00:00');
    const day = d.getDay();
    if (day === 0 || day === 6) {
      return { blocked: true, reason: 'Finais de semana estão bloqueados.' };
    }
  }

  // Datas cadastradas manualmente devem ser reconhecidas mesmo enquanto
  // as configurações gerais ainda não foram carregadas.
  const block = blockedDates.find(b => b.date?.split('T')[0] === cleanDate);
  if (block) {
    return { blocked: true, reason: block.description };
  }

  return { blocked: false };
}
