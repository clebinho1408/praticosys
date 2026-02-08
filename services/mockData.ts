import { 
  User, UserRole, DrivingSchool, Examiner, ExamSchedule, ExamRequest, 
  SystemSettings, ExamStatus, ExamType, RequestSource, ExamResultEntry 
} from '../types';

// Mock Data Storage
let users: User[] = [
  { id: '1', name: 'Administrador', login: 'admin', role: UserRole.ADMIN },
  { id: '2', name: 'Supervisor Geral', login: 'supervisor', role: UserRole.SUPERVISOR },
  { id: '3', name: 'Operador Padrão', login: 'operador', role: UserRole.OPERATOR },
  { id: '4', name: 'Autoescola Veloce', login: 'veloce', role: UserRole.SCHOOL, schoolId: 's1' },
];

export const MOCK_SCHOOLS: DrivingSchool[] = [
  { id: 's1', name: 'Autoescola Veloce', phone: '(11) 99999-0001', address: 'Rua das Flores, 123' },
  { id: 's2', name: 'Autoescola Direção Segura', phone: '(11) 98888-0002', address: 'Av. Brasil, 500' },
];
let schools = [...MOCK_SCHOOLS];

let examiners: Examiner[] = [
  { id: 'e1', name: 'Carlos Silva', registrationNumber: '12345', canExamCommon: true, canExamPCD: false },
  { id: 'e2', name: 'Ana Souza', registrationNumber: '67890', canExamCommon: true, canExamPCD: true },
  { id: 'e3', name: 'Roberto Mendes', registrationNumber: '11223', canExamCommon: true, canExamPCD: false },
];

let schedules: ExamSchedule[] = [];

