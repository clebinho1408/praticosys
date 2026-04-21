
import React from 'react';
import { Trophy, AlertTriangle, Users, Accessibility } from 'lucide-react';
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

export const PcdModule: React.FC<ModuleProps> = ({ stats, title }) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total PCD" value={stats.total} icon={Accessibility} color="bg-purple-600" />
        <StatCard title="Taxa de Aprovação" value={`${stats.rate}%`} icon={Trophy} color="bg-green-500" />
        <StatCard title="Aguardando Agend." value={stats.pending} icon={AlertTriangle} color="bg-yellow-500" />
        <StatCard title="Agendados" value={stats.scheduled} icon={Users} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-semibold mb-4">Resultados PCD - {title}</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={stats.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {stats.pieData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-semibold mb-4">Evolução Mensal PCD</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="apto" name="Apto" fill="#10B981" />
              <Bar dataKey="inapto" name="Inapto" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="pt-4">
        <h3 className="text-xl font-bold text-gray-800">Estatísticas de Bancas PCD - {title}</h3>
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
    </div>
  );
};
