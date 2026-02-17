
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
  CheckCircle
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

  const injectEmojis = (text: string) => {
    const emojiMap: Record<string, string> = {
      '[WAVE]': '👋',
      '[SMILE]': '😊',
      '[CAR]': '🚗',
      '[CALENDAR]': '📅',
      '[CLOCK]': '⏰',
      '[MAP]': '📍',
      '[WARNING]': '⚠️',
      '[ID]': '🪪',
      '[CAR_FRONT]': '🚘',
      '[CHECK]': '✅',
      '[HOURGLASS]': '⏳'
    };

    let result = text;
    
    // LIMPEZA AGRESSIVA DE CARACTERES CORROMPIDOS
    // Remove especificamente o (U+FFFD) e qualquer sequência estranha comum
    result = result.replace(/\uFFFD/g, '');

    // Substitui as tags de texto pelos emojis reais
    Object.entries(emojiMap).forEach(([tag, emoji]) => {
      result = result.split(tag).join(emoji);
    });

    return result;
  };

  const handleWhatsApp = (req: ExamRequest) => {
    if (!settings || !selectedSchedule) return;
    
    const template = settings.whatsappMessageTemplate || '';
    
    const replacements: Record<string, string> = {
      '{CANDIDATO}': req.socialName || req.studentName || '',
      '{CATEGORIA}': req.scheduledCategory || req.intendedCategory || '-',
      '{DATA}': formatDateDisplay(selectedSchedule.date),
      '{HORA}': selectedSchedule.time,
      '{ENDERECO}': settings.defaultExamAddress || '',
      '{AGENCIA}': settings.agencyName || 'Detran'
    };

    let finalMessage = template;
    
    // 1. Substitui variáveis do sistema
    Object.entries(replacements).forEach(([tag, value]) => {
      finalMessage = finalMessage.split(tag).join(value);
    });
    
    // 2. Injeta os emojis reais E LIMPA O 
    finalMessage = injectEmojis(finalMessage);
    
    const phoneDigits = req.phone.replace(/\D/g, '');
    const finalPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    
    // 3. Encode final para URL
    const whatsappUrl = `https://wa.me/${finalPhone}?text=${encodeURIComponent(finalMessage)}`;
    window.open(whatsappUrl, '_blank');
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
                            <span className="truncate">{s.examinerIds.length > 0 ? s.examinerIds.map(id => getExaminerName(id)).join(', ') : 'Sem examinador'}</span>
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
        /* VISUALIZAÇÃO DA BANCA SELECIONADA */
        <div className="space-y-6 animate-fadeIn">
            {/* Toolbar */}
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

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden print:shadow-none print:border-none print:bg-white print:block">
                {/* Cabeçalho de Impressão e UI */}
                <div className="p-8 bg-slate-900 text-white print:bg-white print:p-0 print:!text-black">
                    <div className="hidden print:flex items-center gap-6 border-b-2 border-black pb-4 mb-3">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} className="h-16 w-auto" />
                        ) : (
                            <div className="h-16 w-16 bg-red-600 flex items-center justify-center text-white font-black text-xs print:!text-black">DETRAN</div>
                        )}
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight print:!text-black">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                            <h2 className="text-2xl font-black uppercase print:!text-black">LISTA DE CHAMADA - {selectedSchedule.type === ExamType.PCD ? 'PCD' : '1ª HABILITAÇÃO'}</h2>
                        </div>
                    </div>

                    <div className="hidden print:flex justify-between items-center border-b-2 border-black pb-1 mb-2 print:!text-black">
                        <div className="flex gap-8">
                            <span className="text-sm uppercase font-bold">DATA: <span className="font-normal">{formatDateDisplay(selectedSchedule.date)}</span></span>
                            <span className="text-sm uppercase font-bold">HORA: <span className="font-normal">{selectedSchedule.time}</span></span>
                        </div>
                        <span className="text-sm uppercase font-bold">EXAMINADORES: <span className="font-normal">{selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span></span>
                    </div>

                    <div className="print:hidden">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-3xl font-black text-white">{formatDateDisplay(selectedSchedule.date)}</h2>
                            <StatusBadge status={selectedSchedule.status} />
                        </div>
                        <div className="flex flex-wrap gap-6 text-sm opacity-80 font-medium uppercase tracking-wider text-white">
                            <span className="flex items-center gap-2"><Clock className="h-5 w-5" /> {selectedSchedule.time}</span>
                            <span className="flex items-center gap-2"><User className="h-5 w-5" /> {selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-12 print:p-0">
                    {['A', 'B'].map(cat => {
                        const students = scheduledStudents.filter(s => s.scheduledCategory === cat);
                        if (students.length === 0 && selectedSchedule.status !== 'OPEN') return null;
                        
                        return (
                            <div key={cat} className="break-inside-avoid print:mb-2 mb-4">
                                <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-2 mb-6 print:border-black print:!text-black">
                                    <div className="bg-blue-600 text-white p-2 rounded-lg print:hidden">
                                        <Layers className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-2xl font-black uppercase print:text-sm print:font-black">Categoria {cat}</h3>
                                    <span className="text-sm font-bold text-gray-400 ml-auto print:hidden">
                                        {students.length} candidatos agendados
                                    </span>
                                </div>

                                {/* LISTA CLEAN (Apenas Web - SEM as colunas de marcação) */}
                                <div className="space-y-3 print:hidden">
                                    {students.map((req, idx) => (
                                        <div key={req.id} className={`flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl border-2 transition-all hover:border-blue-200 bg-white ${req.attendanceConfirmed ? 'border-green-100 bg-green-50/20' : 'border-gray-100'}`}>
                                            <div className="flex items-center gap-4 flex-1 w-full">
                                                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-lg font-black text-slate-900 uppercase truncate">
                                                        {req.socialName || req.studentName}
                                                    </div>
                                                    <div className="flex gap-3 text-xs font-bold text-slate-500 uppercase tracking-tighter">
                                                        <span>{req.cpf}</span>
                                                        <span className="text-slate-300">|</span>
                                                        <span>Instrutor: {req.instructor || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Botão Confirmação */}
                                                <button 
                                                    onClick={() => toggleAttendance(req)}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-xs uppercase transition-all ${req.attendanceConfirmed ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                                    title="Confirmar Presença/Agendamento"
                                                >
                                                    {req.attendanceConfirmed ? <CheckCircle2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                                    {req.attendanceConfirmed ? 'Confirmado' : 'Confirmar'}
                                                </button>

                                                {/* Botão WhatsApp */}
                                                <button 
                                                    onClick={() => handleWhatsApp(req)}
                                                    className="p-2.5 bg-green-100 text-green-600 hover:bg-green-600 hover:text-white rounded-lg transition-all"
                                                    title="Enviar mensagem WhatsApp"
                                                >
                                                    <MessageCircle className="h-5 w-5" />
                                                </button>

                                                <div className="w-px h-6 bg-slate-200 mx-1"></div>

                                                <button 
                                                    onClick={() => handleRemoveStudent(req.id)}
                                                    className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Remover da Banca"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {students.length === 0 && (
                                        <div className="text-center py-10 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 font-bold uppercase text-xs">
                                            Nenhum candidato nesta categoria.
                                        </div>
                                    )}
                                </div>

                                {/* TABELA ORIGINAL (Apenas Impressão - COM as colunas de marcação) */}
                                <table className="hidden print:table w-full text-left border-collapse border-2 border-black">
                                    <thead>
                                        <tr className="bg-white text-black font-black border-b-2 border-black text-[9px]">
                                            <th className="px-2 py-1 w-10 text-center border-r border-black uppercase">#</th>
                                            <th className="px-3 py-1 w-32 border-r border-black uppercase">CPF</th>
                                            <th className="px-3 py-1 border-r border-black uppercase">Nome do Candidato</th>
                                            <th className="px-3 py-1 w-20 text-center border-r border-black uppercase">Restr.</th>
                                            <th className="px-2 py-1 w-14 text-center border-r border-black uppercase">Faltou</th>
                                            <th className="px-2 py-1 w-14 text-center border-r border-black uppercase">Apto</th>
                                            <th className="px-2 py-1 w-14 text-center uppercase">Inapto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-black">
                                        {students.map((req, idx) => (
                                            <tr key={req.id} className="border-b-2 border-black print:!text-black">
                                                <td className="px-2 py-1 text-center font-black border-r border-black text-[11px]">{idx + 1}</td>
                                                <td className="px-3 py-1 font-black text-[12px] border-r border-black">{req.cpf}</td>
                                                <td className="px-3 py-1 font-black uppercase text-[12px] border-r border-black truncate">{req.socialName || req.studentName}</td>
                                                <td className="px-3 py-1 text-center font-bold text-[10px] border-r border-black">{req.cnhRestriction || '-'}</td>
                                                <td className="px-2 py-1 border-r border-black"><div className="w-5 h-5 border-2 border-black mx-auto rounded-sm"></div></td>
                                                <td className="px-2 py-1 border-r border-black"><div className="w-5 h-5 border-2 border-black mx-auto rounded-sm"></div></td>
                                                <td className="px-2 py-1"><div className="w-5 h-5 border-2 border-black mx-auto rounded-sm"></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>

                {/* Assinatura do Examinador (Print Only) */}
                <div className="hidden print:flex flex-col items-center mt-10 mb-20 break-inside-avoid">
                    <div className="w-96 border-b-2 border-black mb-2"></div>
                    <span className="text-sm font-black uppercase tracking-widest text-black">Assinatura do Examinador</span>
                </div>

                {/* Rodapé Institucional (Print Only) */}
                <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-4 px-10 justify-between items-center text-[10px] font-black text-black">
                    <div className="uppercase">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                    <div>IMPRESSÃO: {new Date().toLocaleString()}</div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: NOVA BANCA */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/20">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <h3 className="text-xl font-black uppercase tracking-tight">{editingSchedule ? 'Editar Banca' : 'Nova Banca'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform"><X className="h-7 w-7" /></button>
                  </div>
                  <form onSubmit={handleSaveSchedule} className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 text-gray-400">Data da Prova</label>
                            <input required type="date" className="w-full border-2 border-slate-100 rounded-xl p-3 focus:border-blue-500 transition-colors bg-slate-50 font-bold text-gray-900" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 text-gray-400">Horário Início</label>
                            <input required type="time" className="w-full border-2 border-slate-100 rounded-xl p-3 focus:border-blue-500 transition-colors bg-slate-50 font-bold text-gray-900" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 text-gray-400">Escalar Examinadores (Máx 3)</label>
                          <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-slate-50 rounded-2xl p-4 bg-slate-50/50">
                              {examiners.map(ex => (
                                  <label key={ex.id} className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-all ${scheduleForm.examinerIds.includes(ex.id) ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-700'}`}>
                                      <input type="checkbox" className="hidden" checked={scheduleForm.examinerIds.includes(ex.id)} onChange={(e) => {
                                            const ids = e.target.checked ? [...scheduleForm.examinerIds, ex.id].slice(0, 3) : scheduleForm.examinerIds.filter(id => id !== ex.id);
                                            setScheduleForm({...scheduleForm, examinerIds: ids});
                                      }} />
                                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${scheduleForm.examinerIds.includes(ex.id) ? 'border-white bg-white' : 'border-slate-300'}`}>
                                          {scheduleForm.examinerIds.includes(ex.id) && <div className="h-2 w-2 rounded-full bg-blue-600"></div>}
                                      </div>
                                      <span className="text-sm font-black uppercase">{ex.name}</span>
                                  </label>
                              ))}
                          </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-xs">Cancelar</button>
                          <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-sm shadow-xl shadow-blue-200 hover:scale-105 active:scale-95 transition-all">Salvar Banca</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: ADICIONAR ESTUDANTE */}
      {isAddStudentOpen && selectedSchedule && (
          <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden border border-white/20">
                  <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
                      <h3 className="text-xl font-black uppercase tracking-tight">Agendar Candidatos</h3>
                      <button onClick={() => setIsAddStudentOpen(false)} className="hover:rotate-90 transition-transform"><X className="h-7 w-7" /></button>
                  </div>
                  <div className="p-6 bg-slate-50 border-b">
                      <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <input type="text" placeholder="Buscar por nome ou CPF..." className="w-full pl-12 pr-4 py-4 border-2 border-slate-100 rounded-2xl focus:border-blue-500 font-bold text-gray-900" value={studentSearch} onChange={e => setSearchTermInput(e.target.value)} />
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {availableStudents.map(s => (
                          <div key={s.id} className="flex items-center justify-between p-4 hover:bg-blue-50 rounded-2xl border-2 border-transparent transition-all hover:border-blue-100">
                              <div>
                                  <div className="font-black text-slate-900 uppercase">{s.studentName}</div>
                                  <div className="text-xs font-bold text-slate-400">{s.cpf} • {s.intendedCategory || 'B'}</div>
                              </div>
                              <button onClick={() => handleAddStudent(s.id, s.intendedCategory || 'B')} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-100">Selecionar</button>
                          </div>
                      ))}
                      {availableStudents.length === 0 && (
                          <div className="text-center py-20 text-slate-300 font-black uppercase text-sm">Nenhum candidato aguardando agendamento.</div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SchedulingCenter;
