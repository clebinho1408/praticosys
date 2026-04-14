
// Scheduling Center Page
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ExamRequest, ExamSchedule, ExamType, Examiner, ExamStatus, SystemSettings, User, UserRole, BlockedDate, RequestSource } from '../types';
import { isDateBlocked } from '../lib/dateBlocking';
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
  Car,
  AlertOctagon
} from 'lucide-react';
import DatePicker from '../components/DatePicker';

const formatDateDisplay = (dateString: string | null | undefined) => {
  if (!dateString) return '-';
  const cleanDate = dateString.split('T')[0];
  const parts = cleanDate.split('-');
  return parts.length !== 3 ? cleanDate : `${parts[2]}/${parts[1]}`;
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

const ClosingCountdown: React.FC<{ date: string; time: string }> = ({ date, time }) => {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
        const calculateTime = () => {
            if (!date || !time) return;
            
            const examDate = new Date(`${date.split('T')[0]}T${time}`);
            // Regra de fechamento: 24h antes da prova
            const closingDate = new Date(examDate.getTime() - (24 * 60 * 60 * 1000));
            const now = new Date();
            
            const diff = closingDate.getTime() - now.getTime();
            
            // Mostrar apenas se faltar menos de 48h e ainda não fechou
            const hours48 = 48 * 60 * 60 * 1000;
            
            if (diff > 0 && diff <= hours48) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft(`${hours}h ${minutes}m`);
            } else {
                setTimeLeft(null);
            }
        };

        calculateTime();
        const interval = setInterval(calculateTime, 60000); // Atualiza a cada minuto
        return () => clearInterval(interval);
    }, [date, time]);

    if (!timeLeft) return null;

    return (
        <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100 mt-2 w-fit">
            <Clock className="h-3 w-3" />
            <span>Fecha em {timeLeft}</span>
        </div>
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
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [allRequests, setAllRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedSchedule, setSelectedSchedule] = useState<ExamSchedule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorField, setErrorField] = useState<string | null>(null);
  
  // States for Add Student Modal
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentSearch, setSearchTermInput] = useState('');
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, 'A' | 'B'>>({});
  const [expandedCategories, setExpandedCategories] = useState<{A: boolean, B: boolean}>({ A: false, B: false });

  // Remove Confirmation Modal State
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [candidateToRemove, setCandidateToRemove] = useState<ExamRequest | null>(null);

  // Schedule Cancel Modal State
  const [isCancelScheduleOpen, setIsCancelScheduleOpen] = useState(false);
  const [scheduleToCancel, setScheduleToCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Schedule Delete Modal State
  const [isDeleteScheduleOpen, setIsDeleteScheduleOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Filters - Default to 30 days ago and 30 days ahead
  const [startDate, setStartDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
  });

  const [editingSchedule, setEditingSchedule] = useState<ExamSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ 
    date: '', 
    time: '', 
    examinerIds: [] as string[], 
    maxSlotsA: 10, 
    maxSlotsB: 10,
    type: type || ExamType.COMMON
  });

  const globalQueue = React.useMemo(() => {
    return allRequests
      .filter(
        (r) =>
          r.status === ExamStatus.WAITING_SCHEDULING &&
          (!type || r.examType === type),
      )
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [allRequests, type]);

  const getGlobalPosition = (id: string) => {
    const index = globalQueue.findIndex((r) => r.id === id);
    return index !== -1 ? index + 1 : "-";
  };

  const isValidForCategory = (r: ExamRequest, category: 'A' | 'B') => {
    if (!r.instructor || !r.vehiclePlate) return false;
    
    if (r.intendedCategory === 'AB') {
        const instrParts = r.instructor.split(' / ');
        const plateParts = r.vehiclePlate.split(' / ');
        
        if (category === 'A') {
            const motoInstr = instrParts[0]?.replace('Moto: ', '');
            const motoPlate = plateParts[0]?.replace('Moto: ', '');
            return motoInstr !== 'A DEFINIR' && motoPlate !== 'A DEFINIR';
        } else {
            const carInstr = instrParts[1]?.replace('Carro: ', '');
            const carPlate = plateParts[1]?.replace('Carro: ', '');
            return carInstr !== 'A DEFINIR' && carPlate !== 'A DEFINIR';
        }
    } else {
        return r.instructor !== 'A DEFINIR' && r.vehiclePlate !== 'A DEFINIR';
    }
  };

  const fullAvailableRequests = React.useMemo(() => {
    return allRequests
     .filter(r => {
         const matchesStatus = r.status === ExamStatus.WAITING_SCHEDULING;
         const matchesType = r.examType === selectedSchedule?.type;
         const matchesSchool = user.role !== UserRole.SCHOOL || r.schoolId === user.schoolId;
         const matchesSource = r.source === RequestSource.STUDENT_DIRECT;
         return matchesStatus && matchesType && matchesSchool && matchesSource;
     })
     .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allRequests, selectedSchedule, user]);

  const fullCandidatesA = fullAvailableRequests.filter(r => (r.intendedCategory === 'A' || r.intendedCategory === 'AB') && isValidForCategory(r, 'A'));
  const fullCandidatesB = fullAvailableRequests.filter(r => (r.intendedCategory === 'B' || r.intendedCategory === 'AB') && isValidForCategory(r, 'B'));

  const refreshData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [scheds, exams, sysSettings, requests, blocked] = await Promise.all([
        api.getSchedules(), 
        api.getExaminersAsync(), 
        api.getSettings(), 
        api.getRequests(),
        fetch('/api/blocked-dates').then(res => res.ok ? res.json() : [])
      ]);
      let filteredScheds = scheds;
      if (type) filteredScheds = filteredScheds.filter(s => s.type === type);
      setSchedules(filteredScheds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setExaminers(exams);
      setSettings(sysSettings);
      setAllRequests(requests);
      setBlockedDates(blocked);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, [type]);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('requests_updated', () => {
      refreshData(true);
    });

    eventSource.addEventListener('schedules_updated', () => {
      refreshData(true);
    });

    return () => {
      eventSource.close();
    };
  }, [type]);

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
        defaultExamAddressLink: '',
        restrictions: []
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
      '{AGENCIA}': safeSettings.agencyName || 'Detran',
      '{RESTRICOES}': (() => {
          if (!req.cnhRestriction) return '';
          const codes = req.cnhRestriction.split(',').map(c => c.trim());
          const found = codes
            .map(code => safeSettings.restrictions?.find(r => r.code === code))
            .filter(r => r !== undefined);
          
          if (found.length === 0) return '';
          
          return `\nRestrição(ões) obrigatória para o dia da prova:\n${found.map(r => `*${r!.code} - ${r!.description}*`).join('\n')}`;
      })()
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
    await api.updateRequest(req.id, { 
      attendanceConfirmed: !req.attendanceConfirmed,
      updatedAt: new Date().toISOString()
    });
    refreshData(true);
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
        time: '',
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
      const candidatesList = category === 'A' ? fullCandidatesA : fullCandidatesB;
      const index = candidatesList.findIndex(c => c.id === id);
      if (index === -1) return;

      setSelectedCandidates(prev => {
          const newState = { ...prev };
          const isCurrentlySelected = newState[id] === category;
          
          if (isCurrentlySelected) {
              // Deselecting: must deselect all subsequent candidates in this category
              for (let i = index; i < candidatesList.length; i++) {
                  const candId = candidatesList[i].id;
                  if (newState[candId] === category) {
                      delete newState[candId];
                  }
              }
          } else {
              // Selecting: must select all previous candidates in this category
              // Check if we have enough slots
              const currentSelectedInThisCat = Object.values(newState).filter(c => c === category).length;
              const alreadyInBanca = allScheduledInThisBanca.filter(s => s.scheduledCategory === category).length;
              const maxSlots = category === 'A' ? (selectedSchedule?.maxSlotsA || 0) : (selectedSchedule?.maxSlotsB || 0);
              
              // Count how many new selections we are making
              let newSelections = 0;
              for (let i = 0; i <= index; i++) {
                  if (newState[candidatesList[i].id] !== category) {
                      newSelections++;
                  }
              }

              if (alreadyInBanca + currentSelectedInThisCat + newSelections > maxSlots) {
                  alert(`Não há vagas suficientes para selecionar até esta posição na Categoria ${category}.`);
                  return prev;
              }

              for (let i = 0; i <= index; i++) {
                  const candId = candidatesList[i].id;
                  newState[candId] = category;
              }
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
          refreshData(true);
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
        setErrorMessage("O campo Data da Prova é obrigatório.");
        setErrorField('scheduleDate');
        setIsErrorModalOpen(true);
        return;
    }

    // Date blocking validation
    if (settings) {
        const check = isDateBlocked(scheduleForm.date, blockedDates, settings);
        if (check.blocked) {
            setErrorMessage(`Esta data está bloqueada: ${check.reason}`);
            setErrorField('scheduleDate');
            setIsErrorModalOpen(true);
            return;
        }
    }

    if (!scheduleForm.time) {
        setErrorMessage("O campo Horário Início é obrigatório.");
        setErrorField('scheduleTime');
        setIsErrorModalOpen(true);
        return;
    }
    if (scheduleForm.examinerIds.length === 0) {
        setErrorMessage("É obrigatório escalar pelo menos um examinador.");
        setErrorField('examinersList');
        setIsErrorModalOpen(true);
        return;
    }

    try {
      if (editingSchedule) {
        await api.updateSchedule(editingSchedule.id, scheduleForm);
      } else {
        await api.createSchedule({ ...scheduleForm, status: 'OPEN' });
      }
      setIsModalOpen(false);
      refreshData(true);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar banca.");
    }
  };

  const handleCancelSchedule = (id: string) => {
    if (user.role !== UserRole.ADMIN) {
        alert("Somente administradores podem cancelar bancas.");
        return;
    }
    setScheduleToCancel(id);
    setCancelReason('');
    setIsCancelScheduleOpen(true);
  };

  const confirmCancelSchedule = async () => {
    if (scheduleToCancel && cancelReason.trim()) {
      await api.cancelSchedule(scheduleToCancel, cancelReason);
      setIsCancelScheduleOpen(false);
      setScheduleToCancel(null);
      setCancelReason('');
      refreshData(true);
    } else {
        alert("Informe o motivo do cancelamento.");
    }
  };

  const handleDeleteSchedule = (id: string) => {
    if (user.role !== UserRole.ADMIN) {
        alert("Somente administradores podem excluir bancas.");
        return;
    }
    setScheduleToDelete(id);
    setIsDeleteScheduleOpen(true);
  };

  const confirmDeleteSchedule = async () => {
    if (scheduleToDelete) {
        await api.deleteSchedule(scheduleToDelete);
        setIsDeleteScheduleOpen(false);
        setScheduleToDelete(null);
        refreshData(true);
    }
  };

  const handleRemoveStudent = (request: ExamRequest) => {
    setCandidateToRemove(request);
    setIsRemoveConfirmOpen(true);
  };

  const confirmRemoveStudent = async () => {
    if (candidateToRemove) {
        await api.removeStudentFromSchedule(candidateToRemove.id);
        setIsRemoveConfirmOpen(false);
        setCandidateToRemove(null);
        refreshData(true);
    }
  };

  const getExaminerName = (id: string) => examiners.find(e => e.id === id)?.name || 'Desconhecido';

  const filteredSchedules = schedules.filter(s => {
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesSearch = s.date.includes(searchTerm) || 
                          s.examinerIds.some(id => getExaminerName(id).toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Date Range Filter
    let matchesDate = true;
    if (startDate || endDate) {
        const schedTime = new Date(s.date).getTime();
        if (startDate && schedTime < new Date(startDate).getTime()) matchesDate = false;
        if (endDate && schedTime > new Date(endDate).getTime()) matchesDate = false;
    }

    return matchesStatus && matchesSearch && matchesDate;
  });

  const allScheduledInThisBanca = allRequests.filter(r => {
    // 1. Currently scheduled
    if (r.scheduleId === selectedSchedule?.id) return true;
    
    // 2. Historically scheduled (for concluded schedules)
    if (selectedSchedule?.status === 'CONCLUDED' || selectedSchedule?.status === 'CLOSED') {
        return r.examHistory?.some(h => h.scheduleId === selectedSchedule.id);
    }
    
    return false;
  }).map(r => {
    // If historically scheduled but not currently, we need to "fake" the display properties
    // using the historical data entry for this schedule
    if (r.scheduleId !== selectedSchedule?.id) {
        const historyEntry = r.examHistory?.find(h => h.scheduleId === selectedSchedule?.id);
        if (historyEntry) {
            return {
                ...r,
                scheduledCategory: historyEntry.category,
                // We need to cast result because historyEntry.result is ExamResult but r.result is optional ExamResult
                result: historyEntry.result,
                // Ensure it looks like it belongs here
                scheduleId: selectedSchedule?.id 
            };
        }
    }
    return r;
  });

  const scheduledStudents = allScheduledInThisBanca.filter(r => 
    (user.role !== UserRole.SCHOOL || r.schoolId === user.schoolId) &&
    r.source === RequestSource.STUDENT_DIRECT
  );
  
  // Logic for Available Students (Modal)
  const availableRequests = allRequests
    .filter(r => {
        const matchesStatus = r.status === ExamStatus.WAITING_SCHEDULING;
        const matchesType = r.examType === selectedSchedule?.type;
        const matchesSearch = (r.socialName || r.studentName).toLowerCase().includes(studentSearch.toLowerCase()) || r.cpf.includes(studentSearch);
        const matchesSchool = user.role !== UserRole.SCHOOL || r.schoolId === user.schoolId;
        const matchesSource = r.source === RequestSource.STUDENT_DIRECT;
        
        return matchesStatus && matchesType && matchesSearch && matchesSchool && matchesSource;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Ordenação: Mais antigo primeiro

  // Split into categories
  const candidatesA = availableRequests.filter(r => (r.intendedCategory === 'A' || r.intendedCategory === 'AB') && isValidForCategory(r, 'A'));
  const candidatesB = availableRequests.filter(r => (r.intendedCategory === 'B' || r.intendedCategory === 'AB') && isValidForCategory(r, 'B'));

  // Counts for selection limits
  const currentCountA = allScheduledInThisBanca.filter(s => s.scheduledCategory === 'A').length;
  const currentCountB = allScheduledInThisBanca.filter(s => s.scheduledCategory === 'B').length;
  
  const selectedCountA = Object.values(selectedCandidates).filter(c => c === 'A').length;
  const selectedCountB = Object.values(selectedCandidates).filter(c => c === 'B').length;

  const remainingA = (selectedSchedule?.maxSlotsA || 0) - currentCountA - selectedCountA;
  const remainingB = (selectedSchedule?.maxSlotsB || 0) - currentCountB - selectedCountB;

  if (loading) return <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-4">
    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    Carregando Central de Bancas...
  </div>;

  return (
    <div className="space-y-6 print:space-y-0 print:m-0 print:p-0 print:-mt-4">
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
                        className="w-32 border border-slate-200 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                        type="date"
                        className="w-32 border border-slate-200 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                    />
                </div>
             </div>

             {/* Right Side Action */}
             <div className="w-full md:w-auto flex justify-end">
                {user.role !== UserRole.SCHOOL && (
                  <button 
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm font-bold transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Nova Banca
                  </button>
                )}
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
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {s.code && <span className="text-gray-500 mr-2 text-lg font-mono">#{s.code}</span>}
                        {formatDateDisplay(s.date)}
                    </h3>
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-4">
                        <Clock className="h-4 w-4" /> {s.time}
                    </div>
                    {s.status === 'OPEN' && <ClosingCountdown date={s.date} time={s.time} />}
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
                      <div className="flex gap-4 text-[10px] font-bold uppercase text-gray-400">
                          <span>Moto: {allRequests.filter(r => r.scheduleId === s.id && r.scheduledCategory === 'A').length}/{s.maxSlotsA}</span>
                          <span>Carro: {allRequests.filter(r => r.scheduleId === s.id && r.scheduledCategory === 'B').length}/{s.maxSlotsB}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         {s.status !== 'CONCLUDED' && s.status !== 'CANCELLED' && user.role !== UserRole.SCHOOL && (
                             <>
                                 <button onClick={(e) => { e.stopPropagation(); handleOpenModal(s); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                                    <Edit2 className="h-4 w-4" />
                                 </button>
                                 <button onClick={(e) => { e.stopPropagation(); handleCancelSchedule(s.id); }} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Cancelar Banca">
                                    <Ban className="h-4 w-4" />
                                 </button>
                                 {user.role === UserRole.ADMIN && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSchedule(s.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir Banca">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                 )}
                             </>
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
                    {selectedSchedule.status !== 'CONCLUDED' && (
                        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 bg-white shadow-sm text-sm font-bold">
                            <Printer className="h-4 w-4" /> Imprimir Lista
                        </button>
                    )}
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
                    <div className="hidden print:flex items-center gap-6 border-b-2 border-black pb-2 mb-2">
                        {settings?.logoUrl ? (
                            <img src={settings.logoUrl} className="h-16 w-auto" />
                        ) : (
                            <div className="h-16 w-16 bg-red-600 flex items-center justify-center text-white font-bold text-xs print:!text-black">DETRAN</div>
                        )}
                        <div>
                            <h1 className="text-xl font-bold uppercase tracking-tight print:!text-black">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                            <h2 className="text-2xl font-bold uppercase print:!text-black">
                                LISTA PROVA PRÁTICA DA CNH DO BRASIL
                            </h2>
                        </div>
                    </div>

                    <div className="hidden print:flex justify-between items-center border-b-2 border-black pb-1 mb-2 print:!text-black">
                        <div className="flex gap-8">
                            {selectedSchedule.code && <span className="text-sm uppercase font-bold">BANCA: <span className="font-normal">{selectedSchedule.code}</span></span>}
                            <span className="text-sm uppercase font-bold">DATA: <span className="font-normal">{formatDateDisplay(selectedSchedule.date)}</span></span>
                            <span className="text-sm uppercase font-bold">HORA: <span className="font-normal">{selectedSchedule.time}</span></span>
                        </div>
                        <span className="text-sm uppercase font-bold">EXAMINADORES: <span className="font-normal">{selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span></span>
                    </div>

                    <div className="print:hidden">
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-2xl font-bold text-gray-900">
                                {selectedSchedule.code && <span className="text-gray-500 mr-2 font-mono">#{selectedSchedule.code}</span>}
                                {formatDateDisplay(selectedSchedule.date)}
                            </h2>
                            <StatusBadge status={selectedSchedule.status} />
                        </div>
                        <div className="flex flex-wrap gap-6 text-sm text-gray-500 font-medium">
                            <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {selectedSchedule.time}</span>
                            <span className="flex items-center gap-2"><UserIcon className="h-4 w-4" /> {selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-8 print:p-0 print:space-y-4 print:mt-4">
                    {['A', 'B'].map(cat => {
                        const students = scheduledStudents
                            .filter(s => s.scheduledCategory === cat)
                            .sort((a, b) => {
                                const instA = a.instructor || '';
                                const instB = b.instructor || '';
                                return instA.localeCompare(instB);
                            });
                        if (students.length === 0 && selectedSchedule.status !== 'OPEN') return null;
                        
                        return (
                            <div key={cat} className="break-inside-avoid print:mb-0 mb-4">
                                <div className="flex items-center gap-3 border-b pb-2 mb-4 print:mb-2 print:pb-1 print:border-black print:!text-black">
                                    <div className="bg-blue-50 text-blue-600 p-2 rounded-md print:hidden">
                                        <Layers className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-800 print:text-sm print:font-bold">Categoria {cat}</h3>
                                    <span className="text-sm text-gray-500 ml-auto print:hidden">
                                        {students.length} candidatos agendados
                                    </span>
                                </div>

                                {/* LISTA CLEAN (Apenas Web - SEM as colunas de marcação) */}
                                <div className="space-y-2 print:hidden">
                                    {students.map((req, idx) => (
                                        <div key={req.id} className={`flex flex-col sm:flex-row items-center gap-4 p-3 rounded-md border transition-all hover:border-blue-200 bg-white ${req.attendanceConfirmed ? 'border-green-300 bg-green-100/40 shadow-sm' : 'border-gray-200'}`}>
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
                                                        <span>Restrição: {req.cnhRestriction || '-'}</span>
                                                        <span className="text-gray-300">|</span>
                                                        <span>Instrutor: {req.instructor || '-'}</span>
                                                        {selectedSchedule.status === 'CONCLUDED' && (
                                                            req.status === 'WAITING_RESULT' ? (
                                                                <>
                                                                    <span className="text-gray-300">|</span>
                                                                    <span className="text-gray-400 italic text-[10px] uppercase">Aguardando Lançamento</span>
                                                                </>
                                                            ) : (
                                                                req.result && (
                                                                    <>
                                                                        <span className="text-gray-300">|</span>
                                                                        <span className={`font-bold ${req.result === 'APTO' ? 'text-green-600' : req.result === 'INAPTO' ? 'text-red-600' : req.result === 'CANCELADO' ? 'text-gray-600' : 'text-orange-600'}`}>
                                                                            {req.result}
                                                                        </span>
                                                                    </>
                                                                )
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {selectedSchedule.status !== 'CONCLUDED' && selectedSchedule.status !== 'CLOSED' && (
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

                                                    {(user.role !== UserRole.SCHOOL || req.schoolId === user.schoolId) && (
                                                        <button 
                                                            onClick={() => handleRemoveStudent(req)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                                                            title="Remover da Banca"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {students.length === 0 && (
                                        <div className="text-center py-6 bg-gray-50 rounded-md border border-dashed border-gray-200 text-gray-500 text-sm">
                                            Nenhum candidato nesta categoria.
                                        </div>
                                    )}
                                </div>

                                {/* TABELA ORIGINAL (Apenas Impressão - COM as colunas de marcação) */}
                                <table className="hidden print:table w-full text-left border-collapse">
                                    <thead className="border-2 border-black">
                                        <tr className="bg-white text-black font-bold border-b-2 border-black text-[9px]">
                                            <th className="px-2 py-1 w-10 text-center border-r border-black uppercase">#</th>
                                            <th className="px-3 py-1 w-28 border-r border-black uppercase">CPF</th>
                                            <th className="px-3 py-1 border-r border-black uppercase">Nome do Candidato</th>
                                            <th className="px-3 py-1 w-20 text-center border-r border-black uppercase">Restr.</th>
                                            <th className="px-2 py-1 w-14 text-center border-r border-black uppercase">Canc.</th>
                                            <th className="px-2 py-1 w-14 text-center border-r border-black uppercase">Faltou</th>
                                            <th className="px-2 py-1 w-14 text-center border-r border-black uppercase">Apto</th>
                                            <th className="px-2 py-1 w-14 text-center uppercase">Inapto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-black border-2 border-black">
                                        {students.map((req, idx) => (
                                            <tr key={req.id} className="border-b-2 border-black print:!text-black">
                                                <td className="px-2 py-1 text-center font-bold border-r border-black text-[11px]">{idx + 1}</td>
                                                <td className="px-3 py-1 font-bold text-[12px] border-r border-black">{req.cpf}</td>
                                                <td className="px-3 py-1 border-r border-black">
                                                    <div className="font-bold uppercase text-[12px] truncate">{req.socialName || req.studentName}</div>
                                                    {(req.instructor || req.vehiclePlate) && (
                                                        <div className="text-[9px] font-normal uppercase mt-0.5 leading-tight text-gray-700 print:text-gray-800">
                                                            {req.instructor && req.instructor}
                                                            {req.instructor && req.vehiclePlate && ' | '}
                                                            {req.vehiclePlate && `Placa: ${req.vehiclePlate}`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-1 text-center font-bold text-[10px] border-r border-black">{req.cnhRestriction || '-'}</td>
                                                <td className="px-2 py-1 border-r border-black"><div className="w-5 h-5 border-2 border-black mx-auto rounded-sm"></div></td>
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
                <div className="hidden print:flex flex-col items-center mt-24 mb-20 break-inside-avoid">
                    <div className="w-96 border-b-2 border-black mb-2"></div>
                    <span className="text-sm font-bold uppercase tracking-widest text-black">Assinatura do Examinador</span>
                </div>
                
                {/* Print Footer (Fixed at bottom) */}
                <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-2 px-8 justify-between items-center text-[10px] font-bold text-black">
                    <div className="uppercase max-w-[70%] break-words text-left">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                    <div className="whitespace-nowrap text-right">IMPRESSÃO: {new Date().toLocaleString()}</div>
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
                            <DatePicker 
                              value={scheduleForm.date} 
                              onChange={date => setScheduleForm({...scheduleForm, date})} 
                              blockedDates={blockedDates}
                              settings={settings}
                              placeholder="Selecione a data"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Horário Início <span className="text-red-500">*</span></label>
                            <input id="scheduleTime" required type="time" className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Escalar Examinadores (Máx 3) <span className="text-red-500">*</span></label>
                          <div id="examinersList" className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50" tabIndex={0}>
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
                                                  <div className="flex justify-between items-start">
                                                      <div className="text-sm font-bold text-gray-800 uppercase">{cand.socialName || cand.studentName}</div>
                                                      <div className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Pos: {getGlobalPosition(cand.id)}º</div>
                                                  </div>
                                                  <div className="text-xs text-gray-600 font-medium mt-0.5">Instrutor: {cand.instructor || "-"}</div>
                                                  <div className="text-xs text-gray-500 flex items-center flex-wrap gap-1 mt-1">
                                                      <span>Cadastro: {new Date(cand.createdAt).toLocaleDateString()}</span>
                                                      <span>•</span>
                                                      <span>{cand.cpf}</span>
                                                      {cand.cnhRestriction && (
                                                          <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                                                              Restrição: {cand.cnhRestriction}
                                                          </span>
                                                      )}
                                                  </div>
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
                                                  <div className="flex justify-between items-start">
                                                      <div className="text-sm font-bold text-gray-800 uppercase">{cand.socialName || cand.studentName}</div>
                                                      <div className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Pos: {getGlobalPosition(cand.id)}º</div>
                                                  </div>
                                                  <div className="text-xs text-gray-600 font-medium mt-0.5">Instrutor: {cand.instructor || "-"}</div>
                                                  <div className="text-xs text-gray-500 flex items-center flex-wrap gap-1 mt-1">
                                                      <span>Cadastro: {new Date(cand.createdAt).toLocaleDateString()}</span>
                                                      <span>•</span>
                                                      <span>{cand.cpf}</span>
                                                      {cand.cnhRestriction && (
                                                          <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                                                              Restrição: {cand.cnhRestriction}
                                                          </span>
                                                      )}
                                                  </div>
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
      {/* Error Modal */}
      {isErrorModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
                  <div className="flex flex-col items-center text-center">
                      <div className="mb-4 p-3 rounded-full bg-red-50">
                          <AlertOctagon className="h-10 w-10 text-red-500" />
                      </div>
                      
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Atenção</h3>
                      <p className="text-gray-600 mb-6">{errorMessage}</p>
                      
                      <button 
                          onClick={() => {
                              setIsErrorModalOpen(false);
                              if (errorField) {
                                  setTimeout(() => {
                                      const element = document.getElementById(errorField);
                                      if (element) {
                                          element.focus();
                                          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }
                                  }, 100);
                              }
                          }}
                          className="w-full py-2.5 px-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                      >
                          Entendi
                      </button>
                  </div>
              </div>
          </div>
      )}
      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO */}
      {isRemoveConfirmOpen && candidateToRemove && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
                  <div className="p-6 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
                          <Trash2 className="h-8 w-8 text-red-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Remover Candidato?</h3>
                      <p className="text-sm text-gray-500 mb-6">
                          Tem certeza que deseja remover <span className="font-bold text-gray-800">{candidateToRemove.socialName || candidateToRemove.studentName}</span> desta banca?
                          <br/><br/>
                          O candidato voltará para a lista de "Aguardando Agendamento".
                      </p>
                      
                      <div className="flex gap-3 justify-center">
                          <button 
                              onClick={() => setIsRemoveConfirmOpen(false)}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={confirmRemoveStudent}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-colors flex items-center gap-2"
                          >
                              Sim, Remover
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE CANCELAMENTO DE BANCA */}
      {isCancelScheduleOpen && scheduleToCancel && (
          <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
                  <div className="p-6">
                      <div className="text-center mb-6">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
                              <Ban className="h-8 w-8 text-red-600" />
                          </div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">Cancelar Banca?</h3>
                          <p className="text-sm text-gray-500">
                              Esta ação irá cancelar a banca e liberar todos os candidatos agendados.
                          </p>
                      </div>
                      
                      <div className="mb-6">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do Cancelamento <span className="text-red-500">*</span></label>
                          <textarea 
                              className="w-full border rounded-md p-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                              rows={3}
                              placeholder="Informe o motivo..."
                              value={cancelReason}
                              onChange={e => setCancelReason(e.target.value)}
                          />
                      </div>

                      <div className="flex gap-3 justify-center">
                          <button 
                              onClick={() => setIsCancelScheduleOpen(false)}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                          >
                              Voltar
                          </button>
                          <button 
                              onClick={confirmCancelSchedule}
                              disabled={!cancelReason.trim()}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              Confirmar Cancelamento
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE EXCLUSÃO DE BANCA */}
      {isDeleteScheduleOpen && scheduleToDelete && (
          <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn border-2 border-red-100">
                  <div className="p-6 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
                          <Trash2 className="h-8 w-8 text-red-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Excluir Banca Permanentemente?</h3>
                      <p className="text-sm text-gray-500 mb-6">
                          Esta ação é <span className="font-bold text-red-600">IRREVERSÍVEL</span>. 
                          <br/>
                          Todos os dados da banca serão perdidos e os candidatos serão desvinculados.
                      </p>
                      
                      <div className="flex gap-3 justify-center">
                          <button 
                              onClick={() => setIsDeleteScheduleOpen(false)}
                              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={confirmDeleteSchedule}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md transition-colors flex items-center gap-2"
                          >
                              <Trash2 className="h-4 w-4" />
                              Sim, Excluir
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default SchedulingCenter;