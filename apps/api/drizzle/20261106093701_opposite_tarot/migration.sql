CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"currency" varchar(3) NOT NULL,
	"buy" numeric(12,4) NOT NULL,
	"sell" numeric(12,4) NOT NULL,
	"rate_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_currency_rate_date_unique" UNIQUE("currency","rate_date")
);
--> statement-breakpoint
CREATE INDEX "exchange_rates_rate_date_index" ON "exchange_rates" ("rate_date");