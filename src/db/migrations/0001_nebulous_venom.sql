CREATE TABLE "business_registered_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"business_id" integer NOT NULL,
	"agent_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_number" varchar(64) NOT NULL,
	"business_name" text NOT NULL,
	"business_type" text,
	"filing_date" date,
	"number_of_shares" integer,
	"chief_executive_officer" text,
	"mailing_address" text,
	"mn_statute" varchar(64),
	"home_jurisdiction" text,
	"status" text,
	"registered_office_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_business_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer NOT NULL,
	"business_id" integer NOT NULL,
	"match_method" text NOT NULL,
	"match_confidence" numeric(5, 4),
	"is_primary" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "business_registered_agents" ADD CONSTRAINT "business_registered_agents_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_business_links" ADD CONSTRAINT "payment_business_links_payment_id_dhs_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."dhs_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_business_links" ADD CONSTRAINT "payment_business_links_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_registered_agents_business_id_idx" ON "business_registered_agents" USING btree ("business_id");--> statement-breakpoint
CREATE UNIQUE INDEX "business_registered_agents_business_agent_uidx" ON "business_registered_agents" USING btree ("business_id","agent_name");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_file_number_uidx" ON "businesses" USING btree ("file_number");--> statement-breakpoint
CREATE INDEX "businesses_business_name_idx" ON "businesses" USING btree ("business_name");--> statement-breakpoint
CREATE INDEX "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_business_links_payment_business_uidx" ON "payment_business_links" USING btree ("payment_id","business_id");--> statement-breakpoint
CREATE INDEX "payment_business_links_payment_id_idx" ON "payment_business_links" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_business_links_business_id_idx" ON "payment_business_links" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "payment_business_links_match_method_idx" ON "payment_business_links" USING btree ("match_method");