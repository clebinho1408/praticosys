
import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, ExamStatus, ExamType, User, UserRole, RequestSource, ExamResult, ExamResultEntry, Instructor } from '../types';
import { Search, Calendar, Plus, UserPlus, Save, CheckSquare, X, User as UserIcon, Settings as SettingsIcon, History, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, AlertTriangle, Filter, Edit, Gavel, Car, Bike } from 'lucide-react';
import { AlertModal } from '../components/CustomModals';

interface RequestManagerProps {
  user: User;
  typeFilter?: ExamType; // If null, show all, or filtered by section
}

type ModalTabType = 'DATA' | 'PROCESS' | 'HISTORY';

// Validação de CPF (Algoritmo padrão Receita Federal)
function isValidCPF(cpf: string) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf == '') return false;
    if (cpf.length != 11 ||
        cpf == "00000000000" ||
        cpf == "11111111111" ||
        cpf == "22222222222" ||
        cpf == "33333333333" ||
        cpf == "44444444444" ||
        cpf == "55555555555" ||
        cpf == "66666666666" ||
        cpf == "77777777777" ||
        cpf == "88888888888" ||
        cpf == "99999999999")
        return false;
    let add = 0;
    for (let i = 0; i < 9; i++)
        add += parseInt(cpf.charAt(i)) * (10 - i);
    let rev = 11 - (add % 11);
    if (rev == 10 || rev == 11)
        rev = 0;
    if (rev != parseInt(cpf.charAt(9)))
        return false;
    add = 0;
    for (let i = 0; i < 10; i++)
        add += parseInt(cpf.charAt(i)) * (11 - i);
    rev = 11 - (add % 11);
    if (rev == 10 || rev == 11)
        rev = 0;
    if (rev != parseInt(cpf.charAt(10)))
        return false;
    return true;
}

