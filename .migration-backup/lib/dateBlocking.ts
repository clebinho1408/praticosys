import { BlockedDate, SystemSettings } from '../types';

export function isDateBlocked(dateStr: string, blockedDates: BlockedDate[], settings: SystemSettings): { blocked: boolean; reason?: string } {
  if (!dateStr) return { blocked: false };

  // Check weekends
  if (settings.blockWeekends) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    if (day === 0 || day === 6) {
      return { blocked: true, reason: 'Finais de semana estão bloqueados.' };
    }
  }

  // Check manual blocks
  const block = blockedDates.find(b => b.date === dateStr);
  if (block) {
    return { blocked: true, reason: block.description };
  }

  return { blocked: false };
}
