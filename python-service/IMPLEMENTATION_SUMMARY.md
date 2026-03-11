# Implementation Summary — Briefing Report Generator

## Overview

This document covers the design decisions, architecture, and notable implementation details for the Briefing Report Generator feature added to the InsightOps Python service.

The feature adds four API endpoints on top of the existing FastAPI scaffold that allow analysts to create structured briefings, retrieve them, trigger report generation, and fetch a rendered HTML report.

---

## Project Structure (Briefing-Related Files)

```
app/
├── api/
│   └── briefings.py              # Route handlers for all 4 endpoints
├── models/
│   └── briefing.py               # ORM models: Briefing, BriefingPoint, BriefingMetric
├── schemas/
│   └── briefing.py               # Pydantic schemas: input validation + output shaping
├── services/
│   ├── briefing_service.py       # DB operations: create, get, mark_generated
│   └── report_formatter.py       # View model builder + Jinja2 rendering
├── templates/
│   ├── base.html                 # Jinja2 base template — defines shared HTML shell and blocks
│   └── report.html               # Extends base.html — fills title, styles, and content blocks

db/
└── migrations/
    ├── 002_create_briefing_tables.sql
    └── 002_create_briefing_tables.down.sql

tests/
├── conftest.py                   # Shared SQLite test fixture
└── test_briefings.py             # 12 endpoint + validation tests
```

---

## Data Model

I chose to store key points and risks in a single `briefing_points` table with a `type` discriminator column (`key_point` or `risk`), rather than two separate tables. The reasoning: they're structurally identical (just text content with an ordering), and grouping them in one table keeps queries simple. A `display_order` integer on each row preserves insertion order for rendering.

Metrics live in a separate `briefing_metrics` table. A unique index on `(briefing_id, name)` enforces the constraint that metric names must not repeat within the same briefing at the database level, complementing the application-level validation.

The `briefings` table carries `is_generated` (boolean) and `generated_at` (nullable timestamp) to track report generation state. These are set atomically in `mark_generated` so there's no window where `is_generated=true` but `generated_at` is null.

### Schema

```
briefings
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid()
  company_name   VARCHAR(255) NOT NULL
  ticker         VARCHAR(20)  NOT NULL
  sector         VARCHAR(255)
  analyst_name   VARCHAR(255)
  summary        TEXT         NOT NULL
  recommendation TEXT         NOT NULL
  is_generated   BOOLEAN      NOT NULL DEFAULT FALSE
  generated_at   TIMESTAMPTZ
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()

briefing_points
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid()
  briefing_id   UUID         NOT NULL REFERENCES briefings(id) ON DELETE CASCADE
  type          VARCHAR(20)  NOT NULL CHECK (type IN ('key_point', 'risk'))
  content       TEXT         NOT NULL
  display_order INTEGER      NOT NULL DEFAULT 0

briefing_metrics
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid()
  briefing_id UUID         NOT NULL REFERENCES briefings(id) ON DELETE CASCADE
  name        VARCHAR(255) NOT NULL
  value       VARCHAR(255) NOT NULL
  UNIQUE (briefing_id, name)
```

Cascade deletes are set on both child tables so cleaning up a briefing requires no explicit child deletion.

---

## API Endpoints

| Method | Path                       | Description                            | Status    |
| ------ | -------------------------- | -------------------------------------- | --------- |
| POST   | `/briefings`               | Create a briefing from JSON input      | 201       |
| GET    | `/briefings`               | List all briefings (newest first)      | 200       |
| GET    | `/briefings/{id}`          | Retrieve structured briefing data      | 200 / 404 |
| POST   | `/briefings/{id}/generate` | Mark as generated, return confirmation | 200 / 404 |
| GET    | `/briefings/{id}/html`     | Return rendered HTML report            | 200 / 404 |

`GET /briefings/{id}/html` returns `Content-Type: text/html` directly via FastAPI's `HTMLResponse`. If the briefing exists but `generate` hasn't been called yet, it returns 404 with an explanatory message rather than an empty or broken report.

`GET /briefings` returns a `BriefingListResponse` with `total` (integer count) and `items` (array of `BriefingRead`), ordered newest-first by `created_at`.

All JSON responses use camelCase field names to match the input shape defined in the spec. This is handled via `alias_generator=to_camel` on the Pydantic models and `response_model_by_alias=True` on the route decorators, so the ORM layer stays in snake_case throughout.

---

## Validation

All input validation lives in `BriefingCreate` (`app/schemas/briefing.py`). I used Pydantic v2 with `annotated_types` constraints (`MinLen`, `MaxLen`, `Len`) rather than `Field(min_length=...)` to avoid a compatibility issue with `alias_generator` in Pydantic 2.12 (more on that below).

Validation rules:

- `company_name` — required, non-empty, max 255 chars
- `ticker` — required, normalised to uppercase in a `@field_validator` before any length check runs
- `summary` / `recommendation` — required, non-empty
- `key_points` — minimum 2 items (`Len(2, None)`)
- `risks` — minimum 1 item (`MinLen(1)`)
- `metrics` — optional, defaults to empty list; a `@model_validator(mode="after")` checks for duplicate names (case-insensitive) across the list

Ticker normalisation strips whitespace and uppercases in one step. It runs in `mode="before"` so the length constraint runs against the final value.

---

## Service Layer

`briefing_service.py` contains three plain functions that take a `Session` as their first argument, matching the pattern already established in `sample_item_service.py`.

