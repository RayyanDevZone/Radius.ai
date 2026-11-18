CREATE TABLE "employee_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"designation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "employee_profile_organization_id_idx" ON "employee_profile" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_profile_phone_key" ON "employee_profile" USING btree ("phone");