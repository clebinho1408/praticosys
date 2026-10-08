import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { City, DrivingSchool, ExamLocation, OperatorModule, User, UserRole } from '../../types';

export type UserFormData = {
  name: string;
  login: string;
  role: UserRole;
  schoolId: string;
  allowedModules: OperatorModule[];
  allowedLocationIds: string[];
  email: string;
  phone: string;
  twoFactorEnabled: boolean;
};

type Tab = 'data' | 'permissions' | 'contact';
type Props = {
  editingUser: User | null;
  value: UserFormData;
  schools: DrivingSchool[];
  examLocations: ExamLocation[];
  cities: City[];
  loginExists: boolean;
  onChange: (value: UserFormData) => void;
  onLoginChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: (event: React.FormEvent) => Promise<void>;
  onClose: () => void;
};

const moduleLabels: Record<OperatorModule, string> = {
  cnh: 'CNH do Brasil', cfc: 'Exame Prático CFC', pcd: 'Exame Prático PCD',
};
const inputStyle = 'w-full min-w-0 border border-gray-300 rounded-lg p-2.5 bg-white text-gray-900 text-sm';

export default function UserFormModal(props: Props) {
  const { editingUser, value, schools, examLocations, cities, loginExists, onChange, onLoginChange, onSave, onClose } = props;
  const [activeTab, setActiveTab] = useState<Tab>('data');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const restrictedRole = value.role === UserRole.OPERATOR || value.role === UserRole.SUPERVISOR;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'data', label: 'Dados' },
    ...(restrictedRole ? [{ key: 'permissions' as const, label: 'Permissões' }] : []),
    { key: 'contact', label: 'Contato e segurança' },
  ];
  const visibleTab = activeTab === 'permissions' && !restrictedRole ? 'data' : activeTab;
  const fieldId = (field: string) => `${id}-${field}`;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => { setError(''); }, [value]);
  const close = () => { if (!running.current) onClose(); };
  const focusField = (tab: Tab, target: HTMLElement, message = '') => {
    setActiveTab(tab);
    setError(message);
    requestAnimationFrame(() => {
      target.focus();
      target.scrollIntoView({ block: 'nearest' });
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) target.reportValidity();
    });
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (running.current) return;
    setError('');
    // All panels stay mounted. Validate before showing a browser error, so
    // required controls in inactive panels can be made visible and focused.
    const controls = Array.from(form.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select') ?? []);
    const invalid = controls.find(control => !control.checkValidity());
    if (invalid) {
      const tab = invalid.closest<HTMLElement>('[data-user-tab]')?.dataset.userTab as Tab;
      focusField(tab, invalid);
      return;
    }
    if (restrictedRole && value.allowedModules.length === 0) {
      const target = document.getElementById(fieldId('module-cnh'))!;
      focusField('permissions', target, 'Selecione ao menos um módulo para o Operador/Supervisor.');
      return;
    }
    if (!editingUser && loginExists) {
      focusField('data', document.getElementById(fieldId('login'))!, 'Este login já está em uso.');
      return;
    }
    running.current = true;
    setBusy(true);
    try {
      await onSave(event);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const tabKeys = (event: React.KeyboardEvent<HTMLButtonElement>, current: Tab) => {
    const index = tabs.findIndex(tab => tab.key === current);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setActiveTab(tabs[next].key);
    document.getElementById(fieldId(`tab-${tabs[next].key}`))?.focus();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={close}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={fieldId('title')} aria-busy={busy} tabIndex={-1}
        className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden outline-none"
        onClick={event => event.stopPropagation()} onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); close(); }
          if (event.key === 'Tab') {
            const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])
              .filter(element => !element.closest('[hidden], fieldset:disabled') && element.tabIndex >= 0);
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
              event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault(); first.focus();
            }
          }
        }}>
        <header className="flex items-center justify-between gap-3 border-b px-5 py-4 shrink-0">
          <h3 id={fieldId('title')} className="text-lg font-bold text-gray-800">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
          <button type="button" disabled={busy} onClick={close} aria-label="Fechar" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X size={20} /></button>
        </header>
        <form ref={form} noValidate onSubmit={submit} className="flex flex-col min-h-0">
          <div role="tablist" aria-label="Abas do cadastro de usuário"
            className={`grid ${restrictedRole ? 'grid-cols-3' : 'grid-cols-2'} border-b shrink-0 bg-gray-50`}>
            {tabs.map(tab => (
              <button key={tab.key} type="button" role="tab" id={fieldId(`tab-${tab.key}`)}
                aria-controls={fieldId(`panel-${tab.key}`)} aria-selected={visibleTab === tab.key}
                tabIndex={visibleTab === tab.key ? 0 : -1} disabled={busy}
                onClick={() => setActiveTab(tab.key)} onKeyDown={event => tabKeys(event, tab.key)}
                className={`min-w-0 px-2 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
                  visibleTab === tab.key ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:bg-gray-100'
                }`}>{tab.label}</button>
            ))}
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
            <fieldset disabled={busy} className="min-w-0">
              <div role="tabpanel" id={fieldId('panel-data')} aria-labelledby={fieldId('tab-data')}
                data-user-tab="data" hidden={visibleTab !== 'data'} className="space-y-4">
                <div>
                  <label htmlFor={fieldId('name')} className="block text-sm font-medium mb-1">Nome Completo</label>
                  <input id={fieldId('name')} required type="text" className={inputStyle} value={value.name}
                    onChange={event => onChange({ ...value, name: event.target.value })} />
                </div>
                <div>
                  <label htmlFor={fieldId('login')} className="block text-sm font-medium mb-1">Login (Usuário)</label>
                  <input id={fieldId('login')} required type="text" className={inputStyle} value={value.login}
                    onChange={onLoginChange} placeholder="apenas letras minúsculas" readOnly={!!editingUser}
                    title={editingUser ? 'Não é possível alterar o login' : 'Apenas letras minúsculas, sem espaço'} />
                  <p className="text-xs text-gray-500 mt-1">Apenas letras minúsculas, sem espaço, sem acento.</p>
                </div>
                {!editingUser && <div className="text-xs text-blue-600 bg-blue-50 p-2.5 rounded-lg">
                  Senha padrão será definida como: <strong>123456</strong>
                </div>}
                <div>
                  <label htmlFor={fieldId('role')} className="block text-sm font-medium mb-1">Função</label>
                  <select id={fieldId('role')} className={inputStyle} value={value.role}
                    onChange={event => onChange({ ...value, role: event.target.value as UserRole })}>
                    <option value={UserRole.ADMIN}>Admin</option>
                    <option value={UserRole.SUPERVISOR}>Supervisor</option>
                    <option value={UserRole.OPERATOR}>Operador</option>
                    <option value={UserRole.CONSULTANT}>Consultor</option>
                    <option value={UserRole.SCHOOL}>Autoescola</option>
                  </select>
                </div>
                {value.role === UserRole.SCHOOL && <div>
                  <label htmlFor={fieldId('school')} className="block text-sm font-medium mb-1">Autoescola Vinculada</label>
                  <select id={fieldId('school')} required className={inputStyle} value={value.schoolId}
                    onChange={event => onChange({ ...value, schoolId: event.target.value })}>
                    <option value="">Selecione...</option>
                    {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
                  </select>
                </div>}
              </div>
              {restrictedRole && <div role="tabpanel" id={fieldId('panel-permissions')} aria-labelledby={fieldId('tab-permissions')}
                data-user-tab="permissions" hidden={visibleTab !== 'permissions'} className="space-y-4">
                <fieldset className="space-y-2 min-w-0">
                  <legend className="text-sm font-medium mb-2">Módulos Permitidos</legend>
                  <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                    {(['cnh', 'cfc', 'pcd'] as OperatorModule[]).map(mod => (
                      <label key={mod} className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
                        <input id={fieldId(`module-${mod}`)} type="checkbox" checked={value.allowedModules.includes(mod)}
                          onChange={event => onChange({ ...value, allowedModules: event.target.checked
                            ? [...value.allowedModules, mod] : value.allowedModules.filter(m => m !== mod) })}
                          className="h-4 w-4 accent-blue-600 shrink-0" />
                        {moduleLabels[mod]}
                      </label>
                    ))}
                  </div>
                  {value.allowedModules.length === 0 && <p className="text-xs text-red-500">Selecione ao menos um módulo.</p>}
                </fieldset>
                {value.allowedModules.includes('cnh') && examLocations.length > 0 && <fieldset className="min-w-0">
                  <legend className="text-sm font-medium mb-1">Locais de Acesso — CNH do Brasil</legend>
                  <p className="text-xs text-gray-500 mb-2">Deixe em branco para liberar todos os locais.</p>
                  <div className="space-y-3 border rounded-lg p-3 bg-gray-50 max-h-40 overflow-y-auto">
                    {examLocations.map(loc => (
                      <label key={loc.id} className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
                        <input type="checkbox" checked={value.allowedLocationIds.includes(loc.id)}
                          onChange={event => onChange({ ...value, allowedLocationIds: event.target.checked
                            ? [...value.allowedLocationIds, loc.id] : value.allowedLocationIds.filter(locationId => locationId !== loc.id) })}
                          className="h-4 w-4 accent-blue-600 shrink-0" />
                        <span className="min-w-0 break-words">{cities.find(city => city.id === loc.cityId)?.name || loc.cityId}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>}
              </div>}
              <div role="tabpanel" id={fieldId('panel-contact')} aria-labelledby={fieldId('tab-contact')}
                data-user-tab="contact" hidden={visibleTab !== 'contact'} className="space-y-4">
                <div>
                  <label htmlFor={fieldId('email')} className="block text-sm font-medium mb-1">E-mail</label>
                  <input id={fieldId('email')} type="email" className={inputStyle} value={value.email}
                    onChange={event => onChange({ ...value, email: event.target.value })} placeholder="exemplo@email.com" />
                </div>
                <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <input type="checkbox" className="h-4 w-4 accent-blue-600 mt-0.5 shrink-0" checked={value.twoFactorEnabled}
                    onChange={event => onChange({ ...value, twoFactorEnabled: event.target.checked })} />
                  <div>
                    <span className="text-sm font-medium text-gray-800">Ativar verificação em 2 etapas</span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ao fazer login, um código será enviado para o e-mail cadastrado acima.
                      {!value.email && value.twoFactorEnabled && <span className="text-red-600 block mt-1">
                        Cadastre um e-mail para ativar este recurso.
                      </span>}
                    </p>
                  </div>
                </label>
              </div>
            </fieldset>
          </div>
          <footer className="border-t px-5 py-4 shrink-0">
            {error && <p role="alert" className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={busy} onClick={close} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={busy} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
