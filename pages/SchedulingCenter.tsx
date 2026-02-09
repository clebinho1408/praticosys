import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, ExamSchedule, ExamType, Examiner, ExamStatus, SystemSettings } from '../types';
import { Calendar, Clock, User, Plus, Search, ChevronRight, FileText, X, CheckSquare, Printer, Trash2, Layers, Edit2, Loader2, AlertTriangle, MessageCircle, CheckCircle, Circle, Filter, RotateCcw, Ban, Info } from 'lucide-react';

const SchedulingCenter: React.FC = () => {
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'CONCLUDED' | 'CANCELLED'>('ALL');
  const [dateStartFilter, setDateStartFilter] = useState('');
  const [dateEndFilter, setDateEndFilter] = useState('');

  // Modal Create/Edit
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

  // Cancel Modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [scheduleToCancel, setScheduleToCancel] = useState<ExamSchedule | null>(null);

  // Manage View (Selected Schedule)
  const [selectedSchedule, setSelectedSchedule] = useState<ExamSchedule | null>(null);
  const [scheduledStudents, setScheduledStudents] = useState<ExamRequest[]>([]);
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [studentToRemove, setStudentToRemove] = useState<string | null>(null);

  // Add Students Modal
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<ExamRequest[]>([]);
  
  // State for selecting students
  const [selectedStudentsMap, setSelectedStudentsMap] = useState<Record<string, string>>({});
  const [studentFilter, setStudentFilter] = useState('');

  const refreshData = async () => {
    const [scheds, exams, sysSettings] = await Promise.all([
        api.getSchedules(), 
        api.getExaminersAsync(),
        api.getSettings()
    ]);
    // Sort schedules by date desc
    scheds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setSchedules(scheds);
    setExaminers(exams);
    setSettings(sysSettings);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Update lists when a schedule is selected
  useEffect(() => {
    if (selectedSchedule) {
      // Refresh current schedule object from state to get latest status
      const updatedSel = schedules.find(s => s.id === selectedSchedule.id);
      if (updatedSel) {
          if (updatedSel.status !== selectedSchedule.status) {
              setSelectedSchedule(updatedSel);
          }
          updateStudentLists(updatedSel.id);
      }
    }
  }, [selectedSchedule, schedules]);

  const updateStudentLists = async (scheduleId: string) => {
    const allRequests = await api.getRequests();
    
    // Students currently in this schedule
    const inSchedule = allRequests.filter(r => r.scheduleId === scheduleId);
    setScheduledStudents(inSchedule);

    // Students eligible for this schedule
    // Filter: Common exam type, not scheduled yet, strict status 'WAITING_SCHEDULING'
    // Sort: CreatedAt Ascending (Oldest first)
    const eligible = allRequests.filter(r => 
      r.examType === ExamType.COMMON && 
      !r.scheduleId && 
      r.status === ExamStatus.WAITING_SCHEDULING
    ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    setAvailableStudents(eligible);
  };

  const handleOpenCreate = () => {
    setModalMode('CREATE');
    setEditingScheduleId(null);
    setScheduleForm({ 
        date: '', 
        time: '', 
        examiner1: '', 
        examiner2: '', 
        examiner3: '', 
        maxSlotsA: settings?.defaultMaxSlotsA || 10, 
        maxSlotsB: settings?.defaultMaxSlotsB || 10 
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (schedule: ExamSchedule) => {
    setModalMode('EDIT');
    setEditingScheduleId(schedule.id);
    setScheduleForm({ 
        date: schedule.date, 
        time: schedule.time, 
        examiner1: schedule.examinerIds[0] || '', 
        examiner2: schedule.examinerIds[1] || '', 
        examiner3: schedule.examinerIds[2] || '', 
        maxSlotsA: schedule.maxSlotsA || 10,
        maxSlotsB: schedule.maxSlotsB || 10
    });
    setIsModalOpen(true);
  };

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine examiners into array, filtering empty ones
    const ids = [scheduleForm.examiner1, scheduleForm.examiner2, scheduleForm.examiner3].filter(Boolean);
    
    if (ids.length === 0) {
        alert("Selecione pelo menos um examinador.");
        return;
    }

    if (modalMode === 'CREATE') {
        await api.createSchedule({
          date: scheduleForm.date,
          time: scheduleForm.time,
          examinerIds: ids,
          maxSlotsA: scheduleForm.maxSlotsA,
          maxSlotsB: scheduleForm.maxSlotsB,
          type: ExamType.COMMON
        });
    } else if (modalMode === 'EDIT' && editingScheduleId) {
        const updated = await api.updateSchedule(editingScheduleId, {
          date: scheduleForm.date,
          time: scheduleForm.time,
          examinerIds: ids,
          maxSlotsA: scheduleForm.maxSlotsA,
          maxSlotsB: scheduleForm.maxSlotsB
        });
        
        // Update local view if editing currently selected schedule
        if (selectedSchedule && selectedSchedule.id === editingScheduleId) {
            setSelectedSchedule(updated);
        }
    }

    setIsModalOpen(false);
    refreshData();
  };

  const handleOpenCancelModal = (schedule: ExamSchedule) => {
      setScheduleToCancel(schedule);
      setCancelReason('');
      setIsCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
      if (!scheduleToCancel || !cancelReason) return;
      
      await api.cancelSchedule(scheduleToCancel.id, cancelReason);
      setIsCancelModalOpen(false);
      setScheduleToCancel(null);
      refreshData();
      
      // If we were viewing the schedule, refresh lists (students should be gone)
      if (selectedSchedule && selectedSchedule.id === scheduleToCancel.id) {
          updateStudentLists(scheduleToCancel.id);
      }
  };

  const handleToggleStudentSelection = (req: ExamRequest, isChecked: boolean) => {
      setSelectedStudentsMap(prev => {
          const next = { ...prev };
          if (isChecked) {
              const cat = req.intendedCategory === 'A' ? 'A' : 'B';
              next[req.id] = cat;
          } else {
              delete next[req.id];
          }
          return next;
      });
  };

  const handleAddStudents = async () => {
    const entries = Object.entries(selectedStudentsMap);
    for (const [reqId, category] of entries) {
      await api.assignStudentToSchedule(reqId, selectedSchedule!.id, category as string);
    }
    setIsAddStudentOpen(false);
    setSelectedStudentsMap({});
    updateStudentLists(selectedSchedule!.id);
    refreshData();
  };

  const handleRemoveClick = (e: React.MouseEvent, reqId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setStudentToRemove(reqId);
  };

  const confirmRemoveStudent = async () => {
    if (!studentToRemove) return;
    
    const reqId = studentToRemove;
    setProcessingStudentId(reqId);
    
    try {
      // Optimistic UI update
      setScheduledStudents(prev => prev.filter(s => s.id !== reqId));

      await api.removeStudentFromSchedule(reqId);
      
      await refreshData();
      if (selectedSchedule) {
            await updateStudentLists(selectedSchedule.id);
      }
    } catch (error) {
      console.error("Error removing student:", error);
      alert("Erro ao remover candidato. Tente novamente.");
      if (selectedSchedule) updateStudentLists(selectedSchedule.id);
    } finally {
      setProcessingStudentId(null);
      setStudentToRemove(null);
    }
  };

  const generateMessage = (req: ExamRequest) => {
    if (!settings) return "";
    
    let message = settings.whatsappMessageTemplate || "Olá {CANDIDATO}, seu exame está marcado.";
      
    // Prepare address string
    let fullAddress = settings.defaultExamAddress || '';
    if (settings.defaultExamAddressLink) {
        fullAddress += ` ${settings.defaultExamAddressLink}`;
    }
    if (!fullAddress) fullAddress = 'Local a definir';

    // Se tiver nome social, usa ele
    const displayName = req.socialName || req.studentName;

    message = message
        .replace('{CANDIDATO}', displayName)
        .replace('{ALUNO}', displayName) // Backward compatibility just in case
        .replace('{DATA}', new Date(req.scheduledDate!).toLocaleDateString())
        .replace('{HORA}', req.scheduledTime!)
        .replace('{CATEGORIA}', req.scheduledCategory || req.intendedCategory || 'B')
        .replace('{ENDERECO}', fullAddress);
    
    return message;
  }

  const handleSendWhatsapp = (e: React.MouseEvent, req: ExamRequest) => {
      e.stopPropagation();
      e.preventDefault();
      
      const phone = "55" + req.phone.replace(/\D/g, '');
      const message = generateMessage(req);

      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleToggleConfirmation = async (e: React.MouseEvent, req: ExamRequest) => {
      e.stopPropagation();
      e.preventDefault();

      const newStatus = !req.attendanceConfirmed;
      
      // Optimistic update
      setScheduledStudents(prev => prev.map(s => s.id === req.id ? {...s, attendanceConfirmed: newStatus} : s));

      try {
          await api.updateRequest(req.id, { attendanceConfirmed: newStatus });
          // No need to full refresh, optimistic update handles UI
      } catch (err) {
          console.error("Error toggling confirmation", err);
          // Revert on error
          setScheduledStudents(prev => prev.map(s => s.id === req.id ? {...s, attendanceConfirmed: !newStatus} : s));
      }
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
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
  }

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'OPEN': return <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded uppercase">Aberta</span>;
          case 'CLOSED': return <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded uppercase">Fechada</span>;
          case 'CONCLUDED': return <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase">Concluída</span>;
          case 'CANCELLED': return <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded uppercase">Cancelada</span>;
          default: return null;
      }
  }

  // Helper to count slots
  const getSlotCounts = (schedule: ExamSchedule, students: ExamRequest[]) => {
      const countA = students.filter(s => s.scheduledCategory === 'A').length;
      const countB = students.filter(s => s.scheduledCategory === 'B').length;
      return { 
          A: { current: countA, max: schedule.maxSlotsA || 10 },
          B: { current: countB, max: schedule.maxSlotsB || 10 }
      };
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando Central de Agendamentos...</div>;

  const currentCounts = selectedSchedule ? getSlotCounts(selectedSchedule, scheduledStudents) : null;

  const filteredSchedules = schedules.filter(s => {
      // Must be Common Type
      if (s.type !== ExamType.COMMON) return false;

      // Status Filter
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;

      // Date Filter
      if (dateStartFilter && s.date < dateStartFilter) return false;
      if (dateEndFilter && s.date > dateEndFilter) return false;

      return true;
  });

  // Permission Logic
  const canEdit = selectedSchedule?.status === 'OPEN';
  const canAddStudent = selectedSchedule?.status === 'OPEN';
  const canCancel = selectedSchedule?.status === 'OPEN' || selectedSchedule?.status === 'CLOSED';
  // Note: CLOSED allows cancel, CONCLUDED allows nothing.

  return (
    <>
      {selectedSchedule ? (
        // --- VIEW: DETAIL (Call List) ---
        <div className="space-y-6">
          <div className="print:hidden flex items-center gap-2 text-sm text-gray-500 mb-4 cursor-pointer hover:text-blue-600" onClick={() => setSelectedSchedule(null)}>
            <ChevronRight className="h-4 w-4 rotate-180" /> Voltar para Bancas
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-none">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 bg-gray-50 print:bg-white print:border-b-2 print:border-black">
              
              {/* PRINT HEADER */}
              <div className="hidden print:flex justify-between items-center mb-6 border-b-2 border-black pb-4">
                  <div className="flex items-center gap-4">
                      {settings?.logoUrl && (
                          <img src={settings.logoUrl} alt="Logo Agência" className="h-20 w-auto object-contain max-w-[150px]" />
                      )}
                  </div>
                  <div className="text-right">
                      <h1 className="text-3xl font-bold text-black uppercase">{settings?.agencyName || 'DETRAN'}</h1>
                      {settings?.agencyAddress && (
                          <p className="text-sm text-black">{settings.agencyAddress}</p>
                      )}
                      <p className="text-sm text-gray-600 uppercase font-semibold mt-1">Lista de Chamada - 1ª Habilitação</p>
                  </div>
              </div>

              {/* CANCELLED NOTICE */}
              {selectedSchedule.status === 'CANCELLED' && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 print:border-black print:bg-white print:border">
                      <div className="flex items-center gap-2 text-red-800 print:text-black">
                          <Ban className="h-5 w-5" />
                          <span className="font-bold">BANCA CANCELADA</span>
                      </div>
                      <p className="text-sm text-red-700 mt-1 print:text-black">Motivo: {selectedSchedule.cancellationReason}</p>
                  </div>
              )}

              {/* CONCLUDED NOTICE */}
              {selectedSchedule.status === 'CONCLUDED' && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 print:hidden">
                      <div className="flex items-center gap-2 text-blue-800">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-bold">BANCA CONCLUÍDA</span>
                      </div>
                      <p className="text-sm text-blue-700 mt-1">Os exames foram finalizados e os candidatos atualizados para "Aguardando Resultado".</p>
                  </div>
              )}

              <div className="flex justify-between items-start print:hidden">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-gray-900">Lista de Chamada - 1ª Habilitação</h2>
                        {getStatusBadge(selectedSchedule.status)}
                    </div>
                    
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{new Date(selectedSchedule.date).toLocaleDateString()}</span >
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{selectedSchedule.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Banca: {selectedSchedule.examinerIds.map(id => getExaminerName(id)).filter(Boolean).join(', ')}</span>
                      </div>
                      <div className="flex items-center gap-4 print:hidden">
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
                    {/* EDIT Button - Only if OPEN */}
                    {canEdit && (
                        <button 
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(selectedSchedule);
                        }}
                        className="flex items-center gap-2 px-3 py-2 border border-blue-200 text-blue-600 rounded-md hover:bg-blue-50 bg-white shadow-sm"
                        title="Editar Banca"
                        >
                        <Edit2 className="h-4 w-4" /> Editar
                        </button>
                    )}

                    {/* CANCEL Button - OPEN or CLOSED */}
                    {canCancel && (
                        <button 
                            type="button"
                            onClick={() => handleOpenCancelModal(selectedSchedule)}
                            className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-md hover:bg-red-50 bg-white shadow-sm"
                            title="Cancelar Banca"
                        >
                            <Ban className="h-4 w-4" /> Cancelar
                        </button>
                    )}

                    <button 
                      type="button"
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 bg-white shadow-sm"
                    >
                      <Printer className="h-4 w-4" /> Imprimir
                    </button>

                    {/* ADD STUDENTS - Only if OPEN */}
                    {canAddStudent && (
                        <button 
                        type="button"
                        onClick={() => setIsAddStudentOpen(true)}
                        disabled={(currentCounts!.A.current >= currentCounts!.A.max) && (currentCounts!.B.current >= currentCounts!.B.max)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                        <Plus className="h-4 w-4" /> Adicionar Candidatos
                        </button>
                    )}
                  </div>
              </div>
              
              {/* PRINT INFO SUB-HEADER */}
              <div className="hidden print:block text-sm mt-4">
                  <div className="grid grid-cols-2 gap-4">
                      <p><strong>Data:</strong> {new Date(selectedSchedule.date).toLocaleDateString()} - <strong>Hora:</strong> {selectedSchedule.time}</p>
                      <p><strong>Examinadores:</strong> {selectedSchedule.examinerIds.map(id => getExaminerName(id)).filter(Boolean).join(', ')}</p>
                  </div>
              </div>
            </div>

            {/* Student List Tables */}
            <div className="p-0 print:p-4">
               {/* Categoria A Table */}
               <div className="mb-8 break-inside-avoid">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 px-6 pt-4 border-l-4 border-blue-600 flex items-center gap-2 print:border-none print:px-0">
                      <Layers className="h-5 w-5" /> Categoria A (Moto)
                  </h3>
                  <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 print:bg-white print:border-black print:border-b">
                      <tr>
                          <th className="px-6 py-3 w-10 print:border print:border-black print:px-2">#</th>
                          <th className="px-6 py-3 print:border print:border-black print:px-2">CPF</th>
                          <th className="px-6 py-3 print:border print:border-black print:px-2">Nome do Candidato</th>
                          <th className="hidden print:table-cell px-2 py-3 print:border print:border-black w-24">Restrição</th>
                          <th className="px-6 py-3 print:hidden">Autoescola</th>
                          
                          {/* Screen Actions */}
                          <th className="px-6 py-3 print:hidden text-right">Ações</th>
                          
                          {/* Print Manual Fill Columns */}
                          <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black w-16 text-xs">Faltou</th>
                          <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black w-16 text-xs">Apto</th>
                          <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black w-16 text-xs">Inapto</th>
                      </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                      {scheduledStudents.filter(s => s.scheduledCategory === 'A').map((req, idx) => (
                          <tr key={req.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                          <td className="px-6 py-4 font-medium text-gray-500 print:border print:border-black print:px-2 print:py-2">{idx + 1}</td>
                          <td className="px-6 py-4 text-gray-600 print:border print:border-black print:px-2 print:py-2 print:text-black">{req.cpf}</td>
                          <td className="px-6 py-4 font-medium text-gray-900 uppercase print:border print:border-black print:px-2 print:py-2 print:text-black">
                              {/* Display Social Name if exists */}
                              {req.socialName ? req.socialName : req.studentName}
                              {req.attendanceConfirmed && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200 print:hidden">
                                      CONFIRMADO
                                  </span>
                              )}
                          </td>
                          <td className="hidden print:table-cell print:border print:border-black print:px-2 print:py-2 text-center">{req.cnhRestriction || '-'}</td>
                          <td className="px-6 py-4 text-gray-600 print:hidden">
                              {req.schoolId ? api.getSchools().find(s => s.id === req.schoolId)?.name : 'Particular'}
                          </td>
                          
                          {/* Screen Actions */}
                          <td className="px-6 py-4 text-right print:hidden flex justify-end gap-2">
                              {canEdit ? (
                                  <>
                                    <button 
                                        type="button"
                                        onClick={(e) => handleSendWhatsapp(e, req)}
                                        className="text-green-600 hover:text-green-800 bg-green-50 p-2 rounded-md transition-colors border border-green-100 inline-flex items-center justify-center w-8 h-8"
                                        title="Enviar WhatsApp"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={(e) => handleToggleConfirmation(e, req)}
                                        className={`p-2 rounded-md transition-colors border inline-flex items-center justify-center w-8 h-8 ${req.attendanceConfirmed ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'text-gray-400 hover:text-blue-600 bg-gray-50 border-gray-200 hover:bg-white'}`}
                                        title={req.attendanceConfirmed ? "Presença Confirmada (Clique para desfazer)" : "Confirmar Presença"}
                                    >
                                        {req.attendanceConfirmed ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={(e) => handleRemoveClick(e, req.id)} 
                                        disabled={processingStudentId === req.id}
                                        className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-md transition-colors border border-red-100 disabled:opacity-50 inline-flex items-center justify-center w-8 h-8"
                                        title="Remover da Banca"
                                    >
                                        {processingStudentId === req.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                  </>
                              ) : (
                                  <span className="text-gray-400 text-xs italic">Bloqueado</span>
                              )}
                          </td>

                          {/* Print Manual Columns */}
                          <td className="hidden print:table-cell print:border print:border-black text-center"><span className="inline-block w-4 h-4 border border-black"></span></td>
                          <td className="hidden print:table-cell print:border print:border-black text-center"><span className="inline-block w-4 h-4 border border-black"></span></td>
                          <td className="hidden print:table-cell print:border print:border-black text-center"><span className="inline-block w-4 h-4 border border-black"></span></td>
                          </tr>
                      ))}
                      {scheduledStudents.filter(s => s.scheduledCategory === 'A').length === 0 && (
                          <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400 italic print:border print:border-black">Nenhum candidato de Moto agendado.</td></tr>
                      )}
                      </tbody>
                  </table>
               </div>

               {/* Categoria B Table */}
               <div className="mb-8 break-inside-avoid">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 px-6 pt-4 border-l-4 border-blue-600 flex items-center gap-2 print:border-none print:px-0">
                      <Layers className="h-5 w-5" /> Categoria B (Carro)
                  </h3>
                  <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 print:bg-white print:border-black print:border-b">
                      <tr>
                          <th className="px-6 py-3 w-10 print:border print:border-black print:px-2">#</th>
                          <th className="px-6 py-3 print:border print:border-black print:px-2">CPF</th>
                          <th className="px-6 py-3 print:border print:border-black print:px-2">Nome do Candidato</th>
                          <th className="hidden print:table-cell px-2 py-3 print:border print:border-black w-24">Restrição</th>
                          <th className="px-6 py-3 print:hidden">Autoescola</th>
                          
                          {/* Screen Actions */}
                          <th className="px-6 py-3 print:hidden text-right">Ações</th>
                          
                          {/* Print Manual Fill Columns */}
                          <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black w-16 text-xs">Faltou</th>
                          <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black w-16 text-xs">Apto</th>
                          <th className="hidden print:table-cell px-1 py-3 text-center print:border print:border-black w-16 text-xs">Inapto</th>
                      </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                      {scheduledStudents.filter(s => s.scheduledCategory === 'B' || !s.scheduledCategory).map((req, idx) => (
                          <tr key={req.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                          <td className="px-6 py-4 font-medium text-gray-500 print:border print:border-black print:px-2 print:py-2">{idx + 1}</td>
                          <td className="px-6 py-4 text-gray-600 print:border print:border-black print:px-2 print:py-2 print:text-black">{req.cpf}</td>
                          <td className="px-6 py-4 font-medium text-gray-900 uppercase print:border print:border-black print:px-2 print:py-2 print:text-black">
                              {/* Display Social Name if exists */}
                              {req.socialName ? req.socialName : req.studentName}
                              {req.attendanceConfirmed && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200 print:hidden">
                                      CONFIRMADO
                                  </span>
                              )}
                          </td>
                          <td className="hidden print:table-cell print:border print:border-black print:px-2 print:py-2 text-center">{req.cnhRestriction || '-'}</td>
                          <td className="px-6 py-4 text-gray-600 print:hidden">
                              {req.schoolId ? api.getSchools().find(s => s.id === req.schoolId)?.name : 'Particular'}
                          </td>
                          
                          {/* Screen Actions */}
                          <td className="px-6 py-4 text-right print:hidden flex justify-end gap-2">
                              {canEdit ? (
                                  <>
                                    <button 
                                        type="button"
                                        onClick={(e) => handleSendWhatsapp(e, req)}
                                        className="text-green-600 hover:text-green-800 bg-green-50 p-2 rounded-md transition-colors border border-green-100 inline-flex items-center justify-center w-8 h-8"
                                        title="Enviar WhatsApp"
                                    >
                                        <MessageCircle className="h-4 w-4" />
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={(e) => handleToggleConfirmation(e, req)}
                                        className={`p-2 rounded-md transition-colors border inline-flex items-center justify-center w-8 h-8 ${req.attendanceConfirmed ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'text-gray-400 hover:text-blue-600 bg-gray-50 border-gray-200 hover:bg-white'}`}
                                        title={req.attendanceConfirmed ? "Presença Confirmada (Clique para desfazer)" : "Confirmar Presença"}
                                    >
                                        {req.attendanceConfirmed ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={(e) => handleRemoveClick(e, req.id)} 
                                        disabled={processingStudentId === req.id}
                                        className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-md transition-colors border border-red-100 disabled:opacity-50 inline-flex items-center justify-center w-8 h-8"
                                        title="Remover da Banca"
                                    >
                                        {processingStudentId === req.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </button>
                                  </>
                              ) : (
                                <span className="text-gray-400 text-xs italic">Bloqueado</span>
                              )}
                          </td>
                          
                          {/* Print Manual Columns */}
                          <td className="hidden print:table-cell print:border print:border-black text-center"><span className="inline-block w-4 h-4 border border-black"></span></td>
                          <td className="hidden print:table-cell print:border print:border-black text-center"><span className="inline-block w-4 h-4 border border-black"></span></td>
                          <td className="hidden print:table-cell print:border print:border-black text-center"><span className="inline-block w-4 h-4 border border-black"></span></td>
                          </tr>
                      ))}
                      {scheduledStudents.filter(s => s.scheduledCategory === 'B' || !s.scheduledCategory).length === 0 && (
                          <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400 italic print:border print:border-black">Nenhum candidato de Carro agendado.</td></tr>
                      )}
                      </tbody>
                  </table>
               </div>
            </div>
            
            <div className="hidden print:block mt-8 px-0 w-full">
               <div className="border-t border-black pt-2 flex justify-between text-xs items-start">
                  <div className="flex flex-col">
                      <span>Data de Impressão: {new Date().toLocaleDateString()}</span>
                      {settings?.agencyAddress && (
                          <span className="font-bold mt-1 uppercase">{settings.agencyAddress}</span>
                      )}
                  </div>
                  <span>Assinatura do Presidente da Banca: __________________________________________________</span>
               </div>
            </div>
          </div>

          {/* Modal: Add Students */}
          {isAddStudentOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh]">
                <div className="p-4 border-b flex justify-between items-center">
                  <h3 className="font-bold text-lg">Adicionar Candidatos à Banca</h3>
                  <button onClick={() => setIsAddStudentOpen(false)}><X className="h-5 w-5 text-gray-500" /></button>
                </div>
                
                <div className="p-4 border-b bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Filtrar por nome ou CPF..." 
                      className="w-full pl-10 pr-4 py-2 border rounded-md bg-white text-gray-900"
                      value={studentFilter}
                      onChange={(e) => setStudentFilter(e.target.value)}
                    />
                  </div>
                  <div className="mt-2 text-xs flex gap-3">
                      <span className={`${currentCounts!.A.current >= currentCounts!.A.max ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          Vagas Moto (A): {currentCounts!.A.max - currentCounts!.A.current} disponíveis
                      </span>
                      <span className={`${currentCounts!.B.current >= currentCounts!.B.max ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          Vagas Carro (B): {currentCounts!.B.max - currentCounts!.B.current} disponíveis
                      </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-500 bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 w-10">
                           #
                        </th>
                        <th className="px-4 py-2">Data Cadastro</th>
                        <th className="px-4 py-2">Candidato</th>
                        <th className="px-4 py-2">Categoria</th>
                        <th className="px-4 py-2">Histórico</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {availableStudents
                        .filter(s => (s.socialName || s.studentName).toLowerCase().includes(studentFilter.toLowerCase()) || s.cpf.includes(studentFilter))
                        .map(s => {
                          const isSelected = !!selectedStudentsMap[s.id];
                          const historyCount = s.examHistory ? s.examHistory.length : 0;
                          
                          // Check specific capacity availability including current selection
                          const cat = s.intendedCategory === 'A' ? 'A' : 'B';
                          const selectedCountForCat = Object.values(selectedStudentsMap).filter(c => c === cat).length;
                          const currentTotalForCat = currentCounts![cat].current;
                          const maxForCat = currentCounts![cat].max;
                          
                          const isFull = !isSelected && (currentTotalForCat + selectedCountForCat >= maxForCat);

                          return (
                              <tr key={s.id} className={`hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : ''} ${isFull ? 'opacity-50 bg-gray-50' : ''}`}>
                                  <td className="px-4 py-3">
                                  <input 
                                      type="checkbox" 
                                      checked={isSelected}
                                      disabled={isFull}
                                      onChange={(e) => handleToggleStudentSelection(s, e.target.checked)}
                                  />
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">
                                      {new Date(s.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3">
                                  <div className="font-medium">{s.socialName || s.studentName}</div>
                                  <div className="text-xs text-gray-500">{s.cpf}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                      <span className={`font-bold px-2 py-1 rounded text-xs ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
                                          {s.intendedCategory || 'B'}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3">
                                      <span className="text-xs text-gray-600">
                                          {historyCount > 0 ? `${historyCount} tentativa(s)` : '1ª Tentativa'}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3">
                                      {isFull ? (
                                           <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Lotado</span>
                                      ) : (
                                           <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Aguardando</span>
                                      )}
                                  </td>
                              </tr>
                          );
                      })}
                      {availableStudents.length === 0 && (
                          <tr><td colSpan={6} className="p-4 text-center text-gray-500">Nenhum candidato aguardando agendamento.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t flex justify-between items-center bg-gray-50">
                  <span className="text-sm text-gray-600">{Object.keys(selectedStudentsMap).length} candidatos selecionados</span>
                  <div className="flex gap-2">
                     <button onClick={() => setIsAddStudentOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded">Cancelar</button>
                     <button onClick={handleAddStudents} disabled={Object.keys(selectedStudentsMap).length === 0} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                       Confirmar Inclusão
                     </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // --- VIEW: MAIN (List of Schedules) ---
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
               <h2 className="text-2xl font-bold text-gray-800">Central de Agendamentos</h2>
               <p className="text-gray-500 text-sm">Gerencie bancas e listas de chamada para 1ª Habilitação</p>
            </div>
            <button 
              onClick={handleOpenCreate}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="h-5 w-5" /> Nova Banca
            </button>
          </div>
          
          {/* FILTERS */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                      <Filter className="h-3 w-3" /> Status da Banca
                  </label>
                  <select 
                      className="w-full border border-gray-300 rounded-md p-2 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                  >
                      <option value="ALL">Todas</option>
                      <option value="OPEN">Abertas</option>
                      <option value="CLOSED">Fechadas</option>
                      <option value="CONCLUDED">Concluídas</option>
                      <option value="CANCELLED">Canceladas</option>
                  </select>
              </div>
              
              <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">De (Data)</label>
                  <input 
                      type="date" 
                      className="w-full border border-gray-300 rounded-md p-2 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={dateStartFilter}
                      onChange={(e) => setDateStartFilter(e.target.value)}
                  />
              </div>

              <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Até (Data)</label>
                  <input 
                      type="date" 
                      className="w-full border border-gray-300 rounded-md p-2 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={dateEndFilter}
                      onChange={(e) => setDateEndFilter(e.target.value)}
                  />
              </div>

              <div>
                  <button 
                    onClick={handleClearFilters}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                      <RotateCcw className="h-4 w-4" /> Limpar Filtros
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSchedules.map(schedule => {
               // Show names of first 2 examiners + count
               const mainExaminer = schedule.examinerIds[0] ? getExaminerName(schedule.examinerIds[0]) : 'Não atribuído';
               const count = schedule.examinerIds.length;
               const extra = count > 1 ? `+${count - 1}` : '';
               const allReqs = scheduledStudents.length > 0 ? scheduledStudents : []; // Needs update logic for main view, doing quick fetch simulation below
               
               // Note: In main view we don't have all requests pre-fetched for every schedule to count accurately without api call
               // Simplified: We will just show the Capacity Max info since actual count requires filtering all requests
               
               return (
                <div 
                  key={schedule.id} 
                  onClick={() => setSelectedSchedule(schedule)}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                       <div className="bg-blue-50 text-blue-700 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
                          <Calendar className="h-6 w-6" />
                       </div>
                       {getStatusBadge(schedule.status)}
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {new Date(schedule.date).toLocaleDateString()}
                    </h3>
                    <div className="flex items-center gap-2 text-gray-500 mb-4">
                      <Clock className="h-4 w-4" /> {schedule.time}
                    </div>
                    
                    <div className="border-t border-gray-100 pt-3 mt-2">
                       <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                          <User className="h-4 w-4" /> {mainExaminer} {extra}
                       </div>
                       <div className="flex gap-3 text-xs text-gray-400 mt-2">
                          <span title="Vagas Moto">A: {schedule.maxSlotsA || 10} vagas</span>
                          <span title="Vagas Carro">B: {schedule.maxSlotsB || 10} vagas</span>
                       </div>
                       {schedule.status === 'CANCELLED' && (
                           <div className="mt-2 text-xs text-red-600 font-medium">Motivo: {schedule.cancellationReason}</div>
                       )}
                    </div>
                  </div>
                </div>
               );
            })}
            
            {filteredSchedules.length === 0 && (
               <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                 <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                 <h3 className="text-lg font-medium text-gray-900">Nenhuma banca encontrada</h3>
                 <p className="text-gray-500">Ajuste os filtros ou crie uma nova banca.</p>
               </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM DELETE (REMOVE STUDENT) MODAL */}
      {studentToRemove && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-fadeIn">
              <div className="flex flex-col items-center text-center">
                 <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                 </div>
                 <h3 className="text-lg font-bold text-gray-900 mb-2">Remover Candidato?</h3>
                 <p className="text-sm text-gray-500 mb-6">
                    O candidato será removido desta banca e retornará para a lista de espera ("Aguardando Agendamento").
                 </p>
                 <div className="flex gap-3 w-full">
                    <button 
                        onClick={() => setStudentToRemove(null)} 
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmRemoveStudent} 
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                        Remover
                    </button>
                 </div>
              </div>
            </div>
          </div>
      )}

      {/* CANCEL SCHEDULE MODAL */}
      {isCancelModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fadeIn">
               <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                     <Ban className="h-6 w-6 text-red-600" /> Cancelar Banca
                  </h3>
                  <div className="bg-red-50 p-3 rounded-md border border-red-100 text-sm text-red-800 mb-4">
                     <strong>Atenção:</strong> Ao cancelar esta banca, todos os candidatos agendados serão removidos automaticamente e voltarão para a fila "Aguardando Agendamento".
                  </div>
                  
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do Cancelamento (Obrigatório)</label>
                  <textarea 
                     required
                     className="w-full border border-gray-300 rounded-md p-3 bg-white text-gray-900 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                     rows={3}
                     placeholder="Ex: Chuva forte, Examinador doente..."
                     value={cancelReason}
                     onChange={(e) => setCancelReason(e.target.value)}
                  ></textarea>

                  <div className="flex gap-3 w-full mt-6">
                     <button 
                         onClick={() => setIsCancelModalOpen(false)} 
                         className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                     >
                         Voltar
                     </button>
                     <button 
                         disabled={!cancelReason.trim()}
                         onClick={handleConfirmCancel} 
                         className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                     >
                         Confirmar Cancelamento
                     </button>
                  </div>
               </div>
            </div>
          </div>
      )}

      {/* GLOBAL MODALS: Create/Edit Schedule */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold">{modalMode === 'CREATE' ? 'Nova Banca de Exame' : 'Editar Banca'}</h3>
               <button onClick={() => setIsModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            
            <form onSubmit={handleSubmitSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Data</label>
                <input required type="date" className="w-full border rounded p-2 mt-1 bg-white text-gray-900" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Horário</label>
                  <input required type="time" className="w-full border rounded p-2 mt-1 bg-white text-gray-900" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vagas Moto (A)</label>
                  <input required type="number" min="0" className="w-full border rounded p-2 mt-1 bg-white text-gray-900" value={scheduleForm.maxSlotsA} onChange={e => setScheduleForm({...scheduleForm, maxSlotsA: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vagas Carro (B)</label>
                  <input required type="number" min="0" className="w-full border rounded p-2 mt-1 bg-white text-gray-900" value={scheduleForm.maxSlotsB} onChange={e => setScheduleForm({...scheduleForm, maxSlotsB: parseInt(e.target.value)})} />
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                <label className="block text-sm font-medium text-gray-700">Examinadores (Até 3)</label>
                
                <select required className="w-full border rounded p-2 bg-white text-gray-900" value={scheduleForm.examiner1} onChange={e => setScheduleForm({...scheduleForm, examiner1: e.target.value})}>
                  <option value="">Examinador Principal (Obrigatório)</option>
                  {examiners.filter(e => e.canExamCommon).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>

                <select className="w-full border rounded p-2 bg-white text-gray-900" value={scheduleForm.examiner2} onChange={e => setScheduleForm({...scheduleForm, examiner2: e.target.value})}>
                  <option value="">2º Examinador (Opcional)</option>
                  {examiners.filter(e => e.canExamCommon && e.id !== scheduleForm.examiner1 && e.id !== scheduleForm.examiner3).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>

                <select className="w-full border rounded p-2 bg-white text-gray-900" value={scheduleForm.examiner3} onChange={e => setScheduleForm({...scheduleForm, examiner3: e.target.value})}>
                  <option value="">3º Examinador (Opcional)</option>
                  {examiners.filter(e => e.canExamCommon && e.id !== scheduleForm.examiner1 && e.id !== scheduleForm.examiner2).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    {modalMode === 'CREATE' ? 'Criar Banca' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SchedulingCenter;