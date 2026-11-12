import React, { useEffect, useMemo, useState } from 'react';
import { CarFront, Search } from 'lucide-react';
import { api } from '../services/api';
import type { Instructor } from '../types';
import { accreditedVehicles } from '../lib/accreditedVehicles';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';

export default function AccreditedVehiclesDialog() {
  const [open, setOpen] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const rows = useMemo(() => accreditedVehicles(instructors, name, plate), [instructors, name, plate]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setInstructors([]);
    api.getInstructorsAsync().then(data => {
      if (!cancelled) setInstructors(data);
    }).catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Não foi possível carregar os veículos.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [open, attempt]);

  return (
    <Dialog open={open} onOpenChange={value => {
      setOpen(value);
      if (value) { setName(''); setPlate(''); setLoading(true); }
    }}>
      <DialogTrigger asChild>
        <button type="button" title="Consultar veículos credenciados" aria-label="Consultar veículos credenciados"
          className="shrink-0 border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <CarFront className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-2xl max-h-[85dvh] flex flex-col rounded-xl bg-white text-slate-800">
        <DialogHeader className="pr-6">
          <DialogTitle>Veículos credenciados</DialogTitle>
          <DialogDescription>Instrutores com veículos autorizados pelo Detran.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm font-medium">
            Nome do instrutor
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input value={name} onChange={event => setName(event.target.value)}
                placeholder="Pesquisar por nome" className="w-full border rounded-md py-2 pl-9 pr-3 bg-white font-normal" />
            </div>
          </label>
          <label className="text-sm font-medium">
            Placa do veículo
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input value={plate} onChange={event => setPlate(event.target.value)}
                placeholder="Pesquisar por placa" className="w-full border rounded-md py-2 pl-9 pr-3 bg-white font-normal uppercase" />
            </div>
          </label>
        </div>
        <div className="overflow-auto min-h-0 border rounded-lg">
          {loading ? <p className="p-6 text-center text-sm text-slate-500" role="status">Carregando veículos credenciados…</p>
            : error ? <div className="p-5 text-sm text-red-700" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 underline font-medium">Tentar novamente</button>
            </div>
            : rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500" role="status">
              {name.trim() || plate.trim() ? 'Nenhum veículo credenciado encontrado para a pesquisa.' : 'Nenhum veículo credenciado cadastrado.'}
            </p>
            : <table className="w-full text-sm text-left">
              <thead className="sticky top-0 bg-slate-50 text-slate-600">
                <tr><th className="px-4 py-3">Instrutor</th><th className="px-4 py-3">Placa</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => <tr key={`${row.instructorId}:${row.vehicleId}`}>
                  <td className="px-4 py-3 break-words">{row.name}</td>
                  <td className="px-4 py-3 font-semibold uppercase whitespace-nowrap">{row.plate}</td>
                </tr>)}
              </tbody>
            </table>}
        </div>
        {!loading && !error && <p className="text-xs text-slate-500" aria-live="polite">{rows.length} veículo(s) encontrado(s).</p>}
      </DialogContent>
    </Dialog>
  );
}
