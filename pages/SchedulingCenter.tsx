import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, ExamSchedule, ExamType, Examiner, ExamStatus, SystemSettings } from '../types';
import { Calendar, Clock, User, Plus, Search, ChevronRight, X, CheckSquare, Printer, Trash2, Layers, Edit2, Loader2, AlertTriangle, MessageCircle, CheckCircle, Circle, Filter, RotateCcw, Ban, Hourglass } from 'lucide-react';

// --- HELPER COMPONENTS & FUNCTIONS ---

const formatDateDisplay = (dateString: string) => {
  if (!dateString) return '-';
  const cleanDate = dateString.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length !== 3) return cleanDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const CountdownTimer: React.FC<{ schedule: ExamSchedule }> = ({ schedule }) => {
  const [timeLeft, setTimeLeft] = useState<string>('Carregando...');
  const [styleClass, setStyleClass] = useState<string>('bg-gray-100 text-gray-500');

  useEffect(() => {
    const calculateTime = () => {
      if (schedule.status === 'CANCELLED') {
         setTimeLeft('Cancelada');
         setStyleClass('bg-red-100 text-red-700 font-bold border-red-200');
         return;
      }
      if (schedule.status === 'CONCLUDED') {
         setTimeLeft('Concluída');
         setStyleClass('bg-blue-100 text-blue-700 font-bold border-blue-200');
         return;
      }

      const now = new Date();
      const datePart = schedule.date.split('T')[0];
      const examDate = new Date(`${datePart}T${schedule.time}`);
      
      if (isNaN(examDate.getTime())) {
          setTimeLeft('Data Inválida');
          return;
      }
      
      const closeTime = new Date(examDate.getTime() - (24 * 60 * 60 * 1000));
      
      if (now > closeTime) {
         if (schedule.status === 'OPEN') {
             setTimeLeft('Fechando...'); 
             setStyleClass('bg-orange-100 text-orange-700 animate-pulse border-orange-200');
         } else {
             const timeToExam = examDate.getTime() - now.getTime();
             if (timeToExam > 0) {
                 const hours = Math.floor(timeToExam / (1000 * 60 * 60));
                 const minutes = Math.floor((timeToExam % (1000 * 60 * 60)) / (1000 * 60));
                 setTimeLeft(`Prova em: ${hours}h ${minutes}m`);
                 setStyleClass('bg-blue-100 text-blue-700 border-blue-200 font-bold');
             } else {
                 setTimeLeft('Em Andamento');
                 setStyleClass('bg-green-100 text-green-700 border-green-200 font-bold animate-pulse');
             }
         }
         return;
      }

      const diff = closeTime.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
          setTimeLeft(`Fecha em: ${days}d ${hours}h`);
          setStyleClass('bg-green-50 text-green-700 border-green-100');
      } else {
          setTimeLeft(`Fecha em: ${hours}h ${minutes}m`);
          setStyleClass(hours < 2 ? 'bg-red-50 text-red-600 font-bold border-red-100 animate-pulse' : 'bg-orange-50 text-orange-600 border-orange-100');
      }
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [schedule]);

  return (
    <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border shadow-sm transition-colors whitespace-nowrap ${styleClass}`}>
      <Hourglass className="h-3 w-3" />
      {timeLeft}
    </div>
  );
};

const SchedulingCenter: React.FC = () => {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [allRequests, setAllRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'CONCLUDED' | 'CANCELLED'>('ALL');
  const [dateStartFilter, setDateStartFilter] = useState('');
  const [dateEndFilter, setDateEndFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'CREATE' | 'EDIT'>('CREATE');
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ 
    date: '', 
    time: '', 
    examiner1: '', 
    examiner2: '', 
    examiner3: '', 
    maxSlotsA: 10,
    maxSlotsB: 10
  });

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [scheduleToCancel, setScheduleToCancel] = useState<ExamSchedule | null>(null);

  const [selectedSchedule, setSelectedSchedule] = useState<ExamSchedule | null>(null);
  const [scheduledStudents, setScheduledStudents] = useState<ExamRequest[]>([]);
  
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<ExamRequest[]>([]);
  const [selectedStudentsMap, setSelectedStudentsMap] = useState<Record<string, string>>({});
  const [studentFilter, setStudentFilter] = useState('');

  const [studentToRemove, setStudentToRemove] = useState<string | null>(null);
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);

  const refreshData = async () => {
    const [scheds, exams, sysSettings, requests] = await Promise.all([
        api.getSchedules(), 
        api.getExaminersAsync(),
        api.getSettings(),
        api.getRequests()
    ]);
    scheds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSchedules(scheds);
    setExaminers(exams);
    setSettings(sysSettings);
    setAllRequests(requests);
    setLoading(false);
  };

  useEffect(() => { refreshData(); }, []);

  useEffect(() => {
    if (selectedSchedule) {
      const updatedSel = schedules.find(s => s.id === selectedSchedule.id);
      if (updatedSel) {
          if (JSON.stringify(updatedSel) !== JSON.stringify(selectedSchedule)) {
              setSelectedSchedule(updatedSel);
          }
          updateStudentLists(updatedSel.id);
      }
    }
  }, [schedules, selectedSchedule]);

  const updateStudentLists = async (scheduleId: string) => {
    const requests = await api.getRequests();
    setAllRequests(requests);
    setScheduledStudents(requests.filter(r => r.scheduleId === scheduleId));
    const eligible = requests.filter(r => 
      r.examType === ExamType.COMMON && 
      !r.scheduleId && 
      r.status === ExamStatus.WAITING_SCHEDULING
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    setAvailableStudents(eligible);
  };

  const isScheduleOpen = selectedSchedule?.status === 'OPEN';
  const isScheduleClosed = selectedSchedule?.status === 'CLOSED';
  const canEditSchedule = isScheduleOpen;
  const canManageStudents = isScheduleOpen;
  const canCancel = isScheduleOpen || isScheduleClosed;
  const canInteractStudent = isScheduleOpen || isScheduleClosed;

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    const ids = [scheduleForm.examiner1, scheduleForm.examiner2, scheduleForm.examiner3].filter(Boolean);
    if (ids.length === 0) return alert("Selecione pelo menos um examinador.");

    const payload = {
        date: scheduleForm.date,
        time: scheduleForm.time,
        examinerIds: ids,
        maxSlotsA: scheduleForm.maxSlotsA,
        maxSlotsB: scheduleForm.maxSlotsB
    };

    if (modalMode === 'CREATE') {
        await api.createSchedule({ ...payload, type: ExamType.COMMON });
    } else if (modalMode === 'EDIT' && editingScheduleId) {
        await api.updateSchedule(editingScheduleId, payload);
    }

    setIsModalOpen(false);
    refreshData();
  };

  const handleConfirmCancel = async () => {
      if (!scheduleToCancel || !cancelReason) return;
      await api.cancelSchedule(scheduleToCancel.id, cancelReason);
      setIsCancelModalOpen(false);
      setScheduleToCancel(null);
      refreshData();
  };

  const handleAddStudents = async () => {
    if (!selectedSchedule) return;
    for (const [reqId, category] of Object.entries(selectedStudentsMap)) {
      await api.assignStudentToSchedule(reqId, selectedSchedule.id, category as string);
    }
    setIsAddStudentOpen(false);
    setSelectedStudentsMap({});
    refreshData();
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove || !selectedSchedule) return;
    setProcessingStudentId(studentToRemove);
    try {
      await api.removeStudentFromSchedule(studentToRemove);
      await refreshData();
    } finally {
      setProcessingStudentId(null);
      setStudentToRemove(null);
    }
  };

  const handleToggleConfirmation = async (e: React.MouseEvent, req: ExamRequest) => {
      e.stopPropagation();
      setScheduledStudents(prev => prev.map(s => s.id === req.id ? {...s, attendanceConfirmed: !s.attendanceConfirmed} : s));
      try {
          await api.updateRequest(req.id, { attendanceConfirmed: !req.attendanceConfirmed });
      } catch {
          refreshData();
      }
  };

  const handleSendWhatsapp = (e: React.MouseEvent, req: ExamRequest) => {
      e.stopPropagation();
      const phone = "55" + req.phone.replace(/\D/g, '');
      const msgTemplate = settings?.whatsappMessageTemplate || "Olá {CANDIDATO}, seu exame é dia {DATA}.";
      let fullAddress = settings?.defaultExamAddress || 'Local a definir';
      if (settings?.defaultExamAddressLink) fullAddress += ` ${settings.defaultExamAddressLink}`;
      const msg = msgTemplate
        .replace(/{CANDIDATO}/g, req.socialName || req.studentName)
        .replace(/{ALUNO}/g, req.socialName || req.studentName)
        .replace(/{DATA}/g, formatDateDisplay(req.scheduledDate!))
        .replace(/{HORA}/g, req.scheduledTime!)
        .replace(/{CATEGORIA}/g, req.scheduledCategory || 'B')
        .replace(/{ENDERECO}/g, fullAddress);
      window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleOpenEdit = (schedule: ExamSchedule) => {
    setModalMode('EDIT');
    setEditingScheduleId(schedule.id);
    setScheduleForm({
        date: schedule.date.split('T')[0],
        time: schedule.time,
        examiner1: schedule.examinerIds[0] || '',
        examiner2: schedule.examinerIds[1] || '',
        examiner3: schedule.examinerIds[2] || '',
        maxSlotsA: schedule.maxSlotsA,
        maxSlotsB: schedule.maxSlotsB
    });
    setIsModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearFilters = () => {
      setStatusFilter('ALL');
      setDateStartFilter('');
      setDateEndFilter('');
  };

  const getExaminerName = (id?: string) => {
      if (!id) return null;
      return examiners.find(e => e.id === id)?.name || 'Desconhecido';
  };

  const getSlotCounts = (schedule: ExamSchedule, students: ExamRequest[]) => {
      const countA = students.filter(s => s.scheduledCategory === 'A').length;
      const countB = students.filter(s => s.scheduledCategory === 'B').length;
      return { 
          A: { current: countA, max: schedule.maxSlotsA || 10 },
          B: { current: countB, max: schedule.maxSlotsB || 10 }
      };
  };

  const getStatusBadge = (status: string) => {
      const map: Record<string, React.ReactNode> = {
          'OPEN': <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded uppercase">Aberta</span>,
          'CLOSED': <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded uppercase">Fechada</span>,
          'CONCLUDED': <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase">Concluída</span>,
          'CANCELLED': <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded uppercase">Cancelada</span>
      };
      return map[status] || null;
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;

  const currentCounts = selectedSchedule ? getSlotCounts(selectedSchedule, scheduledStudents) : null;
  const filteredSchedules = schedules.filter(s => {
      if (s.type !== ExamType.COMMON) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (dateStartFilter && s.date < dateStartFilter) return false;
      if (dateEndFilter && s.date > dateEndFilter) return false;
      return true;
  });

  const hasUnconfirmed = scheduledStudents.some(s => !s.attendanceConfirmed);

  return (
    <>
      {selectedSchedule ? (
        <div className="space-y-6">
          <div className="print:hidden flex items-center gap-2 text-sm text-gray-500 mb-4 cursor-pointer hover:text-blue-600" onClick={() => setSelectedSchedule(null)}>
            <ChevronRight className="h-4 w-4 rotate-180" /> Voltar para Bancas
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
            {/* Header Detalhes */}
            {/* AJUSTE: print:pb-0.5 reduz o espaço da linha preta com o texto */}
            <div className="p-6 border-b border-gray-100 bg-gray-50 print:bg-white print:border-b-2 print:border-black print:p-0 print:pb-0.5 print:mb-3">
              
              <div className="hidden print:block mb-4">
                  {/* Linha Logo e Título */}
                  <div className="flex items-center gap-4 mb-2 border-b-2 border-black pb-2">
                      {settings?.logoUrl && <img src={settings.logoUrl} alt="Logo" className="h-14 w-auto object-contain max-w-[80px]" />}
                      <div>
                          <h1 className="text-sm font-bold text-black uppercase">{settings?.agencyName || 'DETRAN'}</h1>
                          <p className="text-lg font-black text-black uppercase">Lista de Chamada - 1ª Habilitação</p>
                      </div>
                  </div>
                  
                  {/* Linha Detalhes da Banca (Recolocada para impressão) */}
                  <div className="flex justify-between items-center text-black text-[11px]">
                       <div>
                          <span className="font-bold mr-2">DATA:</span> {formatDateDisplay(selectedSchedule.date)}
                          <span className="font-bold ml-6 mr-2">HORA:</span> {selectedSchedule.time}
                       </div>
                       <div className="uppercase">
                          <span className="font-bold mr-2">EXAMINADORES:</span> 
                          {selectedSchedule.examinerIds.map(id => getExaminerName(id)).join(', ')}
                       </div>
                  </div>
              </div>

              {selectedSchedule.status === 'CANCELLED' && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 print:border-black print:bg-white print:border">
                      <div className="flex items-center gap-2 text-red-800 print:text-black font-bold"><Ban className="h-5 w-5" /> BANCA CANCELADA</div>
                      <p className="text-sm text-red-700 mt-1 print:text-black">Motivo: {selectedSchedule.cancellationReason}</p>
                  </div>
              )}

              <div className="flex justify-between items-start print:hidden">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-gray-900">Lista de Chamada</h2>
                        {getStatusBadge(selectedSchedule.status)}
                        {selectedSchedule.status === 'OPEN' && <CountdownTimer schedule={selectedSchedule} />}
                    </div>
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500" /> {formatDateDisplay(selectedSchedule.date)}</div>
                      <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500" /> {selectedSchedule.time}</div>
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-1 font-medium ${currentCounts!.A.current >= currentCounts!.A.max ? 'text-red-600' : 'text-gray-600'}`}>
                          <CheckSquare className="h-4 w-4" /> Moto: {currentCounts!.A.current} / {currentCounts!.A.max}
                        </div>
                        <div className={`flex items-center gap-1 font-medium ${currentCounts!.B.current >= currentCounts!.B.max ? 'text-red-600' : 'text-gray-600'}`}>
                          <CheckSquare className="h-4 w-4" /> Carro: {currentCounts!.B.current} / {currentCounts!.B.max}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {canEditSchedule && (
                        <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(selectedSchedule); }} className="flex items-center gap-2 px-3 py-2 border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 bg-white shadow-sm">
                            <Edit2 className="h-4 w-4" /> Editar
                        </button>
                    )}
                    {canCancel && (
                        <button onClick={() => { setScheduleToCancel(selectedSchedule); setIsCancelModalOpen(true); }} className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 bg-white shadow-sm">
                            <Ban className="h-4 w-4" /> Cancelar
                        </button>
                    )}
                    <button onClick={handlePrint} disabled={hasUnconfirmed} className={`flex items-center gap-2 px-4 py-2 border rounded-md shadow-sm transition-colors ${hasUnconfirmed ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
                      <Printer className="h-4 w-4" /> Imprimir
                    </button>
                    {canManageStudents && (
                        <button onClick={() => setIsAddStudentOpen(true)} disabled={currentCounts!.A.current >= currentCounts!.A.max && currentCounts!.B.current >= currentCounts!.B.max} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 shadow-sm">
                           <Plus className="h-4 w-4" /> Adicionar
                        </button>
                    )}
                  </div>
              </div>
            </div>

            {/* Tabelas de Alunos */}
            <div className="p-0 print:p-0">
               {['A', 'B'].map((cat) => {
                   const students = scheduledStudents.filter(s => (s.scheduledCategory === cat) || (cat === 'B' && !s.scheduledCategory && !s.intendedCategory?.includes('A')));
                   if (cat === 'A' && students.length === 0) return null;
                   
                   return (
                       <div key={cat} className="mb-8 print:mb-6 break-inside-avoid">
                          <h3 className="text-lg font-bold text-gray-800 mb-3 px-6 pt-4 border-l-4 border-blue-600 flex items-center gap-2 print:border-none print:px-0 print:pt-4 print:mb-2 print:text-[13px] uppercase">
                              <Layers className="h-5 w-5 print:h-4 print:w-4" /> Categoria {cat}
                          </h3>
                          <table className="w-full text-sm text-left border-collapse print:text-[11px]">
                              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 print:bg-white print:border-black print:border-b">
                                  <tr>
                                      <th className="px-6 py-3 w-10 print:border print:border-black print:px-2 print:py-1">#</th>
                                      <th className="px-6 py-3 print:border print:border-black print:px-2 print:py-1 print:w-[110px]">CPF</th>
                                      <th className="px-6 py-3 print:border print:border-black print:px-2 print:py-1 print:w-auto">Nome</th>
                                      <th className="hidden print:table-cell px-2 py-3 print:border print:border-black w-24">Restrição</th>
                                      <th className="px-6 py-3 print:hidden">Autoescola</th>
                                      <th className="px-6 py-3 print:hidden text-right">Ações</th>
                                      <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black w-12 text-[10px]">Faltou</th>
                                      <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black w-12 text-[10px]">Apto</th>
                                      <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black print:border-r-2 w-12 text-[10px]">Inapto</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {students.map((req, idx) => (
                                      <tr key={req.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                                          <td className="px-6 py-4 font-medium text-gray-500 print:border print:border-black print:px-2 print:py-0.5 align-middle">{idx + 1}</td>
                                          <td className="px-6 py-4 text-gray-600 print:border print:border-black print:px-2 print:py-0.5 print:text-black align-middle">{req.cpf}</td>
                                          <td className="px-6 py-4 font-medium text-gray-900 uppercase print:border print:border-black print:px-2 print:py-0.5 print:text-black align-middle">{req.socialName || req.studentName}</td>
                                          <td className="hidden print:table-cell print:border print:border-black print:px-2 print:py-0.5 text-center align-middle uppercase">{req.cnhRestriction || '-'}</td>
                                          <td className="px-6 py-4 text-gray-600 print:hidden">{req.schoolId ? api.getSchools().find(s => s.id === req.schoolId)?.name : 'Particular'}</td>
                                          <td className="px-6 py-4 text-right print:hidden flex justify-end gap-2">
                                              {canInteractStudent ? (
                                                  <>
                                                      <button onClick={(e) => handleSendWhatsapp(e, req)} className="text-green-600 bg-green-50 p-2 rounded-md border border-green-100 w-8 h-8 flex items-center justify-center"><MessageCircle className="h-4 w-4" /></button>
                                                      <button onClick={(e) => handleToggleConfirmation(e, req)} className={`p-2 rounded-md border w-8 h-8 flex items-center justify-center ${req.attendanceConfirmed ? 'bg-blue-600 text-white' : 'text-gray-400 bg-gray-50'}`}>
                                                          {req.attendanceConfirmed ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                                      </button>
                                                      {canManageStudents && (
                                                          <button onClick={(e) => { e.preventDefault(); setStudentToRemove(req.id); }} disabled={processingStudentId === req.id} className="text-red-500 bg-red-50 p-2 rounded-md border border-red-100 w-8 h-8 flex items-center justify-center">
                                                              {processingStudentId === req.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                          </button>
                                                      )}
                                                  </>
                                              ) : <span className="text-gray-400 text-xs italic">Bloqueado</span>}
                                          </td>
                                          <td className="hidden print:table-cell print:border print:border-black print:p-0 align-middle">
                                            <div className="flex items-center justify-center h-full py-1.5">
                                              <span className="w-4 h-4 border border-black block"></span>
                                            </div>
                                          </td>
                                          <td className="hidden print:table-cell print:border print:border-black print:p-0 align-middle">
                                            <div className="flex items-center justify-center h-full py-1.5">
                                              <span className="w-4 h-4 border border-black block"></span>
                                            </div>
                                          </td>
                                          <td className="hidden print:table-cell print:border print:border-black print:border-r-2 print:p-0 align-middle">
                                            <div className="flex items-center justify-center h-full py-1.5">
                                              <span className="w-4 h-4 border border-black block"></span>
                                            </div>
                                          </td>
                                      </tr>
                                  ))}
                                  {students.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400 italic print:border print:border-black print:py-2">Nenhum candidato nesta categoria.</td></tr>}
                              </tbody>
                          </table>
                       </div>
                   );
               })}
            </div>

            {/* Rodapé Impressão - Corrigido para empilhamento vertical e campo de assinatura */}
            <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t border-black pt-4 pb-4 flex-col items-center justify-center text-[10px] leading-tight">
                 
                 {/* BLOCO DE ASSINATURA */}
                 <div className="mb-6 flex flex-col items-center">
                    <div className="w-64 border-b border-black mb-1"></div>
                    <span className="font-bold text-[9px] uppercase">Assinatura do Examinador</span>
                 </div>

                 {settings?.agencyAddress && (
                   <div className="font-bold uppercase w-full text-center mb-0.5">
                     {settings.agencyAddress}
                   </div>
                 )}
                 <div className="w-full text-center">
                   Impressão: {new Date().toLocaleDateString()}
                 </div>
            </div>
          </div>

          {/* Modais omitidos para brevidade mas mantidos conforme estado anterior */}
          {isAddStudentOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-bold text-lg">Adicionar Candidatos</h3>
                  <button onClick={() => setIsAddStudentOpen(false)}><X className="h-5 w-5 text-gray-500" /></button>
                </div>
                <div className="p-4 bg-gray-50 border-b">
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input type="text" placeholder="Filtrar por nome ou CPF..." className="w-full pl-10 pr-4 py-2 border rounded-md text-gray-900 bg-white" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} />
                   </div>
                </div>
                <div className="flex-1 overflow-y-auto p-0 text-gray-900">
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y">
                      {availableStudents
                        .filter(s => (s.socialName || s.studentName).toLowerCase().includes(studentFilter.toLowerCase()) || s.cpf.includes(studentFilter))
                        .map(s => {
                           const isSelected = !!selectedStudentsMap[s.id];
                           const cat = s.intendedCategory === 'A' ? 'A' : 'B';
                           const selectedCount = Object.values(selectedStudentsMap).filter(c => c === cat).length;
                           const isFull = !isSelected && (currentCounts![cat].current + selectedCount >= currentCounts![cat].max);
                           
                           return (
                               <tr key={s.id} className={`hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : ''} ${isFull ? 'opacity-50' : ''}`}>
                                   <td className="px-4 py-3"><input type="checkbox" checked={isSelected} disabled={isFull} onChange={(e) => setSelectedStudentsMap(prev => { const n = {...prev}; e.target.checked ? n[s.id] = cat : delete n[s.id]; return n; })} /></td>
                                   <td className="px-4 py-3">{s.socialName || s.studentName} <div className="text-xs text-gray-500">{s.cpf}</div></td>
                                   <td className="px-4 py-3"><span className="font-bold px-2 py-1 rounded text-xs bg-gray-100">{cat}</span></td>
                                   <td className="px-4 py-3">{isFull ? <span className="text-red-600 text-xs font-bold">Lotado</span> : <span className="text-green-600 text-xs">Disponível</span>}</td>
                               </tr>
                           );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t flex justify-end gap-2">
                     <button onClick={() => setIsAddStudentOpen(false)} className="px-4 py-2 border rounded">Cancelar</button>
                     <button onClick={handleAddStudents} disabled={Object.keys(selectedStudentsMap).length === 0} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">Confirmar</button>
                </div>
              </div>
            </div>
          )}
          {studentToRemove && (
              <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                 <div className="bg-white rounded-lg p-6 max-w-sm text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="font-bold text-lg mb-2">Remover Candidato?</h3>
                    <p className="text-gray-500 text-sm mb-6">Ele voltará para a fila de espera.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setStudentToRemove(null)} className="flex-1 border py-2 rounded">Cancelar</button>
                        <button onClick={confirmRemoveStudent} className="flex-1 bg-red-600 text-white py-2 rounded">Remover</button>
                    </div>
                 </div>
              </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Central de Agendamentos</h2>
            <button onClick={() => { setModalMode('CREATE'); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 shadow-sm"><Plus className="h-5 w-5" /> Nova Banca</button>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
             <div className="flex-1 min-w-[200px]">
                 <label className="text-xs font-medium text-gray-500">Status</label>
                 <select className="w-full border rounded p-2 bg-white text-gray-900" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                     <option value="ALL">Todas</option>
                     <option value="OPEN">Abertas</option>
                     <option value="CLOSED">Fechadas</option>
                     <option value="CONCLUDED">Concluídas</option>
                     <option value="CANCELLED">Canceladas</option>
                 </select>
             </div>
             <button onClick={handleClearFilters} className="px-4 py-2 bg-gray-100 text-gray-600 rounded flex items-center gap-2"><RotateCcw className="h-4 w-4"/> Limpar</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredSchedules.map(s => {
                 const sReqs = allRequests.filter(r => r.scheduleId === s.id && r.status !== 'CANCELLED');
                 const countA = sReqs.filter(r => r.scheduledCategory === 'A').length;
                 const countB = sReqs.filter(r => r.scheduledCategory === 'B').length;
                 return (
                 <div key={s.id} onClick={() => setSelectedSchedule(s)} className="bg-white rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow group relative">
                     {s.status === 'OPEN' && (
                         <div className="absolute top-4 right-4 z-10">
                             <CountdownTimer schedule={s} />
                         </div>
                     )}
                     <div className="flex justify-between items-start mb-4">
                         <div className="bg-blue-50 text-blue-700 p-2 rounded-lg group-hover:bg-blue-100 transition-colors"><Calendar className="h-6 w-6" /></div>
                     </div>
                     <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold">{formatDateDisplay(s.date)}</h3>
                        {getStatusBadge(s.status)}
                     </div>
                     <p className="text-gray-500 text-sm flex items-center gap-2 mt-1"><Clock className="h-3 w-3" /> {s.time}</p>
                     <div className="border-t mt-3 pt-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <User className="h-3 w-3" /> {s.examinerIds[0] ? getExaminerName(s.examinerIds[0]) : 'Não atribuído'}
                        </div>
                        <div className="text-xs text-gray-500 flex justify-between font-medium">
                            <span className={countA >= s.maxSlotsA ? "text-red-600 font-bold" : ""}>Vagas Moto: {countA}/{s.maxSlotsA}</span>
                            <span className={countB >= s.maxSlotsB ? "text-red-600 font-bold" : ""}>Vagas Carro: {countB}/{s.maxSlotsB}</span>
                        </div>
                     </div>
                 </div>
             )})}
          </div>
        </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-gray-900">
                  <h3 className="text-lg font-bold mb-4">{modalMode === 'CREATE' ? 'Nova Banca' : 'Editar Banca'}</h3>
                  <form onSubmit={handleSubmitSchedule} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-sm">Data</label><input required type="date" className="w-full border rounded p-2 bg-white" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} /></div>
                          <div><label className="text-sm">Hora</label><input required type="time" className="w-full border rounded p-2 bg-white" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div><label className="text-sm">Vagas Moto (A)</label><input type="number" className="w-full border rounded p-2 bg-white" value={scheduleForm.maxSlotsA} onChange={e => setScheduleForm({...scheduleForm, maxSlotsA: Number(e.target.value)})} /></div>
                          <div><label className="text-sm">Vagas Carro (B)</label><input type="number" className="w-full border rounded p-2 bg-white" value={scheduleForm.maxSlotsB} onChange={e => setScheduleForm({...scheduleForm, maxSlotsB: Number(e.target.value)})} /></div>
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

      {isCancelModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-gray-900">
                  <h3 className="font-bold text-lg text-red-600 flex items-center gap-2 mb-4"><Ban /> Cancelar Banca</h3>
                  <label className="block text-sm font-medium mb-1">Motivo</label>
                  <textarea className="w-full border rounded p-2 bg-white" rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                  <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => setIsCancelModalOpen(false)} className="px-4 py-2 border rounded">Voltar</button>
                      <button onClick={handleConfirmCancel} className="px-4 py-2 bg-red-600 text-white rounded">Confirmar</button>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default SchedulingCenter;