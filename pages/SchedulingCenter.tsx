
import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, ExamSchedule, ExamType, Examiner, ExamStatus, SystemSettings } from '../types';
import { Calendar, Clock, User, Plus, Search, ChevronRight, X, CheckSquare, Printer, Trash2, Layers, Edit2, Loader2, AlertTriangle, MessageCircle, CheckCircle, Circle, Filter, RotateCcw, Ban, Hourglass } from 'lucide-react';

const formatDateDisplay = (dateString: string) => {
  if (!dateString) return '-';
  const cleanDate = dateString.split('T')[0];
  const parts = cleanDate.split('-');
  return parts.length !== 3 ? cleanDate : `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const CountdownTimer: React.FC<{ schedule: ExamSchedule }> = ({ schedule }) => {
  const [timeLeft, setTimeLeft] = useState<string>('Carregando...');
  const [styleClass, setStyleClass] = useState<string>('bg-gray-100 text-gray-500');

  useEffect(() => {
    const calculateTime = () => {
      if (schedule.status === 'CANCELLED') { setTimeLeft('Cancelada'); setStyleClass('bg-red-100 text-red-700 font-bold'); return; }
      if (schedule.status === 'CONCLUDED') { setTimeLeft('Concluída'); setStyleClass('bg-blue-100 text-blue-700 font-bold'); return; }

      const now = new Date();
      const examDate = new Date(`${schedule.date.split('T')[0]}T${schedule.time}`);
      if (isNaN(examDate.getTime())) { setTimeLeft('Data Inválida'); return; }
      
      const closeTime = new Date(examDate.getTime() - (24 * 60 * 60 * 1000));
      if (now > closeTime) {
         if (schedule.status === 'OPEN') { setTimeLeft('Fechando...'); setStyleClass('bg-orange-100 text-orange-700 animate-pulse'); }
         else {
             const diff = examDate.getTime() - now.getTime();
             if (diff > 0) {
                 const h = Math.floor(diff / 3600000);
                 const m = Math.floor((diff % 3600000) / 60000);
                 setTimeLeft(`Prova em: ${h}h ${m}m`);
                 setStyleClass('bg-blue-100 text-blue-700 font-bold');
             } else { setTimeLeft('Em Andamento'); setStyleClass('bg-green-100 text-green-700 animate-pulse'); }
         }
         return;
      }
      const diff = closeTime.getTime() - now.getTime();
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      setTimeLeft(d > 0 ? `Fecha em: ${d}d ${h}h` : `Fecha em: ${h}h`);
      setStyleClass('bg-green-50 text-green-700');
    };
    calculateTime();
    const timer = setInterval(calculateTime, 10000);
    return () => clearInterval(timer);
  }, [schedule]);

  return <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border shadow-sm ${styleClass}`}><Hourglass className="h-3 w-3" />{timeLeft}</div>;
};

