
import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle2, XCircle, Clock, Car, Filter } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../../services/api';
import { ExamRequest, ExamStatus, ExamType, BancaResult, User } from '../../types';

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

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const [reqs, slots, results] = await Promise.all([
                api.getRequests(),
                api.getScheduleSlots().catch(() => [] as any[]),
                api.getBancaResults()
            ]);
            // Converte schedule-slots para o mesmo formato — igual ao CFCSchedulingCenter
            const slotsAsRequests: any[] = (slots || []).map((s: any) => ({
                ...s,
                studentName: null,
                cpf: null,
                phone: null,
                source: 'SCHOOL',
                _isSlot: true,
            }));
            setRequests([...reqs, ...slotsAsRequests]);
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
    // Filtro idêntico ao isCfcCandidate do CFCSchedulingCenter:
    // usa o campo modulo quando disponível (após backfill), fallback legado caso contrário
    const isCfc = (r: any) => {
        if (r.modulo) return r.modulo === 'CFC';
        // Slots de escala PCD gerados pelo CFC → incluir
        if (r._isSlot && r.schoolId === 'PCD') return true;
        // fallback legado para registros sem modulo
        if (r.examType === ExamType.PCD) return false;
        if (!r.schoolId) return false;
        if (r.schoolId === 'CNH_BRASIL') return !!r._isSlot;
        if (r.schoolId === 'PCD') return false;
        return r.examType === ExamType.COMMON;
    };

    let filteredRequests = requests.filter(isCfc);

    if (user?.role === 'SCHOOL' && user.schoolId) {
        filteredRequests = filteredRequests.filter(r => r.schoolId === user.schoolId);
    }

    // Sem filtro de data nos cards — mostra o mesmo conjunto que o menu Agendamentos
    // (candidatos WAITING_SCHEDULING não têm scheduledDate e seriam excluídos injustamente)

    // Cards principais calculados diretamente dos pedidos
    const total = filteredRequests.length;
    const provasConfirmadas = filteredRequests.filter(r =>
        r.status === ExamStatus.SCHEDULED && r.attendanceConfirmed
    ).length;
    const provasRealizadas = filteredRequests.filter(r =>
        r.status === ExamStatus.DONE ||
        r.status === ExamStatus.WAITING_RESULT ||
        r.status === ExamStatus.RETEST
    ).length;
    const provasCanceladas = filteredRequests.filter(r => r.status === ExamStatus.CANCELLED).length;
    const aguardando = filteredRequests.filter(r => r.status === ExamStatus.WAITING_SCHEDULING).length;

    // Taxa de aprovação — a partir de examHistory + result dos pedidos
    const allResults: string[] = [];
    filteredRequests.forEach(req => {
        if (req.examHistory && Array.isArray(req.examHistory)) {
            req.examHistory.forEach((h: any) => { if (h.result) allResults.push(h.result); });
        }
        if (req.status === ExamStatus.DONE && req.result) {
            allResults.push(req.result);
        }
    });
    const totalAprovados = allResults.filter(r => r === 'APTO').length;
    const totalReprovados = allResults.filter(r => r === 'INAPTO').length;
    const totalFaltas = allResults.filter(r => r === 'FALTOU').length;
    const totalRealizadasParaAprovacao = totalAprovados + totalReprovados;
    const indiceAprovacao = totalRealizadasParaAprovacao > 0
        ? Math.round((totalAprovados / totalRealizadasParaAprovacao) * 100)
        : 0;

    // Índice de vagas — usa bancaResults se disponível, senão usa agendados/total
    const requestIds = filteredRequests.map(r => r.id);
    const requestScheduleIds = filteredRequests.map(r => r.scheduleId).filter(Boolean) as string[];
    const allValidIds = new Set([...requestIds, ...requestScheduleIds]);
    const filteredBancaResults = bancaResults.filter(br => allValidIds.has(br.scheduleId));

    let indiceVagasUtilizadas = 0;
    if (filteredBancaResults.length > 0) {
        let totalVagasDisponiveis = 0;
        let totalVagasUtilizadas = 0;
        filteredBancaResults.forEach(br => {
            totalVagasDisponiveis += br.totalSlots || 0;
            totalVagasUtilizadas += br.usedSlots || 0;
        });
        indiceVagasUtilizadas = totalVagasDisponiveis > 0
            ? Math.round((totalVagasUtilizadas / totalVagasDisponiveis) * 100)
            : 0;
    }

    // Média de realizados por dia com prova
    const scheduledDays = new Set(
        filteredRequests.filter(r => r.scheduledDate).map(r => r.scheduledDate)
    ).size;
    const mediaPorDia = scheduledDays > 0 ? Math.round(provasRealizadas / scheduledDays) : 0;

    const resultDistribution = [
      { name: 'Aptos', value: totalAprovados },
      { name: 'Inaptos', value: totalReprovados },
      { name: 'Faltas', value: totalFaltas },
      { name: 'Cancelados', value: provasCanceladas }
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

    return {
        total,
        provasConfirmadas,
        aguardando,
        provasRealizadas,
        provasCanceladas,
        indiceVagasUtilizadas,
        indiceAprovacao,
        resultDistribution,
        requestTypeDistribution,
        mediaPorDia
    };
  }, [requests, bancaResults, user]);

  if (loading) {
      return <div className="p-10 text-center text-gray-500">Carregando estatísticas...</div>;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-bold">Resumo Geral de Estatísticas</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SummaryCard title="Total de Pedidos" value={stats.total} icon={Calendar} color="bg-blue-600" subtitle={`${stats.aguardando} aguardando agendamento`} />
          <SummaryCard title="Provas Confirmadas" value={stats.provasConfirmadas} icon={Car} color="bg-indigo-600" />
          <SummaryCard title="Provas Realizadas" value={stats.provasRealizadas} icon={CheckCircle2} color="bg-green-600" subtitle={`Média: ${stats.mediaPorDia}/dia`} />
          <SummaryCard title="Provas Canceladas" value={stats.provasCanceladas} icon={XCircle} color="bg-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Car className="h-5 w-5 text-gray-800" /> Índice de Vagas Utilizadas
              </h3>
              <div className="flex flex-col items-center justify-center flex-1">
                  <span className="text-4xl font-black text-blue-600 mb-2">{stats.indiceVagasUtilizadas}%</span>
                  <span className="text-sm text-gray-500 mb-6">
                      {stats.indiceVagasUtilizadas === 0
                          ? 'Resultados de banca não registrados ainda'
                          : 'Das vagas disponíveis foram utilizadas'}
                  </span>
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
                  <span className="text-sm text-gray-500 mb-6">
                      {stats.indiceAprovacao === 0 && stats.provasRealizadas === 0
                          ? 'Nenhum resultado registrado ainda'
                          : 'Dos exames realizados foram aprovados'}
                  </span>
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
                  {stats.resultDistribution.every((d: any) => d.value === 0) ? (
                      <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
                          Nenhum resultado registrado ainda
                      </div>
                  ) : (
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
                                  {stats.resultDistribution.map((_: any, index: number) => (
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
                  )}
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-600" /> Tipos de Prova
              </h3>
              <div className="flex-1 w-full">
                  {stats.requestTypeDistribution.every((d: any) => d.value === 0) ? (
                      <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
                          Nenhum pedido no período
                      </div>
                  ) : (
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
                                  {stats.requestTypeDistribution.map((_: any, index: number) => (
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
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
