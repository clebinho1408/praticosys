
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/mockData';
import { ExamRequest, ExamStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Trophy, 
  XCircle, 
  UserMinus, 
  FileText, 
  Calendar,
  Filter,
  Download
} from 'lucide-react';

const COLORS = ['#10B981', '#EF4444', '#6B7280']; // Apto, Inapto, Faltou

const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string }> = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-black text-gray-900">{value}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  </div>
);

const Reports: React.FC = () => {
  const { reportType } = useParams<{ reportType: string }>();
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    setLoading(true);
    api.getRequests().then(data => {
      let filtered = data.filter(r => r.status === ExamStatus.DONE);
      if (reportType === 'pcd') filtered = filtered.filter(r => r.examType === 'PCD');
      if (reportType === 'cnh' || reportType === 'cfc') filtered = filtered.filter(r => r.examType === 'COMMON');
      setRequests(filtered);
      setLoading(false);
    });
  }, [reportType]);

  const stats = useMemo(() => {
    const total = requests.length;
    const apto = requests.filter(r => r.result === 'APTO').length;
    const inapto = requests.filter(r => r.result === 'INAPTO').length;
    const faltou = requests.filter(r => r.result === 'FALTOU').length;
    const rate = total > 0 ? ((apto / (apto + inapto)) * 100).toFixed(1) : '0';

    const pieData = [
      { name: 'Apto', value: apto },
      { name: 'Inapto', value: inapto },
      { name: 'Faltou', value: faltou }
    ];

    const monthlyData: Record<string, any> = {};
    requests.forEach(r => {
      const date = new Date(r.updatedAt || r.createdAt);
      const month = date.toLocaleString('pt-BR', { month: 'short' });
      if (!monthlyData[month]) monthlyData[month] = { name: month, apto: 0, inapto: 0 };
      if (r.result === 'APTO') monthlyData[month].apto++;
      if (r.result === 'INAPTO') monthlyData[month].inapto++;
    });

    return { 
      total, apto, inapto, faltou, rate, 
      pieData, 
      chartData: Object.values(monthlyData) 
    };
  }, [requests]);

  if (loading) return <div className="p-10 text-center text-gray-500">Gerando relatórios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">
            Relatório de Desempenho - {reportType?.toUpperCase()}
          </h2>
          <p className="text-sm text-gray-500 font-medium">Análise estatística de provas finalizadas.</p>
        </div>
        
        <div className="flex items-center gap-2 print:hidden">
            <div className="flex bg-white border rounded-lg overflow-hidden shadow-sm">
                <input 
                    type="date" 
                    className="px-3 py-2 text-xs border-r focus:outline-none bg-white text-gray-900" 
                    value={dateRange.start}
                    onChange={e => setDateRange({...dateRange, start: e.target.value})}
                />
                <input 
                    type="date" 
                    className="px-3 py-2 text-xs focus:outline-none bg-white text-gray-900" 
                    value={dateRange.end}
                    onChange={e => setDateRange({...dateRange, end: e.target.value})}
                />
            </div>
            <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md transition-colors">
                <Download className="h-4 w-4" />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SummaryCard title="Total de Exames" value={stats.total} icon={FileText} color="bg-blue-600" subtitle="Provas realizadas no período" />
        <SummaryCard title="Taxa de Aprovação" value={`${stats.rate}%`} icon={Trophy} color="bg-green-600" subtitle="Candidatos Aptos / Total" />
        <SummaryCard title="Reprovações" value={stats.inapto} icon={XCircle} color="bg-red-600" subtitle="Candidatos Inaptos" />
        <SummaryCard title="Faltas" value={stats.faltou} icon={UserMinus} color="bg-gray-600" subtitle="Candidatos que não compareceram" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-600" /> Distribuição de Resultados
            </h3>
            <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={stats.pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={8}
                            dataKey="value"
                        >
                            {stats.pieData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                        />
                        <Legend verticalAlign="bottom" iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" /> Evolução Mensal (Aptos vs Inaptos)
            </h3>
            <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="apto" fill="#10B981" radius={[4, 4, 0, 0]} name="Aptos" />
                        <Bar dataKey="inapto" fill="#EF4444" radius={[4, 4, 0, 0]} name="Inaptos" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">Desempenho Detalhado (Recentes)</h3>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-widest">
                      <tr>
                          <th className="px-6 py-4">Candidato</th>
                          <th className="px-6 py-4">Data Finalização</th>
                          <th className="px-6 py-4">Categoria</th>
                          <th className="px-6 py-4">Resultado</th>
                          <th className="px-6 py-4">Observação</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {requests.slice(0, 10).map(req => (
                          <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-gray-800 uppercase">{req.studentName}</td>
                              <td className="px-6 py-4 text-gray-500">{new Date(req.updatedAt).toLocaleDateString()}</td>
                              <td className="px-6 py-4 font-mono font-bold text-blue-600">{req.scheduledCategory || req.intendedCategory}</td>
                              <td className="px-6 py-4">
                                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                      req.result === 'APTO' ? 'bg-green-100 text-green-700' : 
                                      req.result === 'INAPTO' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                      {req.result}
                                  </span>
                              </td>
                              <td className="px-6 py-4 text-gray-400 italic text-xs">{req.observation || '-'}</td>
                          </tr>
                      ))}
                      {requests.length === 0 && (
                          <tr><td colSpan={5} className="p-10 text-center text-gray-400">Nenhum dado para exibir no momento.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default Reports;
