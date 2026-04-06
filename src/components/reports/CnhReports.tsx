
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../../services/api';
import { ExamRequest, ExamStatus, ExamSchedule, SystemSettings, Instructor, BancaResult, RequestSource, Examiner, DrivingSchool, RequestType } from '../../../types';
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
  CheckCircle,
  Clock,
  MapPin
} from 'lucide-react';

import { 
  COLORS, 
  SCHEDULE_STATUS_TRANSLATION, 
  SummaryCard, 
  PrintStatsTable, 
  CustomLegend 
} from './ReportShared';

type ReportView = 'general-stats' | 'schedules-list' | 'instructors-list' | 'exam-history';

const CnhReports: React.FC = () => {
  const [activeView, setActiveView] = useState<ReportView>('general-stats');
  const [requests, setRequests] = useState<ExamRequest[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [examiners, setExaminers] = useState<Examiner[]>([]);
  const [schools, setSchools] = useState<DrivingSchool[]>([]);
  const [bancaResults, setBancaResults] = useState<BancaResult[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [generalDateStart, setGeneralDateStart] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
  });
  const [generalDateEnd, setGeneralDateEnd] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date.toISOString().split('T')[0];
  });

  const [instructorSearch, setInstructorSearch] = useState<string>('');

  const [examHistorySearch, setExamHistorySearch] = useState<string>('');
  const [examHistoryResultFilter, setExamHistoryResultFilter] = useState<string>('ALL');
  const [examHistoryDateStart, setExamHistoryDateStart] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
  });
  const [examHistoryDateEnd, setExamHistoryDateEnd] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>('ALL');
  const [scheduleDateStart, setScheduleDateStart] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date.toISOString().split('T')[0];
  });
  const [scheduleDateEnd, setScheduleDateEnd] = useState(() => {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date.toISOString().split('T')[0];
  });

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            const [reqs, scheds, instrs, exms, schs, sysSettings, results] = await Promise.all([
                api.getRequests(),
                api.getSchedules(),
                api.getInstructorsAsync(),
                api.getExaminersAsync(),
                api.getSchools(),
                api.getSettings(),
                api.getBancaResults()
            ]);

            const filteredReqs = reqs.filter(r => r.examType === 'COMMON' && r.source === RequestSource.STUDENT_DIRECT);
            const filteredScheds = scheds.filter(s => 
                s.type === 'COMMON' && 
                !results.some(br => br.scheduleId === s.id) &&
                !reqs.some(r => r.scheduleId === s.id && r.source === RequestSource.SCHOOL)
            );

            setRequests(filteredReqs);
            setSchedules(filteredScheds);
            setInstructors(instrs);
            setExaminers(exms);
            setSchools(schs);
            setSettings(sysSettings);
            setBancaResults(results);
        } catch (error) {
            console.error("Error fetching CNH report data", error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const allExamResults = useMemo(() => {
      const list: any[] = [];
      requests.forEach(req => {
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
          if (req.status === ExamStatus.DONE && req.result) {
               const date = req.scheduledDate || (req.updatedAt ? req.updatedAt.split('T')[0] : req.createdAt.split('T')[0]);
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
  }, [requests, schedules]);

  const approvalStats = useMemo(() => {
    let filtered = allExamResults;
    if (generalDateStart) filtered = filtered.filter(r => r.date >= generalDateStart);
    if (generalDateEnd) filtered = filtered.filter(r => r.date <= generalDateEnd);

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

    const monthlyData: Record<string, { name: string, sortKey: string, apto: number, inapto: number }> = {};
    filtered.forEach(r => {
      if (!r.date) return;
      const rawDate = String(r.date);
      const dateStr = rawDate.split('T')[0];
      const parts = dateStr.split('-');
      if (parts.length < 2) return;
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

  const scheduleStats = useMemo(() => {
      let filteredSchedules = schedules;
      if (generalDateStart) filteredSchedules = filteredSchedules.filter(s => s.date >= generalDateStart);
      if (generalDateEnd) filteredSchedules = filteredSchedules.filter(s => s.date <= generalDateEnd);

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

  const slotUsageStats = useMemo(() => {
      const monthlyData: Record<string, { name: string, sortKey: string, total: number, used: number }> = {};
      let filteredSchedules = schedules;
      if (generalDateStart) filteredSchedules = filteredSchedules.filter(s => s.date >= generalDateStart);
      if (generalDateEnd) filteredSchedules = filteredSchedules.filter(s => s.date <= generalDateEnd);

      const sortedSchedules = [...filteredSchedules].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      sortedSchedules.forEach(sch => {
          const date = new Date(sch.date);
          const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const monthName = date.toLocaleString('pt-BR', { month: 'short' });
          const label = `${monthName}/${date.getFullYear().toString().substr(2)}`;
          
          if (!monthlyData[sortKey]) monthlyData[sortKey] = { name: label, sortKey, total: 0, used: 0 };
          
          const totalSlots = (sch.maxSlotsA || 0) + (sch.maxSlotsB || 0);
          const usedSlots = requests.filter(r => r.scheduleId === sch.id).length;
          
          monthlyData[sortKey].total += totalSlots;
          monthlyData[sortKey].used += usedSlots;
      });
      
      return Object.values(monthlyData).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [schedules, requests, generalDateStart, generalDateEnd]);

  const filteredInstructors = useMemo(() => {
    let filtered = instructors;
    if (instructorSearch) {
        const searchLower = instructorSearch.toLowerCase();
        filtered = filtered.filter(i => i.name.toLowerCase().includes(searchLower) || i.cpf.includes(searchLower));
    }
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [instructors, instructorSearch]);

  const groupedSchedules = useMemo(() => {
    const groups: Record<string, Record<string, ExamSchedule[]>> = {};
    let filtered = schedules;
    if (scheduleStatusFilter !== 'ALL') filtered = filtered.filter(s => s.status === scheduleStatusFilter);
    if (scheduleDateStart) filtered = filtered.filter(s => new Date(s.date) >= new Date(scheduleDateStart));
    if (scheduleDateEnd) filtered = filtered.filter(s => new Date(s.date) <= new Date(scheduleDateEnd));

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

  const examHistoryList = useMemo(() => {
      const list: any[] = [];
      requests.forEach(req => {
          const school = schools.find(s => s.id === req.schoolId);
          const schoolName = school ? school.name : 'Desconhecida';
          
          if (req.examHistory && Array.isArray(req.examHistory)) {
              req.examHistory.forEach((h: any) => {
                  const schedule = schedules.find(s => s.id === h.scheduleId);
                  const examiner = examiners.find(e => e.id === h.examinerId);
                  list.push({
                      id: `${req.id}-${h.date}-${h.time}`,
                      date: schedule ? schedule.date : h.date,
                      time: schedule ? schedule.time : (h.time || '00:00'),
                      result: h.result,
                      category: h.category || req.intendedCategory,
                      scheduleCode: h.scheduleCode || (schedule?.code ? `#${schedule.code}` : 'Sem Banca'),
                      type: 'HISTORY',
                      requestType: req.requestType || 'N/A',
                      schoolName: schoolName,
                      examinerName: examiner ? examiner.name : (h.examiners || 'N/A')
                  });
              });
          }

          if (req.status === 'CANCELLED') {
              const schedule = schedules.find(s => s.id === req.scheduleId);
              const examiner = examiners.find(e => e.id === req.examinerId);
              const date = schedule ? schedule.date : (req.scheduledDate || (req.updatedAt ? req.updatedAt.split('T')[0] : req.createdAt.split('T')[0]));
              list.push({
                  id: `cancelled-${req.id}`,
                  date: date,
                  time: schedule ? schedule.time : (req.scheduledTime || '00:00'),
                  result: 'CANCELADO',
                  category: req.scheduledCategory || req.intendedCategory,
                  scheduleCode: schedule?.code ? `#${schedule.code}` : 'Sem Banca',
                  type: 'CANCELLED',
                  requestType: req.requestType || 'N/A',
                  schoolName: schoolName,
                  examinerName: examiner ? examiner.name : 'N/A'
              });
          }
      });
      return list;
  }, [requests, schedules, schools, examiners]);

  const groupedExamHistory = useMemo(() => {
      const groups: Record<string, any[]> = {};
      let filtered = examHistoryList;
      if (examHistorySearch) {
          const s = examHistorySearch.toLowerCase();
          filtered = filtered.filter(i => i.schoolName.toLowerCase().includes(s) || i.examinerName.toLowerCase().includes(s) || i.scheduleCode.toLowerCase().includes(s));
      }
      if (examHistoryDateStart) filtered = filtered.filter(i => new Date(i.date) >= new Date(examHistoryDateStart));
      if (examHistoryDateEnd) filtered = filtered.filter(i => new Date(i.date) <= new Date(examHistoryDateEnd));
      if (examHistoryResultFilter !== 'ALL') filtered = filtered.filter(i => i.result === examHistoryResultFilter);

      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      filtered.forEach(item => {
          const school = item.schoolName;
          if (!groups[school]) groups[school] = [];
          groups[school].push(item);
      });
      return groups;
  }, [examHistoryList, examHistorySearch, examHistoryDateStart, examHistoryDateEnd, examHistoryResultFilter]);

  if (loading) return <div className="p-10 text-center text-gray-500">Gerando relatórios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">RELATÓRIOS - CNH DO BRASIL</h2>
          <p className="text-lg text-gray-500 font-medium">Selecione o tipo de relatório abaixo.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-1 print:hidden">
          <button onClick={() => setActiveView('general-stats')} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeView === 'general-stats' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>Índice Geral</button>
          <button onClick={() => setActiveView('exam-history')} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeView === 'exam-history' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>Histórico de Provas</button>
          <button onClick={() => setActiveView('schedules-list')} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeView === 'schedules-list' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>Lista de Bancas</button>
          <button onClick={() => setActiveView('instructors-list')} className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-colors ${activeView === 'instructors-list' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>Lista de Instrutores</button>
      </div>

      {activeView === 'general-stats' && (
          <div className="space-y-6 animate-fadeIn print:space-y-4 print:mt-1 print:mb-1">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                <h3 className="text-lg font-bold">Resumo Geral de Estatísticas</h3>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 border rounded-md px-2 bg-white">
                        <input type="date" className="border-none text-sm p-2 outline-none bg-transparent" value={generalDateStart} onChange={e => setGeneralDateStart(e.target.value)} />
                        <span className="text-gray-400">-</span>
                        <input type="date" className="border-none text-sm p-2 outline-none bg-transparent" value={generalDateEnd} onChange={e => setGeneralDateEnd(e.target.value)} />
                    </div>
                    <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"><Printer className="h-4 w-4" /> Imprimir</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
                <SummaryCard title="Total de Exames" value={approvalStats.total} icon={FileText} color="bg-blue-500" subtitle="Exames realizados no período" />
                <SummaryCard title="Taxa de Aprovação" value={`${approvalStats.rate}%`} icon={Trophy} color="bg-green-500" subtitle={`${approvalStats.apto} alunos aprovados`} />
                <SummaryCard title="Bancas Realizadas" value={scheduleStats.total} icon={Calendar} color="bg-orange-500" subtitle="Bancas no período" />
                <SummaryCard title="Alunos Faltantes" value={approvalStats.faltou} icon={UserMinus} color="bg-red-500" subtitle="Não compareceram ao exame" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-2 print:border-black">
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-6 print:mb-2 print:text-[10px] print:text-black">Resultado dos Exames</h4>
                    <div className="h-64 print:h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={approvalStats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {approvalStats.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend content={<CustomLegend />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <PrintStatsTable title="Resultados Detalhados" data={approvalStats.pieData.map((d, i) => ({ label: d.name, value: d.value, color: COLORS[i] }))} />
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-2 print:border-black">
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-6 print:mb-2 print:text-[10px] print:text-black">Status das Bancas</h4>
                    <div className="h-64 print:h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={scheduleStats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {scheduleStats.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#10B981', '#3B82F6', '#EF4444', '#6B7280'][index % 4]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend content={<CustomLegend />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <PrintStatsTable title="Status das Bancas" data={scheduleStats.pieData.map((d, i) => ({ label: d.name, value: d.value, color: ['#10B981', '#3B82F6', '#EF4444', '#6B7280'][i] }))} />
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-2 print:border-black">
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-6 print:mb-2 print:text-[10px] print:text-black">Evolução Mensal de Resultados</h4>
                <div className="h-80 print:h-40">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={approvalStats.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600 }} />
                            <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="apto" name="Apto" fill="#10B981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="inapto" name="Inapto" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </div>
      )}

      {activeView === 'exam-history' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn print:shadow-none print:border-none print:rounded-none print:overflow-visible print:animate-none print:bg-transparent print:mt-1 print:mb-1">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                  <div className="flex-1 max-w-md flex gap-2">
                      <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input type="text" placeholder="Buscar por Autoescola, Examinador ou Banca..." className="w-full border rounded-md pl-10 pr-4 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={examHistorySearch} onChange={e => setExamHistorySearch(e.target.value)} />
                      </div>
                      <select className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={examHistoryResultFilter} onChange={e => setExamHistoryResultFilter(e.target.value)}>
                          <option value="ALL">Todos Resultados</option>
                          <option value="APTO">Apto</option>
                          <option value="INAPTO">Inapto</option>
                          <option value="FALTOU">Faltou</option>
                          <option value="CANCELADO">Cancelado</option>
                      </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 border rounded-md px-2 bg-white">
                          <input type="date" className="border-none text-sm p-2 outline-none bg-transparent" value={examHistoryDateStart} onChange={e => setExamHistoryDateStart(e.target.value)} />
                          <span className="text-gray-400">-</span>
                          <input type="date" className="border-none text-sm p-2 outline-none bg-transparent" value={examHistoryDateEnd} onChange={e => setExamHistoryDateEnd(e.target.value)} />
                      </div>
                      <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"><Printer className="h-4 w-4" /> Imprimir</button>
                  </div>
              </div>

              <div className="hidden print:block p-6 border-b-2 border-black mb-4 print:p-0 print:mb-0">
                  <div className="flex items-center gap-6 border-b-2 border-black pb-4 mb-2 print:pb-1 print:mb-1">
                      {settings?.logoUrl ? <img src={settings.logoUrl} className="h-16 w-auto" /> : <div className="h-16 w-16 bg-gray-200 flex items-center justify-center text-black font-black text-xs border border-black">LOGO</div>}
                      <div>
                          <h1 className="text-xl font-black uppercase tracking-tight text-black">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                          <h2 className="text-2xl font-black uppercase text-black">HISTÓRICO DE PROVAS - CNH DO BRASIL</h2>
                      </div>
                  </div>
                  <div className="text-center text-xs font-bold uppercase text-black print:text-[10px]">
                      <span>Data: {new Date(examHistoryDateStart).toLocaleDateString()} até {new Date(examHistoryDateEnd).toLocaleDateString()}</span>
                  </div>
              </div>

              <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full">
                      <tfoot className="hidden print:table-footer-group">
                          <tr>
                              <td colSpan={10}>
                                  <div className="h-24"></div>
                              </td>
                          </tr>
                      </tfoot>
                      <tbody>
                          <tr>
                              <td>
                                  {Object.keys(groupedExamHistory).length === 0 ? (
                                      <div className="p-10 text-center text-gray-400">Nenhum histórico encontrado.</div>
                                  ) : (
                                      Object.entries(groupedExamHistory).map(([schoolName, items]) => (
                                          <div key={schoolName} className="border-b last:border-b-0 print:border-black">
                                              <div className="bg-gray-50 px-6 py-3 font-bold text-gray-600 uppercase tracking-wider text-xs flex items-center gap-2 print:bg-white print:text-black print:border-b print:border-black print:mt-4 print:py-1">
                                                  <div className="w-2 h-2 rounded-full bg-blue-500 print:hidden"></div>
                                                  Autoescola: {schoolName} ({items.length})
                                              </div>
                                              <table className="w-full text-sm text-left">
                                                  <thead>
                                                      <tr className="text-xs text-gray-400 border-b print:text-black print:border-black">
                                                          <th className="px-6 py-2 pl-14 font-medium print:pl-2 print:py-1 print:text-[10px] print:w-[15%]">Banca</th>
                                                          <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[10%]">Cat.</th>
                                                          <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[15%]">Data</th>
                                                          <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[10%]">Hora</th>
                                                          <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[25%]">Examinador</th>
                                                          <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[25%]">Resultado</th>
                                                      </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                      {items.map((item: any) => (
                                                          <tr key={item.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                              <td className="px-6 py-3 font-bold text-gray-800 pl-14 print:pl-2 print:py-0.5 print:text-[10px] print:text-black">{item.scheduleCode}</td>
                                                              <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black uppercase">{item.category}</td>
                                                              <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{new Date(item.date).toLocaleDateString()}</td>
                                                              <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{item.time}</td>
                                                              <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black uppercase">{item.examinerName}</td>
                                                              <td className="px-6 py-3 print:px-2 print:py-0.5 print:text-[10px] print:text-black">
                                                                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider print:p-0 ${
                                                                      item.result === 'APTO' ? 'bg-green-100 text-green-700' : 
                                                                      item.result === 'INAPTO' ? 'bg-red-100 text-red-700' : 
                                                                      item.result === 'FALTOU' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'
                                                                  }`}>
                                                                      {item.result}
                                                                  </span>
                                                              </td>
                                                          </tr>
                                                      ))}
                                                  </tbody>
                                              </table>
                                          </div>
                                      ))
                                  )}
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              {/* Print Footer (Fixed at bottom) */}
              <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-2 px-8 justify-between items-end text-[10px] font-black text-black">
                  <div className="uppercase max-w-[70%] break-words">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div className="whitespace-nowrap text-right">IMPRESSÃO:<br/>{new Date().toLocaleString()}</div>
              </div>
          </div>
      )}

      {activeView === 'schedules-list' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn print:shadow-none print:border-none print:rounded-none print:overflow-visible print:animate-none print:bg-transparent print:mt-1 print:mb-1">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                  <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-400" />
                      <select className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={scheduleStatusFilter} onChange={e => setScheduleStatusFilter(e.target.value)}>
                          <option value="ALL">Todos Status</option>
                          <option value="OPEN">Abertas</option>
                          <option value="CLOSED">Fechadas</option>
                          <option value="CONCLUDED">Concluídas</option>
                          <option value="CANCELLED">Canceladas</option>
                      </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 border rounded-md px-2 bg-white">
                          <input type="date" className="border-none text-sm p-2 outline-none bg-transparent" value={scheduleDateStart} onChange={e => setScheduleDateStart(e.target.value)} />
                          <span className="text-gray-400">-</span>
                          <input type="date" className="border-none text-sm p-2 outline-none bg-transparent" value={scheduleDateEnd} onChange={e => setScheduleDateEnd(e.target.value)} />
                      </div>
                      <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"><Printer className="h-4 w-4" /> Imprimir</button>
                  </div>
              </div>
              <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full">
                      <tfoot className="hidden print:table-footer-group">
                          <tr>
                              <td colSpan={10}>
                                  <div className="h-24"></div>
                              </td>
                          </tr>
                      </tfoot>
                      <tbody>
                          <tr>
                              <td>
                                  {Object.keys(groupedSchedules).length === 0 ? (
                                      <div className="p-10 text-center text-gray-400">Nenhuma banca encontrada.</div>
                                  ) : (
                                      Object.entries(groupedSchedules).map(([status, codes]) => (
                                          <div key={status} className="border-b last:border-b-0 print:border-black">
                                              <div className="bg-gray-50 px-6 py-3 font-bold text-gray-600 uppercase tracking-wider text-xs flex items-center gap-2 print:bg-white print:text-black print:border-b print:border-black print:mt-4 print:py-1">
                                                  <div className={`w-2 h-2 rounded-full ${status === 'OPEN' ? 'bg-green-500' : status === 'CLOSED' ? 'bg-blue-500' : status === 'CANCELLED' ? 'bg-red-500' : 'bg-gray-500'} print:hidden`}></div>
                                                  Status: {SCHEDULE_STATUS_TRANSLATION[status] || status}
                                              </div>
                                              {Object.entries(codes).map(([code, schs]) => (
                                                  <div key={`${status}-${code}`}>
                                                      <div className="bg-white px-6 py-2 font-bold text-blue-600 text-[10px] border-y border-gray-50 pl-10 print:pl-6 print:py-1 print:text-black">Banca: {code}</div>
                                                      <table className="w-full text-sm text-left">
                                                          <thead>
                                                              <tr className="text-xs text-gray-400 border-b print:text-black print:border-black">
                                                                  <th className="px-6 py-2 pl-14 font-medium print:pl-2 print:py-1 print:text-[10px]">Data</th>
                                                                  <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Horário</th>
                                                                  <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Vagas (A/B)</th>
                                                                  <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px]">Examinadores</th>
                                                              </tr>
                                                          </thead>
                                                          <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                              {schs.map(sch => (
                                                                  <tr key={sch.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                                      <td className="px-6 py-3 font-bold text-gray-800 pl-14 print:pl-2 print:py-0.5 print:text-[10px] print:text-black">{new Date(sch.date).toLocaleDateString()}</td>
                                                                      <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{sch.time}</td>
                                                                      <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{sch.maxSlotsA}/{sch.maxSlotsB}</td>
                                                                      <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{sch.examinerIds.map(id => examiners.find(e => e.id === id)?.name).filter(Boolean).join(', ') || 'Nenhum'}</td>
                                                                  </tr>
                                                              ))}
                                                          </tbody>
                                                      </table>
                                                  </div>
                                              ))}
                                          </div>
                                      ))
                                  )}
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              {/* Print Footer (Fixed at bottom) */}
              <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-2 px-8 justify-between items-end text-[10px] font-black text-black">
                  <div className="uppercase max-w-[70%] break-words">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div className="whitespace-nowrap text-right">IMPRESSÃO:<br/>{new Date().toLocaleString()}</div>
              </div>
          </div>
      )}

      {activeView === 'instructors-list' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn print:shadow-none print:border-none print:rounded-none print:overflow-visible print:animate-none print:bg-transparent print:mt-1 print:mb-1">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                  <div className="flex-1 max-w-md"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><input type="text" placeholder="Buscar Instrutor por Nome ou CPF..." className="w-full border rounded-md pl-10 pr-4 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={instructorSearch} onChange={e => setInstructorSearch(e.target.value)} /></div></div>
                  <div className="flex flex-wrap items-center gap-2"><button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"><Printer className="h-4 w-4" /> Imprimir</button></div>
              </div>
              <div className="overflow-x-auto print:overflow-visible">
                  <table className="w-full">
                      <tfoot className="hidden print:table-footer-group">
                          <tr>
                              <td colSpan={10}>
                                  <div className="h-24"></div>
                              </td>
                          </tr>
                      </tfoot>
                      <tbody>
                          <tr>
                              <td>
                                  {filteredInstructors.length === 0 ? (
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
                                                      <td className="px-6 py-4 text-gray-500 print:px-2 print:py-1 print:text-black"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold print:bg-transparent print:text-black print:p-0">{inst.category || 'N/A'}</span></td>
                                                      <td className="px-6 py-4 text-gray-500 print:px-2 print:py-1 print:text-black">
                                                          {inst.vehicles && inst.vehicles.length > 0 ? (
                                                              <div className="flex flex-col gap-1">{inst.vehicles.filter(v => v.active).map(v => (<span key={v.id} className="text-xs">{v.type === 'CAR' ? '🚗' : '🏍️'} {v.model} ({v.plate})</span>))}</div>
                                                          ) : (<span className="text-gray-400 print:text-black">-</span>)}
                                                      </td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  )}
                              </td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              {/* Print Footer (Fixed at bottom) */}
              <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-2 px-8 justify-between items-end text-[10px] font-black text-black">
                  <div className="uppercase max-w-[70%] break-words">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div className="whitespace-nowrap text-right">IMPRESSÃO:<br/>{new Date().toLocaleString()}</div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CnhReports;
