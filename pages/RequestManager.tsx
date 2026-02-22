
import React, { useState, useEffect } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, User, UserRole, ExamType, RequestSource, ExamStatus, ExamResult, Instructor, Examiner, ExamSchedule } from '../types';
import { Plus, Search, Edit, X, CheckSquare, Gavel, ChevronDown, ChevronUp, Clock, Calendar, CheckCircle, AlertOctagon, Filter } from 'lucide-react';

const ResultBadge: React.FC<{ result?: ExamResult; status: ExamStatus }> = ({ result, status }) => {
  if (status === ExamStatus.WAITING_RESULT) return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Aguardando</span>;
  if (!result) return null;
  
  const colors: Record<string, string> = {
    'APTO': 'bg-green-100 text-green-800',
    'INAPTO': 'bg-red-100 text-red-800',
    'FALTOU': 'bg-gray-100 text-gray-800'
  };
  
  return <span className={`text-xs px-2 py-1 rounded font-bold ${colors[result] || 'bg-gray-100'}`}>{result}</span>;
};

interface RequestManagerProps {
  user: User;
  typeFilter?: ExamType;
}

const RequestManager: React.FC<RequestManagerProps> = ({ user, typeFilter }) => {
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Estado para controlar quais grupos estão expandidos
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
      [ExamStatus.WAITING_SCHEDULING]: false,
      [ExamStatus.SCHEDULED]: false,
      [ExamStatus.WAITING_RESULT]: false,
      [ExamStatus.DONE]: false,
      [ExamStatus.CANCELLED]: false,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExamRequest | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<ExamRequest>>({});
  const [resultData, setResultData] = useState<{ result: ExamResult; observation: string }>({ result: 'APTO', observation: '' });
  const [activeTab, setActiveTab] = useState<'personal' | 'exam' | 'history'>('personal');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [data, instructorsData, examinersData, schedulesData] = await Promise.all([
        api.getRequests(),
        api.getInstructorsAsync(),
        api.getExaminersAsync(),
        api.getSchedules()
      ]);
      setInstructors(instructorsData);
      setExaminers(examinersData);
      setSchedules(schedulesData);
      let filtered = data;
      
      // Role Filtering
      if (user.role === UserRole.SCHOOL) {
        filtered = filtered.filter(r => r.schoolId === user.schoolId);
      }
      
      // Prop Type Filtering
      if (typeFilter) {
        filtered = filtered.filter(r => r.examType === typeFilter);
      }
      
      // Sort by updatedAt ASC (oldest first, newest at the bottom)
      filtered.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      
      setRequests(filtered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user, typeFilter]);

  useEffect(() => {
    if (isModalOpen) {
      api.getInstructorsAsync().then(setInstructors);
    }
  }, [isModalOpen]);

  // Handle Filter Change logic (Auto open accordion if specific status selected)
  const handleStatusFilterChange = (status: string) => {
      setStatusFilter(status);
      if (status !== 'ALL') {
          // Fecha todos e abre apenas o selecionado
          const newExpandedState = { ...expandedGroups };
          Object.keys(newExpandedState).forEach(k => newExpandedState[k] = false);
          newExpandedState[status] = true;
          setExpandedGroups(newExpandedState);
      } else {
          // Se selecionar "Todos", fecha tudo (ou mantém o estado anterior, optei por fechar p/ limpar a tela)
          const newExpandedState = { ...expandedGroups };
          Object.keys(newExpandedState).forEach(k => newExpandedState[k] = false);
          setExpandedGroups(newExpandedState);
      }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRequest) {
        await api.updateRequest(editingRequest.id, formData);
      } else {
        if (formData.intendedCategory === 'AB') {
            const instructorParts = (formData.instructor || '').split(' / ');
            const plateParts = (formData.vehiclePlate || '').split(' / ');
            
            const getVal = (parts: string[], prefix: string) => {
                const part = parts.find(p => p.trim().startsWith(prefix));
                return part ? part.replace(prefix, '').trim() : '';
            };

            const motoInstructor = getVal(instructorParts, 'Moto: ');
            const carInstructor = getVal(instructorParts, 'Carro: ');
            const motoPlate = getVal(plateParts, 'Moto: ');
            const carPlate = getVal(plateParts, 'Carro: ');

            // Create A
            await api.createRequest({
                ...formData,
                intendedCategory: 'A',
                instructor: motoInstructor,
                vehiclePlate: motoPlate,
                schoolId: user.schoolId,
                source: user.role === UserRole.SCHOOL ? RequestSource.SCHOOL : RequestSource.STUDENT_DIRECT,
                status: ExamStatus.WAITING_SCHEDULING
            });

            // Create B
            await api.createRequest({
                ...formData,
                intendedCategory: 'B',
                instructor: carInstructor,
                vehiclePlate: carPlate,
                schoolId: user.schoolId,
                source: user.role === UserRole.SCHOOL ? RequestSource.SCHOOL : RequestSource.STUDENT_DIRECT,
                status: ExamStatus.WAITING_SCHEDULING
            });
        } else {
            await api.createRequest({
              ...formData,
              schoolId: user.schoolId,
              source: user.role === UserRole.SCHOOL ? RequestSource.SCHOOL : RequestSource.STUDENT_DIRECT,
              status: ExamStatus.WAITING_SCHEDULING
            });
        }
      }
      setIsModalOpen(false);
      fetchRequests();
    } catch (err) {
      alert('Erro ao salvar');
    }
  };

  const handleUpdateStatus = async (id: string, status: ExamStatus) => {
    if (!window.confirm('Tem certeza que deseja alterar o status?')) return;
    await api.updateRequest(id, { status });
    fetchRequests();
  };

  const handleResultSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;
    
    const schedule = schedules.find(s => s.id === editingRequest.scheduleId);
    const examinerNames = schedule 
      ? schedule.examinerIds.map((id: string) => examiners.find(e => e.id === id)?.name).filter(Boolean).join(', ')
      : '';

    const newHistoryEntry = {
      id: 'hist_' + Date.now(),
      date: editingRequest.scheduledDate || new Date().toISOString().split('T')[0],
      time: editingRequest.scheduledTime || new Date().toLocaleTimeString().substring(0, 5),
      result: resultData.result,
      category: editingRequest.scheduledCategory || editingRequest.intendedCategory,
      examiners: examinerNames,
      observation: resultData.observation
    };

    const updatedHistory = [...(editingRequest.examHistory || []), newHistoryEntry];

    // Se Apto -> Realizado (DONE)
    // Se Inapto ou Faltou -> Aguardando Agendamento (WAITING_SCHEDULING)
    const nextStatus = resultData.result === 'APTO' ? ExamStatus.DONE : ExamStatus.WAITING_SCHEDULING;

    const updates: any = {
      status: nextStatus,
      result: resultData.result,
      observation: resultData.observation,
      examHistory: updatedHistory
    };

    // Se voltou para aguardando agendamento, limpa os dados do agendamento anterior
    if (nextStatus === ExamStatus.WAITING_SCHEDULING) {
      updates.scheduleId = null;
      updates.scheduledDate = null;
      updates.scheduledTime = null;
      updates.attendanceConfirmed = false;
    }

    await api.updateRequest(editingRequest.id, updates);
    
    setIsResultModalOpen(false);
    fetchRequests();
  };

  const handleChangeHistoryResult = async (requestId: string, historyId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    const entry = request.examHistory.find(h => h.id === historyId);
    if (!entry) return;

    const newResult = window.prompt(`Mudar resultado de ${entry.result} para: (APTO, INAPTO, FALTOU)`, entry.result);
    if (!newResult) return;
    
    const upperResult = newResult.toUpperCase();
    if (!['APTO', 'INAPTO', 'FALTOU'].includes(upperResult)) {
        alert('Resultado inválido. Use: APTO, INAPTO ou FALTOU');
        return;
    }

    const updatedHistory = request.examHistory.map(h => 
      h.id === historyId ? { ...h, result: upperResult as ExamResult } : h
    );

    await api.updateRequest(requestId, { examHistory: updatedHistory });
    
    // Update local state for modal if open
    if (editingRequest && editingRequest.id === requestId) {
        setFormData(prev => ({ ...prev, examHistory: updatedHistory }));
    }
    
    fetchRequests();
  };

  // Helper functions for filtering instructors and vehicles
  const getInstructorsByCategory = (category: 'A' | 'B') => {
      return instructors.filter(inst => {
          // Se o instrutor não tem categoria definida, assume que pode dar aula em tudo (ou filtrar se tiver lógica mais estrita)
          // Aqui vamos assumir que se tiver vehicles do tipo correspondente, ele serve.
          // Ou se a categoria dele incluir a letra.
          const hasVehicle = inst.vehicles?.some(v => v.type === (category === 'A' ? 'MOTO' : 'CAR') && v.active);
          const hasCategory = inst.category?.includes(category) || inst.category === 'AB';
          return hasVehicle || hasCategory;
      });
  };

  const getVehiclesByInstructor = (instructorId: string, type: 'MOTO' | 'CAR') => {
      const instructor = instructors.find(i => i.id === instructorId);
      if (!instructor) return [];
      return instructor.vehicles?.filter(v => v.type === type && v.active) || [];
  };

  // Renderiza o select de instrutor e veículo para uma categoria específica
  const renderInstructorVehicleSelection = (categoryLabel: string, categoryCode: 'A' | 'B', colorClass: string) => {
      const availableInstructors = getInstructorsByCategory(categoryCode);
      
      // Extrair o ID do instrutor e a placa atual do formData
      // O formato no formData para AB é "Moto: Nome / Carro: Nome" e "Moto: Placa / Carro: Placa"
      // Precisamos parsear isso para saber o valor atual dos selects
      
      let currentInstructorName = '';
      let currentPlate = '';

      if (formData.intendedCategory === 'AB') {
          if (categoryCode === 'A') {
              currentInstructorName = formData.instructor?.split(' / ')[0]?.replace('Moto: ', '') || '';
              currentPlate = formData.vehiclePlate?.split(' / ')[0]?.replace('Moto: ', '') || '';
          } else {
              currentInstructorName = formData.instructor?.split(' / ')[1]?.replace('Carro: ', '') || '';
              currentPlate = formData.vehiclePlate?.split(' / ')[1]?.replace('Carro: ', '') || '';
          }
      } else {
          currentInstructorName = formData.instructor || '';
          currentPlate = formData.vehiclePlate || '';
      }

      // Encontrar o objeto instrutor pelo nome (já que salvamos o nome no banco, não o ID... ideal seria ID, mas vamos manter compatibilidade)
      const selectedInstructor = instructors.find(i => i.name === currentInstructorName);
      const availableVehicles = selectedInstructor ? getVehiclesByInstructor(selectedInstructor.id, categoryCode === 'A' ? 'MOTO' : 'CAR') : [];

      return (
        <div className={`p-4 rounded-lg border ${colorClass}`}>
            <h4 className={`font-bold mb-3 flex items-center gap-2 ${categoryCode === 'A' ? 'text-blue-800' : 'text-green-800'}`}>
                {categoryLabel}
            </h4>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Instrutor {categoryCode === 'A' ? 'Moto' : 'Carro'}</label>
                    <select 
                        className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                        value={currentInstructorName}
                        onChange={e => {
                            const newName = e.target.value;
                            const newInstructor = instructors.find(i => i.name === newName);
                            // Auto-select first vehicle if available
                            const firstVehicle = newInstructor?.vehicles?.find(v => v.type === (categoryCode === 'A' ? 'MOTO' : 'CAR') && v.active);
                            const newPlate = firstVehicle ? firstVehicle.plate : (newInstructor?.plate || '');

                            if (formData.intendedCategory === 'AB') {
                                const otherPartInstr = formData.instructor?.split(' / ')[categoryCode === 'A' ? 1 : 0] || '';
                                const otherPartPlate = formData.vehiclePlate?.split(' / ')[categoryCode === 'A' ? 1 : 0] || '';
                                
                                const finalInstr = categoryCode === 'A' 
                                    ? `Moto: ${newName} / ${otherPartInstr}` 
                                    : `${otherPartInstr} / Carro: ${newName}`;
                                
                                const finalPlate = categoryCode === 'A'
                                    ? `Moto: ${newPlate} / ${otherPartPlate}`
                                    : `${otherPartPlate} / Carro: ${newPlate}`;

                                setFormData({...formData, instructor: finalInstr, vehiclePlate: finalPlate});
                            } else {
                                setFormData({...formData, instructor: newName, vehiclePlate: newPlate});
                            }
                        }}
                    >
                        <option value="">Selecione...</option>
                        {availableInstructors.map(inst => (
                            <option key={inst.id} value={inst.name}>{inst.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Veículo/Placa</label>
                    <select 
                        className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                        value={currentPlate}
                        onChange={e => {
                            const newPlate = e.target.value;
                            if (formData.intendedCategory === 'AB') {
                                const otherPartPlate = formData.vehiclePlate?.split(' / ')[categoryCode === 'A' ? 1 : 0] || '';
                                const finalPlate = categoryCode === 'A'
                                    ? `Moto: ${newPlate} / ${otherPartPlate}`
                                    : `${otherPartPlate} / Carro: ${newPlate}`;
                                setFormData({...formData, vehiclePlate: finalPlate});
                            } else {
                                setFormData({...formData, vehiclePlate: newPlate});
                            }
                        }}
                        disabled={!currentInstructorName}
                    >
                        <option value="">Selecione...</option>
                        {availableVehicles.map(v => (
                            <option key={v.id} value={v.plate}>{v.model} - {v.plate}</option>
                        ))}
                        {/* Fallback option if instructor has no vehicles list but has a plate property */}
                        {selectedInstructor && !availableVehicles.length && selectedInstructor.plate && (
                             <option value={selectedInstructor.plate}>{selectedInstructor.plate}</option>
                        )}
                         {/* Allow manual entry if needed or show current value if not in list */}
                         {currentPlate && !availableVehicles.some(v => v.plate === currentPlate) && (!selectedInstructor || selectedInstructor.plate !== currentPlate) && (
                            <option value={currentPlate}>{currentPlate}</option>
                         )}
                    </select>
                </div>
            </div>
        </div>
      );
  };

  const openCreateModal = (req?: ExamRequest) => {
    setEditingRequest(req || null);
    setActiveTab('personal');
    if (req) {
      setFormData(req);
    } else {
      setFormData({
        studentName: '',
        cpf: '',
        phone: '',
        examType: typeFilter || ExamType.COMMON,
        intendedCategory: '',
        paidFee: false,
        completedPracticalCourse: false,
        hasVehicle: false,
        practicalHours: 0
      });
    }
    setIsModalOpen(true);
  };

  const openResultModal = (req: ExamRequest) => {
    setEditingRequest(req);
    setResultData({ result: 'APTO', observation: '' });
    setIsResultModalOpen(true);
  };

  const toggleGroup = (status: string) => {
      setExpandedGroups(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const filteredRequests = requests.filter(r => 
    (r.socialName || r.studentName).toLowerCase().includes(searchTerm.toLowerCase()) || r.cpf.includes(searchTerm)
  );

  // Group requests by status
  const groupedRequests = {
      [ExamStatus.WAITING_SCHEDULING]: filteredRequests.filter(r => r.status === ExamStatus.WAITING_SCHEDULING),
      [ExamStatus.SCHEDULED]: filteredRequests.filter(r => r.status === ExamStatus.SCHEDULED),
      [ExamStatus.WAITING_RESULT]: filteredRequests.filter(r => r.status === ExamStatus.WAITING_RESULT),
      [ExamStatus.DONE]: filteredRequests.filter(r => r.status === ExamStatus.DONE),
      [ExamStatus.CANCELLED]: filteredRequests.filter(r => r.status === ExamStatus.CANCELLED),
  };

  // Determine visible statuses based on filter
  const allStatuses = [
      ExamStatus.WAITING_SCHEDULING,
      ExamStatus.SCHEDULED,
      ExamStatus.WAITING_RESULT,
      ExamStatus.DONE,
      ExamStatus.CANCELLED
  ];

  const visibleStatuses = statusFilter === 'ALL' ? allStatuses : [statusFilter];

  const groupConfig = {
      [ExamStatus.WAITING_SCHEDULING]: { label: 'Aguardando Agendamento', color: 'yellow', icon: Clock },
      [ExamStatus.SCHEDULED]: { label: 'Agendado', color: 'blue', icon: Calendar },
      [ExamStatus.WAITING_RESULT]: { label: 'Aguardando Resultado', color: 'purple', icon: AlertOctagon },
      [ExamStatus.DONE]: { label: 'Realizado', color: 'green', icon: CheckCircle },
      [ExamStatus.CANCELLED]: { label: 'Cancelado', color: 'red', icon: X },
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando solicitações...</div>;

  return (
    <div className="space-y-6">
       {/* Header and filters */}
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
         
         {/* Filters (Left Side) */}
         <div className="flex gap-3 w-full md:w-auto items-center">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou CPF..." 
                    className="w-full pl-10 pr-4 py-2 border rounded-md text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="relative w-full md:w-56">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <select 
                    className="w-full pl-10 pr-8 py-2 border rounded-md text-sm bg-white text-gray-900 appearance-none focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    value={statusFilter}
                    onChange={(e) => handleStatusFilterChange(e.target.value)}
                >
                    <option value="ALL">Todos os Status</option>
                    <option value={ExamStatus.WAITING_SCHEDULING}>Aguardando Agendamento</option>
                    <option value={ExamStatus.SCHEDULED}>Agendado</option>
                    <option value={ExamStatus.WAITING_RESULT}>Aguardando Resultado</option>
                    <option value={ExamStatus.DONE}>Realizado</option>
                    <option value={ExamStatus.CANCELLED}>Cancelado</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
            </div>
         </div>

         {/* Action Button (Right Side) */}
         <div className="w-full md:w-auto flex justify-end">
            <button 
                onClick={() => openCreateModal()} 
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-colors"
            >
                <Plus className="h-4 w-4" /> Novo Candidato
            </button>
         </div>
       </div>

       {/* Grupos Expansíveis (Acordeões) */}
       <div className="space-y-4">
           {visibleStatuses.map(status => {
               const items = (groupedRequests as any)[status];
               const config = (groupConfig as any)[status];
               const isExpanded = expandedGroups[status];
               const Icon = config.icon;

               // Tailwind colors mapping
               const bgColors: Record<string, string> = {
                   yellow: 'bg-orange-50',
                   blue: 'bg-blue-50',
                   purple: 'bg-purple-50',
                   green: 'bg-green-50',
                   red: 'bg-red-50'
               };
               const textColors: Record<string, string> = {
                   yellow: 'text-orange-700',
                   blue: 'text-blue-700',
                   purple: 'text-purple-700',
                   green: 'text-green-700',
                   red: 'text-red-700'
               };
               const borderColors: Record<string, string> = {
                   yellow: 'border-l-4 border-l-orange-400',
                   blue: 'border-l-4 border-l-blue-400',
                   purple: 'border-l-4 border-l-purple-400',
                   green: 'border-l-4 border-l-green-400',
                   red: 'border-l-4 border-l-red-400'
               };

               return (
                   <div key={status} className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all ${isExpanded ? 'ring-1 ring-black/5' : ''}`}>
                       <button 
                           onClick={() => toggleGroup(status)}
                           className={`w-full flex items-center justify-between p-4 ${bgColors[config.color]} ${borderColors[config.color]}`}
                       >
                           <div className="flex items-center gap-3">
                               <Icon className={`h-5 w-5 ${textColors[config.color]}`} />
                               <h3 className={`font-bold text-sm ${textColors[config.color]}`}>{config.label}</h3>
                               <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-gray-500 shadow-sm">
                                   {items.length}
                               </span>
                           </div>
                           {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                       </button>

                       {isExpanded && (
                           <div className="overflow-x-auto">
                               <table className="w-full text-sm text-left">
                                   <thead className="bg-white text-gray-500 border-b">
                                       <tr>
                                           <th className="px-6 py-3 font-bold text-xs uppercase">Data Cadastro</th>
                                           <th className="px-6 py-3 font-bold text-xs uppercase">Candidato</th>
                                           <th className="px-6 py-3 font-bold text-xs uppercase">Categoria</th>
                                           <th className="px-6 py-3 font-bold text-xs uppercase">Histórico</th>
                                           <th className="px-6 py-3 font-bold text-xs uppercase text-right">Ações</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-50">
                                       {items.map((req: ExamRequest) => (
                                           <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                               <td className="px-6 py-4 align-middle text-xs text-gray-500">
                                                   {new Date(req.createdAt).toLocaleString()}
                                                   {req.result && req.status === ExamStatus.DONE && (
                                                       <div className="mt-1"><ResultBadge result={req.result as any} status={req.status} /></div>
                                                   )}
                                               </td>
                                               <td className="px-6 py-4 align-middle">
                                                   <div className="flex flex-col">
                                                       <span className="font-bold text-gray-800 uppercase">{req.socialName || req.studentName}</span>
                                                       <span className="text-xs text-gray-500">{req.cpf}</span>
                                                       <span className="text-[10px] text-gray-400 mt-0.5">
                                                           Instr: {req.instructor || '-'} | Placa: {req.vehiclePlate || '-'}
                                                       </span>
                                                   </div>
                                               </td>
                                               <td className="px-6 py-4 align-middle">
                                                   <span className="font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 text-xs">
                                                       {req.intendedCategory}
                                                   </span>
                                               </td>
                                               <td className="px-6 py-4 align-middle text-xs text-gray-500">
                                                   {(req.examHistory?.length || 0)} tentativas
                                               </td>
                                               <td className="px-6 py-4 align-middle text-right">
                                                    <div className="flex justify-end items-center space-x-2">
                                                        <button onClick={() => openCreateModal(req)} className="p-1.5 border border-gray-200 rounded hover:bg-gray-100 text-gray-500" title="Editar">
                                                            <Edit className="h-4 w-4" />
                                                        </button>

                                                        {user.role !== UserRole.SCHOOL && (
                                                        <>
                                                            {(req.status === ExamStatus.WAITING_SCHEDULING || req.status === ExamStatus.RETEST) && (
                                                                <button onClick={() => handleUpdateStatus(req.id, ExamStatus.CANCELLED)} className="p-1.5 border border-red-200 rounded hover:bg-red-50 text-red-600" title="Cancelar"><X className="h-4 w-4"/></button>
                                                            )}
                                                            
                                                            {req.status === ExamStatus.SCHEDULED && (
                                                                <button onClick={() => handleUpdateStatus(req.id, ExamStatus.WAITING_RESULT)} className="p-1.5 border border-blue-200 rounded hover:bg-blue-50 text-blue-600" title="Enviar para Aguardando Resultado"><CheckSquare className="h-4 w-4"/></button>
                                                            )}

                                                            {req.status === ExamStatus.WAITING_RESULT && (
                                                                <button onClick={() => openResultModal(req)} className="px-3 py-1.5 border border-green-200 rounded hover:bg-green-50 text-green-700 text-xs font-bold flex items-center gap-1" title="Lançar Resultado">
                                                                    <Gavel className="h-3 w-3" /> Resultado
                                                                </button>
                                                            )}

                                                            {req.status === ExamStatus.DONE && req.result === 'INAPTO' && (
                                                                <button 
                                                                    onClick={() => handleUpdateStatus(req.id, ExamStatus.RETEST)} 
                                                                    className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 border border-orange-200 text-xs font-bold"
                                                                >
                                                                    Reteste
                                                                </button>
                                                            )}
                                                        </>
                                                        )}
                                                    </div>
                                               </td>
                                           </tr>
                                       ))}
                                       {items.length === 0 && (
                                           <tr>
                                               <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">
                                                   Nenhum candidato nesta situação.
                                               </td>
                                           </tr>
                                       )}
                                   </tbody>
                               </table>
                           </div>
                       )}
                   </div>
               );
           })}
       </div>

       {/* Create/Edit Modal */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">{editingRequest ? 'Editar Candidato' : 'Novo Candidato'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                </div>
                
                {/* Tabs */}
                <div className="flex border-b bg-gray-50">
                    <button 
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'personal' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('personal')}
                    >
                        Dados Pessoais
                    </button>
                    <button 
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'exam' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('exam')}
                    >
                        Dados do Exame
                    </button>
                    <button 
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('history')}
                    >
                        Histórico
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <form id="candidateForm" onSubmit={handleSave} className="space-y-6">
                        {activeTab === 'personal' && (
                            <div className="space-y-4 animate-fadeIn">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                                        <input required className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                        <input required className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" value={formData.studentName || ''} onChange={e => setFormData({...formData, studentName: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Social</label>
                                        <input className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" value={formData.socialName || ''} onChange={e => setFormData({...formData, socialName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                                        <input required className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                    </div>
                                    {!typeFilter && (
                                    <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Exame</label>
                                            <select className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" value={formData.examType || ExamType.COMMON} onChange={e => setFormData({...formData, examType: e.target.value as ExamType})}>
                                                <option value={ExamType.COMMON}>1ª Habilitação</option>
                                                <option value={ExamType.PCD}>PCD</option>
                                            </select>
                                    </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'exam' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria Pretendida</label>
                                        <select required className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" value={formData.intendedCategory || ''} onChange={e => setFormData({...formData, intendedCategory: e.target.value})}>
                                            <option value="">Selecione...</option>
                                            <option value="A">A (Moto)</option>
                                            <option value="B">B (Carro)</option>
                                            <option value="AB">AB (Carro e Moto)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Restrição CNH</label>
                                        <input 
                                            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" 
                                            value={formData.cnhRestriction || ''} 
                                            onChange={e => {
                                                const val = e.target.value;
                                                const letters = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
                                                const formatted = letters.split('').join(', ');
                                                setFormData({...formData, cnhRestriction: formatted});
                                            }} 
                                            placeholder="Ex: A, G..." 
                                        />
                                    </div>
                                </div>

                                {(formData.intendedCategory === 'A' || formData.intendedCategory === 'AB') && 
                                    renderInstructorVehicleSelection('Categoria A (Moto)', 'A', 'bg-blue-50 border-blue-100')
                                }

                                {(formData.intendedCategory === 'B' || formData.intendedCategory === 'AB') && 
                                    renderInstructorVehicleSelection('Categoria B (Carro)', 'B', 'bg-green-50 border-green-100')
                                }

                                {formData.examType === ExamType.PCD && (
                                    <div className="border-t pt-4">
                                        <h4 className="font-bold text-sm mb-3">Dados PCD</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Deficiência</label>
                                                <input className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" value={formData.disabilityType || ''} onChange={e => setFormData({...formData, disabilityType: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Necessidades Especiais</label>
                                                <textarea className="w-full border rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900" value={formData.specialNeeds || ''} onChange={e => setFormData({...formData, specialNeeds: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-4 animate-fadeIn">
                                <h4 className="font-bold text-gray-800 mb-2">Histórico de Exames</h4>
                                {formData.examHistory && formData.examHistory.length > 0 ? (
                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                                <tr>
                                                    <th className="px-3 py-2">Data/Hora</th>
                                                    <th className="px-3 py-2">Examinadores</th>
                                                    <th className="px-3 py-2">Cat.</th>
                                                    <th className="px-3 py-2">Obs.</th>
                                                    <th className="px-3 py-2">Resultado</th>
                                                    {(user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) && (
                                                        <th className="px-3 py-2 text-right">Ação</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {formData.examHistory.map((hist, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            <div className="font-medium">{hist.date}</div>
                                                            <div className="text-[10px] text-gray-400">{hist.time}</div>
                                                        </td>
                                                        <td className="px-3 py-2 text-[10px] max-w-[120px] truncate" title={hist.examiners}>
                                                            {hist.examiners || '-'}
                                                        </td>
                                                        <td className="px-3 py-2 font-bold">{hist.category}</td>
                                                        <td className="px-3 py-2 text-[10px] max-w-[150px] truncate" title={hist.observation}>
                                                            {hist.observation || '-'}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                hist.result === 'APTO' ? 'bg-green-100 text-green-700' :
                                                                hist.result === 'INAPTO' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            }`}>
                                                                {hist.result}
                                                            </span>
                                                        </td>
                                                        {(user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) && (
                                                            <td className="px-3 py-2 text-right">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => editingRequest && handleChangeHistoryResult(editingRequest.id, hist.id)}
                                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Mudar Resultado"
                                                                >
                                                                    <Edit className="h-3.5 w-3.5" />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                                        Nenhum histórico registrado.
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-100 font-medium">Cancelar</button>
                    <button 
                        type="button" 
                        onClick={(e) => {
                            // Se não estiver na última aba, avança. Se estiver, submete.
                            // Mas o usuário pediu abas para navegar, então o botão Salvar deve estar sempre disponível ou apenas no final?
                            // O padrão geralmente é Salvar disponível sempre.
                            handleSave(e as any);
                        }} 
                        className="px-6 py-2 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 shadow-sm transition-all"
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </div>
       )}

       {/* Result Modal */}
       {isResultModalOpen && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
                   <h3 className="text-lg font-bold mb-4">Lançar Resultado</h3>
                   <form onSubmit={handleResultSave} className="space-y-4">
                       <div>
                           <label className="block text-sm font-medium mb-1">Resultado Final</label>
                           <select 
                             className="w-full border rounded p-2 font-bold bg-white text-gray-900"
                             value={resultData.result}
                             onChange={e => setResultData({...resultData, result: e.target.value as ExamResult})}
                           >
                               <option value="APTO">APTO</option>
                               <option value="INAPTO">INAPTO</option>
                               <option value="FALTOU">FALTOU</option>
                           </select>
                       </div>
                       <div>
                           <label className="block text-sm font-medium mb-1">Observações</label>
                           <textarea 
                               className="w-full border rounded p-2 bg-white text-gray-900" 
                               rows={3}
                               value={resultData.observation}
                               onChange={e => setResultData({...resultData, observation: e.target.value})}
                           ></textarea>
                       </div>
                       <div className="flex justify-end gap-3 mt-4">
                            <button type="button" onClick={() => setIsResultModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancelar</button>
                            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700">Confirmar Resultado</button>
                        </div>
                   </form>
               </div>
           </div>
       )}
    </div>
  );
};

export default RequestManager;
