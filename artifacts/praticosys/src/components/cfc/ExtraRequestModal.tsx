import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { api } from '../../services/api';
import { ExamRequest, RequestType, UserRole } from '../../types';

type Item = ExamRequest & { _isSlot?: boolean };
type Props = {
  item: Item;
  role: UserRole;
  schoolName: string;
  onClose: () => void;
  onSuccess: (updated: Item) => void;
};

export default function ExtraRequestModal({ item, role, schoolName, onClose, onSuccess }: Props) {
  const allowed = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR].includes(role);
  const [requestType, setRequestType] = useState(item.requestType);
  const [categories, setCategories] = useState(() =>
    (item.intendedCategory || Object.keys(item.categoryQuantities ?? {}).join(',')).split(',').filter(Boolean));
  const [examGroup, setExamGroup] = useState(() => {
    const cats = (item.intendedCategory || Object.keys(item.categoryQuantities ?? {}).join(',')).split(',');
    const hab = cats.some(c => ['A', 'B'].includes(c));
    const mud = cats.some(c => ['C', 'D', 'E'].includes(c));
    return hab && mud ? 'MISTO' : mud ? 'MUD_CAT' : '1HAB';
  });
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(item.categoryQuantities ?? {}).map(([cat, qty]) => [cat, String(qty)])));
  const [observation, setObservation] = useState(item.observation ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const available = examGroup === '1HAB' ? ['A', 'B'] : examGroup === 'MUD_CAT' ? ['C', 'D', 'E'] : ['A', 'B', 'C', 'D', 'E'];

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    setError('');
  }, [requestType, examGroup, categories, quantities, observation]);

  const close = () => { if (!running.current) onClose(); };
  const changeExam = (group: string) => {
    setExamGroup(group);
    setCategories(prev => {
      const compatible = prev.filter(c => group === '1HAB' ? ['A', 'B'].includes(c)
        : group === 'MUD_CAT' ? ['C', 'D', 'E'].includes(c) : ['A', 'B', 'C', 'D', 'E'].includes(c));
      if (group === 'MISTO') {
        if (!compatible.some(c => ['A', 'B'].includes(c))) compatible.push('A');
        if (!compatible.some(c => ['C', 'D', 'E'].includes(c))) compatible.push('C');
      }
      return compatible.length ? compatible.sort() : [group === 'MUD_CAT' ? 'C' : 'A'];
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!allowed || running.current) return;
    setError('');
    if (!categories.length) { setError('Selecione ao menos uma categoria.'); return; }
    if (examGroup === 'MISTO' && (!categories.some(c => ['A', 'B'].includes(c)) || !categories.some(c => ['C', 'D', 'E'].includes(c)))) {
      setError('No exame misto, selecione uma categoria A/B e uma C/D/E.'); return;
    }
    if (categories.some(c => !quantities[c]?.trim() || !Number.isSafeInteger(Number(quantities[c])) || Number(quantities[c]) < 1)) {
      setError('Informe uma quantidade inteira maior que zero para cada categoria selecionada.'); return;
    }
    running.current = true;
    setBusy(true);
    try {
      const patch = {
        extraEdit: true, examGroup, requestType, intendedCategory: categories.join(','),
        categoryQuantities: Object.fromEntries(categories.map(cat => [cat, Number(quantities[cat])])),
        observation,
      };
      const updated = item._isSlot ? await api.updateScheduleSlot(item.id, patch) : await api.updateRequest(item.id, patch);
      onSuccess({ ...item, ...updated });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar pedido de prova extra.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  if (!allowed) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={close}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="extra-edit-title" tabIndex={-1}
        className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto outline-none"
        onClick={e => e.stopPropagation()} onKeyDown={e => {
          if (e.key === 'Escape') { e.stopPropagation(); close(); }
          if (e.key === 'Tab') {
            const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])
              .filter(el => !el.closest('fieldset:disabled'));
            const first = controls[0], last = controls[controls.length - 1];
            if (!first) { e.preventDefault(); return; }
            if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          }
        }}>
        <div className="p-5 border-b flex items-center justify-between">
          <h2 id="extra-edit-title" className="font-bold text-lg text-slate-800">Editar pedido de prova extra</h2>
          <button type="button" onClick={close} disabled={busy} aria-label="Fechar" className="p-2 text-slate-500"><X size={20} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="p-5 space-y-4">
            <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-800">{schoolName}</p>
            <fieldset disabled={busy} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="text-sm font-bold">Tipo
                  <select required value={requestType} onChange={e => setRequestType(e.target.value as RequestType)} className="block w-full border rounded-lg p-2.5 mt-1 font-normal">
                    <option value={RequestType.FIXA}>Fixa</option>
                    <option value={RequestType.EXTRA}>Extra</option>
                    <option value={RequestType.REPOSICAO}>Reposição</option>
                  </select>
                </label>
                <label className="text-sm font-bold">Exame
                  <select required value={examGroup} onChange={e => changeExam(e.target.value)} className="block w-full border rounded-lg p-2.5 mt-1 font-normal">
                    <option value="1HAB">1º Habilitação</option>
                    <option value="MUD_CAT">Mudança Categoria</option>
                    <option value="MISTO">Misto (1º Hab. e Mud. Cat.)</option>
                  </select>
                </label>
              </div>
              <fieldset>
                <legend className="text-sm font-bold mb-2">Qtd. por Cat.</legend>
                <div className="flex flex-wrap gap-4">
                  {available.map(cat => (
                    <div key={cat} className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm font-bold">
                        <input type="checkbox" checked={categories.includes(cat)} onChange={e =>
                          setCategories(prev => (e.target.checked ? [...prev, cat] : prev.filter(c => c !== cat)).sort())} />{cat}
                      </label>
                      {categories.includes(cat) && <input required type="number" min="1" step="1"
                        aria-label={`Quantidade categoria ${cat}`} value={quantities[cat] ?? ''}
                        onChange={e => setQuantities(prev => ({ ...prev, [cat]: e.target.value }))}
                        className="w-20 border rounded-lg p-2 text-sm" />}
                    </div>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm font-bold">Observações
                <textarea rows={3} value={observation} onChange={e => setObservation(e.target.value)}
                  className="block w-full border rounded-lg p-2.5 mt-1 font-normal resize-y" />
              </label>
            </fieldset>
            <p className="text-xs text-slate-500">A edição mantém o pedido na fila, sem definir data, horário ou examinador.</p>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>
          <div className="p-5 border-t flex justify-end gap-3">
            <button type="button" onClick={close} disabled={busy} className="px-4 py-2 border rounded-lg text-sm font-bold">Cancelar</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {busy ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
