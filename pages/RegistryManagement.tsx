
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { User, UserRole, OperatorModule, DrivingSchool, Examiner, Instructor, Vehicle, SchoolSchedule, City } from '../types';
import { Plus, Edit2, Trash2, Search, Building2, Users, GraduationCap, Save, Lock, Car, User as UserIcon, Bike, CheckCircle2, XCircle, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '../components/CustomModals';

type Tab = 'USERS' | 'SCHOOLS' | 'EXAMINERS' | 'INSTRUCTORS';

import { FIPE_CAR_BRANDS, FIPE_MOTO_BRANDS, FIPE_CAR_MODELS, FIPE_MOTO_MODELS } from '../data/fipeData';

const RegistryManagement: React.FC<{ user: User }> = ({ user }) => {
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
          {activeTab === 'USERS' && <UsersManager user={user} />}
          {activeTab === 'SCHOOLS' && <SchoolsManager user={user} />}
          {activeTab === 'EXAMINERS' && <ExaminersManager user={user} />}
          {activeTab === 'INSTRUCTORS' && <InstructorsManager user={user} />}
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
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [formData, setFormData] = useState<{ name: string; login: string; role: UserRole; schoolId: string; allowedModules: OperatorModule[] }>({ name: '', login: '', role: UserRole.OPERATOR, schoolId: '', allowedModules: ['cnh', 'cfc', 'pcd'] });

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
  };

  useEffect(() => { fetchData(); }, []);

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, login: user.login, role: user.role, schoolId: user.schoolId || '', allowedModules: (user.allowedModules && user.allowedModules.length > 0) ? user.allowedModules : ['cnh', 'cfc', 'pcd'] });
    } else {
      setEditingUser(null);
      setFormData({ name: '', login: '', role: UserRole.OPERATOR, schoolId: '', allowedModules: ['cnh', 'cfc', 'pcd'] });
    }
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
      // Only persist allowedModules for OPERATOR and SUPERVISOR roles
      if (formData.role !== UserRole.OPERATOR && formData.role !== UserRole.SUPERVISOR) delete payload.allowedModules;
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
        {user?.role !== UserRole.CONSULTANT && (
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full md:w-auto justify-center">
            <Plus className="h-4 w-4" /> Novo Usuário
          </button>
        )}
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
                  <option value={UserRole.CONSULTANT}>Consultor</option>
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
              {(formData.role === UserRole.OPERATOR || formData.role === UserRole.SUPERVISOR) && (
                <div>
                  <label className="block text-sm font-medium mb-2">Módulos Permitidos</label>
                  <div className="space-y-2 border rounded p-3 bg-gray-50">
                    {(['cnh', 'cfc', 'pcd'] as OperatorModule[]).map(mod => {
                      const labels: Record<OperatorModule, string> = { cnh: 'CNH do Brasil', cfc: 'Exame Prático CFC', pcd: 'Exame Prático PCD' };
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
                  </div>
                  {formData.allowedModules.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">Selecione ao menos um módulo.</p>
                  )}
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

const SchoolsManager: React.FC<{ user: User }> = ({ user }) => {
  const [schools, setSchools] = useState<DrivingSchool[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<DrivingSchool | null>(null);
  const [modalTab, setModalTab] = useState<'MAIN' | 'YARDS' | 'SCHEDULE_MAIN' | 'SCHEDULE_PROV'>('MAIN');
  
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
    mainSchedule: { frequency: '1_WEEK', days: [], slots: [], active: false },
    provisionalSchedule: { frequency: '1_WEEK', days: [], slots: [], active: false }
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
    setSchools(await api.getSchoolsAsync());
    setExaminers(await api.getExaminersAsync());
    try {
      const citiesData = await api.getCities();
      setCities(citiesData);
    } catch (err) {
      console.error("Erro ao carregar cidades:", err);
    }
  };
  useEffect(() => { fetch(); }, []);

  const openModal = async (school?: DrivingSchool) => {
    setEditing(school || null);
    setFormData(school ? { ...initialFormData, ...school } : initialFormData);
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

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-200">
          <div>
            <h4 className="font-bold text-sm">{type === 'main' ? 'Escala Principal' : 'Escala Provisória'}</h4>
            <p className="text-xs text-gray-500">{schedule.active ? 'Esta escala está ATIVA' : 'Esta escala está DESATIVADA'}</p>
          </div>
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
                    const servicesText = s.services && s.services.length > 0 ? s.services.join(', ') : 'Nenhum';

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
                                <span className="text-xs font-medium text-gray-600">
                                  {activeSchedule.frequency === '1_WEEK' && '1x na Semana'}
                                  {activeSchedule.frequency === '2_WEEK' && '2x na Semana'}
                                  {activeSchedule.frequency === '3_WEEK' && '3x na Semana'}
                                  {activeSchedule.frequency === '2_DAY' && '2x no Dia'}
                                  {activeSchedule.frequency === '15_DAYS' && 'A cada 15 dias'}
                                </span>
                              </div>
                              <div className="space-y-1">
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            <div className="p-6 border-b">
              <h3 className="text-lg font-bold">{editing ? 'Editar Autoescola' : 'Nova Autoescola'}</h3>
            </div>
            
            <div className="flex border-b bg-gray-50 overflow-x-auto">
              {[
                { id: 'MAIN', label: 'Dados Principais' },
                { id: 'YARDS', label: 'Pátios' },
                { id: 'SCHEDULE_MAIN', label: 'Escala Principal' },
                { id: 'SCHEDULE_PROV', label: 'Escala Provisória' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setModalTab(tab.id as any)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
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

                {modalTab === 'SCHEDULE_MAIN' && renderScheduleConfig('main')}
                {modalTab === 'SCHEDULE_PROV' && renderScheduleConfig('provisional')}
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Examiner | null>(null);
  const [formData, setFormData] = useState<{ name: string; registrationNumber: string; categories: string[] }>({ name: '', registrationNumber: '', categories: [] });

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
    setFormData(ex ? { name: ex.name, registrationNumber: ex.registrationNumber, categories: ex.categories || [] } : { name: '', registrationNumber: '', categories: [] });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateExaminer(editing.id, formData);
      } else {
        const newEx = await api.createExaminer(formData);
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
            <>
              <button onClick={handleSyncUsers} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-200 justify-center">
                Sincronizar Usuários
              </button>
              <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 justify-center">
                <Plus className="h-4 w-4" /> Novo Examinador
              </button>
            </>
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
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredExaminers.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-gray-500">{e.registrationNumber}</td>
                <td className="px-4 py-3 space-x-1">
                  {e.categories && e.categories.length > 0 ? (
                    e.categories.map(cat => (
                      <span key={cat} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block mb-1">
                        {cat}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500">-</span>
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
                <label className="block text-sm font-medium">Categoria</label>
                <div className="flex flex-wrap gap-3">
                  {['A', 'B', 'C', 'D', 'E', 'PCD'].map(cat => (
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

const InstructorsManager: React.FC<{ user: User }> = ({ user }) => {
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
  const [newVehicle, setNewVehicle] = useState<{
    brand: string;
    model: string;
    plate: string;
    active: boolean;
    transmission: 'AUTOMATICA' | 'MANUAL';
    accessories: string[];
  }>({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [] });
  
  const [accessoryInput, setAccessoryInput] = useState('');
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [plateLookupLoading, setPlateLookupLoading] = useState(false);
  const [plateLookupMsg, setPlateLookupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
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
    setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [] });
    setAccessoryInput('');
    setEditingVehicleId(null);
    setPlateLookupMsg(null);
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

  // --- Plate Lookup via SINESP ---
  const handleLookupPlate = async () => {
    const cleanPlate = newVehicle.plate.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanPlate.length < 7) {
      setPlateLookupMsg({ type: 'error', text: 'Placa incompleta. Use formato ABC1234 ou ABC1D23.' });
      return;
    }
    setPlateLookupLoading(true);
    setPlateLookupMsg(null);
    try {
      const result = await api.lookupVehicleByPlate(cleanPlate);
      const brand = (result.brand || '').toUpperCase();
      const model = (result.model || '').toUpperCase();
      setNewVehicle(prev => ({
        ...prev,
        brand: brand || prev.brand,
        model: model || prev.model,
      }));
      const parts = [brand, model, result.color, result.year].filter(Boolean).join(' · ');
      setPlateLookupMsg({ type: 'success', text: `Encontrado: ${parts}` });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('404') || msg.includes('não encontrado')) {
        setPlateLookupMsg({ type: 'error', text: 'Veículo não encontrado para esta placa.' });
      } else {
        setPlateLookupMsg({ type: 'error', text: 'Serviço indisponível. Preencha marca e modelo manualmente.' });
      }
    } finally {
      setPlateLookupLoading(false);
    }
  };

  // --- Vehicle Management Logic ---
  const handleAddVehicle = (type: 'CAR' | 'MOTO') => {
      if (!newVehicle.brand || !newVehicle.model || !newVehicle.plate) {
          alert('Preencha marca, modelo e placa.');
          return;
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
                  accessories: newVehicle.accessories
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
              accessories: newVehicle.accessories
          };

          setFormData(prev => ({
              ...prev,
              vehicles: [...prev.vehicles, vehicle]
          }));
      }

      setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [] });
      setAccessoryInput('');
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
      setNewVehicle({
          brand: vehicle.brand,
          model: vehicle.model,
          plate: vehicle.plate,
          active: vehicle.active,
          transmission: vehicle.transmission || 'MANUAL',
          accessories: vehicle.accessories || []
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
                        onClick={() => { setModalTab('CARS'); setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [] }); setAccessoryInput(''); setPlateLookupMsg(null); }} 
                        className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'CARS' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                       <Car className="h-4 w-4" /> Carros
                    </button>
                )}

                {(formData.category === 'A' || formData.category === 'AB') && (
                    <button 
                        type="button"
                        onClick={() => { setModalTab('MOTOS'); setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [] }); setAccessoryInput(''); setPlateLookupMsg(null); }} 
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
                                            onChange={e => { setNewVehicle({...newVehicle, plate: e.target.value}); setPlateLookupMsg(null); }}
                                            onBlur={() => { const p = newVehicle.plate.replace(/[^A-Z0-9]/gi, ''); if (p.length >= 7) handleLookupPlate(); }}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleLookupPlate}
                                            disabled={plateLookupLoading || newVehicle.plate.replace(/[^A-Z0-9]/gi, '').length < 7}
                                            className="px-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 flex-shrink-0"
                                            title="Consultar marca e modelo pela placa (SINESP)"
                                        >
                                            {plateLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                {plateLookupMsg && (
                                    <div className={`text-xs mt-1 flex items-center gap-1 ${plateLookupMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                                        {plateLookupMsg.type === 'success'
                                            ? <CheckCircle2 className="h-3 w-3" />
                                            : <AlertCircle className="h-3 w-3" />}
                                        {plateLookupMsg.text}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Transmissão</label>
                                        <select 
                                            className="w-full border rounded p-2 text-sm bg-white"
                                            value={newVehicle.transmission}
                                            onChange={e => setNewVehicle({...newVehicle, transmission: e.target.value as any})}
                                        >
                                            <option value="MANUAL">Manual</option>
                                            <option value="AUTOMATICA">Automática</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Acessórios</label>
                                        <div className="flex gap-1">
                                            <input 
                                                type="text"
                                                placeholder="Ex: Acelerador à esquerda"
                                                className="flex-1 border rounded p-2 text-sm bg-white min-w-0"
                                                value={accessoryInput}
                                                onChange={e => setAccessoryInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (accessoryInput.trim()) {
                                                            setNewVehicle({
                                                                ...newVehicle,
                                                                accessories: [...newVehicle.accessories, accessoryInput.trim()]
                                                            });
                                                            setAccessoryInput('');
                                                        }
                                                    }
                                                }}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    if (accessoryInput.trim()) {
                                                        setNewVehicle({
                                                            ...newVehicle,
                                                            accessories: [...newVehicle.accessories, accessoryInput.trim()]
                                                        });
                                                        setAccessoryInput('');
                                                    }
                                                }}
                                                className="px-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 flex-shrink-0"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {newVehicle.accessories.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {newVehicle.accessories.map((acc, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full border border-blue-100">
                                                {acc}
                                                <button 
                                                    type="button"
                                                    onClick={() => setNewVehicle({
                                                        ...newVehicle,
                                                        accessories: newVehicle.accessories.filter((_, i) => i !== idx)
                                                    })}
                                                    className="hover:text-red-500"
                                                >
                                                    <XCircle className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

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
                                        {editingVehicleId ? 'Salvar Alterações' : 'Adicionar'}
                                    </button>
                                    {editingVehicleId && (
                                        <button 
                                            type="button" 
                                            onClick={() => {
                                                setEditingVehicleId(null);
                                                setNewVehicle({ brand: '', model: '', plate: '', active: true, transmission: 'MANUAL', accessories: [] });
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
                                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                <span>{vehicle.transmission === 'AUTOMATICA' ? 'Automática' : 'Manual'}</span>
                                            </div>
                                            {vehicle.accessories && vehicle.accessories.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {vehicle.accessories.map((acc, idx) => (
                                                        <span key={idx} className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded">
                                                            {acc}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
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
