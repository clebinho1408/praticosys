
import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { ExamRequest, ExamStatus, ExamSchedule, SystemSettings, Instructor, BancaResult } from '../types';
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
  Users,
  Layout,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  Car
} from 'lucide-react';

const COLORS = ['#10B981', '#EF4444', '#6B7280', '#F59E0B']; // Apto, Inapto, Faltou, Outros

const SCHEDULE_STATUS_TRANSLATION: Record<string, string> = {
  'OPEN': 'Aberta',
  'CLOSED': 'Fechada',
  'CONCLUDED': 'Concluída',
  'CANCELLED': 'Cancelada'
};

const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string }> = ({ title, value, icon: Icon, color, subtitle }) => {
  const printBgColor = color.includes('blue') ? '#eff6ff' : 
                       color.includes('green') ? '#f0fdf4' : 
                       color.includes('red') ? '#fef2f2' : 
                       color.includes('yellow') ? '#fffbeb' : 
                       color.includes('gray') ? '#f9fafb' : '#ffffff';

  return (
    <div 
      className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-1 print:shadow-none print:border-black print:border relative overflow-hidden"
      style={{ ['--print-bg' as any]: printBgColor }}
    >
      <div className="print:bg-[var(--print-bg)] absolute inset-0 hidden print:block -z-10"></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 print:text-[10px] print:mb-1 print:text-black">{title}</p>
          <h3 className="text-2xl font-black text-gray-900 print:text-xl print:text-black">{value}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-1 print:text-[10px] print:mt-1 print:text-black">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10 print:hidden`}>
          <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </div>
  );
};

