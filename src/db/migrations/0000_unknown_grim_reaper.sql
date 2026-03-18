CREATE TABLE "dhs_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payee" text NOT NULL,
	"payment_amount" numeric(14, 2) NOT NULL,
	"budget_period" integer NOT NULL,
	"agency" text NOT NULL,
	"account_code" varchar(5) NOT NULL,
	"expense_category" text NOT NULL,
	"expense_type" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dhs_payments_payee_idx" ON "dhs_payments" USING btree ("payee");--> statement-breakpoint
CREATE INDEX "dhs_payments_expense_category_idx" ON "dhs_payments" USING btree ("expense_category");