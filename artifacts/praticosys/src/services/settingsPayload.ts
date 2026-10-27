import type { SystemSettings } from '../types';

// GET returns the full settings object, including fields this role cannot edit.
// Omit only the new protected preference; preserve existing settings permissions.
export function settingsForSave(settings: SystemSettings, isAdmin: boolean): Partial<SystemSettings> {
  if (isAdmin) return { ...settings };
  const { cnhCpfAutofillEnabled: _protected, ...editable } = settings;
  return editable;
}
