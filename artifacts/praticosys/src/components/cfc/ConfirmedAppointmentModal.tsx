import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Save, Trash2, X } from 'lucide-react';
import { api } from '../../services/api';
import { ExamRequest, Examiner, SystemSettings, BlockedDate, UserRole, RequestType } from '../../types';
import { isDateBlocked, isDateInPast } from '../../lib/dateBlocking';
import DatePicker from '../DatePicker';

type Appointment = ExamRequest & { _isSlot?: boolean };
type Props = {
  item: Appointment;
  mode: 'edit' | 'delete';
  role: UserRole;
  schoolName: string;
  examiners: Examiner[];
  settings: SystemSettings | null;
  blockedDates: BlockedDate[];
  onClose: () => void;
  onSuccess: (updated?: Appointment) => void;
};

export default function ConfirmedAppointmentModal(props: Props) {
  const { item, mode, role, schoolName, examiners, settings, blockedDates, onClose, onSuccess } = props;
  const allowed = role === UserRole.ADMIN || role === UserRole.SUPERVISOR;
  const pcd = item.examType === 'PCD' || item.schoolId === 'PCD';
  const [date, setDate] = useState(item.scheduledDate?.split('T')[0] ?? '');
  const [time, setTime] = useState(item.scheduledTime ?? '');
  const [examinerId, setExaminerId] = useState(item.examinerId ?? '');
  const [categories, setCategories] = useState((item.intendedCategory ?? '').split(',').filter(Boolean));
  const [requestType, setRequestType] = useState(item.requestType);
  const [examGroup, setExamGroup] = useState(() => {
    if (pcd) return 'PCD';
    const cats = (item.intendedCategory ?? '').split(',');
    const hab = cats.some(c => ['A', 'B'].includes(c));
    const mudanca = cats.some(c => ['C', 'D', 'E'].includes(c));
    return hab && mudanca ? 'MISTO' : mudanca ? 'MUD_CAT' : '1HAB';
  });
  const availableCategories = pcd ? ['PCD'] : examGroup === '1HAB' ? ['A', 'B']
    : examGroup === 'MUD_CAT' ? ['C', 'D', 'E'] : ['A', 'B', 'C', 'D', 'E'];
  const changeExamGroup = (group: string) => {
    setExamGroup(group);
    setCategories(prev => {
      if (group === '1HAB') {
        const compatible = prev.filter(c => ['A', 'B'].includes(c));
        return compatible.length ? compatible : ['A'];
      }
      if (group === 'MUD_CAT') {
        const compatible = prev.filter(c => ['C', 'D', 'E'].includes(c));
        return compatible.length ? compatible : ['C'];
      }
      const mixed = prev.filter(c => ['A', 'B', 'C', 'D', 'E'].includes(c));
      if (!mixed.some(c => ['A', 'B'].includes(c))) mixed.push('A');
      if (!mixed.some(c => ['C', 'D', 'E'].includes(c))) mixed.push('C');
      return mixed.sort();
    });
  };
  const defaultQuantity = (cat: string) => cat === 'A' ? settings?.defaultMaxSlotsA ?? 10
    : cat === 'B' ? settings?.defaultMaxSlotsB ?? 10 : settings?.defaultMaxSlotsMudanca ?? 10;
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'PCD'].map(cat =>
      [cat, String(item.categoryQuantities?.[cat] ?? defaultQuantity(cat))])));
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);

  const close = () => { if (!running.current) onClose(); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!allowed || running.current) return;
    setError('');
    if (mode === 'edit') {
      if (!date || !time || !examinerId || !categories.length) {
        setError('Preencha a data, horário, examinador e ao menos uma categoria.'); return;
      }
      if (isDateInPast(date)) { setError('Não é permitido reagendar para uma data passada.'); return; }
      if (settings && isDateBlocked(date, blockedDates, settings).blocked) {
        setError('Esta data está bloqueada para agendamento.'); return;
      }
      if (categories.some(c => !/^\d+$/.test(quantities[c] ?? '') ||
        !Number.isSafeInteger(Number(quantities[c])))) {
        setError('Informe vagas inteiras, não negativas, para cada categoria.'); return;
      }
      if (examGroup === 'MISTO' && (!categories.some(c => ['A', 'B'].includes(c)) || !categories.some(c => ['C', 'D', 'E'].includes(c)))) {
        setError('Para exame misto, selecione ao menos uma categoria A/B e uma C/D/E.'); return;
      }
    }
    running.current = true;
    setBusy(true);
    try {
      if (mode === 'delete') {
        await api.deleteConfirmedCfc(item.id, !!item._isSlot);
        onSuccess();
      } else {
        const updated = await api.updateConfirmedCfc(item.id, !!item._isSlot, {
          scheduledDate: date, scheduledTime: time, examinerId, requestType, examGroup,
          intendedCategory: categories.join(','),
          categoryQuantities: Object.fromEntries(categories.map(c => [c, Number(quantities[c])])),
        });
        onSuccess({ ...item, ...updated });
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir a operação. Seus dados foram mantidos.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  if (!allowed) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={close}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="confirmed-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto outline-none"
        onClick={e => e.stopPropagation()} onKeyDown={e => {
          if (e.key === 'Escape') close();
          if (e.key === 'Tab') {
            const focusables = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]');
            const items = Array.from(focusables ?? []).filter(el => !el.closest('fieldset:disabled'));
            if (!items.length) { e.preventDefault(); return; }
            const first = items[0], last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
              e.preventDefault(); last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
              e.preventDefault(); first.focus();
            }
          }
        }}>
        <div className="p-5 border-b flex justify-between items-center">
          <h2 id="confirmed-modal-title" className="font-bold text-lg text-slate-800">
            {mode === 'edit' ? 'Editar prova confirmada' : 'Excluir agendamento'}
          </h2>
          <button type="button" disabled={busy} onClick={close} aria-label="Fechar" className="p-2 text-slate-500 disabled:opacity-50"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="p-5 space-y-5">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-bold text-slate-800">{schoolName}</p>
              <p className="text-slate-500">{item.scheduledDate?.split('T')[0].split('-').reverse().join('/')} às {item.scheduledTime}</p>
            </div>
            {mode === 'delete' ? (
              <p className="text-sm text-slate-700">Confirma a exclusão definitiva deste agendamento?
                Os cadastros da autoescola, do examinador e dos candidatos serão preservados.
                {item.cpf || item.studentName ? ' O candidato voltará à fila de agendamento.' : ''}</p>
            ) : (
              <fieldset disabled={busy} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="text-sm font-bold">Tipo
                    <select required value={requestType} onChange={e => setRequestType(e.target.value as RequestType)}
                      className="block w-full border rounded-lg p-2.5 mt-1 font-normal">
                      <option value={RequestType.FIXA}>Fixa</option>
                      <option value={RequestType.EXTRA}>Extra</option>
                      <option value={RequestType.REPOSICAO}>Reposição</option>
                    </select>
                  </label>
                  <label className="text-sm font-bold">Exame
                    <select required value={examGroup} onChange={e => changeExamGroup(e.target.value)}
                      className="block w-full border rounded-lg p-2.5 mt-1 font-normal">
                      {pcd ? <option value="PCD">PCD</option> : <>
                        <option value="1HAB">1º Habilitação</option>
                        <option value="MUD_CAT">Mudança Categoria</option>
                        <option value="MISTO">Misto (1º Hab. e Mud. Cat.)</option>
                      </>}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-1">Data</label>
                    <DatePicker value={date} onChange={setDate} blockedDates={blockedDates} settings={settings} />
                  </div>
                  <label className="text-sm font-bold">Horário
                    <input required type="time" value={time} onChange={e => setTime(e.target.value)}
                      className="block w-full border rounded-lg p-2.5 mt-1 font-normal" />
                  </label>
                </div>
                <label className="block text-sm font-bold">Examinador
                  <select required value={examinerId} onChange={e => setExaminerId(e.target.value)}
                    className="block w-full border rounded-lg p-2.5 mt-1 font-normal">
                    <option value="">Selecione o examinador</option>
                    {examiners.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                  </select>
                </label>
                <div>
                  <p className="text-sm font-bold mb-2">Categoria e vagas liberadas</p>
                  <div className="space-y-2">
                    {availableCategories.map(cat => (
                      <div key={cat} className="flex items-center gap-4">
                        <label className="flex items-center gap-2 w-28 text-sm font-bold">
                          <input type="checkbox" checked={categories.includes(cat)} onChange={e => {
                            setCategories(prev => (e.target.checked ? [...prev, cat] : prev.filter(c => c !== cat)).sort());
                          }} />{cat}
                        </label>
                        {categories.includes(cat) && (
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input aria-label={`Vagas liberadas categoria ${cat}`} required type="number" min="0" step="1"
                              value={quantities[cat] ?? ''} onChange={e => setQuantities(prev => ({ ...prev, [cat]: e.target.value }))}
                              className="w-24 border rounded-lg p-2" /> vagas
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                  {!item.categoryQuantities && <p className="text-xs text-slate-500 mt-3">
                    Este agendamento não tinha vagas registradas. Os valores padrão estão preenchidos para sua revisão.
                  </p>}
                </div>
                <p className="text-xs text-slate-500">A prova continuará confirmada após salvar.</p>
              </fieldset>
            )}
            {error && <p role="alert" className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
          </div>
          <div className="border-t p-5 flex justify-end gap-3">
            <button type="button" disabled={busy} onClick={close} className="border rounded-lg px-4 py-2 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={busy} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-white font-bold disabled:opacity-50 ${mode === 'delete' ? 'bg-red-600' : 'bg-blue-600'}`}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : mode === 'delete' ? <Trash2 size={16} /> : <Save size={16} />}
              {busy ? 'Aguarde...' : mode === 'delete' ? 'Excluir agendamento' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