const RequestManager: React.FC<RequestManagerProps> = ({ user, typeFilter }) => {
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // State for Accordions - INICIA FECHADO (Vazio)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  // Result Modal State
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultRequest, setResultRequest] = useState<ExamRequest | null>(null);
  const [resultForm, setResultForm] = useState({
      date: '',
      time: '',
      category: 'B',
      result: 'APTO' as ExamResult
  });

  // Create/Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTabType>('DATA');
  const [currentEditingStatus, setCurrentEditingStatus] = useState<ExamStatus | null>(null);

  // Alert Modal State
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'success' }>({
      isOpen: false,
      title: '',
      message: '',
      type: 'error'
  });

  // Estado auxiliar para a segunda placa no caso de categoria AB
  // Se for AB: newRequestData.vehiclePlate será a Moto, e secondaryPlate será o Carro.
  const [secondaryPlate, setSecondaryPlate] = useState('');

  // Create/Edit Request Form State
  const [newRequestData, setNewRequestData] = useState({
    id: '', 
    studentName: '',
    socialName: '',
    cpf: '',
    phone: '',
    examType: ExamType.COMMON,
    intendedCategory: '', // Alterado para vazio por padrão
    cnhRestriction: '',
    instructor: '', 
    vehiclePlate: '', 
    disabilityType: '',
    specialNeeds: '',
    completedPracticalCourse: false,
    paidFee: false,
    hasVehicle: false,
    examHistory: [] as ExamResultEntry[],
    observation: ''
  });

  const fetchData = async () => {
    try {
        const [requestsData, instructorsData] = await Promise.all([
          api.getRequests(),
          api.getInstructorsAsync()
        ]);
        
        let filteredRequests = requestsData;
        if (user.role === UserRole.SCHOOL) {
          filteredRequests = filteredRequests.filter(r => r.schoolId === user.schoolId);
        }
        
        if (typeFilter) {
          filteredRequests = filteredRequests.filter(r => r.examType === typeFilter);
        }

        setRequests(filteredRequests);
        setInstructors(instructorsData);
    } catch (e) {
        console.error("Erro ao carregar dados", e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, typeFilter]);

  const toggleSection = (status: string) => {
    setOpenSections(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  const handleUpdateStatus = async (id: string, status: ExamStatus, extraData = {}) => {
    await api.updateRequest(id, { status, ...extraData });
    fetchData();
  };
  
  const openResultModal = (req: ExamRequest) => {
      setResultRequest(req);
      setResultForm({
          date: req.scheduledDate || new Date().toISOString().split('T')[0],
          time: req.scheduledTime || '08:00',
          category: req.scheduledCategory || req.intendedCategory || 'B',
          result: 'APTO'
      });
      setIsResultModalOpen(true);
  };

  const handleSubmitResult = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!resultRequest) return;
      
      let nextStatus = ExamStatus.DONE;
      if (resultForm.result === 'INAPTO' || resultForm.result === 'FALTOU') {
          nextStatus = ExamStatus.WAITING_SCHEDULING;
      }

      const newHistoryEntry: ExamResultEntry = {
          id: `h_${Date.now()}`,
          date: resultForm.date,
          time: resultForm.time,
          category: resultForm.category,
          result: resultForm.result
      };

      const updatedHistory = [...resultRequest.examHistory, newHistoryEntry];

      await api.updateRequest(resultRequest.id, {
          status: nextStatus,
          result: resultForm.result,
          examHistory: updatedHistory,
          scheduleId: undefined,
          scheduledDate: undefined,
          scheduledTime: undefined,
          scheduledCategory: undefined,
          examinerId: undefined
      });

      setIsResultModalOpen(false);
      fetchData();
      // Abre o card correspondente ao novo status
      setOpenSections(prev => ({ ...prev, [nextStatus]: true }));
  };

  const openCreateModal = (req?: ExamRequest) => {
      setSecondaryPlate(''); // Reset secondary plate
      if (req) {
          setNewRequestData({
              id: req.id,
              studentName: req.studentName,
              socialName: req.socialName || '',
              cpf: req.cpf,
              phone: req.phone,
              examType: req.examType,
              intendedCategory: req.intendedCategory || '',
              cnhRestriction: req.cnhRestriction || '',
              instructor: req.instructor || '',
              vehiclePlate: req.vehiclePlate || '',
              disabilityType: req.disabilityType || '',
              specialNeeds: req.specialNeeds || '',
              completedPracticalCourse: req.completedPracticalCourse || false,
              paidFee: req.paidFee || false,
              hasVehicle: req.hasVehicle || false,
              examHistory: req.examHistory || [],
              observation: req.observation || ''
          });
          setCurrentEditingStatus(req.status);
      } else {
          setNewRequestData({
            id: '',
            studentName: '',
            socialName: '',
            cpf: '',
            phone: '',
            examType: typeFilter || ExamType.COMMON,
            intendedCategory: '', // Aberto sem valor padrão
            cnhRestriction: '',
            instructor: '',
            vehiclePlate: '',
            disabilityType: '',
            specialNeeds: '',
            completedPracticalCourse: false,
            paidFee: false,
            hasVehicle: false,
            examHistory: [],
            observation: ''
          });
          setCurrentEditingStatus(null);
      }
      setModalTab('DATA');
      setIsCreateModalOpen(true);
  };

  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
      setAlertState({ isOpen: true, title, message, type });
  };

  const handleSaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!isValidCPF(newRequestData.cpf)) {
          showAlert("CPF Inválido", "Por favor, verifique os números digitados e tente novamente.");
          return;
      }

      // Validação Básica
      if (!newRequestData.studentName.trim() || 
          !newRequestData.phone.trim() || 
          !newRequestData.cpf.trim() || 
          !newRequestData.intendedCategory || 
          !newRequestData.instructor.trim()) {
          showAlert("Campos Obrigatórios", "Preencha os campos obrigatórios: Nome, CPF, Telefone, Categoria e Instrutor.");
          return;
      }

      // Validação de Placas
      if (newRequestData.intendedCategory === 'AB') {
          if (!newRequestData.vehiclePlate || !secondaryPlate) {
              showAlert("Veículos Obrigatórios", "Para a categoria AB, é necessário selecionar a placa da Moto e do Carro.");
              return;
          }
      } else {
          if (!newRequestData.vehiclePlate) {
              showAlert("Veículo Obrigatório", "Selecione o veículo correspondente à categoria.");
              return;
          }
      }

      const payload = {
        studentName: newRequestData.studentName,
        socialName: newRequestData.socialName,
        cpf: newRequestData.cpf,
        phone: newRequestData.phone,
        examType: newRequestData.examType,
        intendedCategory: newRequestData.intendedCategory,
        cnhRestriction: newRequestData.cnhRestriction,
        instructor: newRequestData.instructor,
        vehiclePlate: newRequestData.vehiclePlate,
        disabilityType: newRequestData.disabilityType,
        specialNeeds: newRequestData.specialNeeds,
        completedPracticalCourse: newRequestData.completedPracticalCourse,
        paidFee: newRequestData.paidFee,
        hasVehicle: newRequestData.hasVehicle,
        examHistory: newRequestData.examHistory,
        observation: newRequestData.observation
      };

      const initialStatus = ExamStatus.WAITING_SCHEDULING;

      if (newRequestData.id) {
         await api.updateRequest(newRequestData.id, payload);
         showAlert("Sucesso", "Cadastro atualizado com sucesso!", "success");
      } else {
         if (newRequestData.intendedCategory === 'AB') {
             // Cria Solicitação Moto (Categoria A)
             await api.createRequest({ 
                 ...payload, 
                 intendedCategory: 'A', 
                 vehiclePlate: newRequestData.vehiclePlate, // Moto Plate
                 source: RequestSource.SCHOOL, 
                 schoolId: user.schoolId, 
                 status: initialStatus 
             });
             // Cria Solicitação Carro (Categoria B)
             await api.createRequest({ 
                 ...payload, 
                 intendedCategory: 'B', 
                 vehiclePlate: secondaryPlate, // Car Plate
                 source: RequestSource.SCHOOL, 
                 schoolId: user.schoolId, 
                 status: initialStatus 
             });
             showAlert("Sucesso", "Cadastro AB realizado! Foram criadas duas solicitações separadas (A e B).", "success");
         } else {
             await api.createRequest({ ...payload, source: RequestSource.SCHOOL, schoolId: user.schoolId, status: initialStatus });
             showAlert("Sucesso", "Candidato cadastrado com sucesso!", "success");
         }
      }

      setIsCreateModalOpen(false);
      await fetchData();
      setOpenSections({ [initialStatus]: true });
      
    } catch (error) {
      showAlert('Erro', 'Ocorreu um erro ao salvar o cadastro. Tente novamente.');
    }
  };

  const handleRemoveHistoryItem = (id: string) => {
      setNewRequestData(prev => ({
          ...prev,
          examHistory: prev.examHistory.filter(h => h.id !== id)
      }));
  };

  // --- Handlers for Inputs ---
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'studentName' | 'socialName') => {
      const val = e.target.value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z\s]/g, "");
      setNewRequestData(prev => ({ ...prev, [field]: val }));
  };
  
  const handleInstructorSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const instructorName = e.target.value;
      // Ao mudar instrutor, limpa as placas selecionadas
      setNewRequestData(prev => ({ 
          ...prev, 
          instructor: instructorName,
          vehiclePlate: '' 
      }));
      setSecondaryPlate('');
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '');
      setNewRequestData(prev => ({ ...prev, cpf: val }));
  };

  const handleRestrictionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, "");
      const spaced = raw.split('').join(' ');
      setNewRequestData(prev => ({ ...prev, cnhRestriction: spaced }));
  };

  // --- Helpers for Dynamic Vehicles ---
  const getSelectedInstructorVehicles = () => {
      const inst = instructors.find(i => i.name === newRequestData.instructor);
      if (!inst || !inst.vehicles) return { cars: [], motos: [] };
      return {
          cars: inst.vehicles.filter(v => v.type === 'CAR' && v.active),
          motos: inst.vehicles.filter(v => v.type === 'MOTO' && v.active)
      };
  };

  const statusGroups = [
    { 
      id: ExamStatus.WAITING_SCHEDULING, 
      label: 'Aguardando Agendamento', 
      icon: Clock,
      colorClass: 'border-l-4 border-yellow-400', 
      headerClass: 'text-yellow-800 bg-yellow-50 hover:bg-yellow-100',
    },
    { 
      id: ExamStatus.SCHEDULED, 
      label: 'Agendado', 
      icon: Calendar,
      colorClass: 'border-l-4 border-blue-500', 
      headerClass: 'text-blue-800 bg-blue-50 hover:bg-blue-100',
    },
    { 
      id: ExamStatus.WAITING_RESULT, 
      label: 'Aguardando Resultado', 
      icon: AlertTriangle, 
      colorClass: 'border-l-4 border-purple-500', 
      headerClass: 'text-purple-800 bg-purple-50 hover:bg-purple-100',
    },
    { 
      id: ExamStatus.DONE, 
      label: 'Realizado', 
      icon: CheckCircle,
      colorClass: 'border-l-4 border-green-500', 
      headerClass: 'text-green-800 bg-green-50 hover:bg-green-100',
    },
    { 
      id: ExamStatus.CANCELLED, 
      label: 'Cancelado', 
      icon: XCircle,
      colorClass: 'border-l-4 border-red-500', 
      headerClass: 'text-red-800 bg-red-50 hover:bg-red-100',
    },
  ];

  return (
    <div className="space-y-6">
      <AlertModal 
         isOpen={alertState.isOpen}
         title={alertState.title}
         message={alertState.message}
         type={alertState.type}
         onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
      />
      
      {/* Header & Filter */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-col sm:flex-row justify-between gap-4 items-center">
         <div className="flex gap-4 w-full sm:w-auto flex-1 items-center flex-wrap">
            <div className="relative max-w-md w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar por nome ou CPF..."
                    className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />
            </div>
            
            <div className="relative w-full sm:w-auto">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select 
                    className="w-full sm:w-56 pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900 appearance-none cursor-pointer"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">Todos os Status</option>
                    {statusGroups.map(group => (
                        <option key={group.id} value={group.id}>{group.label}</option>
                    ))}
                </select>
            </div>
         </div>
         <button 
            onClick={() => openCreateModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
        >
            <UserPlus className="h-4 w-4" /> Novo Candidato
        </button>
      </div>

      {/* Status Accordions */}
      <div className="space-y-4">
        {statusGroups.filter(g => !statusFilter || g.id === statusFilter).map((group) => {
          const groupRequests = requests.filter(r => 
            r.status === group.id &&
            (r.studentName.toLowerCase().includes(filterText.toLowerCase()) || r.cpf.includes(filterText))
          );
          
          const isOpen = !!openSections[group.id];
          const Icon = group.icon;

          return (
            <div key={group.id} className={`bg-white rounded-lg shadow-sm overflow-hidden transition-all duration-200 ${group.colorClass}`}>
              <button 
                onClick={() => toggleSection(group.id)}
                className={`w-full flex items-center justify-between p-4 transition-colors ${group.headerClass}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span className="font-bold text-lg">{group.label}</span>
                  <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-bold border border-black/5">
                    {groupRequests.length}
                  </span>
                </div>
                {isOpen ? <ChevronUp className="h-5 w-5 opacity-70" /> : <ChevronDown className="h-5 w-5 opacity-70" />}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 animate-fadeIn">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-600 font-medium">
                        <tr>
                          <th className="px-6 py-3">Data Cadastro</th>
                          <th className="px-6 py-3">Candidato</th>
                          <th className="px-6 py-3">Categoria</th>
                          <th className="px-6 py-3">Tipo</th>
                          <th className="px-6 py-3">Histórico</th>
                          <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {groupRequests.map(req => (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="text-gray-600 text-xs">
                                  {req.createdAt ? new Date(req.createdAt).toLocaleString() : '-'}
                                  {req.result && req.status === ExamStatus.DONE && (
                                     <div className="mt-1"><ResultBadge result={req.result} status={req.status} /></div>
                                  )}
                                </div>
                            </td>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => openCreateModal(req)}>
                              <div className="font-medium text-gray-900 hover:text-blue-600 uppercase">
                                  {req.socialName ? req.socialName : req.studentName}
                              </div>
                              {req.socialName && <div className="text-xs text-gray-500 italic">(Reg: {req.studentName})</div>}
                              <div className="text-xs text-gray-500">{req.cpf}</div>
                              <div className="text-xs text-gray-400 mt-1">{req.instructor ? `Instr: ${req.instructor}` : ''} {req.vehiclePlate ? `| Placa: ${req.vehiclePlate}` : ''}</div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="font-mono font-bold bg-gray-100 px-2 py-1 rounded text-gray-700">
                                    {req.intendedCategory || 'B'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${req.examType === ExamType.PCD ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                {req.examType === ExamType.COMMON ? '1ª Hab.' : req.examType}
                              </span>
                            </td>
                             <td className="px-6 py-4">
                                <span className="text-xs text-gray-500">{req.examHistory?.length || 0} tentativas</span>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2 flex justify-end items-center">
                              <button onClick={() => openCreateModal(req)} className="text-gray-500 hover:text-blue-600" title="Editar/Visualizar">
                                  <Edit className="h-5 w-5" />
                              </button>

                              {user.role !== UserRole.SCHOOL && (
                                <>
                                    {(req.status === ExamStatus.WAITING_SCHEDULING || req.status === ExamStatus.RETEST) && (
                                        <button onClick={() => handleUpdateStatus(req.id, ExamStatus.CANCELLED)} className="text-red-600 hover:text-red-800" title="Cancelar"><X className="h-5 w-5"/></button>
                                    )}
                                    
                                    {req.status === ExamStatus.SCHEDULED && (
                                        <button onClick={() => handleUpdateStatus(req.id, ExamStatus.WAITING_RESULT)} className="text-blue-600 hover:text-blue-800" title="Enviar para Aguardando Resultado"><CheckSquare className="h-5 w-5"/></button>
                                    )}

                                     {req.status === ExamStatus.WAITING_RESULT && (
                                        <button onClick={() => openResultModal(req)} className="text-green-600 hover:text-green-800 border border-green-200 px-2 py-1 rounded text-xs font-medium flex items-center gap-1" title="Lançar Resultado">
                                            <Gavel className="h-3 w-3" /> Lançar Resultado
                                        </button>
                                    )}

                                    {req.status === ExamStatus.DONE && req.result === 'INAPTO' && (
                                        <button 
                                            onClick={() => handleUpdateStatus(req.id, ExamStatus.RETEST)} 
                                            className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 border border-orange-200"
                                        >
                                            Reteste
                                        </button>
                                    )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                        {groupRequests.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                              Nenhum candidato neste status.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Create/Edit Request */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh] animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b">
                <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <UserPlus className="h-6 w-6 text-blue-600" /> 
                        {newRequestData.id ? 'Editar Candidato' : 'Novo Cadastro de Candidato'}
                    </h3>
                    {currentEditingStatus && (
                         <StatusBadge status={currentEditingStatus} />
                    )}
                </div>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
            </div>
            
            {/* Modal Tabs */}
            <div className="flex bg-gray-50 border-b px-6">
                <button 
                    onClick={() => setModalTab('DATA')} 
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'DATA' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                   <UserIcon className="h-4 w-4" /> Dados Pessoais
                </button>
                <button 
                    onClick={() => setModalTab('PROCESS')} 
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'PROCESS' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                   <SettingsIcon className="h-4 w-4" /> Dados Complementares
                </button>
                <button 
                    onClick={() => setModalTab('HISTORY')} 
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'HISTORY' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                   <History className="h-4 w-4" /> Histórico de Provas
                </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto flex-1">
                <form id="requestForm" onSubmit={handleSaveRequest}>
                    {/* TAB: DATA */}
                    {modalTab === 'DATA' && (
                         <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-600">CPF <span className="text-red-500">*</span></label>
                                    <input 
                                        required 
                                        type="text" 
                                        placeholder="Apenas números" 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.cpf} 
                                        onChange={handleCpfChange} 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Apenas números. Validação obrigatória.</p>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-600">Nome Completo <span className="text-red-500">*</span></label>
                                    <input 
                                        required 
                                        type="text" 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.studentName} 
                                        onChange={(e) => handleNameChange(e, 'studentName')} 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Apenas letras, sem acentos, maiúsculo.</p>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-600">Nome Social (Opcional)</label>
                                    <input 
                                        type="text" 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.socialName} 
                                        onChange={(e) => handleNameChange(e, 'socialName')} 
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-gray-600">Telefone <span className="text-red-500">*</span></label>
                                    <input required type="text" className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" value={newRequestData.phone} onChange={e => setNewRequestData({...newRequestData, phone: e.target.value})} />
                                </div>
                            </div>
                         </div>
                    )}

                    {/* TAB: PROCESS */}
                    {modalTab === 'PROCESS' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600">Tipo de Processo</label>
                                    <select className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" value={newRequestData.examType} onChange={e => setNewRequestData({...newRequestData, examType: e.target.value as ExamType})}>
                                        <option value={ExamType.COMMON}>1ª Habilitação</option>
                                        <option value={ExamType.PCD}>Processo PCD</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600">Categoria Pretendida <span className="text-red-500">*</span></label>
                                    <select 
                                        required 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.intendedCategory} 
                                        onChange={e => {
                                            setNewRequestData({...newRequestData, intendedCategory: e.target.value, vehiclePlate: ''});
                                            setSecondaryPlate('');
                                        }}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="A">A (Moto)</option>
                                        <option value="B">B (Carro)</option>
                                        <option value="AB">AB (Carro e Moto)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600">Restrição CNH (Opcional)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: A G" 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.cnhRestriction} 
                                        onChange={handleRestrictionChange} 
                                    />
                                </div>
                                
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-gray-600">Instrutor <span className="text-red-500">*</span></label>
                                    <select 
                                        required 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.instructor} 
                                        onChange={handleInstructorSelect}
                                    >
                                        <option value="">Selecione um Instrutor...</option>
                                        {instructors.map(inst => (
                                            <option key={inst.id} value={inst.name}>{inst.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* SELEÇÃO DE VEÍCULOS DINÂMICA */}
                                {newRequestData.instructor && (
                                    <>
                                        {/* Caso AB: Exibe 2 selects (Moto e Carro) */}
                                        {newRequestData.intendedCategory === 'AB' && (
                                            <>
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-medium text-gray-600 flex items-center gap-1"><Bike className="h-3 w-3"/> Placa Moto (Cat. A) <span className="text-red-500">*</span></label>
                                                    <select 
                                                        required 
                                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900"
                                                        value={newRequestData.vehiclePlate}
                                                        onChange={e => setNewRequestData({...newRequestData, vehiclePlate: e.target.value})}
                                                    >
                                                        <option value="">Selecione a Moto...</option>
                                                        {getSelectedInstructorVehicles().motos.map(v => (
                                                            <option key={v.id} value={v.plate}>{v.brand} {v.model} ({v.plate})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-medium text-gray-600 flex items-center gap-1"><Car className="h-3 w-3"/> Placa Carro (Cat. B) <span className="text-red-500">*</span></label>
                                                    <select 
                                                        required 
                                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900"
                                                        value={secondaryPlate}
                                                        onChange={e => setSecondaryPlate(e.target.value)}
                                                    >
                                                        <option value="">Selecione o Carro...</option>
                                                        {getSelectedInstructorVehicles().cars.map(v => (
                                                            <option key={v.id} value={v.plate}>{v.brand} {v.model} ({v.plate})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </>
                                        )}

                                        {/* Caso A: Exibe 1 select (Moto) */}
                                        {newRequestData.intendedCategory === 'A' && (
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-600 flex items-center gap-1"><Bike className="h-3 w-3"/> Placa Moto <span className="text-red-500">*</span></label>
                                                <select 
                                                    required 
                                                    className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900"
                                                    value={newRequestData.vehiclePlate}
                                                    onChange={e => setNewRequestData({...newRequestData, vehiclePlate: e.target.value})}
                                                >
                                                    <option value="">Selecione a Moto...</option>
                                                    {getSelectedInstructorVehicles().motos.map(v => (
                                                        <option key={v.id} value={v.plate}>{v.brand} {v.model} ({v.plate})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Caso B: Exibe 1 select (Carro) */}
                                        {newRequestData.intendedCategory === 'B' && (
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-gray-600 flex items-center gap-1"><Car className="h-3 w-3"/> Placa Carro <span className="text-red-500">*</span></label>
                                                <select 
                                                    required 
                                                    className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900"
                                                    value={newRequestData.vehiclePlate}
                                                    onChange={e => setNewRequestData({...newRequestData, vehiclePlate: e.target.value})}
                                                >
                                                    <option value="">Selecione o Carro...</option>
                                                    {getSelectedInstructorVehicles().cars.map(v => (
                                                        <option key={v.id} value={v.plate}>{v.brand} {v.model} ({v.plate})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        
                                        {/* Caso o instrutor não tenha veículos cadastrados na categoria selecionada */}
                                        {((newRequestData.intendedCategory === 'B' && getSelectedInstructorVehicles().cars.length === 0) ||
                                          (newRequestData.intendedCategory === 'A' && getSelectedInstructorVehicles().motos.length === 0)) && (
                                            <div className="col-span-3 text-red-500 text-xs mt-1">
                                                Atenção: Este instrutor não possui veículos cadastrados para a categoria selecionada.
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="col-span-3 pt-4 border-t mt-2">
                                    <label className="block text-xs font-medium text-gray-600 mb-2">Requisitos</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center text-sm">
                                            <input type="checkbox" checked={newRequestData.paidFee} onChange={e => setNewRequestData({...newRequestData, paidFee: e.target.checked})} className="mr-2" />
                                            Taxa Paga
                                        </label>
                                        <label className="flex items-center text-sm">
                                            <input type="checkbox" checked={newRequestData.completedPracticalCourse} onChange={e => setNewRequestData({...newRequestData, completedPracticalCourse: e.target.checked})} className="mr-2" />
                                            Curso Prático Concluído
                                        </label>
                                    </div>
                                </div>

                                <div className="col-span-3">
                                   <label className="block text-xs font-medium text-gray-600">Observações</label>
                                   <textarea rows={3} className="w-full border rounded p-2 mt-1 bg-white text-gray-900" value={newRequestData.observation} onChange={e => setNewRequestData({...newRequestData, observation: e.target.value})}></textarea>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: HISTORY */}
                    {modalTab === 'HISTORY' && (
                        <div className="space-y-6">
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="px-4 py-2">Data</th>
                                            <th className="px-4 py-2">Hora</th>
                                            <th className="px-4 py-2">Categoria</th>
                                            <th className="px-4 py-2">Resultado</th>
                                            <th className="px-4 py-2 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {newRequestData.examHistory.map((entry) => (
                                            <tr key={entry.id} className="bg-white">
                                                <td className="px-4 py-2">{new Date(entry.date).toLocaleDateString()}</td>
                                                <td className="px-4 py-2">{entry.time}</td>
                                                <td className="px-4 py-2"><span className="font-mono font-bold bg-gray-50 px-1.5 py-0.5 rounded border">{entry.category || '-'}</span></td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                        entry.result === 'APTO' ? 'bg-green-100 text-green-800' :
                                                        entry.result === 'INAPTO' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {entry.result}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <button type="button" onClick={() => handleRemoveHistoryItem(entry.id)} className="text-red-500 hover:text-red-700 text-xs">Remover</button>
                                                </td>
                                            </tr>
                                        ))}
                                        {newRequestData.examHistory.length === 0 && (
                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Nenhum resultado registrado.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-white">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                <button form="requestForm" type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
                    <Save className="h-4 w-4" /> Salvar Cadastro
                </button>
            </div>

          </div>
        </div>
      )}

      {/* Result Modal */}
      {isResultModalOpen && resultRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-md w-full p-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-4 border-b pb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Lançar Resultado</h3>
                    <p className="text-xl font-bold text-red-600 mt-2 uppercase">{resultRequest.socialName || resultRequest.studentName}</p>
                    <p className="text-lg font-bold text-red-600 font-mono">CPF: {resultRequest.cpf}</p>
                </div>
                <button onClick={() => setIsResultModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            <form onSubmit={handleSubmitResult} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Data Realizada</label>
                        <input type="date" required className="w-full border rounded p-2 bg-white text-gray-700" value={resultForm.date} onChange={e => setResultForm({...resultForm, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
                        <input type="time" required className="w-full border rounded p-2 bg-white text-gray-700" value={resultForm.time} onChange={e => setResultForm({...resultForm, time: e.target.value})} />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                    <select required className="w-full border rounded p-2 bg-white text-gray-700" value={resultForm.category} onChange={e => setResultForm({...resultForm, category: e.target.value})}>
                        <option value="A">A (Moto)</option>
                        <option value="B">B (Carro)</option>
                    </select>
                </div>
                
                <div className="border-t pt-4 mt-2">
                    <label className="block text-sm font-bold text-gray-800 mb-2">Resultado Final</label>
                    <div className="grid grid-cols-3 gap-3">
                        <button type="button" onClick={() => setResultForm({...resultForm, result: 'APTO'})} className={`py-2 px-1 rounded border text-sm font-bold transition-all ${resultForm.result === 'APTO' ? 'bg-green-600 text-white border-green-600 ring-2 ring-green-300' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                            APTO
                        </button>
                        <button type="button" onClick={() => setResultForm({...resultForm, result: 'INAPTO'})} className={`py-2 px-1 rounded border text-sm font-bold transition-all ${resultForm.result === 'INAPTO' ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-300' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                            INAPTO
                        </button>
                        <button type="button" onClick={() => setResultForm({...resultForm, result: 'FALTOU'})} className={`py-2 px-1 rounded border text-sm font-bold transition-all ${resultForm.result === 'FALTOU' ? 'bg-gray-600 text-white border-gray-600 ring-2 ring-gray-300' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                            FALTOU
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button type="button" onClick={() => setIsResultModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">
                        Confirmar Resultado
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: ExamStatus }> = ({ status }) => {
  const styles = {
    [ExamStatus.WAITING_SCHEDULING]: 'bg-yellow-100 text-yellow-800',
    [ExamStatus.SCHEDULED]: 'bg-blue-100 text-blue-800',
    [ExamStatus.WAITING_RESULT]: 'bg-purple-100 text-purple-800',
    [ExamStatus.DONE]: 'bg-green-100 text-green-800',
    [ExamStatus.RETEST]: 'bg-orange-100 text-orange-800',
    [ExamStatus.CANCELLED]: 'bg-red-100 text-red-800',
  };

  const labels = {
    [ExamStatus.WAITING_SCHEDULING]: 'Aguardando Agendamento',
    [ExamStatus.SCHEDULED]: 'Agendado',
    [ExamStatus.WAITING_RESULT]: 'Aguardando Resultado',
    [ExamStatus.DONE]: 'Realizado',
    [ExamStatus.RETEST]: 'Reteste',
    [ExamStatus.CANCELLED]: 'Cancelado',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

const ResultBadge: React.FC<{ result?: ExamResult, status: ExamStatus }> = ({ result, status }) => {
    if (status === ExamStatus.CANCELLED) {
         return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">CANCELADO</span>
    }
    
    if (!result) return <span className="text-gray-400 text-xs mt-1 block">-</span>;

    const styles = {
        'APTO': 'bg-green-100 text-green-800',
        'INAPTO': 'bg-red-100 text-red-800',
        'FALTOU': 'bg-gray-200 text-gray-700'
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 mt-1 rounded-full text-xs font-bold ${styles[result]}`}>
            {result}
        </span>
    );
}

export default RequestManager;
