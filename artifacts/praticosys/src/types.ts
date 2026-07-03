
export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  OPERATOR = 'OPERATOR',
  CONSULTANT = 'CONSULTANT',
  SCHOOL = 'SCHOOL',
  EXAMINER = 'EXAMINER',
  INSTRUCTOR = 'INSTRUCTOR'
}

export enum ExamType {
  COMMON = 'COMMON',
  PCD = 'PCD'
}

export enum RequestSource {
  STUDENT_DIRECT = 'STUDENT_DIRECT',
  SCHOOL = 'SCHOOL'
}

export enum RequestType {
  FIXA = 'FIXA',
  EXTRA = 'EXTRA',
  REPOSICAO = 'REPOSICAO'
}

export enum ExamStatus {
  IN_ANALYSIS = 'IN_ANALYSIS',               // Cadastros em Análise
  WAITING_SCHEDULING = 'WAITING_SCHEDULING', // Aguardando Agendamento
  SCHEDULED = 'SCHEDULED',                   // Agendado
  WAITING_RESULT = 'WAITING_RESULT',         // Aguardando Resultado
  RETEST = 'RETEST',                         // Reteste
  DONE = 'DONE',                             // Realizado
  CANCELLED = 'CANCELLED'                    // Cancelado
}

export type ExamResult = 'APTO' | 'INAPTO' | 'FALTOU' | 'CANCELADO';

export type OperatorModule = 'cnh' | 'cfc' | 'pcd';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  schoolId?: string; // If role is SCHOOL
  examinerId?: string; // If role is EXAMINER
  instructorId?: string; // If role is INSTRUCTOR
  login: string;
  password?: string;
  forcePasswordChange?: boolean;
  allowedModules?: OperatorModule[]; // Only for OPERATOR role
}

export interface SchoolSchedule {
  frequency: '1_WEEK' | '2_WEEK' | '3_WEEK' | '2_DAY' | '15_DAYS';
  days: string[]; // ['SEG', 'TER', ...]
  slots: { time: string; examiner: string; day?: string }[]; 
  active: boolean;
}

export interface DrivingSchool {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city?: string;
  services: string[]; // ['A', 'B', 'C', 'D', 'E']
  
  // Pátios
  motoYardAddress?: string;
  carYardAddress?: string;
  categoryChangeYardAddress?: string; // C, D, E
  
  // Escalas
  mainSchedule?: SchoolSchedule;
  provisionalSchedule?: SchoolSchedule;
}

export interface Examiner {
  id: string;
  name: string;
  registrationNumber: string; // Matrícula
  canExamCommon?: boolean;
  canExamPCD?: boolean;
  categories?: string[]; // ['A', 'B', 'C', 'D', 'E', 'PCD']
  defaultMaxSlotsA?: number | null; // Vagas padrão Cat. A por examinador
  defaultMaxSlotsB?: number | null; // Vagas padrão Cat. B por examinador
}

export interface Vehicle {
  id: string;
  instructorId: string;
  type: 'CAR' | 'MOTO';
  brand: string;
  model: string;
  plate: string;
  active: boolean;
  transmission?: 'AUTOMATICA' | 'MANUAL';
  accessories?: string[];
}

export interface Instructor {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  category?: string; // New: A, B, AB
  plate: string; // Legacy/Default plate
  vehicles?: Vehicle[]; // New: List of vehicles
}

export interface ExamSchedule {
  id: string;
  code?: string; // New: Unique code (e.g., B6324)
  date: string;
  time: string;
  examinerIds: string[]; // Changed to array to support up to 3 examiners
  maxSlotsA: number; // Limit for Moto
  maxSlotsB: number; // Limit for Car
  type: ExamType;
  status: 'OPEN' | 'CLOSED' | 'CONCLUDED' | 'CANCELLED';
  cancellationReason?: string; // New: Reason if cancelled
}

