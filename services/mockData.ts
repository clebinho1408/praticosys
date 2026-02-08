import { 
  User, UserRole, DrivingSchool, Examiner, ExamSchedule, ExamRequest, 
  SystemSettings, ExamStatus, ExamType, RequestSource, ExamResultEntry 
} from '../types';

export const MOCK_SCHOOLS: DrivingSchool[] = []; 

// Helper para chamadas
const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const res = await fetch(`/api/${endpoint}`, options);
  if (!res.ok) {
     // Tenta ler o erro detalhado do JSON
     const errorBody = await res.json().catch(() => null);
     const errorMessage = errorBody?.error || `Erro HTTP ${res.status}: ${res.statusText}`;
     console.error(`[API Error] ${endpoint}:`, errorMessage);
     throw new Error(errorMessage);
  }
  return res.json();
};

// API Real conectada ao Backend Vercel -> Neon DB
export const api = {
  // Auth
  login: async (login: string, password?: string): Promise<User | null> => {
    try {
      const user = await fetchApi('auth', {
        method: 'POST',
        body: JSON.stringify({ login, password })
      });
      return user;
    } catch (e) {
      console.error("Falha no login:", e);
      return null;
    }
  },

  // Users
  getUsers: async (): Promise<User[]> => fetchApi('users'),
  createUser: async (data: Omit<User, 'id'>): Promise<User> => {
    return fetchApi('users', { method: 'POST', body: JSON.stringify(data) });
  },
  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    return fetchApi('users', { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
  },
  deleteUser: async (id: string): Promise<void> => {
    return fetchApi(`users?id=${id}`, { method: 'DELETE' });
  },

  // Schools
  getSchools: (): DrivingSchool[] => [], 
  getSchoolsAsync: async (): Promise<DrivingSchool[]> => fetchApi('schools'),
  createSchool: async (data: Omit<DrivingSchool, 'id'>): Promise<DrivingSchool> => {
    return fetchApi('schools', { method: 'POST', body: JSON.stringify(data) });
  },
  updateSchool: async (id: string, updates: Partial<DrivingSchool>): Promise<DrivingSchool> => {
    return fetchApi('schools', { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
  },
  deleteSchool: async (id: string): Promise<void> => {
    return fetchApi(`schools?id=${id}`, { method: 'DELETE' });
  },

  // Examiners
  getExaminers: (): Examiner[] => [], 
  getExaminersAsync: async (): Promise<Examiner[]> => fetchApi('examiners'),
  createExaminer: async (data: Omit<Examiner, 'id'>): Promise<Examiner> => {
    return fetchApi('examiners', { method: 'POST', body: JSON.stringify(data) });
  },
  updateExaminer: async (id: string, updates: Partial<Examiner>): Promise<Examiner> => {
    return fetchApi('examiners', { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
  },
  deleteExaminer: async (id: string): Promise<void> => {
    return fetchApi(`examiners?id=${id}`, { method: 'DELETE' });
  },

  // Settings
  getSettings: async (): Promise<SystemSettings> => fetchApi('settings'),
  updateSettings: async (newSettings: SystemSettings): Promise<SystemSettings> => {
    return fetchApi('settings', { method: 'PUT', body: JSON.stringify(newSettings) });
  },

  // Schedules
  getSchedules: async (): Promise<ExamSchedule[]> => fetchApi('schedules'),
  
  createSchedule: async (data: Omit<ExamSchedule, 'id' | 'status'>): Promise<ExamSchedule> => {
    return fetchApi('schedules', { method: 'POST', body: JSON.stringify(data) });
  },

  updateSchedule: async (id: string, updates: Partial<ExamSchedule>): Promise<ExamSchedule> => {
    return fetchApi('schedules', { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
  },

  cancelSchedule: async (id: string, reason: string): Promise<ExamSchedule> => {
      return fetchApi('schedules', { 
        method: 'PUT', 
        body: JSON.stringify({ id, action: 'CANCEL', reason }) 
      });
  },

  // Requests
  getRequests: async (): Promise<ExamRequest[]> => fetchApi('requests'),

  getRequestByCpf: async (cpf: string): Promise<ExamRequest[]> => {
    const all = await fetchApi(`requests?cpf=${cpf}`);
    return all.filter((r: ExamRequest) => r.cpf.replace(/\D/g, '') === cpf.replace(/\D/g, ''));
  },
  
  createRequest: async (data: Omit<ExamRequest, 'id' | 'createdAt' | 'updatedAt' | 'examHistory'> & { examHistory?: ExamResultEntry[] }): Promise<ExamRequest> => {
    return fetchApi('requests', { method: 'POST', body: JSON.stringify(data) });
  },

  updateRequest: async (id: string, updates: Partial<ExamRequest>): Promise<ExamRequest> => {
    return fetchApi('requests', { method: 'PUT', body: JSON.stringify({ id, ...updates }) });
  },

  assignStudentToSchedule: async (requestId: string, scheduleId: string, category: string): Promise<void> => {
     const schedules = await fetchApi('schedules');
     const schedule = schedules.find((s: ExamSchedule) => s.id === scheduleId);
     if (!schedule) throw new Error("Schedule not found");
     
     if (schedule.status !== 'OPEN') throw new Error("Cannot assign to closed schedule");

     await fetchApi('requests', { 
         method: 'PUT', 
         body: JSON.stringify({
            id: requestId,
            status: ExamStatus.SCHEDULED,
            scheduleId: schedule.id,
            scheduledDate: schedule.date,
            scheduledTime: schedule.time,
            scheduledCategory: category,
            examinerId: schedule.examinerIds?.[0],
            attendanceConfirmed: false
         })
     });
  },

  removeStudentFromSchedule: async (requestId: string): Promise<void> => {
     await fetchApi('requests', {
         method: 'PUT',
         body: JSON.stringify({
            id: requestId,
            status: ExamStatus.WAITING_SCHEDULING,
            scheduleId: null,
            scheduledDate: null,
            scheduledTime: null,
            scheduledCategory: null,
            examinerId: null,
            attendanceConfirmed: false
         })
     });
  }
};