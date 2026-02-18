
import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { User, UserRole, DrivingSchool, Examiner, Instructor, Vehicle } from '../types';
import { Plus, Edit2, Trash2, Search, Building2, Users, GraduationCap, X, Save, Lock, RotateCcw, Car, User as UserIcon, Bike, CheckCircle2, XCircle } from 'lucide-react';
import { ConfirmModal } from '../components/CustomModals';

type Tab = 'USERS' | 'SCHOOLS' | 'EXAMINERS' | 'INSTRUCTORS';

const RegistryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('USERS');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Cadastros do Sistema</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs Header */}
        <div className="flex border-b border-gray-100 flex-wrap">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'USERS' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="h-4 w-4" /> Usuários
          </button>
          <button
            onClick={() => setActiveTab('SCHOOLS')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'SCHOOLS' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Building2 className="h-4 w-4" /> Autoescolas
          </button>
          <button
            onClick={() => setActiveTab('EXAMINERS')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'EXAMINERS' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Examinadores
          </button>
          <button
            onClick={() => setActiveTab('INSTRUCTORS')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'INSTRUCTORS' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Car className="h-4 w-4" /> Instrutores
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'USERS' && <UsersManager />}
          {activeTab === 'SCHOOLS' && <SchoolsManager />}
          {activeTab === 'EXAMINERS' && <ExaminersManager />}
          {activeTab === 'INSTRUCTORS' && <InstructorsManager />}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Components for each Manager ---

const UsersManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<DrivingSchool[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({ name: '', login: '', role: UserRole.OPERATOR, schoolId: '' });

  // Confirmation Modal State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      isDestructive: boolean;
      onConfirm: () => void;
  }>({
      isOpen: false,
      title: '',
      message: '',
      isDestructive: false,
      onConfirm: () => {}
  });

  const fetchData = async () => {
    const [u, s] = await Promise.all([api.getUsers(), api.getSchoolsAsync()]);
    setUsers(u);
    setSchools(s);
    
    // Simula pegar o usuário atual da sessão
    const stored = localStorage.getItem('praticosys_user');
    if (stored) setCurrentUser(JSON.parse(stored));
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, login: user.login, role: user.role, schoolId: user.schoolId || '' });
    } else {
      setEditingUser(null);
      setFormData({ name: '', login: '', role: UserRole.OPERATOR, schoolId: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, formData);
      } else {
        if (users.some(u => u.login === formData.login)) {
            alert("Este login já está em uso.");
            return;
        }
        await api.createUser(formData as any);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || "Verifique os dados"));
    }
  };

  const handleDelete = (id: string) => {
      setConfirmState({
          isOpen: true,
          title: 'Excluir Usuário',
          message: 'Tem certeza que deseja remover este usuário permanentemente?',
          isDestructive: true,
          onConfirm: async () => {
              await api.deleteUser(id);
              fetchData();
          }
      });
  };

  const handleResetPassword = (id: string) => {
      setConfirmState({
          isOpen: true,
          title: 'Resetar Senha',
          message: 'A senha deste usuário será redefinida para "123456". Deseja continuar?',
          isDestructive: false,
          onConfirm: async () => {
              await api.updateUser(id, { password: '123456' } as any);
          }
      });
  }

  const getRoleName = (role: string) => {
      switch(role) {
          case UserRole.ADMIN: return 'Admin';
          case UserRole.OPERATOR: return 'Operador';
          case UserRole.SUPERVISOR: return 'Supervisor';
          case UserRole.SCHOOL: return 'Autoescola';
          default: return role;
      }
  }

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
      setFormData({...formData, login: val});
  }

  // Filter Logic
  const filteredUsers = users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.login.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <ConfirmModal 
         isOpen={confirmState.isOpen}
         title={confirmState.title}
         message={confirmState.message}
         isDestructive={confirmState.isDestructive}
         onConfirm={confirmState.onConfirm}
         onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
      />
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="Buscar usuário por nome ou login..." 
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full md:w-auto justify-center">
          <Plus className="h-4 w-4" /> Novo Usuário
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Login</th>
              <th className="px-4 py-3">Função</th>
              <th className="px-4 py-3">Vínculo</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.login}</td>
                <td className="px-4 py-3">
                  <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-bold">{getRoleName(u.role)}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {u.role === UserRole.SCHOOL && schools.find(s => s.id === u.schoolId)?.name}
                  {u.role !== UserRole.SCHOOL && '-'}
                </td>
                <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                  {currentUser?.role === UserRole.ADMIN && (
                      <button onClick={() => handleResetPassword(u.id)} className="text-yellow-600 hover:text-yellow-800" title="Resetar Senha para 123456">
                          <Lock className="h-4 w-4" />
                      </button>
                  )}
                  <button onClick={() => openModal(u)} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(u.id)} className="text-red-600 hover:text-red-800" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Nome Completo</label>
                <input required type="text" className="w-full border rounded p-2 bg-white text-gray-900" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium">Login (Usuário)</label>
                <input 
                    required 
                    type="text" 
                    className="w-full border rounded p-2 bg-white text-gray-900" 
                    value={formData.login} 
                    onChange={handleLoginChange}
                    placeholder="apenas letras minúsculas"
                    readOnly={!!editingUser}
                    title={editingUser ? "Não é possível alterar o login" : "Apenas letras minúsculas, sem espaço"}
                />
                <p className="text-xs text-gray-500 mt-1">Apenas letras minúsculas, sem espaço, sem acento.</p>
              </div>
              {!editingUser && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      Senha padrão será definida como: <strong>123456</strong>
                  </div>
              )}
              <div>
                <label className="block text-sm font-medium">Função</label>
                <select className="w-full border rounded p-2 bg-white text-gray-900" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                  <option value={UserRole.ADMIN}>Admin</option>
                  <option value={UserRole.SUPERVISOR}>Supervisor</option>
                  <option value={UserRole.OPERATOR}>Operador</option>
                  <option value={UserRole.SCHOOL}>Autoescola</option>
                </select>
              </div>
              {formData.role === UserRole.SCHOOL && (
                <div>
                  <label className="block text-sm font-medium">Autoescola Vinculada</label>
                  <select required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.schoolId} onChange={e => setFormData({...formData, schoolId: e.target.value})}>
                    <option value="">Selecione...</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"><Save className="h-4 w-4" /> Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SchoolsManager: React.FC = () => {
  const [schools, setSchools] = useState<DrivingSchool[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DrivingSchool | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', address: '' });
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Confirm Modal State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      isDestructive: boolean;
      onConfirm: () => void;
  }>({
      isOpen: false,
      title: '',
      message: '',
      isDestructive: false,
      onConfirm: () => {}
  });

  const fetch = async () => setSchools(await api.getSchoolsAsync());
  useEffect(() => { fetch(); }, []);

  const openModal = (school?: DrivingSchool) => {
    setEditing(school || null);
    setFormData(school ? { name: school.name, phone: school.phone, address: school.address } : { name: '', phone: '', address: '' });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await api.updateSchool(editing.id, formData);
    else await api.createSchool(formData);
    setIsModalOpen(false);
    fetch();
  };

  const handleDelete = (id: string) => {
      setConfirmState({
          isOpen: true,
          title: 'Remover Autoescola',
          message: 'Tem certeza que deseja remover esta autoescola?',
          isDestructive: true,
          onConfirm: async () => {
              await api.deleteSchool(id);
              fetch();
          }
      });
  };
  
  // Filter Logic
  const filteredSchools = schools.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <ConfirmModal 
         isOpen={confirmState.isOpen}
         title={confirmState.title}
         message={confirmState.message}
         isDestructive={confirmState.isDestructive}
         onConfirm={confirmState.onConfirm}
         onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
      />

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="Buscar autoescola..." 
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full md:w-auto justify-center">
          <Plus className="h-4 w-4" /> Nova Autoescola
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Endereço</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSchools.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-500">{s.phone}</td>
                <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{s.address}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openModal(s)} className="text-blue-600 hover:text-blue-800"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
             {filteredSchools.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">Nenhuma autoescola encontrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Editar Autoescola' : 'Nova Autoescola'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div><label className="block text-sm font-medium">Nome</label><input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
              <div><label className="block text-sm font-medium">Telefone</label><input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
              <div><label className="block text-sm font-medium">Endereço</label><input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const ExaminersManager: React.FC = () => {
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Examiner | null>(null);
  const [formData, setFormData] = useState({ name: '', registrationNumber: '', canExamCommon: true, canExamPCD: false });

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Confirm Modal State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      isDestructive: boolean;
      onConfirm: () => void;
  }>({
      isOpen: false,
      title: '',
      message: '',
      isDestructive: false,
      onConfirm: () => {}
  });

  const fetch = async () => setExaminers(await api.getExaminersAsync());
  useEffect(() => { fetch(); }, []);

  const openModal = (ex?: Examiner) => {
    setEditing(ex || null);
    setFormData(ex ? { name: ex.name, registrationNumber: ex.registrationNumber, canExamCommon: ex.canExamCommon, canExamPCD: ex.canExamPCD } : { name: '', registrationNumber: '', canExamCommon: true, canExamPCD: false });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await api.updateExaminer(editing.id, formData);
    else await api.createExaminer(formData);
    setIsModalOpen(false);
    fetch();
  };

  const handleDelete = (id: string) => {
      setConfirmState({
          isOpen: true,
          title: 'Remover Examinador',
          message: 'Tem certeza que deseja remover este examinador?',
          isDestructive: true,
          onConfirm: async () => {
              await api.deleteExaminer(id);
              fetch();
          }
      });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z\s]/g, "");
      setFormData({...formData, name: val});
  }
  
  // Filter Logic
  const filteredExaminers = examiners.filter(e => 
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <ConfirmModal 
         isOpen={confirmState.isOpen}
         title={confirmState.title}
         message={confirmState.message}
         isDestructive={confirmState.isDestructive}
         onConfirm={confirmState.onConfirm}
         onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
      />

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="Buscar examinador..." 
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full md:w-auto justify-center">
          <Plus className="h-4 w-4" /> Novo Examinador
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Matrícula</th>
              <th className="px-4 py-3">Permissões</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredExaminers.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-gray-500">{e.registrationNumber}</td>
                <td className="px-4 py-3 space-x-1">
                  {e.canExamCommon && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">1ª Hab</span>}
                  {e.canExamPCD && <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">PCD</span>}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openModal(e)} className="text-blue-600 hover:text-blue-800"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filteredExaminers.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-gray-500">Nenhum examinador encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Editar Examinador' : 'Novo Examinador'}</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium">Nome <span className="text-red-500">*</span></label>
                  <input 
                    required 
                    className="w-full border rounded p-2 bg-white text-gray-900" 
                    value={formData.name} 
                    onChange={handleNameChange}
                    placeholder="APENAS LETRAS MAIÚSCULAS"
                  />
                  <p className="text-xs text-gray-500">Apenas letras, sem acentos, maiúsculo.</p>
              </div>
              <div><label className="block text-sm font-medium">Matrícula</label><input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.registrationNumber} onChange={e => setFormData({...formData, registrationNumber: e.target.value})} /></div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Permissões</label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.canExamCommon} onChange={e => setFormData({...formData, canExamCommon: e.target.checked})} />
                  <span className="text-sm">Prova Comum (1ª Hab)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.canExamPCD} onChange={e => setFormData({...formData, canExamPCD: e.target.checked})} />
                  <span className="text-sm">Prova Especial (PCD)</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const InstructorsManager: React.FC = () => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  
  // State for Form Tabs
  const [modalTab, setModalTab] = useState<'DATA' | 'CARS' | 'MOTOS'>('DATA');

  // Form Data including Vehicles
  const [formData, setFormData] = useState<{
      name: string;
      cpf: string;
      phone: string;
      plate: string;
      category: string;
      vehicles: Vehicle[];
  }>({ 
      name: '', 
      cpf: '', 
      phone: '', 
      plate: '', 
      category: 'AB',
      vehicles: []
  });

  // State for adding new Vehicle inside Modal
  const [newVehicle, setNewVehicle] = useState({ brand: '', model: '', plate: '', active: true });
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Confirm Modal State
  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      isDestructive: boolean;
      onConfirm: () => void;
  }>({
      isOpen: false,
      title: '',
      message: '',
      isDestructive: false,
      onConfirm: () => {}
  });

  const fetch = async () => setInstructors(await api.getInstructorsAsync());
  useEffect(() => { fetch(); }, []);

  const openModal = (inst?: Instructor) => {
    setEditing(inst || null);
    if (inst) {
        setFormData({
            name: inst.name,
            cpf: inst.cpf,
            phone: inst.phone,
            plate: inst.plate, // Legacy Plate
            category: inst.category || 'AB',
            vehicles: inst.vehicles || []
        });
    } else {
        setFormData({
            name: '',
            cpf: '',
            phone: '',
            plate: '',
            category: 'AB',
            vehicles: []
        });
    }
    setModalTab('DATA');
    setNewVehicle({ brand: '', model: '', plate: '', active: true });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await api.updateInstructor(editing.id, formData);
    else await api.createInstructor(formData);
    setIsModalOpen(false);
    fetch();
  };

  const handleDelete = (id: string) => {
      setConfirmState({
          isOpen: true,
          title: 'Remover Instrutor',
          message: 'Tem certeza que deseja remover este instrutor? Todos os veículos vinculados também serão removidos.',
          isDestructive: true,
          onConfirm: async () => {
              await api.deleteInstructor(id);
              fetch();
          }
      });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z\s]/g, "");
      setFormData({...formData, name: val});
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '');
      setFormData({...formData, cpf: val});
  };

  const handleLegacyPlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      setFormData({...formData, plate: val});
  };

  // --- Vehicle Management Logic ---
  const handleAddVehicle = (type: 'CAR' | 'MOTO') => {
      if (!newVehicle.brand || !newVehicle.model || !newVehicle.plate) {
          alert('Preencha marca, modelo e placa.');
          return;
      }

      const vehicle: Vehicle = {
          id: `temp_${Date.now()}`, // ID temporário
          instructorId: editing?.id || '',
          type: type,
          brand: newVehicle.brand.toUpperCase(),
          model: newVehicle.model.toUpperCase(),
          plate: newVehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
          active: newVehicle.active
      };

      setFormData(prev => ({
          ...prev,
          vehicles: [...prev.vehicles, vehicle]
      }));

      setNewVehicle({ brand: '', model: '', plate: '', active: true });
  };

  const handleRemoveVehicle = (id: string) => {
      setFormData(prev => ({
          ...prev,
          vehicles: prev.vehicles.filter(v => v.id !== id)
      }));
  };

  const toggleVehicleStatus = (id: string) => {
      setFormData(prev => ({
          ...prev,
          vehicles: prev.vehicles.map(v => v.id === id ? { ...v, active: !v.active } : v)
      }));
  };
  
  // Filter Logic
  const filteredInstructors = instructors.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.cpf.includes(searchTerm)
  );

  return (
    <div>
      <ConfirmModal 
         isOpen={confirmState.isOpen}
         title={confirmState.title}
         message={confirmState.message}
         isDestructive={confirmState.isDestructive}
         onConfirm={confirmState.onConfirm}
         onClose={() => setConfirmState(prev => ({...prev, isOpen: false}))}
      />

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="Buscar instrutor..." 
                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full md:w-auto justify-center">
          <Plus className="h-4 w-4" /> Novo Instrutor
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">CPF</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Veículos</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredInstructors.map(inst => (
              <tr key={inst.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium uppercase">{inst.name}</td>
                <td className="px-4 py-3 text-gray-500">{inst.cpf}</td>
                <td className="px-4 py-3 text-gray-500">{inst.phone}</td>
                <td className="px-4 py-3 text-gray-500">
                   <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-bold text-blue-800">{inst.category || 'AB'}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                   {inst.vehicles && inst.vehicles.length > 0 ? (
                       <div className="flex flex-col gap-1">
                           {inst.vehicles.filter(v => v.active).slice(0, 2).map(v => (
                               <span key={v.id} className="inline-flex items-center gap-1">
                                   {v.type === 'CAR' ? <Car className="h-3 w-3 text-gray-400" /> : <Bike className="h-3 w-3 text-gray-400" />}
                                   <span className="font-mono">{v.plate}</span>
                               </span>
                           ))}
                           {inst.vehicles.filter(v => v.active).length > 2 && <span className="text-gray-400 italic">+{inst.vehicles.filter(v => v.active).length - 2} mais...</span>}
                       </div>
                   ) : (
                       <span className="text-gray-400">-</span>
                   )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openModal(inst)} className="text-blue-600 hover:text-blue-800"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(inst.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
             {filteredInstructors.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Nenhum instrutor encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
            <div className="p-6 border-b">
                <h3 className="text-lg font-bold">{editing ? 'Editar Instrutor' : 'Novo Instrutor'}</h3>
            </div>
            
            {/* Modal Tabs */}
            <div className="flex bg-gray-50 border-b px-6">
                <button 
                    type="button"
                    onClick={() => setModalTab('DATA')} 
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'DATA' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                   <UserIcon className="h-4 w-4" /> Dados Gerais
                </button>
                
                {(formData.category === 'B' || formData.category === 'AB') && (
                    <button 
                        type="button"
                        onClick={() => setModalTab('CARS')} 
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'CARS' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                       <Car className="h-4 w-4" /> Carros
                    </button>
                )}

                {(formData.category === 'A' || formData.category === 'AB') && (
                    <button 
                        type="button"
                        onClick={() => setModalTab('MOTOS')} 
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'MOTOS' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                       <Bike className="h-4 w-4" /> Motos
                    </button>
                )}
            </div>

            <div className="p-6 overflow-y-auto flex-1">
                <form id="instructorForm" onSubmit={handleSave} className="space-y-4">
                    
                    {/* TAB: DATA */}
                    {modalTab === 'DATA' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium">Nome Completo <span className="text-red-500">*</span></label>
                            <input required className="w-full border rounded p-2 bg-white text-gray-900 uppercase" value={formData.name} onChange={handleNameChange} placeholder="NOME DO INSTRUTOR" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">CPF <span className="text-red-500">*</span></label>
                            <input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.cpf} onChange={handleCpfChange} placeholder="Apenas números" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Telefone</label>
                            <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 00000-0000" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Categoria de Instrução</label>
                            <select className="w-full border rounded p-2 bg-white text-gray-900" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                <option value="AB">AB (Carro e Moto)</option>
                                <option value="A">A (Apenas Moto)</option>
                                <option value="B">B (Apenas Carro)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Placa Principal (Opcional/Legacy)</label>
                            <input className="w-full border rounded p-2 bg-white text-gray-900 font-mono" value={formData.plate} onChange={handleLegacyPlateChange} placeholder="ABC1D23" />
                            <p className="text-xs text-gray-500 mt-1">Para adicionar múltiplos veículos, use as abas acima.</p>
                          </div>
                        </>
                    )}

                    {/* TAB: CARS OR MOTOS */}
                    {(modalTab === 'CARS' || modalTab === 'MOTOS') && (
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase flex items-center gap-2">
                                    <Plus className="h-4 w-4" /> Adicionar {modalTab === 'CARS' ? 'Carro' : 'Moto'}
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <input 
                                        placeholder="Marca" 
                                        className="border rounded p-2 text-sm bg-white" 
                                        value={newVehicle.brand}
                                        onChange={e => setNewVehicle({...newVehicle, brand: e.target.value})}
                                    />
                                    <input 
                                        placeholder="Modelo" 
                                        className="border rounded p-2 text-sm bg-white" 
                                        value={newVehicle.model}
                                        onChange={e => setNewVehicle({...newVehicle, model: e.target.value})}
                                    />
                                    <input 
                                        placeholder="Placa" 
                                        className="border rounded p-2 text-sm bg-white font-mono uppercase" 
                                        value={newVehicle.plate}
                                        onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})}
                                    />
                                </div>
                                <div className="flex justify-between items-center mt-3">
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={newVehicle.active} onChange={e => setNewVehicle({...newVehicle, active: e.target.checked})} />
                                        Ativo
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={() => handleAddVehicle(modalTab === 'CARS' ? 'CAR' : 'MOTO')}
                                        className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-gray-500 uppercase">Veículos Cadastrados ({modalTab === 'CARS' ? 'Carros' : 'Motos'})</h4>
                                {formData.vehicles.filter(v => v.type === (modalTab === 'CARS' ? 'CAR' : 'MOTO')).length === 0 && (
                                    <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed rounded-lg">
                                        Nenhum veículo cadastrado.
                                    </div>
                                )}
                                {formData.vehicles.filter(v => v.type === (modalTab === 'CARS' ? 'CAR' : 'MOTO')).map((vehicle) => (
                                    <div key={vehicle.id} className={`flex items-center justify-between p-3 rounded-lg border ${vehicle.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                        <div>
                                            <div className="font-bold text-sm text-gray-800">{vehicle.brand} {vehicle.model}</div>
                                            <div className="text-xs font-mono text-gray-500">{vehicle.plate}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                type="button" 
                                                onClick={() => toggleVehicleStatus(vehicle.id)}
                                                className={`p-1.5 rounded ${vehicle.active ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}
                                                title={vehicle.active ? 'Desativar' : 'Ativar'}
                                            >
                                                {vehicle.active ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => handleRemoveVehicle(vehicle.id)}
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </form>
            </div>
            
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" form="instructorForm" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default RegistryManagement;
