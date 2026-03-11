# Implementation Summary

## Overview

This document covers the design decisions, architecture choices, and trade-offs I made while building the candidate document intake and async summary generation workflow on top of the provided NestJS starter.

---

## What I Built

The task required four API endpoints, an async background worker, structured LLM output, and workspace-scoped access control. Here is what was implemented:

- `POST /candidates/:candidateId/documents` — upload a candidate document (text-based)
- `POST /candidates/:candidateId/summaries/generate` — enqueue async summary generation
- `GET /candidates/:candidateId/summaries` — list all summaries for a candidate
- `GET /candidates/:candidateId/summaries/:summaryId` — retrieve a single summary
- A background worker that processes the queue, calls the LLM, and persists structured results
- A real Gemini provider and a fake fallback for local development
- Swagger UI at `GET /docs` with accurate request/response schemas and security schemes

---

## Architecture Decisions

### Module Structure

I put everything in a single `src/candidates/` module rather than splitting into separate `documents` and `summaries` submodules. The two resources are tightly coupled — documents are an input to summary generation, and the candidate is always the routing anchor. A single module with a service that handles both kept things readable and avoided unnecessary indirection.

The module imports `LlmModule` and `QueueModule` explicitly rather than relying on global providers. I wanted each module's dependencies to be visible at a glance.

### Data Model

**`candidate_documents`** stores the raw text content directly in the database rather than on disk. The `storage_key` field is a path-like identifier (`local/<candidateId>/<uuid>-<fileName>`) that acts as a placeholder for a real storage backend. If this were going to a real file store (S3, GCS), the worker would read from there via the key. For this assessment, serving text directly from the DB is practical and testable without infrastructure dependencies.

**`candidate_summaries`** stores both the structured result and workflow state. The status field drives the state machine: `pending` → `completed` | `failed`. I stored `strengths` and `concerns` as a PostgreSQL `simple-array` (comma-separated text) rather than JSONB. The values are plain string lists and do not need structured querying, so a simple array avoids the overhead of JSON serialisation and keeps the column type straightforward.

I stored `provider` and `prompt_version` on every summary record. This makes it easy to audit which model version produced a given result and reproduct issues if the prompt changes in future.

`updatedAt` is managed explicitly rather than via `@UpdateDateColumn()`. The summary is only written to twice — once when created (pending) and once when the worker finishes. Explicit assignment makes the state transitions more readable in the worker and avoids surprises from ORM hooks in tests.

### Queue and Worker

The existing `QueueService` was a push-only in-memory array — no processing whatsoever. Rather than swap it out for BullMQ (which would require Redis and a significant setup change), I extended it with a `registerProcessor` method backed by a `Map`. When a job is enqueued and a matching handler is registered, the handler runs asynchronously in the background via a fire-and-forget call with error logging.

The `SummaryWorkerService` implements `OnModuleInit` and registers its processor during application startup. This guarantees the handler is in place before any HTTP requests are served.

The key invariant I wanted is: the controller enqueues the job, saves the pending record, and returns `202` — all before the LLM call begins. That is what happens. The worker's async handler runs after the HTTP response is flushed.

Errors during processing are caught, logged, and persisted as `status='failed'` with the `errorMessage` populated. The API does not crash.

### Access Control

Workspace-scoped access is enforced by `CandidateAccessGuard`, applied alongside `FakeAuthGuard` at the controller class level. The guard runs after `FakeAuthGuard` has populated `request.user`, then queries the candidate repository for `{ id: candidateId, workspaceId }`. Both not-found and cross-workspace cases throw `NotFoundException` — the two are deliberately indistinguishable to avoid leaking whether a candidate ID exists in a different workspace.

Placing the check in a guard makes the access boundary declarative and visible at the controller level. New route handlers automatically inherit the check without needing to remember to call a helper, which removes the risk of a future method silently bypassing it. The service no longer needs to query the candidate repository; its methods receive only a `candidateId` string and are scoped purely to document and summary operations.

### LLM Provider

The provider abstraction was already in place in the starter — I implemented the real version against it.

`GeminiSummarizationProvider` uses the `@google/genai` SDK with `responseMimeType: 'application/json'` and a JSON schema in the `config`. This requests structured output from the model rather than parsing free-form text. Even with structured output, I added an explicit runtime validator (`parseAndValidate`) that checks every field before accepting the response. If any field is missing or malformed, the method throws, the worker catches it, and the summary is marked `failed` with the error message.

`PROMPT_VERSION = 'v1'` is defined in the provider file alongside the prompt itself. If the prompt ever changes significantly, bumping this constant and persisting it on the summary record makes it possible to identify which summaries were generated with which prompt version.

