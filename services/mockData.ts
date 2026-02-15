
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

// Gerador de ID Universal (Funciona em HTTP e ambientes antigos)
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
const delay = (ms = 100) => new Promise(res => setTimeout(res, ms));

// --- MOCK DATA SEEDER ---
const seedDatabase = () => {
    // 1. Seed Examinadores
    if (!localStorage.getItem(STORAGE_KEYS.EXAMINERS)) {
        const mockExaminers: Examiner[] = [
            { id: 'ex_1', name: 'CARLOS SILVA', registrationNumber: '12345', canExamCommon: true, canExamPCD: true },
            { id: 'ex_2', name: 'ANA SOUZA', registrationNumber: '67890', canExamCommon: true, canExamPCD: false },
            { id: 'ex_3', name: 'ROBERTO ALMEIDA', registrationNumber: '11223', canExamCommon: true, canExamPCD: false },
            { id: 'ex_4', name: 'FERNANDA COSTA', registrationNumber: '44556', canExamCommon: true, canExamPCD: true },
            { id: 'ex_5', name: 'MARCOS PEREIRA', registrationNumber: '99887', canExamCommon: true, canExamPCD: false },
        ];
        setLocal(STORAGE_KEYS.EXAMINERS, mockExaminers);
    }

    // 2. Seed Instrutores
    if (!localStorage.getItem(STORAGE_KEYS.INSTRUCTORS)) {
        const mockInstructors: Instructor[] = [
            { id: 'inst_1', name: 'JOÃO OLIVEIRA', cpf: '111.111.111-11', phone: '(11) 99999-1111', plate: 'ABC1D23' },
            { id: 'inst_2', name: 'MARIA SANTOS', cpf: '222.222.222-22', phone: '(11) 99999-2222', plate: 'XYZ9A88' },
            { id: 'inst_3', name: 'PEDRO LIMA', cpf: '333.333.333-33', phone: '(11) 99999-3333', plate: 'KPL2J55' },
            { id: 'inst_4', name: 'JULIA MARTINS', cpf: '444.444.444-44', phone: '(11) 99999-4444', plate: 'BMW3X99' },
            { id: 'inst_5', name: 'LUCAS FERREIRA', cpf: '555.555.555-55', phone: '(11) 99999-5555', plate: 'HND4H44' },
        ];
        setLocal(STORAGE_KEYS.INSTRUCTORS, mockInstructors);
    }

    // 3. Seed Candidatos (Requests)
    if (!localStorage.getItem(STORAGE_KEYS.REQUESTS)) {
        const baseRequest = {
            email: 'aluno@teste.com', address: 'Rua Teste, 123', examType: ExamType.COMMON, 
            source: RequestSource.SCHOOL, paidFee: true, completedPracticalCourse: true, 
            practicalHours: 20, hasVehicle: true, examHistory: [],
            desiredDate: new Date().toISOString().split('T')[0]
        };
        
        const mockRequests: ExamRequest[] = [
            { ...baseRequest, id: 'req_1', studentName: 'GABRIEL MEDINA', cpf: '123.456.789-00', phone: '(11) 91111-1111', status: ExamStatus.WAITING_SCHEDULING, intendedCategory: 'B', instructor: 'JOÃO OLIVEIRA', vehiclePlate: 'ABC1D23', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { ...baseRequest, id: 'req_2', studentName: 'RAYSSA LEAL', cpf: '234.567.890-11', phone: '(11) 92222-2222', status: ExamStatus.WAITING_SCHEDULING, intendedCategory: 'A', instructor: 'MARIA SANTOS', vehiclePlate: 'XYZ9A88', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { ...baseRequest, id: 'req_3', studentName: 'ITALO FERREIRA', cpf: '345.678.901-22', phone: '(11) 93333-3333', status: ExamStatus.WAITING_SCHEDULING, intendedCategory: 'B', instructor: 'PEDRO LIMA', vehiclePlate: 'KPL2J55', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { ...baseRequest, id: 'req_4', studentName: 'BEATRIZ HADDAD', cpf: '456.789.012-33', phone: '(11) 94444-4444', status: ExamStatus.SCHEDULED, intendedCategory: 'B', scheduledCategory: 'B', scheduledDate: '2024-03-20', scheduledTime: '08:00', instructor: 'JULIA MARTINS', vehiclePlate: 'BMW3X99', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { ...baseRequest, id: 'req_5', studentName: 'AYRTON SENNA', cpf: '567.890.123-44', phone: '(11) 95555-5555', status: ExamStatus.DONE, result: 'APTO', intendedCategory: 'B', instructor: 'JOÃO OLIVEIRA', vehiclePlate: 'ABC1D23', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { ...baseRequest, id: 'req_6', studentName: 'RUBENS BARRICHELLO', cpf: '678.901.234-55', phone: '(11) 96666-6666', status: ExamStatus.DONE, result: 'INAPTO', intendedCategory: 'B', instructor: 'PEDRO LIMA', vehiclePlate: 'KPL2J55', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { ...baseRequest, id: 'req_7', studentName: 'FELIPE MASSA', cpf: '789.012.345-66', phone: '(11) 97777-7777', status: ExamStatus.RETEST, intendedCategory: 'B', instructor: 'LUCAS FERREIRA', vehiclePlate: 'HND4H44', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        ];

        setLocal(STORAGE_KEYS.REQUESTS, mockRequests);
    }
};

// Executa o seed ao carregar o arquivo
seedDatabase();

const calculateStatus = (dateStr: string, timeStr: string, currentStatus: string): 'OPEN' | 'CLOSED' | 'CONCLUDED' | 'CANCELLED' => {
    if (currentStatus === 'CANCELLED') return 'CANCELLED';
    if (!dateStr || !timeStr) return currentStatus as 'OPEN' | 'CLOSED' | 'CONCLUDED' | 'CANCELLED';
    
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
    const timeoutId = setTimeout(() => controller.abort(), 2000);

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
        if (!error.message.includes('Aborted')) {
             console.debug(`[Offline Mode] Usando dados locais para: ${endpoint}`);
        }
        await delay(50); 
        return mockFn();
    }
};

export const api = {
  // --- AUTH & USERS ---
  login: async (login: string, password?: string): Promise<User | null> => {
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
        if (idx === -1) throw new Error("User not found");
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
        agencyName: 'DETRAN LOCAL',
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
  }),
  updateSettings: async (newSettings: SystemSettings): Promise<SystemSettings> => fetchOrMock('settings', { method: 'PUT', body: JSON.stringify(newSettings) }, () => {
      const current = getLocal(STORAGE_KEYS.SETTINGS, {});
      const updated = { ...current, ...newSettings };
      setLocal(STORAGE_KEYS.SETTINGS, updated);
      return updated;
  }),

  // --- SCHEDULES (BANCAS) ---
  getSchedules: async (): Promise<ExamSchedule[]> => fetchOrMock('schedules', {}, () => {
      let schedules = getLocal<ExamSchedule[]>(STORAGE_KEYS.SCHEDULES, []);
      let requests = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
      
      let changed = false;
      let requestsChanged = false;

      schedules = schedules.map(s => {
          const newStatus = calculateStatus(s.date, s.time, s.status);
          
          if (newStatus !== s.status) {
              changed = true;
              if (newStatus === 'CONCLUDED' && s.status !== 'CONCLUDED') {
                  requestsChanged = true;
                  requests = requests.map(r => {
                      if (r.scheduleId === s.id && r.status === ExamStatus.SCHEDULED) {
                          return { ...r, status: ExamStatus.WAITING_RESULT, updatedAt: new Date().toISOString() };
                      }
                      return r;
                  });
              }
              return { ...s, status: newStatus };
          }
          return s;
      });

      if (changed) setLocal(STORAGE_KEYS.SCHEDULES, schedules);
      if (requestsChanged) setLocal(STORAGE_KEYS.REQUESTS, requests);

      return schedules;
  }),
  createSchedule: async (data: any): Promise<ExamSchedule> => fetchOrMock('schedules', { method: 'POST', body: JSON.stringify(data) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.SCHEDULES, []);
      const cleanDate = data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0];
      const initialStatus = calculateStatus(cleanDate, data.time, 'OPEN');
      const novo = { 
          ...data, 
          id: genId(), 
          status: initialStatus,
          examinerIds: data.examinerIds || [],
          date: cleanDate
      };
      setLocal(STORAGE_KEYS.SCHEDULES, [...list, novo]);
      return novo;
  }),
  updateSchedule: async (id: string, updates: Partial<ExamSchedule>): Promise<ExamSchedule> => fetchOrMock('schedules', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.SCHEDULES, []);
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) throw new Error("Schedule not found");
      let updated = { ...list[idx], ...updates };
      if (updated.date) updated.date = updated.date.split('T')[0];
      const newStatus = calculateStatus(updated.date, updated.time, updated.status);
      updated.status = newStatus;
      list[idx] = updated;
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
       const updatedRequests = requests.map(r => r.scheduleId === id ? { 
           ...r, 
           status: ExamStatus.WAITING_SCHEDULING, 
           scheduleId: undefined, 
           scheduledDate: undefined, 
           scheduledTime: undefined, 
           scheduledCategory: undefined, 
           attendanceConfirmed: false 
       } : r);
       setLocal(STORAGE_KEYS.REQUESTS, updatedRequests);
       return schedules[sIdx];
  }),

  // --- REQUESTS (CANDIDATOS) ---
  getRequests: async (): Promise<ExamRequest[]> => fetchOrMock('requests', {}, () => getLocal(STORAGE_KEYS.REQUESTS, [])),
  getRequestByCpf: async (cpf: string): Promise<ExamRequest[]> => fetchOrMock(`requests?cpf=${cpf}`, {}, () => {
      const list = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
      const cleanSearch = cpf.replace(/\D/g, '');
      return list.filter(r => r.cpf.replace(/\D/g, '').includes(cleanSearch));
  }),
  createRequest: async (data: any): Promise<ExamRequest> => fetchOrMock('requests', { method: 'POST', body: JSON.stringify(data) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.REQUESTS, []);
      const novo = { 
          ...data, 
          id: genId(), 
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          examHistory: data.examHistory || []
      };
      setLocal(STORAGE_KEYS.REQUESTS, [...list, novo]);
      return novo;
  }),
  updateRequest: async (id: string, updates: Partial<ExamRequest>): Promise<ExamRequest> => fetchOrMock('requests', { method: 'PUT', body: JSON.stringify({ id, ...updates }) }, () => {
      const list = getLocal<any[]>(STORAGE_KEYS.REQUESTS, []);
      const idx = list.findIndex(i => i.id === id);
      if (idx === -1) throw new Error("Request not found");
      const updated = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
      list[idx] = updated;
      setLocal(STORAGE_KEYS.REQUESTS, list);
      return updated;
  }),

  // --- ACTIONS (ATRIBUIÇÃO E REMOÇÃO) ---
  // CORREÇÃO: Agora usa o endpoint PUT padrão de 'requests' para garantir persistência real no banco de dados.
  assignStudentToSchedule: async (requestId: string, scheduleId: string, category: string): Promise<void> => {
       const payload = {
           id: requestId,
           status: ExamStatus.SCHEDULED,
           scheduleId: scheduleId,
           scheduledCategory: category
       };

       return fetchOrMock('requests', { method: 'PUT', body: JSON.stringify(payload) }, async () => {
           const requests = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
           const rIdx = requests.findIndex(r => r.id === requestId);
           if (rIdx !== -1) {
               requests[rIdx] = { 
                   ...requests[rIdx], 
                   status: ExamStatus.SCHEDULED, 
                   scheduleId, 
                   scheduledCategory: category, 
                   updatedAt: new Date().toISOString() 
               };
               setLocal(STORAGE_KEYS.REQUESTS, requests);
           }
       });
  },
  
  removeStudentFromSchedule: async (requestId: string): Promise<void> => {
      const payload = {
          id: requestId,
          status: ExamStatus.WAITING_SCHEDULING,
          scheduleId: null,
          scheduledDate: null,
          scheduledTime: null,
          scheduledCategory: null,
          attendanceConfirmed: false
      };

      return fetchOrMock('requests', { method: 'PUT', body: JSON.stringify(payload) }, async () => {
          const requests = getLocal<ExamRequest[]>(STORAGE_KEYS.REQUESTS, []);
          const rIdx = requests.findIndex(r => r.id === requestId);
          if (rIdx !== -1) {
               requests[rIdx] = { 
                   ...requests[rIdx], 
                   status: ExamStatus.WAITING_SCHEDULING, 
                   scheduleId: undefined, 
                   scheduledDate: undefined,
                   scheduledTime: undefined,
                   scheduledCategory: undefined, 
                   attendanceConfirmed: false,
                   updatedAt: new Date().toISOString() 
               };
               setLocal(STORAGE_KEYS.REQUESTS, requests);
           }
      });
  }
};
