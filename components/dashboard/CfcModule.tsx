
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle2, XCircle, Clock, Car, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';
import { ExamRequest, BancaResult, User } from '../../types';

const COLORS = ['#10B981', '#EF4444', '#6B7280', '#F59E0B'];

const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string }> = ({ title, value, icon: Icon, color, subtitle }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
      <div className="flex justify-between items-start relative z-10">
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
};

const CustomLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;
    return (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4">
            {payload.map((entry: any, index: number) => (
                <li key={`item-${index}`} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: entry.color }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    {entry.value}
                </li>
            ))}
        </ul>
    );
};

export const CfcModule: React.FC<{ stats?: any; title?: string; user?: User | null }> = ({ user }) => {
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [bancaResults, setBancaResults] = useState<BancaResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [generalDateStart] = useState(() => {
      const date = new Date();
      date.setMonth(date.getMonth() - 12);
      return date.toISOString().split('T')[0];
  });
  const [generalDateEnd] = useState(() => {
      const date = new Date();
      return date.toISOString().split('T')[0];
  });

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const [reqs, results] = await Promise.all([
                api.getRequests(),
                api.getBancaResults()
            ]);
            setRequests(reqs);
            setBancaResults(results);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    let filteredRequests = requests.filter(r => {
        const isExplicitCnh = r.schoolId === 'CNH_BRASIL';
        const isExplicitPcd = r.schoolId === 'PCD' || r.examType === 'PCD';
        const isOrphan = !r.schoolId;

        // Prova Prática CFC should only include regular school requests
        if (isExplicitCnh || isExplicitPcd || isOrphan) {
            return false;
        }
        return true;
    });
    
    if (user?.role === 'SCHOOL' && user.schoolId) {
        filteredRequests = filteredRequests.filter(r => r.schoolId === user.schoolId);
    }

    if (generalDateStart) {
        filteredRequests = filteredRequests.filter(r => r.scheduledDate && r.scheduledDate >= generalDateStart);
    }
    if (generalDateEnd) {
        filteredRequests = filteredRequests.filter(r => r.scheduledDate && r.scheduledDate <= generalDateEnd);
    }

    const requestIds = filteredRequests.map(r => r.id);
    const requestScheduleIds = filteredRequests.map(r => r.scheduleId).filter(Boolean) as string[];
    const allValidIds = [...requestIds, ...requestScheduleIds];

    const filteredResults = bancaResults.filter(br => allValidIds.includes(br.scheduleId));

    let totalVagasDisponiveis = 0;
    let totalVagasUtilizadas = 0;
    let totalAprovados = 0;
    let totalReprovados = 0;
    let totalFaltas = 0;
    let totalCancelados = 0;
    let provasRealizadas = 0;
    let provasCanceladas = 0;

    filteredResults.forEach(br => {
        totalVagasDisponiveis += br.totalSlots || 0;
        totalVagasUtilizadas += br.usedSlots || 0;
        totalAprovados += br.approved || 0;
        totalReprovados += br.failed || 0;
        totalFaltas += br.absent || 0;
        totalCancelados += br.cancelled || 0;
        provasRealizadas += (br.approved || 0) + (br.failed || 0) + (br.absent || 0);
        provasCanceladas += br.cancelled || 0;
    });

    const agendamentosDoMes = totalVagasUtilizadas;
    const agendamentosConfirmados = totalVagasUtilizadas - provasRealizadas - provasCanceladas;

    const indiceVagasUtilizadas = totalVagasDisponiveis > 0 ? Math.round((totalVagasUtilizadas / totalVagasDisponiveis) * 100) : 0;
    const totalRealizadasParaAprovacao = totalAprovados + totalReprovados;
    const indiceAprovacao = totalRealizadasParaAprovacao > 0 ? Math.round((totalAprovados / totalRealizadasParaAprovacao) * 100) : 0;

    const resultDistribution = [
      { name: 'Aptos', value: totalAprovados },
      { name: 'Inaptos', value: totalReprovados },
      { name: 'Faltas', value: totalFaltas },
      { name: 'Cancelados', value: totalCancelados }
    ];

    let provasFixas = 0;
    let provasExtras = 0;
    let provasReposicao = 0;

    filteredRequests.forEach(req => {
       if (req.requestType === 'FIXA') provasFixas++;
       else if (req.requestType === 'EXTRA') provasExtras++;
       else if (req.requestType === 'REPOSICAO') provasReposicao++;
    });

    const requestTypeDistribution = [
      { name: 'Provas Fixas', value: provasFixas },
      { name: 'Provas Extras', value: provasExtras },
      { name: 'Reposição', value: provasReposicao }
    ];

    const uniqueDays = new Set(filteredResults.map(br => {
        const req = filteredRequests.find(r => r.id === br.scheduleId || r.scheduleId === br.scheduleId);
        return req?.scheduledDate;
    }).filter(Boolean)).size;
    const mediaPorDia = uniqueDays > 0 ? Math.round(provasRealizadas / uniqueDays) : 0;

    return {
        agendamentosDoMes,
        provasRealizadas,
        provasCanceladas,
        agendamentosConfirmados,
        indiceVagasUtilizadas,
        indiceAprovacao,
        resultDistribution,
        requestTypeDistribution,
        mediaPorDia
    };
  }, [requests, bancaResults, generalDateStart, generalDateEnd]);

  if (loading) {
      return <div className="p-10 text-center text-gray-500">Carregando estatísticas...</div>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-bold">Resumo Geral de Estatísticas (Últimos 12 meses)</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard title="Agendamentos do Período" value={stats.agendamentosDoMes} icon={Calendar} color="bg-blue-600" />
          <SummaryCard title="Provas Realizadas" value={stats.provasRealizadas} icon={CheckCircle2} color="bg-green-600" />
          <SummaryCard title="Provas Canceladas" value={stats.provasCanceladas} icon={XCircle} color="bg-red-600" />
          <SummaryCard title="Média por dia" value={stats.mediaPorDia} icon={Clock} color="bg-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Car className="h-5 w-5 text-gray-800" /> Índice de Vagas Utilizadas
              </h3>
              <div className="flex flex-col items-center justify-center flex-1">
                  <span className="text-4xl font-black text-blue-600 mb-2">{stats.indiceVagasUtilizadas}%</span>
                  <span className="text-sm text-gray-500 mb-6">Das vagas disponíveis foram utilizadas</span>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                      <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${Math.min(stats.indiceVagasUtilizadas, 100)}%` }}></div>
                  </div>
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-gray-800" /> Índice de Aprovação
              </h3>
              <div className="flex flex-col items-center justify-center flex-1">
                  <span className="text-4xl font-black text-green-600 mb-2">{stats.indiceAprovacao}%</span>
                  <span className="text-sm text-gray-500 mb-6">Dos exames realizados foram aprovados</span>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                      <div className="bg-green-600 h-4 rounded-full" style={{ width: `${Math.min(stats.indiceAprovacao, 100)}%` }}></div>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-600" /> Distribuição de Resultados
              </h3>
              <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ bottom: 0 }}>
                          <Pie
                              data={stats.resultDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={8}
                              dataKey="value"
                          >
                              {stats.resultDistribution.map((_, index) => (
                                  <Cell 
                                      key={`cell-${index}`} 
                                      fill={COLORS[index % COLORS.length]} 
                                      fillOpacity={0.8}
                                      stroke={COLORS[index % COLORS.length]}
                                      strokeWidth={1}
                                  />
                              ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Legend content={<CustomLegend />} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-600" /> Tipos de Prova
              </h3>
              <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ bottom: 0 }}>
                          <Pie
                              data={stats.requestTypeDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={65}
                              paddingAngle={8}
                              dataKey="value"
                          >
                              {stats.requestTypeDistribution.map((_, index) => (
                                  <Cell 
                                      key={`cell-${index}`} 
                                      fill={['#3B82F6', '#8B5CF6', '#14B8A6'][index]} 
                                      fillOpacity={0.8}
                                      stroke={['#3B82F6', '#8B5CF6', '#14B8A6'][index]}
                                      strokeWidth={1}
                                  />
                              ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Legend content={<CustomLegend />} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>
    </div>
  );
};
