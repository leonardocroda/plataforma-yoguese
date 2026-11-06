CREATE TYPE "public"."status_turma" AS ENUM('ATIVA', 'INATIVA');--> statement-breakpoint
CREATE TYPE "public"."status_aluno" AS ENUM('ATIVO', 'INATIVO');--> statement-breakpoint
CREATE TYPE "public"."status_enrollment" AS ENUM('ATIVA', 'INATIVA');--> statement-breakpoint
CREATE TYPE "public"."status_reserva" AS ENUM('ATIVA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."status_sessao" AS ENUM('AGENDADA', 'BLOQUEADA', 'CANCELADA');--> statement-breakpoint
CREATE TYPE "public"."tipo_reserva" AS ENUM('FIXED', 'MAKEUP', 'EXPERIMENTAL');--> statement-breakpoint
CREATE TABLE "class_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_type_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"capacity" integer DEFAULT 8 NOT NULL,
	"status" "status_turma" DEFAULT 'ATIVA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_slots_weekday_range" CHECK ("class_slots"."weekday" between 1 and 7),
	CONSTRAINT "class_slots_capacity_positive" CHECK ("class_slots"."capacity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "class_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "status_turma" DEFAULT 'ATIVA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "fixed_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_slot_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" "status_enrollment" DEFAULT 'ATIVA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "status_aluno" DEFAULT 'ATIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_session_id" uuid NOT NULL,
	"booking_type" "tipo_reserva" NOT NULL,
	"status" "status_reserva" DEFAULT 'ATIVA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_slot_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"status" "status_sessao" DEFAULT 'AGENDADA' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "studio_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_slots" ADD CONSTRAINT "class_slots_class_type_id_class_types_id_fk" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_enrollments" ADD CONSTRAINT "fixed_enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_enrollments" ADD CONSTRAINT "fixed_enrollments_class_slot_id_class_slots_id_fk" FOREIGN KEY ("class_slot_id") REFERENCES "public"."class_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_class_session_id_class_sessions_id_fk" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_class_slot_id_class_slots_id_fk" FOREIGN KEY ("class_slot_id") REFERENCES "public"."class_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "class_sessions_slot_data_unica" ON "class_sessions" USING btree ("class_slot_id","session_date");