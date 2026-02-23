
// Scheduling Center Page
import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, ExamSchedule, ExamType, Examiner, ExamStatus, SystemSettings, User, UserRole } from '../types';
import { 
  Calendar, 
  Clock, 
  User as UserIcon, 
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
  Car
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
  user: User;
}

const SchedulingCenter: React.FC<SchedulingCenterProps> = ({ type, user }) => {
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
  const [expandedCategories, setExpandedCategories] = useState<{A: boolean, B: boolean}>({ A: false, B: false });

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

  const handleDeleteSchedule = async (id: string) => {
    if (user.role !== UserRole.ADMIN) {
        alert("Somente administradores podem excluir bancas.");
        return;
    }
    if (window.confirm("Tem certeza que deseja EXCLUIR permanentemente esta banca? Esta ação não pode ser desfeita.")) {
        await api.deleteSchedule(id);
        refreshData();
    }
  };

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
      '[WAVE]': '\uD83D\uDC4B',       // 👋
      '[SMILE]': '\uD83D\uDE04',      // 😄
      '[CAR]': '\uD83D\uDE97',        // 🚗
      '[CALENDAR]': '\uD83D\uDCC5',   // 📅
      '[CLOCK]': '\u23F0',            // ⏰
      '[MAP]': '\uD83D\uDCCD',        // 📍
      '[WARNING]': '\u26A0\uFE0F',    // ⚠️
      '[ID]': '\uD83E\uDEAA',         // 🪪 
      '[CAR_FRONT]': '\uD83D\uDE98',  // 🚘
      '[CHECK]': '\u2705',            // ✅
      '[HOURGLASS]': '\u23F3',        // ⏳
      '[PHONE]': '\uD83D\uDCF1',      // 📱
      '[EMAIL]': '\uD83D\uDCE7'       // 📧
    };

    if (!text) return '';
    let result = String(text);
    
    result = result.replace(/\uFFFD/g, '').replace(/\uAAAA/g, '').replace(/ꪪ/g, '');

    Object.entries(emojiMap).forEach(([tag, emoji]) => {
      result = result.split(tag).join(emoji);
    });

    return result;
  };

  const handleWhatsApp = (req: ExamRequest) => {
    if (!selectedSchedule) return;

    const safeSettings = settings || {
        whatsappMessageTemplate: '',
        agencyName: 'Detran',
        defaultExamAddress: '',
        defaultExamAddressLink: ''
    };
    
    let currentTemplate = safeSettings.whatsappMessageTemplate || '';

    if (!currentTemplate.trim()) {
        currentTemplate = `Olá, *{CANDIDATO}*! [WAVE][SMILE]

Aqui é do {AGENCIA} – Setor CNH.
Estamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* [CAR], marcada para:

[CALENDAR] *{DATA}*
[CLOCK] *{HORA}*
[MAP] *{ENDERECO}*

[WARNING] Não esqueça:
[ID] _*Documento com foto (válido)*_
[CAR_FRONT] _*Veículo ou moto em condições para a prova*_

[CHECK] *Posso confirmar sua presença?*

[HOURGLASS] _*Confirmação até amanhã às 18:00*_`;
    }
    
    const replacements: Record<string, string> = {
      '{CANDIDATO}': req.socialName || req.studentName || '',
      '{CATEGORIA}': req.scheduledCategory || req.intendedCategory || '-',
      '{DATA}': formatDateDisplay(selectedSchedule.date),
      '{HORA}': selectedSchedule.time,
      '{ENDERECO}': safeSettings.defaultExamAddress || '',
      '{LOCALIZACAO}': safeSettings.defaultExamAddressLink || '',
      '{AGENCIA}': safeSettings.agencyName || 'Detran'
    };

    let finalMessage = currentTemplate;
    
    Object.entries(replacements).forEach(([tag, value]) => {
      finalMessage = finalMessage.split(tag).join(value || '');
    });
    
    finalMessage = injectEmojis(finalMessage);
    
    const rawPhone = req.phone || '';
    const phoneDigits = rawPhone.replace(/\D/g, '');
    
    if (!phoneDigits) {
        alert('Este candidato não possui um número de telefone válido cadastrado.');
        return;
    }

    const finalPhone = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    
    let encodedMessage = '';
    try {
        encodedMessage = encodeURIComponent(finalMessage);
    } catch (e) {
        const sanitized = finalMessage.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
        encodedMessage = encodeURIComponent(sanitized);
    }
    
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${finalPhone}&text=${encodedMessage}`;
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

  const handleOpenAddStudent = () => {
      setSearchTermInput('');
      setSelectedCandidates({});
      setExpandedCategories({ A: false, B: false });
      setIsAddStudentOpen(true);
  };

  const toggleCandidateSelection = (id: string, category: 'A' | 'B') => {
      setSelectedCandidates(prev => {
          const newState = { ...prev };
          if (newState[id]) {
              delete newState[id];
          } else {
              newState[id] = category;
          }
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

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação de campos obrigatórios
    if (!scheduleForm.date) {
        alert("O campo Data da Prova é obrigatório.");
        return;
    }
    if (!scheduleForm.time) {
        alert("O campo Horário Início é obrigatório.");
        return;
    }
    if (scheduleForm.examinerIds.length === 0) {
        alert("É obrigatório escalar pelo menos um examinador.");
        return;
    }

    try {
      if (editingSchedule) {
        await api.updateSchedule(editingSchedule.id, scheduleForm);
      } else {
        await api.createSchedule({ ...scheduleForm, status: 'OPEN' });
      }
      setIsModalOpen(false);
      refreshData();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar banca.");
    }
  };

  const handleCancelSchedule = async (id: string) => {
    if (user.role !== UserRole.ADMIN) {
        alert("Somente administradores podem cancelar bancas.");
        return;
    }
    const reason = prompt("Informe o motivo do cancelamento:");
    if (reason) {
      await api.cancelSchedule(id, reason);
      refreshData();
    }
  };

  const handleRemoveStudent = async (requestId: string) => {
    await api.removeStudentFromSchedule(requestId);
    refreshData();
  };

  const getExaminerName = (id: string) => examiners.find(e => e.id === id)?.name || 'Desconhecido';

  const filteredSchedules = schedules.filter(s => {
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesSearch = s.date.includes(searchTerm) || s.examinerIds.some(id => getExaminerName(id).toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Date Range Filter
    let matchesDate = true;
    if (startDate || endDate) {
        const schedTime = new Date(s.date).getTime();
        if (startDate && schedTime < new Date(startDate).getTime()) matchesDate = false;
        if (endDate && schedTime > new Date(endDate).getTime()) matchesDate = false;
    }

    return matchesStatus && matchesSearch && matchesDate;
  });

  const scheduledStudents = allRequests.filter(r => r.scheduleId === selectedSchedule?.id);
  
  // Logic for Available Students (Modal)
  const availableRequests = allRequests
    .filter(r => 
        r.status === ExamStatus.WAITING_SCHEDULING && 
        r.examType === selectedSchedule?.type &&
        (r.studentName.toLowerCase().includes(studentSearch.toLowerCase()) || r.cpf.includes(studentSearch))
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Ordenação: Mais antigo primeiro

  // Split into categories
  const candidatesA = availableRequests.filter(r => r.intendedCategory === 'A' || r.intendedCategory === 'AB');
  const candidatesB = availableRequests.filter(r => r.intendedCategory === 'B' || r.intendedCategory === 'AB');

  // Counts for selection limits
  const currentCountA = scheduledStudents.filter(s => s.scheduledCategory === 'A').length;
  const currentCountB = scheduledStudents.filter(s => s.scheduledCategory === 'B').length;
  
  const selectedCountA = Object.values(selectedCandidates).filter(c => c === 'A').length;
  const selectedCountB = Object.values(selectedCandidates).filter(c => c === 'B').length;

  const remainingA = (selectedSchedule?.maxSlotsA || 0) - currentCountA - selectedCountA;
  const remainingB = (selectedSchedule?.maxSlotsB || 0) - currentCountB - selectedCountB;

  if (loading) return <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-4">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    Carregando Central de Bancas...
  </div>;

  return (
    <div className="space-y-6">
      {!selectedSchedule ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             {/* Left Side Filters */}
             <div className="flex gap-3 w-full md:w-auto items-center flex-wrap">
                <div className="relative w-full md:w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                        className="w-full pl-10 pr-4 py-2 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <div className="relative w-full md:w-40">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Filter className="h-4 w-4 text-gray-400" />
                    </div>
                    <select 
                        className="w-full pl-10 pr-8 py-2 border rounded-md text-sm bg-white text-gray-900 appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                    >
                        <option value="ALL">Status</option>
                        <option value="OPEN">Abertas</option>
                        <option value="CLOSED">Fechadas</option>
                        <option value="CONCLUDED">Concluídas</option>
                        <option value="CANCELLED">Canceladas</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input 
                        type="date" 
                        className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                        type="date" 
                        className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                    />
                </div>
             </div>

             {/* Right Side Action */}
             <div className="w-full md:w-auto flex justify-end">
                <button 
                  onClick={() => handleOpenModal()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm font-bold transition-colors"
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
                            <UserIcon className="h-4 w-4 opacity-50" />
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
                        <button onClick={handleOpenAddStudent} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-md text-sm font-bold">
                            <Plus className="h-4 w-4" /> Agendar Candidato
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border overflow-hidden print:shadow-none print:border-none print:bg-white print:block">
                {/* Cabeçalho de Impressão e UI */}
                <div className="p-6 bg-white border-b print:p-0 print:border-none">
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
                            <h2 className="text-2xl font-bold text-gray-900">{formatDateDisplay(selectedSchedule.date)}</h2>
                            <StatusBadge status={selectedSchedule.status} />
                        </div>
                        <div className="flex flex-wrap gap-6 text-sm text-gray-500 font-medium">
                            <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {selectedSchedule.time}</span>
                            <span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> {selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-8 print:p-0">
                    {['A', 'B'].map(cat => {
                        const students = scheduledStudents.filter(s => s.scheduledCategory === cat);
                        if (students.length === 0 && selectedSchedule.status !== 'OPEN') return null;
                        
                        return (
                            <div key={cat} className="break-inside-avoid print:mb-2 mb-4">
                                <div className="flex items-center gap-3 border-b pb-2 mb-4 print:border-black print:!text-black">
                                    <div className="bg-blue-50 text-blue-600 p-2 rounded-md print:hidden">
                                        <Layers className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 print:text-sm print:font-black">Categoria {cat}</h3>
                                    <span className="text-sm text-gray-500 ml-auto print:hidden">
                                        {students.length} candidatos agendados
                                    </span>
                                </div>

                                {/* LISTA CLEAN (Apenas Web - SEM as colunas de marcação) */}
                                <div className="space-y-2 print:hidden">
                                    {students.map((req, idx) => (
                                        <div key={req.id} className={`flex flex-col sm:flex-row items-center gap-4 p-3 rounded-md border transition-all hover:border-blue-200 bg-white ${req.attendanceConfirmed ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                                            <div className="flex items-center gap-4 flex-1 w-full">
                                                <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500 text-sm shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-bold text-gray-900 uppercase truncate">
                                                        {req.socialName || req.studentName}
                                                    </div>
                                                    <div className="flex gap-2 text-xs text-gray-500">
                                                        <span>{req.cpf}</span>
                                                        <span className="text-gray-300">|</span>
                                                        <span>Instrutor: {req.instructor || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Botão Confirmação */}
                                                <button 
                                                    onClick={() => toggleAttendance(req)}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${req.attendanceConfirmed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                                    title="Confirmar Presença/Agendamento"
                                                >
                                                    {req.attendanceConfirmed ? <CheckCircle2 className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                                    {req.attendanceConfirmed ? 'Confirmado' : 'Confirmar'}
                                                </button>

                                                {/* Botão WhatsApp */}
                                                <button 
                                                    onClick={() => handleWhatsApp(req)}
                                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-all"
                                                    title="Enviar mensagem WhatsApp"
                                                >
                                                    <MessageCircle className="h-4 w-4" />
                                                </button>

                                                <div className="w-px h-4 bg-gray-200 mx-1"></div>

                                                <button 
                                                    onClick={() => handleRemoveStudent(req.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                                    title="Remover da Banca"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {students.length === 0 && (
                                        <div className="text-center py-6 bg-gray-50 rounded-md border border-dashed border-gray-200 text-gray-500 text-sm">
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
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-900">{editingSchedule ? 'Editar Banca' : 'Nova Banca'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="h-6 w-6" /></button>
                  </div>
                  <form onSubmit={handleSaveSchedule} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data da Prova <span className="text-red-500">*</span></label>
                            <input required type="date" className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Horário Início <span className="text-red-500">*</span></label>
                            <input required type="time" className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Escalar Examinadores (Máx 3) <span className="text-red-500">*</span></label>
                          <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50">
                              {examiners.map(ex => (
                                  <label key={ex.id} className={`flex items-center gap-3 cursor-pointer p-2 rounded-md transition-all ${scheduleForm.examinerIds.includes(ex.id) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}>
                                      <input type="checkbox" className="hidden" checked={scheduleForm.examinerIds.includes(ex.id)} onChange={(e) => {
                                            const ids = e.target.checked ? [...scheduleForm.examinerIds, ex.id].slice(0, 3) : scheduleForm.examinerIds.filter(id => id !== ex.id);
                                            setScheduleForm({...scheduleForm, examinerIds: ids});
                                      }} />
                                      <div className={`h-4 w-4 rounded border flex items-center justify-center ${scheduleForm.examinerIds.includes(ex.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'}`}>
                                          {scheduleForm.examinerIds.includes(ex.id) && <CheckCircle2 className="h-3 w-3" />}
                                      </div>
                                      <span className="text-sm font-medium">{ex.name}</span>
                                  </label>
                              ))}
                          </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-4">
                          <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 font-medium">Cancelar</button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-sm transition-all">Salvar Banca</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL: ADICIONAR ESTUDANTE (REDESIGNED) */}
      {isAddStudentOpen && selectedSchedule && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-5 border-b">
                      <h3 className="text-lg font-bold text-gray-800">Agendar Candidatos</h3>
                      <button onClick={() => setIsAddStudentOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                  </div>
                  
                  <div className="p-5 border-b bg-gray-50">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                            type="text" 
                            placeholder="Buscar nome ou CPF..." 
                            className="w-full pl-10 pr-4 py-2 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={studentSearch} 
                            onChange={e => setSearchTermInput(e.target.value)} 
                          />
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      
                      {/* CARD: CATEGORIA A */}
                      <div className={`border rounded-lg overflow-hidden transition-all ${expandedCategories.A ? 'ring-1 ring-blue-200' : ''}`}>
                          <button 
                            onClick={() => setExpandedCategories(prev => ({ ...prev, A: !prev.A }))}
                            className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                          >
                              <div className="flex items-center gap-3">
                                  <div className="bg-blue-100 text-blue-700 p-2 rounded-lg"><Bike className="h-5 w-5" /></div>
                                  <div className="text-left">
                                      <h4 className="font-bold text-gray-800">Categoria A (Moto)</h4>
                                      <span className="text-xs text-gray-500 font-medium">
                                          {selectedCountA} selecionados / {remainingA} vagas restantes
                                      </span>
                                  </div>
                              </div>
                              {expandedCategories.A ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                          </button>
                          
                          {expandedCategories.A && (
                              <div className="border-t bg-gray-50/50 p-2 max-h-60 overflow-y-auto space-y-1">
                                  {candidatesA.map(cand => {
                                      const isSelected = selectedCandidates[cand.id] === 'A';
                                      const isDisabled = !isSelected && (remainingA <= 0 || selectedCandidates[cand.id] === 'B');
                                      
                                      return (
                                          <label key={cand.id} className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors border ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:border-gray-200'} ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}>
                                              <input 
                                                type="checkbox" 
                                                className="hidden"
                                                disabled={isDisabled}
                                                checked={isSelected}
                                                onChange={() => toggleCandidateSelection(cand.id, 'A')}
                                              />
                                              <div className={isSelected ? 'text-blue-600' : 'text-gray-400'}>
                                                  {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                              </div>
                                              <div className="flex-1">
                                                  <div className="text-sm font-bold text-gray-800 uppercase">{cand.studentName}</div>
                                                  <div className="text-xs text-gray-500">Cadastro: {new Date(cand.createdAt).toLocaleDateString()} • {cand.cpf}</div>
                                              </div>
                                          </label>
                                      );
                                  })}
                                  {candidatesA.length === 0 && <div className="p-4 text-center text-xs text-gray-400">Nenhum candidato disponível.</div>}
                              </div>
                          )}
                      </div>

                      {/* CARD: CATEGORIA B */}
                      <div className={`border rounded-lg overflow-hidden transition-all ${expandedCategories.B ? 'ring-1 ring-blue-200' : ''}`}>
                          <button 
                            onClick={() => setExpandedCategories(prev => ({ ...prev, B: !prev.B }))}
                            className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                          >
                              <div className="flex items-center gap-3">
                                  <div className="bg-green-100 text-green-700 p-2 rounded-lg"><Car className="h-5 w-5" /></div>
                                  <div className="text-left">
                                      <h4 className="font-bold text-gray-800">Categoria B (Carro)</h4>
                                      <span className="text-xs text-gray-500 font-medium">
                                          {selectedCountB} selecionados / {remainingB} vagas restantes
                                      </span>
                                  </div>
                              </div>
                              {expandedCategories.B ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                          </button>
                          
                          {expandedCategories.B && (
                              <div className="border-t bg-gray-50/50 p-2 max-h-60 overflow-y-auto space-y-1">
                                  {candidatesB.map(cand => {
                                      const isSelected = selectedCandidates[cand.id] === 'B';
                                      const isDisabled = !isSelected && (remainingB <= 0 || selectedCandidates[cand.id] === 'A');
                                      
                                      return (
                                          <label key={cand.id} className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors border ${isSelected ? 'bg-green-50 border-green-200' : 'bg-white border-transparent hover:border-gray-200'} ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}>
                                              <input 
                                                type="checkbox" 
                                                className="hidden"
                                                disabled={isDisabled}
                                                checked={isSelected}
                                                onChange={() => toggleCandidateSelection(cand.id, 'B')}
                                              />
                                              <div className={isSelected ? 'text-green-600' : 'text-gray-400'}>
                                                  {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                              </div>
                                              <div className="flex-1">
                                                  <div className="text-sm font-bold text-gray-800 uppercase">{cand.studentName}</div>
                                                  <div className="text-xs text-gray-500">Cadastro: {new Date(cand.createdAt).toLocaleDateString()} • {cand.cpf}</div>
                                              </div>
                                          </label>
                                      );
                                  })}
                                  {candidatesB.length === 0 && <div className="p-4 text-center text-xs text-gray-400">Nenhum candidato disponível.</div>}
                              </div>
                          )}
                      </div>

                  </div>

                  <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
                      <button onClick={() => setIsAddStudentOpen(false)} className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-100 font-medium">Cancelar</button>
                      <button 
                        onClick={handleConfirmBatchSchedule}
                        disabled={Object.keys(selectedCandidates).length === 0}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                      >
                          Confirmar Agendamento ({Object.keys(selectedCandidates).length})
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SchedulingCenter;