-- ============================================================
-- Caller's Cockpit — Supabase schema (v2, grounded in the readings)
--   8-stage call model, the transcripts' outcome vocabulary,
--   per-stage tap events, "their words" capture, next-step discipline.
-- Run this whole file in the Supabase SQL Editor.
-- ============================================================

create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  company       text not null,
  contact_name  text,
  prospect_role text,
  phone         text,
  kind          text,                    -- company_kind from the index: listed Indian company, mid-size private manufacturer, ...
  language      text not null default 'English',
  notes         text,
  status        text not null default 'queue', -- mirrors last call outcome (10-word vocabulary) or 'queue'
  next_step_text     text,
  next_step_at       timestamptz,        -- set when a back-time is pinned
  verify_needed      boolean not null default false,  -- wrong-person / moved / number-recycled flags
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists calls (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  started_at    timestamptz not null default now(),
  duration_s    int not null default 0,
  -- the transcripts' outcome vocabulary exactly:
  outcome       text not null default 'not_logged' check (outcome in (
    'agreed_to_receive_report','next_step_agreed','interested','follow_up',
    'call_again','not_interested','do_not_call','wrong_person','moved_company','not_logged')),
  -- highest stage with substance, 1..8
  stage_reached int not null default 1 check (stage_reached between 1 and 8),
  language      text,
  their_words   text,                    -- stage 5: what the prospect said in their own words
  next_step_text        text,
  next_step_has_time    boolean not null default false,  -- day+time+channel = real next step
  summary       text,
  llm_reviewed  boolean not null default false,
  logged_vs_observed_note text            -- set when LLM audit disagrees with logged outcome
);

-- Every stage tap during the call (the only thing the caller does live)
create table if not exists stage_events (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid not null references calls(id) on delete cascade,
  stage       int not null check (stage between 1 and 8),
  tap         text not null,             -- what happened, one tap
  note        text,                      -- optional tiny detail (name, language, time)
  created_at  timestamptz not null default now()
);

create index if not exists idx_leads_status     on leads(status);
create index if not exists idx_calls_lead       on calls(lead_id);
create index if not exists idx_calls_stage      on calls(stage_reached);
create index if not exists idx_events_call      on stage_events(call_id);

create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists leads_touch on leads;
create trigger leads_touch before update on leads
for each row execute function touch_updated_at();

alter table leads        enable row level security;
alter table calls        enable row level security;
alter table stage_events enable row level security;
-- Backend uses the service-role key => bypasses RLS. No other policies: locked by default.

-- ============================================================
-- Seed: leads drawn from the transcript world
-- (fictional Meridian Growth Partners-style prospects)
-- ============================================================
insert into leads (company, contact_name, prospect_role, phone, kind, language, notes, status, verify_needed) values
('Kalpana Chem Supplies', 'S. Rao', 'Technical Services Director', '+91 98xxx 11111', 'mid-size private company', 'English', 'From T001 — last call went to next_step_agreed. Confirm names before dialing.', 'interested', false),
('Kalyx Enterprises', 'Kalyx switchboard', null, '+91 98xxx 22222', 'mid-size private company', 'English', 'From T046 — outcome was not_logged. Reception screens dialers.', 'queue', true),
('Aerolink Signal Systems', 'R. Iyer', 'listed as Director, Strategic Marketing', '+91 98xxx 33333', 'mid-size private company', 'English', 'From T004 — wrong_person. Ask for Strategic Marketing, not marketing.', 'wrong_person', true),
('Kaveri Electric Motors', 'V. Menon', 'Chief Executive Officer', '+91 98xxx 44444', 'mid-size private manufacturer', 'English', 'From T006 — next_step_agreed, strong call. Hand to leadership.', 'next_step_agreed', false),
('Udhav Textiles', 'Udhav group desk', null, '+91 98xxx 55555', 'listed Indian company', 'English', 'From T007 — not_interested after 59s. Keep for quarterly touch.', 'not_interested', false),
('Novara Foods India', 'Novara office', null, '+91 98xxx 66666', 'India arm of a multinational', 'English', 'From T003 — do_not_call in 34s. Do not redial this quarter.', 'do_not_call', false),
('Suvarna Microsystems', 'Suvarna office', null, '+91 98xxx 77777', 'startup', 'English', 'From T005 — not_logged, 36s. Number may be stale.', 'queue', true),
('Orbit Automation', 'A. Sharma', 'CEO and CTO', '+91 98xxx 88888', 'startup', 'English', 'From T002 — promised a 30-minute call-back but logged nothing. Pin the back-time this round.', 'follow_up', false),
('Surana Metal Works', 'M. Bhat', 'Promoter', '+91 98xxx 99999', 'mid-size private manufacturer', 'Hinglish', 'Composite lead — language wall risk in first 30s. Ask language first.', 'queue', false),
('Bharat Forgefold Pvt Ltd', 'N. Pillai', 'Managing Director', '+91 98xxx 10101', 'mid-size private manufacturer', 'English', 'Fresh lead. Objection-archetype expected: already have consultants.', 'queue', false);
