CREATE TABLE IF NOT EXISTS briefings (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name   VARCHAR(255) NOT NULL,
  ticker         VARCHAR(20)  NOT NULL,
  sector         VARCHAR(255),
  analyst_name   VARCHAR(255),
  summary        TEXT         NOT NULL,
  recommendation TEXT         NOT NULL,
  is_generated   BOOLEAN      NOT NULL DEFAULT FALSE,
  generated_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS briefing_points (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id   UUID         NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  type          VARCHAR(20)  NOT NULL CHECK (type IN ('key_point', 'risk')),
  content       TEXT         NOT NULL,
  display_order INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_briefing_points_briefing_id ON briefing_points(briefing_id);

CREATE TABLE IF NOT EXISTS briefing_metrics (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID         NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  value       VARCHAR(255) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_briefing_metrics_unique_name ON briefing_metrics(briefing_id, name);
CREATE INDEX IF NOT EXISTS idx_briefing_metrics_briefing_id ON briefing_metrics(briefing_id);
