
import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, ExamSchedule, ExamType, Examiner, ExamStatus, SystemSettings } from '../types';
import { 
  Calendar, 
  Clock, 
  User, 
  Plus, 
  Search, 
  ChevronRight, 
  X, 
  Printer, 
  Trash2, 
  Edit2, 
  Users,
  Loader2,
  MessageCircle,
  CheckCircle2,
  CheckCircle,
  Filter,
  ChevronDown,
  Square,
  CheckSquare,
  Bike,
  Car,
  MapPin,
  FileText
} from 'lucide-react';

const formatDateDisplay = (dateString: string) => {
  if (!dateString) return '-';
  const cleanDate = dateString.split('T')[0];
  const parts = cleanDate.split('-');
  return parts.length !== 3 ? cleanDate : `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const configs: Record<string, { label: string, classes: string }> = {
    'OPEN': { label: 'Aberta', classes: 'bg-green-100 text-green-700 border-green-200' },
    'CLOSED': { label: 'Fechada', classes: 'bg-orange-100 text-orange-700 border-orange-200' },
    'CONCLUDED': { label: 'Concluída', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
    'CANCELLED': { label: 'Cancelada', classes: 'bg-red-100 text-red-700 border-red-200' },
  };
  const config = configs[status] || { label: status, classes: 'bg-gray-100 text-gray-700 border-gray-200' };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.classes} uppercase tracking-wider`}>
      {config.label}
    </span>
  );
};

interface SchedulingCenterProps {
  type?: ExamType;
}

