CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"size_value" numeric(10, 3) NOT NULL,
	"size_unit" text NOT NULL,
	"unit" text NOT NULL,
	"hsn_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_check" CHECK ("products"."price" >= 0),
	CONSTRAINT "products_size_value_check" CHECK ("products"."size_value" > 0),
	CONSTRAINT "products_size_unit_check" CHECK ("products"."size_unit" in ('g', 'kg', 'ml', 'l')),
	CONSTRAINT "products_unit_check" CHECK ("products"."unit" in ('bag', 'piece')),
	CONSTRAINT "products_hsn_code_check" CHECK ("products"."hsn_code" ~ '^([0-9]{4}|[0-9]{6}|[0-9]{8})$')
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"firm_name" text NOT NULL,
	"firm_address" text NOT NULL,
	"owner_name" text NOT NULL,
	"mobile" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "products_organization_id_idx" ON "products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shops_organization_id_idx" ON "shops" USING btree ("organization_id");