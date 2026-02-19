
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
  Ban, 
  Users,
  Loader2,
  Layers,
  MessageCircle,
  CheckCircle2,
  CheckCircle,
  Filter,
  ChevronDown,
  ChevronUp,
  Square,
  CheckSquare,
  Bike,
  Car,
  MapPin
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
  const [expandedCategories, setExpandedCategories] = useState<{A: boolean, B: boolean}>({ A: true, B: false });

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [editingSchedule, setEditingSchedule] = useState<ExamSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ 
    date: '', 
    time: '', 
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

  const injectEmojis = (text: string) => {
    const emojiMap: Record<string, string> = {
      '[WAVE]': '👋', '[SMILE]': '😄', '[CAR]': '🚗', '[CALENDAR]': '📅',
      '[CLOCK]': '⏰', '[MAP]': '📍', '[WARNING]': '⚠️', '[ID]': '🪪',
      '[CAR_FRONT]': '🚘', '[CHECK]': '✅', '[HOURGLASS]': '⏳'
    };
    if (!text) return '';
    let result = String(text);
    Object.entries(emojiMap).forEach(([tag, emoji]) => {
      result = result.split(tag).join(emoji);
    });
    return result;
  };

  const handleWhatsApp = (req: ExamRequest) => {
    if (!selectedSchedule) return;
    const safeSettings = settings || { agencyName: 'Detran', defaultExamAddress: '', defaultExamAddressLink: '' };
    const replacements: Record<string, string> = {
      '{CANDIDATO}': req.socialName || req.studentName || '',
      '{CATEGORIA}': req.scheduledCategory || req.intendedCategory || '-',
      '{DATA}': formatDateDisplay(selectedSchedule.date),
      '{HORA}': selectedSchedule.time,
      '{ENDERECO}': safeSettings.defaultExamAddress || '',
      '{LOCALIZACAO}': safeSettings.defaultExamAddressLink || '',
      '{AGENCIA}': safeSettings.agencyName || 'Detran'
    };
    let finalMessage = safeSettings.whatsappMessageTemplate || '';
    Object.entries(replacements).forEach(([tag, value]) => {
      finalMessage = finalMessage.split(tag).join(value || '');
    });
    finalMessage = injectEmojis(finalMessage);
    const phoneDigits = req.phone.replace(/\D/g, '');
    if (!phoneDigits) return alert('Telefone inválido.');
    const finalPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    window.open(`https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodeURIComponent(finalMessage)}`, '_blank');
  };

  const toggleAttendance = async (req: ExamRequest) => {
    await api.updateRequest(req.id, { attendanceConfirmed: !req.attendanceConfirmed });
    refreshData();
  };

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

  const getExaminerName = (id: string) => examiners.find(e => e.id === id)?.name || 'Desconhecido';

  const filteredSchedules = schedules.filter(s => {
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesSearch = s.date.includes(searchTerm) || s.examinerIds.some(id => getExaminerName(id).toLowerCase().includes(searchTerm.toLowerCase()));
    let matchesDate = true;
    if (startDate || endDate) {
        const schedTime = new Date(s.date).getTime();
        if (startDate && schedTime < new Date(startDate).getTime()) matchesDate = false;
        if (endDate && schedTime > new Date(endDate).getTime()) matchesDate = false;
    }
    return matchesStatus && matchesSearch && matchesDate;
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
             <div className="flex gap-3 w-full md:w-auto items-center flex-wrap">
                <div className="relative w-full md:w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <select className="px-3 py-2 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="ALL">Status</option>
                    <option value="OPEN">Abertas</option>
                    <option value="CLOSED">Fechadas</option>
                    <option value="CONCLUDED">Concluídas</option>
                    <option value="CANCELLED">Canceladas</option>
                </select>
                <div className="flex items-center gap-2">
                    <input type="date" className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <input type="date" className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
             </div>
             <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition-colors"><Plus className="h-4 w-4" /> Nova Banca</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.map(s => {
              const studentsCount = allRequests.filter(r => r.scheduleId === s.id).length;
              return (
                <div key={s.id} className={`bg-white rounded-xl border-2 transition-all hover:shadow-lg cursor-pointer group relative flex flex-col ${s.status === 'CANCELLED' ? 'border-red-100 opacity-75' : 'border-transparent shadow-sm'}`} onClick={() => setSelectedSchedule(s)}>
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg ${s.status === 'CANCELLED' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}><Calendar className="h-6 w-6" /></div>
                        <StatusBadge status={s.status} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{formatDateDisplay(s.date)}</h3>
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-4"><Clock className="h-4 w-4" /> {s.time} <span className="text-[10px] font-medium text-gray-400 uppercase">• {s.type}</span></div>
                    <div className="space-y-2 border-t pt-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2"><User className="h-4 w-4 opacity-50" /> <span className="truncate">{s.examinerIds.length > 0 ? s.examinerIds.map(id => getExaminerName(id)).join(', ') : 'Sem examinador'}</span></div>
                        <div className="flex items-center gap-2"><Users className="h-4 w-4 opacity-50" /> <span>{studentsCount} candidatos agendados</span></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between print:hidden">
                <button onClick={() => setSelectedSchedule(null)} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium transition-colors"><ChevronRight className="h-4 w-4 rotate-180" /> Voltar</button>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 bg-white shadow-sm text-sm font-bold"><Printer className="h-4 w-4" /> Imprimir Chamada</button>
                    {selectedSchedule.status === 'OPEN' && (
                        <button onClick={() => setIsAddStudentOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md text-sm font-bold"><Plus className="h-4 w-4" /> Agendar Candidato</button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden print:shadow-none print:border-none print:block">
                {/* Cabeçalho de Impressão */}
                <div className="p-8 bg-slate-900 text-white print:bg-white print:p-0 print:!text-black print:border-b-4 print:border-black">
                    <div className="hidden print:flex items-center justify-between pb-6 mb-4">
                        <div className="flex items-center gap-8">
                            {settings?.logoUrl ? <img src={settings.logoUrl} className="h-20 w-auto" /> : <div className="h-20 w-20 bg-black flex items-center justify-center text-white font-black text-xs">LOGO</div>}
                            <div>
                                <h1 className="text-2xl font-black uppercase tracking-tight">{settings?.agencyName || 'DETRAN REGIONAL'}</h1>
                                <p className="text-sm font-bold opacity-70">{settings?.agencyAddress}</p>
                                <h2 className="text-3xl font-black uppercase mt-1">LISTA DE CHAMADA - PROVA PRÁTICA</h2>
                            </div>
                        </div>
                        <div className="text-right border-l-2 border-black pl-8">
                            <div className="text-xl font-black">{formatDateDisplay(selectedSchedule.date)}</div>
                            <div className="text-lg font-bold">{selectedSchedule.time}</div>
                            <div className="text-[10px] font-black uppercase bg-black text-white px-2 py-0.5 mt-2 rounded">{selectedSchedule.type}</div>
                        </div>
                    </div>

                    <div className="print:hidden">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-3xl font-black">{formatDateDisplay(selectedSchedule.date)}</h2>
                            <StatusBadge status={selectedSchedule.status} />
                        </div>
                        <div className="flex flex-wrap gap-6 text-sm opacity-80 font-medium uppercase tracking-wider">
                            <span className="flex items-center gap-2"><Clock className="h-5 w-5" /> {selectedSchedule.time}</span>
                            <span className="flex items-center gap-2"><User className="h-5 w-5" /> {selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-12 print:p-0 print:mt-8">
                    <div className="hidden print:grid grid-cols-1 gap-2 mb-8 text-xs font-bold uppercase">
                        <div className="flex items-center gap-2"><User className="h-4 w-4" /> EXAMINADOR(ES): <span className="font-black text-sm ml-2">{selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(' | ')}</span></div>
                        <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> LOCAL: <span className="font-black text-sm ml-2">{settings?.defaultExamAddress}</span></div>
                    </div>

                    {['A', 'B'].map(cat => {
                        const students = scheduledStudents.filter(s => s.scheduledCategory === cat).sort((a,b) => a.studentName.localeCompare(b.studentName));
                        if (students.length === 0 && selectedSchedule.status !== 'OPEN') return null;
                        
                        return (
                            <div key={cat} className="break-inside-avoid print:mb-10">
                                <div className="flex items-center gap-3 border-b-4 border-slate-900 pb-2 mb-6 print:border-black">
                                    <div className="bg-slate-900 text-white p-2 rounded-lg print:bg-black">
                                        {cat === 'A' ? <Bike className="h-6 w-6" /> : <Car className="h-6 w-6" />}
                                    </div>
                                    <h3 className="text-3xl font-black uppercase">CATEGORIA {cat === 'A' ? 'A (MOTO)' : 'B (CARRO)'}</h3>
                                    <span className="text-sm font-bold text-gray-400 ml-auto print:!text-black">
                                        {students.length} CANDIDATOS
                                    </span>
                                </div>

                                {/* VISUALIZAÇÃO WEB */}
                                <div className="space-y-3 print:hidden">
                                    {students.map((req, idx) => (
                                        <div key={req.id} className={`flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border-2 transition-all hover:border-blue-200 bg-white ${req.attendanceConfirmed ? 'border-green-100 bg-green-50/20' : 'border-gray-100'}`}>
                                            <div className="flex items-center gap-4 flex-1 w-full">
                                                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 shrink-0">{idx + 1}</div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-lg font-black text-slate-900 uppercase truncate">{req.socialName || req.studentName}</div>
                                                    <div className="flex gap-3 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                                        <span>{req.cpf}</span> <span className="text-slate-300">|</span> <span>Instrutor: {req.instructor || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => toggleAttendance(req)} className={`px-4 py-2 rounded-lg font-black text-xs uppercase transition-all flex items-center gap-2 ${req.attendanceConfirmed ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                                    {req.attendanceConfirmed ? <CheckCircle2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />} {req.attendanceConfirmed ? 'Confirmado' : 'Confirmar'}
                                                </button>
                                                <button onClick={() => handleWhatsApp(req)} className="p-2.5 bg-green-100 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"><MessageCircle className="h-5 w-5" /></button>
                                                <button onClick={() => handleRemoveStudent(req.id)} className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="h-5 w-5" /></button>
                                            </div>
                                        </div>
                                    ))}
                                    {students.length === 0 && <div className="text-center py-10 border-2 border-dashed rounded-xl text-gray-400 font-bold uppercase text-xs">Nenhum candidato agendado.</div>}
                                </div>

                                {/* TABELA DE IMPRESSÃO OFICIAL */}
                                <table className="hidden print:table w-full text-left border-collapse border-4 border-black">
                                    <thead>
                                        <tr className="bg-black text-white font-black text-[11px] uppercase tracking-wider">
                                            <th className="px-2 py-3 w-10 text-center border-r border-white">#</th>
                                            <th className="px-3 py-3 w-36 border-r border-white">CPF</th>
                                            <th className="px-3 py-3 border-r border-white">NOME DO CANDIDATO / INSTRUTOR</th>
                                            <th className="px-2 py-3 w-12 text-center border-r border-white">RES.</th>
                                            <th className="px-2 py-3 w-16 text-center border-r border-white">FALTOU</th>
                                            <th className="px-2 py-3 w-16 text-center border-r border-white">APTO</th>
                                            <th className="px-2 py-3 w-16 text-center">INAPTO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-black">
                                        {students.map((req, idx) => (
                                            <tr key={req.id} className="border-b-2 border-black">
                                                <td className="px-2 py-2 text-center font-black border-r-2 border-black text-sm">{idx + 1}</td>
                                                <td className="px-3 py-2 font-black text-sm border-r-2 border-black whitespace-nowrap">{req.cpf}</td>
                                                <td className="px-3 py-2 border-r-2 border-black">
                                                    <div className="font-black uppercase text-[13px] leading-tight">{req.socialName || req.studentName}</div>
                                                    <div className="text-[9px] font-bold text-black/60 uppercase mt-0.5">INSTR: {req.instructor || '-'} | PLACA: {req.vehiclePlate || '-'}</div>
                                                </td>
                                                <td className="px-2 py-2 text-center font-black text-[10px] border-r-2 border-black">{req.cnhRestriction || '-'}</td>
                                                <td className="px-2 py-2 border-r-2 border-black"><div className="w-6 h-6 border-2 border-black mx-auto rounded-sm"></div></td>
                                                <td className="px-2 py-2 border-r-2 border-black"><div className="w-6 h-6 border-2 border-black mx-auto rounded-sm"></div></td>
                                                <td className="px-2 py-2"><div className="w-6 h-6 border-2 border-black mx-auto rounded-sm"></div></td>
                                            </tr>
                                        ))}
                                        {students.length === 0 && (
                                            <tr><td colSpan={7} className="p-8 text-center font-black uppercase text-gray-400">Sem candidatos agendados para esta categoria.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}

                    {/* ÁREA DE ASSINATURA (SÓ IMPRESSÃO) */}
                    <div className="hidden print:block mt-20 break-inside-avoid">
                        <div className="grid grid-cols-2 gap-20">
                            <div className="flex flex-col items-center">
                                <div className="w-full border-b-4 border-black mb-2"></div>
                                <span className="text-[10px] font-black uppercase">Assinatura do Examinador 01</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="w-full border-b-4 border-black mb-2"></div>
                                <span className="text-[10px] font-black uppercase">Assinatura do Examinador 02</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-center mt-12">
                            <div className="w-72 border-b-4 border-black mb-2"></div>
                            <span className="text-[10px] font-black uppercase">Visto Supervisão de Bancas</span>
                        </div>
                    </div>
                </div>

                <div className="hidden print:flex fixed bottom-0 left-0 w-full border-t-4 border-black bg-white p-4 justify-between items-center text-[9px] font-black uppercase">
                    <div>{settings?.agencyName} - SISTEMA PRÁTICOSYS</div>
                    <div>DATA IMPRESSÃO: {new Date().toLocaleString('pt-BR')}</div>
                    <div>PÁGINA 1 DE 1</div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: NOVA BANCA */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <h3 className="text-xl font-black uppercase tracking-tight">{editingSchedule ? 'Editar Banca' : 'Nova Banca'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform"><X className="h-7 w-7" /></button>
                  </div>
                  <form onSubmit={handleSaveSchedule} className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Data da Prova</label>
                            <input required type="date" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-gray-900 bg-slate-50" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Horário Início</label>
                            <input required type="time" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold text-gray-900 bg-slate-50" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
                          </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-xs">Cancelar</button>
                          <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-sm shadow-xl shadow-blue-200">Salvar Banca</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: ADICIONAR ESTUDANTE */}
      {isAddStudentOpen && selectedSchedule && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-6 border-b">
                      <h3 className="text-xl font-black uppercase text-slate-800">Agendar Candidatos</h3>
                      <button onClick={() => setIsAddStudentOpen(false)}><X className="h-6 w-6 text-slate-400 hover:text-slate-600" /></button>
                  </div>
                  <div className="p-6 bg-slate-50 border-b">
                      <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input type="text" placeholder="Buscar por Nome ou CPF..." className="w-full pl-12 pr-4 py-3 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold" value={studentSearch} onChange={e => setSearchTermInput(e.target.value)} />
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                          <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                              <div className="flex items-center gap-3"><Bike className="h-5 w-5" /> <span className="font-black uppercase text-sm">Categoria A (Moto)</span></div>
                              <span className="text-[10px] font-black uppercase bg-blue-600 px-2 py-1 rounded">{remainingA} vagas restantes</span>
                          </div>
                          <div className="p-2 space-y-1">
                              {candidatesA.map(cand => (
                                  <label key={cand.id} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border-2 transition-all ${selectedCandidates[cand.id] === 'A' ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-slate-50'}`}>
                                      <input type="checkbox" className="hidden" disabled={!selectedCandidates[cand.id] && remainingA <= 0} checked={selectedCandidates[cand.id] === 'A'} onChange={() => toggleCandidateSelection(cand.id, 'A')} />
                                      {selectedCandidates[cand.id] === 'A' ? <CheckSquare className="h-6 w-6 text-blue-600" /> : <Square className="h-6 w-6 text-slate-300" />}
                                      <div className="flex-1">
                                          <div className="font-black uppercase text-slate-800">{cand.studentName}</div>
                                          <div className="text-[10px] font-bold text-slate-400">CPF: {cand.cpf} • Cadastro: {new Date(cand.createdAt).toLocaleDateString()}</div>
                                      </div>
                                  </label>
                              ))}
                              {candidatesA.length === 0 && <div className="p-8 text-center text-slate-400 uppercase font-black text-[10px]">Nenhum candidato em espera.</div>}
                          </div>
                      </div>

                      <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                          <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                              <div className="flex items-center gap-3"><Car className="h-5 w-5" /> <span className="font-black uppercase text-sm">Categoria B (Carro)</span></div>
                              <span className="text-[10px] font-black uppercase bg-green-600 px-2 py-1 rounded">{remainingB} vagas restantes</span>
                          </div>
                          <div className="p-2 space-y-1">
                              {candidatesB.map(cand => (
                                  <label key={cand.id} className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer border-2 transition-all ${selectedCandidates[cand.id] === 'B' ? 'border-green-500 bg-green-50' : 'border-transparent hover:bg-slate-50'}`}>
                                      <input type="checkbox" className="hidden" disabled={!selectedCandidates[cand.id] && remainingB <= 0} checked={selectedCandidates[cand.id] === 'B'} onChange={() => toggleCandidateSelection(cand.id, 'B')} />
                                      {selectedCandidates[cand.id] === 'B' ? <CheckSquare className="h-6 w-6 text-green-600" /> : <Square className="h-6 w-6 text-slate-300" />}
                                      <div className="flex-1">
                                          <div className="font-black uppercase text-slate-800">{cand.studentName}</div>
                                          <div className="text-[10px] font-bold text-slate-400">CPF: {cand.cpf} • Cadastro: {new Date(cand.createdAt).toLocaleDateString()}</div>
                                      </div>
                                  </label>
                              ))}
                              {candidatesB.length === 0 && <div className="p-8 text-center text-slate-400 uppercase font-black text-[10px]">Nenhum candidato em espera.</div>}
                          </div>
                      </div>
                  </div>
                  <div className="p-6 border-t bg-slate-50 flex justify-end gap-4">
                      <button onClick={() => setIsAddStudentOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-xs">Cancelar</button>
                      <button onClick={handleConfirmBatchSchedule} disabled={Object.keys(selectedCandidates).length === 0} className="px-10 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-sm shadow-xl shadow-blue-200 disabled:opacity-50">Confirmar Seleção ({Object.keys(selectedCandidates).length})</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SchedulingCenter;