`LlmModule` uses a factory provider that checks for `GEMINI_API_KEY` at startup. If the key is present, the real provider is returned. If not, the fake is returned. No code change is needed to switch — just set the environment variable. Tests never see the real provider.

### Validation

The global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` was already configured in the starter. I added `class-validator` decorators to `UploadDocumentDto`:

- `documentType` uses `@IsIn(['resume', 'cover_letter', 'portfolio', 'other'])` to keep a closed set of types
- `fileName` has `@MaxLength(255)` matching the DB column constraint
- `rawText` requires `@MinLength(1)` to reject empty uploads

The validation error messages from `class-validator` are descriptive enough that I did not add custom messages.

### Testing

Tests follow the pattern already established in `sample.service.spec.ts` — jest manual mocks for repositories, no real DB, no real network calls.

`candidates.service.spec.ts` covers:

- Document upload writes correct fields to the repository
- Summary request saves a pending record and enqueues a job

`summary-worker.service.spec.ts` covers:

- The correct processor name is registered on `onModuleInit`
- A successful LLM call sets `status='completed'` and persists all result fields
- An LLM error sets `status='failed'` and stores the error message
- A missing summary ID is handled gracefully without a crash

The `FakeSummarizationProvider` is used in all success-path worker tests. A `jest.fn().mockRejectedValue(...)` is used for the failure-path test — no live API call is made at any point.

### Swagger

`@nestjs/swagger@8` was installed (v10-compatible). The Swagger document is served at `GET /docs`.

The two auth headers are declared as `apiKey` security schemes in `DocumentBuilder`. Controllers use `@ApiSecurity` to reference them, which causes the lock icons to appear on the correct routes in the UI. DTOs and entities are annotated with `@ApiProperty` so request/response schemas render accurately.

---

## Technology Stack

| Concern    | Choice                                                       |
| ---------- | ------------------------------------------------------------ |
| Framework  | NestJS 10 / Express                                          |
| Database   | PostgreSQL via TypeORM 0.3                                   |
| Migrations | TypeORM migration runner (no `synchronize`)                  |
| Queue      | In-memory (extended from starter)                            |
| LLM        | Google Gemini `gemini-2.0-flash` via `@google/genai`         |
| Validation | `class-validator` + global `ValidationPipe`                  |
| API docs   | `@nestjs/swagger` v8, served at `/docs`                      |
| Testing    | Jest + `ts-jest`, `@nestjs/testing`                          |

---

## Limitations and Known Trade-offs

**In-memory queue is not durable.** Jobs are lost on process restart. Replacing `QueueService` with BullMQ or a similar durable queue would be the first production hardening step. The abstraction is already in place — it would be a matter of re-implementing the interface against Redis.

**Single-process worker.** The worker runs in the same NestJS application as the API. In production these should be separate deployable processes so the API and workers can scale independently and a failing worker does not take down the API.

**No retry logic.** Failed summaries are not retried. Their `errorMessage` captures the failure reason. A production implementation would want configurable retry limits and exponential backoff, which BullMQ provides out of the box.

**Text stored in DB.** Raw document text is stored directly in `candidate_documents.raw_text`. For large documents this trades simplicity for storage efficiency. The `storage_key` field is the hook point for moving to object storage.

**No pagination.** `listSummaries` returns all records for a candidate. For candidates with many summaries this would need cursor or offset pagination.

**Workspace auto-creation.** The `ensureWorkspace` helper in `SampleService` auto-creates workspace records on first use. This is fine for development but in production workspaces would be explicitly provisioned.

---

## Running the Full Flow

```bash
# 1. Start the database
docker compose up -d postgres

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Add GEMINI_API_KEY=<your key> if you want real LLM calls

# 4. Run migrations
npm run migration:run

# 5. Start the service
npm run start:dev

# 6. Open Swagger UI
open http://localhost:3000/docs
```

```bash
# Create a candidate
curl -X POST http://localhost:3000/sample/candidates \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-1" -H "x-workspace-id: ws-1" \
  -d '{"fullName": "Ada Lovelace", "email": "ada@example.com"}'

# Upload a document (use the candidateId from above)
curl -X POST http://localhost:3000/candidates/<candidateId>/documents \
  -H "Content-Type: application/json" \
  -H "x-user-id: user-1" -H "x-workspace-id: ws-1" \
  -d '{"documentType":"resume","fileName":"ada.txt","rawText":"10 years building distributed systems..."}'

# Request summary generation
curl -X POST http://localhost:3000/candidates/<candidateId>/summaries/generate \
  -H "x-user-id: user-1" -H "x-workspace-id: ws-1"

# Poll until status = completed
curl http://localhost:3000/candidates/<candidateId>/summaries/<summaryId> \
  -H "x-user-id: user-1" -H "x-workspace-id: ws-1"
```
