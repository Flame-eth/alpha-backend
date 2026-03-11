# Alpha Backend Tasks

This mono-repo contains two independent backend services that share the same local PostgreSQL instance.

- `python-service/` (InsightOps): FastAPI + SQLAlchemy + manual SQL migration runner
- `ts-service/` (TalentFlow): NestJS + TypeORM migrations + async summary worker

Both services are implemented and runnable as-is.

## Prerequisites

- Docker
- Python 3.12
- Node.js 22+
- npm

## Repository Setup

1. Start PostgreSQL from the repository root:

```bash
docker compose up -d postgres
```

2. Verify DB is healthy:

```bash
docker compose ps
```

Postgres defaults from `docker-compose.yml`:

- host: `localhost`
- port: `5432`
- database: `assessment_db`
- user: `assessment_user`
- password: `assessment_pass`

## Setup and Run: Python Service (InsightOps)

1. Install dependencies:

```bash
cd python-service
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

2. Run migrations:

```bash
cd python-service
source .venv/bin/activate
python -m app.db.run_migrations up
```

3. Start service:

```bash
cd python-service
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

4. Smoke check:

```bash
curl http://localhost:8000/health
```

## Setup and Run: TypeScript Service (TalentFlow)

1. Install dependencies:

```bash
cd ts-service
npm install
cp .env.example .env
```

2. Run migrations:

```bash
cd ts-service
npm run migration:run
```

3. Start service:

```bash
cd ts-service
npm run start:dev
```

4. Smoke check:

```bash
curl http://localhost:3000/health
```

Swagger docs are available at `http://localhost:3000/docs`.

## Running Both Services Together

Open two terminals from repo root.

Terminal 1 (Python):

```bash
cd python-service
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8000
```

Terminal 2 (TypeScript):

```bash
cd ts-service
npm run start:dev
```

You can run both concurrently because they use different ports (`8000` and `3000`).

## Migration Commands

Python (`python-service/db/migrations`):

```bash
# apply pending migrations
cd python-service && source .venv/bin/activate && python -m app.db.run_migrations up

# roll back latest migration
cd python-service && source .venv/bin/activate && python -m app.db.run_migrations down --steps 1
```

TypeScript (`ts-service/src/migrations`):

```bash
# apply pending migrations
cd ts-service && npm run migration:run

# show status
cd ts-service && npm run migration:show

# revert latest migration
cd ts-service && npm run migration:revert
```

## Test Commands

Python tests:

```bash
cd python-service
source .venv/bin/activate
python -m pytest
```

TypeScript tests:

```bash
cd ts-service
npm test
npm run test:e2e
```

## Assumptions and Tradeoffs

- Both services share one local PostgreSQL database (`assessment_db`) and each manages its own migration history table (`schema_migrations` for Python, `typeorm_migrations` for TypeScript).
- The TypeScript async queue is in-memory; jobs are not durable across process restarts.
- The TypeScript auth model is intentionally fake/starter (`x-user-id`, `x-workspace-id`) for local assessment workflows.
- The Python service uses manual SQL migration files for explicit control and readability over ORM-generated migrations.
- The TypeScript service can use a fake summarization provider unless `GEMINI_API_KEY` is configured.

## Implementation Guides

- Python guide: [`python-service/README.md`](python-service/README.md)
- Python implementation details: [`python-service/IMPLEMENTATION_SUMMARY.md`](python-service/IMPLEMENTATION_SUMMARY.md)
- TypeScript guide: [`ts-service/README.md`](ts-service/README.md)
- TypeScript implementation details: [`ts-service/IMPLEMENTATION_SUMMARY.md`](ts-service/IMPLEMENTATION_SUMMARY.md)

## Additional Notes

See `NOTES.md` for a short cross-service analysis covering design decisions, schema decisions, and improvements with more time.