// Initialize requests with some history
let requests: ExamRequest[] = [
    {
        id: 'req_1',
        studentName: 'João Silva',
        cpf: '123.456.789-00',
        phone: '11999999999',
        email: 'joao@email.com',
        examType: ExamType.COMMON,
        source: RequestSource.SCHOOL,
        schoolId: 's1',
        desiredDate: '2023-12-01',
        status: ExamStatus.DONE,
        result: 'INAPTO',
        examHistory: [
            { id: 'h1', date: '2023-11-20', time: '08:00', result: 'INAPTO', category: 'B', observation: 'Faltou sinalizar' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'req_2',
        studentName: 'Maria Oliveira',
        cpf: '987.654.321-00',
        phone: '11988888888',
        email: 'maria@email.com',
        examType: ExamType.COMMON,
        source: RequestSource.SCHOOL,
        schoolId: 's1',
        desiredDate: '2023-12-15',
        status: ExamStatus.WAITING_SCHEDULING,
        examHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];

let settings: SystemSettings = {
  agencyName: 'DETRAN - CIRETRAN 01',
  agencyAddress: 'Av. Governador Roberto Silveira, 123 - Centro',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Detran_RJ.jpg', // Placeholder logo
  maintenanceMode: false,
  minDaysForScheduling: 2,
  maxDailySlots: 50,
  defaultMaxSlotsA: 10,
  defaultMaxSlotsB: 10,
  enableEmailNotifications: true,
  enableSmsNotifications: false,
  whatsappMessageTemplate: "Olá *{CANDIDATO}*! Seu exame prático ({CATEGORIA}) está agendado para *{DATA}* às *{HORA}*.\nLocal: {ENDERECO}\nPor favor, confirme sua presença.",
  defaultExamAddress: "Pátio Oficial do DETRAN - Av. Principal, 1000",
  defaultExamAddressLink: "https://maps.google.com"
};

// API Object
export const api = {
  // Auth
  login: async (login: string): Promise<User | null> => {
    // Basic mock logic
    const user = users.find(u => u.login === login);
    if (user) return user;
    if (login === 'admin_novo') return { id: '99', name: 'Novo Admin', login: 'admin_novo', role: UserRole.ADMIN };
    return null;
  },

  // Users
  getUsers: async (): Promise<User[]> => [...users],
  createUser: async (data: Omit<User, 'id'>): Promise<User> => {
    const newUser = { ...data, id: `u_${Date.now()}` };
    users = [...users, newUser];
    return newUser;
  },
  updateUser: async (id: string, updates: Partial<User>): Promise<User> => {
    users = users.map(u => u.id === id ? { ...u, ...updates } : u);
    return users.find(u => u.id === id)!;
  },
  deleteUser: async (id: string): Promise<void> => {
    users = users.filter(u => u.id !== id);
  },

  // Schools
  getSchools: (): DrivingSchool[] => [...schools], 
  getSchoolsAsync: async (): Promise<DrivingSchool[]> => [...schools],
  createSchool: async (data: Omit<DrivingSchool, 'id'>): Promise<DrivingSchool> => {
    const newSchool = { ...data, id: `s_${Date.now()}` };
    schools = [...schools, newSchool];
    return newSchool;
  },
  updateSchool: async (id: string, updates: Partial<DrivingSchool>): Promise<DrivingSchool> => {
    schools = schools.map(s => s.id === id ? { ...s, ...updates } : s);
    return schools.find(s => s.id === id)!;
  },
  deleteSchool: async (id: string): Promise<void> => {
    schools = schools.filter(s => s.id !== id);
  },

  // Examiners
  getExaminers: (): Examiner[] => [...examiners],
  getExaminersAsync: async (): Promise<Examiner[]> => [...examiners],
  createExaminer: async (data: Omit<Examiner, 'id'>): Promise<Examiner> => {
    const newExaminer = { ...data, id: `e_${Date.now()}` };
    examiners = [...examiners, newExaminer];
    return newExaminer;
  },
  updateExaminer: async (id: string, updates: Partial<Examiner>): Promise<Examiner> => {
    examiners = examiners.map(e => e.id === id ? { ...e, ...updates } : e);
    return examiners.find(e => e.id === id)!;
  },
  deleteExaminer: async (id: string): Promise<void> => {
    examiners = examiners.filter(e => e.id !== id);
  },

  // Settings
  getSettings: async (): Promise<SystemSettings> => ({ ...settings }),
  updateSettings: async (newSettings: SystemSettings): Promise<SystemSettings> => {
    settings = { ...newSettings };
    return settings;
  },

  // Schedules
  getSchedules: async (): Promise<ExamSchedule[]> => {
    // AUTOMATIC STATUS LOGIC
    const now = new Date();
    
    schedules = schedules.map(s => {
        // Skip if already cancelled
        if (s.status === 'CANCELLED') return s;

        const examDate = new Date(`${s.date}T${s.time}`);
        
        // 1. Check for CONCLUDED (Exam Date + 4 Hours)
        const concludedThreshold = new Date(examDate.getTime() + (4 * 60 * 60 * 1000));
        
        if (now > concludedThreshold) {
            // If transitioning to CONCLUDED, ensure students are updated (this is a side effect in a getter, but fits the mock simulation)
            if (s.status !== 'CONCLUDED') {
                // Update all students in this schedule to WAITING_RESULT
                requests = requests.map(r => {
                    if (r.scheduleId === s.id && r.status === ExamStatus.SCHEDULED) {
                        return { ...r, status: ExamStatus.WAITING_RESULT, updatedAt: now.toISOString() };
                    }
                    return r;
                });
            }
            return { ...s, status: 'CONCLUDED' };
        }

        // 2. Check for CLOSED (1 Day before exam date)
        // Let's assume "1 day before" means if today is >= (examDate - 1 day)
        const closedThreshold = new Date(examDate);
        closedThreshold.setDate(closedThreshold.getDate() - 1);
        
        // Reset time component to start of day for comparison if strict day rule, 
        // or just compare timestamps. User said "um dia antes".
        // Let's stick to timestamp comparison. 
        if (now >= closedThreshold && s.status === 'OPEN') {
            return { ...s, status: 'CLOSED' };
        }

        return s;
    });

    return [...schedules];
  },
  
  createSchedule: async (data: Omit<ExamSchedule, 'id' | 'status'>): Promise<ExamSchedule> => {
    const newSchedule: ExamSchedule = { 
        ...data, 
        id: `sch_${Date.now()}`, 
        status: 'OPEN',
        examinerIds: data.examinerIds || [] 
    };
    schedules = [...schedules, newSchedule];
    return newSchedule;
  },

  updateSchedule: async (id: string, updates: Partial<ExamSchedule>): Promise<ExamSchedule> => {
    // Prevent editing if cancelled or concluded (double check)
    const current = schedules.find(s => s.id === id);
    if (current && (current.status === 'CANCELLED' || current.status === 'CONCLUDED')) {
        throw new Error("Cannot edit a concluded or cancelled schedule");
    }

    schedules = schedules.map(s => s.id === id ? { ...s, ...updates } : s);
    
    // Get the fully updated schedule object
    const updatedSchedule = schedules.find(s => s.id === id)!;
    
    // Update linked requests to reflect date/time changes and primary examiner
    if (updates.date || updates.time || updates.examinerIds) {
        requests = requests.map(r => {
            if (r.scheduleId === id) {
                return {
                    ...r,
                    scheduledDate: updatedSchedule.date,
                    scheduledTime: updatedSchedule.time,
                    // Safe access to first examiner or empty string if none
                    examinerId: updatedSchedule.examinerIds && updatedSchedule.examinerIds.length > 0 
                        ? updatedSchedule.examinerIds[0] 
                        : undefined
                };
            }
            return r;
        });
    }

    return updatedSchedule;
  },

  cancelSchedule: async (id: string, reason: string): Promise<ExamSchedule> => {
      // 1. Update Schedule Status
      schedules = schedules.map(s => s.id === id ? { ...s, status: 'CANCELLED', cancellationReason: reason } : s);
      const updatedSchedule = schedules.find(s => s.id === id)!;

      // 2. Return all students to WAITING_SCHEDULING
      requests = requests.map(r => {
          if (r.scheduleId === id) {
              return {
                  ...r,
                  status: ExamStatus.WAITING_SCHEDULING,
                  scheduleId: undefined,
                  scheduledDate: undefined,
                  scheduledTime: undefined,
                  scheduledCategory: undefined,
                  examinerId: undefined,
                  attendanceConfirmed: false,
                  updatedAt: new Date().toISOString()
              };
          }
          return r;
      });

      return updatedSchedule;
  },

  // Requests
  getRequests: async (): Promise<ExamRequest[]> => {
    // (Existing simulated check removed as it is now handled in getSchedules)
    return [...requests];
  },

  getRequestByCpf: async (cpf: string): Promise<ExamRequest[]> => {
    return requests.filter(r => r.cpf.replace(/\D/g, '') === cpf.replace(/\D/g, ''));
  },
  
  createRequest: async (data: Omit<ExamRequest, 'id' | 'createdAt' | 'updatedAt' | 'examHistory'> & { examHistory?: ExamResultEntry[] }): Promise<ExamRequest> => {
    const status = data.status || ExamStatus.WAITING_SCHEDULING;
    const newRequest: ExamRequest = {
      status,
      examHistory: data.examHistory || [],
      ...data,
      // ADDED RANDOM SUFFIX TO PREVENT DUPLICATE IDS ON SIMULTANEOUS CREATION (AB)
      id: `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    requests = [newRequest, ...requests];
    return newRequest;
  },

  updateRequest: async (id: string, updates: Partial<ExamRequest>): Promise<ExamRequest> => {
    requests = requests.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
    return requests.find(r => r.id === id)!;
  },

  // Scheduling Logic
  assignStudentToSchedule: async (requestId: string, scheduleId: string, category: string): Promise<void> => {
     const schedule = schedules.find(s => s.id === scheduleId);
     if (!schedule) throw new Error("Schedule not found");
     
     if (schedule.status !== 'OPEN') throw new Error("Cannot assign to a closed, concluded or cancelled schedule");

     requests = requests.map(r => {
        if (r.id === requestId) {
            return {
                ...r,
                status: ExamStatus.SCHEDULED, // Automatically set to SCHEDULED
                scheduleId: schedule.id,
                scheduledDate: schedule.date,
                scheduledTime: schedule.time,
                scheduledCategory: category, // Save selected category
                examinerId: schedule.examinerIds?.[0], // Use first examiner as primary for legacy field
                attendanceConfirmed: false, // Reset confirmation
                updatedAt: new Date().toISOString()
            };
        }
        return r;
     });
  },

  removeStudentFromSchedule: async (requestId: string): Promise<void> => {
     // Force strict update and return
     const updatedRequests = requests.map(r => {
        if (r.id === requestId) {
            // Reset all scheduling related fields
            return {
                ...r,
                status: ExamStatus.WAITING_SCHEDULING, // Voltar para a fila de espera
                scheduleId: undefined,
                scheduledDate: undefined,
                scheduledTime: undefined,
                scheduledCategory: undefined,
                examinerId: undefined,
                attendanceConfirmed: false,
                updatedAt: new Date().toISOString()
            };
        }
        return r;
     });
     requests = updatedRequests;
  }
};