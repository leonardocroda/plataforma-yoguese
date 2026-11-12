CREATE TYPE "public"."status_plano" AS ENUM('ATIVO', 'INATIVO');--> statement-breakpoint
CREATE TYPE "public"."role_usuario" AS ENUM('ADMIN', 'ALUNO');--> statement-breakpoint
ALTER TYPE "public"."status_aluno" ADD VALUE 'EXPERIMENTAL' BEFORE 'ATIVO';--> statement-breakpoint
ALTER TYPE "public"."status_aluno" ADD VALUE 'AGUARDANDO_MATRICULA' BEFORE 'ATIVO';--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"weekly_frequency" integer NOT NULL,
	"description" text,
	"status" "status_plano" DEFAULT 'ATIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role_usuario" DEFAULT 'ALUNO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "students" DROP CONSTRAINT "students_name_unique";--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "phone" text NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "birth_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "enrollment_date" date DEFAULT CURRENT_DATE NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_email_unique" UNIQUE("email");