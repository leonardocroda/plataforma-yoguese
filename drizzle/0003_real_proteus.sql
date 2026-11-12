CREATE TYPE "public"."status_pagamento_experimental" AS ENUM('PENDENTE', 'PAGO', 'ISENTO', 'REEMBOLSADO');--> statement-breakpoint
CREATE TYPE "public"."status_experimental" AS ENUM('PENDENTE', 'APROVADA', 'RECUSADA', 'CANCELADA_COM_DIREITO', 'CANCELADA_SEM_DIREITO', 'FALTA', 'CONVERTIDA', 'DUPLICADA');--> statement-breakpoint
CREATE TABLE "experimental_reschedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experimental_id" uuid NOT NULL,
	"from_session_id" uuid NOT NULL,
	"to_session_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"rescheduled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experimentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"phone_normalized" text NOT NULL,
	"class_session_id" uuid NOT NULL,
	"status" "status_experimental" DEFAULT 'PENDENTE' NOT NULL,
	"payment_status" "status_pagamento_experimental" DEFAULT 'PENDENTE' NOT NULL,
	"health_declaration" text NOT NULL,
	"duplicate_of_id" uuid,
	"requested_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"no_show_at" timestamp with time zone,
	"attended_at" timestamp with time zone,
	"whatsapp_contacted_at" timestamp with time zone,
	"converted_student_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "health_declaration" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "health_declaration_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "experimental_reschedules" ADD CONSTRAINT "experimental_reschedules_experimental_id_experimentals_id_fk" FOREIGN KEY ("experimental_id") REFERENCES "public"."experimentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experimental_reschedules" ADD CONSTRAINT "experimental_reschedules_from_session_id_class_sessions_id_fk" FOREIGN KEY ("from_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experimental_reschedules" ADD CONSTRAINT "experimental_reschedules_to_session_id_class_sessions_id_fk" FOREIGN KEY ("to_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experimentals" ADD CONSTRAINT "experimentals_class_session_id_class_sessions_id_fk" FOREIGN KEY ("class_session_id") REFERENCES "public"."class_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experimentals" ADD CONSTRAINT "experimentals_duplicate_of_id_experimentals_id_fk" FOREIGN KEY ("duplicate_of_id") REFERENCES "public"."experimentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experimentals" ADD CONSTRAINT "experimentals_converted_student_id_students_id_fk" FOREIGN KEY ("converted_student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experimentals_telefone_unico" ON "experimentals" USING btree ("phone_normalized") WHERE "experimentals"."status" <> 'RECUSADA' and "experimentals"."duplicate_of_id" is null;