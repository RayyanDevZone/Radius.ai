CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"number" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_number_check" CHECK ("vehicles"."number" ~ '^[A-Z0-9]{6,11}$'),
	CONSTRAINT "vehicles_type_check" CHECK ("vehicles"."type" in ('bike', 'auto', 'pickup', 'truck', 'van', 'other'))
);
--> statement-breakpoint
CREATE INDEX "vehicles_organization_id_idx" ON "vehicles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_organization_id_number_key" ON "vehicles" USING btree ("organization_id","number");