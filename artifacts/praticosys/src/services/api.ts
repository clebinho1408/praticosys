import { ExamRequest, ExamSchedule, ExamLocation, Examiner, Instructor, DrivingSchool, SystemSettings, User, City, BancaResult } from '../types';

// With Cloudflare Pages Functions, the API runs on the same domain as the frontend.
// All /api/* requests are handled by functions/api/* — no external backend needed.
// In development, the Vite proxy forwards /api/* to localhost:3000.
const API_BASE = '/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API Error: ${response.statusText}`);
  }

  // Handle empty responses (e.g. DELETE)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // --- AUTH ---
  login: (login: string, password?: string) => request<User>('/auth', { method: 'POST', body: JSON.stringify({ login, password }) }),
  
  // --- USERS ---
  getUsers: () => request<User[]>('/users'),
  createUser: (data: any) => request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<User>) => request<User>('/users', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteUser: (id: string) => request<void>(`/users?id=${id}`, { method: 'DELETE' }),

  // --- SETTINGS ---
  getSettings: () => request<SystemSettings>('/settings'),
  updateSettings: (settings: Partial<SystemSettings>) => request<SystemSettings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // --- EXAMINERS ---
  getExaminers: () => request<Examiner[]>('/examiners'),
  getExaminersAsync: () => request<Examiner[]>('/examiners'),
  createExaminer: (data: Partial<Examiner>) => request<Examiner>('/examiners', { method: 'POST', body: JSON.stringify(data) }),
  updateExaminer: (id: string, data: Partial<Examiner>) => request<Examiner>('/examiners', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteExaminer: (id: string) => request<void>(`/examiners?id=${id}`, { method: 'DELETE' }),

  // --- INSTRUCTORS ---
  getInstructors: () => request<Instructor[]>('/instructors'),
  getInstructorsAsync: () => request<Instructor[]>('/instructors'),
  createInstructor: (data: Partial<Instructor>) => request<Instructor>('/instructors', { method: 'POST', body: JSON.stringify(data) }),
  updateInstructor: (id: string, data: Partial<Instructor>) => request<Instructor>('/instructors', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteInstructor: (id: string) => request<void>(`/instructors?id=${id}`, { method: 'DELETE' }),

  // --- VEHICLE LOOKUP (SINESP) ---
  lookupVehicleByPlate: (plate: string) => request<{ plate: string; brand: string; model: string; color: string; year: string; state: string; city: string }>(`/vehicle-lookup?plate=${encodeURIComponent(plate)}`),

  // --- SCHOOLS ---
  getSchools: () => request<DrivingSchool[]>('/schools'),
  getSchoolsAsync: () => request<DrivingSchool[]>('/schools'),
  createSchool: (data: Partial<DrivingSchool>) => request<DrivingSchool>('/schools', { method: 'POST', body: JSON.stringify(data) }),
  updateSchool: (id: string, data: Partial<DrivingSchool>) => request<DrivingSchool>('/schools', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteSchool: (id: string) => request<void>(`/schools?id=${id}`, { method: 'DELETE' }),

  // --- SCHEDULES ---
  getSchedules: () => request<ExamSchedule[]>('/schedules'),
  createSchedule: (data: Partial<ExamSchedule>) => request<ExamSchedule>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id: string, updates: Partial<ExamSchedule>) => request<ExamSchedule>('/schedules', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }),
  cancelSchedule: (id: string, reason: string) => request<ExamSchedule>('/schedules', { method: 'PUT', body: JSON.stringify({ id, action: 'CANCEL', reason }) }),
  deleteSchedule: (id: string) => request<void>(`/schedules?id=${id}`, { method: 'DELETE' }),

  // --- REQUESTS ---
  getRequests: () => request<ExamRequest[]>('/requests'),
  getRequestByCpf: (cpf: string) => request<ExamRequest[]>(`/requests?cpf=${cpf}`),
  createRequest: (data: any) => request<ExamRequest>('/requests', { method: 'POST', body: JSON.stringify(data) }),
  updateRequest: (id: string, updates: Partial<ExamRequest>) => request<ExamRequest>('/requests', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }),
  deleteRequest: (id: string) => request<void>(`/requests?id=${id}`, { method: 'DELETE' }),

  // --- CITIES ---
  getCities: () => request<City[]>('/cities'),
  createCity: (data: Partial<City>) => request<City>('/cities', { method: 'POST', body: JSON.stringify(data) }),
  updateCity: (id: string, data: Partial<City>) => request<City>('/cities', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteCity: (id: string) => request<void>(`/cities?id=${id}`, { method: 'DELETE' }),
  
  // --- BANCA RESULTS ---
  getBancaResults: (scheduleId?: string, schoolId?: string) => {
    let url = '/banca-results';
    const params = new URLSearchParams();
    if (scheduleId) params.append('scheduleId', scheduleId);
    if (schoolId) params.append('schoolId', schoolId);
    if (params.toString()) url += `?${params.toString()}`;
    return request<BancaResult[]>(url);
  },
  saveBancaResult: (data: Partial<BancaResult>) => request<BancaResult>('/banca-results', { method: 'POST', body: JSON.stringify(data) }),

  // --- ACTIONS ---
  // currentUpdatedAt: valor atual de updatedAt do candidato antes de entrar na banca.
  // Será salvo em queueUpdatedAt para restauração ao cancelar a banca.
  // scheduledBy: nome do usuário do sistema que colocou o candidato na banca.
  assignStudentToSchedule: (requestId: string, scheduleId: string, category: string, currentUpdatedAt?: string, scheduledBy?: string) => 
    request<void>('/requests', { 
      method: 'PUT', 
      body: JSON.stringify({ 
        id: requestId, 
        scheduleId, 
        scheduledCategory: category,
        status: 'SCHEDULED', // ExamStatus.SCHEDULED
        // Salva o updatedAt atual (posição na fila) para restauração ao cancelar banca
        queueUpdatedAt: currentUpdatedAt || new Date().toISOString(),
        // Registra quem colocou o candidato na banca
        scheduledBy: scheduledBy || null,
      }) 
    }),

  removeStudentFromSchedule: (requestId: string) => 
    request<void>('/requests', { 
      method: 'PUT', 
      body: JSON.stringify({ 
        id: requestId, 
        scheduleId: null, 
        scheduledCategory: null, 
        status: 'WAITING_SCHEDULING', // ExamStatus.WAITING_SCHEDULING
        attendanceConfirmed: false,
        // Limpar queueUpdatedAt ao remover manualmente da banca
        queueUpdatedAt: null,
        // NOTE: Do NOT send createdAt here — it must preserve the original registration date
        updatedAt: new Date().toISOString()
      }) 
    }),
  
  // --- EXAM LOCATIONS ---
  getExamLocations: () => request<ExamLocation[]>('/exam-locations'),
  createExamLocation: (data: Partial<ExamLocation>) => request<ExamLocation>('/exam-locations', { method: 'POST', body: JSON.stringify(data) }),
  updateExamLocation: (id: string, data: Partial<ExamLocation>) => request<ExamLocation>('/exam-locations', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteExamLocation: (id: string) => request<void>(`/exam-locations?id=${id}`, { method: 'DELETE' }),

  // --- RISK AREA ---
  resetData: () => request<void>('/risk-area', { method: 'POST', body: JSON.stringify({ action: 'RESET_DATA' }) }),
  cleanupPhantomRequests: () => request<{ success: boolean; message: string; removed: number }>('/risk-area', { method: 'POST', body: JSON.stringify({ action: 'CLEANUP_PHANTOM_REQUESTS' }) }),

  // --- SCHEDULE SLOTS (vagas de escala CFC/PCD — SEM candidato real) ---
  // Tabela totalmente separada de exam_requests para nunca misturar agenda com candidatos.
  getScheduleSlots: (params?: { schoolId?: string; scheduledDate?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<any[]>(`/schedule-slots${qs}`);
  },
  createScheduleSlot: (data: any) =>
    request<any>('/schedule-slots', { method: 'POST', body: JSON.stringify(data) }),
  updateScheduleSlot: (id: string, data: any) =>
    request<any>('/schedule-slots', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteScheduleSlot: (id: string) =>
    request<void>(`/schedule-slots?id=${id}`, { method: 'DELETE' }),
};
