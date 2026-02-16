
import React, { useEffect, useState } from 'react';
import { api } from '../services/mockData';
import { ExamRequest, UserRole, User, ExamStatus, ExamSchedule } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, FileCheck, AlertTriangle, Calendar, Database, RefreshCw, CheckCircle } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#EF4444', '#8884d8'];

const StatCard: React.FC<{ title: string; value: number | string; icon: React.ElementType; color: string }> = ({ title, value, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
    <div className={`p-3 rounded-lg ${color} bg-opacity-10 text-${color.replace('bg-', '')}`}>
      <Icon className={`h-8 w-8 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

const AdminDashboard: React.FC<{ user: User }> = ({ user }) => {
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const refreshData = async () => {
    setLoading(true);
    try {
        const [requestsData, schedulesData, testData] = await Promise.all([
            api.getRequests(),
            api.getSchedules(),
            fetch('/api/test').then(res => res.json()).catch(() => ({ status: 'OFFLINE' }))
        ]);
        
        setDbStatus(testData);

        if (user.role === UserRole.SCHOOL) {
            setRequests(requestsData.filter(r => r.schoolId === user.schoolId));
        } else {
            setRequests(requestsData);
        }
        setSchedules(schedulesData);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [user]);

  const handleSync = async () => {
      setSyncing(true);
      try {
          const res = await fetch('/api/setup', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
              alert("BANCO SINCRONIZADO COM SUCESSO!");
              refreshData();
          } else {
              alert("Erro: " + data.details);
          }
      } catch (e: any) {
          alert("Erro de conexão: " + e.message);
      } finally {
          setSyncing(false);
      }
  };

  // Derived Stats
  const totalBancas = schedules.length;
  const pending = requests.filter(r => r.status === ExamStatus.WAITING_SCHEDULING).length;
  const scheduled = requests.filter(r => r.status === ExamStatus.SCHEDULED).length;
  const done = requests.filter(r => r.status === ExamStatus.DONE).length;

  const dataByStatus = [
    { name: 'Aguardando', value: pending },
    { name: 'Agendado', value: scheduled },
    { name: 'Aguard. Result', value: requests.filter(r => r.status === ExamStatus.WAITING_RESULT).length },
    { name: 'Realizado', value: done },
    { name: 'Reteste', value: requests.filter(r => r.status === ExamStatus.RETEST).length },
    { name: 'Cancelado', value: requests.filter(r => r.status === ExamStatus.CANCELLED).length },
  ];

  const dataByType = [
    { name: '1ª Habilitação', value: requests.filter(r => r.examType === 'COMMON').length },
    { name: 'PCD', value: requests.filter(r => r.examType === 'PCD').length },
  ];

  if (loading) {
      return <div className="p-10 text-center text-gray-500">Carregando painel de controle...</div>;
  }

  return (
    <div className="space-y-6">
      {/* ALERTA DE CONFIGURAÇÃO DO BANCO */}
      {dbStatus?.status !== 'OK' && user.role === UserRole.ADMIN && (
          <div className="bg-amber-600 text-white p-4 rounded-xl shadow-lg border-2 border-amber-400 flex flex-col md:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-2 rounded-full">
                      <Database className="h-6 w-6" />
                  </div>
                  <div>
                      <h4 className="font-bold text-lg">Configuração do Banco Necessária!</h4>
                      <p className="text-sm opacity-90">O sistema detectou que as tabelas no Neon não estão prontas. Clique no botão ao lado para corrigir.</p>
                  </div>
              </div>
              <button 
                onClick={handleSync}
                disabled={syncing}
                className="bg-white text-amber-700 px-6 py-2.5 rounded-lg font-black hover:bg-amber-50 flex items-center gap-2 whitespace-nowrap shadow-sm disabled:opacity-50"
              >
                  {syncing ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Database className="h-5 w-5" />}
                  SINCRONIZAR AGORA
              </button>
          </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          {user.role === UserRole.SCHOOL ? `Dashboard - ${user.name}` : 'Painel de Controle'}
        </h2>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
            {dbStatus?.status === 'OK' ? (
                <span className="flex items-center gap-1 text-green-500"><CheckCircle className="h-3 w-3" /> Banco Conectado</span>
            ) : (
                <span className="flex items-center gap-1 text-amber-500"><AlertTriangle className="h-3 w-3" /> Modo Offline</span>
            )}
            <span className="mx-2">|</span>
            Última atualização: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total de Bancas" value={totalBancas} icon={Calendar} color="bg-blue-600" />
        <StatCard title="Aguardando Agendamento" value={pending} icon={AlertTriangle} color="bg-yellow-500" />
        <StatCard title="Candidatos Agendados" value={scheduled} icon={Users} color="bg-indigo-500" />
        <StatCard title="Provas Realizadas" value={done} icon={FileCheck} color="bg-green-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
          <h3 className="text-lg font-semibold mb-6 flex-shrink-0">Status dos Candidatos</h3>
          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataByStatus} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} interval={0} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
          <h3 className="text-lg font-semibold mb-6 flex-shrink-0">Distribuição por Tipo</h3>
          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {dataByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3B82F6' : '#10B981'} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
