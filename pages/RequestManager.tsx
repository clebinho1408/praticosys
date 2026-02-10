import React, { useState, useEffect } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, User, UserRole, ExamType, ExamStatus, RequestSource } from '../types';
import { Search, Plus, Edit2, Trash2, X, Save, User as UserIcon, FileText, Calendar, Filter, AlertTriangle } from 'lucide-react';
import { ConfirmModal } from '../components/CustomModals';

interface RequestManagerProps {
  user: User;
  typeFilter?: ExamType;
}

const RequestManager: React.FC<RequestManagerProps> = ({ user, typeFilter }) => {
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'PERSONAL' | 'PROCESS'>('PERSONAL');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const initialFormState = {
    studentName: '',
    socialName: '',
    cpf: '',
    phone: '',
    email: '',
    address: '',
    examType: typeFilter || ExamType.COMMON,
    intendedCategory: 'B',
    cnhRestriction: '',
    instructor: '',
    vehiclePlate: '',
    observation: '',
    paidFee: false,
    completedPracticalCourse: false,
    practicalHours: 0,
    hasVehicle: false,
    status: ExamStatus.WAITING_SCHEDULING
  };
  
  const [newRequestData, setNewRequestData] = useState(initialFormState);

  // Confirm Modal
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  useEffect(() => {
    fetchRequests();
  }, [user, typeFilter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let data = await api.getRequests();
      
      // Filter by Role
      if (user.role === UserRole.SCHOOL) {
        data = data.filter(r => r.schoolId === user.schoolId);
      }
      
      // Filter by Type Prop
      if (typeFilter) {
        data = data.filter(r => r.examType === typeFilter);
      }
      
      setRequests(data);
    } catch (error) {
      console.error("Failed to fetch requests", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (req?: ExamRequest) => {
    if (req) {
      setEditingId(req.id);
      setNewRequestData({
        studentName: req.studentName,
        socialName: req.socialName || '',
        cpf: req.cpf,
        phone: req.phone,
        email: req.email,
        address: req.address || '',
        examType: req.examType,
        intendedCategory: req.intendedCategory || 'B',
        cnhRestriction: req.cnhRestriction || '',
        instructor: req.instructor || '',
        vehiclePlate: req.vehiclePlate || '',
        observation: req.observation || '',
        paidFee: req.paidFee || false,
        completedPracticalCourse: req.completedPracticalCourse || false,
        practicalHours: req.practicalHours || 0,
        hasVehicle: req.hasVehicle || false,
        status: req.status
      });
    } else {
      setEditingId(null);
      setNewRequestData(initialFormState);
    }
    setModalTab('PERSONAL');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newRequestData,
        source: user.role === UserRole.SCHOOL ? RequestSource.SCHOOL : RequestSource.STUDENT_DIRECT,
        schoolId: user.role === UserRole.SCHOOL ? user.schoolId : undefined
      };

      if (editingId) {
        await api.updateRequest(editingId, payload);
      } else {
        await api.createRequest(payload);
      }
      setIsModalOpen(false);
      fetchRequests();
    } catch (error) {
      alert('Erro ao salvar.');
    }
  };

  const handleDeleteClick = (id: string) => {
    setConfirmState({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (confirmState.id) {
       await api.updateRequest(confirmState.id, { status: ExamStatus.CANCELLED });
       fetchRequests();
    }
    setConfirmState({ isOpen: false, id: null });
  };

  // Specific Handlers
  const handleRestrictionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewRequestData({ ...newRequestData, cnhRestriction: e.target.value.toUpperCase() });
  };

  const handleInstructorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z\s]/g, '');
    setNewRequestData({ ...newRequestData, instructor: val });
  };

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setNewRequestData({ ...newRequestData, vehiclePlate: val });
  };

  // Filtering
  const filteredRequests = requests.filter(r => 
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.cpf.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={confirmState.isOpen}
        title="Cancelar Solicitação"
        message="Deseja realmente cancelar esta solicitação? O status será alterado para CANCELADO."
        isDestructive={true}
        onConfirm={confirmDelete}
        onClose={() => setConfirmState({ isOpen: false, id: null })}
      />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-gray-800">Gerenciamento de Candidatos</h2>
           {typeFilter && <p className="text-sm text-gray-500">{typeFilter === ExamType.COMMON ? '1ª Habilitação' : 'PCD'}</p>}
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 shadow-sm">
          <Plus className="h-4 w-4" /> Novo Candidato
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
         <Search className="h-5 w-5 text-gray-400" />
         <input 
           type="text" 
           placeholder="Buscar por nome ou CPF..." 
           className="flex-1 outline-none text-sm text-gray-700"
           value={searchTerm}
           onChange={e => setSearchTerm(e.target.value)}
         />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
           <thead className="bg-gray-50 text-gray-600">
             <tr>
               <th className="px-6 py-3">Candidato</th>
               <th className="px-6 py-3">CPF</th>
               <th className="px-6 py-3">Processo</th>
               <th className="px-6 py-3">Instrutor/Placa</th>
               <th className="px-6 py-3">Status</th>
               <th className="px-6 py-3 text-right">Ações</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-100">
             {filteredRequests.map(req => (
               <tr key={req.id} className="hover:bg-gray-50">
                 <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{req.studentName}</div>
                    {req.socialName && <div className="text-xs text-gray-500">({req.socialName})</div>}
                 </td>
                 <td className="px-6 py-4 text-gray-500">{req.cpf}</td>
                 <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${req.examType === ExamType.COMMON ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {req.examType === ExamType.COMMON ? '1ª Hab' : 'PCD'}
                    </span>
                    <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">Cat: {req.intendedCategory}</span>
                 </td>
                 <td className="px-6 py-4 text-xs text-gray-500">
                    <div>{req.instructor || '-'}</div>
                    <div>{req.vehiclePlate || '-'}</div>
                 </td>
                 <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold 
                      ${req.status === 'WAITING_SCHEDULING' ? 'bg-yellow-100 text-yellow-700' : 
                        req.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                        req.status === 'DONE' ? 'bg-green-100 text-green-700' : 
                        req.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                       {req.status === 'WAITING_SCHEDULING' ? 'Aguardando' : 
                        req.status === 'SCHEDULED' ? 'Agendado' : req.status}
                    </span>
                 </td>
                 <td className="px-6 py-4 text-right flex justify-end gap-2">
                    <button onClick={() => handleOpenModal(req)} className="text-blue-600 hover:text-blue-800 p-1"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => handleDeleteClick(req.id)} className="text-red-600 hover:text-red-800 p-1"><Trash2 className="h-4 w-4" /></button>
                 </td>
               </tr>
             ))}
             {filteredRequests.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nenhum candidato encontrado.</td></tr>
             )}
           </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
              <div className="p-4 border-b flex justify-between items-center">
                 <h3 className="font-bold text-lg">{editingId ? 'Editar Candidato' : 'Novo Candidato'}</h3>
                 <button onClick={() => setIsModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
              </div>
              
              <div className="flex border-b bg-gray-50">
                 <button 
                   className={`px-6 py-3 text-sm font-medium ${modalTab === 'PERSONAL' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                   onClick={() => setModalTab('PERSONAL')}
                 >
                    Dados Pessoais
                 </button>
                 <button 
                   className={`px-6 py-3 text-sm font-medium ${modalTab === 'PROCESS' ? 'bg-white border-t-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                   onClick={() => setModalTab('PROCESS')}
                 >
                    Dados Complementares
                 </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
                 {modalTab === 'PERSONAL' && (
                    <div className="space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                             <label className="block text-xs font-medium text-gray-600">Nome Completo <span className="text-red-500">*</span></label>
                             <input required className="w-full border rounded p-2 mt-1" value={newRequestData.studentName} onChange={e => setNewRequestData({...newRequestData, studentName: e.target.value})} />
                          </div>
                          <div className="col-span-2">
                             <label className="block text-xs font-medium text-gray-600">Nome Social (Opcional)</label>
                             <input className="w-full border rounded p-2 mt-1" value={newRequestData.socialName} onChange={e => setNewRequestData({...newRequestData, socialName: e.target.value})} />
                          </div>
                          <div>
                             <label className="block text-xs font-medium text-gray-600">CPF <span className="text-red-500">*</span></label>
                             <input required className="w-full border rounded p-2 mt-1" value={newRequestData.cpf} onChange={e => setNewRequestData({...newRequestData, cpf: e.target.value})} placeholder="000.000.000-00" />
                          </div>
                          <div>
                             <label className="block text-xs font-medium text-gray-600">Telefone <span className="text-red-500">*</span></label>
                             <input required className="w-full border rounded p-2 mt-1" value={newRequestData.phone} onChange={e => setNewRequestData({...newRequestData, phone: e.target.value})} />
                          </div>
                          <div className="col-span-2">
                             <label className="block text-xs font-medium text-gray-600">Email</label>
                             <input type="email" required className="w-full border rounded p-2 mt-1" value={newRequestData.email} onChange={e => setNewRequestData({...newRequestData, email: e.target.value})} />
                          </div>
                          <div className="col-span-2">
                             <label className="block text-xs font-medium text-gray-600">Endereço</label>
                             <input className="w-full border rounded p-2 mt-1" value={newRequestData.address} onChange={e => setNewRequestData({...newRequestData, address: e.target.value})} />
                          </div>
                       </div>
                    </div>
                 )}

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
                                    <label className="block text-xs font-medium text-gray-600">Categoria Pretendida</label>
                                    <select className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" value={newRequestData.intendedCategory} onChange={e => setNewRequestData({...newRequestData, intendedCategory: e.target.value})}>
                                        <option value="A">A (Moto)</option>
                                        <option value="B">B (Carro)</option>
                                        <option value="AB">AB (Carro e Moto)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600">Restrição CNH</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: A G" 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.cnhRestriction} 
                                        onChange={handleRestrictionChange} 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Letras maiúsculas, espaço auto.</p>
                                </div>
                                
                                {/* New Fields */}
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-600">Instrutor <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="NOME DO INSTRUTOR" 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.instructor} 
                                        onChange={handleInstructorChange} 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Apenas letras, sem acentos.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600">Placa do Veículo <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="ABC1D23" 
                                        className="mt-1 w-full border rounded-md p-2 bg-white text-gray-900" 
                                        value={newRequestData.vehiclePlate} 
                                        onChange={handlePlateChange} 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Letras e números.</p>
                                </div>
                                
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
                                   <textarea rows={3} className="w-full border rounded p-2 mt-1" value={newRequestData.observation} onChange={e => setNewRequestData({...newRequestData, observation: e.target.value})}></textarea>
                                </div>
                            </div>
                        </div>
                 )}
                 
                 <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"><Save className="h-4 w-4" /> Salvar</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default RequestManager;
