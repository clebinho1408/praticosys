
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { 
  ExamRequest, 
  ExamType, 
  Examiner, 
  ExamStatus, 
  DrivingSchool,
  User, 
  UserRole 
} from '../types';
import { 
  Plus, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  Clock,
  CheckCircle2,
  CheckCircle,
  FileText,
  XCircle,
  Edit,
  Trash2,
  X,
  Save,
  RefreshCw
} from 'lucide-react';

interface CFCSchedulingCenterProps {
  user: User;
}

const CFCSchedulingCenter: React.FC<CFCSchedulingCenterProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [schools, setSchools] = useState<DrivingSchool[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  
  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    extras: true,
    waiting: true,
    confirmed: true,
    done: false,
    cancelled: false
  });

  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Filters state
  const [filters, setFilters] = useState({
    status: 'ALL',
    schoolId: user.role === UserRole.SCHOOL ? user.schoolId || '' : 'ALL',
    examinerId: 'ALL',
    startDate: '',
    endDate: ''
  });

  // Modal states
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'blue' | 'red' | 'green';
  } | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<ExamRequest | null>(null);
  const [newRequest, setNewRequest] = useState({
    schoolId: user.role === UserRole.SCHOOL ? user.schoolId || '' : '',
    categories: [] as string[],
    examinerId: '',
    date: '',
    time: '',
    observation: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqs, schs, exms] = await Promise.all([
        api.getRequests(),
        api.getSchoolsAsync(),
        api.getExaminersAsync()
      ]);
      
      // Filter for CFC (COMMON)
      const cfcReqs = reqs.filter(r => r.examType === ExamType.COMMON);
      
      setRequests(cfcReqs);
      setSchools(schs);
      setExaminers(exms);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleDay = (day: string) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  };

  // Logic to group and filter data
  const filteredRequests = requests.filter(r => {
    if (user.role === UserRole.SCHOOL && r.schoolId !== user.schoolId) return false;
    if (filters.schoolId !== 'ALL' && r.schoolId !== filters.schoolId) return false;
    // Add more filters as needed
    return true;
  });

  const extras = filteredRequests.filter(r => r.status === ExamStatus.WAITING_SCHEDULING);
  const waitingConfirmation = filteredRequests.filter(r => r.status === ExamStatus.SCHEDULED && !r.attendanceConfirmed);
  const confirmed = filteredRequests.filter(r => r.status === ExamStatus.SCHEDULED && r.attendanceConfirmed);
  const done = filteredRequests.filter(r => r.status === ExamStatus.DONE);
  const cancelled = filteredRequests.filter(r => r.status === ExamStatus.CANCELLED);

  // Group confirmed by day
  const groupedConfirmed: Record<string, ExamRequest[]> = {};
  confirmed.forEach(r => {
    const date = r.scheduledDate || 'Sem Data';
    if (!groupedConfirmed[date]) groupedConfirmed[date] = [];
    groupedConfirmed[date].push(r);
  });

  const getDayName = (dateStr: string) => {
    if (dateStr === 'Sem Data') return dateStr;
    const date = new Date(dateStr);
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[date.getDay()];
  };

  const getSchoolName = (id?: string) => schools.find(s => s.id === id)?.name || 'N/A';
  const getExaminerName = (id?: string) => examiners.find(e => e.id === id)?.name || 'SEM IDENTIFICAÇÃO';

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Não definida';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleConfirmAction = (req: ExamRequest) => {
    setConfirmConfig({
      title: 'Confirmar Agendamento',
      message: 'Tem certeza que deseja confirmar este agendamento?',
      type: 'blue',
      onConfirm: async () => {
        await api.updateRequest(req.id, { attendanceConfirmed: true });
        setIsConfirmModalOpen(false);
        fetchData();
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleCancelAction = (req: ExamRequest) => {
    setConfirmConfig({
      title: 'Confirmar Cancelado',
      message: "Tem certeza que deseja alterar o status deste agendamento para 'Cancelado'?",
      type: 'red',
      onConfirm: async () => {
        await api.updateRequest(req.id, { status: ExamStatus.CANCELLED });
        setIsConfirmModalOpen(false);
        fetchData();
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleRealizadoAction = (req: ExamRequest) => {
    setConfirmConfig({
      title: 'Confirmar Realizado',
      message: "Tem certeza que deseja alterar o status deste agendamento para 'Realizado'?",
      type: 'green',
      onConfirm: async () => {
        await api.updateRequest(req.id, { status: ExamStatus.DONE });
        setIsConfirmModalOpen(false);
        fetchData();
      }
    });
    setIsConfirmModalOpen(true);
  };

  const handleSubmitNew = async () => {
    if (!newRequest.schoolId || newRequest.categories.length === 0 || !newRequest.date || !newRequest.time) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    try {
      // Create a request for each category, or one request with multiple categories?
      // Usually it's one request per student, but here it seems to be a "banca" request or something similar.
      // Based on the UI "10 vagas por Categoria", it might be a bulk request or just a single one.
      // Let's assume it's a single request for the school for those categories.
      
      await api.createRequest({
        schoolId: newRequest.schoolId,
        examType: ExamType.COMMON,
        intendedCategory: newRequest.categories.join(','),
        status: ExamStatus.WAITING_SCHEDULING,
        scheduledDate: newRequest.date,
        scheduledTime: newRequest.time,
        examinerId: newRequest.examinerId,
        observation: newRequest.observation,
        createdAt: new Date().toISOString()
      });

      setIsNewModalOpen(false);
      setNewRequest({
        schoolId: user.role === UserRole.SCHOOL ? user.schoolId || '' : '',
        categories: [],
        examinerId: '',
        date: '',
        time: '',
        observation: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Erro ao criar agendamento.');
    }
  };

  const handleUpdateEdit = async () => {
    if (!selectedRequest) return;

    try {
      await api.updateRequest(selectedRequest.id, {
        schoolId: selectedRequest.schoolId,
        intendedCategory: selectedRequest.intendedCategory,
        scheduledDate: selectedRequest.scheduledDate,
        scheduledTime: selectedRequest.scheduledTime,
        examinerId: selectedRequest.examinerId,
        observation: selectedRequest.observation,
        status: selectedRequest.status,
        attendanceConfirmed: selectedRequest.attendanceConfirmed
      });
      setIsEditModalOpen(false);
      setSelectedRequest(null);
      fetchData();
    } catch (error) {
      console.error('Error updating request:', error);
      alert('Erro ao atualizar agendamento.');
    }
  };

  const handleDeleteAction = (req: ExamRequest) => {
    setConfirmConfig({
      title: 'Excluir Agendamento',
      message: 'Tem certeza que deseja excluir permanentemente este agendamento?',
      type: 'red',
      onConfirm: async () => {
        await api.deleteRequest(req.id);
        setIsConfirmModalOpen(false);
        fetchData();
      }
    });
    setIsConfirmModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agendamentos</h1>
          <p className="text-slate-500 text-sm">Gerencie os agendamentos de provas práticas</p>
        </div>
        <button 
          onClick={() => setIsNewModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-bold text-sm shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo Agendamento
        </button>
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <h2 className="font-bold text-slate-700 text-sm">Filtros</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
            <select 
              className="w-full border border-slate-200 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.status}
              onChange={e => setFilters({...filters, status: e.target.value})}
            >
              <option value="ALL">Todos</option>
              <option value="WAITING">Aguardando</option>
              <option value="CONFIRMED">Confirmados</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Autoescola</label>
            <select 
              className="w-full border border-slate-200 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={user.role === UserRole.SCHOOL}
              value={filters.schoolId}
              onChange={e => setFilters({...filters, schoolId: e.target.value})}
            >
              <option value="ALL">Todas</option>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Examinador</label>
            <select 
              className="w-full border border-slate-200 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.examinerId}
              onChange={e => setFilters({...filters, examinerId: e.target.value})}
            >
              <option value="ALL">Todos</option>
              {examiners.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Início</label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.startDate}
              onChange={e => setFilters({...filters, startDate: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Fim</label>
            <input 
              type="date" 
              className="w-full border border-slate-200 rounded-md p-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              value={filters.endDate}
              onChange={e => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* ACCORDIONS */}
      <div className="space-y-4">
        
        {/* SECTION: EXTRAS */}
        <div className="border border-orange-200 rounded-lg overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleSection('extras')}
            className="w-full flex items-center justify-between p-4 bg-orange-50/50 hover:bg-orange-50 transition-colors"
          >
            <div className="flex items-center gap-3 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-bold">Solicitações de Provas Extras ({extras.length})</span>
            </div>
            {expandedSections.extras ? <ChevronUp className="h-5 w-5 text-orange-400" /> : <ChevronDown className="h-5 w-5 text-orange-400" />}
          </button>
          
          {expandedSections.extras && (
            <div className="p-4 bg-white space-y-4">
              {extras.map(req => (
                <div key={req.id} className="border border-slate-100 rounded-lg p-4 relative group hover:border-orange-200 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-black text-slate-800 uppercase">{getSchoolName(req.schoolId)}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 text-xs">
                        <p><span className="text-slate-400 font-bold">Tipo:</span> <span className="text-slate-600">Extra</span></p>
                        <p><span className="text-slate-400 font-bold">Data:</span> <span className="text-red-500 font-bold">Não definida</span></p>
                        <p><span className="text-slate-400 font-bold">Examinador:</span> <span className="text-red-500 font-bold">Não definido</span></p>
                        <p><span className="text-slate-400 font-bold">Exame:</span> <span className="text-slate-600">1º Habilitação</span></p>
                        <p className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold">Categoria:</span> 
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">{req.intendedCategory || 'AB'}</span>
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold">Status:</span> 
                          <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-black uppercase">Solicitar Prova Extra</span>
                        </p>
                      </div>
                      <div className="pt-2 text-[10px] text-slate-400">
                        <p><span className="font-bold">Cadastrado em:</span> {new Date(req.createdAt).toLocaleString()}</p>
                        {req.observation && <p><span className="font-bold">Observações:</span> {req.observation}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {user.role !== UserRole.SCHOOL && (
                        <button 
                          onClick={() => {
                            setSelectedRequest(req);
                            setIsEditModalOpen(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 font-bold text-xs shadow-sm transition-colors"
                        >
                          <FileText className="h-3 w-3" /> Receber Solicitação
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsEditModalOpen(true);
                        }}
                        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {extras.length === 0 && <p className="text-center py-4 text-slate-400 text-sm italic">Nenhuma solicitação extra pendente.</p>}
            </div>
          )}
        </div>

        {/* SECTION: WAITING CONFIRMATION */}
        <div className="border border-amber-200 rounded-lg overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleSection('waiting')}
            className="w-full flex items-center justify-between p-4 bg-amber-50/50 hover:bg-amber-50 transition-colors"
          >
            <div className="flex items-center gap-3 text-amber-700">
              <Clock className="h-5 w-5" />
              <span className="font-bold">Aguardando Confirmação ({waitingConfirmation.length})</span>
            </div>
            {expandedSections.waiting ? <ChevronUp className="h-5 w-5 text-amber-400" /> : <ChevronDown className="h-5 w-5 text-amber-400" />}
          </button>
          
          {expandedSections.waiting && (
            <div className="p-4 bg-white space-y-4">
              {waitingConfirmation.map(req => (
                <div key={req.id} className="border border-slate-100 rounded-lg p-4 relative group hover:border-amber-200 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-black text-slate-800 uppercase">{getSchoolName(req.schoolId)}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 text-xs">
                        <p><span className="text-slate-400 font-bold">Tipo:</span> <span className="text-slate-600">Fixa</span></p>
                        <p><span className="text-slate-400 font-bold">Data:</span> <span className="text-red-600 font-bold">{formatDate(req.scheduledDate)} às {req.scheduledTime || '08:00'}</span></p>
                        <p><span className="text-slate-400 font-bold">Examinador:</span> <span className="text-red-600 font-bold uppercase">{getExaminerName(req.examinerId)}</span></p>
                        <p><span className="text-slate-400 font-bold">Exame:</span> <span className="text-slate-600">1º Habilitação</span></p>
                        <p className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold">Categoria:</span> 
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">{req.intendedCategory || 'AB'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleConfirmAction(req)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md flex items-center gap-2 font-bold text-xs shadow-sm transition-colors"
                      >
                        <CheckCircle className="h-3 w-3" /> Confirmar
                      </button>
                      <button 
                        onClick={() => handleCancelAction(req)}
                        className="border border-red-200 text-red-600 hover:bg-red-50 px-4 py-1.5 rounded-md flex items-center gap-2 font-bold text-xs transition-colors"
                      >
                        <XCircle className="h-3 w-3" /> Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {waitingConfirmation.length === 0 && <p className="text-center py-4 text-slate-400 text-sm italic">Nenhum agendamento aguardando confirmação.</p>}
            </div>
          )}
        </div>

        {/* SECTION: CONFIRMED */}
        <div className="border border-green-200 rounded-lg overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleSection('confirmed')}
            className="w-full flex items-center justify-between p-4 bg-green-50/50 hover:bg-green-50 transition-colors"
          >
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-bold">Provas Confirmadas ({confirmed.length})</span>
            </div>
            {expandedSections.confirmed ? <ChevronUp className="h-5 w-5 text-green-400" /> : <ChevronDown className="h-5 w-5 text-green-400" />}
          </button>
          
          {expandedSections.confirmed && (
            <div className="p-4 bg-white space-y-4">
              {Object.entries(groupedConfirmed).sort().map(([date, reqs]) => (
                <div key={date} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button 
                    onClick={() => toggleDay(date)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
                  >
                    <span className="font-bold text-slate-700 text-sm">{getDayName(date)} ({reqs.length})</span>
                    {expandedDays[date] ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>
                  
                  {expandedDays[date] && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50/50 text-slate-400 uppercase font-bold border-b border-slate-100">
                            <th className="px-4 py-3">Tipo</th>
                            <th className="px-4 py-3">Autoescola</th>
                            <th className="px-4 py-3">Data</th>
                            <th className="px-4 py-3">Horário</th>
                            <th className="px-4 py-3">Examinador</th>
                            <th className="px-4 py-3">Exame</th>
                            <th className="px-4 py-3">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {reqs.map(req => (
                            <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-3 text-slate-600">Fixa</td>
                              <td className="px-4 py-3 font-black text-slate-800 uppercase">{getSchoolName(req.schoolId)}</td>
                              <td className="px-4 py-3 text-slate-600">{formatDate(req.scheduledDate)}</td>
                              <td className="px-4 py-3 text-slate-600">{req.scheduledTime || '08:00'}</td>
                              <td className="px-4 py-3 text-slate-600 uppercase">{getExaminerName(req.examinerId)}</td>
                              <td className="px-4 py-3 text-slate-600">1º Habilitação</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => handleRealizadoAction(req)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 font-bold text-[10px] shadow-sm transition-colors"
                                  >
                                    <CheckCircle className="h-3 w-3" /> Realizado
                                  </button>
                                  <button 
                                    onClick={() => handleCancelAction(req)}
                                    className="border border-red-200 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md flex items-center gap-1.5 font-bold text-[10px] transition-colors"
                                  >
                                    <XCircle className="h-3 w-3" /> Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
              {confirmed.length === 0 && <p className="text-center py-4 text-slate-400 text-sm italic">Nenhum agendamento confirmado.</p>}
            </div>
          )}
        </div>

        {/* SECTION: DONE */}
        <div className="border border-blue-200 rounded-lg overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleSection('done')}
            className="w-full flex items-center justify-between p-4 bg-blue-50/50 hover:bg-blue-50 transition-colors"
          >
            <div className="flex items-center gap-3 text-blue-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-bold">Provas Realizadas ({done.length})</span>
            </div>
            {expandedSections.done ? <ChevronUp className="h-5 w-5 text-blue-400" /> : <ChevronDown className="h-5 w-5 text-blue-400" />}
          </button>
          {expandedSections.done && (
            <div className="p-4 bg-white">
               {done.length > 0 ? (
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-xs">
                     <thead>
                       <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                         <th className="px-4 py-3">Autoescola</th>
                         <th className="px-4 py-3">Data</th>
                         <th className="px-4 py-3">Examinador</th>
                         <th className="px-4 py-3">Categoria</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                       {done.map(req => (
                         <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                           <td className="px-4 py-3 font-black text-slate-800 uppercase">{getSchoolName(req.schoolId)}</td>
                           <td className="px-4 py-3 text-slate-600">{formatDate(req.scheduledDate)}</td>
                           <td className="px-4 py-3 text-slate-600 uppercase">{getExaminerName(req.examinerId)}</td>
                           <td className="px-4 py-3 text-slate-600 uppercase">{req.intendedCategory}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               ) : (
                 <p className="text-center py-4 text-slate-400 text-sm italic">Nenhuma prova realizada encontrada.</p>
               )}
            </div>
          )}
        </div>

        {/* SECTION: CANCELLED */}
        <div className="border border-red-200 rounded-lg overflow-hidden shadow-sm">
          <button 
            onClick={() => toggleSection('cancelled')}
            className="w-full flex items-center justify-between p-4 bg-red-50/50 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-center gap-3 text-red-700">
              <XCircle className="h-5 w-5" />
              <span className="font-bold">Provas Canceladas ({cancelled.length})</span>
            </div>
            {expandedSections.cancelled ? <ChevronUp className="h-5 w-5 text-red-400" /> : <ChevronDown className="h-5 w-5 text-red-400" />}
          </button>
          {expandedSections.cancelled && (
            <div className="p-4 bg-white">
               {cancelled.length > 0 ? (
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-xs">
                     <thead>
                       <tr className="border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                         <th className="px-4 py-3">Autoescola</th>
                         <th className="px-4 py-3">Data</th>
                         <th className="px-4 py-3">Examinador</th>
                         <th className="px-4 py-3">Categoria</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                       {cancelled.map(req => (
                         <tr key={req.id} className="hover:bg-slate-50/30 transition-colors">
                           <td className="px-4 py-3 font-black text-slate-800 uppercase">{getSchoolName(req.schoolId)}</td>
                           <td className="px-4 py-3 text-slate-600">{formatDate(req.scheduledDate)}</td>
                           <td className="px-4 py-3 text-slate-600 uppercase">{getExaminerName(req.examinerId)}</td>
                           <td className="px-4 py-3 text-slate-600 uppercase">{req.intendedCategory}</td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               ) : (
                 <p className="text-center py-4 text-slate-400 text-sm italic">Nenhuma prova cancelada encontrada.</p>
               )}
            </div>
          )}
        </div>

      </div>

      {/* MODAL: NOVO AGENDAMENTO */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Novo Agendamento</h2>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center">
                <p className="text-red-600 font-bold text-sm">Atenção: O número máximo será de 10 vagas por Categoria!</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Autoescola <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newRequest.schoolId}
                    onChange={e => setNewRequest({...newRequest, schoolId: e.target.value})}
                    disabled={user.role === UserRole.SCHOOL}
                  >
                    <option value="">Selecione a autoescola</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria <span className="text-red-500">*</span></label>
                  <div className="flex items-center gap-4 pt-2">
                    {['A', 'B', 'PCD'].map(cat => (
                      <label key={cat} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                          checked={newRequest.categories.includes(cat)}
                          onChange={e => {
                            if (e.target.checked) {
                              setNewRequest({...newRequest, categories: [...newRequest.categories, cat]});
                            } else {
                              setNewRequest({...newRequest, categories: newRequest.categories.filter(c => c !== cat)});
                            }
                          }}
                        />
                        <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Exame <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value="1º Habilitação"
                    readOnly
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-100 text-slate-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Examinador <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newRequest.examinerId}
                    onChange={e => setNewRequest({...newRequest, examinerId: e.target.value})}
                  >
                    <option value="">Selecione o examinador</option>
                    {examiners.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data <span className="text-red-500">*</span></label>
                  <input 
                    type="date" 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newRequest.date}
                    onChange={e => setNewRequest({...newRequest, date: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horário <span className="text-red-500">*</span></label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={newRequest.time}
                    onChange={e => setNewRequest({...newRequest, time: e.target.value})}
                  >
                    <option value="">Selecione o horário</option>
                    {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observações</label>
                <textarea 
                  rows={3}
                  placeholder="Observações adicionais..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  value={newRequest.observation}
                  onChange={e => setNewRequest({...newRequest, observation: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsNewModalOpen(false)}
                className="px-6 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-white transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSubmitNew}
                className="px-8 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-200 transition-all flex items-center gap-2"
              >
                <Save className="h-4 w-4" /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR AGENDAMENTO */}
      {isEditModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Editar Agendamento</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Autoescola</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={selectedRequest.schoolId}
                    onChange={e => setSelectedRequest({...selectedRequest, schoolId: e.target.value})}
                    disabled={user.role === UserRole.SCHOOL}
                  >
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</label>
                  <input 
                    type="text" 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={selectedRequest.intendedCategory}
                    onChange={e => setSelectedRequest({...selectedRequest, intendedCategory: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Examinador</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={selectedRequest.examinerId || ''}
                    onChange={e => setSelectedRequest({...selectedRequest, examinerId: e.target.value})}
                  >
                    <option value="">Selecione o examinador</option>
                    {examiners.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Data</label>
                  <input 
                    type="date" 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={selectedRequest.scheduledDate || ''}
                    onChange={e => setSelectedRequest({...selectedRequest, scheduledDate: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horário</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={selectedRequest.scheduledTime || ''}
                    onChange={e => setSelectedRequest({...selectedRequest, scheduledTime: e.target.value})}
                  >
                    <option value="">Selecione o horário</option>
                    {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={selectedRequest.status}
                    onChange={e => setSelectedRequest({...selectedRequest, status: e.target.value as ExamStatus})}
                  >
                    {Object.values(ExamStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observações</label>
                <textarea 
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  value={selectedRequest.observation || ''}
                  onChange={e => setSelectedRequest({...selectedRequest, observation: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <button 
                onClick={() => handleDeleteAction(selectedRequest)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleUpdateEdit}
                  className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                >
                  <Save className="h-4 w-4" /> Atualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {isConfirmModalOpen && confirmConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center space-y-4">
              <div className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
                confirmConfig.type === 'blue' ? 'bg-blue-50 text-blue-600' : 
                confirmConfig.type === 'red' ? 'bg-red-50 text-red-600' : 
                'bg-green-50 text-green-600'
              }`}>
                {confirmConfig.type === 'blue' ? <CheckCircle2 className="h-10 w-10" /> : 
                 confirmConfig.type === 'red' ? <XCircle className="h-10 w-10" /> : 
                 <CheckCircle className="h-10 w-10" />}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">{confirmConfig.title}</h3>
                <p className="text-slate-500 text-sm">{confirmConfig.message}</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center gap-3">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-6 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold text-sm hover:bg-white transition-all flex items-center gap-2"
              >
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button 
                onClick={confirmConfig.onConfirm}
                className={`px-8 py-2 rounded-lg text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 ${
                  confirmConfig.type === 'blue' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 
                  confirmConfig.type === 'red' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 
                  'bg-green-600 hover:bg-green-700 shadow-green-200'
                }`}
              >
                <CheckCircle className="h-4 w-4" /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CFCSchedulingCenter;
