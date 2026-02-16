
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
  CheckSquare, 
  Printer, 
  Trash2, 
  Edit2, 
  AlertTriangle, 
  CheckCircle, 
  Filter, 
  Ban, 
  Hourglass,
  MoreVertical,
  Users,
  // Added Loader2 to fix compilation error
  Loader2
} from 'lucide-react';

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

interface SchedulingCenterProps {
  type?: ExamType;
}

const SchedulingCenter: React.FC<SchedulingCenterProps> = ({ type }) => {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [allRequests, setAllRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [selectedSchedule, setSelectedSchedule] = useState<ExamSchedule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // Form State
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
    try {
      if (editingSchedule) {
        await api.updateSchedule(editingSchedule.id, scheduleForm);
      } else {
        await api.createSchedule({ ...scheduleForm, status: 'OPEN' });
      }
      setIsModalOpen(false);
      refreshData();
    } catch (e) {
      alert("Erro ao salvar banca.");
    }
  };

  const handleCancelSchedule = async (id: string) => {
    const reason = prompt("Informe o motivo do cancelamento:");
    if (reason) {
      await api.cancelSchedule(id, reason);
      refreshData();
    }
  };

  const handleAddStudent = async (requestId: string, category: string) => {
    if (!selectedSchedule) return;
    await api.assignStudentToSchedule(requestId, selectedSchedule.id, category);
    refreshData();
  };

  const handleRemoveStudent = async (requestId: string) => {
    await api.removeStudentFromSchedule(requestId);
    refreshData();
  };

  const getExaminerName = (id: string) => examiners.find(e => e.id === id)?.name || 'Desconhecido';

  const filteredSchedules = schedules.filter(s => {
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesSearch = s.date.includes(searchTerm) || s.examinerIds.some(id => getExaminerName(id).toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const scheduledStudents = allRequests.filter(r => r.scheduleId === selectedSchedule?.id);
  
  const availableStudents = allRequests.filter(r => 
    r.status === ExamStatus.WAITING_SCHEDULING && 
    r.examType === selectedSchedule?.type &&
    (r.studentName.toLowerCase().includes(studentSearch.toLowerCase()) || r.cpf.includes(studentSearch))
  );

  if (loading) return <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-4">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    Carregando Central de Bancas...
  </div>;

  return (
    <div className="space-y-6">
      {!selectedSchedule ? (
        <>
          {/* Main View: List of Schedules */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Agendamentos - {type === ExamType.PCD ? 'PCD' : 'Comum'}</h2>
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar data ou examinador..." 
                        className="w-full pl-10 pr-4 py-2 border rounded-md text-sm bg-white text-gray-900"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                    className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="ALL">Todos os Status</option>
                    <option value="OPEN">Abertas</option>
                    <option value="CLOSED">Fechadas</option>
                    <option value="CONCLUDED">Concluídas</option>
                    <option value="CANCELLED">Canceladas</option>
                </select>
                <button 
                  onClick={() => handleOpenModal()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm font-bold"
                >
                  <Plus className="h-4 w-4" /> Nova Banca
                </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.map(s => {
              const studentsCount = allRequests.filter(r => r.scheduleId === s.id).length;
              const isFull = studentsCount >= (s.maxSlotsA + s.maxSlotsB);

              return (
                <div 
                  key={s.id} 
                  className={`bg-white rounded-xl border-2 transition-all hover:shadow-lg cursor-pointer group relative flex flex-col ${s.status === 'CANCELLED' ? 'border-red-100 opacity-75' : 'border-transparent shadow-sm'}`}
                  onClick={() => setSelectedSchedule(s)}
                >
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-2 rounded-lg ${s.status === 'CANCELLED' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                            <Calendar className="h-6 w-6" />
                        </div>
                        <CountdownTimer schedule={s} />
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{formatDateDisplay(s.date)}</h3>
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
                        <Clock className="h-4 w-4" /> {s.time}
                        <span className="mx-1">•</span>
                        <span className={`font-bold ${s.type === ExamType.PCD ? 'text-purple-600' : 'text-blue-600'}`}>{s.type}</span>
                    </div>

                    <div className="space-y-2 border-t pt-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <User className="h-4 w-4 opacity-50" />
                            <span className="truncate">{s.examinerIds.length > 0 ? getExaminerName(s.examinerIds[0]) : 'Sem examinador'}</span>
                            {s.examinerIds.length > 1 && <span className="text-[10px] bg-gray-100 px-1 rounded">+{s.examinerIds.length - 1}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users className="h-4 w-4 opacity-50" />
                            <span>{studentsCount} candidatos agendados</span>
                        </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-5 py-3 border-t flex justify-between items-center rounded-b-xl">
                      <div className="flex gap-4 text-[10px] font-black uppercase text-gray-400">
                          <span>Moto: {allRequests.filter(r => r.scheduleId === s.id && r.scheduledCategory === 'A').length}/{s.maxSlotsA}</span>
                          <span>Carro: {allRequests.filter(r => r.scheduleId === s.id && r.scheduledCategory === 'B').length}/{s.maxSlotsB}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(s); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                         >
                            <Edit2 className="h-4 w-4" />
                         </button>
                         {s.status !== 'CANCELLED' && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); handleCancelSchedule(s.id); }}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                             >
                                <Ban className="h-4 w-4" />
                             </button>
                         )}
                      </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {filteredSchedules.length === 0 && (
              <div className="bg-white p-12 rounded-xl border border-dashed text-center space-y-3">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto" />
                  <p className="text-gray-500">Nenhuma banca encontrada com estes critérios.</p>
                  <button onClick={() => handleOpenModal()} className="text-blue-600 font-bold hover:underline">Criar a primeira banca</button>
              </div>
          )}
        </>
      ) : (
        /* Detailed View: Inside a Banca */
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between print:hidden">
                <button 
                    onClick={() => setSelectedSchedule(null)}
                    className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium transition-colors"
                >
                    <ChevronRight className="h-4 w-4 rotate-180" /> Voltar para a lista
                </button>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 bg-white shadow-sm text-sm font-bold">
                        <Printer className="h-4 w-4" /> Imprimir Lista
                    </button>
                    {selectedSchedule.status === 'OPEN' && (
                        <button 
                            onClick={() => setIsAddStudentOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md text-sm font-bold"
                        >
                            <Plus className="h-4 w-4" /> Agendar Candidato
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden print:shadow-none print:border-none">
                {/* Header para Impressão e UI */}
                <div className="p-6 bg-slate-900 text-white print:bg-white print:text-black print:border-b-2 print:border-black print:p-0 print:mb-6">
                    <div className="hidden print:flex items-center gap-6 mb-4 border-b-2 border-black pb-4">
                        {settings?.logoUrl && <img src={settings.logoUrl} className="h-20 w-auto" />}
                        <div className="flex-1 text-center">
                            <h1 className="text-lg font-black uppercase leading-tight">{settings?.agencyName || 'DETRAN'}</h1>
                            <h2 className="text-2xl font-black uppercase">LISTA DE CHAMADA - PROVA PRÁTICA</h2>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-2xl font-bold">{formatDateDisplay(selectedSchedule.date)}</h2>
                                <CountdownTimer schedule={selectedSchedule} />
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm opacity-80 print:text-black print:font-bold">
                                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {selectedSchedule.time}</span>
                                <span className="flex items-center gap-1"><User className="h-4 w-4" /> Examinador(es): {selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span>
                                <span className="flex items-center gap-1"><MoreVertical className="h-4 w-4" /> Tipo: {selectedSchedule.type}</span>
                            </div>
                        </div>
                        <div className="flex gap-4 text-center print:hidden">
                            <div className="bg-white/10 p-3 rounded-lg min-w-[100px]">
                                <p className="text-[10px] uppercase font-bold opacity-60">Moto (A)</p>
                                <p className="text-xl font-black">{scheduledStudents.filter(s => s.scheduledCategory === 'A').length}/{selectedSchedule.maxSlotsA}</p>
                            </div>
                            <div className="bg-white/10 p-3 rounded-lg min-w-[100px]">
                                <p className="text-[10px] uppercase font-bold opacity-60">Carro (B)</p>
                                <p className="text-xl font-black">{scheduledStudents.filter(s => s.scheduledCategory === 'B').length}/{selectedSchedule.maxSlotsB}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lists */}
                <div className="p-6 space-y-10 print:p-0">
                    {['A', 'B'].map(cat => {
                        const students = scheduledStudents.filter(s => s.scheduledCategory === cat);
                        if (students.length === 0 && selectedSchedule.status !== 'OPEN') return null;

                        return (
                            <div key={cat} className="break-inside-avoid">
                                <div className="flex justify-between items-end border-b-2 border-gray-100 pb-2 mb-4 print:border-black">
                                    <h3 className="text-xl font-black text-gray-800 uppercase print:text-lg">CATEGORIA {cat}</h3>
                                    <span className="text-xs font-bold text-gray-400 uppercase print:text-black">Total: {students.length} candidatos</span>
                                </div>

                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600 print:bg-white print:border-b print:border-black">
                                            <th className="px-4 py-3 w-10 text-center font-bold">#</th>
                                            <th className="px-4 py-3 font-bold">Candidato</th>
                                            <th className="px-4 py-3 font-bold">CPF</th>
                                            <th className="px-4 py-3 font-bold">Instrutor / Veículo</th>
                                            <th className="hidden print:table-cell px-2 py-3 text-center border font-bold border-black w-16">Faltou</th>
                                            <th className="hidden print:table-cell px-2 py-3 text-center border font-bold border-black w-16">Apto</th>
                                            <th className="hidden print:table-cell px-2 py-3 text-center border font-bold border-black w-16">Inapto</th>
                                            <th className="px-4 py-3 text-right print:hidden font-bold">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {students.map((req, idx) => (
                                            <tr key={req.id} className="hover:bg-gray-50 transition-colors print:border-b print:border-black">
                                                <td className="px-4 py-4 text-center font-bold text-gray-400">{idx + 1}</td>
                                                <td className="px-4 py-4">
                                                    <div className="font-bold text-gray-900 uppercase">{req.socialName || req.studentName}</div>
                                                    {req.socialName && <div className="text-[10px] text-gray-400 italic">Civil: {req.studentName}</div>}
                                                </td>
                                                <td className="px-4 py-4 font-mono text-gray-600">{req.cpf}</td>
                                                <td className="px-4 py-4 text-xs text-gray-500">
                                                    <div>{req.instructor || '-'}</div>
                                                    <div className="font-bold">{req.vehiclePlate || '-'}</div>
                                                </td>
                                                <td className="hidden print:table-cell border border-black"><div className="flex justify-center"><span className="w-5 h-5 border border-black block"></span></div></td>
                                                <td className="hidden print:table-cell border border-black"><div className="flex justify-center"><span className="w-5 h-5 border border-black block"></span></div></td>
                                                <td className="hidden print:table-cell border border-black"><div className="flex justify-center"><span className="w-5 h-5 border border-black block"></span></div></td>
                                                <td className="px-4 py-4 text-right print:hidden">
                                                    <button 
                                                        onClick={() => handleRemoveStudent(req.id)}
                                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                                        title="Remover da Banca"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {students.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 italic">Nenhum candidato agendado para esta categoria.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>

                {/* Print Footer */}
                <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white pt-12 pb-16 flex-col items-center">
                    <div className="mb-14 flex flex-col items-center">
                        <div className="w-80 border-b-2 border-black mb-2"></div>
                        <span className="font-bold text-[12px] uppercase tracking-widest">Assinatura do Examinador</span>
                    </div>
                    <div className="w-full border-t-[8px] border-black pt-6 flex flex-col items-center">
                        <div className="font-black uppercase text-[14px] mb-1">{settings?.agencyAddress}</div>
                        <div className="text-[10px] opacity-70">
                            Relatório gerado pelo PráticoSys em {new Date().toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: Create / Edit Schedule */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fadeIn">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <h3 className="text-xl font-bold">{editingSchedule ? 'Editar Banca' : 'Nova Banca de Prova'}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X className="h-6 w-6 opacity-70 hover:opacity-100" /></button>
                  </div>
                  <form onSubmit={handleSaveSchedule} className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data da Banca</label>
                              <input required type="date" className="w-full border rounded-lg p-3 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Horário de Início</label>
                              <input required type="time" className="w-full border rounded-lg p-3 bg-gray-50 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Examinadores (Selecione até 3)</label>
                          <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                              {examiners.filter(ex => !type || (type === ExamType.COMMON ? ex.canExamCommon : ex.canExamPCD)).map(ex => (
                                  <label key={ex.id} className="flex items-center gap-3 cursor-pointer p-1 hover:bg-white rounded transition-colors">
                                      <input 
                                        type="checkbox" 
                                        checked={scheduleForm.examinerIds.includes(ex.id)}
                                        onChange={(e) => {
                                            const ids = e.target.checked 
                                                ? [...scheduleForm.examinerIds, ex.id].slice(0, 3)
                                                : scheduleForm.examinerIds.filter(id => id !== ex.id);
                                            setScheduleForm({...scheduleForm, examinerIds: ids});
                                        }}
                                        className="h-4 w-4 text-blue-600 rounded"
                                      />
                                      <span className="text-sm text-gray-700">{ex.name}</span>
                                  </label>
                              ))}
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vagas Moto (A)</label>
                              <input type="number" className="w-full border rounded-lg p-3 bg-gray-50 text-gray-900" value={scheduleForm.maxSlotsA} onChange={e => setScheduleForm({...scheduleForm, maxSlotsA: parseInt(e.target.value)})} />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vagas Carro (B)</label>
                              <input type="number" className="w-full border rounded-lg p-3 bg-gray-50 text-gray-900" value={scheduleForm.maxSlotsB} onChange={e => setScheduleForm({...scheduleForm, maxSlotsB: parseInt(e.target.value)})} />
                          </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold">Cancelar</button>
                          <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg transition-all active:scale-95">
                              {editingSchedule ? 'Salvar Alterações' : 'Criar Banca'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: Add Student to Schedule */}
      {isAddStudentOpen && selectedSchedule && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden animate-fadeIn">
                  <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                      <div>
                          <h3 className="text-xl font-bold">Agendar Candidatos para a Banca</h3>
                          <p className="text-xs opacity-80">{formatDateDisplay(selectedSchedule.date)} às {selectedSchedule.time}</p>
                      </div>
                      <button onClick={() => setIsAddStudentOpen(false)}><X className="h-6 w-6" /></button>
                  </div>
                  
                  <div className="p-6 bg-gray-50 border-b">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <input 
                            type="text" 
                            autoFocus
                            placeholder="Buscar por nome ou CPF..." 
                            className="w-full pl-10 pr-4 py-3 border rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                          />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {availableStudents.map(s => {
                          const cat = s.intendedCategory || 'B';
                          const isFull = cat === 'A' 
                            ? scheduledStudents.filter(st => st.scheduledCategory === 'A').length >= selectedSchedule.maxSlotsA
                            : scheduledStudents.filter(st => st.scheduledCategory === 'B').length >= selectedSchedule.maxSlotsB;

                          return (
                              <div key={s.id} className="flex items-center justify-between p-4 hover:bg-blue-50 rounded-xl transition-colors group">
                                  <div className="flex items-center gap-4">
                                      <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${cat === 'A' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                          {cat}
                                      </div>
                                      <div>
                                          <div className="font-bold text-gray-900 uppercase">{s.socialName || s.studentName}</div>
                                          <div className="text-xs text-gray-500">{s.cpf} | {s.instructor || 'Sem instrutor'}</div>
                                      </div>
                                  </div>
                                  <button 
                                    disabled={isFull}
                                    onClick={() => handleAddStudent(s.id, cat)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm shadow transition-all ${isFull ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}`}
                                  >
                                      {isFull ? 'Vagas Esgotadas' : 'Selecionar'}
                                  </button>
                              </div>
                          );
                      })}
                      {availableStudents.length === 0 && (
                          <div className="p-10 text-center text-gray-400 flex flex-col items-center gap-2">
                              <AlertTriangle className="h-8 w-8" />
                              <p>Nenhum candidato aguardando agendamento para este tipo de prova.</p>
                          </div>
                      )}
                  </div>

                  <div className="p-4 bg-gray-50 border-t flex justify-end">
                      <button onClick={() => setIsAddStudentOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold">Fechar</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SchedulingCenter;
