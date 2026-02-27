import { ExamRequest, ExamSchedule, Examiner, Instructor, School, SystemSettings, User } from '../types';

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
  login: (login: string, password?: string) => request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
  
  // --- USERS ---
  getUsers: () => request<User[]>('/users'),
  createUser: (data: any) => request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<User>) => request<User>('/users', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteUser: (id: string) => request<void>(`/users?id=${id}`, { method: 'DELETE' }),

  // --- SETTINGS ---
  getSettings: () => request<SystemSettings>('/settings'),
  updateSettings: (settings: Partial<SystemSettings>) => request<SystemSettings>('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // --- EXAMINERS ---
  getExaminersAsync: () => request<Examiner[]>('/examiners'),
  createExaminer: (data: Partial<Examiner>) => request<Examiner>('/examiners', { method: 'POST', body: JSON.stringify(data) }),
  updateExaminer: (id: string, data: Partial<Examiner>) => request<Examiner>('/examiners', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteExaminer: (id: string) => request<void>(`/examiners?id=${id}`, { method: 'DELETE' }),

  // --- INSTRUCTORS ---
  getInstructors: () => request<Instructor[]>('/instructors'),
  createInstructor: (data: Partial<Instructor>) => request<Instructor>('/instructors', { method: 'POST', body: JSON.stringify(data) }),
  updateInstructor: (id: string, data: Partial<Instructor>) => request<Instructor>('/instructors', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
  deleteInstructor: (id: string) => request<void>(`/instructors?id=${id}`, { method: 'DELETE' }),

  // --- SCHOOLS ---
  getSchools: () => request<School[]>('/schools'),
  createSchool: (data: Partial<School>) => request<School>('/schools', { method: 'POST', body: JSON.stringify(data) }),
  updateSchool: (id: string, data: Partial<School>) => request<School>('/schools', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
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

  // --- ACTIONS ---
  assignStudentToSchedule: (requestId: string, scheduleId: string, category: string) => 
    request<void>('/requests', { 
      method: 'PUT', 
      body: JSON.stringify({ 
        id: requestId, 
        scheduleId, 
        scheduledCategory: category,
        status: 'SCHEDULED' // ExamStatus.SCHEDULED
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
        attendanceConfirmed: false 
      }) 
    }),
};
