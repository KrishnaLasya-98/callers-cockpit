-- Use only AFTER configuring a real service-role key in Render and verifying /ready.
-- The backend authenticates an allowlisted workspace and uses that server-only key.
-- Review in Supabase SQL Editor; revoking anon access would break an anon-key backend.
begin;
alter table public.leads enable row level security;
alter table public.calls enable row level security;
alter table public.stage_events enable row level security;
drop policy if exists "anon full access on leads" on public.leads;
drop policy if exists "anon full access on calls" on public.calls;
drop policy if exists "anon full access on stage_events" on public.stage_events;
commit;
-- Inspect any other policies before considering real prospect data:
select tablename, policyname, roles, cmd from pg_policies
where schemaname = 'public' and tablename in ('leads','calls','stage_events');
