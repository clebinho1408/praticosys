
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ExamRequest, ExamStatus, ExamSchedule } from '../types';
import { Search, User, Calendar, History, ChevronRight, X, ShieldCheck, MapPin, Phone } from 'lucide-react';

const StudentDatabase: React.FC = () => {
  const [students, setStudents] = useState<ExamRequest[]>([]);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<ExamRequest | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getRequests(), api.getSchedules()]).then(([requestsData, schedulesData]) => {
      setStudents(requestsData);
      setSchedules(schedulesData);
      setLoading(false);
    });
  }, []);

  const filtered = students.filter(s => 
    (s.socialName || s.studentName).toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.cpf.includes(searchTerm)
  );

  const getStatusColor = (status: ExamStatus) => {
    const colors: Record<string, string> = {
      [ExamStatus.DONE]: 'bg-green-100 text-green-700',
      [ExamStatus.SCHEDULED]: 'bg-blue-100 text-blue-700',
      [ExamStatus.WAITING_SCHEDULING]: 'bg-yellow-100 text-yellow-700',
      [ExamStatus.RETEST]: 'bg-orange-100 text-orange-700',
      [ExamStatus.CANCELLED]: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Base Central de Candidatos</h2>
          <p className="text-sm text-gray-500 font-medium">Histórico unificado e consulta de solicitações.</p>
        </div>
      </div>

      <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar por Nome ou CPF..." 
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 bg-white transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(student => (
          <div 
            key={student.id} 
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group"
            onClick={() => setSelectedStudent(student)}
          >
            <div className="flex justify-between items-start mb-5">
              <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-200">
                {(student.socialName || student.studentName).charAt(0)}
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(student.status)}`}>
                {student.status.replace('_', ' ')}
              </span>
            </div>
            
            <h3 className="text-lg font-black text-slate-900 uppercase truncate mb-1">{student.socialName || student.studentName}</h3>
            <p className="text-sm text-slate-400 font-bold mb-4">{student.cpf}</p>
            
            <div className="space-y-3 border-t border-gray-50 pt-5">
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <Calendar className="h-4 w-4 text-slate-300" /> 
                Cadastrado em: {new Date(student.createdAt).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <History className="h-4 w-4 text-slate-300" /> 
                {student.examHistory?.length || 0} tentativas registradas
              </div>
            </div>

            <div className="mt-6 flex items-center text-blue-600 text-[10px] font-black uppercase tracking-widest group-hover:gap-3 transition-all">
              Ver Prontuário Completo <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-sm">
                Nenhum candidato encontrado na base.
            </div>
        )}
      </div>

      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-white">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">
                    {(selectedStudent.socialName || selectedStudent.studentName).charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 uppercase">{selectedStudent.socialName || selectedStudent.studentName}</h3>
                  <p className="text-sm text-gray-500">{selectedStudent.cpf}</p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Informações de Contato</h4>
                  <div className="space-y-4">
                    <p className="flex items-center gap-4 text-sm text-slate-700 font-bold">
                        <Phone className="h-5 w-5 text-blue-600" /> {selectedStudent.phone}
                    </p>
                    <p className="flex items-center gap-4 text-sm text-slate-700 font-bold">
                        <User className="h-5 w-5 text-blue-600" /> {selectedStudent.email || 'Não informado'}
                    </p>
                    <p className="flex items-center gap-4 text-sm text-slate-700 font-bold">
                        <MapPin className="h-5 w-5 text-blue-600" /> {selectedStudent.address || 'Não informado'}
                    </p>
                  </div>
                </div>
                <div className="space-y-6">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2">Status da CNH</h4>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                        <ShieldCheck className="h-16 w-16" />
                    </div>
                    <p className="text-[10px] text-gray-400 font-black mb-1 uppercase tracking-tighter">Categoria Pretendida</p>
                    <p className="text-3xl font-black text-blue-600">{selectedStudent.intendedCategory || 'B'}</p>
                    <div className="mt-4 flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${selectedStudent.paidFee ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Taxa Detran: {selectedStudent.paidFee ? 'PAGA' : 'PENDENTE'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                    <History className="h-5 w-5" /> Histórico de Exames
                </h4>
                <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Banca</th>
                                <th className="px-6 py-4 text-center">Resultado</th>
                                <th className="px-6 py-4">Examinador</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(selectedStudent.examHistory || []).length > 0 ? (
                                selectedStudent.examHistory.map((h, i) => {
                                    const schedule = schedules.find(s => s.id === h.scheduleId);
                                    const displayDate = schedule?.date || h.date;
                                    const displayTime = schedule?.time || h.time;
                                    return (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-700">{displayDate ? displayDate.split('-').reverse().join('/') : '-'} às {displayTime}</td>
                                        <td className="px-6 py-4 text-slate-500 font-medium">Prática {h.category}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                                h.result === 'APTO' ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100'
                                            }`}>{h.result}</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 text-xs font-bold">{h.examiners || h.examinerId || '-'}</td>
                                    </tr>
                                )})
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic font-medium">
                                        Nenhum exame realizado anteriormente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-slate-50 border-t flex justify-end">
                <button onClick={() => setSelectedStudent(null)} className="px-8 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-slate-800 transition-all uppercase text-xs tracking-widest shadow-xl shadow-slate-200">
                    Fechar Prontuário
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDatabase;