const SchedulingCenter: React.FC<SchedulingCenterProps> = ({ type }) => {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [allRequests, setAllRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedSchedule, setSelectedSchedule] = useState<ExamSchedule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // States for Add Student Modal
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentSearch, setSearchTermInput] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, 'A' | 'B'>>({});

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingSchedule, setEditingSchedule] = useState<ExamSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ 
    date: '', 
    time: '08:00', 
    examinerIds: [] as string[], 
    maxSlotsA: 10, 
    maxSlotsB: 10,
    type: type || ExamType.COMMON
  });

  const refreshData = async () => {
    setLoading(true);
    try {
      const [scheds, exams, sysSettings, requests] = await Promise.all([
        api.getSchedules(), 
        api.getExaminersAsync(), 
        api.getSettings(), 
        api.getRequests()
      ]);
      let filteredScheds = scheds;
      if (type) filteredScheds = filteredScheds.filter(s => s.type === type);
      setSchedules(filteredScheds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setExaminers(exams);
      setSettings(sysSettings);
      setAllRequests(requests);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, [type]);

  const handleOpenModal = (sched?: ExamSchedule) => {
    if (sched) {
      setEditingSchedule(sched);
      setScheduleForm({
        date: sched.date,
        time: sched.time,
        examinerIds: sched.examinerIds || [],
        maxSlotsA: sched.maxSlotsA,
        maxSlotsB: sched.maxSlotsB,
        type: sched.type
      });
    } else {
      setEditingSchedule(null);
      setScheduleForm({
        date: '',
        time: '08:00',
        examinerIds: [],
        maxSlotsA: settings?.defaultMaxSlotsA || 10,
        maxSlotsB: settings?.defaultMaxSlotsB || 10,
        type: type || ExamType.COMMON
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSchedule) {
      await api.updateSchedule(editingSchedule.id, scheduleForm);
    } else {
      await api.createSchedule(scheduleForm);
    }
    setIsModalOpen(false);
    refreshData();
  };

  const toggleCandidateSelection = (id: string, category: 'A' | 'B') => {
      setSelectedCandidates(prev => {
          const newState = { ...prev };
          if (newState[id]) delete newState[id];
          else newState[id] = category;
          return newState;
      });
  };

  const handleConfirmBatchSchedule = async () => {
      if (!selectedSchedule) return;
      setLoading(true);
      try {
          const updates = Object.entries(selectedCandidates).map(([id, cat]) => 
              api.assignStudentToSchedule(id, selectedSchedule.id, cat)
          );
          await Promise.all(updates);
          setIsAddStudentOpen(false);
          setSelectedCandidates({});
          refreshData();
      } catch (err) {
          alert('Erro ao agendar candidatos.');
      } finally {
          setLoading(false);
      }
  };

  const handleRemoveStudent = async (requestId: string) => {
    if(!window.confirm("Remover candidato desta banca?")) return;
    await api.removeStudentFromSchedule(requestId);
    refreshData();
  };

  const toggleAttendance = async (req: ExamRequest) => {
    await api.updateRequest(req.id, { attendanceConfirmed: !req.attendanceConfirmed });
    refreshData();
  };

  const getExaminerName = (id: string) => examiners.find(e => e.id === id)?.name || 'Desconhecido';

  const filteredSchedules = schedules.filter(s => {
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    // Fix: Explicitly cast id as string to avoid unknown type errors from JSONB array iteration
    const matchesSearch = s.date.includes(searchTerm) || (s.examinerIds && Array.isArray(s.examinerIds) && s.examinerIds.some(id => getExaminerName(id as string).toLowerCase().includes(searchTerm.toLowerCase())));
    return matchesStatus && matchesSearch;
  });

  const scheduledStudents = allRequests.filter(r => r.scheduleId === selectedSchedule?.id);
  
  const availableRequests = allRequests
    .filter(r => 
        r.status === ExamStatus.WAITING_SCHEDULING && 
        r.examType === selectedSchedule?.type &&
        (r.studentName.toLowerCase().includes(studentSearch.toLowerCase()) || r.cpf.includes(studentSearch))
    )
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  const candidatesA = availableRequests.filter(r => r.intendedCategory === 'A' || r.intendedCategory === 'AB');
  const candidatesB = availableRequests.filter(r => r.intendedCategory === 'B' || r.intendedCategory === 'AB');

  const currentCountA = scheduledStudents.filter(s => s.scheduledCategory === 'A').length;
  const currentCountB = scheduledStudents.filter(s => s.scheduledCategory === 'B').length;
  const selectedCountA = Object.values(selectedCandidates).filter(c => c === 'A').length;
  const selectedCountB = Object.values(selectedCandidates).filter(c => c === 'B').length;
  const remainingA = (selectedSchedule?.maxSlotsA || 0) - currentCountA - selectedCountA;
  const remainingB = (selectedSchedule?.maxSlotsB || 0) - currentCountB - selectedCountB;

  if (loading) return <div className="p-10 text-center flex flex-col items-center gap-4"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      {!selectedSchedule ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex gap-3 w-full md:w-auto items-center">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Buscar banca..." className="w-full pl-10 pr-4 py-2 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <select className="px-3 py-2 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="ALL">Todos Status</option>
                    <option value="OPEN">Abertas</option>
                    <option value="CLOSED">Fechadas</option>
                    <option value="CONCLUDED">Concluídas</option>
                </select>
             </div>
             <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition-colors"><Plus className="h-4 w-4" /> Nova Banca</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.map(s => {
              const studentsCount = allRequests.filter(r => r.scheduleId === s.id).length;
              return (
                <div key={s.id} className="bg-white rounded-xl border-2 border-transparent shadow-sm hover:shadow-lg transition-all cursor-pointer group relative flex flex-col overflow-hidden" onClick={() => setSelectedSchedule(s)}>
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600"><Calendar className="h-6 w-6" /></div>
                        <StatusBadge status={s.status} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-1">{formatDateDisplay(s.date)}</h3>
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
                        <Clock className="h-4 w-4" /> {s.time}
                        <span className="mx-1 opacity-20">|</span>
                        <span className="text-[10px] font-black uppercase text-blue-600 tracking-tighter">{s.type}</span>
                    </div>
                    <div className="space-y-2 border-t pt-4 text-xs font-bold text-gray-500">
                        {/* Fix: Explicitly cast id as string for consistency with getExaminerName */}
                        <div className="flex items-center gap-2"><User className="h-4 w-4 opacity-50" /> <span className="truncate">{s.examinerIds && Array.isArray(s.examinerIds) && s.examinerIds.length > 0 ? s.examinerIds.map(id => getExaminerName(id as string)).join(', ') : 'Nenhum examinador definido'}</span></div>
                        <div className="flex items-center gap-2"><Users className="h-4 w-4 opacity-50" /> <span>{studentsCount} candidatos agendados</span></div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-5 py-3 border-t flex justify-between items-center group-hover:bg-blue-50 transition-colors">
                      <span className="text-[10px] font-black uppercase text-gray-400">Ver Detalhes</span>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-fadeIn pb-20">
            <div className="flex items-center justify-between print:hidden">
                <button onClick={() => setSelectedSchedule(null)} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-black uppercase text-xs transition-colors"><ChevronRight className="h-4 w-4 rotate-180" /> Voltar para Lista</button>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black shadow-lg text-sm font-black uppercase tracking-widest"><Printer className="h-4 w-4" /> Imprimir Chamada</button>
                    {selectedSchedule.status === 'OPEN' && (
                        <button onClick={() => setIsAddStudentOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg text-sm font-black uppercase tracking-widest"><Plus className="h-4 w-4" /> Agendar</button>
                    )}
                </div>
            </div>

            {/* CONTAINER PRINCIPAL (WEB + PRINT) */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none print:block">
                
                {/* CABEÇALHO OFICIAL (SÓ APARECE NA IMPRESSÃO) */}
                <div className="hidden print:flex items-center justify-between p-8 border-b-4 border-black mb-8">
                    <div className="flex items-center gap-8">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} className="h-24 w-auto object-contain" />
                        ) : (
                            <div className="h-24 w-24 bg-black flex items-center justify-center text-white font-black text-[10px] text-center p-2 leading-none uppercase">Logo<br/>Detran</div>
                        )}
                        <div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{settings?.agencyName || 'DETRAN REGIONAL'}</h1>
                            <p className="text-xs font-bold text-gray-600 mt-1 uppercase">{settings?.agencyAddress}</p>
                            <h2 className="text-4xl font-black uppercase mt-4 tracking-tight">LISTA DE CHAMADA - EXAME PRÁTICO</h2>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <div className="bg-black text-white px-4 py-2 rounded-lg text-2xl font-black mb-2">{formatDateDisplay(selectedSchedule.date)}</div>
                        <div className="text-lg font-black uppercase">{selectedSchedule.time}</div>
                        <div className="text-[10px] font-black uppercase border-2 border-black px-2 mt-2">{selectedSchedule.type}</div>
                    </div>
                </div>

                {/* CABEÇALHO WEB */}
                <div className="p-8 bg-slate-900 text-white print:hidden">
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-4xl font-black tracking-tighter">{formatDateDisplay(selectedSchedule.date)}</h2>
                        <StatusBadge status={selectedSchedule.status} />
                    </div>
                    <div className="flex flex-wrap gap-8 text-sm opacity-80 font-bold uppercase tracking-widest mt-4">
                        <span className="flex items-center gap-2"><Clock className="h-5 w-5 text-blue-400" /> {selectedSchedule.time}</span>
                        {/* Fix: cast id as string */}
                        <span className="flex items-center gap-2"><User className="h-5 w-5 text-blue-400" /> {selectedSchedule.examinerIds && Array.isArray(selectedSchedule.examinerIds) && selectedSchedule.examinerIds.map(id => getExaminerName(id as string)).join(' | ')}</span>
                        <span className="flex items-center gap-2"><MapPin className="h-5 w-5 text-blue-400" /> {settings?.defaultExamAddress}</span>
                    </div>
                </div>

                <div className="p-8 space-y-16 print:p-0 print:space-y-12">
                    
                    {/* INFO ADICIONAL PRINT */}
                    <div className="hidden print:grid grid-cols-2 gap-10 text-xs font-black uppercase mb-10">
                        <div className="border-l-4 border-black pl-4">
                            <span className="text-gray-400 block mb-1">Examinadores Escalados:</span>
                            {/* Fix: cast id as string */}
                            <div className="text-lg">{selectedSchedule.examinerIds && Array.isArray(selectedSchedule.examinerIds) && selectedSchedule.examinerIds.map(id => getExaminerName(id as string)).join(' / ')}</div>
                        </div>
                        <div className="border-l-4 border-black pl-4">
                            <span className="text-gray-400 block mb-1">Local de Concentração:</span>
                            <div className="text-lg">{settings?.defaultExamAddress}</div>
                        </div>
                    </div>

                    {['A', 'B'].map(cat => {
                        const students = scheduledStudents.filter(s => s.scheduledCategory === cat).sort((a,b) => a.studentName.localeCompare(b.studentName));
                        if (students.length === 0 && selectedSchedule.status !== 'OPEN') return null;
                        
                        return (
                            <div key={cat} className="break-inside-avoid">
                                <div className="flex items-center gap-4 border-b-8 border-slate-900 pb-3 mb-8 print:border-black">
                                    <div className="bg-slate-900 text-white p-3 rounded-2xl print:bg-black">
                                        {cat === 'A' ? <Bike className="h-8 w-8" /> : <Car className="h-8 w-8" />}
                                    </div>
                                    <h3 className="text-4xl font-black uppercase tracking-tighter">CATEGORIA {cat === 'A' ? 'A (MOTO)' : 'B (CARRO)'}</h3>
                                    <div className="ml-auto text-right">
                                        <span className="text-[10px] font-black uppercase text-gray-400 block leading-none">Candidatos</span>
                                        <span className="text-2xl font-black">{students.length}</span>
                                    </div>
                                </div>

                                {/* VISUALIZAÇÃO WEB */}
                                <div className="space-y-3 print:hidden">
                                    {students.map((req, idx) => (
                                        <div key={req.id} className={`flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl border-2 transition-all hover:border-blue-200 bg-white ${req.attendanceConfirmed ? 'border-green-100 bg-green-50/10' : 'border-gray-100'}`}>
                                            <div className="flex items-center gap-5 flex-1 w-full">
                                                <div className="h-12 w-12 bg-slate-50 border rounded-xl flex items-center justify-center font-black text-slate-400 shrink-0 text-lg">{idx + 1}</div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xl font-black text-slate-900 uppercase truncate leading-tight">{req.socialName || req.studentName}</div>
                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-400 uppercase mt-1">
                                                        <span className="text-blue-600 font-black">{req.cpf}</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Instrutor: {req.instructor || '-'}</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>Placa: {req.vehiclePlate || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => toggleAttendance(req)} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${req.attendanceConfirmed ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-100' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600'}`}>
                                                    {req.attendanceConfirmed ? <CheckCircle2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />} 
                                                    {req.attendanceConfirmed ? 'Confirmado' : 'Confirmar'}
                                                </button>
                                                <button onClick={() => handleRemoveStudent(req.id)} className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border-2 border-transparent hover:border-red-100"><Trash2 className="h-5 w-5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {students.length === 0 && <div className="text-center py-16 border-4 border-dashed rounded-3xl text-gray-300 font-black uppercase tracking-widest text-sm">Nenhum candidato nesta categoria.</div>}
                                </div>

                                {/* TABELA DE IMPRESSÃO OFICIAL (SÓ PRINT) */}
                                <table className="hidden print:table w-full text-left border-collapse border-4 border-black">
                                    <thead>
                                        <tr className="bg-black text-white font-black text-[10px] uppercase tracking-widest">
                                            <th className="px-2 py-3 w-10 text-center border-r border-white">#</th>
                                            <th className="px-3 py-3 w-32 border-r border-white">CPF</th>
                                            <th className="px-3 py-3 border-r border-white">CANDIDATO / INSTRUTOR / PLACA</th>
                                            <th className="px-2 py-3 w-14 text-center border-r border-white">REST.</th>
                                            <th className="px-1 py-3 w-14 text-center border-r border-white">FALTOU</th>
                                            <th className="px-1 py-3 w-14 text-center border-r border-white">APTO</th>
                                            <th className="px-1 py-3 w-14 text-center">INAPTO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-black">
                                        {students.map((req, idx) => (
                                            <tr key={req.id} className="border-b-2 border-black">
                                                <td className="px-2 py-2.5 text-center font-black border-r-2 border-black text-sm">{idx + 1}</td>
                                                <td className="px-3 py-2.5 font-black text-sm border-r-2 border-black whitespace-nowrap">{req.cpf}</td>
                                                <td className="px-3 py-2.5 border-r-2 border-black">
                                                    <div className="font-black uppercase text-[12px] leading-none mb-1">{req.socialName || req.studentName}</div>
                                                    <div className="text-[8px] font-bold text-gray-500 uppercase flex gap-3">
                                                        <span>INSTR: {req.instructor || '-'}</span>
                                                        <span>PLACA: {req.vehiclePlate || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2.5 text-center font-black text-[10px] border-r-2 border-black">{req.cnhRestriction || '-'}</td>
                                                <td className="px-1 py-2.5 border-r-2 border-black"><div className="w-6 h-6 border-2 border-black mx-auto rounded-sm"></div></td>
                                                <td className="px-1 py-2.5 border-r-2 border-black"><div className="w-6 h-6 border-2 border-black mx-auto rounded-sm"></div></td>
                                                <td className="px-1 py-2.5"><div className="w-6 h-6 border-2 border-black mx-auto rounded-sm"></div></td>
                                            </tr>
                                        ))}
                                        {students.length === 0 && (
                                            <tr><td colSpan={7} className="p-10 text-center font-black uppercase text-gray-300 tracking-widest">Sem agendamentos para esta categoria.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}

                    {/* ÁREA DE ASSINATURA (SÓ IMPRESSÃO) */}
                    <div className="hidden print:block mt-24 break-inside-avoid">
                        <div className="grid grid-cols-2 gap-x-20 gap-y-16">
                            <div className="flex flex-col items-center">
                                <div className="w-full border-b-2 border-black mb-2"></div>
                                <span className="text-[10px] font-black uppercase">Assinatura Examinador 01</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-full border-b-2 border-black mb-2"></div>
                                <span className="text-[10px] font-black uppercase">Assinatura Examinador 02</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-full border-b-2 border-black mb-2"></div>
                                <span className="text-[10px] font-black uppercase">Assinatura Examinador 03 (Especial)</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-full border-b-2 border-black mb-2 text-center text-[10px] font-bold pb-1 italic">Visto Supervisor</div>
                                <span className="text-[10px] font-black uppercase tracking-widest">SUPERVISÃO DE BANCAS</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RODAPÉ PRINT */}
                <div className="hidden print:flex fixed bottom-0 left-0 w-full border-t-2 border-black bg-white p-4 justify-between items-center text-[8px] font-black uppercase">
                    <div className="flex gap-4">
                        <span>PRÁTICOSYS v1.0</span>
                        <span>{settings?.agencyName}</span>
                    </div>
                    <div>DATA IMPRESSÃO: {new Date().toLocaleString('pt-BR')}</div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: NOVA BANCA */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <h3 className="text-xl font-black uppercase tracking-tighter">{editingSchedule ? 'Editar Banca' : 'Nova Banca de Prova'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform"><X className="h-7 w-7" /></button>
                  </div>
                  <form onSubmit={handleSaveSchedule} className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Data da Prova</label>
                            <input required type="date" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-gray-900 bg-slate-50 focus:border-blue-500 transition-all outline-none" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Horário Início</label>
                            <input required type="time" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-gray-900 bg-slate-50 focus:border-blue-500 transition-all outline-none" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Vagas Moto (A)</label>
                            <input required type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-gray-900 bg-slate-50" value={scheduleForm.maxSlotsA} onChange={e => setScheduleForm({...scheduleForm, maxSlotsA: parseInt(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Vagas Carro (B)</label>
                            <input required type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-gray-900 bg-slate-50" value={scheduleForm.maxSlotsB} onChange={e => setScheduleForm({...scheduleForm, maxSlotsB: parseInt(e.target.value)})} />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-xs hover:text-slate-600">Cancelar</button>
                          <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all">Salvar Banca</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: ADICIONAR ESTUDANTE */}
      {isAddStudentOpen && selectedSchedule && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] animate-scaleIn">
                  <div className="flex justify-between items-center p-8 border-b">
                      <div>
                          <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tighter">Agendar Candidatos</h3>
                          <p className="text-xs font-bold text-gray-400 uppercase">Selecionando para banca de {formatDateDisplay(selectedSchedule.date)}</p>
                      </div>
                      <button onClick={() => setIsAddStudentOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="h-6 w-6 text-slate-400" /></button>
                  </div>
                  
                  <div className="p-6 bg-slate-50 border-b">
                      <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input type="text" placeholder="Filtrar candidatos por Nome ou CPF..." className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 rounded-2xl text-sm bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-bold transition-all" value={studentSearch} onChange={e => setSearchTermInput(e.target.value)} />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                      {/* CATEGORIA A */}
                      <div className="border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                          <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                              <div className="flex items-center gap-3"><Bike className="h-6 w-6 text-blue-400" /> <span className="font-black uppercase text-sm tracking-widest">Cat. A (Moto)</span></div>
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${remainingA <= 0 ? 'bg-red-500' : 'bg-blue-600'}`}>
                                  {remainingA <= 0 ? 'Lotado' : `${remainingA} Vagas`}
                              </span>
                          </div>
                          <div className="p-3 space-y-1">
                              {candidatesA.map(cand => (
                                  <label key={cand.id} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedCandidates[cand.id] === 'A' ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'} ${(!selectedCandidates[cand.id] && remainingA <= 0) ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}>
                                      <input type="checkbox" className="hidden" disabled={!selectedCandidates[cand.id] && remainingA <= 0} checked={selectedCandidates[cand.id] === 'A'} onChange={() => toggleCandidateSelection(cand.id, 'A')} />
                                      {selectedCandidates[cand.id] === 'A' ? <CheckSquare className="h-7 w-7 text-blue-600" /> : <Square className="h-7 w-7 text-slate-200" />}
                                      <div className="flex-1">
                                          <div className="font-black uppercase text-slate-800 leading-tight">{cand.studentName}</div>
                                          <div className="text-[10px] font-black text-slate-400 mt-1 uppercase">CPF: {cand.cpf} <span className="mx-1 opacity-20">•</span> Cadastro: {new Date(cand.createdAt).toLocaleDateString()}</div>
                                      </div>
                                  </label>
                              ))}
                              {candidatesA.length === 0 && <div className="p-10 text-center text-gray-300 uppercase font-black text-xs italic">Nenhum candidato em espera (Moto)</div>}
                          </div>
                      </div>

                      {/* CATEGORIA B */}
                      <div className="border-2 border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                          <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                              <div className="flex items-center gap-3"><Car className="h-6 w-6 text-green-400" /> <span className="font-black uppercase text-sm tracking-widest">Cat. B (Carro)</span></div>
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${remainingB <= 0 ? 'bg-red-500' : 'bg-green-600'}`}>
                                  {remainingB <= 0 ? 'Lotado' : `${remainingB} Vagas`}
                              </span>
                          </div>
                          <div className="p-3 space-y-1">
                              {candidatesB.map(cand => (
                                  <label key={cand.id} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedCandidates[cand.id] === 'B' ? 'border-green-500 bg-green-50' : 'border-transparent hover:bg-slate-50'} ${(!selectedCandidates[cand.id] && remainingB <= 0) ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}>
                                      <input type="checkbox" className="hidden" disabled={!selectedCandidates[cand.id] && remainingB <= 0} checked={selectedCandidates[cand.id] === 'B'} onChange={() => toggleCandidateSelection(cand.id, 'B')} />
                                      {selectedCandidates[cand.id] === 'B' ? <CheckSquare className="h-7 w-7 text-green-600" /> : <Square className="h-7 w-7 text-slate-200" />}
                                      <div className="flex-1">
                                          <div className="font-black uppercase text-slate-800 leading-tight">{cand.studentName}</div>
                                          <div className="text-[10px] font-black text-slate-400 mt-1 uppercase">CPF: {cand.cpf} <span className="mx-1 opacity-20">•</span> Cadastro: {new Date(cand.createdAt).toLocaleDateString()}</div>
                                      </div>
                                  </label>
                              ))}
                              {candidatesB.length === 0 && <div className="p-10 text-center text-gray-300 uppercase font-black text-xs italic">Nenhum candidato em espera (Carro)</div>}
                          </div>
                      </div>
                  </div>

                  <div className="p-8 border-t bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="text-sm font-black uppercase text-slate-400">
                          {Object.keys(selectedCandidates).length} candidatos selecionados
                      </div>
                      <div className="flex gap-4 w-full sm:w-auto">
                          <button onClick={() => setIsAddStudentOpen(false)} className="flex-1 sm:flex-none px-8 py-4 text-slate-400 font-black uppercase text-xs hover:text-slate-600 transition-colors">Cancelar</button>
                          <button onClick={handleConfirmBatchSchedule} disabled={Object.keys(selectedCandidates).length === 0} className="flex-1 sm:flex-none px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs shadow-2xl shadow-blue-200 disabled:opacity-30 disabled:shadow-none hover:bg-blue-700 transition-all">Confirmar Agendamento</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SchedulingCenter;
