# Algeria Exchange Rate Monitor

A full-stack monorepo for collecting, storing, and exploring the daily exchange
rates of the Algerian Dinar (DZD) against major foreign currencies.

The project takes its data from the **Bank of Algeria (Banque d'Algérie)** daily
exchange rate publication:

> https://www.bank-of-algeria.dz/taux-de-change-journalier/

The goal is to turn that public web page into a queryable, date-aware dataset and
a clean dashboard: *what was the value of one US dollar, euro, pound, etc. in
Algerian dinars on a given day?*

---

## Table of contents

- [Goal](#goal)
- [Data source](#data-source)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Current status](#current-status)
- [Planned data flow](#planned-data-flow)
- [API](#api)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Configuration](#configuration)
- [Roadmap](#roadmap)
- [Limitations and risks](#limitations-and-risks)

---

## Goal

Provide a reliable, historical view of DZD exchange rates that is easy to:

- **collect** automatically from the Bank of Algeria website,
- **store** with a stable schema and one row per currency per day,
- **query** by date, currency, and date range through a documented API,
- **visualize** in a web dashboard (latest rates, historical charts, comparisons).

The scope is the official Bank of Algeria quotation, not parallel/black-market
rates.

---

## Data source

**Page:** `https://www.bank-of-algeria.dz/taux-de-change-journalier/`

The page is a WordPress/Elementor page that renders its rate tables server-side
inside a container with `id="organizTable"`.

### Structure of the published data

- The page contains **five `<table>` blocks**, one per publication date.
- Each table header holds a date in `dd-mm-yyyy` format
  (for example `06-11-2026`).
- **The first table** contains two columns: the ISO 4217 currency code and its
  rate for that date.
- **The following tables** contain **only the rate values**, in the same currency
  order as the first table. Any scraper must therefore read the currency list
  from the first table and map the values of the later tables by position.
- The page lists the most recent five publication dates; older dates are not
  available from this page.

### Currencies published

| Code | Currency            | Code | Currency            |
| ---- | ------------------- | ---- | ------------------- |
| USD  | US Dollar           | AED  | UAE Dirham          |
| EUR  | Euro                | SAR  | Saudi Riyal         |
| GBP  | Pound Sterling      | KWD  | Kuwaiti Dinar       |
| JPY  | Japanese Yen        | TND  | Tunisian Dinar      |
| CNY  | Chinese Yuan        | MAD  | Moroccan Dirham     |
| CHF  | Swiss Franc         | LYD  | Libyan Dinar        |
| CAD  | Canadian Dollar     | MRU  | Mauritanian Ouguiya |
| DKK  | Danish Krone        | SDR  | IMF Special Drawing Rights |
| SEK  | Swedish Krona       |      |                     |
| NOK  | Norwegian Krone     |      |                     |

### Rate direction

Values are quoted as **Algerian dinars per one unit of foreign currency**
(e.g. `USD = 136.1078` means 1 USD ≈ 136.1078 DZD), except `JPY`, which the Bank
of Algeria quotes **per 100 yen** (e.g. `JPY = 86.2479` means 100 JPY ≈ 86.2479
DZD). This direction matters for storage, display, and any conversion logic.

### Buy/sell (achat/vente)

The HTML tables expose a single daily quotation per currency. The Bank of Algeria
also publishes a commercial quotation with **buy (achat)** and **sell (vente)**
prices as a PDF linked from the same page (e.g.
`clean_cotation-commerciale-*.pdf`). The current schema stores the single daily
quotation as `rate`; sourcing buy/sell prices would require parsing the linked
PDF and extending the schema.

### Historical archive

`apps/api/archive/` contains the historical dataset: 17 CSV files, one per
currency, covering **03/01/2000 → 30/10/2026** (~112k usable rates).

- Format: four header lines, then `dd/mm/yyyy, value` rows.
- `EURO` maps to `EUR`.
- `MRO` is the pre-2018 Mauritanian ouguiya and is kept as `MRO`; it is **not**
  converted to `MRU`.
- `CNY` starts on `29/12/2015`; `MRO` ends on `26/06/2018`.
- Missing values (`""`) and `-` placeholders are skipped and reported.
- `SDR` and `MRU` are only available from the live page, not the archive.

> **Important:** this is a third-party public website, not a documented API. The
> markup may change without notice and should be treated defensively.

---

## Architecture

The repository is a **Turborepo** monorepo managed with **pnpm** workspaces.

| Layer     | Technology                                                       |
| --------- | ---------------------------------------------------------------- |
| Monorepo  | Turborepo 2, pnpm 10                                             |
| API       | NestJS 12, TypeScript, Drizzle ORM, PostgreSQL, Swagger          |
| Web       | Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript     |
| Database  | PostgreSQL 13 (Docker Compose), Drizzle migrations                |
| Shared    | `packages/types` (reserved for shared TypeScript types)           |

### API application (`apps/api`)

- Global route prefix `/api` with **URI versioning**, default version `v1`
  (`/api/v1/...`).
- **Swagger** documentation served at `/api/docs`.
- **Drizzle ORM** over `node-postgres` (`pg`), injected through
  `@nestjs/drizzle`.
- Migrations can run automatically on boot when `MIGRATE=true`, from the
  committed `./drizzle` folder.
- Modules:
  - `AppModule` — configuration, database, and feature wiring.
  - `BankOfAlgeriaModule` — fetches and parses the Bank of Algeria page.
  - `RatesModule` — `POST /api/v1/rates/ingest`, idempotent rate ingestion.
  - `CurrenciesModule` — `GET /api/v1/currencies`.
  - `ArchiveModule` — historical CSV import (CLI + guarded endpoint).
- **Scheduled ingestion** — `@nestjs/schedule` runs the ingestion every day at
  **10:00 `Africa/Algiers`**. The manual ingest endpoint is protected by
  `CronSecretGuard` and requires the shared `CRON_SECRET`.

### Web application (`apps/web`)

- Next.js App Router application, currently the starter page.
- Configured for the React Compiler, Turbopack, Tailwind CSS 4, and Next.js
  partial prefetching.
- Reads the API base URL from `API_URL`.

### Database

A single PostgreSQL service is defined in `docker-compose.yml` with a named
volume, configured through `DATABASE_USER`, `DATABASE_PASSWORD`, and
`DATABASE_NAME`.

---

## Data model

Defined in `apps/api/src/db/schema/exchange-rates.ts` using Drizzle's
`snakeCase` table helper.

Table: **`exchange_rates`**

| Column       | Type                        | Constraints                          |
| ------------ | --------------------------- | ------------------------------------ |
| `id`         | `uuid`                      | primary key, random default          |
| `currency`   | `varchar(3)`                | not null — ISO 4217 code             |
| `rate`       | `numeric(12, 6)`            | not null — DZD per foreign currency  |
| `rate_date`  | `date`                      | not null — publication date          |
| `created_at` | `timestamptz`               | not null, defaults to now            |

Indexes and constraints:

- `unique (currency, rate_date)` — one row per currency per day, making ingestion
  idempotent via upsert.
- `index (rate_date)` — fast lookups for a given day and range scans.

Exported types: `ExchangeRate` (selected row) and `NewExchangeRate` (insert
payload).

The archive contains 5-decimal quotations for some currencies (`KWD`, `MRO`,
`SAR`), so the column uses scale 6 to avoid rounding historical values.

---

## Current status

| Area                    | Status                                                        |
| ----------------------- | ------------------------------------------------------------- |
| Monorepo tooling        | ✅ Set up (Turbo, pnpm workspaces)                            |
| API skeleton            | ✅ NestJS app, Swagger, versioning, Drizzle connection        |
| Database schema         | ✅ `exchange_rates` table + migration generated               |
| Docker Postgres         | ✅ Defined in `docker-compose.yml`                            |
| Rates module            | ✅ Ingestion endpoint with idempotent upsert                   |
| Scheduled ingestion     | ✅ Daily at 10:00 `Africa/Algiers`, protected manual endpoint  |
| Bank of Algeria scraper | ✅ Fetch + parse with fixture tests                            |
| Historical archive      | ✅ 112,114 rates imported (2000–2026), idempotent import       |
| Web dashboard           | ❌ Not implemented (default Next.js starter page)             |
| Shared types            | ❌ Placeholder only (`packages/types`)                        |

---

## Planned data flow

```
Bank of Algeria page (HTML / PDF)
        │
        ▼
Ingestion job (fetch → parse → normalize)
        │  currency, rate, rate_date
        ▼
PostgreSQL: exchange_rates  (upsert on currency + rate_date)
        │
        ▼
NestJS API  /api/v1/rates...
        │
        ▼
Next.js dashboard (latest rates, history, charts)
```

Design intentions:

1. **Idempotent ingestion** — re-running a scrape for the same date updates
   existing rows instead of duplicating them.
2. **Normalized storage** — one row per currency per date, so date-range and
   currency queries stay simple.
3. **Separation of concerns** — scraping and parsing live in the API/worker
   layer; the web app only consumes the API.
4. **Auditability** — `created_at` preserves when a row was first recorded.

---

## API

The API is versioned under `/api/v1`.

| Method | Path                          | Status      | Description                                                       |
| ------ | ----------------------------- | ----------- | ----------------------------------------------------------------- |
| `POST` | `/api/v1/rates/ingest`        | Implemented | Fetch the Bank of Algeria page and store every published date     |
| `POST` | `/api/v1/rates/import-archive`| Implemented | Import the historical CSV archive (protected by `CRON_SECRET`)     |
| `GET`  | `/api/v1/currencies`          | Implemented | Supported currency codes                                          |
| `GET`  | `/api/v1/rates`               | Implemented | Rates, filterable by `currency`, `date`, or `from`/`to` + pagination |
| `GET`  | `/api/v1/rates/latest`        | Planned     | Most recent rates for every currency                              |
| `GET`  | `/api/v1/rates/:currency`     | Planned     | History for one currency                                          |
| `GET`  | `/api/v1/health`              | Planned     | Service health (optional)                                         |

Ingestion returns `{ "fetched": number, "inserted": number }` and is safe to
re-run: rows are inserted with `ON CONFLICT DO NOTHING` on
`(currency, rate_date)`, and every date present on the page is ingested, so
missing earlier dates are backfilled.

### Reading rates

`GET /api/v1/rates` accepts `currency`, `date`, `from`, `to`, `page` (default 1),
and `limit` (default 100, max 500). `date` cannot be combined with `from`/`to`:

```bash
curl "http://localhost:3001/api/v1/rates?currency=USD&from=2026-10-01&to=2026-10-31&page=1&limit=50"
```

```json
{
  "data": [{ "currency": "USD", "rate": "135.507900", "date": "2026-10-30" }],
  "meta": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 }
}
```

Interactive documentation: **`http://localhost:3001/api/docs`**.

`POST /api/v1/rates/ingest` and `POST /api/v1/rates/import-archive` require the
shared secret, sent either as the `x-cron-secret` header or as
`Authorization: Bearer <secret>`:

```bash
curl -X POST http://localhost:3001/api/v1/rates/ingest \
  -H "x-cron-secret: $CRON_SECRET"
```

---

## Repository layout

```
Algeria-Exchange-Rate-Monitor/
├── apps/
│   ├── api/                      # NestJS API
│   │   ├── src/
│   │   │   ├── bank-of-algeria/  # Fetcher, parser, module, fixture tests
│   │   │   ├── currencies/       # Currencies module
│   │   │   ├── db/schema/        # Drizzle schema (exchange_rates)
│   │   │   ├── rates/            # Ingestion module
│   │   │   ├── app.module.ts
│   │   │   ├── app.setup.ts      # Swagger, versioning, prefix
│   │   │   └── main.ts
│   │   ├── drizzle/              # Committed migrations
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   └── web/                      # Next.js dashboard
│       ├── src/app/
│       └── package.json
├── packages/
│   └── types/                    # Shared types (placeholder)
├── docker-compose.yml            # PostgreSQL service
├── turbo.json                    # Task pipeline
├── pnpm-workspace.yaml
└── package.json
```

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm 10 (`packageManager` is pinned to `pnpm@10.13.1`)
- Docker (for PostgreSQL)

### Steps

```bash
# 1. Install dependencies
pnpm install

# 2. Configure the Docker Compose database credentials
cp .env.example .env

# 3. Start PostgreSQL
docker compose up -d

# 4. Configure the apps
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# then edit DATABASE_URL and other values

# 5. Run both apps
pnpm dev
```

### Migrations

`apps/api/drizzle` is the single, committed migration history. There is no
separate local migration folder: local development applies the schema directly,
and migrations are generated only when a change is ready to ship.

| Where       | Command                                          | Files produced                              |
| ----------- | ------------------------------------------------ | ------------------------------------------- |
| Local DB    | `pnpm --filter api db:push`                      | none                                         |
| Release     | `pnpm --filter api db:generate --name <change>`  | `apps/api/drizzle/<timestamp>_<name>/`       |
| Prod / CI   | `MIGRATE=true` on boot, or `pnpm --filter api db:migrate` | none (applies `apps/api/drizzle`)  |

- Local `apps/api/.env` keeps `MIGRATE=false`; use `db:push` instead.
- Review the generated `migration.sql` and commit it with the schema change.
- `db:push` is destructive (it can drop columns/tables). Only point it at the
  local database.
- Never commit a migration generated for a local-only experiment. If you run
  `db:generate` by mistake, delete the generated folder instead.

Useful commands (from the repository root):

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `pnpm dev`         | Run all apps in watch mode (Turbo)   |
| `pnpm build`       | Build all apps                       |
| `pnpm lint`        | Lint all apps                        |
| `pnpm --filter api test` | Run API unit tests             |
| `pnpm --filter api db:push` | Sync the local database (no files) |
| `pnpm --filter api db:import-archive` | Import `apps/api/archive` into the database |
| `pnpm --filter api db:generate --name <change>` | Create a migration to commit |

Individual app commands live in `apps/api/package.json` and
`apps/web/package.json`.

---

## Configuration

### API (`apps/api/.env`)

| Variable          | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `PORT`            | HTTP port (default `3001`)                           |
| `DATABASE_URL`    | PostgreSQL connection string                         |
| `MIGRATE`         | Run migrations on boot (deployed environments; local uses `db:push`) |
| `CRON_SECRET`     | Shared secret for the protected `POST` endpoints                     |
| `ARCHIVE_DIR`     | Archive CSV directory, relative to the API working dir (default `archive`) |

### Web (`apps/web/.env`)

| Variable  | Purpose                              |
| --------- | ------------------------------------ |
| `API_URL` | Base URL of the API (e.g. `http://localhost:3001/api`) |

### Database (`docker-compose.yml`)

| Variable            | Purpose                  |
| ------------------- | ------------------------ |
| `DATABASE_USER`     | PostgreSQL user          |
| `DATABASE_PASSWORD` | PostgreSQL password      |
| `DATABASE_NAME`     | PostgreSQL database name |

> `.env` files are git-ignored. Only `.env.example` files are committed.

---

## Roadmap

1. **PDF parsing (optional)** — extract buy/sell from the commercial quotation
   PDF if distinct values are required.
2. **External scheduling (optional)** — call the protected ingest endpoint from
   an external scheduler using `CRON_SECRET` instead of the built-in daily job.
3. **Read endpoints** — implement the planned GET endpoints with validation and
   pagination.
4. **Dashboard** — latest-rates table, currency selector, historical line charts,
   date picker.
5. **Tests** — ingestion idempotency and API e2e tests on top of the parser
   fixture tests.
6. **Operations** — Dockerfile(s), CI (lint, typecheck, tests, build), deployment
   notes.

---

## Limitations and risks

- **No official API.** The data source is a public web page whose markup can
  change at any time; the parser needs fixtures and should fail loudly.
- **Only five dates on the page.** Historical backfill requires another source
  (the BAM archive/PDFs) or continuous collection over time.
- **Publication gaps.** Rates are not published every day (weekends, holidays);
  the API must handle missing dates gracefully.
- **Positional mapping.** Tables after the first contain values without currency
  labels, so a currency added by the Bank of Algeria shifts the mapping. Always
  validate the expected count (currently 18).
- **Rate direction.** Values are DZD per unit of foreign currency, not the
  reverse. Display and conversion must be explicit.
- **Buy/sell availability.** The HTML page shows one daily quotation; buy/sell
  requires the PDF. The current schema stores only the single daily quotation.
- **`SDR`** is not a traded currency but the IMF Special Drawing Rights unit; it
  is still published and should be treated like any other code.
- **Numeric precision.** Amounts are stored as `numeric(12,4)`; avoid floating
  point math when converting or aggregating.
