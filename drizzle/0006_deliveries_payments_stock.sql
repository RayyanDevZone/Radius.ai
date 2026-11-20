CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"store_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"assigned_to" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"scheduled_for" date DEFAULT (now() at time zone 'Asia/Kolkata')::date NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"delivered_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deliveries_status_check" CHECK ("deliveries"."status" in ('pending', 'out_for_delivery', 'delivered', 'cancelled')),
	CONSTRAINT "deliveries_total_check" CHECK ("deliveries"."total" >= 0),
	CONSTRAINT "deliveries_delivered_at_check" CHECK (("deliveries"."status" = 'delivered') = ("deliveries"."delivered_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "delivery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" numeric(10, 2) NOT NULL,
	CONSTRAINT "delivery_items_quantity_check" CHECK ("delivery_items"."quantity" > 0),
	CONSTRAINT "delivery_items_unit_price_check" CHECK ("delivery_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"delivery_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"method" text NOT NULL,
	"received_on" date DEFAULT (now() at time zone 'Asia/Kolkata')::date NOT NULL,
	"received_by" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" > 0),
	CONSTRAINT "payments_method_check" CHECK ("payments"."method" in ('cash', 'upi', 'cheque', 'bank'))
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_at" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_store_id_product_id_pk" PRIMARY KEY("store_id","product_id"),
	CONSTRAINT "stock_low_stock_at_check" CHECK ("stock"."low_stock_at" >= 0)
);
--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_items" ADD CONSTRAINT "delivery_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deliveries_organization_id_idx" ON "deliveries" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_organization_id_number_key" ON "deliveries" USING btree ("organization_id","number");--> statement-breakpoint
CREATE INDEX "deliveries_organization_id_store_id_scheduled_for_idx" ON "deliveries" USING btree ("organization_id","store_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "deliveries_organization_id_delivered_at_idx" ON "deliveries" USING btree ("organization_id","delivered_at");--> statement-breakpoint
CREATE INDEX "deliveries_shop_id_idx" ON "deliveries" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "delivery_items_organization_id_idx" ON "delivery_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "delivery_items_delivery_id_idx" ON "delivery_items" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "delivery_items_product_id_idx" ON "delivery_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "payments_organization_id_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_shop_id_idx" ON "payments" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "payments_organization_id_received_on_idx" ON "payments" USING btree ("organization_id","received_on");--> statement-breakpoint
CREATE INDEX "stock_organization_id_idx" ON "stock" USING btree ("organization_id");