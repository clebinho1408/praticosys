import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { User, UserRole, DrivingSchool, Examiner } from '../types';
import { Plus, Edit2, Trash2, Search, Building2, Users, GraduationCap, X, Save, Lock, RotateCcw } from 'lucide-react';

type Tab = 'USERS' | 'SCHOOLS' | 'EXAMINERS';

const RegistryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('USERS');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Cadastros do Sistema</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs Header */}
        <div className="flex border-b border-gray-100">
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
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'USERS' && <UsersManager />}
          {activeTab === 'SCHOOLS' && <SchoolsManager />}
          {activeTab === 'EXAMINERS' && <ExaminersManager />}
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
  
  // Form State
  const [formData, setFormData] = useState({ name: '', login: '', role: UserRole.OPERATOR, schoolId: '' });

  const fetchData = async () => {
    const [u, s] = await Promise.all([api.getUsers(), api.getSchoolsAsync()]);
    setUsers(u);
    setSchools(s);
    
    // Simula pegar o usuário atual da sessão (na prática viria do Contexto ou LocalStorage)
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
        // Validação duplicidade visual (backend tem constraint unique, mas aqui previne chamada)
        if (users.some(u => u.login === formData.login)) {
            alert("Este login já está em uso.");
            return;
        }
        // Senha padrão é setada no backend api/users.ts como '123456'
        await api.createUser(formData as any);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || "Verifique os dados"));
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este usuário?')) {
      await api.deleteUser(id);
      fetchData();
    }
  };

  const handleResetPassword = async (id: string) => {
      if (confirm('Tem certeza que deseja resetar a senha deste usuário para "123456"?')) {
          await api.updateUser(id, { password: '123456' } as any);
          alert('Senha resetada com sucesso!');
      }
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
      // Permite apenas letras minúsculas (a-z), remove espaços, acentos e outros caracteres
      const val = e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
      setFormData({...formData, login: val});
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nova Usuário
        </button>
      </div>

      <div className="overflow-x-auto">
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
            {users.map(u => (
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
                  {/* Botão Resetar Senha (Apenas Admin) */}
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
                    readOnly={!!editingUser} // Não permitir mudar login na edição
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

  const handleDelete = async (id: string) => {
    if (confirm('Remover Autoescola?')) { await api.deleteSchool(id); fetch(); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nova Autoescola
        </button>
      </div>
      <div className="overflow-x-auto">
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
            {schools.map(s => (
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

  const handleDelete = async (id: string) => {
    if (confirm('Remover Examinador?')) { await api.deleteExaminer(id); fetch(); }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Uppercase, sem acentos, apenas letras e espaços
      const val = e.target.value.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z\s]/g, "");
      setFormData({...formData, name: val});
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nova Examinador
        </button>
      </div>
      <div className="overflow-x-auto">
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
            {examiners.map(e => (
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

export default RegistryManagement;