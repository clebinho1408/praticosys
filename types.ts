
export enum UserRole {
  ADMIN = 'ADMIN',
  SUPERVISOR = 'SUPERVISOR',
  OPERATOR = 'OPERATOR',
  SCHOOL = 'SCHOOL'
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
  WAITING_SCHEDULING = 'WAITING_SCHEDULING', // Aguardando Agendamento
  SCHEDULED = 'SCHEDULED',                   // Agendado
  WAITING_RESULT = 'WAITING_RESULT',         // Aguardando Resultado
  RETEST = 'RETEST',                         // Reteste
  DONE = 'DONE',                             // Realizado
  CANCELLED = 'CANCELLED'                    // Cancelado
}

export type ExamResult = 'APTO' | 'INAPTO' | 'FALTOU';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  schoolId?: string; // If role is SCHOOL
  login: string;
}

export interface SchoolSchedule {
  frequency: '1_WEEK' | '2_WEEK' | '2_DAY' | '15_DAYS';
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
}

export interface Vehicle {
  id: string;
  instructorId: string;
  type: 'CAR' | 'MOTO';
  brand: string;
  model: string;
  plate: string;
  active: boolean;
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
  
  // PCD Specifics
  disabilityType?: string;
  specialNeeds?: string;
  
  // Admin/Processing fields
  status: ExamStatus;
  result?: ExamResult; // Current/Latest result
  
  // History of exams (Multiple attempts)
  examHistory: ExamResultEntry[];

  scheduleId?: string; 
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledCategory?: string; // New: Specific category for this schedule instance (A or B)
  examinerId?: string; // Kept for backward compatibility or primary examiner
  observation?: string;
  
  attendanceConfirmed?: boolean; // New: Confirmed via WhatsApp/Phone
  
  createdAt: string;
  updatedAt: string;
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
  
  whatsappMessageTemplate: string;
  cfcWhatsappMessageTemplate?: string; // New: Template for CFC Practical Exam
  zApiInstanceId?: string; // New: Z-API Instance ID
  zApiToken?: string; // New: Z-API Token
  zApiClientToken?: string; // New: Z-API Client Token (Optional)
  defaultExamAddress: string; // New: Default physical address
  defaultExamAddressLink: string; // New: Google Maps Link
  restrictions: Restriction[]; // New: List of CNH restrictions
}

export interface City {
  id: string;
  name: string;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
