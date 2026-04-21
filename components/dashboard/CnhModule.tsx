
import React from 'react';
import { FileCheck, Trophy, AlertTriangle, Users } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';

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

const COLORS = ['#10B981', '#EF4444', '#6B7280', '#F59E0B'];

interface ModuleProps {
  stats: any;
  title: string;
}

export const CnhModule: React.FC<ModuleProps> = ({ stats, title }) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Finalizados" value={stats.total} icon={FileCheck} color="bg-blue-600" />
        <StatCard title="Taxa de Aprovação" value={`${stats.rate}%`} icon={Trophy} color="bg-green-500" />
        <StatCard title="Aguardando Agend." value={stats.pending} icon={AlertTriangle} color="bg-yellow-500" />
        <StatCard title="Agendados" value={stats.scheduled} icon={Users} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wider">Distribuição de Resultados - {title}</h3>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                <Pie data={stats.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={{ fontSize: 10 }}>
                  {stats.pieData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase tracking-wider">Evolução Mensal (Apto/Inapto)</h3>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                <Bar dataKey="apto" name="Apto" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inapto" name="Inapto" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <h3 className="text-xl font-bold text-gray-800">Estatísticas de Bancas - {title}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalSchedules}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Abertas</p>
            <p className="text-2xl font-black text-blue-700">{stats.open}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-green-500 uppercase tracking-wider mb-1">Concluídas</p>
            <p className="text-2xl font-black text-green-700">{stats.concluded}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-1">Canceladas</p>
            <p className="text-2xl font-black text-red-700">{stats.cancelled}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Fechadas</p>
            <p className="text-2xl font-black text-gray-600">{stats.closed}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
            <h4 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Status das Bancas</h4>
            <div className="flex-1 min-h-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
                    <Pie data={stats.schedulePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={{ fontSize: 10 }}>
                        {stats.schedulePieData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96 flex flex-col">
            <h4 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Ocupação de Vagas</h4>
            <div className="flex-1 min-h-0 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.slotUsageChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Bar dataKey="total" name="Total Vagas" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="used" name="Vagas Ocupadas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};
