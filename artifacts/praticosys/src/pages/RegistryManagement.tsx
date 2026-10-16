
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { User, UserRole, OperatorModule, DrivingSchool, Examiner, ExaminerBlockedPeriod, ExaminerRotationAvailability, Instructor, Vehicle, SchoolSchedule, ScheduleSpecificDate, City, ExamLocation, BlockedDate, SystemSettings } from '../types';
import { isDateBlocked } from '../lib/dateBlocking';
import { Plus, Edit2, Trash2, Search, Building2, Users, GraduationCap, Save, Lock, Car, User as UserIcon, Bike, CheckCircle2, XCircle, MapPin, X, Pencil, Copy, Check } from 'lucide-react';
import { ConfirmModal } from '../components/CustomModals';

type Tab = 'USERS' | 'SCHOOLS' | 'EXAMINERS' | 'INSTRUCTORS';

import { FIPE_CAR_BRANDS, FIPE_MOTO_BRANDS, FIPE_CAR_MODELS, FIPE_MOTO_MODELS } from '../data/fipeData';

const RegistryManagement: React.FC<{ user: User }> = ({ user }) => {
  const isSupervisor = user.role === UserRole.SUPERVISOR;
  const [activeTab, setActiveTab] = useState<Tab>(() => isSupervisor ? 'INSTRUCTORS' : 'USERS');
  const visibleTab: Tab = isSupervisor ? 'INSTRUCTORS' : activeTab;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Cadastros do Sistema</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs Header */}
        <div className="flex border-b border-gray-100 flex-wrap">
          {!isSupervisor && <button
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              visibleTab === 'USERS' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="h-4 w-4" /> Usuários
          </button>}
          {!isSupervisor && <button
            onClick={() => setActiveTab('SCHOOLS')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              visibleTab === 'SCHOOLS' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Building2 className="h-4 w-4" /> Autoescolas
          </button>}
          {!isSupervisor && <button
            onClick={() => setActiveTab('EXAMINERS')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              visibleTab === 'EXAMINERS' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Examinadores
          </button>}
          <button
            onClick={() => setActiveTab('INSTRUCTORS')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
              visibleTab === 'INSTRUCTORS' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Car className="h-4 w-4" /> Instrutores
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {visibleTab === 'USERS' && <UsersManager user={user} />}
          {visibleTab === 'SCHOOLS' && <SchoolsManager user={user} />}
          {visibleTab === 'EXAMINERS' && <ExaminersManager user={user} />}
          {visibleTab === 'INSTRUCTORS' && <InstructorsManager user={user} />}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Components for each Manager ---

const UsersManager: React.FC<{ user: User }> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<DrivingSchool[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  
  // Form State
  const [examLocations, setExamLocations] = useState<ExamLocation[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [formData, setFormData] = useState<{ name: string; login: string; role: UserRole; schoolId: string; allowedModules: OperatorModule[]; allowedLocationIds: string[]; allowedCadastroTabs: string[]; email: string; phone: string; twoFactorEnabled: boolean }>({ name: '', login: '', role: UserRole.OPERATOR, schoolId: '', allowedModules: ['cnh', 'cfc', 'pcd'], allowedLocationIds: [], allowedCadastroTabs: ['autoescolas', 'examinadores', 'instrutores'], email: '', phone: '', twoFactorEnabled: false });

  // User modal tab state
  const [userModalTab, setUserModalTab] = useState<'dados' | 'permissoes' | 'contato'>('dados');

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
    const [u, s, locs, cityList] = await Promise.all([
      api.getUsers(),
      api.getSchoolsAsync(),
      api.getExamLocations().catch(() => [] as ExamLocation[]),
      api.getCities().catch(() => [] as City[]),
    ]);
    setUsers(u);
    setSchools(s);
    setExamLocations(locs);
    setCities(cityList);
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, login: user.login, role: user.role, schoolId: user.schoolId || '', allowedModules: (user.allowedModules && user.allowedModules.length > 0) ? user.allowedModules : ['cnh', 'cfc', 'pcd'], allowedLocationIds: user.allowedLocationIds || [], allowedCadastroTabs: user.allowedCadastroTabs ?? ['autoescolas', 'examinadores', 'instrutores'], email: (user as any).email || '', phone: (user as any).phone || '', twoFactorEnabled: (user as any).twoFactorEnabled || false });
    } else {
      setEditingUser(null);
      setFormData({ name: '', login: '', role: UserRole.OPERATOR, schoolId: '', allowedModules: ['cnh', 'cfc', 'pcd'], allowedLocationIds: [], allowedCadastroTabs: ['autoescolas', 'examinadores', 'instrutores'], email: '', phone: '', twoFactorEnabled: false });
    }
    setUserModalTab('dados');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((formData.role === UserRole.OPERATOR || formData.role === UserRole.SUPERVISOR) && formData.allowedModules.length === 0) {
      alert('Selecione ao menos um módulo para o Operador/Supervisor.');
      return;
    }
    try {
      const payload: any = { ...formData };
      // Only persist allowedModules/allowedLocationIds/allowedCadastroTabs for OPERATOR and SUPERVISOR roles
      if (formData.role !== UserRole.OPERATOR && formData.role !== UserRole.SUPERVISOR) {
        delete payload.allowedModules;
        delete payload.allowedLocationIds;
        delete payload.allowedCadastroTabs;
      }
      // If CNH module is not selected, clear location restrictions
      if (!payload.allowedModules?.includes('cnh')) {
        payload.allowedLocationIds = [];
      }
      // If cadastro module is not selected, clear cadastro tabs
      if (!payload.allowedModules?.includes('cadastro')) {
        payload.allowedCadastroTabs = [];
      }
      if (editingUser) {
        await api.updateUser(editingUser.id, payload);
      } else {
        if (users.some(u => u.login === formData.login)) {
            alert("Este login já está em uso.");
            return;
        }
        await api.createUser(payload);
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
              await api.updateUser(id, { password: '123456', forcePasswordChange: true } as any);
          }
      });
  }

  const getRoleName = (role: string) => {
      switch(role) {
          case UserRole.ADMIN: return 'Administrador';
          case UserRole.OPERATOR: return 'Operador';
          case UserRole.CONSULTANT: return 'Consultor';
          case UserRole.SUPERVISOR: return 'Supervisor';
          case UserRole.SCHOOL: return 'Autoescola';
          case UserRole.EXAMINER: return 'Examinador';
          case UserRole.INSTRUCTOR: return 'Instrutor';
          default: return role;
      }
  }

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
      setFormData({...formData, login: val});
  }

  // Role order for grouping
  const roleOrder: UserRole[] = [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.OPERATOR, UserRole.CONSULTANT, UserRole.EXAMINER, UserRole.SCHOOL];

  // Filter Logic
  const filteredUsers = users.filter(u =>
      u.login !== 'admin' &&
      (u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
       u.login.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (roleFilter === '' || u.role === roleFilter)
  );

  // Grouped users by role
  const groupedUsers = roleOrder
    .map(role => ({ role, users: filteredUsers.filter(u => u.role === role) }))
    .filter(g => g.users.length > 0);

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
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                  type="text" 
                  placeholder="Buscar por nome ou login..." 
                  className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          <select
            className="border rounded-md text-sm py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-700"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as UserRole | '')}
          >
            <option value="">Todas as Funções</option>
            <option value={UserRole.ADMIN}>Admin</option>
            <option value={UserRole.SUPERVISOR}>Supervisor</option>
            <option value={UserRole.OPERATOR}>Operador</option>
            <option value={UserRole.CONSULTANT}>Consultor</option>
            <option value={UserRole.EXAMINER}>Examinador</option>
            <option value={UserRole.SCHOOL}>Autoescola</option>
          </select>
        </div>
        {user?.role !== UserRole.CONSULTANT && (
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full md:w-auto justify-center">
            <Plus className="h-4 w-4" /> Novo Usuário
          </button>
        )}
      </div>

      <div className="space-y-4">
        {groupedUsers.length === 0 && (
          <div className="border rounded-lg p-6 text-center text-gray-500 text-sm">Nenhum usuário encontrado.</div>
        )}
        {groupedUsers.map(group => (
          <div key={group.role} className="border rounded-lg overflow-hidden">
            {/* Group Header */}
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{getRoleName(group.role)}</span>
              <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5 font-medium">{group.users.length}</span>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 font-medium text-xs">Nome</th>
                  <th className="px-4 py-2.5 font-medium text-xs">Login</th>
                  <th className="px-4 py-2.5 font-medium text-xs">Vínculo</th>
                  <th className="px-4 py-2.5 font-medium text-xs text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {group.users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.login}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.role === UserRole.SCHOOL && (schools.find(s => s.id === u.schoolId)?.name || '-')}
                      {u.role !== UserRole.SCHOOL && '-'}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 flex justify-end">
                      {user?.role === UserRole.ADMIN && (
                          <button onClick={() => handleResetPassword(u.id)} className="text-yellow-600 hover:text-yellow-800" title="Resetar Senha para 123456">
                              <Lock className="h-4 w-4" />
                          </button>
                      )}
                      {user?.role !== UserRole.CONSULTANT && (
                        <>
                          <button onClick={() => openModal(u)} className="text-blue-600 hover:text-blue-800" title="Editar"><Edit2 className="h-4 w-4" /></button>
                          <button 
                            onClick={() => handleDelete(u.id)} 
                            className={`${u.role === UserRole.SCHOOL ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}`} 
                            title={u.role === UserRole.SCHOOL ? "Exclua a autoescola para remover este usuário" : "Excluir"}
                            disabled={u.role === UserRole.SCHOOL}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 bg-gray-50/60 px-6">
              {([
                { key: 'dados', label: 'Dados' },
                { key: 'permissoes', label: 'Permissões' },
                { key: 'contato', label: 'Contato & Segurança' },
              ] as { key: 'dados' | 'permissoes' | 'contato'; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setUserModalTab(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    userModalTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                {/* TAB: DADOS */}
                {userModalTab === 'dados' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                      <input
                        required
                        type="text"
                        className="w-full border border-gray-200 rounded-lg p-2.5 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Nome completo do usuário"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Login (Usuário)</label>
                      <input
                        required
                        type="text"
                        className={`w-full border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${editingUser ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'}`}
                        value={formData.login}
                        onChange={handleLoginChange}
                        placeholder="apenas letras minúsculas"
                        readOnly={!!editingUser}
                        title={editingUser ? "Não é possível alterar o login" : "Apenas letras minúsculas, sem espaço"}
                      />
                      <p className="text-xs text-gray-400 mt-1">Apenas letras minúsculas, sem espaço, sem acento.</p>
                    </div>
                    {!editingUser && (
                      <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 p-3 rounded-lg">
                        <span>🔑</span>
                        <span>Senha padrão será definida como: <strong>123456</strong></span>
                      </div>
                    )}
                  </>
                )}

                {/* TAB: PERMISSÕES */}
                {userModalTab === 'permissoes' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
                      <select
                        className="w-full border border-gray-200 rounded-lg p-2.5 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.role}
                        onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                      >
                        <option value={UserRole.ADMIN}>Admin</option>
                        <option value={UserRole.SUPERVISOR}>Supervisor</option>
                        <option value={UserRole.OPERATOR}>Operador</option>
                        <option value={UserRole.CONSULTANT}>Consultor</option>
                        <option value={UserRole.EXAMINER}>Examinador</option>
                        <option value={UserRole.SCHOOL}>Autoescola</option>
                      </select>
                    </div>

                    {formData.role === UserRole.SCHOOL && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Autoescola Vinculada</label>
                        <select
                          required
                          className="w-full border border-gray-200 rounded-lg p-2.5 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={formData.schoolId}
                          onChange={e => setFormData({...formData, schoolId: e.target.value})}
                        >
                          <option value="">Selecione...</option>
                          {schools.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(formData.role === UserRole.OPERATOR || formData.role === UserRole.SUPERVISOR) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Módulos Permitidos</label>
                        <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50">
                          {(['cnh', 'cfc', 'pcd'] as OperatorModule[]).map(mod => {
                            const labels: Record<string, string> = { cnh: 'CNH do Brasil', cfc: 'Exame Prático CFC', pcd: 'Exame Prático PCD' };
                            const isChecked = formData.allowedModules.includes(mod);
                            return (
                              <label key={mod} className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...formData.allowedModules, mod]
                                      : formData.allowedModules.filter(m => m !== mod);
                                    setFormData({ ...formData, allowedModules: next });
                                  }}
                                  className="h-4 w-4 accent-blue-600"
                                />
                                <span className="text-sm text-gray-700">{labels[mod]}</span>
                              </label>
                            );
                          })}
                          {/* Cadastros module */}
                          <div>
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={formData.allowedModules.includes('cadastro')}
                                onChange={e => {
                                  const next = e.target.checked
                                    ? [...formData.allowedModules, 'cadastro' as OperatorModule]
                                    : formData.allowedModules.filter(m => m !== 'cadastro');
                                  setFormData({ ...formData, allowedModules: next });
                                }}
                                className="h-4 w-4 accent-blue-600"
                              />
                              <span className="text-sm text-gray-700">Cadastros</span>
                            </label>
                            {formData.allowedModules.includes('cadastro') && (
                              <div className="ml-6 mt-2 space-y-1.5 border-l-2 border-blue-100 pl-3">
                                {(['autoescolas', 'examinadores', 'instrutores'] as const).map(tab => {
                                  const tabLabels: Record<string, string> = { autoescolas: 'Autoescolas', examinadores: 'Examinadores', instrutores: 'Instrutores' };
                                  const isTabChecked = formData.allowedCadastroTabs.includes(tab);
                                  return (
                                    <label key={tab} className="flex items-center gap-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={isTabChecked}
                                        onChange={e => {
                                          const next = e.target.checked
                                            ? [...formData.allowedCadastroTabs, tab]
                                            : formData.allowedCadastroTabs.filter(t => t !== tab);
                                          setFormData({ ...formData, allowedCadastroTabs: next });
                                        }}
                                        className="h-3.5 w-3.5 accent-blue-500"
                                      />
                                      <span className="text-xs text-gray-600">{tabLabels[tab]}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        {formData.allowedModules.length === 0 && (
                          <p className="text-xs text-red-500 mt-1">Selecione ao menos um módulo.</p>
                        )}
                      </div>
                    )}

                    {(formData.role === UserRole.OPERATOR || formData.role === UserRole.SUPERVISOR) && formData.allowedModules.includes('cnh') && examLocations.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Locais de Acesso — CNH do Brasil</label>
                        <p className="text-xs text-gray-400 mb-2">Deixe em branco para liberar todos os locais.</p>
                        <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-36 overflow-y-auto">
                          {examLocations.map(loc => {
                            const locCity = cities.find(c => c.id === loc.cityId);
                            const label = locCity?.name || loc.cityId;
                            const isChecked = formData.allowedLocationIds.includes(loc.id);
                            return (
                              <label key={loc.id} className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...formData.allowedLocationIds, loc.id]
                                      : formData.allowedLocationIds.filter(id => id !== loc.id);
                                    setFormData({ ...formData, allowedLocationIds: next });
                                  }}
                                  className="h-4 w-4 accent-blue-600"
                                />
                                <span className="text-sm text-gray-700">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {formData.role === UserRole.ADMIN && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-lg">
                        Administradores têm acesso completo a todos os módulos e recursos do sistema.
                      </div>
                    )}
                    {formData.role === UserRole.CONSULTANT && (
                      <div className="text-xs text-sky-700 bg-sky-50 border border-sky-100 p-3 rounded-lg">
                        Consultores têm acesso somente de leitura aos dados do sistema.
                      </div>
                    )}
                  </>
                )}

                {/* TAB: CONTATO & SEGURANÇA */}
                {userModalTab === 'contato' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                      <input
                        type="email"
                        className="w-full border border-gray-200 rounded-lg p-2.5 bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="exemplo@email.com"
                      />
                      <p className="text-xs text-gray-400 mt-1">Necessário para recuperação de senha e verificação em 2 etapas.</p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer select-none p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600 mt-0.5 flex-shrink-0"
                        checked={formData.twoFactorEnabled}
                        onChange={e => setFormData({...formData, twoFactorEnabled: e.target.checked})}
                      />
                      <div>
                        <span className="text-sm font-semibold text-gray-800">Verificação em 2 etapas</span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Ao fazer login, um código será enviado para o e-mail cadastrado acima.
                        </p>
                        {!formData.email && formData.twoFactorEnabled && (
                          <span className="text-xs text-red-600 block mt-1 font-medium">⚠️ Cadastre um e-mail para ativar este recurso.</span>
                        )}
                      </div>
                    </label>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-xl">
                <div className="flex gap-1">
                  {(['dados', 'permissoes', 'contato'] as const).map((t, i) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setUserModalTab(t)}
                      className={`w-2 h-2 rounded-full transition-colors ${userModalTab === t ? 'bg-blue-600' : 'bg-gray-300'}`}
                      aria-label={`Ir para aba ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors font-medium"
                  >
                    <Save className="h-4 w-4" /> Salvar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SchoolsManager: React.FC<{ user: User }> = ({ user }) => {
  const [schools, setSchools] = useState<DrivingSchool[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DrivingSchool | null>(null);
  const [modalTab, setModalTab] = useState<'MAIN' | 'SERVICES' | 'YARDS' | 'RODIZIOS' | 'SCHEDULE_MAIN' | 'SCHEDULE_PROV'>('MAIN');
  const [copiedMain, setCopiedMain] = useState(false);
  const [copiedProv, setCopiedProv] = useState(false);
  const [provMotivoModalOpen, setProvMotivoModalOpen] = useState(false);
  const [provMotivo, setProvMotivo] = useState('');
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [examinerFilter, setExaminerFilter] = useState('');
  
  const initialFormData: Partial<DrivingSchool> = {
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    services: [],
    motoYardAddress: '',
    carYardAddress: '',
    categoryChangeYardAddress: '',
    examRotation: false,
    cnhBrasilProfile: false,
    mainSchedule: { frequency: '1_WEEK', days: [], slots: [], active: false },
    provisionalSchedule: { frequency: '1_WEEK', days: [], slots: [], active: false, specificDates: [] }
  };

  const [formData, setFormData] = useState<Partial<DrivingSchool>>(initialFormData);
  
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

  const fetch = async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    let schools = await api.getSchoolsAsync();

    // ── Auto-ativar provisória quando activateFrom <= hoje ──
    const schoolsToActivateProv = schools.filter(s => {
      const prov = s.provisionalSchedule;
      if (!prov || prov.active) return false;           // já ativa ou sem escala provisória
      if (!prov.activateFrom) return false;              // sem data automática
      return prov.activateFrom <= todayStr;              // data chegou
    });
    if (schoolsToActivateProv.length > 0) {
      await Promise.all(schoolsToActivateProv.map(s => {
        const updatedProv = { ...s.provisionalSchedule!, active: true };
        const updatedMain = s.mainSchedule ? { ...s.mainSchedule, active: false } : s.mainSchedule;
        return api.updateSchool(s.id, { provisionalSchedule: updatedProv, mainSchedule: updatedMain });
      }));
      schools = await api.getSchoolsAsync();
    }

    // ── Auto-switch provisional → main when all specificDates have passed ──
    const schoolsNeedingSwitch = schools.filter(s => {
      const prov = s.provisionalSchedule;
      if (!prov?.active) return false;
      const dates: ScheduleSpecificDate[] = Array.isArray(prov.specificDates) ? prov.specificDates : [];
      if (dates.length === 0) return false;
      return dates.every(d => d.date < todayStr);
    });
    if (schoolsNeedingSwitch.length > 0) {
      await Promise.all(schoolsNeedingSwitch.map(s => {
        const updatedProv = { ...s.provisionalSchedule!, active: false };
        const updatedMain = s.mainSchedule ? { ...s.mainSchedule, active: true } : s.mainSchedule;
        return api.updateSchool(s.id, { provisionalSchedule: updatedProv, mainSchedule: updatedMain });
      }));
      // Re-fetch updated list
      schools = await api.getSchoolsAsync();
    }
    setSchools(schools);

    setExaminers(await api.getExaminersAsync());
    try {
      const citiesData = await api.getCities();
      setCities(citiesData);
    } catch (err) {
      console.error("Erro ao carregar cidades:", err);
    }
    try {
      const [bd, settings] = await Promise.all([
        api.getBlockedDates(),
        api.getSettings(),
      ]);
      setBlockedDates(bd);
      setSystemSettings(settings);
    } catch (err) {
      console.error("Erro ao carregar datas bloqueadas:", err);
    }
  };
  useEffect(() => { fetch(); }, []);

  const openModal = async (school?: DrivingSchool) => {
    setEditing(school || null);
    if (school) {
      const loaded = { ...initialFormData, ...school };
      // Normalize provisionalSchedule.specificDates — may be null in older records
      if (loaded.provisionalSchedule) {
        loaded.provisionalSchedule = {
          ...loaded.provisionalSchedule,
          specificDates: Array.isArray(loaded.provisionalSchedule.specificDates)
            ? loaded.provisionalSchedule.specificDates.map(d => ({
                ...d,
                id: d.id || crypto.randomUUID(),
              }))
            : [],
        };
      }
      setFormData(loaded);
    } else {
      setFormData(initialFormData);
    }
    setModalTab('MAIN');
    setIsModalOpen(true);
    // Re-fetch examiners to ensure we have the latest list
    try {
      const exData = await api.getExaminersAsync();
      setExaminers(exData);
    } catch (err) {
      console.error("Erro ao carregar examinadores:", err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateSchool(editing.id, formData);
      } else {
        const createdSchool = await api.createSchool(formData);
        
        // Automatically create a user for this school
        // Sanitize name for login: lowercase, no spaces, no accents
        const login = formData.name!
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "");

        await api.createUser({
          name: formData.name!,
          login: login,
          password: '123456',
          role: UserRole.SCHOOL,
          schoolId: createdSchool.id
        });
      }
      setIsModalOpen(false);
      fetch();
    } catch (err: any) {
      alert('Erro ao salvar autoescola: ' + (err.message || 'Verifique os dados'));
    }
  };

  const handleDelete = (id: string) => {
      setConfirmState({
          isOpen: true,
          title: 'Remover Autoescola',
          message: 'Tem certeza que deseja remover esta autoescola?',
          isDestructive: true,
          onConfirm: async () => {
              try {
                // Also delete associated user
                const allUsers = await api.getUsers();
                const schoolUser = allUsers.find(u => u.schoolId === id);
                if (schoolUser) {
                  await api.deleteUser(schoolUser.id);
                }
              } catch (err) {
                console.error("Erro ao excluir usuário da autoescola:", err);
              }
              await api.deleteSchool(id);
              fetch();
          }
      });
  };
  
  // Filter Logic
  const filteredSchools = schools.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCity = !cityFilter || s.city === cityFilter;
      
      // Check if any schedule (main or provisional) has the selected examiner
      const matchesExaminer = !examinerFilter || 
          (s.mainSchedule?.slots.some(slot => slot.examiner === examinerFilter)) ||
          (s.provisionalSchedule?.slots.some(slot => slot.examiner === examinerFilter));

      return matchesSearch && matchesCity && matchesExaminer;
  });

  // Group by City
  const schoolsByCity = useMemo(() => {
    const groups: Record<string, DrivingSchool[]> = {};
    filteredSchools.forEach(s => {
      const city = s.city || 'SEM CIDADE';
      if (!groups[city]) groups[city] = [];
      groups[city].push(s);
    });
    return groups;
  }, [filteredSchools]);

  const formatUpperNoAccents = (val: string) => {
    return val.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  };

  const formatEmail = (val: string) => {
    return val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "");
  };

  const toggleService = (cat: string) => {
    const current = formData.services || [];
    if (current.includes(cat)) {
      setFormData({ ...formData, services: current.filter(c => c !== cat) });
    } else {
      setFormData({ ...formData, services: [...current, cat] });
    }
  };

  const renderScheduleConfig = (type: 'main' | 'provisional') => {
    const schedule = type === 'main' ? formData.mainSchedule : formData.provisionalSchedule;
    if (!schedule) return null;

    const updateSchedule = (updates: Partial<SchoolSchedule>) => {
      if (type === 'main') {
        const newMain = { ...schedule, ...updates };
        // Exclusive activation logic
        const newProv = formData.provisionalSchedule ? { ...formData.provisionalSchedule } : undefined;
        if (updates.active === true && newProv) {
          newProv.active = false;
        }
        setFormData({ ...formData, mainSchedule: newMain, provisionalSchedule: newProv });
      } else {
        const newProv = { ...schedule, ...updates };
        // Exclusive activation logic
        const newMain = formData.mainSchedule ? { ...formData.mainSchedule } : undefined;
        if (updates.active === true && newMain) {
          newMain.active = false;
        }
        setFormData({ ...formData, provisionalSchedule: newProv, mainSchedule: newMain });
      }
    };

    const addSlot = () => {
      // Rule: "2 vezes no dia" allows only 2 slots
      if (schedule.frequency === '2_DAY' && schedule.slots.length >= 2) {
        alert('Frequência "2 vezes no dia" permite apenas 2 horários.');
        return;
      }
      // Rule: 2_WEEK allows 2 slots
      if (schedule.frequency === '2_WEEK' && schedule.slots.length >= 2) {
        alert('Frequência "2 vezes na semana" permite apenas 2 horários.');
        return;
      }
      // Rule: 3_WEEK allows 3 slots
      if (schedule.frequency === '3_WEEK' && schedule.slots.length >= 3) {
        alert('Frequência "3 vezes na semana" permite apenas 3 horários.');
        return;
      }
      // Rule: 1_WEEK, 15_DAYS allow only 1 slot
      if ((schedule.frequency === '1_WEEK' || schedule.frequency === '15_DAYS') && schedule.slots.length >= 1) {
        const labels: Record<string, string> = {
          '1_WEEK': '1 vez na semana',
          '15_DAYS': 'A cada 15 dias'
        };
        alert(`Frequência "${labels[schedule.frequency]}" permite apenas 1 horário.`);
        return;
      }
      updateSchedule({ slots: [...schedule.slots, { time: '', examiner: '', day: '' }] });
    };

    const removeSlot = (index: number) => {
      updateSchedule({ slots: schedule.slots.filter((_, i) => i !== index) });
    };

    const updateSlot = (index: number, field: 'time' | 'examiner' | 'day', value: string) => {
      const newSlots = [...schedule.slots];
      newSlots[index] = { ...newSlots[index], [field]: value };
      updateSchedule({ slots: newSlots });
    };

    const toggleDay = (day: string) => {
      const current = schedule.days || [];
      const isSelected = current.includes(day);
      
      if (isSelected) {
        updateSchedule({ days: current.filter(d => d !== day) });
      } else {
        // Frequency limits
        if ((schedule.frequency === '1_WEEK' || schedule.frequency === '2_DAY' || schedule.frequency === '15_DAYS') && current.length >= 1) {
          updateSchedule({ days: [day] }); // Replace
        } else if (schedule.frequency === '2_WEEK' && current.length >= 2) {
          updateSchedule({ days: [current[1], day] }); // Keep last one and add new
        } else if (schedule.frequency === '3_WEEK' && current.length >= 3) {
          updateSchedule({ days: [current[1], current[2], day] }); // Keep last two and add new
        } else {
          updateSchedule({ days: [...current, day] });
        }
      }
    };

    // ── Copiar Escala Principal ──────────────────────────────────────────
    const handleCopyMainSchedule = () => {
      const schoolName = (formData as any).name || '';
      const freqMap: Record<string, string> = {
        '1_WEEK': '1 vez na semana',
        '2_WEEK': '2 vezes na semana',
        '3_WEEK': '3 vezes na semana',
        '2_DAY': '2 vezes no dia',
        '15_DAYS': 'A cada 15 dias',
      };
      const dayLabelMap: Record<string, string> = {
        SEG: 'Segunda-feira', TER: 'Terça-feira', QUA: 'Quarta-feira',
        QUI: 'Quinta-feira', SEX: 'Sexta-feira',
      };
      const freqLabel = freqMap[schedule.frequency] ?? schedule.frequency;

      // Monta "Dias da Semana" — associa cada slot ao dia (para 2_WEEK/3_WEEK) ou usa days[0]
      const slotLines = schedule.slots.map(slot => {
        const ex = examiners.find(e => e.id === slot.examiner || e.name === slot.examiner);
        const exName = ex?.name ?? slot.examiner ?? '—';
        const slotsA = ex?.defaultMaxSlotsA != null ? ex.defaultMaxSlotsA : '—';
        const slotsB = ex?.defaultMaxSlotsB != null ? ex.defaultMaxSlotsB : '—';
        const dayKey = slot.day || schedule.days[0] || '';
        return { dayKey, time: slot.time || '—', exName, slotsA, slotsB };
      });

      // Linha de examinadores únicos
      const uniqueExaminers = slotLines
        .filter((v, i, arr) => arr.findIndex(x => x.exName === v.exName) === i)
        .map(s => `${s.exName} - ${s.slotsA}A${s.slotsB}B`).join(', ');

      // Dias da Semana com horário(s)
      const daysText = slotLines.map(s => {
        const dayFull = dayLabelMap[s.dayKey] ?? s.dayKey ?? '—';
        return `${dayFull} - ${s.time}`;
      }).join(', ');

      const lines = [
        '*ALTERAÇÃO DA ESCALA FIXA DA PROVA PRÁTICA*',
        '',
        `Autoescola: *${schoolName}*`,
        '',
        `Examinador: *${uniqueExaminers}*`,
        '',
        `Frequência: *${freqLabel}*`,
        '',
        `Dias da Semana: *${daysText}*`,
        '',
        'Atenciosamente: *Supervisão da CNH*',
      ];
      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        setCopiedMain(true);
        setTimeout(() => setCopiedMain(false), 2000);
      });
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
          <div>
            <h4 className="font-bold text-sm">{type === 'main' ? 'Escala Principal' : 'Escala Provisória'}</h4>
            <p className="text-xs text-gray-500">{schedule.active ? 'Esta escala está ATIVA' : 'Esta escala está DESATIVADA'}</p>
          </div>
          <div className="flex items-center gap-2">
            {type === 'main' && (
              <button
                type="button"
                onClick={handleCopyMainSchedule}
                className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold border transition-colors ${
                  copiedMain
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
                title="Copiar escala para WhatsApp"
              >
                {copiedMain ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedMain ? 'Copiado!' : 'Copiar Escala'}
              </button>
            )}
            <button
              type="button"
              onClick={() => updateSchedule({ active: !schedule.active })}
              className={`px-4 py-2 rounded text-xs font-bold transition-colors ${
                schedule.active 
                  ? 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200' 
                  : 'bg-green-100 text-green-600 border border-green-200 hover:bg-green-200'
              }`}
            >
              {schedule.active ? 'DESATIVAR ESCALA' : 'ATIVAR ESCALA'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Frequência</label>
          <select 
            className="w-full border rounded p-2 bg-white text-gray-900"
            value={schedule.frequency}
            onChange={e => {
              const freq = e.target.value as any;
              let days = [...schedule.days];
              let slots = [...schedule.slots];
              
              // Reset days if they exceed new frequency limits
              if (freq === '1_WEEK' || freq === '2_DAY' || freq === '15_DAYS') {
                if (days.length > 1) days = days.length > 0 ? [days[0]] : [];
              } else if (freq === '2_WEEK') {
                if (days.length > 2) days = days.slice(0, 2);
              } else if (freq === '3_WEEK') {
                if (days.length > 3) days = days.slice(0, 3);
              }

              // Limit slots based on frequency
              if (freq === '2_DAY' || freq === '2_WEEK') {
                if (slots.length > 2) slots = slots.slice(0, 2);
              } else if (freq === '3_WEEK') {
                if (slots.length > 3) slots = slots.slice(0, 3);
              } else if (freq === '1_WEEK' || freq === '15_DAYS') {
                if (slots.length > 1) slots = slots.slice(0, 1);
              }

              // Clear day from slots if frequency is not 2_WEEK or 3_WEEK
              if (freq !== '2_WEEK' && freq !== '3_WEEK') {
                slots = slots.map(s => ({ ...s, day: '' }));
              }

              updateSchedule({ frequency: freq, days, slots });
            }}
          >
            <option value="1_WEEK">1 vez na semana</option>
            <option value="2_WEEK">2 vezes na semana</option>
            <option value="3_WEEK">3 vezes na semana</option>
            <option value="2_DAY">2 vezes no dia</option>
            <option value="15_DAYS">A cada 15 dias</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dias da Semana</label>
          <div className="flex flex-wrap gap-2">
            {['SEG', 'TER', 'QUA', 'QUI', 'SEX'].map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-1 rounded text-xs font-bold border ${
                  schedule.days?.includes(day) 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {(schedule.frequency === '1_WEEK' || schedule.frequency === '2_DAY' || schedule.frequency === '15_DAYS') && 'Selecione apenas 1 dia.'}
            {schedule.frequency === '2_WEEK' && 'Selecione apenas 2 dias.'}
            {schedule.frequency === '3_WEEK' && 'Selecione apenas 3 dias.'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium">Horários e Examinadores</label>
            <button 
              type="button" 
              onClick={addSlot}
              className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100"
            >
              + Adicionar Horário
            </button>
          </div>
          {schedule.slots.map((slot, idx) => (
            <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-200">
              {(schedule.frequency === '2_WEEK' || schedule.frequency === '3_WEEK') && (
                <select
                  className="border rounded p-1 text-sm bg-white"
                  value={slot.day || ''}
                  onChange={e => updateSlot(idx, 'day', e.target.value)}
                >
                  <option value="">Dia</option>
                  {schedule.days.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
              <input 
                type="time" 
                className="border rounded p-1 text-sm bg-white" 
                value={slot.time}
                onChange={e => updateSlot(idx, 'time', e.target.value)}
              />
              <select
                className="flex-1 border rounded p-1 text-sm bg-white"
                value={examiners.find(e => e.id === slot.examiner || e.name === slot.examiner)?.id || ''}
                onChange={e => updateSlot(idx, 'examiner', e.target.value)}
              >
                <option value="">Selecione o Examinador</option>
                {examiners.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
              <button 
                type="button" 
                onClick={() => removeSlot(idx)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {schedule.slots.length === 0 && (
            <p className="text-xs text-gray-500 italic">Nenhum horário configurado.</p>
          )}
        </div>
      </div>
    );
  };

  // ─── Escala Provisória: datas específicas (Data + Hora + Examinador) ───────
  const renderProvisionalScheduleConfig = () => {
    const schedule = formData.provisionalSchedule;
    if (!schedule) return null;

    const today = new Date().toISOString().split('T')[0];

    const specificDates: ScheduleSpecificDate[] = Array.isArray(schedule.specificDates)
      ? schedule.specificDates
      : [];

    const updateSpecificDates = (dates: ScheduleSpecificDate[]) => {
      const newProv = { ...schedule, specificDates: dates };
      const newMain = formData.mainSchedule ? { ...formData.mainSchedule } : undefined;
      if (newProv.active && newMain) newMain.active = false;
      setFormData({ ...formData, provisionalSchedule: newProv, mainSchedule: newMain });
    };

    const addDate = () => {
      updateSpecificDates([
        ...specificDates,
        { id: crypto.randomUUID(), date: '', time: '', examiner: '' },
      ]);
    };

    const removeDate = (id: string) => {
      updateSpecificDates(specificDates.filter(d => d.id !== id));
    };

    const updateDateEntry = (id: string, field: keyof ScheduleSpecificDate, value: string) => {
      updateSpecificDates(
        specificDates.map(d => {
          if (d.id !== id) return d;
          const updated = { ...d, [field]: value };
          // Se mudou a data: limpa examinador se ficar bloqueado (por período do examinador)
          if (field === 'date') {
            const ex = examiners.find(e => e.id === d.examiner);
            const periods = Array.isArray(ex?.blockedPeriods) ? ex!.blockedPeriods : [];
            const examinerBlocked = value ? periods.some(p => {
              if (value < p.startDate || value > p.endDate) return false;
              if (!p.period || p.period === 'ALL_DAY') return true;
              const t = d.time || '';
              if (!t) return true;
              const [h, m2] = t.split(':').map(Number);
              const totalMin = h * 60 + m2;
              if (p.period === 'MORNING') return totalMin < 12 * 60;
              if (p.period === 'AFTERNOON') return totalMin >= 12 * 60;
              return true;
            }) : false;
            if (examinerBlocked) updated.examiner = '';
          }
          return updated;
        })
      );
    };

    // Helper: verifica se uma data é bloqueada pelo sistema (feriados/configurações)
    const checkSystemBlock = (dateStr: string) => isDateBlocked(dateStr, blockedDates, systemSettings);

    // Sort by date asc
    const sorted = [...specificDates].sort((a, b) => a.date.localeCompare(b.date));

    const formatDateBR = (d: string) => {
      if (!d) return '—';
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };

    // Calcula a menor data das specificDates configuradas (para sugerir activateFrom)
    const minSpecificDate = specificDates.length > 0
      ? [...specificDates].map(d => d.date).filter(Boolean).sort()[0] ?? ''
      : '';

    // Helpers para leitura fácil do estado de ativação
    const hasActivateFrom = !!schedule.activateFrom;
    const activateFromLabel = hasActivateFrom
      ? `Ativação automática em ${formatDateBR(schedule.activateFrom!)}`
      : 'Ativação manual';

    // ── Copiar Escala Provisória ─────────────────────────────────────────
    // Abre modal de motivo antes de copiar
    const handleCopyProvSchedule = () => {
      setProvMotivo('');
      setProvMotivoModalOpen(true);
    };

    // Copia de fato após confirmar o motivo
    const handleConfirmCopyProv = (motivo: string) => {
      const schoolName = (formData as any).name || '';
      const validDates = sorted.filter(d => d.date && d.time && d.examiner);
      const dateLines = validDates.map(entry => {
        const ex = examiners.find(e => e.id === entry.examiner || e.name === entry.examiner);
        const exName = ex?.name ?? entry.examiner ?? '—';
        const slotsA = ex?.defaultMaxSlotsA != null ? ex.defaultMaxSlotsA : '—';
        const slotsB = ex?.defaultMaxSlotsB != null ? ex.defaultMaxSlotsB : '—';
        const [, mm, dd] = entry.date.split('-');
        return `*${dd}/${mm} - ${entry.time} - EXAMINADOR: ${exName} - ${slotsA}A${slotsB}B*`;
      });
      const lines = [
        '*ESCALA PROVISÓRIA DA PROVA PRÁTICA*',
        '',
        `Autoescola: *${schoolName}*`,
        '',
        `Motivo: *${motivo}*`,
        '',
        ...dateLines,
        '',
        '*ATENÇÃO! A ESCALA FIXA PERMANECE NORMAL, TANTO ANTES QUANTO DEPOIS DESSAS DATAS.*',
        '',
        'Atenciosamente: *Supervisão da CNH*',
      ];
      navigator.clipboard.writeText(lines.join('\n')).then(() => {
        setProvMotivoModalOpen(false);
        setCopiedProv(true);
        setTimeout(() => setCopiedProv(false), 2000);
      });
    };

    return (
      <div className="space-y-4">
        {/* Modal: digitar motivo antes de copiar */}
        {provMotivoModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={() => setProvMotivoModalOpen(false)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-base text-gray-900">Motivo da Escala Provisória</h3>
              <p className="text-sm text-gray-500">Informe o motivo para incluir na mensagem copiada.</p>
              <textarea
                autoFocus
                rows={3}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex: Férias do examinador titular"
                value={provMotivo}
                onChange={e => setProvMotivo(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProvMotivoModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!provMotivo.trim()}
                  onClick={() => handleConfirmCopyProv(provMotivo.trim())}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Copy className="h-4 w-4" />
                  Copiar Escala
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Activate/deactivate header */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-sm">Escala Provisória</h4>
              <p className={`text-xs font-medium mt-0.5 ${schedule.active ? 'text-green-600' : 'text-gray-400'}`}>
                {schedule.active ? '● ATIVA' : '○ DESATIVADA'}
                {!schedule.active && hasActivateFrom && (
                  <span className="ml-2 text-blue-500">· {activateFromLabel}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyProvSchedule}
                className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold border transition-colors ${
                  copiedProv
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
                title="Copiar escala para WhatsApp"
              >
                {copiedProv ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedProv ? 'Copiado!' : 'Copiar Escala'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const newProv = { ...schedule, active: !schedule.active };
                  const newMain = formData.mainSchedule ? { ...formData.mainSchedule } : undefined;
                  if (newProv.active && newMain) newMain.active = false;
                  setFormData({ ...formData, provisionalSchedule: newProv, mainSchedule: newMain });
                }}
                className={`px-4 py-2 rounded text-xs font-bold transition-colors ${
                  schedule.active
                    ? 'bg-red-100 text-red-600 border border-red-200 hover:bg-red-200'
                    : 'bg-green-100 text-green-600 border border-green-200 hover:bg-green-200'
                }`}
              >
                {schedule.active ? 'DESATIVAR' : 'ATIVAR AGORA'}
              </button>
            </div>
          </div>

          {/* Auto-activation config */}
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Ativação automática</p>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="prov-activate-mode"
                  checked={!hasActivateFrom}
                  onChange={() => {
                    const newProv = { ...schedule };
                    delete newProv.activateFrom;
                    setFormData({ ...formData, provisionalSchedule: newProv });
                  }}
                  className="w-3.5 h-3.5 text-blue-600"
                />
                <span className="text-xs text-gray-700">Manual (somente pelo botão acima)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="prov-activate-mode"
                  checked={hasActivateFrom}
                  onChange={() => {
                    const newProv = { ...schedule, activateFrom: minSpecificDate || today };
                    setFormData({ ...formData, provisionalSchedule: newProv });
                  }}
                  className="w-3.5 h-3.5 text-blue-600"
                />
                <span className="text-xs text-gray-700">Automática a partir de:</span>
              </label>
              {hasActivateFrom && (
                <input
                  type="date"
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={schedule.activateFrom ?? ''}
                  onChange={e => {
                    const newProv = { ...schedule, activateFrom: e.target.value };
                    setFormData({ ...formData, provisionalSchedule: newProv });
                  }}
                />
              )}
            </div>
            {hasActivateFrom && (
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded p-2">
                ℹ️ A escala provisória será ativada automaticamente na data <strong>{formatDateBR(schedule.activateFrom!)}</strong> (e a escala principal desativada). Após a última data agendada, volta automaticamente para a escala principal.
              </p>
            )}
          </div>
        </div>

        {/* Info banner */}
        <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 p-3 rounded-lg">
          Configure datas específicas para a escala provisória. Cada entrada define uma data, horário e examinador responsável pela prova.
        </div>

        {/* Dates list */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium">Datas Agendadas</label>
            <button
              type="button"
              onClick={addDate}
              className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 font-medium"
            >
              + Adicionar Data
            </button>
          </div>

          {sorted.length === 0 && (
            <p className="text-xs text-gray-500 italic py-2">Nenhuma data configurada. Clique em "+ Adicionar Data".</p>
          )}

          {sorted.map((entry) => {
            const examDate = entry.date;
            const isDatePast = examDate ? examDate < today : false;
            const sysBlock = examDate ? checkSystemBlock(examDate) : { blocked: false };
            const isSystemBlocked = sysBlock.blocked;

            return (
              <div
                key={entry.id}
                className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                  isSystemBlocked
                    ? 'border-red-200 bg-red-50/30'
                    : isDatePast
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : 'border-slate-200 bg-white'
                }`}
              >
                {/* DATA */}
                <div className="flex-shrink-0" style={{ width: '130px' }}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Data</label>
                  <input
                    type="date"
                    className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-2 outline-none ${
                      isSystemBlocked
                        ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-400'
                        : 'border-slate-200 bg-white focus:ring-blue-500'
                    }`}
                    value={entry.date}
                    min={today}
                    onChange={e => updateDateEntry(entry.id, 'date', e.target.value)}
                  />
                  {isSystemBlocked && (
                    <p className="text-[9px] text-red-600 font-semibold mt-0.5 flex items-center gap-0.5 leading-tight">
                      <span>🚫</span>
                      <span>Bloqueada{sysBlock.reason ? `: ${sysBlock.reason}` : ''}</span>
                    </p>
                  )}
                  {!isSystemBlocked && isDatePast && (
                    <p className="text-[9px] text-amber-500 mt-0.5 leading-tight">Data passada</p>
                  )}
                </div>

                {/* HORA */}
                <div className="flex-shrink-0" style={{ width: '84px' }}>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Hora</label>
                  <input
                    type="time"
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={entry.time}
                    onChange={e => updateDateEntry(entry.id, 'time', e.target.value)}
                  />
                </div>

                {/* EXAMINADOR */}
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Examinador</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    value={entry.examiner}
                    onChange={e => updateDateEntry(entry.id, 'examiner', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {examiners.map(ex => {
                      const examTime = entry.time || undefined;
                      const isBlocked = examDate
                        ? (Array.isArray(ex.blockedPeriods) ? ex.blockedPeriods : []).some(p => {
                            if (examDate < p.startDate || examDate > p.endDate) return false;
                            if (!p.period || p.period === 'ALL_DAY') return true;
                            if (!examTime) return true;
                            const [h, m2] = examTime.split(':').map(Number);
                            const totalMin = h * 60 + m2;
                            if (p.period === 'MORNING') return totalMin < 12 * 60;
                            if (p.period === 'AFTERNOON') return totalMin >= 12 * 60;
                            return true;
                          })
                        : false;
                      const reason = isBlocked
                        ? (() => {
                            const examTime2 = entry.time || undefined;
                            const p2 = (Array.isArray(ex.blockedPeriods) ? ex.blockedPeriods : []).find(p => {
                              if (examDate! < p.startDate || examDate! > p.endDate) return false;
                              if (!p.period || p.period === 'ALL_DAY') return true;
                              if (!examTime2) return true;
                              const [h, m2] = examTime2.split(':').map(Number);
                              const totalMin = h * 60 + m2;
                              if (p.period === 'MORNING') return totalMin < 12 * 60;
                              if (p.period === 'AFTERNOON') return totalMin >= 12 * 60;
                              return true;
                            });
                            const turno = p2?.period === 'MORNING' ? ' (manhã)' : p2?.period === 'AFTERNOON' ? ' (tarde)' : '';
                            return p2?.description ? `${p2.description}${turno}` : `BLOQUEADO${turno}`;
                          })()
                        : '';
                      return (
                        <option key={ex.id} value={ex.id} disabled={isBlocked}>
                          {isBlocked ? `🔒 ${ex.name}${reason ? ` — ${reason}` : ''}` : ex.name}
                        </option>
                      );
                    })}
                  </select>
                  {entry.examiner && examDate && (() => {
                    const ex = examiners.find(e => e.id === entry.examiner);
                    const periods = Array.isArray(ex?.blockedPeriods) ? ex!.blockedPeriods : [];
                    const examTime = entry.time || undefined;
                    const isBlocked = periods.some(p => {
                      if (examDate < p.startDate || examDate > p.endDate) return false;
                      if (!p.period || p.period === 'ALL_DAY') return true;
                      if (!examTime) return true;
                      const [h, m2] = examTime.split(':').map(Number);
                      const totalMin = h * 60 + m2;
                      if (p.period === 'MORNING') return totalMin < 12 * 60;
                      if (p.period === 'AFTERNOON') return totalMin >= 12 * 60;
                      return true;
                    });
                    const p2 = isBlocked ? periods.find(p => {
                      if (examDate < p.startDate || examDate > p.endDate) return false;
                      if (!p.period || p.period === 'ALL_DAY') return true;
                      if (!examTime) return true;
                      const [h, m2] = examTime.split(':').map(Number);
                      const totalMin = h * 60 + m2;
                      if (p.period === 'MORNING') return totalMin < 12 * 60;
                      if (p.period === 'AFTERNOON') return totalMin >= 12 * 60;
                      return true;
                    }) : null;
                    const turno = p2?.period === 'MORNING' ? ' (manhã)' : p2?.period === 'AFTERNOON' ? ' (tarde)' : '';
                    return isBlocked ? (
                      <p className="text-[9px] text-red-600 font-semibold mt-0.5 flex items-center gap-0.5 leading-tight">
                        <span>⚠️</span>
                        <span>Bloqueado{p2?.description ? `: ${p2.description}${turno}` : turno ? turno : ''}.</span>
                      </p>
                    ) : null;
                  })()}
                </div>

                {/* DELETE */}
                <div className="flex-shrink-0 pt-5">
                  <button
                    type="button"
                    onClick={() => removeDate(entry.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remover data"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  // ─────────────────────────────────────────────────────────────────────────────

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
        <div className="flex flex-wrap gap-4 flex-1">
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                  type="text" 
                  placeholder="Buscar autoescola..." 
                  className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-900"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          
          <select 
            className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
          >
            <option value="">Todas as Cidades</option>
            {cities.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select 
            className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={examinerFilter}
            onChange={e => setExaminerFilter(e.target.value)}
          >
            <option value="">Todos os Examinadores</option>
            {examiners.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.name}</option>
            ))}
          </select>
        </div>
        
        {user?.role !== UserRole.CONSULTANT && (
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full md:w-auto justify-center">
            <Plus className="h-4 w-4" /> Nova Autoescola
          </button>
        )}
      </div>

      <div className="space-y-8">
        {Object.entries(schoolsByCity).sort(([a], [b]) => a.localeCompare(b)).map(([city, citySchools]) => (
          <div key={city} className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-700 border-b pb-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              {city}
              <span className="text-sm font-normal text-gray-400 ml-2">({citySchools.length} autoescolas)</span>
            </h3>
            
            <div className="overflow-x-auto border rounded-lg bg-white">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Escalas Detalhadas</th>
                    <th className="px-4 py-3">Contato</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {citySchools.map(s => {
                    const activeSchedule = s.provisionalSchedule?.active 
                      ? s.provisionalSchedule 
                      : (s.mainSchedule?.active ? s.mainSchedule : null);
                    
                    const scheduleType = s.provisionalSchedule?.active ? 'Provisória' : 'Principal';
                    const ORDER = ['A', 'B', 'C', 'D', 'E'];
                    const servicesText = s.services && s.services.length > 0
                      ? [...s.services].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join(', ')
                      : 'Nenhum';

                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            <span>Serviços: {servicesText}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {activeSchedule ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 uppercase">
                                  {scheduleType}
                                </span>
                                {scheduleType === 'Principal' && (
                                  <span className="text-xs font-medium text-gray-600">
                                    {activeSchedule.frequency === '1_WEEK' && '1x na Semana'}
                                    {activeSchedule.frequency === '2_WEEK' && '2x na Semana'}
                                    {activeSchedule.frequency === '3_WEEK' && '3x na Semana'}
                                    {activeSchedule.frequency === '2_DAY' && '2x no Dia'}
                                    {activeSchedule.frequency === '15_DAYS' && 'A cada 15 dias'}
                                  </span>
                                )}
                              </div>

                              {/* Escala Provisória: mostrar specificDates */}
                              {scheduleType === 'Provisória' ? (
                                <div className="space-y-0.5">
                                  {(activeSchedule.specificDates ?? []).length === 0 ? (
                                    <span className="text-[11px] text-gray-400 italic">Nenhuma data configurada</span>
                                  ) : (
                                    [...(activeSchedule.specificDates ?? [])]
                                      .sort((a, b) => a.date.localeCompare(b.date))
                                      .map(d => {
                                        const [y, m, day] = d.date.split('-');
                                        const examName = examiners.find(ex => ex.id === d.examiner)?.name || 'Sem examinador';
                                        return (
                                          <div key={d.id} className="text-[11px] text-gray-600">
                                            <span className="font-bold text-gray-800">{day}/{m}/{y}</span>
                                            {d.time && <span> às {d.time}</span>}
                                            <span className="text-blue-600 italic"> ({examName})</span>
                                          </div>
                                        );
                                      })
                                  )}
                                </div>
                              ) : (
                                /* Escala Principal: mostrar slots */
                                <div className="space-y-0.5">
                                  {activeSchedule.slots.map((slot, i) => {
                                    const examiner = examiners.find(ex => ex.id === slot.examiner || ex.name === slot.examiner);
                                    return (
                                      <div key={i} className="text-[11px] text-gray-500 flex flex-wrap gap-x-2">
                                        <span className="font-bold text-gray-700">{slot.day || activeSchedule.days.join(', ')}</span>
                                        <span>às {slot.time}h</span>
                                        <span className="text-blue-600 italic">({examiner?.name || 'Sem examinador'})</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-red-400 italic">Nenhuma escala ativa</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium">{s.phone}</div>
                          <div className="text-[11px] text-gray-400">{s.email || '-'}</div>
                          <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{s.address}</div>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          {user?.role !== UserRole.CONSULTANT && (
                            <>
                              <button onClick={() => openModal(s)} className="text-blue-600 hover:text-blue-800"><Edit2 className="h-4 w-4" /></button>
                              <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        
        {Object.keys(schoolsByCity).length === 0 && (
          <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
            Nenhuma autoescola encontrada com os filtros atuais.
          </div>
        )}
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh]">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">{editing ? 'Editar Autoescola' : 'Nova Autoescola'}</h3>
            </div>
            
            <div className="flex flex-wrap border-b bg-gray-50">
              {[
                { id: 'MAIN', label: 'Dados Principais' },
                { id: 'SERVICES', label: 'Serviços' },
                { id: 'YARDS', label: 'Pátios' },
                { id: 'RODIZIOS', label: 'Rodízios' },
                { id: 'SCHEDULE_MAIN', label: 'Escala Principal' },
                { id: 'SCHEDULE_PROV', label: 'Escala Provisória' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setModalTab(tab.id as any)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    modalTab === tab.id 
                      ? 'border-blue-600 text-blue-600 bg-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="school-form" onSubmit={handleSave} className="space-y-4">
                {modalTab === 'MAIN' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">Nome</label>
                        <input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.name} onChange={e => setFormData({...formData, name: formatUpperNoAccents(e.target.value)})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Telefone</label>
                        <input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium">E-mail</label>
                        <input type="email" className="w-full border rounded p-2 bg-white text-gray-900" value={formData.email} onChange={e => setFormData({...formData, email: formatEmail(e.target.value)})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Endereço</label>
                        <input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.address} onChange={e => setFormData({...formData, address: formatUpperNoAccents(e.target.value)})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Cidade</label>
                        <select 
                          className="w-full border rounded p-2 bg-white text-gray-900" 
                          value={formData.city || ''} 
                          onChange={e => setFormData({...formData, city: e.target.value})}
                        >
                          <option value="">Selecione uma cidade</option>
                          {cities.map(city => (
                            <option key={city.id} value={city.name}>{city.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'SERVICES' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Serviços (Categorias)</label>
                      <div className="flex flex-wrap gap-3">
                        {['A', 'B', 'C', 'D', 'E'].map(cat => (
                          <label key={cat} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded border hover:bg-gray-100">
                            <input 
                              type="checkbox" 
                              checked={formData.services?.includes(cat)} 
                              onChange={() => toggleService(cat)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-bold">Categoria {cat}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {modalTab === 'YARDS' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium">Endereço Pátio Moto (Cat. A)</label>
                      <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.motoYardAddress} onChange={e => setFormData({...formData, motoYardAddress: formatUpperNoAccents(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Endereço Pátio Carro (Cat. B)</label>
                      <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.carYardAddress} onChange={e => setFormData({...formData, carYardAddress: formatUpperNoAccents(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Endereço Mudança de Categoria (Cat. C, D, E)</label>
                      <input className="w-full border rounded p-2 bg-white text-gray-900" value={formData.categoryChangeYardAddress} onChange={e => setFormData({...formData, categoryChangeYardAddress: formatUpperNoAccents(e.target.value)})} />
                    </div>
                  </div>
                )}

                {modalTab === 'RODIZIOS' && (
                  <div className="space-y-4">
                    <div className="rounded border bg-gray-50 p-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.examRotation ?? false}
                          onChange={e => setFormData({ ...formData, examRotation: e.target.checked })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-medium">Rodízio de Provas</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-7">Quando ativado, esta autoescola participa do rodízio automático de examinadores.</p>
                    </div>
                    <div className="rounded border bg-gray-50 p-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.cnhBrasilProfile ?? false}
                          onChange={e => setFormData({ ...formData, cnhBrasilProfile: e.target.checked })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-medium">Perfil CNH do Brasil</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-7">Quando ativado, esta autoescola utiliza o perfil CNH do Brasil para agendamentos.</p>
                    </div>
                  </div>
                )}
                {modalTab === 'SCHEDULE_MAIN' && renderScheduleConfig('main')}
                {modalTab === 'SCHEDULE_PROV' && renderProvisionalScheduleConfig()}
              </form>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
              <button type="submit" form="school-form" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ExaminersManager: React.FC<{ user: User }> = ({ user }) => {
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesError, setCitiesError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Examiner | null>(null);
  const [modalTab, setModalTab] = useState<'DADOS' | 'RODIZIO' | 'BLOQUEIOS'>('DADOS');
  const emptyRotation: ExaminerRotationAvailability = { days: [], defaultTime: '', secondDefaultTime: '', examsPerDay: 1, cityIds: [] };
  type ExaminerForm = { name: string; registrationNumber: string; categories: string[]; defaultMaxSlotsA: string; defaultMaxSlotsB: string; defaultMaxSlotsMudanca: string; examRotation: boolean; rotationAvailability: ExaminerRotationAvailability | null };
  const [formData, setFormData] = useState<ExaminerForm>({ name: '', registrationNumber: '', categories: [], defaultMaxSlotsA: '', defaultMaxSlotsB: '', defaultMaxSlotsMudanca: '', examRotation: false, rotationAvailability: null });
  const [rotationDraft, setRotationDraft] = useState<ExaminerRotationAvailability>(emptyRotation);
  const [rotationError, setRotationError] = useState('');

  // Blocked periods state
  const [blockedPeriods, setBlockedPeriods] = useState<ExaminerBlockedPeriod[]>([]);
  const [newPeriod, setNewPeriod] = useState<{ startDate: string; endDate: string; description: string; period: 'ALL_DAY' | 'MORNING' | 'AFTERNOON' }>({ startDate: '', endDate: '', description: '', period: 'ALL_DAY' });
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editPeriodDraft, setEditPeriodDraft] = useState<{ startDate: string; endDate: string; description: string; period: 'ALL_DAY' | 'MORNING' | 'AFTERNOON' }>({ startDate: '', endDate: '', description: '', period: 'ALL_DAY' });

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

  const fetch = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const examiners = await api.getExaminersAsync();

    // ── Auto-remove expired blockedPeriods from DB ──
    const examinersWithExpired = examiners.filter(ex => {
      const periods = Array.isArray(ex.blockedPeriods) ? ex.blockedPeriods : [];
      return periods.some(p => p.endDate < todayStr);
    });
    if (examinersWithExpired.length > 0) {
      await Promise.all(examinersWithExpired.map(ex => {
        const activePeriods = (ex.blockedPeriods || []).filter(p => p.endDate >= todayStr);
        return api.updateExaminer(ex.id, { blockedPeriods: activePeriods });
      }));
      setExaminers(await api.getExaminersAsync());
    } else {
      setExaminers(examiners);
    }
  };
  useEffect(() => {
    fetch();
    api.getCities().then(setCities).catch(() => setCitiesError('Não foi possível carregar as cidades.'));
  }, []);

  const openModal = (ex?: Examiner) => {
    setEditing(ex || null);
    setModalTab('DADOS');
    setFormData(ex ? {
      name: ex.name,
      registrationNumber: ex.registrationNumber,
      categories: ex.categories || [],
      defaultMaxSlotsA: ex.defaultMaxSlotsA != null ? String(ex.defaultMaxSlotsA) : '',
      defaultMaxSlotsB: ex.defaultMaxSlotsB != null ? String(ex.defaultMaxSlotsB) : '',
      defaultMaxSlotsMudanca: ex.defaultMaxSlotsMudanca != null ? String(ex.defaultMaxSlotsMudanca) : '',
      examRotation: ex.examRotation ?? false,
      rotationAvailability: ex.rotationAvailability ?? null,
    } : { name: '', registrationNumber: '', categories: [], defaultMaxSlotsA: '', defaultMaxSlotsB: '', defaultMaxSlotsMudanca: '', examRotation: false, rotationAvailability: null });
    setRotationDraft(ex?.rotationAvailability ? { ...emptyRotation, ...ex.rotationAvailability, days: [...(ex.rotationAvailability.days ?? [])], cityIds: [...(ex.rotationAvailability.cityIds ?? [])] } : { ...emptyRotation });
    setRotationError('');
    setBlockedPeriods(ex?.blockedPeriods ? [...ex.blockedPeriods] : []);
    setNewPeriod({ startDate: '', endDate: '', description: '', period: 'ALL_DAY' });
    setEditingPeriodId(null);
    setIsModalOpen(true);
  };

  const saveRotation = () => {
    const validTime = (t: string | undefined) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t ?? '');
    if (!rotationDraft.days.length || !validTime(rotationDraft.defaultTime) || (rotationDraft.examsPerDay === 2 && !validTime(rotationDraft.secondDefaultTime)) || !rotationDraft.cityIds.length) {
      setRotationError('Selecione ao menos um dia e uma cidade e informe todos os horários padrão.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      examRotation: true,
      rotationAvailability: { ...rotationDraft, secondDefaultTime: rotationDraft.examsPerDay === 2 ? rotationDraft.secondDefaultTime : '' },
    }));
    setRotationError('');
  };

  const clearRotation = () => {
    setFormData(prev => ({ ...prev, examRotation: false, rotationAvailability: null }));
    setRotationDraft({ ...emptyRotation });
    setRotationError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasMudanca = formData.categories.some(c => ['C', 'D', 'E'].includes(c));
    const payload = {
      ...formData,
      defaultMaxSlotsA: formData.defaultMaxSlotsA !== '' ? Number(formData.defaultMaxSlotsA) : null,
      defaultMaxSlotsB: formData.defaultMaxSlotsB !== '' ? Number(formData.defaultMaxSlotsB) : null,
      defaultMaxSlotsMudanca: hasMudanca && formData.defaultMaxSlotsMudanca !== '' ? Number(formData.defaultMaxSlotsMudanca) : null,
      blockedPeriods: getCleanedPeriods(blockedPeriods),
    };
    try {
      if (editing) {
        await api.updateExaminer(editing.id, payload);
      } else {
        const newEx = await api.createExaminer(payload);
        // Create user for the new examiner
        await api.createUser({
          name: newEx.name,
          login: newEx.name.toLowerCase().replace(/\s+/g, '.'),
          password: '123456', 
          role: UserRole.EXAMINER,
          examinerId: newEx.id
        });
      }
      setIsModalOpen(false);
      fetch();
    } catch (error) {
      console.error('Error saving examiner:', error);
      alert('Erro ao salvar examinador.');
    }
  };

  const handleAddBlockedPeriod = () => {
    if (!newPeriod.startDate || !newPeriod.endDate) {
      alert('Preencha a Data Início e a Data Fim.');
      return;
    }
    if (newPeriod.endDate < newPeriod.startDate) {
      alert('A Data Fim não pode ser anterior à Data Início.');
      return;
    }
    const period: ExaminerBlockedPeriod = {
      id: crypto.randomUUID(),
      startDate: newPeriod.startDate,
      endDate: newPeriod.endDate,
      description: newPeriod.description.trim(),
      period: newPeriod.period,
    };
    setBlockedPeriods(prev => [...prev, period]);
    setNewPeriod({ startDate: '', endDate: '', description: '', period: 'ALL_DAY' });
  };

  const handleRemoveBlockedPeriod = (id: string) => {
    setBlockedPeriods(prev => prev.filter(p => p.id !== id));
  };

  const handleEditBlockedPeriod = (period: ExaminerBlockedPeriod) => {
    setEditingPeriodId(period.id);
    setEditPeriodDraft({
      startDate: period.startDate,
      endDate: period.endDate,
      description: period.description,
      period: (period.period as 'ALL_DAY' | 'MORNING' | 'AFTERNOON') ?? 'ALL_DAY',
    });
  };

  const handleSaveEditPeriod = (id: string) => {
    if (!editPeriodDraft.startDate || !editPeriodDraft.endDate) {
      alert('Preencha a Data Início e a Data Fim.');
      return;
    }
    if (editPeriodDraft.endDate < editPeriodDraft.startDate) {
      alert('A Data Fim não pode ser anterior à Data Início.');
      return;
    }
    setBlockedPeriods(prev => prev.map(p => p.id !== id ? p : {
      ...p,
      startDate: editPeriodDraft.startDate,
      endDate: editPeriodDraft.endDate,
      description: editPeriodDraft.description.trim(),
      period: editPeriodDraft.period,
    }));
    setEditingPeriodId(null);
  };

  const handleCancelEditPeriod = () => {
    setEditingPeriodId(null);
  };

  // Auto-remove last expired block when modal saves (if all periods expired)
  const getCleanedPeriods = (periods: typeof blockedPeriods) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const active = periods.filter(p => p.endDate >= todayStr);
    // If all expired, clear completely; otherwise keep only active ones
    return active;
  };

  const formatDateBR = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const handleSyncUsers = async () => {
    if (!confirm('Deseja atualizar/criar usuários para todos os examinadores? O login será o nome em minúsculo e a senha padrão será 123456.')) return;
    
    try {
      const users = await api.getUsers();
      const examinerUsers = users.filter(u => u.role === UserRole.EXAMINER);
      
      let createdCount = 0;
      let updatedCount = 0;
      
      for (const ex of examiners) {
        const login = ex.name.toLowerCase().replace(/\s+/g, '.');
        const existingUser = examinerUsers.find(u => u.examinerId === ex.id || u.login === ex.registrationNumber);
        
        if (existingUser) {
          // Update existing user
          await api.updateUser(existingUser.id, {
            login: login,
            password: '123456',
            name: ex.name
          });
          updatedCount++;
        } else {
          // Create new user
          await api.createUser({
            name: ex.name,
            login: login,
            password: '123456',
            role: UserRole.EXAMINER,
            examinerId: ex.id
          });
          createdCount++;
        }
      }
      alert(`${createdCount} usuários criados e ${updatedCount} atualizados com sucesso.`);
    } catch (error) {
      console.error('Error syncing examiner users:', error);
      alert('Erro ao sincronizar usuários.');
    }
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
  
  const toggleCategory = (cat: string) => {
    const current = formData.categories || [];
    if (current.includes(cat)) {
      setFormData({ ...formData, categories: current.filter(c => c !== cat) });
    } else {
      setFormData({ ...formData, categories: [...current, cat] });
    }
  };

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
        <div className="flex gap-2 w-full md:w-auto">
          {user?.role !== UserRole.CONSULTANT && (
            <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 justify-center">
              <Plus className="h-4 w-4" /> Novo Examinador
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Matrícula</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3 text-center">Vagas A</th>
              <th className="px-4 py-3 text-center">Vagas B</th>
              <th className="px-4 py-3 text-center">Vagas Mud.</th>
              <th className="px-4 py-3 text-center">Rodízio</th>
              <th className="px-4 py-3 text-center">Bloqueios</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredExaminers.map(e => {
              const today = new Date().toISOString().slice(0, 10);
              const activeBlocks = (e.blockedPeriods || []).filter(p => p.endDate >= today);
              const currentlyBlocked = activeBlocks.some(p => p.startDate <= today && p.endDate >= today);
              return (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <span>{e.name}</span>
                  {currentlyBlocked && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">BLOQUEADO</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{e.registrationNumber}</td>
                <td className="px-4 py-3 space-x-1">
                  {e.categories && e.categories.length > 0 ? (
                    [...e.categories].sort((a, b) => ['A','B','C','D','E'].indexOf(a) - ['A','B','C','D','E'].indexOf(b)).map(cat => (
                      <span key={cat} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block mb-1">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm">{e.defaultMaxSlotsA != null ? e.defaultMaxSlotsA : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-center text-sm">{e.defaultMaxSlotsB != null ? e.defaultMaxSlotsB : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-center text-sm">{e.categories?.some(c => ['C','D','E'].includes(c)) ? (e.defaultMaxSlotsMudanca != null ? e.defaultMaxSlotsMudanca : <span className="text-gray-400">—</span>) : <span className="text-gray-300">-</span>}</td>
                <td className="px-4 py-3 text-center text-sm">
                  {e.examRotation && e.rotationAvailability ? (
                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold" title={`Dias: ${e.rotationAvailability.days.join(', ')} | ${e.rotationAvailability.examsPerDay}x/dia`}>
                      🔄 Ativo
                    </span>
                  ) : e.examRotation ? (
                    <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-semibold">
                      ⚠️ Config.
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm">
                  {activeBlocks.length > 0 ? (
                    <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold" title={activeBlocks.map(p => `${p.startDate === p.endDate ? p.startDate : `${p.startDate} → ${p.endDate}`}${p.description ? ': ' + p.description : ''}`).join('\n')}>
                      🔒 {activeBlocks.length}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {user?.role !== UserRole.CONSULTANT && (
                    <>
                      <button onClick={() => openModal(e)} className="text-blue-600 hover:text-blue-800"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(e.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </td>
              </tr>
              );
            })}
            {filteredExaminers.length === 0 && (
                <tr><td colSpan={9} className="p-4 text-center text-gray-500">Nenhum examinador encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 pt-6 pb-0">
              <h3 className="text-lg font-bold mb-4">{editing ? 'Editar Examinador' : 'Novo Examinador'}</h3>
              {/* Tabs */}
              <div className="flex border-b mb-0">
                <button
                  type="button"
                  onClick={() => setModalTab('DADOS')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${modalTab === 'DADOS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Dados Gerais
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('RODIZIO')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${modalTab === 'RODIZIO' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Rodízio
                  {formData.examRotation && (
                    <span className="ml-1 bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('BLOQUEIOS')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${modalTab === 'BLOQUEIOS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Afastamento / Férias
                  {blockedPeriods.length > 0 && (
                    <span className="ml-1 bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{blockedPeriods.length}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Modal Body — scrollable */}
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-4">

                {/* ── TAB: DADOS GERAIS ── */}
                {modalTab === 'DADOS' && (
                  <div className="space-y-4">
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
                    <div>
                      <label className="block text-sm font-medium">Matrícula <span className="text-red-500">*</span></label>
                      <input required className="w-full border rounded p-2 bg-white text-gray-900" value={formData.registrationNumber} onChange={e => setFormData({...formData, registrationNumber: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Categoria</label>
                      <div className="flex flex-wrap gap-3">
                        {['A', 'B', 'C', 'D', 'E'].map(cat => (
                          <label key={cat} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 rounded border hover:bg-gray-100">
                            <input
                              type="checkbox"
                              checked={formData.categories?.includes(cat)}
                              onChange={() => toggleCategory(cat)}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm font-bold">{cat}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1">Vagas Cat. A (Moto)</label>
                        <input
                          type="number" min="0" max="99"
                          className="w-full border rounded p-2 bg-white text-gray-900"
                          placeholder="Padrão do sistema"
                          value={formData.defaultMaxSlotsA}
                          onChange={e => setFormData({...formData, defaultMaxSlotsA: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Vagas Cat. B (Carro)</label>
                        <input
                          type="number" min="0" max="99"
                          className="w-full border rounded p-2 bg-white text-gray-900"
                          placeholder="Padrão do sistema"
                          value={formData.defaultMaxSlotsB}
                          onChange={e => setFormData({...formData, defaultMaxSlotsB: e.target.value})}
                        />
                      </div>
                    </div>
                    {formData.categories.some(c => ['C', 'D', 'E'].includes(c)) && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Vagas Cat. C, D, E (Mud. Cat.)</label>
                        <input
                          type="number" min="0" max="99"
                          className="w-full border rounded p-2 bg-white text-gray-900"
                          placeholder="Padrão do sistema"
                          value={formData.defaultMaxSlotsMudanca}
                          onChange={e => setFormData({...formData, defaultMaxSlotsMudanca: e.target.value})}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ── TAB: RODÍZIO ── */}
                {modalTab === 'RODIZIO' && (
                  <div className="space-y-5">
                    {/* Toggle ativo/inativo */}
                    <div className="rounded border bg-gray-50 p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.examRotation}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormData(prev => ({ ...prev, examRotation: true }));
                            } else {
                              clearRotation();
                            }
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm font-medium">Participar do Rodízio de Provas</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-6">Quando ativado, este examinador entra na rotação automática de bancas.</p>
                    </div>

                    {formData.examRotation && (
                      <>
                        {/* Dias da semana */}
                        <fieldset>
                          <legend className="text-sm font-medium mb-2">Dias da semana</legend>
                          <div className="flex flex-wrap gap-2">
                            {([['SEG', 'Seg'], ['TER', 'Ter'], ['QUA', 'Qua'], ['QUI', 'Qui'], ['SEX', 'Sex'], ['SAB', 'Sáb'], ['DOM', 'Dom']] as const).map(([value, label]) => (
                              <label key={value} className="flex items-center gap-2 px-3 py-2 rounded border cursor-pointer text-sm bg-white hover:bg-blue-50">
                                <input
                                  type="checkbox"
                                  checked={rotationDraft.days.includes(value)}
                                  onChange={e => setRotationDraft(prev => ({
                                    ...prev,
                                    days: e.target.checked ? [...prev.days, value] : prev.days.filter(d => d !== value),
                                  }))}
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        {/* Provas por dia */}
                        <fieldset>
                          <legend className="text-sm font-medium mb-2">Provas por dia</legend>
                          <div className="flex gap-5 text-sm">
                            {([1, 2] as const).map(count => (
                              <label key={count} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name="rotation-exams-per-day"
                                  checked={rotationDraft.examsPerDay === count}
                                  onChange={() => setRotationDraft(prev => ({ ...prev, examsPerDay: count }))}
                                />
                                {count === 1 ? 'Uma prova' : 'Duas provas'}
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        {/* Horários */}
                        <div className={rotationDraft.examsPerDay === 2 ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
                          <div>
                            <label className="block text-sm font-medium mb-1">
                              {rotationDraft.examsPerDay === 2 ? 'Horário padrão da 1ª prova' : 'Horário padrão'}
                            </label>
                            <input
                              type="time"
                              value={rotationDraft.defaultTime}
                              onChange={e => setRotationDraft(prev => ({ ...prev, defaultTime: e.target.value }))}
                              className="w-full border rounded p-2 bg-white text-gray-900"
                            />
                          </div>
                          {rotationDraft.examsPerDay === 2 && (
                            <div>
                              <label className="block text-sm font-medium mb-1">Horário padrão da 2ª prova</label>
                              <input
                                type="time"
                                value={rotationDraft.secondDefaultTime ?? ''}
                                onChange={e => setRotationDraft(prev => ({ ...prev, secondDefaultTime: e.target.value }))}
                                className="w-full border rounded p-2 bg-white text-gray-900"
                              />
                            </div>
                          )}
                        </div>

                        {/* Cidades */}
                        <fieldset>
                          <legend className="text-sm font-medium mb-2">Cidades atendidas</legend>
                          {citiesError && <p className="text-sm text-red-600">{citiesError}</p>}
                          {!citiesError && cities.length === 0 && <p className="text-sm text-gray-500">Nenhuma cidade cadastrada.</p>}
                          <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded p-2 bg-gray-50">
                            {cities.map(city => (
                              <label key={city.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={rotationDraft.cityIds.includes(city.id)}
                                  onChange={e => setRotationDraft(prev => ({
                                    ...prev,
                                    cityIds: e.target.checked ? [...prev.cityIds, city.id] : prev.cityIds.filter(id => id !== city.id),
                                  }))}
                                />
                                {city.name}
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        {rotationError && <p className="text-sm text-red-600 font-medium">{rotationError}</p>}

                        {/* Resumo salvo */}
                        {formData.rotationAvailability && (
                          <div className="bg-green-50 border border-green-200 rounded p-3 text-xs text-green-800">
                            <p className="font-semibold mb-1">✓ Disponibilidade confirmada</p>
                            <p>Dias: {formData.rotationAvailability.days.join(', ')}</p>
                            <p>Horário: {formData.rotationAvailability.defaultTime}{formData.rotationAvailability.examsPerDay === 2 ? ` e ${formData.rotationAvailability.secondDefaultTime}` : ''}</p>
                            <p>Cidades: {formData.rotationAvailability.cityIds.map(id => cities.find(c => c.id === id)?.name ?? id).join(', ')}</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={saveRotation}
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                        >
                          <Save className="h-4 w-4" /> Confirmar disponibilidade
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* ── TAB: AFASTAMENTO / FÉRIAS ── */}
                {modalTab === 'BLOQUEIOS' && (
                  <div className="space-y-4">
                    {/* Add new period form */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-semibold text-orange-800">Novo Afastamento</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Data Início <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            className="w-full border rounded p-2 text-sm bg-white text-gray-900"
                            value={newPeriod.startDate}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => setNewPeriod(p => ({ ...p, startDate: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Data Fim <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            className="w-full border rounded p-2 text-sm bg-white text-gray-900"
                            value={newPeriod.endDate}
                            min={newPeriod.startDate || new Date().toISOString().split('T')[0]}
                            onChange={e => setNewPeriod(p => ({ ...p, endDate: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Turno do Afastamento</label>
                        <select
                          className="w-full border rounded p-2 text-sm bg-white text-gray-900"
                          value={newPeriod.period}
                          onChange={e => setNewPeriod(p => ({ ...p, period: e.target.value as 'ALL_DAY' | 'MORNING' | 'AFTERNOON' }))}
                        >
                          <option value="ALL_DAY">Dia inteiro</option>
                          <option value="MORNING">Somente manhã (antes das 12h)</option>
                          <option value="AFTERNOON">Somente tarde (12h ou depois)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Descrição / Motivo</label>
                        <input
                          type="text"
                          className="w-full border rounded p-2 text-sm bg-white text-gray-900"
                          placeholder="Ex: Férias, Atestado médico..."
                          value={newPeriod.description}
                          onChange={e => setNewPeriod(p => ({ ...p, description: e.target.value }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddBlockedPeriod}
                        className="flex items-center gap-2 bg-orange-600 text-white px-3 py-2 rounded text-sm hover:bg-orange-700"
                      >
                        <Plus className="h-4 w-4" /> Adicionar Afastamento
                      </button>
                    </div>

                    {/* List of blocked periods */}
                    {blockedPeriods.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">Nenhum afastamento cadastrado.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Afastamentos cadastrados ({blockedPeriods.length})</p>
                        {[...blockedPeriods].sort((a, b) => a.startDate.localeCompare(b.startDate)).map(period => (
                          <div key={period.id} className="border rounded-lg overflow-hidden">
                            {editingPeriodId === period.id ? (
                              /* ── Modo edição ── */
                              <div className="bg-orange-50 border-orange-200 p-3 space-y-3">
                                <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">Editando afastamento</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Data Início <span className="text-red-500">*</span></label>
                                    <input
                                      type="date"
                                      className="w-full border rounded p-2 text-sm bg-white text-gray-900"
                                      value={editPeriodDraft.startDate}
                                      onChange={e => setEditPeriodDraft(d => ({ ...d, startDate: e.target.value }))}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Data Fim <span className="text-red-500">*</span></label>
                                    <input
                                      type="date"
                                      className="w-full border rounded p-2 text-sm bg-white text-gray-900"
                                      value={editPeriodDraft.endDate}
                                      min={editPeriodDraft.startDate}
                                      onChange={e => setEditPeriodDraft(d => ({ ...d, endDate: e.target.value }))}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Turno do Afastamento</label>
                                  <select
                                    className="w-full border rounded p-2 text-sm bg-white text-gray-900"
                                    value={editPeriodDraft.period}
                                    onChange={e => setEditPeriodDraft(d => ({ ...d, period: e.target.value as 'ALL_DAY' | 'MORNING' | 'AFTERNOON' }))}
                                  >
                                    <option value="ALL_DAY">Dia inteiro</option>
                                    <option value="MORNING">Somente manhã (antes das 12h)</option>
                                    <option value="AFTERNOON">Somente tarde (12h ou depois)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Descrição / Motivo</label>
                                  <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm bg-white text-gray-900"
                                    placeholder="Ex: Férias, Atestado médico..."
                                    value={editPeriodDraft.description}
                                    onChange={e => setEditPeriodDraft(d => ({ ...d, description: e.target.value }))}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditPeriod(period.id)}
                                    className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
                                  >
                                    <Save className="h-3.5 w-3.5" /> Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditPeriod}
                                    className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-1.5 rounded text-sm hover:bg-gray-100"
                                  >
                                    <X className="h-3.5 w-3.5" /> Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* ── Modo visualização ── */
                              <div className="flex items-start gap-3 bg-red-50 border-red-200 p-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-red-700">{formatDateBR(period.startDate)}</span>
                                    {period.startDate !== period.endDate && (
                                      <>
                                        <span className="text-xs text-red-400">→</span>
                                        <span className="text-sm font-semibold text-red-700">{formatDateBR(period.endDate)}</span>
                                      </>
                                    )}
                                    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                                      {period.period === 'MORNING' ? '🌅 Manhã' : period.period === 'AFTERNOON' ? '🌇 Tarde' : '🔒 Dia inteiro'}
                                    </span>
                                  </div>
                                  {period.description && (
                                    <p className="text-xs text-gray-600 mt-0.5 truncate">{period.description}</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleEditBlockedPeriod(period)}
                                  className="text-blue-500 hover:text-blue-700 flex-shrink-0 mt-0.5"
                                  title="Editar afastamento"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBlockedPeriod(period.id)}
                                  className="text-red-500 hover:text-red-700 flex-shrink-0 mt-0.5"
                                  title="Remover afastamento"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-lg">
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

const InstructorsManager: React.FC<{ user: User }> = ({ user }) => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  const vehicleAgeLimitRef = React.useRef<{ A: number | null; B: number | null; CDE: number | null }>({ A: null, B: null, CDE: null });
  
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
  const [newVehicle, setNewVehicle] = useState<{
    brand: string;
    model: string;
    plate: string;
    active: boolean;
    transmission: 'AUTOMATICA' | 'MANUAL';
    accessories: string[];
    duploComando: boolean;
    procuracao: boolean;
    anoFabricacao: string;
  }>({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [], duploComando: false, procuracao: false, anoFabricacao: '' });
  
  const [accessoryInput, setAccessoryInput] = useState('');
  const [vehicleAgeLimit, setVehicleAgeLimit] = useState<{ A: number | null; B: number | null; CDE: number | null }>({ A: null, B: null, CDE: null });

  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
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
  useEffect(() => {
    fetch();
    // Busca os limites de fabricação logo ao montar o componente
    api.getSettings().then((s) => {
      const lim = {
        A: s?.anoFabricacaoMaximo?.A ?? null,
        B: s?.anoFabricacaoMaximo?.B ?? null,
        CDE: s?.anoFabricacaoMaximo?.CDE ?? null,
      };
      vehicleAgeLimitRef.current = lim;
      setVehicleAgeLimit(lim);
    }).catch((error) => {
      console.error('Erro ao carregar limites de ano de fabricação:', error);
    });
  }, []);

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
    setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [], duploComando: false, procuracao: false, anoFabricacao: '' });
    setAccessoryInput('');
    setEditingVehicleId(null);
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

  // --- Vehicle Management Logic ---
  const handleAddVehicle = (type: 'CAR' | 'MOTO') => {
      if (!newVehicle.brand || !newVehicle.model || !newVehicle.plate) {
          alert('Preencha marca, modelo e placa.');
          return;
      }

      if (newVehicle.anoFabricacao.length === 4) {
          const year = parseInt(newVehicle.anoFabricacao, 10);
          const age = new Date().getFullYear() - year;
          const lim = vehicleAgeLimitRef.current;
          const limit = type === 'CAR' ? lim.B : lim.A;
          if (limit !== null && age > limit) {
              alert(`Veículo não pode ser cadastrado. Ano de fabricação ${newVehicle.anoFabricacao} resulta em ${age} anos de uso, acima do limite de ${limit} anos para esta categoria.`);
              return;
          }
      }

      if (editingVehicleId) {
          // Update existing vehicle
          setFormData(prev => ({
              ...prev,
              vehicles: prev.vehicles.map(v => v.id === editingVehicleId ? {
                  ...v,
                  brand: newVehicle.brand.toUpperCase(),
                  model: newVehicle.model.toUpperCase(),
                  plate: newVehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  active: newVehicle.active,
                  transmission: newVehicle.transmission,
                  accessories: newVehicle.accessories,
                  duploComando: newVehicle.duploComando,
                  procuracao: newVehicle.procuracao,
                  anoFabricacao: newVehicle.anoFabricacao || undefined,
              } : v)
          }));
          setEditingVehicleId(null);
      } else {
          // Add new vehicle
          const vehicle: Vehicle = {
              id: `temp_${Date.now()}`, // ID temporário
              instructorId: editing?.id || '',
              type: type,
              brand: newVehicle.brand.toUpperCase(),
              model: newVehicle.model.toUpperCase(),
              plate: newVehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
              active: newVehicle.active,
              transmission: newVehicle.transmission,
              accessories: newVehicle.accessories,
              duploComando: newVehicle.duploComando,
              procuracao: newVehicle.procuracao,
              anoFabricacao: newVehicle.anoFabricacao || undefined,
          };

          setFormData(prev => ({
              ...prev,
              vehicles: [...prev.vehicles, vehicle]
          }));
      }

      setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [], duploComando: false, procuracao: false, anoFabricacao: '' });
      setAccessoryInput('');
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
      setNewVehicle({
          brand: vehicle.brand,
          model: vehicle.model,
          plate: vehicle.plate,
          active: vehicle.active,
          transmission: vehicle.transmission || 'MANUAL',
          accessories: vehicle.accessories || [],
          duploComando: vehicle.duploComando ?? false,
          procuracao: vehicle.procuracao ?? false,
          anoFabricacao: vehicle.anoFabricacao || '',
      });
      setEditingVehicleId(vehicle.id);
      setAccessoryInput('');
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
  
  // --- Auto-Complete Helpers ---
  const availableData = useMemo(() => {
      const isCar = modalTab === 'CARS';
      return {
          brands: isCar ? FIPE_CAR_BRANDS : FIPE_MOTO_BRANDS,
          models: isCar ? FIPE_CAR_MODELS : FIPE_MOTO_MODELS
      };
  }, [modalTab]);

  const availableModels = useMemo(() => {
      const brand = newVehicle.brand.toUpperCase();
      if (brand && availableData.models[brand]) {
          return availableData.models[brand].sort();
      }
      return [];
  }, [availableData, newVehicle.brand]);

  const vehicleYearValidation = useMemo(() => {
      if (newVehicle.anoFabricacao.length !== 4) return null;
      const year = parseInt(newVehicle.anoFabricacao, 10);
      const limit = modalTab === 'CARS'
          ? vehicleAgeLimit.B
          : modalTab === 'MOTOS'
              ? vehicleAgeLimit.A
              : null;
      if (!year || limit === null || new Date().getFullYear() - year <= limit) return null;
      return { limit };
  }, [modalTab, newVehicle.anoFabricacao, vehicleAgeLimit]);

  // Filter Logic
  const filteredInstructors = instructors
    .filter(i =>
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.cpf.includes(searchTerm)
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

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
        {user?.role !== UserRole.CONSULTANT && (
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full md:w-auto justify-center">
            <Plus className="h-4 w-4" /> Novo Instrutor
          </button>
        )}
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
              <th className="px-4 py-3">Carro/Moto Ano Fab.</th>
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
                                   {v.type === 'CAR' && (
                                       <span title={(v as any).duploComando ? 'Duplo Comando' : 'Sem Duplo Comando'}>
                                           {(v as any).duploComando
                                               ? <span className="text-green-500 font-bold text-[11px]">●</span>
                                               : <span className="text-red-400 font-bold text-[11px]">●</span>
                                           }
                                       </span>
                                   )}
                                   {(v as any).procuracao && (
                                       <span className="text-blue-500 font-bold text-[11px]" title="Possui Procuração">●</span>
                                   )}
                               </span>
                           ))}
                           {inst.vehicles.filter(v => v.active).length > 2 && <span className="text-gray-400 italic">+{inst.vehicles.filter(v => v.active).length - 2} mais...</span>}
                       </div>
                   ) : (
                       <span className="text-gray-400">-</span>
                   )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {inst.vehicles && inst.vehicles.filter(v => v.active).length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {inst.vehicles.filter(v => v.active).map(v => {
                        const anoFab = (v as any).anoFabricacao;
                        const limit = v.type === 'CAR' ? vehicleAgeLimit.B : vehicleAgeLimit.A;
                        const missing = !anoFab;
                        const age = missing ? null : new Date().getFullYear() - parseInt(anoFab, 10);
                        const overLimit = !missing && limit !== null && age! > limit;
                        const nearLimit = !missing && !overLimit && limit !== null && age! >= limit - 1;
                        const hasError = missing || overLimit;
                        return (
                          <span key={v.id} className="inline-flex items-center gap-1">
                            {v.type === 'CAR'
                              ? <Car className={`h-3 w-3 ${hasError ? 'text-red-500' : nearLimit ? 'text-red-500' : 'text-gray-400'}`} />
                              : <Bike className={`h-3 w-3 ${hasError ? 'text-red-500' : nearLimit ? 'text-red-500' : 'text-gray-400'}`} />}
                            {hasError
                              ? <span className="text-red-600 font-bold">❌ {missing ? '' : `${anoFab} (${age} ${age === 1 ? 'ano' : 'anos'}) — acima do limite`}</span>
                              : <span className={`font-mono ${nearLimit ? 'text-red-600 font-bold' : ''}`}>{anoFab} ({age} {age === 1 ? 'ano' : 'anos'})</span>
                            }
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {user?.role !== UserRole.CONSULTANT && (
                    <>
                      <button onClick={() => openModal(inst)} className="text-blue-600 hover:text-blue-800"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(inst.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </td>
              </tr>
            ))}
             {filteredInstructors.length === 0 && (
                <tr><td colSpan={7} className="p-4 text-center text-gray-500">Nenhum instrutor encontrado.</td></tr>
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
                        onClick={() => { setModalTab('CARS'); setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [], duploComando: false, procuracao: false, anoFabricacao: '' }); setAccessoryInput(''); }} 
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'CARS' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                       <Car className="h-4 w-4" /> Carros
                    </button>
                )}

                {(formData.category === 'A' || formData.category === 'AB') && (
                    <button 
                        type="button"
                        onClick={() => { setModalTab('MOTOS'); setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [], duploComando: false, procuracao: false, anoFabricacao: '' }); setAccessoryInput(''); }} 
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
                        </>
                    )}

                    {/* TAB: CARS OR MOTOS */}
                    {(modalTab === 'CARS' || modalTab === 'MOTOS') && (
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase flex items-center gap-2">
                                    {editingVehicleId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    {editingVehicleId ? 'Editar' : 'Adicionar'} {modalTab === 'CARS' ? 'Carro' : 'Moto'}
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <input 
                                            list="brandList"
                                            placeholder="Marca" 
                                            className="border rounded p-2 text-sm bg-white w-full uppercase" 
                                            value={newVehicle.brand}
                                            onChange={e => setNewVehicle({...newVehicle, brand: e.target.value})}
                                        />
                                        <datalist id="brandList">
                                            {availableData.brands.map(b => <option key={b} value={b} />)}
                                        </datalist>
                                    </div>
                                    
                                    <div>
                                        <input 
                                            list="modelList"
                                            placeholder="Modelo" 
                                            className="border rounded p-2 text-sm bg-white w-full uppercase" 
                                            value={newVehicle.model}
                                            onChange={e => setNewVehicle({...newVehicle, model: e.target.value})}
                                        />
                                        <datalist id="modelList">
                                            {availableModels.map(m => <option key={m} value={m} />)}
                                        </datalist>
                                    </div>

                                    <div className="flex gap-1">
                                        <input 
                                            placeholder="Placa (ex: ABC1234)"
                                            className="flex-1 border rounded p-2 text-sm bg-white font-mono uppercase min-w-0"
                                            value={newVehicle.plate}
                                            maxLength={8}
                                            onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                    {modalTab === 'CARS' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Duplo Comando</label>
                                            <select
                                                className="w-full border rounded p-2 text-sm bg-white"
                                                value={newVehicle.duploComando ? 'SIM' : 'NAO'}
                                                onChange={e => setNewVehicle({...newVehicle, duploComando: e.target.value === 'SIM'})}
                                            >
                                                <option value="SIM">Sim</option>
                                                <option value="NAO">Não</option>
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ano de Fabricação</label>
                                        <input
                                            type="text"
                                            maxLength={4}
                                            placeholder="Ex: 2002"
                                            className="w-full border rounded p-2 text-sm bg-white"
                                            value={newVehicle.anoFabricacao}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                                setNewVehicle({ ...newVehicle, anoFabricacao: val });
                                            }}
                                        />
                                    </div>
                                </div>

                                {vehicleYearValidation ? (
                                    <p role="alert" className="mt-3 w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">
                                        ⚠️ Veículo não poderá ser cadastrado — ano mais antigo que o permitido ({vehicleYearValidation.limit} anos máx.).
                                    </p>
                                ) : newVehicle.anoFabricacao.length === 4 && (
                                    <p className="mt-2 w-full text-center text-xs text-green-600">
                                        Idade: {new Date().getFullYear() - parseInt(newVehicle.anoFabricacao, 10)} anos
                                    </p>
                                )}

                                <div className="flex justify-between items-center mt-3">
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={newVehicle.active} onChange={e => setNewVehicle({...newVehicle, active: e.target.checked})} />
                                            Ativo
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input type="checkbox" checked={newVehicle.procuracao} onChange={e => setNewVehicle({...newVehicle, procuracao: e.target.checked})} />
                                            Possui Procuração
                                        </label>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => handleAddVehicle(modalTab === 'CARS' ? 'CAR' : 'MOTO')}
                                        disabled={!!vehicleYearValidation}
                                        className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                                    >
                                        {editingVehicleId ? 'Salvar Alterações' : 'Adicionar'}
                                    </button>
                                    {editingVehicleId && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setEditingVehicleId(null);
                                                setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [], duploComando: false, procuracao: false, anoFabricacao: '' });
                                                setAccessoryInput('');
                                            }}
                                            className="px-4 py-2 bg-gray-200 text-gray-600 text-xs font-bold rounded hover:bg-gray-300"
                                        >
                                            Cancelar Edição
                                        </button>
                                    )}
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
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span className="font-mono">{vehicle.plate}</span>
                                                {vehicle.type === 'CAR' && (
                                                    <>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                        <span className={(vehicle as any).duploComando ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                                                            Duplo Comando: {(vehicle as any).duploComando ? 'Sim' : 'Não'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            {(() => {
                                                const fab = (vehicle as any).anoFabricacao || (vehicle as any).ano_fabricacao;
                                                if (!fab) return null;
                                                const year = parseInt(fab, 10);
                                                if (!year || year < 1900) return null;
                                                const currentYear = new Date().getFullYear();
                                                const age = currentYear - year;
                                                const limit = vehicle.type === 'CAR' ? vehicleAgeLimit.B : vehicleAgeLimit.A;
                                                const overLimit = limit !== null && age > limit;
                                                return (
                                                    <div className={`text-xs mt-1 flex items-center gap-1 ${overLimit ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                                        {overLimit && <span>⚠️</span>}
                                                        <span>Fab: {fab} ({age} ano{age !== 1 ? 's' : ''})</span>
                                                        {overLimit && <span>— acima do limite ({limit} anos máx.)</span>}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                type="button" 
                                                onClick={() => handleEditVehicle(vehicle)}
                                                className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title="Editar"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
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
