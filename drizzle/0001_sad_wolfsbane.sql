CREATE TYPE "public"."cancelado_por" AS ENUM('ALUNO', 'ESTUDIO');--> statement-breakpoint
CREATE TYPE "public"."origem_credito" AS ENUM('CANCELAMENTO_AULA_FIXA', 'CANCELAMENTO_ESTUDIO', 'CONCESSAO_MANUAL');--> statement-breakpoint
CREATE TYPE "public"."status_credito" AS ENUM('DISPONIVEL', 'RESERVADO', 'UTILIZADO', 'VENCIDO', 'CANCELADO');--> statement-breakpoint
ALTER TYPE "public"."status_reserva" ADD VALUE 'FALTA';--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_id" uuid NOT NULL,
	"action" text NOT NULL,
	"previous_status" "status_credito",
	"new_status" "status_credito" NOT NULL,
	"reason" text NOT NULL,
	"admin_user_id" uuid,
	"admin_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"source" "origem_credito" NOT NULL,
	"source_booking_id" uuid,
	"source_session_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "status_credito" DEFAULT 'DISPONIVEL' NOT NULL,
	"used_booking_id" uuid,
	"admin_user_id" uuid,
	"admin_label" text
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_by" "cancelado_por";--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_id_credits_id_fk" FOREIGN KEY ("credit_id") REFERENCES "public"."credits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_source_booking_id_bookings_id_fk" FOREIGN KEY ("source_booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_source_session_id_class_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_used_booking_id_bookings_id_fk" FOREIGN KEY ("used_booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credits_origem_reserva_unica" ON "credits" USING btree ("student_id","source","source_booking_id") WHERE "credits"."source_booking_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "credits_origem_sessao_unica" ON "credits" USING btree ("student_id","source","source_session_id") WHERE "credits"."source_session_id" is not null;--> statement-breakpoint
CREATE INDEX "credits_aluno_status" ON "credits" USING btree ("student_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_aluno_ocorrencia_fixa_unica" ON "bookings" USING btree ("student_id","class_session_id") WHERE "bookings"."booking_type" = 'FIXED';