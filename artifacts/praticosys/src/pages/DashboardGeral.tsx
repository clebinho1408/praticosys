
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../services/api';
import { ExamRequest, ExamSchedule, ExamStatus, User } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Users, Calendar, CheckCircle, AlertTriangle, Car, Map, Accessibility, TrendingUp, Clock } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={`p-3 rounded-xl ${color} bg-opacity-10 shrink-0`}>
      <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black text-gray-900">{value}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

interface ModuleSummaryProps {
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  pending: number;
  scheduled: number;
  done: number;
  cancelled: number;
  openSchedules: number;
  approvalRate: string;
  rejectionRate: string;
  showBancas?: boolean; // true = CNH do Brasil; false = CFC/PCD
}

const ModuleSummary: React.FC<ModuleSummaryProps> = ({
  title, icon: Icon, color, bgColor,
  pending, scheduled, done, cancelled: _cancelled, openSchedules, approvalRate, rejectionRate,
  showBancas = false,
}) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden`}>
    <div className={`${bgColor} px-6 py-4 flex items-center gap-3`}>
      <Icon className={`h-5 w-5 ${color}`} />
      <h3 className={`font-black text-sm uppercase tracking-wider ${color}`}>{title}</h3>
    </div>
    <div className="p-5 grid grid-cols-3 gap-4">
      <div className="text-center">
        <p className="text-xl font-black text-yellow-600">{pending}</p>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Aguardando</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-black text-blue-600">{scheduled}</p>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Agendados</p>
      </div>
      <div className="text-center">
        <p className="text-xl font-black text-green-600">{done}</p>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Realizados</p>
      </div>
    </div>
    <div className="border-t border-gray-50 px-5 py-3 flex justify-between text-xs text-gray-500 font-bold">
      {showBancas
        ? <span>Bancas abertas: <span className="text-blue-700">{openSchedules}</span></span>
        : <span>Reprovação: <span className="text-red-600">{rejectionRate}%</span></span>
      }
      <span>Aprovação: <span className="text-green-700">{approvalRate}%</span></span>
    </div>
  </div>
);

const COLORS_PIE = ['#3B82F6', '#10B981', '#8B5CF6'];
const COLORS_STATUS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'];

interface DashboardGeralProps {
  user: User;
}

const DashboardGeral: React.FC<DashboardGeralProps> = ({ user: _user }) => {
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [reqs, schs] = await Promise.all([api.getRequests(), api.getSchedules()]);
        setRequests(reqs);
        setSchedules(schs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const stats = useMemo(() => {
    // --- CNH do Brasil ---
    const cnhReqs = requests.filter(r =>
      r.modulo ? r.modulo === 'CNH_BRASIL' : (r.examType === 'COMMON' && (!r.schoolId || r.schoolId === 'CNH_BRASIL'))
    );
    const cnhSched = schedules.filter(s => s.type === 'COMMON');

    // --- CFC ---
    const cfcReqs = requests.filter(r =>
      r.modulo ? r.modulo === 'CFC' : (!r.examType || r.examType !== 'PCD') && r.schoolId && r.schoolId !== 'CNH_BRASIL' && r.schoolId !== 'PCD' && r.examType === 'COMMON'
    );
    const cfcSched = schedules.filter(s => s.type === 'COMMON');

    // --- PCD ---
    const pcdReqs = requests.filter(r =>
      r.modulo ? r.modulo === 'PCD' : (r.examType === 'PCD' || r.schoolId === 'PCD')
    );
    const pcdSched = schedules.filter(s => s.type === 'PCD');

    // Filtro: últimos 12 meses
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const inLast12Months = (r: ExamRequest) => {
      const dateStr = r.scheduledDate || r.createdAt?.split('T')[0];
      if (!dateStr) return true;
      return new Date(dateStr) >= twelveMonthsAgo;
    };

    const moduleStats = (reqs: ExamRequest[], schs: ExamSchedule[]) => {
      const reqs12 = reqs.filter(inLast12Months);
      const pending = reqs12.filter(r => r.status === ExamStatus.WAITING_SCHEDULING).length;
      const scheduled = reqs12.filter(r => r.status === ExamStatus.SCHEDULED).length;
      const done = reqs12.filter(r => r.status === ExamStatus.DONE).length;
      const cancelled = reqs12.filter(r => r.status === ExamStatus.CANCELLED).length;
      const openSchedules = schs.filter(s => s.status === 'OPEN').length;

      const allResults = reqs12.flatMap(r => {
        const list: string[] = [];
        if (r.examHistory && Array.isArray(r.examHistory)) {
          (r.examHistory as any[]).forEach((h: any) => list.push(h.result));
        }
        if (r.status === ExamStatus.DONE && r.result) list.push(r.result);
        return list;
      });
      const aptos = allResults.filter(r => r === 'APTO').length;
      const inaptos = allResults.filter(r => r === 'INAPTO').length;
      const total = aptos + inaptos;
      const approvalRate = total > 0 ? ((aptos / total) * 100).toFixed(1) : '0';
      const rejectionRate = total > 0 ? ((inaptos / total) * 100).toFixed(1) : '0';

      return { pending, scheduled, done, cancelled, openSchedules, approvalRate, rejectionRate };
    };

    const cnh = moduleStats(cnhReqs, cnhSched);
    const cfc = moduleStats(cfcReqs, cfcSched);
    const pcd = moduleStats(pcdReqs, pcdSched);

    const totalAll = requests.length;
    const totalSchedules = schedules.length;
    const totalPending = requests.filter(r => r.status === ExamStatus.WAITING_SCHEDULING).length;
    const totalScheduled = requests.filter(r => r.status === ExamStatus.SCHEDULED).length;
    const totalDone = requests.filter(r => r.status === ExamStatus.DONE).length;
    const totalCancelled = requests.filter(r => r.status === ExamStatus.CANCELLED).length;

    // Distribuição por módulo
    const moduleDistribution = [
      { name: 'CNH do Brasil', value: cnhReqs.length },
      { name: 'Exame Prático CFC', value: cfcReqs.length },
      { name: 'Exame Prático PCD', value: pcdReqs.length },
    ];

    // Status geral
    const statusDistribution = [
      { name: 'Aguardando', value: totalPending },
      { name: 'Agendados', value: totalScheduled },
      { name: 'Realizados', value: totalDone },
      { name: 'Cancelados', value: totalCancelled },
    ];

    // Evolução mensal — últimos 12 meses
    const monthlyData: Record<string, { name: string; sortKey: string; cnh: number; cfc: number; pcd: number }> = {};
    const twelveMonthsAgoForChart = new Date();
    twelveMonthsAgoForChart.setMonth(twelveMonthsAgoForChart.getMonth() - 12);
    [...cnhReqs, ...cfcReqs, ...pcdReqs].forEach(r => {
      const dateStr = (r.scheduledDate || r.createdAt?.split('T')[0]);
      if (!dateStr) return;
      if (new Date(dateStr) < twelveMonthsAgoForChart) return;
      const [year, month] = dateStr.split('-');
      if (!year || !month) return;
      const sortKey = `${year}-${month}`;
      const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('pt-BR', { month: 'short' });
      const label = `${monthName}/${year.substring(2)}`;
      if (!monthlyData[sortKey]) monthlyData[sortKey] = { name: label, sortKey, cnh: 0, cfc: 0, pcd: 0 };
      if (cnhReqs.includes(r)) monthlyData[sortKey].cnh++;
      else if (pcdReqs.includes(r)) monthlyData[sortKey].pcd++;
      else monthlyData[sortKey].cfc++;
    });
    const monthlyChartData = Object.values(monthlyData)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-12);

    return { cnh, cfc, pcd, totalAll, totalSchedules, totalPending, totalScheduled, totalDone, totalCancelled, moduleDistribution, statusDistribution, monthlyChartData };
  }, [requests, schedules]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-500 font-medium">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">Painel de Controle</h2>
          <p className="text-sm text-gray-400 font-medium mt-0.5">Visão geral de todos os módulos do sistema</p>
        </div>
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Atualizado às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Cards Globais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total de Registros" value={stats.totalAll} icon={Users} color="bg-blue-600" />
        <StatCard title="Aguardando Agend." value={stats.totalPending} icon={AlertTriangle} color="bg-yellow-500" />
        <StatCard title="Agendados" value={stats.totalScheduled} icon={Clock} color="bg-indigo-500" />
        <StatCard title="Provas Realizadas" value={stats.totalDone} icon={CheckCircle} color="bg-green-500" />
      </div>

      {/* Resumo por Módulo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ModuleSummary
          title="CNH do Brasil"
          icon={Map}
          color="text-blue-700"
          bgColor="bg-blue-50"
          showBancas={true}
          {...stats.cnh}
        />
        <ModuleSummary
          title="Exame Prático CFC"
          icon={Car}
          color="text-emerald-700"
          bgColor="bg-emerald-50"
          showBancas={false}
          {...stats.cfc}
        />
        <ModuleSummary
          title="Exame Prático PCD"
          icon={Accessibility}
          color="text-purple-700"
          bgColor="bg-purple-50"
          showBancas={false}
          {...stats.pcd}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolução Mensal */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: 340 }}>
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" /> Evolução Mensal por Módulo
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
                <Bar dataKey="cnh" name="CNH do Brasil" fill="#3B82F6" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="cfc" name="CFC" fill="#10B981" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="pcd" name="PCD" fill="#8B5CF6" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: 340 }}>
          <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-500" /> Status Geral
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.statusDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {stats.statusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_STATUS[index % COLORS_STATUS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Distribuição por Módulo */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-black text-gray-700 uppercase tracking-wider mb-5">Distribuição por Módulo</h3>
        <div className="space-y-3">
          {stats.moduleDistribution.map((item, index) => {
            const pct = stats.totalAll > 0 ? Math.round((item.value / stats.totalAll) * 100) : 0;
            return (
              <div key={item.name}>
                <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                  <span>{item.name}</span>
                  <span>{item.value} ({pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: COLORS_PIE[index] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardGeral;
