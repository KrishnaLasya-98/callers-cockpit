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

-- Original fictional demo data; no transcript people or companies are distributed.
insert into leads (company, contact_name, prospect_role, phone, kind, language, notes, status, verify_needed)
select * from (values
('Aster Precision', 'Maya S.', 'Operations director', '+91 00000 00001', 'manufacturing', 'English', 'Original demo: ask about production capacity before discussing growth.', 'queue', false),
('Cedar Mobility', 'Arun P.', 'Founder', '+91 00000 00002', 'mobility', 'Hinglish', 'Original demo: a callback was offered. Confirm a day and time.', 'follow_up', false),
('Lumen Packaging', 'Nila R.', 'Managing director', '+91 00000 00003', 'packaging', 'English', 'Original demo: interested in a written introduction before a meeting.', 'queue', false),
('Willow Textiles', 'Dev K.', 'Plant head', '+91 00000 00004', 'textiles', 'Hindi', 'Original demo: confirm decision authority and preferred language.', 'queue', false),
('Solace Instruments', 'Ira M.', 'Finance director', '+91 00000 00005', 'instruments', 'English', 'Original demo: existing supplier. Understand fit without assuming interest.', 'not_interested', false),
('Juniper Foods', 'Aadi T.', 'Owner', '+91 00000 00006', 'food manufacturing', 'English', 'Original demo: contact opted out. Do not dial.', 'do_not_call', false),
('Copperleaf Systems', 'Tara V.', 'Former director', '+91 00000 00007', 'automation', 'English', 'Original demo: contact details need verification before another call.', 'moved_company', true),
('Meadow Components', 'Ravi L.', 'Production director', '+91 00000 00008', 'components', 'Marathi', 'Original demo: explain the offer briefly and listen for a practical constraint.', 'queue', false),
('Pinecrest Materials', 'Sara B.', 'Commercial director', '+91 00000 00009', 'materials', 'English', 'Original demo: report review on a named channel, no meeting commitment yet.', 'agreed_to_receive_report', false),
('Cobalt Works', 'Kiran D.', 'Founder', '+91 00000 00010', 'engineering', 'Kannada', 'Original demo: route to an appropriate language specialist if needed.', 'queue', false)
) as sample(company, contact_name, prospect_role, phone, kind, language, notes, status, verify_needed)
where not exists (select 1 from leads existing where existing.company = sample.company);