const SchedulingCenter: React.FC = () => {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [allRequests, setAllRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<ExamSchedule | null>(null);
  const [scheduledStudents, setScheduledStudents] = useState<ExamRequest[]>([]);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<ExamRequest[]>([]);
  const [selectedStudentsMap, setSelectedStudentsMap] = useState<Record<string, string>>({});
  const [studentFilter, setStudentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'CONCLUDED' | 'CANCELLED'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', examiner1: '', maxSlotsA: 10, maxSlotsB: 10 });

  const refreshData = async () => {
    const [scheds, exams, sysSettings, requests] = await Promise.all([api.getSchedules(), api.getExaminersAsync(), api.getSettings(), api.getRequests()]);
    setSchedules(scheds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setExaminers(exams);
    setSettings(sysSettings);
    setAllRequests(requests);
    setLoading(false);
  };

  useEffect(() => { refreshData(); }, []);

  useEffect(() => {
    if (selectedSchedule) {
      const updated = schedules.find(s => s.id === selectedSchedule.id);
      if (updated) {
          setSelectedSchedule(updated);
          const reqs = allRequests.filter(r => r.scheduleId === updated.id);
          setScheduledStudents(reqs);
          setAvailableStudents(allRequests.filter(r => r.examType === ExamType.COMMON && !r.scheduleId && r.status === ExamStatus.WAITING_SCHEDULING));
      }
    }
  }, [schedules, allRequests, selectedSchedule?.id]);

  const handlePrint = () => window.print();

  const getExaminerName = (id?: string) => examiners.find(e => e.id === id)?.name || 'Não atribuído';

  if (loading) return <div className="p-10 text-center text-gray-500">Carregando...</div>;

  return (
    <>
      {selectedSchedule ? (
        <div className="space-y-6">
          <div className="print:hidden flex items-center gap-2 text-sm text-gray-500 mb-4 cursor-pointer hover:text-blue-600" onClick={() => setSelectedSchedule(null)}>
            <ChevronRight className="h-4 w-4 rotate-180" /> Voltar
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden print:shadow-none print:border-none">
            {/* Header de Impressão */}
            <div className="p-6 bg-gray-50 border-b print:bg-white print:border-b-2 print:border-black print:p-0 print:mb-4">
              <div className="hidden print:block mb-4">
                  <div className="flex items-center gap-4 mb-3 border-b-2 border-black pb-2">
                      {settings?.logoUrl && <img src={settings.logoUrl} className="h-16 w-auto max-w-[100px]" />}
                      <div>
                          <h1 className="text-sm font-bold uppercase">{settings?.agencyName || 'DETRAN'}</h1>
                          <p className="text-xl font-black uppercase">Lista de Chamada - Prova Prática</p>
                      </div>
                  </div>
                  <div className="flex justify-between text-[12px] font-bold">
                       <div>DATA: {formatDateDisplay(selectedSchedule.date)} <span className="ml-6">HORA: {selectedSchedule.time}</span></div>
                       <div className="uppercase">EXAMINADOR: {selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</div>
                  </div>
              </div>

              <div className="flex justify-between items-start print:hidden">
                  <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">Lista de Chamada <CountdownTimer schedule={selectedSchedule} /></h2>
                    <div className="text-sm text-gray-500 flex gap-4">
                        <span>{formatDateDisplay(selectedSchedule.date)} às {selectedSchedule.time}</span>
                        <span className="font-bold">Moto: {scheduledStudents.filter(s=>s.scheduledCategory==='A').length}/{selectedSchedule.maxSlotsA}</span>
                        <span className="font-bold">Carro: {scheduledStudents.filter(s=>s.scheduledCategory==='B').length}/{selectedSchedule.maxSlotsB}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 bg-white"><Printer className="h-4 w-4" /> Imprimir</button>
                    <button onClick={() => setIsAddStudentOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"><Plus className="h-4 w-4" /> Adicionar</button>
                  </div>
              </div>
            </div>

            {/* Listas de Alunos */}
            <div className="print:p-0">
               {['A', 'B'].map((cat) => {
                   const students = scheduledStudents.filter(s => s.scheduledCategory === cat);
                   if (students.length === 0) return null;
                   return (
                       <div key={cat} className="mb-8 print:mb-6 break-inside-avoid">
                          <h3 className="text-lg font-bold px-6 py-3 bg-gray-100 print:bg-transparent print:px-0 print:py-1 print:border-b print:mb-2 uppercase text-[14px]">
                              Categoria {cat}
                          </h3>
                          <table className="w-full text-sm text-left border-collapse print:text-[11px]">
                              <thead>
                                  <tr className="bg-gray-50 print:bg-white border-b print:border-black">
                                      <th className="px-6 py-3 w-10 print:border print:border-black">#</th>
                                      <th className="px-6 py-3 print:border print:border-black print:w-[120px]">CPF</th>
                                      <th className="px-6 py-3 print:border print:border-black">Nome do Candidato</th>
                                      <th className="hidden print:table-cell px-2 py-3 print:border print:border-black w-24">Restrição</th>
                                      <th className="hidden print:table-cell px-2 py-3 text-center print:border print:border-black w-14">Faltou</th>
                                      <th className="hidden print:table-cell px-2 py-3 text-center print:border print:border-black w-14">Apto</th>
                                      <th className="hidden print:table-cell px-2 py-3 text-center print:border print:border-black w-14">Inapto</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {students.map((req, idx) => (
                                      <tr key={req.id} className="border-b print:border-black">
                                          <td className="px-6 py-3 print:border print:border-black">{idx + 1}</td>
                                          <td className="px-6 py-3 print:border print:border-black">{req.cpf}</td>
                                          <td className="px-6 py-3 print:border print:border-black uppercase font-bold">{req.socialName || req.studentName}</td>
                                          <td className="hidden print:table-cell print:border print:border-black text-center uppercase">{req.cnhRestriction || '-'}</td>
                                          <td className="hidden print:table-cell print:border print:border-black"><div className="flex justify-center"><span className="w-4 h-4 border border-black block"></span></div></td>
                                          <td className="hidden print:table-cell print:border print:border-black"><div className="flex justify-center"><span className="w-4 h-4 border border-black block"></span></div></td>
                                          <td className="hidden print:table-cell print:border print:border-black"><div className="flex justify-center"><span className="w-4 h-4 border border-black block"></span></div></td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                       </div>
                   );
               })}
            </div>

            {/* RODAPÉ DE IMPRESSÃO - AJUSTE FINAL SOLICITADO */}
            <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white pt-10 pb-12 flex-col items-center">
                 
                 {/* 1. ASSINATURA ACIMA DA LINHA COM ESPAÇO AMPLO */}
                 <div className="mb-14 flex flex-col items-center">
                    <div className="w-80 border-b-2 border-black mb-2"></div>
                    <span className="font-bold text-[11px] uppercase tracking-widest">Assinatura do Examinador</span>
                 </div>

                 {/* 2. LINHA DIVISÓRIA BEM GROSSA (6px) */}
                 <div className="w-full border-t-[6px] border-black pt-5 flex flex-col items-center">
                    {settings?.agencyAddress && (
                        <div className="font-bold uppercase text-[12px] mb-1">{settings.agencyAddress}</div>
                    )}
                    <div className="text-[10px] opacity-70">
                        Documento extraído do PráticoSys em {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}
                    </div>
                 </div>
            </div>
          </div>
          
          {/* Modal de Adição Omitido para brevidade */}
          {isAddStudentOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-lg text-gray-900">Adicionar Candidatos</h3>
                          <button onClick={() => setIsAddStudentOpen(false)}><X className="h-6 w-6 text-gray-400" /></button>
                      </div>
                      <div className="max-h-[60vh] overflow-y-auto mb-6">
                          {availableStudents.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-3 border-b hover:bg-gray-50 text-gray-900">
                                  <div>
                                      <div className="font-bold">{s.socialName || s.studentName}</div>
                                      <div className="text-xs text-gray-500">{s.cpf} | Cat {s.intendedCategory}</div>
                                  </div>
                                  <button 
                                    onClick={async () => {
                                        await api.assignStudentToSchedule(s.id, selectedSchedule.id, s.intendedCategory || 'B');
                                        refreshData();
                                    }}
                                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                                  >Selecionar</button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Central de Agendamentos</h2>
            <button onClick={() => { setScheduleForm({ date: '', time: '', examiner1: '', maxSlotsA: 10, maxSlotsB: 10 }); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 shadow-sm"><Plus className="h-5 w-5" /> Nova Banca</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {schedules.map(s => (
                 <div key={s.id} onClick={() => setSelectedSchedule(s)} className="bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow group relative text-gray-900">
                     <div className="flex justify-between items-start mb-4">
                         <div className="bg-blue-50 text-blue-700 p-2 rounded-lg"><Calendar className="h-6 w-6" /></div>
                         <CountdownTimer schedule={s} />
                     </div>
                     <h3 className="text-lg font-bold">{formatDateDisplay(s.date)} <span className="text-sm font-normal text-gray-500 ml-2">{s.time}</span></h3>
                     <div className="border-t mt-3 pt-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2"><User className="h-3 w-3" /> {getExaminerName(s.examinerIds[0])}</div>
                        <div className="flex justify-between mt-2 font-bold">
                            <span>Moto: {allRequests.filter(r=>r.scheduleId===s.id && r.scheduledCategory==='A').length}/{s.maxSlotsA}</span>
                            <span>Carro: {allRequests.filter(r=>r.scheduleId===s.id && r.scheduledCategory==='B').length}/{s.maxSlotsB}</span>
                        </div>
                     </div>
                 </div>
             ))}
          </div>
        </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-gray-900">
                  <h3 className="text-lg font-bold mb-4">Nova Banca</h3>
                  <form onSubmit={async (e) => {
                      e.preventDefault();
                      await api.createSchedule({ ...scheduleForm, type: ExamType.COMMON, examinerIds: [scheduleForm.examiner1] });
                      setIsModalOpen(false);
                      refreshData();
                  }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-sm">Data</label><input required type="date" className="w-full border rounded p-2 bg-white" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} /></div>
                          <div><label className="text-sm">Hora</label><input required type="time" className="w-full border rounded p-2 bg-white" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} /></div>
                      </div>
                      <div>
                          <label className="text-sm">Examinador Principal</label>
                          <select required className="w-full border rounded p-2 bg-white" value={scheduleForm.examiner1} onChange={e => setScheduleForm({...scheduleForm, examiner1: e.target.value})}>
                              <option value="">Selecione...</option>
                              {examiners.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                          </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Cancelar</button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </>
  );
};

export default SchedulingCenter;