const PrintStatsTable: React.FC<{ title: string; data: { label: string; value: string | number; color?: string }[] }> = ({ title, data }) => (
    <div className="hidden print:block mt-4 border border-black rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-3 py-2 font-bold text-xs uppercase border-b border-black text-black">{title}</div>
        <table className="w-full text-xs text-left">
            <tbody className="divide-y divide-black">
                {data.map((item, idx) => (
                    <tr key={idx} style={item.color ? { backgroundColor: `${item.color}15` } : undefined}>
                        <td className="px-3 py-1 font-bold uppercase text-black w-2/3">
                            <div className="flex items-center gap-2">
                                {item.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>}
                                {item.label}
                            </div>
                        </td>
                        <td className="px-3 py-1 text-black text-right font-bold">{item.value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const CustomLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;
    return (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 print:hidden">
            {payload.map((entry: any, index: number) => (
                <li key={`item-${index}`} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: entry.color }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    {entry.value}
                </li>
            ))}
        </ul>
    );
};

type ReportView = 'general-stats' | 'schedules-list' | 'instructors-list' | 'exam-history';

const CFCGeneralStats: React.FC<{
  bancaResults: BancaResult[];
  requests: ExamRequest[];
  schools: any[];
  examiners: any[];
  generalDateStart: string;
  generalDateEnd: string;
  setGeneralDateStart: (date: string) => void;
  setGeneralDateEnd: (date: string) => void;
  settings: SystemSettings | null;
}> = ({ bancaResults, requests, schools, examiners, generalDateStart, generalDateEnd, setGeneralDateStart, setGeneralDateEnd, settings }) => {
  const stats = useMemo(() => {
    let filteredRequests = requests.filter(r => r.examType === 'COMMON' || r.examType === 'PCD');
    
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

    const examinerCounts: Record<string, number> = {};
    const schoolCounts: Record<string, number> = {};

    filteredResults.forEach(br => {
        if (br.schoolId) {
            schoolCounts[br.schoolId] = (schoolCounts[br.schoolId] || 0) + (br.usedSlots || 0);
        }
        
        const req = filteredRequests.find(r => r.id === br.scheduleId || r.scheduleId === br.scheduleId);
        if (req && req.examinerId) {
            examinerCounts[req.examinerId] = (examinerCounts[req.examinerId] || 0) + (br.usedSlots || 0);
        } else {
            examinerCounts['SEM_EXAMINADOR'] = (examinerCounts['SEM_EXAMINADOR'] || 0) + (br.usedSlots || 0);
        }
    });

    const examinerList = Object.entries(examinerCounts).map(([id, count]) => {
        if (id === 'SEM_EXAMINADOR') return { name: 'Sem examinador', count };
        const ex = examiners.find(e => e.id === id);
        return { name: ex ? ex.name : 'Desconhecido', count };
    }).sort((a, b) => b.count - a.count);

    const schoolList = Object.entries(schoolCounts).map(([id, count]) => {
        const sch = schools.find(s => s.id === id);
        return { name: sch ? sch.name : 'Desconhecida', count };
    }).sort((a, b) => b.count - a.count);

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
        examinerList,
        schoolList,
        resultDistribution,
        requestTypeDistribution,
        mediaPorDia
    };
  }, [requests, bancaResults, schools, examiners, generalDateStart, generalDateEnd]);

  return (
    <div className="space-y-6 animate-fadeIn print:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
          <h3 className="text-lg font-bold">Resumo Geral de Estatísticas</h3>
          <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 border rounded-md px-2 bg-white">
                  <input 
                      type="date"
                      className="border-none text-sm p-2 outline-none bg-transparent"
                      value={generalDateStart} 
                      onChange={e => setGeneralDateStart(e.target.value)} 
                  />
                  <span className="text-gray-400">-</span>
                  <input 
                      type="date"
                      className="border-none text-sm p-2 outline-none bg-transparent"
                      value={generalDateEnd} 
                      onChange={e => setGeneralDateEnd(e.target.value)} 
                  />
              </div>
              <button 
                  onClick={() => window.print()} 
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"
              >
                  <Printer className="h-4 w-4" /> Imprimir
              </button>
          </div>
      </div>

      {/* Print Header (Visible only in print) */}
      <div className="hidden print:block border-b-2 border-black mb-4 print:mb-0 print:-mt-6">
          <div className="flex items-center gap-6 border-b-2 border-black pb-4 print:pb-1 print:gap-6">
              {settings?.logoUrl ? (
                  <img src={settings.logoUrl} className="h-16 w-auto print:h-16" />
              ) : (
                  <div className="h-16 w-16 bg-gray-200 flex items-center justify-center text-black font-black text-xs border border-black print:h-16 print:w-16 print:text-xs">LOGO</div>
              )}
              <div>
                  <h1 className="text-xl font-black uppercase tracking-tight text-black print:text-xl">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                  <h2 className="text-2xl font-black uppercase text-black print:text-2xl">ÍNDICES GERAL DE PROVAS PRÁTICAS</h2>
              </div>
          </div>
          <div className="text-center text-xs font-bold uppercase text-black print:text-sm print:py-0.5">
              <span>Data: {new Date(generalDateStart).toLocaleDateString()} até {new Date(generalDateEnd).toLocaleDateString()}</span>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4 print:mt-1 print:mb-1">
          <SummaryCard title="Agendamentos do Mês" value={stats.agendamentosDoMes} icon={Calendar} color="bg-blue-600" />
          <SummaryCard title="Provas Realizadas" value={stats.provasRealizadas} icon={CheckCircle2} color="bg-green-600" />
          <SummaryCard title="Provas Canceladas" value={stats.provasCanceladas} icon={XCircle} color="bg-red-600" />
          <SummaryCard title="Média por dia" value={stats.mediaPorDia} icon={Clock} color="bg-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col print:p-4 print:shadow-none print:border-black print:border">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 print:text-sm print:mb-4">
                  <Car className="h-5 w-5 text-gray-800 print:hidden" /> Índice de Vagas Utilizadas
              </h3>
              <div className="flex flex-col items-center justify-center flex-1">
                  <span className="text-4xl font-black text-blue-600 mb-2 print:text-5xl">{stats.indiceVagasUtilizadas}%</span>
                  <span className="text-sm text-gray-500 mb-6 print:mb-4 print:text-base">Das vagas disponíveis foram utilizadas</span>
                  <div className="w-full bg-gray-200 rounded-full h-4 print:h-4">
                      <div className="bg-blue-600 h-4 rounded-full print:h-4" style={{ width: `${Math.min(stats.indiceVagasUtilizadas, 100)}%` }}></div>
                  </div>
              </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col print:p-4 print:shadow-none print:border-black print:border">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 print:text-sm print:mb-4">
                  <CheckCircle2 className="h-5 w-5 text-gray-800 print:hidden" /> Índice de Aprovação
              </h3>
              <div className="flex flex-col items-center justify-center flex-1">
                  <span className="text-4xl font-black text-green-600 mb-2 print:text-5xl">{stats.indiceAprovacao}%</span>
                  <span className="text-sm text-gray-500 mb-6 print:mb-4 print:text-base">Dos exames realizados foram aprovados</span>
                  <div className="w-full bg-gray-200 rounded-full h-4 print:h-4">
                      <div className="bg-green-600 h-4 rounded-full print:h-4" style={{ width: `${Math.min(stats.indiceAprovacao, 100)}%` }}></div>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96 print:h-auto print:p-4 print:shadow-none print:border-black print:border print:bg-blue-50/30">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 print:text-sm print:mb-4">
                  <Filter className="h-5 w-5 text-blue-600 print:hidden" /> Distribuição de Resultados
              </h3>
              <div className="flex-1 w-full print:h-[120px]">
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
              <PrintStatsTable 
                  title="Dados de Distribuição" 
                  data={stats.resultDistribution.map((d, i) => ({ label: d.name, value: d.value, color: COLORS[i % COLORS.length] }))} 
              />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96 print:h-auto print:p-4 print:shadow-none print:border-black print:border print:bg-blue-50/30">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 print:text-sm print:mb-4">
                  <Filter className="h-5 w-5 text-blue-600 print:hidden" /> Tipos de Prova
              </h3>
              <div className="flex-1 w-full print:h-[120px]">
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
              <PrintStatsTable 
                  title="Dados de Tipos de Prova" 
                  data={stats.requestTypeDistribution.map((d, i) => ({ label: d.name, value: d.value, color: ['#3B82F6', '#8B5CF6', '#14B8A6'][i] }))} 
              />
          </div>
      </div>

      {/* Print Footer */}
      <div className="hidden print:flex fixed bottom-4 left-0 w-full bg-white border-t-2 border-black pt-2 pb-4 px-10 justify-between items-center text-[10px] font-black text-black">
          <div className="uppercase">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
          <div>IMPRESSÃO: {new Date().toLocaleString()}</div>
      </div>
    </div>
  );
};

const Reports: React.FC<{ reportTypeProp?: string }> = ({ reportTypeProp }) => {
  const { reportType: paramReportType } = useParams<{ reportType: string }>();
  const reportType = reportTypeProp || paramReportType;
  const [activeView, setActiveView] = useState<ReportView>('general-stats');
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [bancaResults, setBancaResults] = useState<BancaResult[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [examiners, setExaminers] = useState<any[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Date states for General Stats
  const [generalDateStart, setGeneralDateStart] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
  });
  const [generalDateEnd, setGeneralDateEnd] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Show future schedules by default
      return date.toISOString().split('T')[0];
  });

  // Filters for Instructors List
  const [instructorSearch, setInstructorSearch] = useState<string>('');

  // Filters for Exam History
  const [examHistorySearch, setExamHistorySearch] = useState<string>('');
  const [examHistoryResultFilter, setExamHistoryResultFilter] = useState<string>('ALL');
  const [examHistorySchoolFilter, setExamHistorySchoolFilter] = useState<string>('ALL');
  const [examHistoryExaminerFilter, setExamHistoryExaminerFilter] = useState<string>('ALL');
  const [examHistoryDateStart, setExamHistoryDateStart] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
  });
  const [examHistoryDateEnd, setExamHistoryDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Filters for Schedules List
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>('ALL');
  const [schoolSearch, setSchoolSearch] = useState<string>('');
  const [scheduleDateStart, setScheduleDateStart] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
  });
  const [scheduleDateEnd, setScheduleDateEnd] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Show future schedules by default
      return date.toISOString().split('T')[0];
  });

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const [reqs, scheds, instrs, sysSettings, results, schs, exams] = await Promise.all([
                api.getRequests(),
                api.getSchedules(),
                api.getInstructorsAsync(),
                api.getSettings(),
                api.getBancaResults(),
                api.getSchoolsAsync(),
                api.getExaminersAsync()
            ]);

            let filteredReqs = reqs;
            let filteredScheds = scheds;

            if (reportType === 'pcd') {
                filteredReqs = filteredReqs.filter(r => r.examType === 'PCD');
                filteredScheds = filteredScheds.filter(s => s.type === 'PCD');
            } else if (reportType === 'cfc') {
                // Prova Prática CFC includes both COMMON and PCD
                filteredReqs = filteredReqs.filter(r => r.examType === 'COMMON' || r.examType === 'PCD');
                filteredScheds = filteredScheds.filter(s => s.type === 'COMMON' || s.type === 'PCD');
            } else if (reportType === 'cnh') {
                filteredReqs = filteredReqs.filter(r => r.examType === 'COMMON');
                filteredScheds = filteredScheds.filter(s => s.type === 'COMMON');
            }

            setRequests(filteredReqs);
            setSchedules(filteredScheds);
            setInstructors(instrs);
            setSettings(sysSettings);
            setBancaResults(results);
            setSchools(schs);
            setExaminers(exams);
        } catch (error) {
            console.error("Error fetching report data", error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [reportType]);

  // 0. Flattened Exam History (Source of Truth for Results)
  const allExamResults = useMemo(() => {
      const list: any[] = [];
      requests.forEach(req => {
          // 1. Add past history
          if (req.examHistory && Array.isArray(req.examHistory)) {
              req.examHistory.forEach((h: any) => {
                  const schedule = schedules.find(s => s.id === h.scheduleId);
                  list.push({
                      id: `${req.id}-${h.date}-${h.time}`,
                      studentName: req.socialName || req.studentName,
                      date: schedule ? schedule.date : h.date,
                      result: h.result,
                      category: h.category || req.intendedCategory,
                      scheduleId: h.scheduleId
                  });
              });
          }

          // 2. Add current exam if finished
          if (req.status === ExamStatus.DONE && req.result) {
               const date = req.scheduledDate || (req.updatedAt ? req.updatedAt.split('T')[0] : req.createdAt.split('T')[0]);
               // Avoid duplicates if history already contains this date
               const isDuplicate = req.examHistory?.some((h: any) => {
                   const schedule = schedules.find(s => s.id === h.scheduleId);
                   const hDate = schedule ? schedule.date : h.date;
                   return hDate === date;
               });
               if (!isDuplicate) {
                   list.push({
                       id: req.id,
                       studentName: req.socialName || req.studentName,
                       date: date,
                       result: req.result,
                       category: req.scheduledCategory || req.intendedCategory,
                       scheduleId: req.scheduleId
                   });
               }
          }
      });
      return list;
  }, [requests]);

  // 1. Índice de Reprovação e Aprovação
  const approvalStats = useMemo(() => {
    if (reportType === 'cfc') {
        // Use BancaResult for CFC
        let filteredResults = bancaResults;
        
        // Filter by date using associated schedule
        filteredResults = filteredResults.filter(br => {
            const sch = schedules.find(s => s.id === br.scheduleId);
            if (!sch) return false;
            if (generalDateStart && sch.date < generalDateStart) return false;
            if (generalDateEnd && sch.date > generalDateEnd) return false;
            return true;
        });

        let apto = 0;
        let inapto = 0;
        let faltou = 0;
        let cancelado = 0;
        
        const monthlyData: Record<string, { name: string, sortKey: string, apto: number, inapto: number }> = {};

        filteredResults.forEach(br => {
            apto += br.approved || 0;
            inapto += br.failed || 0;
            faltou += br.absent || 0;
            cancelado += br.cancelled || 0;

            const sch = schedules.find(s => s.id === br.scheduleId);
            if (sch && sch.date) {
                const dateParts = sch.date.split('-');
                const year = dateParts[0];
                const month = dateParts[1];
                const sortKey = `${year}-${month}`;
                const monthIndex = parseInt(month) - 1;
                
                let monthName = '';
                try {
                    monthName = new Date(parseInt(year), monthIndex, 1).toLocaleString('pt-BR', { month: 'short' });
                } catch (e) {
                    monthName = `${month}/${year}`;
                }
                const label = `${monthName}/${year.substr(2)}`;

                if (!monthlyData[sortKey]) monthlyData[sortKey] = { name: label, sortKey, apto: 0, inapto: 0 };
                monthlyData[sortKey].apto += (br.approved || 0);
                monthlyData[sortKey].inapto += (br.failed || 0);
            }
        });

        const total = apto + inapto + faltou;
        const rate = total > 0 ? ((apto / total) * 100).toFixed(1) : '0';
        const pieData = [
            { name: 'Apto', value: apto },
            { name: 'Inapto', value: inapto },
            { name: 'Faltou', value: faltou }
        ];
        const chartData = Object.values(monthlyData).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

        return { total, apto, inapto, faltou, rate, pieData, chartData };
    }

    let filtered = allExamResults;

    if (generalDateStart) {
        filtered = filtered.filter(r => r.date >= generalDateStart);
    }

    if (generalDateEnd) {
        filtered = filtered.filter(r => r.date <= generalDateEnd);
    }

    const total = filtered.length;
    const apto = filtered.filter(r => r.result === 'APTO').length;
    const inapto = filtered.filter(r => r.result === 'INAPTO').length;
    const faltou = filtered.filter(r => r.result === 'FALTOU').length;
    const rate = total > 0 ? ((apto / total) * 100).toFixed(1) : '0';

    const pieData = [
      { name: 'Apto', value: apto },
      { name: 'Inapto', value: inapto },
      { name: 'Faltou', value: faltou }
    ];

    // Improved Grouping Logic (YYYY-MM sortable)
    const monthlyData: Record<string, { name: string, sortKey: string, apto: number, inapto: number }> = {};
    
    filtered.forEach(r => {
      if (!r.date) return;

      let dateStr = '';
      try {
          // Ensure r.date is a string
          const rawDate = String(r.date);
          dateStr = rawDate.split('T')[0];
      } catch (e) {
          return;
      }

      const parts = dateStr.split('-');
      if (parts.length < 2) return; // Invalid format

      const year = parts[0];
      const month = parts[1];
      
      const sortKey = `${year}-${month}`;
      const monthIndex = parseInt(month) - 1;
      
      if (isNaN(monthIndex)) return;

      let monthName = '';
      try {
        monthName = new Date(parseInt(year), monthIndex, 1).toLocaleString('pt-BR', { month: 'short' });
      } catch (e) {
        monthName = `${month}/${year}`;
      }
      
      const label = `${monthName}/${year.substr(2)}`;

      if (!monthlyData[sortKey]) monthlyData[sortKey] = { name: label, sortKey, apto: 0, inapto: 0 };
      if (r.result === 'APTO') monthlyData[sortKey].apto++;
      if (r.result === 'INAPTO') monthlyData[sortKey].inapto++;
    });

    const chartData = Object.values(monthlyData).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return { total, apto, inapto, faltou, rate, pieData, chartData };
  }, [allExamResults, generalDateStart, generalDateEnd]);

  // 3. Índice de Bancas
  const scheduleStats = useMemo(() => {
      let filteredSchedules = schedules;

      if (generalDateStart) {
          filteredSchedules = filteredSchedules.filter(s => s.date >= generalDateStart);
      }

      if (generalDateEnd) {
          filteredSchedules = filteredSchedules.filter(s => s.date <= generalDateEnd);
      }

      const total = filteredSchedules.length;
      const open = filteredSchedules.filter(s => s.status === 'OPEN').length;
      const concluded = filteredSchedules.filter(s => s.status === 'CONCLUDED').length;
      const cancelled = filteredSchedules.filter(s => s.status === 'CANCELLED').length;
      const closed = filteredSchedules.filter(s => s.status === 'CLOSED').length;

      const pieData = [
          { name: 'Abertas', value: open },
          { name: 'Concluídas', value: concluded },
          { name: 'Canceladas', value: cancelled },
          { name: 'Fechadas', value: closed }
      ];

      return { total, open, concluded, cancelled, closed, pieData };
  }, [schedules, generalDateStart, generalDateEnd]);

  // 4. Índice de Ocupação de Vagas (Novo)
  const slotUsageStats = useMemo(() => {
      const monthlyData: Record<string, { name: string, sortKey: string, total: number, used: number }> = {};
      
      let filteredSchedules = schedules;

      if (generalDateStart) {
          filteredSchedules = filteredSchedules.filter(s => s.date >= generalDateStart);
      }

      if (generalDateEnd) {
          filteredSchedules = filteredSchedules.filter(s => s.date <= generalDateEnd);
      }

      // Sort schedules by date
      const sortedSchedules = [...filteredSchedules].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      sortedSchedules.forEach(sch => {
          const date = new Date(sch.date);
          const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthName = date.toLocaleString('pt-BR', { month: 'short' });
          const label = `${monthName}/${date.getFullYear().toString().substr(2)}`;
          
          if (!monthlyData[sortKey]) monthlyData[sortKey] = { name: label, sortKey, total: 0, used: 0 };
          
          if (reportType === 'cfc') {
              const results = bancaResults.filter(br => br.scheduleId === sch.id);
              results.forEach(br => {
                  monthlyData[sortKey].total += (br.totalSlots || 0);
                  monthlyData[sortKey].used += (br.usedSlots || 0);
              });
          } else {
              const totalSlots = (sch.maxSlotsA || 0) + (sch.maxSlotsB || 0);
              const usedSlots = requests.filter(r => r.scheduleId === sch.id).length;
              
              monthlyData[sortKey].total += totalSlots;
              monthlyData[sortKey].used += usedSlots;
          }
      });
      
      return Object.values(monthlyData).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [schedules, requests, bancaResults, reportType, generalDateStart, generalDateEnd]);

  // Logic for Instructors List
  const filteredInstructors = useMemo(() => {
    let filtered = instructors;

    if (instructorSearch) {
        const searchLower = instructorSearch.toLowerCase();
        filtered = filtered.filter(i => 
            i.name.toLowerCase().includes(searchLower) || 
            i.cpf.includes(searchLower)
        );
    }

    // Sort by name
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [instructors, instructorSearch]);

  // Logic for Examiners List (CFC)
  const filteredExaminers = useMemo(() => {
    let filtered = examiners;

    if (instructorSearch) {
        const searchLower = instructorSearch.toLowerCase();
        filtered = filtered.filter(e => 
            e.name.toLowerCase().includes(searchLower) || 
            (e.registrationNumber && e.registrationNumber.toLowerCase().includes(searchLower))
        );
    }

    // Sort by name
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [examiners, instructorSearch]);

  // Logic for Schools List (CFC)
  const filteredSchools = useMemo(() => {
    let filtered = schools;

    if (schoolSearch) {
        const searchLower = schoolSearch.toLowerCase();
        filtered = filtered.filter(s => 
            s.name.toLowerCase().includes(searchLower) || 
            (s.email && s.email.toLowerCase().includes(searchLower)) ||
            (s.phone && s.phone.includes(searchLower))
        );
    }

    // Sort by name
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [schools, schoolSearch]);

  // Grouping logic for Schedules List
  const groupedSchedules = useMemo(() => {
    const groups: Record<string, Record<string, ExamSchedule[]>> = {};
    
    // Apply Filters
    let filtered = schedules;

    if (scheduleStatusFilter !== 'ALL') {
        filtered = filtered.filter(s => s.status === scheduleStatusFilter);
    }

    if (scheduleDateStart) {
        filtered = filtered.filter(s => new Date(s.date) >= new Date(scheduleDateStart));
    }

    if (scheduleDateEnd) {
        filtered = filtered.filter(s => new Date(s.date) <= new Date(scheduleDateEnd));
    }

    // Sort schedules by date
    const sortedSchedules = [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedSchedules.forEach(sch => {
        const status = sch.status;
        const code = sch.code ? `#${sch.code}` : 'Sem Código';

        if (!groups[status]) groups[status] = {};
        if (!groups[status][code]) groups[status][code] = [];
        
        groups[status][code].push(sch);
    });
    
    return groups;
  }, [schedules, scheduleStatusFilter, scheduleDateStart, scheduleDateEnd]);

  // Logic for Exam History
  const examHistoryList = useMemo(() => {
      const list: any[] = [];
      requests.forEach(req => {
          const exameLabel = req.intendedCategory?.includes('C') || req.intendedCategory?.includes('D') || req.intendedCategory?.includes('E') ? 'Mudança Categoria' : '1º Habilitação';
          
          // 1. Add past history
          if (req.examHistory && Array.isArray(req.examHistory)) {
              req.examHistory.forEach((h: any) => {
                  const schedule = schedules.find(s => s.id === h.scheduleId);
                  list.push({
                      id: `${req.id}-${h.date}-${h.time}`,
                      studentName: req.socialName || req.studentName,
                      cpf: req.cpf,
                      date: schedule ? schedule.date : h.date,
                      time: schedule ? schedule.time : (h.time || '00:00'),
                      result: h.result,
                      category: h.category || req.intendedCategory || 'N/A',
                      scheduleCode: h.scheduleCode || (schedule?.code ? `#${schedule.code}` : 'Sem Banca'),
                      type: 'HISTORY',
                      schoolId: req.schoolId,
                      examinerIds: schedule?.examinerIds || [],
                      examType: req.examType,
                      requestType: req.requestType,
                      exameLabel: exameLabel
                  });
              });
          }

          // 2. Add current exam if finished or cancelled
          if ((req.status === 'DONE' && req.result) || req.status === 'CANCELLED') {
               const schedule = schedules.find(s => s.id === req.scheduleId);
               const date = schedule ? schedule.date : (req.scheduledDate || (req.updatedAt ? req.updatedAt.split('T')[0] : req.createdAt.split('T')[0]));
               
               // Avoid duplicates if history already contains this date
               const isDuplicate = req.examHistory?.some((h: any) => {
                   const schedule = schedules.find(s => s.id === h.scheduleId);
                   const hDate = schedule ? schedule.date : h.date;
                   return hDate === date;
               });
               if (!isDuplicate) {
                   list.push({
                       id: req.id,
                       studentName: req.socialName || req.studentName,
                       cpf: req.cpf,
                       date: date,
                       time: schedule ? schedule.time : (req.scheduledTime || '00:00'),
                       result: req.status === 'CANCELLED' ? 'CANCELADO' : req.result,
                       category: req.scheduledCategory || req.intendedCategory || 'N/A',
                       scheduleCode: schedule?.code ? `#${schedule.code}` : 'Sem Banca',
                       type: 'CURRENT',
                       schoolId: req.schoolId,
                       examinerIds: schedule?.examinerIds || [],
                       examType: req.examType,
                       requestType: req.requestType,
                       exameLabel: exameLabel
                   });
               }
          }
      });
      return list;
  }, [requests, schedules]);

  const groupedExamHistory = useMemo(() => {
      const groups: Record<string, Record<string, any[]>> = {};
      
      let filtered = examHistoryList;

      if (examHistoryDateStart) {
          filtered = filtered.filter(i => new Date(i.date) >= new Date(examHistoryDateStart));
      }
      if (examHistoryDateEnd) {
          filtered = filtered.filter(i => new Date(i.date) <= new Date(examHistoryDateEnd));
      }
      if (examHistorySearch) {
          const lower = examHistorySearch.toLowerCase();
          filtered = filtered.filter(i => 
              (i.studentName && i.studentName.toLowerCase().includes(lower)) || 
              (i.cpf && i.cpf.includes(lower)) || 
              (i.scheduleCode && i.scheduleCode.toLowerCase().includes(lower)) ||
              (i.requestType && i.requestType.toLowerCase().includes(lower)) ||
              (i.exameLabel && i.exameLabel.toLowerCase().includes(lower)) ||
              (i.examType && i.examType.toLowerCase().includes(lower))
          );
      }
      if (examHistoryResultFilter !== 'ALL') {
          filtered = filtered.filter(i => i.result === examHistoryResultFilter);
      }
      if (examHistorySchoolFilter !== 'ALL') {
          filtered = filtered.filter(i => i.schoolId === examHistorySchoolFilter);
      }
      if (examHistoryExaminerFilter !== 'ALL') {
          filtered = filtered.filter(i => i.examinerIds && i.examinerIds.includes(examHistoryExaminerFilter));
      }

      // Sort by Date DESC
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      filtered.forEach(item => {
          const code = item.scheduleCode;
          const category = item.category;

          if (!groups[code]) groups[code] = {};
          if (!groups[code][category]) groups[code][category] = [];
          
          groups[code][category].push(item);
      });

      return groups;
  }, [examHistoryList, examHistoryDateStart, examHistoryDateEnd, examHistorySearch, examHistoryResultFilter, examHistorySchoolFilter, examHistoryExaminerFilter]);

  const groupedExamHistoryCfc = useMemo(() => {
      const groups: Record<string, Record<string, any[]>> = {
          'Provas Realizadas': {},
          'Provas Canceladas': {}
      };
      
      let filtered = examHistoryList;

      if (examHistoryDateStart) {
          filtered = filtered.filter(i => new Date(i.date) >= new Date(examHistoryDateStart));
      }
      if (examHistoryDateEnd) {
          filtered = filtered.filter(i => new Date(i.date) <= new Date(examHistoryDateEnd));
      }
      if (examHistorySearch) {
          const lower = examHistorySearch.toLowerCase();
          filtered = filtered.filter(i => 
              (i.requestType && i.requestType.toLowerCase().includes(lower)) ||
              (i.exameLabel && i.exameLabel.toLowerCase().includes(lower)) ||
              (i.examType && i.examType.toLowerCase().includes(lower))
          );
      }
      if (examHistorySchoolFilter !== 'ALL') {
          filtered = filtered.filter(i => i.schoolId === examHistorySchoolFilter);
      }
      if (examHistoryExaminerFilter !== 'ALL') {
          filtered = filtered.filter(i => i.examinerIds && i.examinerIds.includes(examHistoryExaminerFilter));
      }

      // Sort by Date DESC
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      filtered.forEach(item => {
          const statusGroup = item.result === 'CANCELADO' ? 'Provas Canceladas' : 'Provas Realizadas';
          const schoolName = schools.find(s => s.id === item.schoolId)?.name || 'Sem Autoescola';

          if (!groups[statusGroup][schoolName]) groups[statusGroup][schoolName] = [];
          
          groups[statusGroup][schoolName].push(item);
      });

      // Remove empty groups
      if (Object.keys(groups['Provas Realizadas']).length === 0) delete groups['Provas Realizadas'];
      if (Object.keys(groups['Provas Canceladas']).length === 0) delete groups['Provas Canceladas'];

      return groups;
  }, [examHistoryList, examHistoryDateStart, examHistoryDateEnd, examHistorySchoolFilter, examHistoryExaminerFilter, schools, examHistorySearch]);

  if (loading) return <div className="p-10 text-center text-gray-500">Gerando relatórios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">
            RELATÓRIOS - {reportType?.toUpperCase()}
          </h2>
          <p className="text-lg text-gray-500 font-medium">Selecione o tipo de relatório abaixo.</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-1 print:hidden">
          <button 
            onClick={() => setActiveView('general-stats')}
            className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeView === 'general-stats' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
          >
              Índice Geral
          </button>
          <button 
            onClick={() => setActiveView('exam-history')}
            className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeView === 'exam-history' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
          >
              Histórico de Provas
          </button>
          <button 
            onClick={() => setActiveView('schedules-list')}
            className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeView === 'schedules-list' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
          >
              {reportType === 'cfc' ? 'Lista de Autoescolas' : 'Lista de Bancas'}
          </button>
          <button 
            onClick={() => setActiveView('instructors-list')}
            className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeView === 'instructors-list' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
          >
              {reportType === 'cfc' ? 'Lista de Examinadores' : 'Lista de Instrutores'}
          </button>
      </div>

      {/* VIEW: Índice Geral (Unificado) */}
      {activeView === 'general-stats' && (
        reportType === 'cfc' ? (
          <CFCGeneralStats 
            bancaResults={bancaResults}
            requests={requests}
            schools={schools}
            examiners={examiners}
            generalDateStart={generalDateStart}
            generalDateEnd={generalDateEnd}
            setGeneralDateStart={setGeneralDateStart}
            setGeneralDateEnd={setGeneralDateEnd}
            settings={settings}
          />
        ) : (
          <>
            <div className="space-y-6 animate-fadeIn print:space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                <h3 className="text-lg font-bold">Resumo Geral de Estatísticas</h3>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 border rounded-md px-2 bg-white">
                        <input 
                            type="date"
                            className="border-none text-sm p-2 outline-none bg-transparent"
                            value={generalDateStart} 
                            onChange={e => setGeneralDateStart(e.target.value)} 
                        />
                        <span className="text-gray-400">-</span>
                        <input 
                            type="date"
                            className="border-none text-sm p-2 outline-none bg-transparent"
                            value={generalDateEnd} 
                            onChange={e => setGeneralDateEnd(e.target.value)} 
                        />
                    </div>
                    <button 
                        onClick={() => window.print()} 
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"
                    >
                        <Printer className="h-4 w-4" /> Imprimir
                    </button>
                </div>
            </div>

            {/* Print Header (Visible only in print) */}
            <div className="hidden print:block border-b-2 border-black mb-4 print:mb-0 print:-mt-6">
                <div className="flex items-center gap-6 border-b-2 border-black pb-4 print:pb-1 print:gap-6">
                    {settings?.logoUrl ? (
                        <img src={settings.logoUrl} className="h-16 w-auto print:h-16" />
                    ) : (
                        <div className="h-16 w-16 bg-gray-200 flex items-center justify-center text-black font-black text-xs border border-black print:h-16 print:w-16 print:text-xs">LOGO</div>
                    )}
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-black print:text-xl">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                        <h2 className="text-2xl font-black uppercase text-black print:text-2xl">ÍNDICES GERAL DE PROVAS PRÁTICAS</h2>
                    </div>
                </div>
                <div className="text-center text-xs font-bold uppercase text-black print:text-sm print:py-0.5">
                    <span>Data: {new Date(generalDateStart).toLocaleDateString()} até {new Date(generalDateEnd).toLocaleDateString()}</span>
                </div>
            </div>

            <div className="space-y-4 print:space-y-2 print:mt-1 print:mb-1">
                <h3 className="text-lg font-bold print:text-sm print:mb-1">Estatísticas de Aprovação</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-1">
                    <SummaryCard title="Total Finalizados" value={approvalStats.total} icon={FileText} color="bg-blue-600" subtitle="Provas realizadas" />
                    <SummaryCard title="Taxa de Aprovação" value={`${approvalStats.rate}%`} icon={Trophy} color="bg-green-600" subtitle="Candidatos Aptos" />
                    <SummaryCard title="Reprovações" value={approvalStats.inapto} icon={XCircle} color="bg-red-600" subtitle="Candidatos Inaptos" />
                    <SummaryCard title="Faltas" value={approvalStats.faltou} icon={UserMinus} color="bg-gray-600" subtitle="Não compareceram" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-1 print:h-auto">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96 print:h-auto print:p-1 print:shadow-none print:border-black print:border print:bg-blue-50/30">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 print:text-xs print:mb-1">
                            <Filter className="h-5 w-5 text-blue-600 print:hidden" /> Distribuição de Resultados
                        </h3>
                        <div className="flex-1 w-full print:h-[90px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ bottom: 20 }}>
                                    <Pie
                                        data={approvalStats.pieData}
                                        cx="50%"
                                        cy="40%"
                                        innerRadius={45}
                                        outerRadius={65}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {approvalStats.pieData.map((_, index) => (
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
                        <PrintStatsTable 
                            title="Dados de Distribuição" 
                            data={approvalStats.pieData.map((d, i) => ({ label: d.name, value: d.value, color: COLORS[i % COLORS.length] }))} 
                        />
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96 print:h-auto print:p-1 print:shadow-none print:border-black print:border print:bg-blue-50/30">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 print:text-xs print:mb-1">
                            <Calendar className="h-5 w-5 text-blue-600 print:hidden" /> Evolução Mensal
                        </h3>
                        <div className="flex-1 w-full print:h-[90px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={approvalStats.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#000', fontSize: 10}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#000', fontSize: 10}} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="apto" fill="#10B981" radius={[4, 4, 0, 0]} name="Aptos" />
                                    <Bar dataKey="inapto" fill="#EF4444" radius={[4, 4, 0, 0]} name="Inaptos" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <PrintStatsTable 
                            title="Dados Mensais" 
                            data={approvalStats.chartData.map(d => ({ label: d.name, value: `Aptos: ${d.apto} | Inaptos: ${d.inapto}`, color: '#3B82F6' }))} 
                        />
                    </div>
                </div>
            </div>

            <div className="border-t pt-6 mt-10 print:mt-1 print:pt-1 print:border-black">
                <h3 className="text-lg font-bold mb-4 print:text-sm print:mb-1">Estatísticas de Bancas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-1">
                    <SummaryCard title="Total de Bancas" value={scheduleStats.total} icon={Layout} color="bg-blue-600" />
                    <SummaryCard title="Realizadas" value={scheduleStats.concluded} icon={Trophy} color="bg-green-600" />
                    <SummaryCard title="Canceladas" value={scheduleStats.cancelled} icon={XCircle} color="bg-red-600" />
                    <SummaryCard title="Abertas" value={scheduleStats.open} icon={Calendar} color="bg-yellow-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 print:grid-cols-2 print:gap-1 print:mt-1 print:h-auto">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96 print:h-auto print:p-1 print:shadow-none print:border-black print:border print:bg-blue-50/30">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 print:text-xs print:mb-1">
                            <Filter className="h-5 w-5 text-blue-600 print:hidden" /> Status das Bancas
                        </h3>
                        <div className="flex-1 w-full print:h-[90px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ bottom: 20 }}>
                                    <Pie
                                        data={scheduleStats.pieData}
                                        cx="50%"
                                        cy="40%"
                                        innerRadius={45}
                                        outerRadius={65}
                                        paddingAngle={8}
                                        dataKey="value"
                                    >
                                        {scheduleStats.pieData.map((_, index) => (
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
                        <PrintStatsTable 
                            title="Dados de Status" 
                            data={scheduleStats.pieData.map((d, i) => ({ label: d.name, value: d.value, color: COLORS[i % COLORS.length] }))} 
                        />
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-96 print:h-auto print:p-1 print:shadow-none print:border-black print:border print:bg-blue-50/30">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 print:text-xs print:mb-1">
                            <Users className="h-5 w-5 text-blue-600 print:hidden" /> Ocupação de Vagas
                        </h3>
                        <div className="flex-1 w-full print:h-[90px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={slotUsageStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#000', fontSize: 10}} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#000', fontSize: 10}} />
                                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="total" fill="#E5E7EB" radius={[4, 4, 0, 0]} name="Vagas Totais" />
                                    <Bar dataKey="used" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Vagas Utilizadas" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <PrintStatsTable 
                            title="Dados de Ocupação" 
                            data={slotUsageStats.map(d => ({ label: d.name, value: `Total: ${d.total} | Uso: ${d.used}`, color: '#3B82F6' }))} 
                        />
                    </div>
                </div>
            </div>
            </div>

            {/* Print Footer (Visible only in print) */}
            <div className="hidden print:flex fixed bottom-4 left-0 w-full bg-white border-t-2 border-black pt-2 pb-4 px-10 justify-between items-center text-[10px] font-black text-black">
                <div className="uppercase">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                <div>IMPRESSÃO: {new Date().toLocaleString()}</div>
            </div>
          </>
        )
      )}

      {/* VIEW: Histórico de Provas */}
      {activeView === 'exam-history' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn print:shadow-none print:border-none print:rounded-none print:overflow-visible print:animate-none print:bg-transparent">
              <div className="p-6 border-b border-gray-100 flex flex-wrap items-center gap-4 print:hidden">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                      <input 
                          type="text" 
                          placeholder={reportType === 'cfc' ? "Buscar por Tipo ou Exame..." : "Buscar por Nome, CPF, Banca, Tipo ou Exame..."} 
                          className="border rounded-md px-4 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]"
                          value={examHistorySearch}
                          onChange={e => setExamHistorySearch(e.target.value)}
                      />
                      {reportType !== 'cfc' && (
                          <select 
                              className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                              value={examHistoryResultFilter}
                              onChange={e => setExamHistoryResultFilter(e.target.value)}
                          >
                              <option value="ALL">Todos Resultados</option>
                              <option value="APTO">Apto</option>
                              <option value="INAPTO">Inapto</option>
                              <option value="FALTOU">Faltou</option>
                          </select>
                      )}
                      {reportType === 'cfc' && (
                          <>
                              <select 
                                  className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                  value={examHistorySchoolFilter}
                                  onChange={e => setExamHistorySchoolFilter(e.target.value)}
                              >
                                  <option value="ALL">Todas Autoescolas</option>
                                  {schools.map(school => (
                                      <option key={school.id} value={school.id}>{school.name}</option>
                                  ))}
                              </select>
                              <select 
                                  className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                  value={examHistoryExaminerFilter}
                                  onChange={e => setExamHistoryExaminerFilter(e.target.value)}
                              >
                                  <option value="ALL">Todos Examinadores</option>
                                  {examiners.map(examiner => (
                                      <option key={examiner.id} value={examiner.id}>{examiner.name}</option>
                                  ))}
                              </select>
                          </>
                      )}
                      
                      <div className="flex items-center gap-2 border rounded-md px-2 bg-white">
                          <input 
                              type="date"
                              className="border-none text-sm p-2 outline-none bg-transparent"
                              value={examHistoryDateStart} 
                              onChange={e => setExamHistoryDateStart(e.target.value)} 
                          />
                          <span className="text-gray-400">-</span>
                          <input 
                              type="date"
                              className="border-none text-sm p-2 outline-none bg-transparent"
                              value={examHistoryDateEnd} 
                              onChange={e => setExamHistoryDateEnd(e.target.value)} 
                          />
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <button 
                          onClick={() => window.print()} 
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"
                      >
                          <Printer className="h-4 w-4" /> Imprimir
                      </button>
                  </div>
              </div>

              {/* Print Header (Visible only in print) */}
              <div className="hidden print:block border-b-2 border-black mb-4 print:mb-0 print:-mt-6">
                  <div className="flex items-center gap-6 border-b-2 border-black pb-4 print:pb-1 print:gap-6">
                      {settings?.logoUrl ? (
                          <img src={settings.logoUrl} className="h-16 w-auto print:h-16" />
                      ) : (
                          <div className="h-16 w-16 bg-gray-200 flex items-center justify-center text-black font-black text-xs border border-black print:h-16 print:w-16 print:text-xs">LOGO</div>
                      )}
                      <div>
                          <h1 className="text-xl font-black uppercase tracking-tight text-black print:text-xl">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                          <h2 className="text-2xl font-black uppercase text-black print:text-2xl">{reportType === 'cfc' ? 'HISTÓRICO DE PROVAS PRÁTICAS' : 'HISTÓRICO DE PROVAS'}</h2>
                      </div>
                  </div>
                  <div className="text-center text-xs font-bold uppercase text-black print:text-sm print:py-0.5">
                      <span>Data: {new Date(examHistoryDateStart).toLocaleDateString()} até {new Date(examHistoryDateEnd).toLocaleDateString()}</span>
                  </div>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full">
                      <tbody>
                          <tr>
                              <td>
                                  {reportType === 'cfc' ? (
                                      Object.keys(groupedExamHistoryCfc).length === 0 ? (
                                          <div className="p-10 text-center text-gray-400">Nenhum histórico encontrado.</div>
                                      ) : (
                                          Object.entries(groupedExamHistoryCfc).map(([statusGroup, schoolsGroup]) => (
                                              <div key={statusGroup} className="border-b last:border-b-0 print:border-black">
                                                  <div className="bg-gray-100 px-6 py-3 font-bold text-gray-700 uppercase tracking-wider text-sm flex items-center gap-2 print:bg-white print:text-black print:border-b print:border-black print:py-1">
                                                      <div className={`w-2 h-2 rounded-full ${statusGroup === 'Provas Canceladas' ? 'bg-red-500' : 'bg-green-500'} print:hidden`}></div>
                                                      {statusGroup} ({Object.values(schoolsGroup).flat().length})
                                                  </div>
                                                  
                                                  {Object.entries(schoolsGroup).map(([schoolName, items]) => (
                                                      <div key={`${statusGroup}-${schoolName}`}>
                                                          <div className="bg-gray-50 px-6 py-2 font-bold text-blue-600 text-xs border-y border-gray-100 pl-10 flex items-center gap-2 print:bg-white print:text-black print:border-black print:border-b print:pl-6 print:py-1">
                                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 print:hidden"></span>
                                                              {schoolName} ({items.length})
                                                          </div>
                                                          <table className="w-full text-sm text-left">
                                                              <thead>
                                                                  <tr className="text-xs text-gray-400 border-b print:text-black print:border-black">
                                                                      <th className="px-6 py-2 pl-14 font-medium print:pl-2 print:py-1 print:text-[10px]">Tipo</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Exame</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Data</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Hora</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Examinador</th>
                                                                  </tr>
                                                              </thead>
                                                              <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                                  {items.map((item: any) => (
                                                                      <tr key={item.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                                          <td className="px-6 py-3 font-medium text-gray-800 uppercase pl-14 print:pl-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                              {item.requestType === 'FIXA' ? 'Fixa' : item.requestType === 'EXTRA' ? 'Extra' : item.requestType === 'REPOSICAO' ? 'Reposição' : '-'}
                                                                          </td>
                                                                          <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{item.exameLabel}</td>
                                                                          <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{new Date(item.date).toLocaleDateString()}</td>
                                                                          <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{item.time}</td>
                                                                          <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                              {item.examinerIds && item.examinerIds.length > 0 
                                                                                  ? item.examinerIds.map((id: string) => examiners.find(e => e.id === id)?.name || 'Desconhecido').join(', ')
                                                                                  : '-'}
                                                                          </td>
                                                                      </tr>
                                                                  ))}
                                                              </tbody>
                                                          </table>
                                                      </div>
                                                  ))}
                                              </div>
                                          ))
                                      )
                                  ) : (
                                      Object.keys(groupedExamHistory).length === 0 ? (
                                          <div className="p-10 text-center text-gray-400">Nenhum histórico encontrado.</div>
                                      ) : (
                                          Object.entries(groupedExamHistory).map(([code, categories]) => (
                                              <div key={code} className="border-b last:border-b-0 print:border-black">
                                                  <div className="bg-gray-100 px-6 py-3 font-bold text-gray-700 uppercase tracking-wider text-xs flex items-center gap-2 print:bg-white print:text-black print:border-b print:border-black print:py-1">
                                                      <div className="w-2 h-2 rounded-full bg-gray-400 print:hidden"></div>
                                                      Banca: {code} ({Object.values(categories).flat().length})
                                                  </div>
                                                  
                                                  {Object.entries(categories).map(([category, items]) => (
                                                      <div key={`${code}-${category}`}>
                                                          <div className="bg-gray-50 px-6 py-2 font-bold text-blue-600 text-xs border-y border-gray-100 pl-10 flex items-center gap-2 print:bg-white print:text-black print:border-black print:border-b print:pl-6 print:py-1">
                                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 print:hidden"></span>
                                                              Categoria {category} ({items.length})
                                                          </div>
                                                          <table className="w-full text-sm text-left">
                                                              <thead>
                                                                  <tr className="text-xs text-gray-400 border-b print:text-black print:border-black">
                                                                      <th className="px-6 py-2 pl-14 font-medium print:pl-2 print:py-1 print:text-[10px] print:w-[40%]">Nome</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[20%]">CPF</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[20%]">Data/Hora</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[20%]">Resultado</th>
                                                                  </tr>
                                                              </thead>
                                                              <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                                  {items.map((item: any) => (
                                                                      <tr key={item.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                                          <td className="px-6 py-3 w-1/3 font-medium text-gray-800 uppercase pl-14 print:pl-2 print:py-0.5 print:text-[10px] print:text-black">{item.studentName}</td>
                                                                          <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{item.cpf}</td>
                                                                          <td className="px-6 py-3 text-gray-500 font-medium print:px-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                              {new Date(item.date).toLocaleDateString()} às {item.time}
                                                                          </td>
                                                                          <td className="px-6 py-3 print:px-2 print:py-0.5 print:text-[10px]">
                                                                              {item.result ? (
                                                                                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                                                      item.result === 'APTO' ? 'bg-green-100 text-green-700' : 
                                                                                      item.result === 'INAPTO' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                                                                                  } print:bg-transparent print:text-black print:p-0 print:font-bold print:text-[10px]`}>
                                                                                      {item.result}
                                                                                  </span>
                                                                              ) : <span className="text-gray-400 print:text-black">-</span>}
                                                                          </td>
                                                                      </tr>
                                                                  ))}
                                                              </tbody>
                                                          </table>
                                                      </div>
                                                  ))}
                                              </div>
                                          ))
                                      )
                                  )}
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>

              {/* Print Footer (Visible only in print) */}
              <div className="hidden print:flex fixed bottom-4 left-0 w-full bg-white border-t-2 border-black pt-2 pb-4 px-10 justify-between items-center text-[10px] font-black text-black">
                  <div className="uppercase">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div>IMPRESSÃO: {new Date().toLocaleString()}</div>
              </div>
          </div>
      )}

      {/* VIEW: Lista de Instrutores / Examinadores */}
      {activeView === 'instructors-list' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn print:shadow-none print:border-none print:rounded-none print:overflow-visible print:animate-none print:bg-transparent">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                  <div className="flex-1 max-w-md">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                              type="text" 
                              placeholder={reportType === 'cfc' ? "Buscar Examinador por Nome ou Matrícula..." : "Buscar Instrutor por Nome ou CPF..."} 
                              className="w-full border rounded-md pl-10 pr-4 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                              value={instructorSearch}
                              onChange={e => setInstructorSearch(e.target.value)}
                          />
                      </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                      <button 
                          onClick={() => window.print()} 
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"
                      >
                          <Printer className="h-4 w-4" /> Imprimir
                      </button>
                  </div>
              </div>

              {/* Print Header (Visible only in print) */}
              <div className="hidden print:block border-b-2 border-black mb-4 print:mb-0 print:-mt-6">
                  <div className="flex items-center gap-6 border-b-2 border-black pb-4 print:pb-1 print:gap-6">
                      {settings?.logoUrl ? (
                          <img src={settings.logoUrl} className="h-16 w-auto print:h-16" />
                      ) : (
                          <div className="h-16 w-16 bg-gray-200 flex items-center justify-center text-black font-black text-xs border border-black print:h-16 print:w-16 print:text-xs">LOGO</div>
                      )}
                      <div>
                          <h1 className="text-xl font-black uppercase tracking-tight text-black print:text-xl">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                          <h2 className="text-2xl font-black uppercase text-black print:text-2xl">{reportType === 'cfc' ? 'LISTA GERAL DE EXAMINADORES' : 'RELATÓRIO DE INSTRUTORES'}</h2>
                      </div>
                  </div>
                  {reportType !== 'cfc' && (
                      <div className="text-center text-xs font-bold uppercase text-black print:text-sm print:py-0.5">
                          <span>Data de Emissão: {new Date().toLocaleDateString()}</span>
                      </div>
                  )}
              </div>

              <div className="overflow-x-auto print:overflow-visible print:mt-1 print:mb-1">
                  <table className="w-full">
                      <tbody>
                          <tr>
                              <td>
                                  {reportType === 'cfc' ? (
                                      // CFC View: List of Examiners
                                      filteredExaminers.length === 0 ? (
                                          <div className="p-10 text-center text-gray-400">Nenhum examinador encontrado.</div>
                                      ) : (
                                          <table className="w-full text-sm text-left">
                                              <thead className="bg-gray-50 text-gray-500 border-b print:bg-white print:text-black print:border-black">
                                                  <tr>
                                                      <th className="px-6 py-3 font-bold uppercase text-xs print:px-2 print:py-1">Nome</th>
                                                      <th className="px-6 py-3 font-bold uppercase text-xs print:px-2 print:py-1">Matrícula</th>
                                                      <th className="px-6 py-3 font-bold uppercase text-xs print:px-2 print:py-1">Categoria</th>
                                                  </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                  {filteredExaminers.map(ex => (
                                                      <tr key={ex.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                          <td className="px-6 py-4 font-bold text-gray-800 uppercase print:px-2 print:py-1 print:text-black">{ex.name}</td>
                                                          <td className="px-6 py-4 text-gray-500 print:px-2 print:py-1 print:text-black">{ex.registrationNumber || '-'}</td>
                                                          <td className="px-6 py-4 text-gray-500 print:px-2 print:py-1 print:text-black">
                                                              <div className="flex gap-1 flex-wrap">
                                                                  {ex.categories && ex.categories.length > 0 ? (
                                                                      ex.categories.map((cat: string) => (
                                                                          <span key={cat} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold print:bg-transparent print:text-black print:p-0 print:after:content-[','] print:last:after:content-['']">
                                                                              {cat}
                                                                          </span>
                                                                      ))
                                                                  ) : (
                                                                      <span className="text-gray-400 print:text-black">-</span>
                                                                  )}
                                                              </div>
                                                          </td>
                                                      </tr>
                                                  ))}
                                              </tbody>
                                          </table>
                                      )
                                  ) : (
                                      // Original View: List of Instructors
                                      filteredInstructors.length === 0 ? (
                                          <div className="p-10 text-center text-gray-400">Nenhum instrutor encontrado.</div>
                                      ) : (
                                          <table className="w-full text-sm text-left">
                                              <thead className="bg-gray-50 text-gray-500 border-b print:bg-white print:text-black print:border-black">
                                                  <tr>
                                                      <th className="px-6 py-3 font-bold uppercase text-xs print:px-2 print:py-1">Nome</th>
                                                      <th className="px-6 py-3 font-bold uppercase text-xs print:px-2 print:py-1">CPF</th>
                                                      <th className="px-6 py-3 font-bold uppercase text-xs print:px-2 print:py-1">Telefone</th>
                                                      <th className="px-6 py-3 font-bold uppercase text-xs print:px-2 print:py-1">Categoria</th>
                                                      <th className="px-6 py-3 font-bold uppercase text-xs print:px-2 print:py-1">Veículos</th>
                                                  </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                  {filteredInstructors.map(inst => (
                                                      <tr key={inst.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                          <td className="px-6 py-4 font-bold text-gray-800 uppercase print:px-2 print:py-1 print:text-black">{inst.name}</td>
                                                          <td className="px-6 py-4 text-gray-500 print:px-2 print:py-1 print:text-black">{inst.cpf}</td>
                                                          <td className="px-6 py-4 text-gray-500 print:px-2 print:py-1 print:text-black">{inst.phone}</td>
                                                          <td className="px-6 py-4 text-gray-500 print:px-2 print:py-1 print:text-black">
                                                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold print:bg-transparent print:text-black print:p-0">
                                                                  {inst.category || 'N/A'}
                                                              </span>
                                                          </td>
                                                          <td className="px-6 py-4 text-gray-500 print:px-2 print:py-1 print:text-black">
                                                              {inst.vehicles && inst.vehicles.length > 0 ? (
                                                                  <div className="flex flex-col gap-1">
                                                                      {inst.vehicles.filter(v => v.active).map(v => (
                                                                          <span key={v.id} className="text-xs">
                                                                              {v.type === 'CAR' ? '🚗' : '🏍️'} {v.model} ({v.plate})
                                                                          </span>
                                                                      ))}
                                                                  </div>
                                                              ) : (
                                                                  <span className="text-gray-400 print:text-black">-</span>
                                                              )}
                                                          </td>
                                                      </tr>
                                                  ))}
                                              </tbody>
                                          </table>
                                      )
                                  )}
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>

              {/* Print Footer (Visible only in print) */}
              <div className="hidden print:flex fixed bottom-4 left-0 w-full bg-white border-t-2 border-black pt-2 pb-4 px-10 justify-between items-center text-[10px] font-black text-black">
                  <div className="uppercase">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div>IMPRESSÃO: {new Date().toLocaleString()}</div>
              </div>
          </div>
      )}

      {/* VIEW: Lista de Candidatos / Autoescolas */}
      {activeView === 'schedules-list' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn print:shadow-none print:border-none print:rounded-none print:overflow-visible print:animate-none print:bg-transparent">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                  <div className="flex-1 flex flex-col md:flex-row items-center gap-4">
                      {reportType !== 'cfc' && (
                          <h3 className="text-lg font-bold whitespace-nowrap">Todas as Bancas</h3>
                      )}
                      {reportType === 'cfc' && (
                          <div className="relative w-full max-w-xs">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <input 
                                  type="text" 
                                  placeholder="Buscar Autoescola..." 
                                  className="w-full border rounded-md pl-10 pr-4 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                  value={schoolSearch}
                                  onChange={e => setSchoolSearch(e.target.value)}
                              />
                          </div>
                      )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                      {reportType !== 'cfc' && (
                          <>
                              <select 
                                  className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                                  value={scheduleStatusFilter}
                                  onChange={e => setScheduleStatusFilter(e.target.value)}
                              >
                                  <option value="ALL">Todos Status</option>
                                  {Object.entries(SCHEDULE_STATUS_TRANSLATION).map(([key, label]) => (
                                      <option key={key} value={key}>{label}</option>
                                  ))}
                              </select>

                              <div className="flex items-center gap-2 border rounded-md px-2 bg-white">
                                  <input 
                                      type="date"
                                      className="border-none text-sm p-2 outline-none bg-transparent"
                                      value={scheduleDateStart} 
                                      onChange={e => setScheduleDateStart(e.target.value)} 
                                  />
                                  <span className="text-gray-400">-</span>
                                  <input 
                                      type="date"
                                      className="border-none text-sm p-2 outline-none bg-transparent"
                                      value={scheduleDateEnd} 
                                      onChange={e => setScheduleDateEnd(e.target.value)} 
                                  />
                              </div>
                          </>
                      )}

                      <button 
                          onClick={() => window.print()} 
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"
                      >
                          <Printer className="h-4 w-4" /> Imprimir
                      </button>
                  </div>
              </div>

              {/* Print Header (Visible only in print) */}
              <div className="hidden print:block border-b-2 border-black mb-4 print:mb-0 print:-mt-6">
                  <div className="flex items-center gap-6 border-b-2 border-black pb-4 print:pb-1 print:gap-6">
                      {settings?.logoUrl ? (
                          <img src={settings.logoUrl} className="h-16 w-auto print:h-16" />
                      ) : (
                          <div className="h-16 w-16 bg-gray-200 flex items-center justify-center text-black font-black text-xs border border-black print:h-16 print:w-16 print:text-xs">LOGO</div>
                      )}
                      <div>
                          <h1 className="text-xl font-black uppercase tracking-tight text-black print:text-xl">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                          <h2 className="text-2xl font-black uppercase text-black print:text-2xl">{reportType === 'cfc' ? 'LISTA GERAL DE AUTOESCOLAS' : 'RELATÓRIO DE BANCAS'}</h2>
                      </div>
                  </div>
                  {reportType !== 'cfc' && (
                      <div className="text-center text-xs font-bold uppercase text-black print:text-sm print:py-0.5">
                          <span>Data: {new Date(scheduleDateStart).toLocaleDateString()} até {new Date(scheduleDateEnd).toLocaleDateString()}</span>
                      </div>
                  )}
              </div>

              <div className="overflow-x-auto print:overflow-visible print:mt-1 print:mb-1">
                  <table className="w-full">
                      <tbody>
                          <tr>
                              <td>
                                  {reportType === 'cfc' ? (
                                      // CFC View: List of Schools
                                      <div>
                                          {filteredSchools.length === 0 ? (
                                              <div className="p-10 text-center text-gray-400">Nenhuma autoescola encontrada.</div>
                                          ) : (
                                              <table className="w-full text-sm text-left">
                                                  <thead>
                                                      <tr className="text-xs text-gray-400 border-b bg-gray-50 print:bg-transparent print:text-black print:border-black">
                                                          <th className="px-4 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Autoescola</th>
                                                          <th className="px-4 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Contato</th>
                                                          <th className="px-4 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Serviços</th>
                                                          <th className="px-4 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Escala Ativa</th>
                                                          <th className="px-4 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Horários / Examinadores</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                      {filteredSchools.map(school => (
                                                          <tr key={school.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                              <td className="px-4 py-2 font-bold text-gray-800 uppercase print:px-2 print:py-1 print:text-[10px] print:text-black align-top">
                                                                  {school.name}
                                                              </td>
                                                              <td className="px-4 py-2 text-gray-600 print:px-2 print:py-1 print:text-[10px] print:text-black align-top">
                                                                  <div>{school.phone}</div>
                                                                  {school.email && <div className="text-xs text-gray-400 print:text-black">{school.email}</div>}
                                                              </td>
                                                              <td className="px-4 py-2 text-gray-600 print:px-2 print:py-1 print:text-[10px] print:text-black align-top">
                                                                  {school.services?.join(', ') || '-'}
                                                              </td>
                                                              <td className="px-4 py-2 text-gray-600 print:px-2 print:py-1 print:text-[10px] print:text-black align-top">
                                                                  {school.mainSchedule?.active ? (
                                                                      <>
                                                                          <div className="font-medium text-blue-700 print:text-black">{
                                                                              school.mainSchedule.frequency === '1_WEEK' ? '1x na Semana' :
                                                                              school.mainSchedule.frequency === '2_WEEK' ? '2x na Semana' :
                                                                              school.mainSchedule.frequency === '3_WEEK' ? '3x na Semana' :
                                                                              school.mainSchedule.frequency === '2_DAY' ? '2x no Dia' :
                                                                              school.mainSchedule.frequency === '15_DAYS' ? 'A cada 15 dias' : school.mainSchedule.frequency
                                                                          }</div>
                                                                          <div className="text-xs mt-0.5">{school.mainSchedule.days?.join(', ') || '-'}</div>
                                                                      </>
                                                                  ) : <span className="text-gray-400 print:text-black">-</span>}
                                                              </td>
                                                              <td className="px-4 py-2 text-gray-600 print:px-2 print:py-1 print:text-[10px] print:text-black align-top">
                                                                  {school.mainSchedule?.active && school.mainSchedule.slots?.length > 0 ? (
                                                                      <ul className="space-y-1">
                                                                          {school.mainSchedule.slots.map((slot: any, idx: number) => (
                                                                              <li key={idx} className="flex items-center gap-1.5 text-xs">
                                                                                  <span className="font-mono font-medium bg-gray-100 px-1 rounded print:bg-transparent print:p-0">{slot.time}</span>
                                                                                  <span className="text-gray-500 print:text-black">{slot.examiner ? (examiners.find(e => e.id === slot.examiner || e.name === slot.examiner)?.name || 'A Definir') : 'A Definir'}</span>
                                                                              </li>
                                                                          ))}
                                                                      </ul>
                                                                  ) : <span className="text-gray-400 print:text-black">-</span>}
                                                              </td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                          )}
                                      </div>
                                  ) : (
                                      // Original View: List of Schedules
                                      Object.keys(groupedSchedules).length === 0 ? (
                                          <div className="p-10 text-center text-gray-400">Nenhuma banca encontrada.</div>
                                      ) : (
                                          Object.entries(groupedSchedules).map(([status, types]) => (
                                              <div key={status} className="border-b last:border-b-0 print:border-black">
                                                  <div className="bg-gray-100 px-6 py-3 font-bold text-gray-700 uppercase tracking-wider text-xs flex items-center gap-2 print:bg-white print:text-black print:border-b print:border-black print:py-1">
                                                      <div className="w-2 h-2 rounded-full bg-gray-400 print:hidden"></div>
                                                      {SCHEDULE_STATUS_TRANSLATION[status] || status} ({Object.values(types).flat().length})
                                                  </div>
                                                  
                                                  {Object.entries(types).map(([code, scheds]) => (
                                                      <div key={`${status}-${code}`}>
                                                          <div className="bg-gray-50 px-6 py-2 font-bold text-blue-600 text-xs border-y border-gray-100 pl-10 flex items-center gap-2 print:bg-white print:text-black print:border-black print:border-b print:pl-6 print:py-1">
                                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 print:hidden"></span>
                                                              {code}
                                                          </div>
                                                          <table className="w-full text-sm text-left">
                                                              <thead>
                                                                  <tr className="text-xs text-gray-400 border-b print:text-black print:border-black">
                                                                      <th className="px-6 py-2 pl-14 font-medium print:pl-2 print:py-1 print:text-[10px]">Data</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Horário</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] w-[40%]">Examinadores</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Vagas Utilizadas</th>
                                                                      <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Vagas Totais</th>
                                                                  </tr>
                                                              </thead>
                                                              <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                                  {scheds.map((schedule: any) => (
                                                                      <tr key={schedule.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                                          <td className="px-6 py-3 font-medium text-gray-800 pl-14 print:pl-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                              {new Date(schedule.date).toLocaleDateString()}
                                                                           </td>
                                                                           <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                               {schedule.time}
                                                                          </td>
                                                                          <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                              {schedule.examinerIds.map((id: string) => examiners.find(e => e.id === id)?.name || 'Desconhecido').join(', ')}
                                                                          </td>
                                                                          <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                              {requests.filter(r => r.scheduleId === schedule.id).length}
                                                                           </td>
                                                                           <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                               {schedule.maxSlotsA + schedule.maxSlotsB}
                                                                          </td>
                                                                      </tr>
                                                                  ))}
                                                              </tbody>
                                                          </table>
                                                      </div>
                                                  ))}
                                              </div>
                                          ))
                                      )
                                  )}
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>

              {/* Print Footer (Visible only in print) */}
              <div className="hidden print:flex fixed bottom-4 left-0 w-full bg-white border-t-2 border-black pt-2 pb-4 px-10 justify-between items-center text-[10px] font-black text-black">
                  <div className="uppercase">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div>IMPRESSÃO: {new Date().toLocaleString()}</div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Reports;