`create_briefing` uses `db.flush()` after inserting the parent `Briefing` to get its auto-incremented `id` before the transaction commits, then bulk-inserts all points and metrics in the same transaction. This avoids a round-trip commit just to get the ID. The `display_order` for points is the enumeration index from the input list, which preserves the order the analyst submitted.

`get_briefing` uses `selectinload` for both `points` and `metrics` relationships to avoid N+1 queries. A single `SELECT` for the briefing is followed by two IN-clause fetches for the child rows.

---

## Formatting / View Model

I kept template-rendering logic out of both the router and the raw service layer. `ReportFormatter` in `app/services/report_formatter.py` owns the transformation from ORM objects to a template-ready dict:

- Filters and sorts `briefing_points` by `display_order`, splitting into `key_points` and `risks` separately
- Normalises metric labels with `.title()` so `"p/e ratio"` becomes `"P/E Ratio"`
- Constructs `report_title` as `"{company_name} ({ticker}) — Briefing Report"`
- Formats `generated_at` as a human-readable string (`"March 10, 2026 at 10:23 UTC"`)
- Sets `has_metrics: bool` so the template can conditionally render the metrics table without any logic in the template itself

The Jinja2 environment is configured with `select_autoescape` covering HTML and XML, so all user-supplied content is escaped on output. The template never receives ORM objects directly.

---

## HTML Templates

The templates use Jinja2's `{% extends %}` / `{% block %}` inheritance system. `base.html` defines the HTML shell; child templates fill in the blocks without duplicating the document structure.

### `base.html` — shared shell

Defines three blocks that child templates override:

| Block                      | Purpose                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `{% block title %}`        | Text inside `<title>` — defaults to `InsightOps`           |
| `{% block extra_styles %}` | Additional `<style>` or `<link>` tags appended in `<head>` |
| `{% block content %}`      | Everything inside `<body>`                                 |

The base also carries a minimal CSS reset (`box-sizing`, `margin`, `padding`) and neutral body defaults that child templates can override in their own `extra_styles` block.

### `report.html` — briefing report

Extends `base.html` and fills all three blocks:

- **`title`** — `{{ report_title }}` (e.g. `Acme Holdings (ACME) — Briefing Report`)
- **`extra_styles`** — full report stylesheet: serif body font, `.page` card layout, company info grid, section headings, list markers, recommendation highlight block, metrics table
- **`content`** — the complete `.page` div containing the header, main body, and footer sections

The template itself stays declarative — no conditional logic beyond `{% if company.sector %}` and `{% if has_metrics %}`. All the business logic decisions (which points are key points vs risks, whether metrics exist, how to format the timestamp) are resolved in the view model before rendering.

### Adding a new page type

To add another server-side rendered page, create a new template in `app/templates/`:

```html
{% extends "base.html" %} {% block title %}My Page Title{% endblock %} {% block
extra_styles %}
<style>
  /* page-specific styles */
</style>
{% endblock %} {% block content %}
<!-- page body -->
{% endblock %}
```

Then add a corresponding `render_*` method in `ReportFormatter` and wire it to a route.

### `render_base` (utility method)

`ReportFormatter.render_base(title, body)` demonstrates that template inheritance also works for programmatically constructed pages. It uses `Environment.from_string()` to build an inline template that extends `base.html` — Jinja2 resolves the parent through the configured `FileSystemLoader`. This is mainly a dev/testing utility; production routes use `render_report`.

---

## Testing

Tests use an in-memory SQLite database via a shared `conftest.py` fixture that overrides the `get_db` FastAPI dependency. The fixture creates all tables with `Base.metadata.create_all()`, yields a `TestClient`, then drops everything after each test. The fixture was extracted from `test_sample_items.py` when the briefings tests were added so both test files share the same setup without duplication.

Coverage in `test_briefings.py`:

- Happy path for all 5 endpoints (including list)
- UUID validation: `id` fields in responses are valid UUID strings
- Ticker normalisation (lowercase input → uppercase stored)
- Validation failures: too few key points, no risks, duplicate metric names
- 404 behaviour for nonexistent briefings on GET, generate, and HTML endpoints — using random UUIDs instead of magic integers
- `GET /html` returns 404 if `generate` hasn't been called
- `GET /html` returns `text/html` content type and contains expected company data
- `GET /briefings` returns empty list when no briefings exist
- `GET /briefings` returns all briefings with correct `total` count

---

## Running the Service

```bash
# Apply migrations
python -m app.db.run_migrations up

# Start the server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest -v
```

### Example flow

```bash
# 1. Create a briefing
curl -X POST http://localhost:8000/briefings \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Holdings",
    "ticker": "acme",
    "sector": "Industrial Technology",
    "analystName": "Jane Doe",
    "summary": "Strong enterprise demand with improving operating leverage.",
    "recommendation": "Monitor for margin expansion before increasing exposure.",
    "keyPoints": ["Revenue grew 18% YoY.", "Management raised guidance."],
    "risks": ["Top two customers account for 41% of revenue."],
    "metrics": [{"name": "Revenue Growth", "value": "18%"}]
  }'

# 2. Retrieve the briefing  (replace $ID with the UUID returned in step 1)
curl http://localhost:8000/briefings/"$ID"

# 3. Generate the report
curl -X POST http://localhost:8000/briefings/"$ID"/generate

# 4. Fetch the rendered HTML
curl http://localhost:8000/briefings/"$ID"/html

# 5. List all briefings
curl http://localhost:8000/briefings
```
