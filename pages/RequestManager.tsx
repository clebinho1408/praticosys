
import React, { useState, useEffect } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, User, UserRole, ExamType, RequestSource, ExamStatus, ExamResult } from '../types';
import { Plus, Search, Edit, Trash2, X, CheckSquare, Gavel, ChevronDown, ChevronUp, Clock, Calendar, CheckCircle, AlertOctagon, Filter } from 'lucide-react';

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

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getRequests();
      let filtered = data;
      
      // Role Filtering
      if (user.role === UserRole.SCHOOL) {
        filtered = filtered.filter(r => r.schoolId === user.schoolId);
      }
      
      // Prop Type Filtering
      if (typeFilter) {
        filtered = filtered.filter(r => r.examType === typeFilter);
      }
      
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
        await api.createRequest({
          ...formData,
          schoolId: user.schoolId,
          source: user.role === UserRole.SCHOOL ? RequestSource.SCHOOL : RequestSource.STUDENT_DIRECT,
          status: ExamStatus.WAITING_SCHEDULING
        });
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
    
    await api.updateRequest(editingRequest.id, {
      status: ExamStatus.DONE,
      result: resultData.result,
      observation: resultData.observation
    });
    
    setIsResultModalOpen(false);
    fetchRequests();
  };

  const openCreateModal = (req?: ExamRequest) => {
    setEditingRequest(req || null);
    if (req) {
      setFormData(req);
    } else {
      setFormData({
        studentName: '',
        cpf: '',
        phone: '',
        examType: typeFilter || ExamType.COMMON,
        intendedCategory: 'B',
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
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || r.cpf.includes(searchTerm)
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
               const items = groupedRequests[status as ExamStatus];
               const config = groupConfig[status as ExamStatus];
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
                                           <th className="px-6 py-3 font-bold text-xs uppercase">Tipo</th>
                                           <th className="px-6 py-3 font-bold text-xs uppercase">Histórico</th>
                                           <th className="px-6 py-3 font-bold text-xs uppercase text-right">Ações</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-gray-50">
                                       {items.map(req => (
                                           <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                               <td className="px-6 py-4 align-middle text-xs text-gray-500">
                                                   {new Date(req.createdAt).toLocaleString()}
                                                   {req.result && req.status === ExamStatus.DONE && (
                                                       <div className="mt-1"><ResultBadge result={req.result as any} status={req.status} /></div>
                                                   )}
                                               </td>
                                               <td className="px-6 py-4 align-middle">
                                                   <div className="flex flex-col">
                                                       <span className="font-bold text-gray-800 uppercase">{req.studentName}</span>
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
                                               <td className="px-6 py-4 align-middle">
                                                   <span className="font-bold bg-gray-100 px-2 py-1 rounded text-gray-600 text-xs">
                                                       {req.examType === ExamType.COMMON ? '1ª Hab.' : 'PCD'}
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
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-bold mb-4">{editingRequest ? 'Editar Candidato' : 'Novo Candidato'}</h3>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Nome Completo</label>
                            <input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.studentName || ''} onChange={e => setFormData({...formData, studentName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Nome Social</label>
                            <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.socialName || ''} onChange={e => setFormData({...formData, socialName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">CPF</label>
                            <input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.cpf || ''} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Telefone</label>
                            <input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Categoria Pretendida</label>
                            <select className="w-full border rounded p-2 bg-white text-gray-900" value={formData.intendedCategory || 'B'} onChange={e => setFormData({...formData, intendedCategory: e.target.value})}>
                                <option value="A">A (Moto)</option>
                                <option value="B">B (Carro)</option>
                                <option value="AB">AB (Carro e Moto)</option>
                            </select>
                        </div>
                        {!typeFilter && (
                           <div>
                                <label className="block text-sm font-medium">Tipo de Exame</label>
                                <select className="w-full border rounded p-2 bg-white text-gray-900" value={formData.examType || ExamType.COMMON} onChange={e => setFormData({...formData, examType: e.target.value as ExamType})}>
                                    <option value={ExamType.COMMON}>1ª Habilitação</option>
                                    <option value={ExamType.PCD}>PCD</option>
                                </select>
                           </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium">Restrição CNH</label>
                            <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.cnhRestriction || ''} onChange={e => setFormData({...formData, cnhRestriction: e.target.value})} placeholder="Ex: A, G..." />
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="font-bold text-sm mb-3">Dados para Prova Prática</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium">Instrutor</label>
                                <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.instructor || ''} onChange={e => setFormData({...formData, instructor: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Placa do Veículo</label>
                                <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.vehiclePlate || ''} onChange={e => setFormData({...formData, vehiclePlate: e.target.value})} />
                            </div>
                        </div>
                    </div>
                    
                    {formData.examType === ExamType.PCD && (
                         <div className="border-t pt-4">
                            <h4 className="font-bold text-sm mb-3">Dados PCD</h4>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium">Tipo de Deficiência</label>
                                    <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.disabilityType || ''} onChange={e => setFormData({...formData, disabilityType: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Necessidades Especiais</label>
                                    <textarea className="w-full border rounded p-2 bg-white text-gray-900" value={formData.specialNeeds || ''} onChange={e => setFormData({...formData, specialNeeds: e.target.value})} />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar</button>
                    </div>
                </form>
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
