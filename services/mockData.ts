import { 
  User, UserRole, DrivingSchool, Examiner, Instructor, ExamSchedule, ExamRequest, 
  SystemSettings, ExamStatus, ExamType, RequestSource, ExamResultEntry 
} from '../types';

// Chaves para persistência local
const STORAGE_KEYS = {
    USERS: 'psys_users',
    SCHOOLS: 'psys_schools',
    EXAMINERS: 'psys_examiners',
    INSTRUCTORS: 'psys_instructors',
    SCHEDULES: 'psys_schedules',
    REQUESTS: 'psys_requests',
    SETTINGS: 'psys_settings'
};

const getLocal = <T>(key: string, def: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : def;
    } catch { return def; }
};
const setLocal = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const delay = (ms = 100) => new Promise(res => setTimeout(res, ms));

const fetchOrMock = async <T>(
    endpoint: string, 
    options: RequestInit = {}, 
    mockFn: () => Promise<T> | T
): Promise<T> => {
    // Aumentado para 10 segundos. Bancos gratuitos (Neon) podem demorar para "acordar"
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(`/api/${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            signal: controller.signal,
            ...options
        });
        clearTimeout(timeoutId);

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) throw new Error("API Route Not Found (HTML)");
        
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error ${res.status}`);
        }
        return await res.json();
    } catch (error: any) {
        clearTimeout(timeoutId);
        console.warn(`[API Fallback] Endpoint: ${endpoint} | Erro: ${error.message}. Usando dados locais.`);
        await delay(50); 
        return mockFn();
    }
};

