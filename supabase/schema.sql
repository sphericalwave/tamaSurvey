-- Tamarack Process Survey — Supabase schema.
-- Run this whole file in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: uses "if not exists" / "or replace" where possible.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text,
  process text not null,
  satisfaction int2 not null,           -- 1..5
  time_lost text not null,              -- none / <1hr / 1-3hrs / 3-5hrs / 5+hrs
  pain_point text,                      -- only collected when satisfaction <= 3
  desired_change text                   -- only collected when satisfaction <= 3
);

create table if not exists survey_priorities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text,
  process text not null,
  rank int2 not null                    -- 1, 2, or 3
);

create table if not exists survey_client_risk (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role text,
  had_client_facing_issue boolean not null,
  detail text
);

-- ---------------------------------------------------------------------------
-- Row Level Security: anon may INSERT only. No anon SELECT on base tables,
-- so raw text answers (pain_point, desired_change, detail) are never readable
-- with the public anon key.
-- ---------------------------------------------------------------------------

alter table survey_responses   enable row level security;
alter table survey_priorities  enable row level security;
alter table survey_client_risk enable row level security;

drop policy if exists anon_insert on survey_responses;
create policy anon_insert on survey_responses
  for insert to anon with check (true);

drop policy if exists anon_insert on survey_priorities;
create policy anon_insert on survey_priorities
  for insert to anon with check (true);

drop policy if exists anon_insert on survey_client_risk;
create policy anon_insert on survey_client_risk
  for insert to anon with check (true);

-- ---------------------------------------------------------------------------
-- Aggregate views: the ONLY things the public results page can read.
-- Views run with the definer's privileges, so anon can select grouped math
-- without gaining access to the underlying rows.
-- ---------------------------------------------------------------------------

create or replace view survey_aggregates as
select
  process,
  count(*)                                         as responses,
  round(avg(satisfaction)::numeric, 2)             as avg_satisfaction,
  mode() within group (order by time_lost)         as most_common_time_lost
from survey_responses
group by process;

create or replace view survey_priority_scores as
select
  process,
  rank,
  count(*) as votes
from survey_priorities
group by process, rank;

grant select on survey_aggregates to anon;
grant select on survey_priority_scores to anon;
