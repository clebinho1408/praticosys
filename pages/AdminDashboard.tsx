
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ExamRequest, UserRole, User, ExamStatus, ExamSchedule } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Users, FileCheck, AlertTriangle, Calendar } from 'lucide-react';

// Module Components
import { CnhModule } from '../components/dashboard/CnhModule';
import { CfcModule } from '../components/dashboard/CfcModule';
import { PcdModule } from '../components/dashboard/PcdModule';

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

  const refreshData = async () => {
    setLoading(true);
    try {
        const [requestsData, schedulesData] = await Promise.all([
            api.getRequests(),
            api.getSchedules()
        ]);
        
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
  ]; // --- LOGICA DE FILTRAGEM POR MÓDULO ---
  
  const getModuleStats = (filterFn: (req: ExamRequest) => boolean, scheduleFilterFn: (sch: ExamSchedule) => boolean) => {
    const filteredRequests = requests.filter(filterFn);
    const filteredSchedules = schedules.filter(scheduleFilterFn);

    const allExamResults = filteredRequests.flatMap(req => {
        const list: any[] = [];
        if (req.examHistory && Array.isArray(req.examHistory)) {
            req.examHistory.forEach((h: any) => {
                list.push({ result: h.result, date: h.date || req.createdAt.split('T')[0] });
            });
        }
        if (req.status === ExamStatus.DONE && req.result) {
            list.push({ result: req.result, date: req.scheduledDate || req.createdAt.split('T')[0] });
        }
        return list;
    });

    const total = allExamResults.length;
    const apto = allExamResults.filter(r => r.result === 'APTO').length;
    const inapto = allExamResults.filter(r => r.result === 'INAPTO').length;
    const faltou = allExamResults.filter(r => r.result === 'FALTOU').length;
    const rate = total > 0 ? ((apto / total) * 100).toFixed(1) : '0';

    const pieData = [
      { name: 'Apto', value: apto },
      { name: 'Inapto', value: inapto },
      { name: 'Faltou', value: faltou }
    ];

    const monthlyData: Record<string, { name: string, sortKey: string, apto: number, inapto: number }> = {};
    allExamResults.forEach(r => {
      if (!r.date) return;
      const dateStr = r.date.split('T')[0];
      const [year, month] = dateStr.split('-');
      const sortKey = `${year}-${month}`;
      const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('pt-BR', { month: 'short' });
      const label = `${monthName}/${year.substr(2)}`;
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { name: label, sortKey, apto: 0, inapto: 0 };
      if (r.result === 'APTO') monthlyData[sortKey].apto++;
      if (r.result === 'INAPTO') monthlyData[sortKey].inapto++;
    });
    const chartData = Object.values(monthlyData).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const totalSchedules = filteredSchedules.length;
    const open = filteredSchedules.filter(s => s.status === 'OPEN').length;
    const concluded = filteredSchedules.filter(s => s.status === 'CONCLUDED').length;
    const cancelled = filteredSchedules.filter(s => s.status === 'CANCELLED').length;
    const closed = filteredSchedules.filter(s => s.status === 'CLOSED').length;

    const schedulePieData = [
        { name: 'Abertas', value: open },
        { name: 'Concluídas', value: concluded },
        { name: 'Canceladas', value: cancelled },
        { name: 'Fechadas', value: closed }
    ];

    const slotUsageData: Record<string, { name: string, sortKey: string, total: number, used: number }> = {};
    filteredSchedules.forEach(sch => {
        const date = new Date(sch.date);
        const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleString('pt-BR', { month: 'short' });
        const label = `${monthName}/${date.getFullYear().toString().substr(2)}`;
        if (!slotUsageData[sortKey]) slotUsageData[sortKey] = { name: label, sortKey, total: 0, used: 0 };
        const totalSlots = (sch.maxSlotsA || 0) + (sch.maxSlotsB || 0);
        const usedSlots = filteredRequests.filter(r => r.scheduleId === sch.id).length;
        slotUsageData[sortKey].total += totalSlots;
        slotUsageData[sortKey].used += usedSlots;
    });
    const slotUsageChartData = Object.values(slotUsageData).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return { total, apto, inapto, faltou, rate, pieData, chartData, totalSchedules, open, concluded, cancelled, closed, schedulePieData, slotUsageChartData, pending: filteredRequests.filter(r => r.status === ExamStatus.WAITING_SCHEDULING).length, scheduled: filteredRequests.filter(r => r.status === ExamStatus.SCHEDULED).length };
  };

  const cnhBrasilStats = useMemo(() => getModuleStats(
    r => r.examType === 'COMMON' && r.source !== 'SCHOOL', 
    s => s.type === 'COMMON'
  ), [requests, schedules]);

  const cfcStats = useMemo(() => getModuleStats(
    r => r.examType === 'COMMON' && r.source === 'SCHOOL', 
    s => s.type === 'COMMON'
  ), [requests, schedules]);

  const pcdStats = useMemo(() => getModuleStats(
    r => r.examType === 'PCD', 
    s => s.type === 'PCD'
  ), [requests, schedules]);

  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(tab || 'dashboard');

  useEffect(() => {
    if (tab) {
      setActiveTab(tab);
    }
  }, [tab]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    if (newTab === 'dashboard') {
      navigate('/admin');
    } else {
      navigate(`/admin/dashboard/${newTab}`);
    }
  };

  if (loading) {
      return <div className="p-10 text-center text-gray-500">Carregando painel de controle...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          {user.role === UserRole.SCHOOL ? `Dashboard - ${user.name}` : 'Painel de Controle'}
        </h2>
        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
            Última atualização: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => handleTabChange('dashboard')}
            className={`px-4 py-2 font-bold text-sm whitespace-nowrap ${activeTab === 'dashboard' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
              Visão Geral
          </button>
          <button 
            onClick={() => handleTabChange('cnh')}
            className={`px-4 py-2 font-bold text-sm whitespace-nowrap ${activeTab === 'cnh' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
              CNH do Brasil
          </button>
          <button 
            onClick={() => handleTabChange('cfc')}
            className={`px-4 py-2 font-bold text-sm whitespace-nowrap ${activeTab === 'cfc' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
              Prova Prática CFC
          </button>
          <button 
            onClick={() => handleTabChange('pcd')}
            className={`px-4 py-2 font-bold text-sm whitespace-nowrap ${activeTab === 'pcd' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
              Prova Prática PCD
          </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total de Bancas" value={totalBancas} icon={Calendar} color="bg-blue-600" />
            <StatCard title="Aguardando Agendamento" value={pending} icon={AlertTriangle} color="bg-yellow-500" />
            <StatCard title="Candidatos Agendados" value={scheduled} icon={Users} color="bg-indigo-500" />
            <StatCard title="Provas Realizadas" value={done} icon={FileCheck} color="bg-green-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
              <h3 className="text-lg font-semibold mb-6 flex-shrink-0">Status dos Candidatos (Geral)</h3>
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
                      {dataByType.map((_, index) => (
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
      )}

      {activeTab === 'cnh' && <CnhModule stats={cnhBrasilStats} title="CNH do Brasil" />}
      {activeTab === 'cfc' && <CfcModule stats={cfcStats} title="Prova Prática CFC" />}
      {activeTab === 'pcd' && <PcdModule stats={pcdStats} title="Prova Prática PCD" />}
    </div>
  );
};

export default AdminDashboard;
