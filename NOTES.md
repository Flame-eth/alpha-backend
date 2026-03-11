# NOTES

## Design Decisions

- The Python service follows a straightforward layered structure: API routes, service layer, SQLAlchemy models/schemas, and Jinja report rendering.
- The TypeScript service uses NestJS modules and guards to enforce workspace scoping, with async summary generation separated into a worker-style service.
- Both services expose starter-safe local workflows (no required cloud dependencies) and are testable without full production infrastructure.

## Schema Decisions

- A single Postgres instance is shared for local development, while each service tracks migrations independently (`schema_migrations` vs `typeorm_migrations`).
- Python briefing schema favors explicit relational tables:
  - `briefings` as parent record.
  - `briefing_points` uses a `type` discriminator (`key_point` or `risk`) plus ordering.
  - `briefing_metrics` enforces unique metric names per briefing.
- TypeScript candidate summary schema tracks async workflow state in `candidate_summaries` (`pending`, `completed`, `failed`) and stores provider/prompt metadata for traceability.
- TypeScript documents keep `raw_text` in DB for simplicity while preserving a `storage_key` placeholder for future object storage migration.

## Tradeoffs and Assumptions

- In-memory queue in TypeScript is simple for assessment use but non-durable.
- Shared database reduces setup friction but is not strict service isolation.
- Fake auth headers are acceptable for local assessment scope but not production-grade authentication.
- Manual SQL migrations in Python improve visibility and deterministic ordering, with more operational overhead than auto-generated migrations.

## Improvements With More Time

- Replace in-memory queue with durable queue infrastructure (for example Redis/BullMQ) and add retries/backoff/dead-letter handling.
- Split API and worker process deployment in TypeScript to scale independently.
- Add pagination/filtering on list endpoints and stronger API observability (structured logs, tracing, metrics).
- Add contract/integration tests against real Postgres for both services in CI.
- Add stricter schema constraints/index tuning based on expected query patterns and data growth.
- Introduce centralized auth/identity and shared gateway conventions if these services evolve beyond local assessment scope.
