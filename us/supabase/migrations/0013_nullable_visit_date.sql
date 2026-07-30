-- supabase/migrations/0013_nullable_visit_date.sql
--
-- Bulk-importing historical visits (e.g. from an old Google My Maps
-- travel map) surfaced a real gap: `visited_at` was NOT NULL, forcing a
-- fabricated date for visits whose real date is genuinely unknown.
-- Dropping the constraint lets the app store "no sé cuándo" honestly
-- instead of lying with a placeholder date. add_visit's signature is
-- unchanged — `p_visited_at date` already accepted NULL as a value, the
-- table constraint was the only thing rejecting it.

alter table public.place_visits
  alter column visited_at drop not null;
