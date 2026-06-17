-- Full-text search: generated tsvector columns + GIN indexes for tasks and notes.

ALTER TABLE "tasks"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("title", ''))) STORED;

CREATE INDEX "tasks_search_idx" ON "tasks" USING GIN ("searchVector");

ALTER TABLE "notes"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("content"::text, ''))
  ) STORED;

CREATE INDEX "notes_search_idx" ON "notes" USING GIN ("searchVector");
