
import { 
  User, UserRole, DrivingSchool, Examiner, Instructor, ExamSchedule, ExamRequest, 
  SystemSettings, ExamStatus, ExamType, RequestSource
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

// Gerador de ID Universal
const genId = () => {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
};

const getLocal = <T>(key: string, def: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : def;
    } catch { return def; }
};
const setLocal = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

const calculateStatus = (dateStr: string, timeStr: string, currentStatus: string): 'OPEN' | 'CLOSED' | 'CONCLUDED' | 'CANCELLED' => {
    if (currentStatus === 'CANCELLED') return 'CANCELLED';
    if (!dateStr || !timeStr) return currentStatus as any;
    
    const cleanDate = dateStr.split('T')[0];
    const now = new Date();
    const examDate = new Date(`${cleanDate}T${timeStr}`);
    const closeThreshold = new Date(examDate.getTime() - (24 * 60 * 60 * 1000));
    const concludedThreshold = new Date(examDate.getTime() + (4 * 60 * 60 * 1000));

    if (now > concludedThreshold) return 'CONCLUDED';
    if (now > closeThreshold) return 'CLOSED';
    return 'OPEN';
};

const fetchOrMock = async <T>(
    endpoint: string, 
    options: RequestInit = {}, 
    mockFn: () => Promise<T> | T
): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const res = await fetch(`/api/${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            signal: controller.signal,
            ...options
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || `API Error ${res.status}`);
        }
        return await res.json();
    } catch (error: any) {
        clearTimeout(timeoutId);
        return mockFn();
    }
};

export const api = {
  // --- AUTH & USERS ---
  login: async (login: string, password?: string): Promise<User | null> => {
    return fetchOrMock('auth', {
        method: 'POST',
        body: JSON.stringify({ login, password })
    }, async () => {
        if (login === 'admin' && (password === 'admin' || password === '123456')) {
            const adminUser: User = { id: 'admin', name: 'Administrador Local', login: 'admin', role: UserRole.ADMIN };
            localStorage.setItem('praticosys_user', JSON.stringify(adminUser));
            return adminUser;
        }
        const users = getLocal<any[]>(STORAGE_KEYS.USERS, []);
        const found = users.find((u: any) => u.login === login && u.password === password);
        if (found) localStorage.setItem('praticosys_user', JSON.stringify(found));
        return found || null;
    });
  },
  getUsers: async (): Promise<User[]> => fetchOrMock('users', {}, () => getLocal(STORAGE_KEYS.USERS, [])),
  createUser: async (data: any): Promise<User> => fetchOrMock('users', { method: 'POST', body: JSON.stringify(data) }, () => {
        const users = getLocal<any[]>(STORAGE_KEYS.USERS, []);
        const newUser = { ...data, id: genId(), password: data.password || '123456' };
        setLocal(STORAGE_KEYS.USERS, [...users, newUser]);
        return newUser;
  }),
  updateUser: async (id: string, updates: Partial<User>): Promise<User> => fetchOrMock('users', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
        const users = getLocal<any[]>(STORAGE_KEYS.USERS, []);
        const idx = users.findIndex(u => u.id === id);
        users[idx] = { ...users[idx], ...updates };
        setLocal(STORAGE_KEYS.USERS, users);
        return users[idx];
  }),
  deleteUser: async (id: string): Promise<void> => fetchOrMock(`users?id=${id}`, { method: 'DELETE' }, () => {
        const users = getLocal<any[]>(STORAGE_KEYS.USERS, []);
        setLocal(STORAGE_KEYS.USERS, users.filter(u => u.id !== id));
  }),

  // --- SCHOOLS ---
  getSchools: (): DrivingSchool[] => getLocal(STORAGE_KEYS.SCHOOLS, []),
  getSchoolsAsync: async (): Promise<DrivingSchool[]> => fetchOrMock('schools', {}, () => getLocal(STORAGE_KEYS.SCHOOLS, [])),
  createSchool: async (data: any): Promise<DrivingSchool> => fetchOrMock('schools', { method: 'POST', body: JSON.stringify(data) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.SCHOOLS, []);
      const novo = { ...data, id: genId() };
      setLocal(STORAGE_KEYS.SCHOOLS, [...list, novo]);
      return novo;
  }),
  updateSchool: async (id: string, updates: Partial<DrivingSchool>): Promise<DrivingSchool> => fetchOrMock('schools', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.SCHOOLS, []);
      const idx = list.findIndex(i => i.id === id);
      list[idx] = { ...list[idx], ...updates };
      setLocal(STORAGE_KEYS.SCHOOLS, list);
      return list[idx];
  }),
  deleteSchool: async (id: string): Promise<void> => fetchOrMock(`schools?id=${id}`, { method: 'DELETE' }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.SCHOOLS, []);
      setLocal(STORAGE_KEYS.SCHOOLS, list.filter(i => i.id !== id));
  }),

  // --- EXAMINERS ---
  getExaminers: (): Examiner[] => getLocal(STORAGE_KEYS.EXAMINERS, []),
  getExaminersAsync: async (): Promise<Examiner[]> => fetchOrMock('examiners', {}, () => getLocal(STORAGE_KEYS.EXAMINERS, [])),
  createExaminer: async (data: any): Promise<Examiner> => fetchOrMock('examiners', { method: 'POST', body: JSON.stringify(data) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.EXAMINERS, []);
      const novo = { ...data, id: genId() };
      setLocal(STORAGE_KEYS.EXAMINERS, [...list, novo]);
      return novo;
  }),
  updateExaminer: async (id: string, updates: Partial<Examiner>): Promise<Examiner> => fetchOrMock('examiners', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.EXAMINERS, []);
      const idx = list.findIndex(i => i.id === id);
      list[idx] = { ...list[idx], ...updates };
      setLocal(STORAGE_KEYS.EXAMINERS, list);
      return list[idx];
  }),
  deleteExaminer: async (id: string): Promise<void> => fetchOrMock(`examiners?id=${id}`, { method: 'DELETE' }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.EXAMINERS, []);
      setLocal(STORAGE_KEYS.EXAMINERS, list.filter(i => i.id !== id));
  }),

  // --- INSTRUCTORS ---
  getInstructors: (): Instructor[] => getLocal(STORAGE_KEYS.INSTRUCTORS, []),
  getInstructorsAsync: async (): Promise<Instructor[]> => fetchOrMock('instructors', {}, () => getLocal(STORAGE_KEYS.INSTRUCTORS, [])),
  createInstructor: async (data: any): Promise<Instructor> => fetchOrMock('instructors', { method: 'POST', body: JSON.stringify(data) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.INSTRUCTORS, []);
      const novo = { ...data, id: genId() };
      setLocal(STORAGE_KEYS.INSTRUCTORS, [...list, novo]);
      return novo;
  }),
  updateInstructor: async (id: string, updates: Partial<Instructor>): Promise<Instructor> => fetchOrMock('instructors', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.INSTRUCTORS, []);
      const idx = list.findIndex(i => i.id === id);
      list[idx] = { ...list[idx], ...updates };
      setLocal(STORAGE_KEYS.INSTRUCTORS, list);
      return list[idx];
  }),
  deleteInstructor: async (id: string): Promise<void> => fetchOrMock(`instructors?id=${id}`, { method: 'DELETE' }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.INSTRUCTORS, []);
      setLocal(STORAGE_KEYS.INSTRUCTORS, list.filter(i => i.id !== id));
  }),

  // --- SETTINGS ---
  getSettings: async (): Promise<SystemSettings> => fetchOrMock('settings', {}, () => {
      const def: SystemSettings = {
        agencyName: 'Detran de Balneário Camboriú', 
        agencyAddress: 'Av. do Estado Dalmo Vieira, 4281 - Centro, Balneário Camboriú - SC', 
        logoUrl: '',
        maintenanceMode: false, 
        maxDailySlots: 50, 
        defaultMaxSlotsA: 10, 
        defaultMaxSlotsB: 10,
        minDaysForScheduling: 2, 
        enableEmailNotifications: false, 
        enableSmsNotifications: false,
        whatsappMessageTemplate: 'Olá, *{CANDIDATO}*! 👋😊\n\nAqui é do {AGENCIA} – Setor CNH.\nEstamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* 🚗, marcada para:\n\n📅 *{DATA}*\n⏰ *{HORA}*\n📍 *{ENDERECO}*\n\n⚠️ Não esqueça:\n🪪 _*Documento com foto (válido)*_\n🚘 _*Veículo ou moto em condições para a prova*_\n\n✅ *Posso confirmar sua presença?*\n\n⏳ _*Confirmação até amanhã às 18:00*_',
        defaultExamAddress: 'Av. do Estado Dalmo Vieira, 4281 - Centro, Balneário Camboriú - SC', 
        defaultExamAddressLink: 'https://maps.google.com'
      };
      return getLocal(STORAGE_KEYS.SETTINGS, def);
  }),
  updateSettings: async (newSettings: SystemSettings): Promise<SystemSettings> => fetchOrMock('settings', { method: 'PUT', body: JSON.stringify(newSettings) }, () => {
      const current = getLocal(STORAGE_KEYS.SETTINGS, {});
      const updated = { ...current, ...newSettings };
      setLocal(STORAGE_KEYS.SETTINGS, updated);
      return updated;
  }),

  // --- SCHEDULES ---
  getSchedules: async (): Promise<ExamSchedule[]> => fetchOrMock('schedules', {}, () => {
      let schedules = getLocal<ExamSchedule[]>(STORAGE_KEYS.SCHEDULES, []);
      let changed = false;
      schedules = schedules.map(s => {
          const newStatus = calculateStatus(s.date, s.time, s.status);
          if (newStatus !== s.status) {
              changed = true;
              return { ...s, status: newStatus };
          }
          return s;
      });
      if (changed) setLocal(STORAGE_KEYS.SCHEDULES, schedules);
      return schedules;
  }),
  createSchedule: async (data: any): Promise<ExamSchedule> => fetchOrMock('schedules', { method: 'POST', body: JSON.stringify(data) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.SCHEDULES, []);
      const cleanDate = data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0];
      const novo = { ...data, id: genId(), status: 'OPEN', examinerIds: data.examinerIds || [], date: cleanDate };
      setLocal(STORAGE_KEYS.SCHEDULES, [...list, novo]);
      return novo;
  }),
  updateSchedule: async (id: string, updates: Partial<ExamSchedule>): Promise<ExamSchedule> => fetchOrMock('schedules', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.SCHEDULES, []);
      const idx = list.findIndex(i => i.id === id);
      list[idx] = { ...list[idx], ...updates };
      setLocal(STORAGE_KEYS.SCHEDULES, list);
      return list[idx];
  }),
  cancelSchedule: async (id: string, reason: string): Promise<ExamSchedule> => fetchOrMock('schedules', { method: 'PUT', body: JSON.stringify({ id, action: 'CANCEL', reason }) }, () => {
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
  }),

  // --- REQUESTS ---
  getRequests: async (): Promise<ExamRequest[]> => fetchOrMock('requests', {}, () => getLocal(STORAGE_KEYS.REQUESTS, [])),
  getRequestByCpf: async (cpf: string): Promise<ExamRequest[]> => fetchOrMock(`requests?cpf=${cpf}`, {}, () => {
      const list = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
      const cleanSearch = cpf.replace(/\D/g, '');
      return list.filter(r => r.cpf.replace(/\D/g, '').includes(cleanSearch));
  }),
  createRequest: async (data: any): Promise<ExamRequest> => fetchOrMock('requests', { method: 'POST', body: JSON.stringify(data) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.REQUESTS, []);
      const novo = { ...data, id: genId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), examHistory: data.examHistory || [] };
      setLocal(STORAGE_KEYS.REQUESTS, [...list, novo]);
      return novo;
  }),
  updateRequest: async (id: string, updates: Partial<ExamRequest>): Promise<ExamRequest> => fetchOrMock('requests', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.REQUESTS, []);
      const idx = list.findIndex(i => i.id === id);
      const updated = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
      list[idx] = updated;
      setLocal(STORAGE_KEYS.REQUESTS, list);
      return updated;
  }),

  // --- ACTIONS ---
  assignStudentToSchedule: async (requestId: string, scheduleId: string, category: string): Promise<void> => {
       const payload = { id: requestId, status: ExamStatus.SCHEDULED, scheduleId: scheduleId, scheduledCategory: category };
       return fetchOrMock('requests', { method: 'PUT', body: JSON.stringify(payload) }, async () => {
           const requests = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
           const rIdx = requests.findIndex(r => r.id === requestId);
           if (rIdx !== -1) {
               requests[rIdx] = { ...requests[rIdx], status: ExamStatus.SCHEDULED, scheduleId, scheduledCategory: category, updatedAt: new Date().toISOString() };
               setLocal(STORAGE_KEYS.REQUESTS, requests);
           }
       });
  },
  removeStudentFromSchedule: async (requestId: string): Promise<void> => {
      const payload = { id: requestId, status: ExamStatus.WAITING_SCHEDULING, scheduleId: null, scheduledCategory: null, attendanceConfirmed: false };
      return fetchOrMock('requests', { method: 'PUT', body: JSON.stringify(payload) }, async () => {
          const requests = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
          const rIdx = requests.findIndex(r => r.id === requestId);
          if (rIdx !== -1) {
               requests[rIdx] = { ...requests[rIdx], status: ExamStatus.WAITING_SCHEDULING, scheduleId: undefined, scheduledCategory: undefined, attendanceConfirmed: false, updatedAt: new Date().toISOString() };
               setLocal(STORAGE_KEYS.REQUESTS, requests);
           }
      });
  }
};