export interface ExamResultEntry {
  id: string;
  date: string;
  time: string;
  result: ExamResult;
  category?: string; // New: A, B, etc.
  examinerId?: string;
  examiners?: string; // Names of examiners
  observation?: string;
  scheduleCode?: string; // New: Code of the schedule (e.g., B6324)
  scheduleId?: string; // New: ID of the schedule
}

export interface ExamRequest {
  id: string;
  studentName: string;
  socialName?: string; // New
  cpf: string;
  phone: string;
  email: string;
  address?: string; 
  city?: string;
  examType: ExamType;
  intendedCategory?: string; // New (A, B, etc.)
  source: RequestSource;
  requestType: RequestType; // New
  schoolId?: string; 
  desiredDate: string;
  
  // Extra Common Fields
  paidFee?: boolean; 
  completedPracticalCourse?: boolean; 
  practicalHours?: number; 
  hasVehicle?: boolean; // Renamed concept in UI to "Pedal Duplo"
  cnhRestriction?: string; // New
  instructor?: string; // New: Mandatory
  vehiclePlate?: string; // New: Mandatory
  // Checklists de pré-agendamento (CNH do Brasil — Instrutor)
  checklistVehicle?: boolean;        // CHECKLIST VEÍCULO
  practicalCourseInserted?: boolean; // CURSO PRÁTICO INSERIDO
  taxaPaga?: boolean;                // TAXA
  
  // PCD Specifics
  disabilityType?: string;
  specialNeeds?: string;
  
  // Admin/Processing fields
  status: ExamStatus;
  result?: ExamResult; // Current/Latest result
  
  // History of exams (Multiple attempts)
  examHistory: ExamResultEntry[];

  scheduleId?: string | null; 
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduledCategory?: string | null; // New: Specific category for this schedule instance (A or B)
  examinerId?: string | null; // Kept for backward compatibility or primary examiner
  observation?: string;
  categoryQuantities?: Record<string, number> | null;
  
  attendanceConfirmed?: boolean; // New: Confirmed via WhatsApp/Phone
  cancellationReason?: string; // Reason for cancellation
  
  createdAt: string;
  updatedAt: string;
  // Timestamp da última vez que o candidato estava na fila (WAITING_SCHEDULING).
  // Salvo ao entrar na banca; restaurado em updatedAt ao cancelar a banca.
  queueUpdatedAt?: string | null;
  // Usuário do sistema que colocou o candidato na banca
  scheduledBy?: string | null;
}

export interface Restriction {
  code: string;
  description: string;
}

export interface SystemSettings {
  agencyName: string; // Renamed from systemName
  agencyAddress?: string; // New: Address for reports
  logoUrl: string;    // New: Logo URL for reports
  
  maintenanceMode: boolean;
  minDaysForScheduling: number;
  maxDailySlots: number; // Global cap (legacy)
  defaultMaxSlotsA: number; // New: Default slots for Moto
  defaultMaxSlotsB: number; // New: Default slots for Car
  defaultMaxSlotsMudanca: number; // New: Default slots for Category Change (C, D, E)
  
  whatsappMessageTemplate: string;
  cfcWhatsappMessageTemplate?: string; // New: Template for CFC Practical Exam
  defaultExamAddress: string; // New: Default physical address
  defaultExamAddressLink: string; // New: Google Maps Link
  restrictions: Restriction[]; // New: List of CNH restrictions
  
  // PCD Practical Exam Settings
  pcdExamName?: string;
  pcdDefaultExamAddress?: string;
  pcdDefaultExamAddressLink?: string;
  pcdMainSchedule?: SchoolSchedule;
  
  // CNH Brasil Practical Exam Settings
  cnhBrasilMainSchedule?: SchoolSchedule;
  blockWeekends?: boolean;
}

export interface BlockedDate {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  isHoliday: boolean;
  createdAt?: string;
}

export interface City {
  id: string;
  name: string;
  createdAt?: string;
}

export interface BancaResult {
  id: string;
  scheduleId: string;
  schoolId: string;
  category: string; // A, B, MUDANCA
  totalSlots: number;
  usedSlots: number;
  approved: number;
  failed: number;
  absent: number;
  cancelled: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
