
import { pgTable, text, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Tabela de Usuários (Admin, Operadores, Escolas)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  login: text('login').notNull().unique(),
  password: text('password'), // Nova coluna de senha
  role: text('role').notNull(), // ADMIN, SUPERVISOR, OPERATOR, SCHOOL
  schoolId: text('school_id'), // Opcional, link para autoescola
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Autoescolas
export const drivingSchools = pgTable('driving_schools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  city: text('city'),
  services: jsonb('services').$type<string[]>().default([]),
  motoYardAddress: text('moto_yard_address'),
  carYardAddress: text('car_yard_address'),
  categoryChangeYardAddress: text('category_change_yard_address'),
  mainSchedule: jsonb('main_schedule').$type<any>(),
  provisionalSchedule: jsonb('provisional_schedule').$type<any>(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Examinadores
export const examiners = pgTable('examiners', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  registrationNumber: text('registration_number').notNull(),
  canExamCommon: boolean('can_exam_common').default(true),
  canExamPCD: boolean('can_exam_pcd').default(false),
  categories: jsonb('categories').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Instrutores
export const instructors = pgTable('instructors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cpf: text('cpf').notNull(),
  phone: text('phone'),
  category: text('category'), // New: A, B, AB
  plate: text('plate'), // Mantido como referência principal ou legacy
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Veículos
export const vehicles = pgTable('vehicles', {
  id: text('id').primaryKey(),
  instructorId: text('instructor_id').notNull(),
  type: text('type').notNull(), // CAR, MOTO
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  plate: text('plate').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Bancas (Agendas)
export const examSchedules = pgTable('exam_schedules', {
  id: text('id').primaryKey(),
  code: text('code').unique(), // New: Unique code (e.g., B6324)
  date: text('date').notNull(), // YYYY-MM-DD
  time: text('time').notNull(), // HH:mm
  examinerIds: jsonb('examiner_ids').$type<string[]>().default([]), // Array de IDs
  maxSlotsA: integer('max_slots_a').default(10),
  maxSlotsB: integer('max_slots_b').default(10),
  type: text('type').notNull(), // COMMON, PCD
  status: text('status').notNull(), // OPEN, CLOSED, CONCLUDED, CANCELLED
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Tabela de Solicitações/Candidatos
export const examRequests = pgTable('exam_requests', {
  id: text('id').primaryKey(),
  studentName: text('student_name'),
  socialName: text('social_name'),
  cpf: text('cpf'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  city: text('city'),
  requestType: text('request_type').default('EXTRA'),
  
  examType: text('exam_type').notNull(), // COMMON, PCD
  intendedCategory: text('intended_category').default('B'),
  source: text('source').notNull(), // STUDENT_DIRECT, SCHOOL
  schoolId: text('school_id'),
  
  // Detalhes extras
  paidFee: boolean('paid_fee').default(false),
  completedPracticalCourse: boolean('completed_practical_course').default(false),
  practicalHours: integer('practical_hours').default(0),
  hasVehicle: boolean('has_vehicle').default(false),
  cnhRestriction: text('cnh_restriction'),
  instructor: text('instructor'), // New
  vehiclePlate: text('vehicle_plate'), // New
  
  // PCD
  disabilityType: text('disability_type'),
  specialNeeds: text('special_needs'),
  
  // Status e Agendamento
  status: text('status').notNull(),
  result: text('result'), // APTO, INAPTO, FALTOU
  
  scheduleId: text('schedule_id'), // Link para a banca
  scheduledDate: text('scheduled_date'),
  scheduledTime: text('scheduled_time'),
  scheduledCategory: text('scheduled_category'),
  examinerId: text('examiner_id'),
  
  attendanceConfirmed: boolean('attendance_confirmed').default(false),
  observation: text('observation'),
  
  // Histórico armazenado como JSONB para simplificar migração
  examHistory: jsonb('exam_history').default([]),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Configurações do Sistema (Single Row)
export const systemSettings = pgTable('system_settings', {
  id: integer('id').primaryKey().default(1),
  agencyName: text('agency_name').default('DETRAN'),
  agencyAddress: text('agency_address'),
  logoUrl: text('logo_url'),
  maintenanceMode: boolean('maintenance_mode').default(false),
  minDaysForScheduling: integer('min_days_scheduling').default(2),
  maxDailySlots: integer('max_daily_slots').default(50),
  defaultMaxSlotsA: integer('default_max_slots_a').default(10),
  defaultMaxSlotsB: integer('default_max_slots_b').default(10),
  whatsappMessageTemplate: text('whatsapp_template'),
  cfcWhatsappMessageTemplate: text('cfc_whatsapp_template'),
  defaultExamAddress: text('default_exam_address'),
  defaultExamAddressLink: text('default_exam_address_link'),
  restrictions: jsonb('restrictions').default([]),
  
  // PCD Practical Exam Settings
  pcdExamName: text('pcd_exam_name'),
  pcdDefaultExamAddress: text('pcd_default_exam_address'),
  pcdDefaultExamAddressLink: text('pcd_default_exam_address_link'),
  pcdMainSchedule: jsonb('pcd_main_schedule'),
  cnhBrasilMainSchedule: jsonb('cnh_brasil_main_schedule'),
});

// Tabela de Cidades
export const cities = pgTable('cities', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
});
