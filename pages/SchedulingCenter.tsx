
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
  Hourglass,
  Users,
  Loader2,
  Layers
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
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearch, setSearchTermInput] = useState('');

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
                        <StatusBadge status={s.status} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{formatDateDisplay(s.date)}</h3>
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
                        <Clock className="h-4 w-4" /> {s.time}
                        <span className="mx-1 text-gray-300">•</span>
                        <span className="text-[10px] font-medium text-gray-400 uppercase">{s.type === ExamType.PCD ? 'PCD' : 'Geral'}</span>
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
                         <button onClick={(e) => { e.stopPropagation(); handleOpenModal(s); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                            <Edit2 className="h-4 w-4" />
                         </button>
                         {s.status !== 'CANCELLED' && (
                             <button onClick={(e) => { e.stopPropagation(); handleCancelSchedule(s.id); }} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                                <Ban className="h-4 w-4" />
                             </button>
                         )}
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
                <button onClick={() => setSelectedSchedule(null)} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium transition-colors">
                    <ChevronRight className="h-4 w-4 rotate-180" /> Voltar para a lista
                </button>
                <div className="flex gap-2">
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 bg-white shadow-sm text-sm font-bold">
                        <Printer className="h-4 w-4" /> Imprimir Lista
                    </button>
                    {selectedSchedule.status === 'OPEN' && (
                        <button onClick={() => setIsAddStudentOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md text-sm font-bold">
                            <Plus className="h-4 w-4" /> Agendar Candidato
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden print:shadow-none print:border-none print:bg-white print:min-h-[290mm] print:flex print:flex-col">
                {/* Cabeçalho de Impressão */}
                <div className="p-6 bg-slate-900 text-white print:bg-white print:!text-black print:p-0">
                    <div className="hidden print:flex items-center gap-6 border-b-2 border-black pb-4 mb-3">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} className="h-16 w-auto" />
                        ) : (
                            <div className="h-16 w-16 bg-red-600 flex items-center justify-center text-white font-black text-xs print:!text-black">DETRAN</div>
                        )}
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight print:!text-black">{settings?.agencyName || 'AGÊNCIA REGIONAL DE BALNEÁRIO CAMBORIÚ - SETOR CNH'}</h1>
                            <h2 className="text-2xl font-black uppercase print:!text-black">LISTA DE CHAMADA - {selectedSchedule.type === ExamType.PCD ? 'PCD' : '1ª HABILITAÇÃO'}</h2>
                        </div>
                    </div>

                    {/* Meta Data Line */}
                    <div className="hidden print:flex justify-between items-center border-b-2 border-black pb-1 mb-2">
                        <div className="flex gap-8 print:!text-black">
                            <span className="text-sm uppercase font-bold">DATA: <span className="font-normal">{formatDateDisplay(selectedSchedule.date)}</span></span>
                            <span className="text-sm uppercase font-bold">HORA: <span className="font-normal">{selectedSchedule.time}</span></span>
                        </div>
                        <span className="text-sm uppercase font-bold print:!text-black">EXAMINADORES: <span className="font-normal">{selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span></span>
                    </div>

                    {/* UI Only View Header */}
                    <div className="print:hidden">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold">{formatDateDisplay(selectedSchedule.date)}</h2>
                            <StatusBadge status={selectedSchedule.status} />
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm opacity-80">
                            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {selectedSchedule.time}</span>
                            <span className="flex items-center gap-1"><User className="h-4 w-4" /> {selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-2 print:p-0 print:flex-1">
                    {['A', 'B'].map(cat => {
                        const students = scheduledStudents.filter(s => s.scheduledCategory === cat);
                        if (students.length === 0 && selectedSchedule.status !== 'OPEN') return null;
                        return (
                            <div key={cat} className="break-inside-avoid print:mb-12 mb-4">
                                <div className="flex items-center gap-2 border-b-2 border-gray-100 pb-0.5 mb-2 print:border-black print:!text-black">
                                    <Layers className="h-4 w-4 text-gray-400 print:!text-black" />
                                    <h3 className="text-lg font-bold uppercase print:text-sm print:font-black">Categoria {cat}</h3>
                                </div>

                                <table className="w-full text-sm text-left border-collapse print:border-2 print:border-black">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600 print:bg-white print:border-b-2 print:border-black print:!text-black">
                                            <th className="px-2 py-2 print:py-0.5 w-8 text-center font-bold border-r border-black">#</th>
                                            <th className="px-3 py-2 print:py-0.5 font-bold border-r border-black w-28">CPF</th>
                                            <th className="px-3 py-2 print:py-0.5 font-bold border-r border-black">Nome</th>
                                            <th className="px-3 py-2 print:py-0.5 font-bold border-r border-black w-20">Restrição</th>
                                            <th className="px-1 py-2 print:py-0.5 text-center font-bold border-r border-black w-12">Faltou</th>
                                            <th className="px-1 py-2 print:py-0.5 text-center font-bold border-r border-black w-12">Apto</th>
                                            <th className="px-1 py-2 print:py-0.5 text-center font-bold w-12">Inapto</th>
                                            <th className="px-3 py-2 text-right print:hidden font-bold">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 print:divide-black">
                                        {students.map((req, idx) => (
                                            <tr key={req.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100 print:border-b-2 print:border-black print:!text-black">
                                                <td className="px-2 py-3 print:py-0.5 text-center font-bold text-gray-400 print:!text-black border-r print:border-black">{idx + 1}</td>
                                                <td className="px-3 py-3 print:py-0.5 font-mono text-gray-600 print:!text-black border-r print:border-black text-xs">{req.cpf}</td>
                                                <td className="px-3 py-3 print:py-0.5 border-r print:border-black">
                                                    <div className="font-bold text-gray-900 uppercase truncate text-[11px] print:text-[10px] print:!text-black leading-tight">{req.socialName || req.studentName}</div>
                                                </td>
                                                <td className="px-3 py-3 print:py-0.5 text-center border-r print:border-black text-[10px] print:!text-black">{req.cnhRestriction || '-'}</td>
                                                <td className="px-1 py-3 print:py-0.5 border-r print:border-black">
                                                    <div className="flex justify-center"><div className="w-4 h-4 border-2 border-black rounded-sm print:border-2"></div></div>
                                                </td>
                                                <td className="px-1 py-3 print:py-0.5 border-r print:border-black">
                                                    <div className="flex justify-center"><div className="w-4 h-4 border-2 border-black rounded-sm print:border-2"></div></div>
                                                </td>
                                                <td className="px-1 py-3 print:py-0.5">
                                                    <div className="flex justify-center"><div className="w-4 h-4 border-2 border-black rounded-sm print:border-2"></div></div>
                                                </td>
                                                <td className="px-3 py-3 text-right print:hidden">
                                                    <button onClick={() => handleRemoveStudent(req.id)} className="p-2 text-red-400 hover:text-red-600 rounded-full">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {students.length === 0 && (
                                            <tr><td colSpan={8} className="px-4 py-4 text-center text-gray-400 italic print:!text-black">Nenhum candidato agendado.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>

                {/* Campo de Assinatura do Examinador (Print Only - Sempre no rodapé) */}
                <div className="hidden print:flex flex-col items-center mt-auto mb-16 pt-10">
                    <div className="w-80 border-b-2 border-black mb-1"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-black">Assinatura do Examinador</span>
                </div>

                {/* Rodapé de Impressão Institucional */}
                <div className="hidden print:flex absolute bottom-0 left-0 w-full bg-white border-t-2 border-black pt-1 pb-2 px-10 justify-between items-center text-[9px] font-bold text-black print:!text-black">
                    <div className="uppercase">{settings?.agencyAddress || 'AV. DO ESTADO DALMO VIEIRA, 4281 - CENTRO, BALNEÁRIO CAMBORIÚ - SC'}</div>
                    <div>Impressão: {new Date().toLocaleDateString()}</div>
                </div>
            </div>
        </div>
      )}

      {/* MODAIS (Inalterados) */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <h3 className="text-xl font-bold">{editingSchedule ? 'Editar Banca' : 'Nova Banca'}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X className="h-6 w-6" /></button>
                  </div>
                  <form onSubmit={handleSaveSchedule} className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label><input required type="date" className="w-full border rounded-lg p-3 bg-gray-50 text-gray-900" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} /></div>
                          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hora</label><input required type="time" className="w-full border rounded-lg p-3 bg-gray-50 text-gray-900" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} /></div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Examinadores</label>
                          <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                              {examiners.map(ex => (
                                  <label key={ex.id} className="flex items-center gap-3 cursor-pointer p-1">
                                      <input type="checkbox" checked={scheduleForm.examinerIds.includes(ex.id)} onChange={(e) => {
                                            const ids = e.target.checked ? [...scheduleForm.examinerIds, ex.id].slice(0, 3) : scheduleForm.examinerIds.filter(id => id !== ex.id);
                                            setScheduleForm({...scheduleForm, examinerIds: ids});
                                      }} className="h-4 w-4 text-blue-600" />
                                      <span className="text-sm text-gray-700">{ex.name}</span>
                                  </label>
                              ))}
                          </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-gray-500">Cancelar</button>
                          <button type="submit" className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-lg">Salvar</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {isAddStudentOpen && selectedSchedule && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
                  <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                      <h3 className="text-xl font-bold">Agendar Candidatos</h3>
                      <button onClick={() => setIsAddStudentOpen(false)}><X className="h-6 w-6" /></button>
                  </div>
                  <div className="p-6 bg-gray-50 border-b">
                      <input type="text" placeholder="Buscar por nome ou CPF..." className="w-full px-4 py-3 border rounded-xl" value={studentSearch} onChange={e => setSearchTermInput(e.target.value)} />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {availableStudents.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-4 hover:bg-blue-50 rounded-xl">
                              <div>
                                  <div className="font-bold text-gray-900 uppercase">{s.studentName}</div>
                                  <div className="text-xs text-gray-500">{s.cpf}</div>
                              </div>
                              <button onClick={() => handleAddStudent(s.id, s.intendedCategory || 'B')} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Selecionar</button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SchedulingCenter;
