-- ============================================================
-- FALLBACK (only if the secret key keeps failing):
-- Grants the publishable/anon key read-write to the three tables.
-- Run this AFTER schema.sql if we end up on the publishable path.
-- ============================================================

create policy "anon full access on leads" on leads
  for all to anon using (true) with check (true);

create policy "anon full access on calls" on calls
  for all to anon using (true) with check (true);

create policy "anon full access on stage_events" on stage_events
  for all to anon using (true) with check (true);
