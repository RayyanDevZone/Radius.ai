CREATE TABLE "organization_profile" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"business_phone" text,
	"whatsapp_number" text,
	"telegram_chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "organization_profile_business_phone_key" ON "organization_profile" USING btree ("business_phone");--> statement-breakpoint
CREATE INDEX "stores_organization_id_idx" ON "stores" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_organization_id_name_key" ON "stores" USING btree ("organization_id","name");