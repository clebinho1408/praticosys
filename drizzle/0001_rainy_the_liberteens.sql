CREATE TABLE "banca_results" (
	"id" text PRIMARY KEY NOT NULL,
	"schedule_id" text NOT NULL,
	"school_id" text NOT NULL,
	"category" text NOT NULL,
	"total_slots" integer DEFAULT 0,
	"used_slots" integer DEFAULT 0,
	"approved" integer DEFAULT 0,
	"failed" integer DEFAULT 0,
	"absent" integer DEFAULT 0,
	"cancelled" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blocked_dates" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"description" text,
	"is_holiday" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "cities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "exam_requests" ALTER COLUMN "student_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_requests" ALTER COLUMN "cpf" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_requests" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "driving_schools" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "driving_schools" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "driving_schools" ADD COLUMN "services" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "driving_schools" ADD COLUMN "moto_yard_address" text;--> statement-breakpoint
ALTER TABLE "driving_schools" ADD COLUMN "car_yard_address" text;--> statement-breakpoint
ALTER TABLE "driving_schools" ADD COLUMN "category_change_yard_address" text;--> statement-breakpoint
ALTER TABLE "driving_schools" ADD COLUMN "main_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "driving_schools" ADD COLUMN "provisional_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "exam_requests" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "exam_requests" ADD COLUMN "request_type" text DEFAULT 'EXTRA';--> statement-breakpoint
ALTER TABLE "exam_requests" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "examiners" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "default_max_slots_mudanca" integer DEFAULT 10;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "cfc_whatsapp_template" text;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "pcd_exam_name" text;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "pcd_default_exam_address" text;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "pcd_default_exam_address_link" text;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "pcd_main_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "cnh_brasil_main_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "system_settings" ADD COLUMN "block_weekends" boolean DEFAULT false;