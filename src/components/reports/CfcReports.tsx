
import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../../services/api';
import { ExamRequest, ExamSchedule, SystemSettings, Instructor, BancaResult, RequestSource, Examiner, DrivingSchool, RequestType } from '../../../types';
import { 
  PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip
} from 'recharts';
import { 
  Trophy, 
  XCircle, 
  FileText, 
  Filter,
  Users,
  Printer,
  Search
} from 'lucide-react';

import { 
  COLORS, 
  SCHEDULE_STATUS_TRANSLATION, 
  SummaryCard, 
  PrintStatsTable, 
  CustomLegend 
} from './ReportShared';

type ReportView = 'general-stats' | 'schedules-list' | 'instructors-list' | 'exam-history';

const CfcReports: React.FC = () => {
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

  const [examHistoryStatusFilter, setExamHistoryStatusFilter] = useState<string>('ALL');
  const [examHistorySchoolFilter, setExamHistorySchoolFilter] = useState<string>('ALL');
  const [examHistoryExaminerFilter, setExamHistoryExaminerFilter] = useState<string>('ALL');
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

            const filteredReqs = reqs.filter(r => r.source === RequestSource.SCHOOL);
            const filteredScheds = scheds.filter(s => 
                results.some(br => br.scheduleId === s.id) || 
                reqs.some(r => r.scheduleId === s.id && r.source === RequestSource.SCHOOL)
            );

            setRequests(filteredReqs);
            setSchedules(filteredScheds);
            setInstructors(instrs);
            setExaminers(exms);
            setSchools(schs);
            setSettings(sysSettings);
            setBancaResults(results);
        } catch (error) {
            console.error("Error fetching CFC report data", error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const approvalStats = useMemo(() => {
        let filteredResults = bancaResults;
        
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
        
        const monthlyData: Record<string, { name: string, sortKey: string, apto: number, inapto: number }> = {};

        filteredResults.forEach(br => {
            apto += br.approved || 0;
            inapto += br.failed || 0;
            faltou += br.absent || 0;

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
  }, [bancaResults, schedules, generalDateStart, generalDateEnd]);

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
          
          const results = bancaResults.filter(br => br.scheduleId === sch.id);
          results.forEach(br => {
              monthlyData[sortKey].total += (br.totalSlots || 0);
              monthlyData[sortKey].used += (br.usedSlots || 0);
          });
      });
      
      return Object.values(monthlyData).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [schedules, bancaResults, generalDateStart, generalDateEnd]);

  const cfcStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalExams = 0;
    let totalCancelled = 0;
    let totalApproved = 0;
    let totalUsed = 0;
    let totalSlots = 0;
    
    let aptos = 0;
    let inaptos = 0;
    let faltas = 0;
    let cancelados = 0;

    let fixas = 0;
    let extras = 0;
    let reposicao = 0;
    
    const byExaminer: Record<string, number> = {};
    const bySchool: Record<string, number> = {};
    const recentSchedulesList: any[] = [];

    const cfcEvents = new Map<string, {
        id: string;
        date: string;
        status: string;
        examinerIds: string[];
        maxSlots: number;
        isRealSchedule: boolean;
        code?: string;
    }>();

    schedules.forEach(s => {
        cfcEvents.set(s.id, {
            id: s.id,
            date: s.date,
            status: s.status,
            examinerIds: s.examinerIds,
            maxSlots: (s.maxSlotsA || 0) + (s.maxSlotsB || 0),
            isRealSchedule: true,
            code: s.code
        });
    });

    requests.forEach(r => {
        if (r.source === RequestSource.SCHOOL && r.scheduledDate) {
            const eventId = r.scheduleId || r.id;
            if (!cfcEvents.has(eventId)) {
                cfcEvents.set(eventId, {
                    id: eventId,
                    date: r.scheduledDate,
                    status: r.status === 'DONE' ? 'CONCLUDED' : (r.status === 'CANCELLED' ? 'CANCELLED' : 'OPEN'),
                    examinerIds: r.examinerId ? [r.examinerId] : [],
                    maxSlots: 0, 
                    isRealSchedule: false
                });
            }
        }
    });

    const eventList = Array.from(cfcEvents.values());

    const monthlySchedules = eventList.filter(e => {
        const d = new Date(e.date + 'T12:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    eventList.forEach(event => {
        if (generalDateStart && event.date < generalDateStart) return;
        if (generalDateEnd && event.date > generalDateEnd) return;

        const eventRequests = requests.filter(r => r.scheduleId === event.id || r.id === event.id);
        const eventResults = bancaResults.filter(br => br.scheduleId === event.id);

        if (event.status === 'CONCLUDED' || eventResults.length > 0) {
            if (eventResults.length > 0) {
                eventResults.forEach(br => {
                    totalExams += (br.usedSlots || 0);
                    totalApproved += (br.approved || 0);
                    totalCancelled += (br.cancelled || 0);

                    aptos += (br.approved || 0);
                    inaptos += (br.failed || 0);
                    faltas += (br.absent || 0);
                    cancelados += (br.cancelled || 0);
                });
            } else {
                totalExams += eventRequests.length;
                totalApproved += eventRequests.filter(r => r.result === 'APTO').length;
                totalCancelled += eventRequests.filter(r => r.status === 'CANCELLED').length;

                aptos += eventRequests.filter(r => r.result === 'APTO').length;
                inaptos += eventRequests.filter(r => r.result === 'INAPTO').length;
                faltas += eventRequests.filter(r => r.result === 'FALTOU').length;
                cancelados += eventRequests.filter(r => r.status === 'CANCELLED').length;
            }
        } else if (event.status === 'CANCELLED') {
            const cCount = eventRequests.filter(r => r.status === 'CANCELLED').length;
            totalCancelled += cCount;
            cancelados += cCount;
        }

        eventRequests.forEach(r => {
            if (r.requestType === RequestType.FIXA) fixas++;
            else if (r.requestType === RequestType.EXTRA) extras++;
            else if (r.requestType === RequestType.REPOSICAO) reposicao++;
        });

        if (event.status !== 'CANCELLED') {
            let eventTotalSlots = event.maxSlots;
            if (eventTotalSlots === 0 && eventResults.length > 0) {
                eventTotalSlots = eventResults.reduce((acc, br) => acc + (br.totalSlots || 0), 0);
            }
            if (eventTotalSlots === 0) {
                eventTotalSlots = eventResults.length > 0 
                    ? eventResults.reduce((acc, br) => acc + (br.usedSlots || 0), 0)
                    : eventRequests.length;
            }
            totalSlots += eventTotalSlots;
            if (eventResults.length > 0) {
                totalUsed += eventResults.reduce((acc, br) => acc + (br.usedSlots || 0), 0);
            } else {
                totalUsed += eventRequests.length;
            }
        }

        if (eventResults.length > 0) {
            eventResults.forEach(br => {
                const school = schools.find(s => s.id === br.schoolId);
                const schoolName = school ? school.name : 'Desconhecida';
                bySchool[schoolName] = (bySchool[schoolName] || 0) + (br.usedSlots || 0);
            });
        } else {
            eventRequests.forEach(r => {
                const school = schools.find(s => s.id === r.schoolId);
                const schoolName = school ? school.name : 'Desconhecida';
                bySchool[schoolName] = (bySchool[schoolName] || 0) + 1;
            });
        }

        const count = eventResults.length > 0 
            ? eventResults.reduce((acc, br) => acc + (br.usedSlots || 0), 0)
            : eventRequests.length;

        if (event.examinerIds.length > 0) {
            event.examinerIds.forEach(id => {
                const examiner = examiners.find(e => e.id === id);
                const name = examiner ? examiner.name : 'Sem examinador';
                byExaminer[name] = (byExaminer[name] || 0) + count;
            });
        } else {
            byExaminer['Sem examinador'] = (byExaminer['Sem examinador'] || 0) + count;
        }

        const examinerNames = event.examinerIds.map(id => examiners.find(e => e.id === id)?.name).filter(Boolean).join(', ') || 'Sem examinador';
        recentSchedulesList.push({
            id: event.id,
            location: event.code || 'BARRA',
            date: event.date,
            examiner: examinerNames,
            status: event.status
        });
    });

    const confirmedSchedules = eventList.filter(e => e.status === 'OPEN' || e.status === 'CLOSED').length;
    const slotUsagePercent = totalSlots > 0 ? Math.round((totalUsed / totalSlots) * 100) : 0;
    const approvalRate = totalExams > 0 ? Math.round((totalApproved / totalExams) * 100) : 0;

    return {
        monthlySchedules,
        totalExams,
        totalCancelled,
        confirmedSchedules,
        totalApproved,
        slotUsagePercent,
        approvalRate,
        byExaminer: Object.entries(byExaminer).sort((a, b) => b[1] - a[1]),
        bySchool: Object.entries(bySchool).sort((a, b) => b[1] - a[1]),
        recentSchedules: recentSchedulesList.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
        resultsPieData: [
            { name: 'Aptos', value: aptos },
            { name: 'Inaptos', value: inaptos },
            { name: 'Faltas', value: faltas },
            { name: 'Cancelados', value: cancelados }
        ],
        typesPieData: [
            { name: 'Provas Fixas', value: fixas },
            { name: 'Provas Extras', value: extras },
            { name: 'Reposição de Provas', value: reposicao }
        ]
    };
  }, [bancaResults, schedules, requests, schools, examiners, generalDateStart, generalDateEnd]);

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
          
          const getExameType = (cat?: string) => {
              if (!cat) return 'N/A';
              const c = cat.toUpperCase();
              if (c === 'A' || c === 'B') return '1º Habilitação';
              if (c === 'MUDANCA' || c === 'C' || c === 'D' || c === 'E') return 'Mudança Categoria';
              return 'Outros';
          };

          if (req.examHistory && Array.isArray(req.examHistory)) {
              req.examHistory.forEach((h: any) => {
                  const schedule = schedules.find(s => s.id === h.scheduleId);
                  const examiner = examiners.find(e => e.id === h.examinerId);
                  list.push({
                      id: `${req.id}-${h.date}-${h.time}`,
                      date: schedule ? schedule.date : h.date,
                      time: schedule ? schedule.time : (h.time || '00:00'),
                      result: h.result,
                      exameType: getExameType(h.category || req.intendedCategory),
                      scheduleCode: h.scheduleCode || (schedule?.code ? `#${schedule.code}` : 'Sem Banca'),
                      type: 'HISTORY',
                      requestType: req.requestType || 'N/A',
                      schoolName: schoolName,
                      schoolId: req.schoolId,
                      examinerName: examiner ? examiner.name : (h.examiners || 'N/A'),
                      examinerId: h.examinerId || req.examinerId,
                      status: 'REALIZADA'
                  });
              });
          }

          const isRealized = req.status === 'DONE' || req.status === 'WAITING_RESULT' || req.result;
          if (isRealized && req.status !== 'CANCELLED') {
               const schedule = schedules.find(s => s.id === req.scheduleId);
               const examiner = examiners.find(e => e.id === req.examinerId);
               const date = schedule ? schedule.date : (req.scheduledDate || (req.updatedAt ? req.updatedAt.split('T')[0] : req.createdAt.split('T')[0]));
               const isDuplicate = req.examHistory?.some((h: any) => {
                   const hSchedule = schedules.find(s => s.id === h.scheduleId);
                   const hDate = hSchedule ? hSchedule.date : h.date;
                   return hDate === date;
               });
               if (!isDuplicate) {
                   list.push({
                       id: req.id,
                       date: date,
                       time: schedule ? schedule.time : (req.scheduledTime || '00:00'),
                       result: req.result || (req.status === 'WAITING_RESULT' ? 'PENDENTE' : 'N/A'),
                       exameType: getExameType(req.scheduledCategory || req.intendedCategory),
                       scheduleCode: schedule?.code ? `#${schedule.code}` : 'Sem Banca',
                       type: 'CURRENT',
                       requestType: req.requestType || 'N/A',
                       schoolName: schoolName,
                       schoolId: req.schoolId,
                       examinerName: examiner ? examiner.name : 'N/A',
                       examinerId: req.examinerId,
                       status: 'REALIZADA'
                   });
               }
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
                  exameType: getExameType(req.scheduledCategory || req.intendedCategory),
                  scheduleCode: schedule?.code ? `#${schedule.code}` : 'Sem Banca',
                  type: 'CANCELLED',
                  requestType: req.requestType || 'N/A',
                  schoolName: schoolName,
                  schoolId: req.schoolId,
                  examinerName: examiner ? examiner.name : 'N/A',
                  examinerId: req.examinerId,
                  status: 'CANCELADA'
              });
          }
      });
      return list;
  }, [requests, schedules, schools, examiners]);

  const groupedExamHistory = useMemo(() => {
      const groups: Record<string, Record<string, any[]>> = {};
      let filtered = examHistoryList;
      if (examHistoryDateStart) filtered = filtered.filter(i => new Date(i.date) >= new Date(examHistoryDateStart));
      if (examHistoryDateEnd) filtered = filtered.filter(i => new Date(i.date) <= new Date(examHistoryDateEnd));
      if (examHistoryStatusFilter !== 'ALL') filtered = filtered.filter(i => i.status === examHistoryStatusFilter);
      if (examHistorySchoolFilter !== 'ALL') filtered = filtered.filter(i => i.schoolId === examHistorySchoolFilter);
      if (examHistoryExaminerFilter !== 'ALL') filtered = filtered.filter(i => i.examinerId === examHistoryExaminerFilter);

      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      filtered.forEach(item => {
          const mainGroup = item.status === 'REALIZADA' ? 'Provas Realizadas' : 'Provas Canceladas';
          const school = item.schoolName;
          if (!groups[mainGroup]) groups[mainGroup] = {};
          if (!groups[mainGroup][school]) groups[mainGroup][school] = [];
          groups[mainGroup][school].push(item);
      });
      return groups;
  }, [examHistoryList, examHistoryDateStart, examHistoryDateEnd, examHistoryStatusFilter, examHistorySchoolFilter, examHistoryExaminerFilter]);

  if (loading) return <div className="p-10 text-center text-gray-500">Gerando relatórios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-tight">RELATÓRIOS - CFC</h2>
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
              {/* Print Header */}
              <div className="hidden print:block border-b-2 border-black mb-4 print:mb-6 print:-mt-12">
                  <div className="flex items-center gap-6 border-b-2 border-black pb-4 print:pb-1 print:gap-6">
                      {settings?.logoUrl ? <img src={settings.logoUrl} className="h-16 w-auto print:h-16" /> : <div className="h-16 w-16 bg-gray-200 flex items-center justify-center text-black font-bold text-xs border border-black print:h-16 print:w-16 print:text-xs">LOGO</div>}
                      <div>
                          <h1 className="text-xl font-bold uppercase tracking-tight text-black print:text-xl">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                          <h2 className="text-2xl font-bold uppercase text-black print:text-2xl">ÍNDICE GERAL - CFC</h2>
                      </div>
                  </div>
                  <div className="text-center text-xs font-bold uppercase text-black print:text-sm print:py-0.5">
                      <span>Período: {new Date(generalDateStart).toLocaleDateString()} até {new Date(generalDateEnd).toLocaleDateString()}</span>
                  </div>
              </div>

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
                <SummaryCard title="Total de Exames" value={cfcStats.totalExams} icon={FileText} color="bg-blue-500" subtitle="Exames realizados no período" />
                <SummaryCard title="Taxa de Aprovação" value={`${cfcStats.approvalRate}%`} icon={Trophy} color="bg-green-500" subtitle={`${cfcStats.totalApproved} alunos aprovados`} />
                <SummaryCard title="Ocupação de Vagas" value={`${cfcStats.slotUsagePercent}%`} icon={Users} color="bg-orange-500" subtitle="Uso das vagas disponibilizadas" />
                <SummaryCard title="Exames Cancelados" value={cfcStats.totalCancelled} icon={XCircle} color="bg-red-500" subtitle="Pela agência ou autoescola" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-2 print:border-black">
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-6 print:mb-2 print:text-[10px] print:text-black">Resultado dos Exames</h4>
                    <div className="h-64 print:h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={cfcStats.resultsPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {cfcStats.resultsPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend content={<CustomLegend />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <PrintStatsTable title="Resultados Detalhados" data={cfcStats.resultsPieData.map((d, i) => ({ label: d.name, value: d.value, color: COLORS[i] }))} />
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-2 print:border-black">
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-6 print:mb-2 print:text-[10px] print:text-black">Tipos de Prova</h4>
                    <div className="h-64 print:h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={cfcStats.typesPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {cfcStats.typesPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={['#3B82F6', '#8B5CF6', '#F59E0B'][index % 3]} />)}
                                </Pie>
                                <Tooltip />
                                <Legend content={<CustomLegend />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <PrintStatsTable title="Tipos de Prova" data={cfcStats.typesPieData.map((d, i) => ({ label: d.name, value: d.value, color: ['#3B82F6', '#8B5CF6', '#F59E0B'][i] }))} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-2 print:border-black">
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 print:text-[10px] print:text-black">Exames por Autoescola (Top 10)</h4>
                    <div className="space-y-3">
                        {cfcStats.bySchool.slice(0, 10).map(([name, count], idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}.</span>
                                    <span className="text-sm font-medium text-gray-700 uppercase">{name}</span>
                                </div>
                                <span className="text-sm font-bold text-blue-600">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-2 print:border-black">
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-4 print:text-[10px] print:text-black">Exames por Examinador (Top 10)</h4>
                    <div className="space-y-3">
                        {cfcStats.byExaminer.slice(0, 10).map(([name, count], idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}.</span>
                                    <span className="text-sm font-medium text-gray-700 uppercase">{name}</span>
                                </div>
                                <span className="text-sm font-bold text-green-600">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Print Footer (Fixed at bottom) */}
            <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-2 px-10 justify-between items-start text-[10px] font-bold text-black flex-wrap gap-x-4">
                <div className="uppercase max-w-[70%] break-words text-left">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                <div className="whitespace-nowrap text-right">IMPRESSÃO: {new Date().toLocaleString()}</div>
            </div>
          </div>
      )}

      {activeView === 'exam-history' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-fadeIn print:shadow-none print:border-none print:rounded-none print:overflow-visible print:animate-none print:bg-transparent print:mt-1 print:mb-1">
              <div className="p-6 border-b border-gray-100 flex flex-col gap-4 print:hidden">
                  <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">Provas:</span>
                          <select className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none" value={examHistoryStatusFilter} onChange={e => setExamHistoryStatusFilter(e.target.value)}>
                              <option value="ALL">Todas</option>
                              <option value="REALIZADA">Realizadas</option>
                              <option value="CANCELADA">Canceladas</option>
                          </select>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">Autoescola:</span>
                          <select className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none max-w-[200px]" value={examHistorySchoolFilter} onChange={e => setExamHistorySchoolFilter(e.target.value)}>
                              <option value="ALL">Todas</option>
                              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">Examinadores:</span>
                          <select className="border rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none max-w-[200px]" value={examHistoryExaminerFilter} onChange={e => setExamHistoryExaminerFilter(e.target.value)}>
                              <option value="ALL">Todos</option>
                              {examiners.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                          </select>
                      </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-400 uppercase">Período:</span>
                          <div className="flex items-center gap-2 border rounded-md px-2 bg-white">
                              <input type="date" className="border-none text-sm p-2 outline-none bg-transparent" value={examHistoryDateStart} onChange={e => setExamHistoryDateStart(e.target.value)} />
                              <span className="text-gray-400">-</span>
                              <input type="date" className="border-none text-sm p-2 outline-none bg-transparent" value={examHistoryDateEnd} onChange={e => setExamHistoryDateEnd(e.target.value)} />
                          </div>
                      </div>
                      <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold transition-colors"><Printer className="h-4 w-4" /> Imprimir</button>
                  </div>
              </div>

              <div className="hidden print:block border-b-2 border-black mb-4 print:mb-0 print:-mt-6">
                  <div className="flex items-center gap-6 border-b-2 border-black pb-4 print:pb-1 print:gap-6">
                      {settings?.logoUrl ? <img src={settings.logoUrl} className="h-16 w-auto print:h-16" /> : <div className="h-16 w-16 bg-gray-200 flex items-center justify-center text-black font-bold text-xs border border-black print:h-16 print:w-16 print:text-xs">LOGO</div>}
                      <div>
                          <h1 className="text-xl font-bold uppercase tracking-tight text-black print:text-xl">{settings?.agencyName || 'AGÊNCIA REGIONAL'}</h1>
                          <h2 className="text-2xl font-bold uppercase text-black print:text-2xl">HISTÓRICO DE PROVAS - CFC</h2>
                      </div>
                  </div>
                  <div className="text-center text-xs font-bold uppercase text-black print:text-sm print:py-0.5">
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
                                      Object.entries(groupedExamHistory).map(([mainGroup, schools]) => (
                                          <div key={mainGroup} className="border-b last:border-b-0 print:border-black">
                                              <div className="bg-blue-600 px-6 py-3 font-bold text-white uppercase tracking-wider text-sm flex items-center gap-2 print:bg-gray-200 print:text-black print:border-b print:border-black print:mt-4 print:py-1">
                                                  {mainGroup} ({Object.values(schools).flat().length})
                                              </div>
                                              {Object.entries(schools).map(([schoolName, items]) => (
                                                  <div key={`${mainGroup}-${schoolName}`}>
                                                      <div className="bg-gray-50 px-6 py-2 font-bold text-blue-600 text-xs border-y border-gray-100 pl-10 flex items-center gap-2 print:bg-white print:text-black print:border-black print:border-b print:pl-6 print:py-1">
                                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 print:hidden"></span>
                                                          Autoescola: {schoolName} ({items.length})
                                                      </div>
                                                      <table className="w-full text-sm text-left">
                                                          <thead>
                                                              <tr className="text-xs text-gray-400 border-b print:text-black print:border-black">
                                                                  <th className="px-6 py-2 pl-14 font-medium print:pl-2 print:py-1 print:text-[10px] print:w-[15%]">Tipo</th>
                                                                  <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[35%]">Exame</th>
                                                                  <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[15%]">Data</th>
                                                                  <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[10%]">Hora</th>
                                                                  <th className="px-6 py-2 font-medium print:px-2 print:py-1 print:text-[10px] print:w-[25%]">Examinador</th>
                                                              </tr>
                                                          </thead>
                                                          <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                                                              {items.map((item: any) => (
                                                                  <tr key={item.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                                                                      <td className="px-6 py-3 font-medium text-gray-600 pl-14 print:pl-2 print:py-0.5 print:text-[10px] print:text-black"><span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold print:bg-transparent print:p-0">{item.requestType}</span></td>
                                                                      <td className="px-6 py-3 font-medium text-gray-800 uppercase print:px-2 print:py-0.5 print:text-[10px] print:text-black">{item.exameType}</td>
                                                                      <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{new Date(item.date).toLocaleDateString()}</td>
                                                                      <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{item.time}</td>
                                                                      <td className="px-6 py-3 text-gray-500 print:px-2 print:py-0.5 print:text-[10px] print:text-black">{item.examinerName}</td>
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
              <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-2 px-8 justify-between items-center text-[10px] font-bold text-black">
                  <div className="uppercase max-w-[70%] break-words text-left">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div className="whitespace-nowrap text-right">IMPRESSÃO: {new Date().toLocaleString()}</div>
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
              <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-2 px-8 justify-between items-center text-[10px] font-bold text-black">
                  <div className="uppercase max-w-[70%] break-words text-left">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div className="whitespace-nowrap text-right">IMPRESSÃO: {new Date().toLocaleString()}</div>
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
              <div className="hidden print:flex fixed bottom-0 left-0 w-full bg-white border-t-2 border-black pt-2 pb-2 px-8 justify-between items-center text-[10px] font-bold text-black">
                  <div className="uppercase max-w-[70%] break-words text-left">{settings?.agencyAddress || 'ENDEREÇO DA AGÊNCIA'}</div>
                  <div className="whitespace-nowrap text-right">IMPRESSÃO: {new Date().toLocaleString()}</div>
              </div>
          </div>
      )}
    </div>
  );
};

export default CfcReports;
