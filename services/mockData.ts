
// Mock Data Service
import { 
  User, UserRole, DrivingSchool, Examiner, Instructor, ExamSchedule, ExamRequest, 
  SystemSettings, ExamStatus, City
} from '../types';

// ============================================================================
// STORE EM MEMÓRIA (VOLÁTIL) - SUBSTITUI O LOCALSTORAGE
// ============================================================================
// Se a API falhar, os dados ficam apenas aqui e somem ao recarregar a página.
// Isso impede que dados corrompidos persistam no navegador.
const MEMORY_STORE = {
    users: [] as any[],
    schools: [] as any[],
    examiners: [] as any[],
    instructors: [] as any[],
    cities: [] as any[],
    schedules: [
        {
            id: 'sch_1',
            code: 'B1001',
            date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
            time: '08:00',
            examinerIds: [],
            maxSlotsA: 10,
            maxSlotsB: 10,
            type: 'COMMON',
            status: 'OPEN'
        },
        {
            id: 'sch_2',
            code: 'B1002',
            date: new Date(Date.now() + 172800000).toISOString().split('T')[0], // Day after tomorrow
            time: '09:00',
            examinerIds: [],
            maxSlotsA: 15,
            maxSlotsB: 15,
            type: 'COMMON',
            status: 'OPEN'
        },
        {
            id: 'sch_3',
            code: 'B1003',
            date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
            time: '10:00',
            examinerIds: [],
            maxSlotsA: 10,
            maxSlotsB: 10,
            type: 'COMMON',
            status: 'CONCLUDED'
        },
        {
            id: 'sch_4',
            code: 'B1004',
            date: new Date(Date.now() + 259200000).toISOString().split('T')[0], // 3 days later
            time: '13:30',
            examinerIds: [],
            maxSlotsA: 12,
            maxSlotsB: 12,
            type: 'COMMON',
            status: 'OPEN'
        },
        {
            id: 'sch_5',
            code: 'B1005',
            date: new Date(Date.now() + 345600000).toISOString().split('T')[0], // 4 days later
            time: '14:00',
            examinerIds: [],
            maxSlotsA: 20,
            maxSlotsB: 20,
            type: 'COMMON',
            status: 'OPEN'
        }
    ] as any[],
    requests: [] as any[],
    settings: {
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
        whatsappMessageTemplate: `Olá, *{CANDIDATO}*! [WAVE][SMILE]

Aqui é do {AGENCIA} – Setor CNH.
Estamos confirmando sua presença na Prova Prática *(Categoria {CATEGORIA})* [CAR], marcada para:

[CALENDAR] *{DATA}*
[CLOCK] *{HORA}*
[MAP] *{ENDERECO}*

[WARNING] Não esqueça:
[ID] _*Documento com foto (válido)*_
[CAR_FRONT] _*Veículo ou moto em condições para a prova*_

[CHECK] *Posso confirmar sua presença?*

[HOURGLASS] _*Confirmação até amanhã às 18:00*_`,
        defaultExamAddress: 'Av. do Estado Dalmo Vieira, 4281 - Centro, Balneário Camboriú - SC', 
        defaultExamAddressLink: 'https://maps.google.com',
        restrictions: [
            { code: 'A', description: 'Obrigatório o uso de lentes corretivas' },
            { code: 'B', description: 'Obrigatório o uso de prótese auditiva' },
            { code: 'C', description: 'Obrigatório o uso de acelerador à esquerda' },
            { code: 'D', description: 'Obrigatório o uso de veículo com transmissão automática' },
            { code: 'E', description: 'Obrigatório o uso de empunhadura/manopla no volante' },
            { code: 'F', description: 'Obrigatório o uso de veículo com direção hidráulica' },
            { code: 'G', description: 'Obrigatório o uso de veículo com embreagem automática' },
            { code: 'H', description: 'Obrigatório o uso de acelerador e freio manual' },
            { code: 'I', description: 'Obrigatório o uso de adaptação dos comandos de painel ao volante' },
            { code: 'J', description: 'Obrigatório o uso de adaptação dos comandos de painel para os membros inferiores e/ou outras partes do corpo' },
            { code: 'K', description: 'Obrigatório o uso de veículo com prolongamento da alavanca de câmbio e/ou almofadas (fixas) de compensação de altura e/ou profundidade' },
            { code: 'L', description: 'Obrigatório o uso de veículo com prolongadores dos pedais de freio e acelerador e/ou almofadas (fixas) de compensação de altura e/ou profundidade' },
            { code: 'M', description: 'Obrigatório o uso de motocicleta com pedal de câmbio adaptado' },
            { code: 'N', description: 'Obrigatório o uso de motocicleta com pedal de freio traseiro adaptado' },
            { code: 'O', description: 'Obrigatório o uso de motocicleta com manopla do freio dianteiro adaptada' },
            { code: 'P', description: 'Obrigatório o uso de motocicleta com manopla do acelerador adaptada' },
            { code: 'Q', description: 'Obrigatório o uso de motocicleta com manopla de embreagem adaptada' },
            { code: 'R', description: 'Obrigatório o uso de motoneta com pedal de freio traseiro adaptado' },
            { code: 'S', description: 'Obrigatório o uso de motocicleta com transmissão automática' },
            { code: 'T', description: 'Vedado dirigir em rodovias e vias de trânsito rápido' },
            { code: 'U', description: 'Vedado dirigir após o pôr-do-sol e antes do amanhecer' },
            { code: 'V', description: 'Obrigatório o uso de capacete de segurança com viseira protetora sem limitação de campo visual' },
            { code: 'W', description: 'Aposentado por invalidez' },
            { code: 'X', description: 'Outras restrições' },
            { code: 'Z', description: 'Visão Monocular' }
        ]
    } as SystemSettings
};

