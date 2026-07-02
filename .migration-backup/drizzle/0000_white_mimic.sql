CREATE TABLE IF NOT EXISTS "driving_schools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exam_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"student_name" text NOT NULL,
	"social_name" text,
	"cpf" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"exam_type" text NOT NULL,
	"intended_category" text DEFAULT 'B',
	"source" text NOT NULL,
	"school_id" text,
	"paid_fee" boolean DEFAULT false,
	"completed_practical_course" boolean DEFAULT false,
	"practical_hours" integer DEFAULT 0,
	"has_vehicle" boolean DEFAULT false,
	"cnh_restriction" text,
	"instructor" text,
	"vehicle_plate" text,
	"disability_type" text,
	"special_needs" text,
	"status" text NOT NULL,
	"result" text,
	"schedule_id" text,
	"scheduled_date" text,
	"scheduled_time" text,
	"scheduled_category" text,
	"examiner_id" text,
	"attendance_confirmed" boolean DEFAULT false,
	"observation" text,
	"exam_history" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exam_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"examiner_ids" jsonb DEFAULT '[]'::jsonb,
	"max_slots_a" integer DEFAULT 10,
	"max_slots_b" integer DEFAULT 10,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "exam_schedules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "examiners" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"registration_number" text NOT NULL,
	"can_exam_common" boolean DEFAULT true,
	"can_exam_pcd" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instructors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cpf" text NOT NULL,
	"phone" text,
	"category" text,
	"plate" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"agency_name" text DEFAULT 'DETRAN',
	"agency_address" text,
	"logo_url" text,
	"maintenance_mode" boolean DEFAULT false,
	"min_days_scheduling" integer DEFAULT 2,
	"max_daily_slots" integer DEFAULT 50,
	"default_max_slots_a" integer DEFAULT 10,
	"default_max_slots_b" integer DEFAULT 10,
	"whatsapp_template" text,
	"default_exam_address" text,
	"default_exam_address_link" text,
	"restrictions" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"login" text NOT NULL,
	"password" text,
	"role" text NOT NULL,
	"school_id" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"instructor_id" text NOT NULL,
	"type" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"plate" text NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
