
import React from 'react';
import { Trophy, AlertTriangle, Users, School, GraduationCap } from 'lucide-react';
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

export const CfcModule: React.FC<ModuleProps> = ({ stats, title }) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total CFC" value={stats.total} icon={School} color="bg-orange-600" />
        <StatCard title="Taxa de Aprovação" value={`${stats.rate}%`} icon={Trophy} color="bg-green-500" />
        <StatCard title="Aguardando Agend." value={stats.pending} icon={AlertTriangle} color="bg-yellow-500" />
        <StatCard title="Agendados" value={stats.scheduled} icon={Users} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-semibold mb-4">Desempenho das Autoescolas - {title}</h3>
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
          <h3 className="text-lg font-semibold mb-4">Evolução Mensal CFC</h3>
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

      {/* CFC Specific Content Placeholder */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
            <GraduationCap className="h-6 w-6 text-orange-600" />
            <h3 className="text-lg font-semibold">Módulo Prova Prática CFC - Organização em andamento</h3>
        </div>
        <p className="text-gray-500">
            Este módulo está sendo organizado para exibir dados específicos das Autoescolas (CFCs).
            Aqui você poderá ver o ranking de aprovação por escola, instrutores com melhor desempenho e outras métricas exclusivas.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-6">Estatísticas de Bancas CFC - {title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500">Total</p>
                <p className="text-2xl font-bold">{stats.totalSchedules}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-500">Abertas</p>
                <p className="text-2xl font-bold text-blue-700">{stats.open}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm text-green-500">Concluídas</p>
                <p className="text-2xl font-bold text-green-700">{stats.concluded}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-red-500">Canceladas</p>
                <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500">Fechadas</p>
                <p className="text-2xl font-bold text-gray-700">{stats.closed}</p>
            </div>
        </div>
      </div>
    </div>
  );
};