// ============================================================================
// LIMPEZA PROFUNDA (GARBAGE COLLECTION)
// ============================================================================
// Remove chaves antigas do LocalStorage para garantir que nada corrompido sobrevive.
try {
    const keysToRemove = [
        'psys_users', 'psys_schools', 'psys_examiners', 'psys_instructors', 
        'psys_schedules', 'psys_requests', 'psys_settings', 'praticosys_user'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    console.log("Sistema limpo: LocalStorage removido com sucesso.");
} catch (e) {
    // Ignora erros de acesso (ex: modo anônimo restrito)
}

// Gerador de ID Universal
const genId = () => {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
};

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
            throw new Error((errorData.error || `API Error ${res.status}`) + (errorData.details ? `: ${errorData.details}` : ''));
        }
        return await res.json();
    } catch (error: any) {
        clearTimeout(timeoutId);
        // Em caso de falha da API, usa a memória RAM limpa
        console.warn(`[API FALHOU] Usando memória RAM para ${endpoint}. Motivo:`, error.message);
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
        // Fallback de Emergência (Sem Banco)
        if (login === 'admin' && (password === 'admin' || password === '123456')) {
            const adminUser: User = { id: 'admin', name: 'Administrador (RAM)', login: 'admin', role: UserRole.ADMIN };
            return adminUser;
        }
        const found = MEMORY_STORE.users.find((u: any) => u.login === login && u.password === password);
        return found || null;
    });
  },
  getUsers: async (): Promise<User[]> => fetchOrMock('users', {}, () => MEMORY_STORE.users),
  createUser: async (data: any): Promise<User> => fetchOrMock('users', { method: 'POST', body: JSON.stringify(data) }, () => {
        const newUser = { ...data, id: genId(), password: data.password || '123456' };
        MEMORY_STORE.users.push(newUser);
        return newUser;
  }),
  updateUser: async (id: string, updates: Partial<User>): Promise<User> => fetchOrMock('users', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
        const idx = MEMORY_STORE.users.findIndex(u => u.id === id);
        if (idx !== -1) MEMORY_STORE.users[idx] = { ...MEMORY_STORE.users[idx], ...updates };
        return MEMORY_STORE.users[idx];
  }),
  deleteUser: async (id: string): Promise<void> => fetchOrMock(`users?id=${id}`, { method: 'DELETE' }, () => {
        MEMORY_STORE.users = MEMORY_STORE.users.filter(u => u.id !== id);
  }),

  // --- SCHOOLS ---
  getSchools: (): DrivingSchool[] => MEMORY_STORE.schools,
  getSchoolsAsync: async (): Promise<DrivingSchool[]> => fetchOrMock('schools', {}, () => MEMORY_STORE.schools),
  createSchool: async (data: any): Promise<DrivingSchool> => fetchOrMock('schools', { method: 'POST', body: JSON.stringify(data) }, () => {
      const novo = { ...data, id: genId() };
      MEMORY_STORE.schools.push(novo);
      return novo;
  }),
  updateSchool: async (id: string, updates: Partial<DrivingSchool>): Promise<DrivingSchool> => fetchOrMock('schools', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const idx = MEMORY_STORE.schools.findIndex(i => i.id === id);
      if (idx !== -1) MEMORY_STORE.schools[idx] = { ...MEMORY_STORE.schools[idx], ...updates };
      return MEMORY_STORE.schools[idx];
  }),
  deleteSchool: async (id: string): Promise<void> => fetchOrMock(`schools?id=${id}`, { method: 'DELETE' }, () => {
      MEMORY_STORE.schools = MEMORY_STORE.schools.filter(i => i.id !== id);
  }),

  // --- EXAMINERS ---
  getExaminers: (): Examiner[] => MEMORY_STORE.examiners,
  getExaminersAsync: async (): Promise<Examiner[]> => fetchOrMock('examiners', {}, () => MEMORY_STORE.examiners),
  createExaminer: async (data: any): Promise<Examiner> => fetchOrMock('examiners', { method: 'POST', body: JSON.stringify(data) }, () => {
      const novo = { ...data, id: genId() };
      MEMORY_STORE.examiners.push(novo);
      return novo;
  }),
  updateExaminer: async (id: string, updates: Partial<Examiner>): Promise<Examiner> => fetchOrMock('examiners', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const idx = MEMORY_STORE.examiners.findIndex(i => i.id === id);
      if (idx !== -1) MEMORY_STORE.examiners[idx] = { ...MEMORY_STORE.examiners[idx], ...updates };
      return MEMORY_STORE.examiners[idx];
  }),
  deleteExaminer: async (id: string): Promise<void> => fetchOrMock(`examiners?id=${id}`, { method: 'DELETE' }, () => {
      MEMORY_STORE.examiners = MEMORY_STORE.examiners.filter(i => i.id !== id);
  }),

  // --- INSTRUCTORS ---
  getInstructors: (): Instructor[] => MEMORY_STORE.instructors,
  getInstructorsAsync: async (): Promise<Instructor[]> => fetchOrMock('instructors', {}, () => MEMORY_STORE.instructors),
  createInstructor: async (data: any): Promise<Instructor> => fetchOrMock('instructors', { method: 'POST', body: JSON.stringify(data) }, () => {
      const novo = { ...data, id: genId() };
      MEMORY_STORE.instructors.push(novo);
      return novo;
  }),
  updateInstructor: async (id: string, updates: Partial<Instructor>): Promise<Instructor> => fetchOrMock('instructors', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const idx = MEMORY_STORE.instructors.findIndex(i => i.id === id);
      if (idx !== -1) MEMORY_STORE.instructors[idx] = { ...MEMORY_STORE.instructors[idx], ...updates };
      return MEMORY_STORE.instructors[idx];
  }),
  deleteInstructor: async (id: string): Promise<void> => fetchOrMock(`instructors?id=${id}`, { method: 'DELETE' }, () => {
      MEMORY_STORE.instructors = MEMORY_STORE.instructors.filter(i => i.id !== id);
  }),

  // --- SETTINGS ---
  getSettings: async (): Promise<SystemSettings> => fetchOrMock('settings', {}, () => MEMORY_STORE.settings),
  updateSettings: async (newSettings: SystemSettings): Promise<SystemSettings> => fetchOrMock('settings', { method: 'PUT', body: JSON.stringify(newSettings) }, () => {
      MEMORY_STORE.settings = { ...MEMORY_STORE.settings, ...newSettings };
      return MEMORY_STORE.settings;
  }),

  // --- SCHEDULES ---
  getSchedules: async (): Promise<ExamSchedule[]> => fetchOrMock('schedules', {}, () => {
      MEMORY_STORE.schedules = MEMORY_STORE.schedules.map((s: any) => {
          const newStatus = calculateStatus(s.date, s.time, s.status);
          return { ...s, status: newStatus };
      });
      return MEMORY_STORE.schedules;
  }),
  createSchedule: async (data: any): Promise<ExamSchedule> => fetchOrMock('schedules', { method: 'POST', body: JSON.stringify(data) }, () => {
      const cleanDate = data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0];
      
      // Mock code generation
      let nextCode = 'B1000';
      const lastSchedule = MEMORY_STORE.schedules[MEMORY_STORE.schedules.length - 1];
      if (lastSchedule && lastSchedule.code) {
          const num = parseInt(lastSchedule.code.replace('B', ''), 10);
          if (!isNaN(num)) nextCode = `B${num + 1}`;
      }

      const novo = { ...data, id: genId(), code: nextCode, status: 'OPEN', examinerIds: data.examinerIds || [], date: cleanDate };
      MEMORY_STORE.schedules.push(novo);
      return novo;
  }),
  updateSchedule: async (id: string, updates: Partial<ExamSchedule>): Promise<ExamSchedule> => fetchOrMock('schedules', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const idx = MEMORY_STORE.schedules.findIndex((i: any) => i.id === id);
      if (idx !== -1) MEMORY_STORE.schedules[idx] = { ...MEMORY_STORE.schedules[idx], ...updates };
      return MEMORY_STORE.schedules[idx];
  }),
  cancelSchedule: async (id: string, reason: string): Promise<ExamSchedule> => fetchOrMock('schedules', { method: 'PUT', body: JSON.stringify({ id, action: 'CANCEL', reason }) }, () => {
       const sIdx = MEMORY_STORE.schedules.findIndex((s: any) => s.id === id);
       if (sIdx !== -1) {
           MEMORY_STORE.schedules[sIdx].status = 'CANCELLED';
           MEMORY_STORE.schedules[sIdx].cancellationReason = reason;
       }
       MEMORY_STORE.requests = MEMORY_STORE.requests.map((r: any) => r.scheduleId === id ? { ...r, status: ExamStatus.WAITING_SCHEDULING, scheduleId: undefined } : r);
       return MEMORY_STORE.schedules[sIdx];
  }),
  deleteSchedule: async (id: string): Promise<void> => fetchOrMock(`schedules?id=${id}`, { method: 'DELETE' }, () => {
      MEMORY_STORE.schedules = MEMORY_STORE.schedules.filter(s => s.id !== id);
  }),

  // --- REQUESTS ---
  getRequests: async (): Promise<ExamRequest[]> => fetchOrMock('requests', {}, () => MEMORY_STORE.requests),
  getRequestByCpf: async (cpf: string): Promise<ExamRequest[]> => fetchOrMock(`requests?cpf=${cpf}`, {}, () => {
      const cleanSearch = cpf.replace(/\D/g, '');
      return MEMORY_STORE.requests.filter((r: any) => r.cpf.replace(/\D/g, '').includes(cleanSearch));
  }),
  createRequest: async (data: any): Promise<ExamRequest> => fetchOrMock('requests', { method: 'POST', body: JSON.stringify(data) }, () => {
      const novo = { ...data, id: genId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), examHistory: data.examHistory || [] };
      MEMORY_STORE.requests.push(novo);
      return novo;
  }),
  updateRequest: async (id: string, updates: Partial<ExamRequest>): Promise<ExamRequest> => fetchOrMock('requests', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const idx = MEMORY_STORE.requests.findIndex((i: any) => i.id === id);
      const updated = { ...MEMORY_STORE.requests[idx], ...updates, updatedAt: new Date().toISOString() };
      MEMORY_STORE.requests[idx] = updated;
      return updated;
  }),
  deleteRequest: async (id: string): Promise<void> => fetchOrMock(`requests?id=${id}`, { method: 'DELETE' }, () => {
      MEMORY_STORE.requests = MEMORY_STORE.requests.filter(r => r.id !== id);
  }),

  // --- CITIES ---
  getCities: async (): Promise<City[]> => fetchOrMock('cities', {}, () => MEMORY_STORE.cities),
  createCity: async (data: Partial<City>): Promise<City> => fetchOrMock('cities', { method: 'POST', body: JSON.stringify(data) }, () => {
      const novo = { id: genId(), name: (data.name || '').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""), createdAt: new Date().toISOString() };
      MEMORY_STORE.cities.push(novo);
      return novo;
  }),
  updateCity: async (id: string, data: Partial<City>): Promise<City> => fetchOrMock('cities', { method: 'PUT', body: JSON.stringify({ id, ...data }) }, () => {
      const idx = MEMORY_STORE.cities.findIndex(c => c.id === id);
      if (idx !== -1) {
          MEMORY_STORE.cities[idx] = { ...MEMORY_STORE.cities[idx], ...data, name: (data.name || MEMORY_STORE.cities[idx].name).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") };
      }
      return MEMORY_STORE.cities[idx];
  }),
  deleteCity: async (id: string): Promise<void> => fetchOrMock(`cities?id=${id}`, { method: 'DELETE' }, () => {
      MEMORY_STORE.cities = MEMORY_STORE.cities.filter(c => c.id !== id);
  }),

  // --- ACTIONS ---
  assignStudentToSchedule: async (requestId: string, scheduleId: string, category: string): Promise<void> => {
       const payload = { id: requestId, status: ExamStatus.SCHEDULED, scheduleId: scheduleId, scheduledCategory: category };
       return fetchOrMock('requests', { method: 'PUT', body: JSON.stringify(payload) }, async () => {
           const idx = MEMORY_STORE.requests.findIndex((r: any) => r.id === requestId);
           if (idx !== -1) {
               MEMORY_STORE.requests[idx] = { ...MEMORY_STORE.requests[idx], status: ExamStatus.SCHEDULED, scheduleId, scheduledCategory: category, updatedAt: new Date().toISOString() };
           }
       });
  },
  removeStudentFromSchedule: async (requestId: string): Promise<void> => {
      const payload = { id: requestId, status: ExamStatus.WAITING_SCHEDULING, scheduleId: null, scheduledCategory: null, attendanceConfirmed: false };
      return fetchOrMock('requests', { method: 'PUT', body: JSON.stringify(payload) }, async () => {
          const idx = MEMORY_STORE.requests.findIndex((r: any) => r.id === requestId);
          if (idx !== -1) {
               MEMORY_STORE.requests[idx] = { ...MEMORY_STORE.requests[idx], status: ExamStatus.WAITING_SCHEDULING, scheduleId: undefined, scheduledCategory: undefined, attendanceConfirmed: false, updatedAt: new Date().toISOString() };
           }
      });
  }
};