export const api = {
  login: async (login: string, password?: string): Promise<User | null> => {
    // Para o login, se for admin, validamos rapidamente
    if (login === 'admin' && (password === 'admin' || password === '123456')) {
        const adminUser: User = { id: 'admin', name: 'Administrador Local', login: 'admin', role: UserRole.ADMIN };
        localStorage.setItem('praticosys_user', JSON.stringify(adminUser));
        return adminUser;
    }

    return fetchOrMock('auth', {
        method: 'POST',
        body: JSON.stringify({ login, password })
    }, async () => {
        const users = getLocal<any[]>(STORAGE_KEYS.USERS, []);
        const found = users.find((u: any) => u.login === login && u.password === password);
        if (found) localStorage.setItem('praticosys_user', JSON.stringify(found));
        return found || null;
    });
  },

  getUsers: async (): Promise<User[]> => {
    return fetchOrMock('users', {}, () => getLocal(STORAGE_KEYS.USERS, []));
  },
  createUser: async (data: any): Promise<User> => {
    return fetchOrMock('users', { method: 'POST', body: JSON.stringify(data) }, () => {
        const users = getLocal<any[]>(STORAGE_KEYS.USERS, []);
        const newUser = { ...data, id: crypto.randomUUID(), password: data.password || '123456' };
        setLocal(STORAGE_KEYS.USERS, [...users, newUser]);
        return newUser;
    });
  },
  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    return fetchOrMock('users', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
        const users = getLocal<any[]>(STORAGE_KEYS.USERS, []);
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) throw new Error("User not found");
        const updated = { ...users[idx], ...updates };
        users[idx] = updated;
        setLocal(STORAGE_KEYS.USERS, users);
        return updated;
    });
  },
  deleteUser: async (id: string): Promise<void> => {
    return fetchOrMock(`users?id=${id}`, { method: 'DELETE' }, () => {
        const users = getLocal<any[]>(STORAGE_KEYS.USERS, []);
        setLocal(STORAGE_KEYS.USERS, users.filter(u => u.id !== id));
    });
  },

  getSchools: (): DrivingSchool[] => getLocal(STORAGE_KEYS.SCHOOLS, []),
  getSchoolsAsync: async (): Promise<DrivingSchool[]> => {
      return fetchOrMock('schools', {}, () => getLocal(STORAGE_KEYS.SCHOOLS, []));
  },
  createSchool: async (data: any): Promise<DrivingSchool> => {
      return fetchOrMock('schools', { method: 'POST', body: JSON.stringify(data) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.SCHOOLS, []);
          const novo = { ...data, id: crypto.randomUUID() };
          setLocal(STORAGE_KEYS.SCHOOLS, [...list, novo]);
          return novo;
      });
  },
  updateSchool: async (id: string, updates: Partial<DrivingSchool>): Promise<DrivingSchool> => {
      return fetchOrMock('schools', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.SCHOOLS, []);
          const idx = list.findIndex(i => i.id === id);
          if (idx === -1) throw new Error("School not found");
          list[idx] = { ...list[idx], ...updates };
          setLocal(STORAGE_KEYS.SCHOOLS, list);
          return list[idx];
      });
  },
  deleteSchool: async (id: string): Promise<void> => {
      return fetchOrMock(`schools?id=${id}`, { method: 'DELETE' }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.SCHOOLS, []);
          setLocal(STORAGE_KEYS.SCHOOLS, list.filter(i => i.id !== id));
      });
  },

  getExaminers: (): Examiner[] => getLocal(STORAGE_KEYS.EXAMINERS, []), 
  getExaminersAsync: async (): Promise<Examiner[]> => {
      return fetchOrMock('examiners', {}, () => getLocal(STORAGE_KEYS.EXAMINERS, []));
  },
  createExaminer: async (data: any): Promise<Examiner> => {
      return fetchOrMock('examiners', { method: 'POST', body: JSON.stringify(data) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.EXAMINERS, []);
          const novo = { ...data, id: crypto.randomUUID() };
          setLocal(STORAGE_KEYS.EXAMINERS, [...list, novo]);
          return novo;
      });
  },
  updateExaminer: async (id: string, updates: Partial<Examiner>): Promise<Examiner> => {
      return fetchOrMock('examiners', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.EXAMINERS, []);
          const idx = list.findIndex(i => i.id === id);
          if (idx === -1) throw new Error("Examiner not found");
          list[idx] = { ...list[idx], ...updates };
          setLocal(STORAGE_KEYS.EXAMINERS, list);
          return list[idx];
      });
  },
  deleteExaminer: async (id: string): Promise<void> => {
      return fetchOrMock(`examiners?id=${id}`, { method: 'DELETE' }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.EXAMINERS, []);
          setLocal(STORAGE_KEYS.EXAMINERS, list.filter(i => i.id !== id));
      });
  },

  getInstructors: (): Instructor[] => getLocal(STORAGE_KEYS.INSTRUCTORS, []),
  getInstructorsAsync: async (): Promise<Instructor[]> => {
      return fetchOrMock('instructors', {}, () => getLocal(STORAGE_KEYS.INSTRUCTORS, []));
  },
  createInstructor: async (data: any): Promise<Instructor> => {
      return fetchOrMock('instructors', { method: 'POST', body: JSON.stringify(data) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.INSTRUCTORS, []);
          const novo = { ...data, id: crypto.randomUUID() };
          setLocal(STORAGE_KEYS.INSTRUCTORS, [...list, novo]);
          return novo;
      });
  },
  updateInstructor: async (id: string, updates: Partial<Instructor>): Promise<Instructor> => {
      return fetchOrMock('instructors', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.INSTRUCTORS, []);
          const idx = list.findIndex(i => i.id === id);
          if (idx === -1) throw new Error("Instructor not found");
          list[idx] = { ...list[idx], ...updates };
          setLocal(STORAGE_KEYS.INSTRUCTORS, list);
          return list[idx];
      });
  },
  deleteInstructor: async (id: string): Promise<void> => {
      return fetchOrMock(`instructors?id=${id}`, { method: 'DELETE' }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.INSTRUCTORS, []);
          setLocal(STORAGE_KEYS.INSTRUCTORS, list.filter(i => i.id !== id));
      });
  },

  getSettings: async (): Promise<SystemSettings> => {
      return fetchOrMock('settings', {}, () => {
          const def: SystemSettings = {
            agencyName: 'DETRAN LOCAL (MODO OFFLINE)',
            agencyAddress: '',
            maintenanceMode: false,
            maxDailySlots: 50,
            defaultMaxSlotsA: 10,
            defaultMaxSlotsB: 10,
            minDaysForScheduling: 2,
            enableEmailNotifications: false,
            enableSmsNotifications: false,
            whatsappMessageTemplate: 'Olá {CANDIDATO}, sua prova está marcada para {DATA} às {HORA}. Local: {ENDERECO}',
            defaultExamAddress: '',
            defaultExamAddressLink: '',
            logoUrl: ''
          };
          return getLocal(STORAGE_KEYS.SETTINGS, def);
      });
  },
  updateSettings: async (newSettings: SystemSettings): Promise<SystemSettings> => {
      return fetchOrMock('settings', { method: 'PUT', body: JSON.stringify(newSettings) }, () => {
          const current = getLocal(STORAGE_KEYS.SETTINGS, {});
          const updated = { ...current, ...newSettings };
          setLocal(STORAGE_KEYS.SETTINGS, updated);
          return updated;
      });
  },

  getSchedules: async (): Promise<ExamSchedule[]> => {
      return fetchOrMock('schedules', {}, () => getLocal(STORAGE_KEYS.SCHEDULES, []));
  },
  createSchedule: async (data: any): Promise<ExamSchedule> => {
      return fetchOrMock('schedules', { method: 'POST', body: JSON.stringify(data) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.SCHEDULES, []);
          const novo = { 
              ...data, 
              id: crypto.randomUUID(), 
              status: 'OPEN',
              examinerIds: data.examinerIds || [] 
          };
          setLocal(STORAGE_KEYS.SCHEDULES, [...list, novo]);
          return novo;
      });
  },
  updateSchedule: async (id: string, updates: Partial<ExamSchedule>): Promise<ExamSchedule> => {
      return fetchOrMock('schedules', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.SCHEDULES, []);
          const idx = list.findIndex(i => i.id === id);
          if (idx === -1) throw new Error("Schedule not found");
          list[idx] = { ...list[idx], ...updates };
          setLocal(STORAGE_KEYS.SCHEDULES, list);
          return list[idx];
      });
  },
  cancelSchedule: async (id: string, reason: string): Promise<ExamSchedule> => {
      return fetchOrMock('schedules', { method: 'PUT', body: JSON.stringify({ id, action: 'CANCEL', reason }) }, () => {
           const schedules = getLocal<any[]>(STORAGE_KEYS.SCHEDULES, []);
           const sIdx = schedules.findIndex(s => s.id === id);
           if (sIdx !== -1) {
               schedules[sIdx].status = 'CANCELLED';
               schedules[sIdx].cancellationReason = reason;
               setLocal(STORAGE_KEYS.SCHEDULES, schedules);
           }
           const requests = getLocal<any[]>(STORAGE_KEYS.REQUESTS, []);
           const updatedRequests = requests.map(r => r.scheduleId === id ? { ...r, status: ExamStatus.WAITING_SCHEDULING, scheduleId: undefined } : r);
           setLocal(STORAGE_KEYS.REQUESTS, updatedRequests);
           return schedules[sIdx];
      });
  },

  getRequests: async (): Promise<ExamRequest[]> => {
      return fetchOrMock('requests', {}, () => getLocal(STORAGE_KEYS.REQUESTS, []));
  },
  getRequestByCpf: async (cpf: string): Promise<ExamRequest[]> => {
      return fetchOrMock(`requests?cpf=${cpf}`, {}, () => {
          const list = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
          const cleanSearch = cpf.replace(/\D/g, '');
          return list.filter(r => r.cpf.replace(/\D/g, '').includes(cleanSearch));
      });
  },
  createRequest: async (data: any): Promise<ExamRequest> => {
      return fetchOrMock('requests', { method: 'POST', body: JSON.stringify(data) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.REQUESTS, []);
          const novo = { 
              ...data, 
              id: crypto.randomUUID(), 
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              examHistory: data.examHistory || []
          };
          setLocal(STORAGE_KEYS.REQUESTS, [...list, novo]);
          return novo;
      });
  },
  updateRequest: async (id: string, updates: Partial<ExamRequest>): Promise<ExamRequest> => {
      return fetchOrMock('requests', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
          const list = getLocal<any[]>(STORAGE_KEYS.REQUESTS, []);
          const idx = list.findIndex(i => i.id === id);
          if (idx === -1) throw new Error("Request not found");
          const updated = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
          list[idx] = updated;
          setLocal(STORAGE_KEYS.REQUESTS, list);
          return updated;
      });
  },

  assignStudentToSchedule: async (requestId: string, scheduleId: string, category: string): Promise<void> => {
      return fetchOrMock('requests/assign', { method: 'POST', body: JSON.stringify({ requestId, scheduleId, category }) }, async () => {
           const requests = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
           const rIdx = requests.findIndex(r => r.id === requestId);
           if (rIdx !== -1) {
               requests[rIdx] = { ...requests[rIdx], status: ExamStatus.SCHEDULED, scheduleId, scheduledCategory: category, updatedAt: new Date().toISOString() };
               setLocal(STORAGE_KEYS.REQUESTS, requests);
           }
      });
  },

  removeStudentFromSchedule: async (requestId: string): Promise<void> => {
      return fetchOrMock('requests/remove', { method: 'POST', body: JSON.stringify({ requestId }) }, async () => {
          const requests = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
          const rIdx = requests.findIndex(r => r.id === requestId);
          if (rIdx !== -1) {
               requests[rIdx] = { ...requests[rIdx], status: ExamStatus.WAITING_SCHEDULING, scheduleId: undefined, updatedAt: new Date().toISOString() };
               setLocal(STORAGE_KEYS.REQUESTS, requests);
          }
      });
  }
};