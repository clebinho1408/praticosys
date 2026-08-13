import { ExamRequest, ExamSchedule, ExamLocation, Examiner, Instructor, DrivingSchool, SystemSettings, User, City, BancaResult } from '../types';

// With Cloudflare Pages Functions, the API runs on the same domain as the frontend.
// All /api/* requests are handled by functions/api/* — no external backend needed.
// In development, the Vite proxy forwards /api/* to localhost:3000.
const API_BASE = '/api';

/** Lê o Bearer token e dados do usuário armazenados no localStorage */
function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('praticosys_auth');
    if (!raw) return {};
    const auth = JSON.parse(raw);
    const headers: Record<string, string> = {};
    if (auth?.token) headers['Authorization'] = `Bearer ${auth.token}`;
    if (auth?.id) headers['X-User-Id'] = auth.id;
    if (auth?.name) headers['X-User-Name'] = auth.name;
    if (auth?.role) headers['X-User-Role'] = auth.role;
    return headers;
  } catch {}
  return {};
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),           // Bearer token em todas as requisições
      ...(options?.headers as Record<string, string> | undefined ?? {}),
    },
  });

  if (!response.ok) {
    // Sessão expirada — limpa estado e redireciona para login
    if (response.status === 401) {
      localStorage.removeItem('praticosys_auth');
      window.location.href = '/#/login';
      throw new Error('Sessão expirada. Redirecionando para login...');
    }
    const errorText = await response.text();
    let msg = errorText;
    try { msg = JSON.parse(errorText)?.error ?? errorText; } catch {}
    throw new Error(msg || `Erro ${response.status}: ${response.statusText}`);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

export const api = {
  // --- AUTH ---
  login: (login: string, password?: string) => request<any>('/auth', { method: 'POST', body: JSON.stringify({ login, password }) }),
  verifyOtp: (userId: string, code: string) => request<any>('/verify-otp', { method: 'POST', body: JSON.stringify({ userId, code }) }),
  logout: () => request<void>('/session', { method: 'DELETE' }).catch(() => {}),

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
  lookupVehicle: (plate: string) => request<any>(`/vehicle-lookup?plate=${encodeURIComponent(plate)}`),

  // --- DRIVING SCHOOLS ---
  getSchools: () => request<DrivingSchool[]>('/schools'),
  createSchool: (data: Partial<DrivingSchool>) => request<DrivingSchool>('/schools', { method: 'POST', body: JSON.stringify(data) }),
  updateSchool: (id: string, data: Partial<DrivingSchool>) => request<DrivingSchool>('/schools', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteSchool: (id: string) => request<void>(`/schools?id=${id}`, { method: 'DELETE' }),

  // --- DRIVING SCHOOLS (aliases) ---
  getSchoolsAsync: () => request<DrivingSchool[]>('/schools'),

  // --- EXAM SCHEDULES ---
  getSchedules: () => request<ExamSchedule[]>('/schedules'),
  createSchedule: (data: Partial<ExamSchedule>) => request<ExamSchedule>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
  updateSchedule: (id: string, data: Partial<ExamSchedule>) => request<ExamSchedule>('/schedules', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteSchedule: (id: string) => request<void>(`/schedules?id=${id}`, { method: 'DELETE' }),
  cancelSchedule: (scheduleOrId: ExamSchedule | string, reason: string) => {
    const id = typeof scheduleOrId === 'string' ? scheduleOrId : scheduleOrId.id;
    return request<ExamSchedule>('/schedules', { method: 'PUT', body: JSON.stringify({ id, status: 'CANCELLED', cancellationReason: reason }) });
  },

  // --- EXAM REQUESTS ---
  getRequests: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ExamRequest[]>(`/requests${qs}`);
  },
  createRequest: (data: Partial<ExamRequest>) => request<ExamRequest>('/requests', { method: 'POST', body: JSON.stringify(data) }),
  updateRequest: (id: string, data: Partial<ExamRequest>) => request<ExamRequest>('/requests', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteRequest: (id: string) => request<void>(`/requests?id=${id}`, { method: 'DELETE' }),

  // --- BANCA RESULTS ---
  getBancaResults: (scheduleId?: string, schoolId?: string) => {
    const qs = scheduleId || schoolId ? '?' + new URLSearchParams({ ...(scheduleId ? { scheduleId } : {}), ...(schoolId ? { schoolId } : {}) }).toString() : '';
    return request<BancaResult[]>(`/banca-results${qs}`);
  },
  upsertBancaResult: (data: any) => request<BancaResult>('/banca-results', { method: 'POST', body: JSON.stringify(data) }),
  saveBancaResult: (data: any) => request<BancaResult>('/banca-results', { method: 'POST', body: JSON.stringify(data) }),

  // --- CITIES ---
  getCities: () => request<City[]>('/cities'),
  createCity: (data: Partial<City>) => request<City>('/cities', { method: 'POST', body: JSON.stringify(data) }),
  updateCity: (id: string, data: Partial<City>) => request<City>('/cities', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteCity: (id: string) => request<void>(`/cities?id=${id}`, { method: 'DELETE' }),

  // --- BLOCKED DATES ---
  getBlockedDates: () => request<any[]>('/blocked-dates'),
  createBlockedDate: (data: any) => request<any>('/blocked-dates', { method: 'POST', body: JSON.stringify(data) }),
  deleteBlockedDate: (id: string) => request<void>(`/blocked-dates?id=${id}`, { method: 'DELETE' }),

  // --- EVENTS ---
  getEvents: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/events${qs}`);
  },

  // --- SCHEDULE SLOTS (vagas de escala CFC/PCD) ---
  getScheduleSlots: (params?: { schoolId?: string; scheduledDate?: string }) => {
    const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return request<any[]>(`/schedule-slots${qs}`);
  },
  createScheduleSlot: (data: any) => request<any>('/schedule-slots', { method: 'POST', body: JSON.stringify(data) }),
  updateScheduleSlot: (id: string, data: any) => request<any>('/schedule-slots', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteScheduleSlot: (id: string) => request<void>(`/schedule-slots?id=${id}`, { method: 'DELETE' }),

  // --- EXAM LOCATIONS ---
  getExamLocations: () => request<ExamLocation[]>('/exam-locations'),
  createExamLocation: (data: Partial<ExamLocation>) => request<ExamLocation>('/exam-locations', { method: 'POST', body: JSON.stringify(data) }),
  updateExamLocation: (id: string, data: Partial<ExamLocation>) => request<ExamLocation>('/exam-locations', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteExamLocation: (id: string) => request<void>(`/exam-locations?id=${id}`, { method: 'DELETE' }),

  // --- BACKUPS (somente admin) ---
  getBackups: () => request<any[]>('/backups'),
  getBackupPayload: (id: string) => request<any>(`/backups?id=${id}`),
  createBackup: () => request<any>('/backups', { method: 'POST' }),

  // --- CNH BRASIL LOGS ---
  getCnhLogs: (limit = 300) => request<any[]>(`/cnh-logs?limit=${limit}`),

  // --- RISK AREA ---
  resetData: () => request<void>('/risk-area', { method: 'POST', body: JSON.stringify({ action: 'RESET_DATA' }) }),
  cleanupPhantomRequests: () => request<{ success: boolean; message: string; removed: number }>('/risk-area', { method: 'POST', body: JSON.stringify({ action: 'CLEANUP_PHANTOM_REQUESTS' }) }),

  // --- SCHEDULING HELPERS (convenience wrappers) ---
  assignStudentToSchedule: (requestId: string, scheduleId: string, category: string, currentUpdatedAt?: string, scheduledBy?: string | null) =>
    request<ExamRequest>('/requests', {
      method: 'PUT',
      body: JSON.stringify({
        id: requestId,
        scheduleId,
        scheduledCategory: category,
        status: 'SCHEDULED',
        queueUpdatedAt: currentUpdatedAt || new Date().toISOString(),
        scheduledBy: scheduledBy || null,
      }),
    }),
  addStudentToSchedule: (requestId: string, scheduleId: string, category: string, currentUpdatedAt?: string, scheduledBy?: string | null) =>
    request<ExamRequest>('/requests', {
      method: 'PUT',
      body: JSON.stringify({
        id: requestId,
        scheduleId,
        scheduledCategory: category,
        status: 'SCHEDULED',
        queueUpdatedAt: currentUpdatedAt || new Date().toISOString(),
        scheduledBy: scheduledBy || null,
      }),
    }),

  removeStudentFromSchedule: (requestId: string) =>
    request<void>('/requests', {
      method: 'PUT',
      body: JSON.stringify({
        id: requestId,
        scheduleId: null,
        scheduledCategory: null,
        status: 'WAITING_SCHEDULING',
        attendanceConfirmed: false,
        queueUpdatedAt: null,
        updatedAt: new Date().toISOString(),
      }),
    }),
};
