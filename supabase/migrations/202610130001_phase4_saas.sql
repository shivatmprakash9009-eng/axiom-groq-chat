-- TIWAT SaaS Phase 4: durable usage, billing, teams, and API credentials.
-- Firebase remains the identity provider; firebase_uid is never trusted from request JSON.
create extension if not exists pgcrypto;

create table if not exists public.tiwat_accounts (
  firebase_uid text primary key,
  email text,
  plan text not null default 'free' check (plan in ('free','pro','team','enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tiwat_subscriptions (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null references public.tiwat_accounts(firebase_uid) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive',
  billing_interval text check (billing_interval in ('month','year')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tiwat_usage_events (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null references public.tiwat_accounts(firebase_uid) on delete cascade,
  idempotency_key text not null,
  utc_day date not null default (timezone('utc', now())::date),
  status text not null default 'reserved' check (status in ('reserved','completed','failed','released')),
  request_messages integer not null default 1 check (request_messages > 0),
  input_characters integer not null default 0 check (input_characters >= 0),
  prompt_tokens integer,
  completion_tokens integer,
  provider text,
  model text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(firebase_uid, idempotency_key)
);
create index if not exists tiwat_usage_events_uid_day_idx on public.tiwat_usage_events(firebase_uid, utc_day);

create table if not exists public.tiwat_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  owner_firebase_uid text not null references public.tiwat_accounts(firebase_uid) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.tiwat_team_members (
  team_id uuid not null references public.tiwat_teams(id) on delete cascade,
  firebase_uid text not null references public.tiwat_accounts(firebase_uid) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key(team_id, firebase_uid)
);

create table if not exists public.tiwat_api_keys (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null references public.tiwat_accounts(firebase_uid) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['chat:write']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tiwat_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

-- Do not expose billing, usage, team, or API credential tables to browser roles.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'tiwat_accounts','tiwat_subscriptions','tiwat_usage_events','tiwat_teams',
    'tiwat_team_members','tiwat_api_keys','tiwat_webhook_events'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from anon, authenticated', tbl);
    execute format('grant all on public.%I to service_role', tbl);
  end loop;
end $$;

create or replace function public.tiwat_reserve_daily_usage(
  p_firebase_uid text,
  p_idempotency_key text,
  p_input_characters integer,
  p_daily_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := timezone('utc', now())::date;
  v_used integer;
  v_event public.tiwat_usage_events%rowtype;
begin
  if p_firebase_uid is null or length(p_firebase_uid) < 1
     or p_idempotency_key is null or length(p_idempotency_key) not between 8 and 200
     or p_input_characters < 0 or p_daily_limit < 1 then
    raise exception 'invalid quota reservation arguments' using errcode = '22023';
  end if;

  insert into public.tiwat_accounts(firebase_uid) values (p_firebase_uid)
  on conflict (firebase_uid) do nothing;

  -- Serialize quota reservations per account/day so concurrent requests cannot overspend.
  perform pg_advisory_xact_lock(hashtextextended(p_firebase_uid || ':' || v_day::text, 0));

  select * into v_event from public.tiwat_usage_events
   where firebase_uid = p_firebase_uid and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('allowed', v_event.status <> 'released', 'duplicate', true,
      'used', (select count(*) from public.tiwat_usage_events where firebase_uid=p_firebase_uid and utc_day=v_day and status <> 'released'),
      'limit', p_daily_limit, 'event_id', v_event.id);
  end if;

  select count(*)::integer into v_used from public.tiwat_usage_events
   where firebase_uid = p_firebase_uid and utc_day = v_day and status <> 'released';

  if v_used >= p_daily_limit then
    return jsonb_build_object('allowed', false, 'duplicate', false, 'used', v_used, 'limit', p_daily_limit,
      'reset_at', ((v_day + 1)::timestamp at time zone 'UTC'));
  end if;

  insert into public.tiwat_usage_events(firebase_uid, idempotency_key, utc_day, input_characters)
  values (p_firebase_uid, p_idempotency_key, v_day, p_input_characters)
  returning * into v_event;

  return jsonb_build_object('allowed', true, 'duplicate', false, 'used', v_used + 1, 'limit', p_daily_limit,
    'event_id', v_event.id, 'reset_at', ((v_day + 1)::timestamp at time zone 'UTC'));
end;
$$;

create or replace function public.tiwat_finish_usage(
  p_event_id uuid,
  p_status text,
  p_provider text default null,
  p_model text default null,
  p_prompt_tokens integer default null,
  p_completion_tokens integer default null,
  p_latency_ms integer default null
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed','failed','released') then
    raise exception 'invalid usage status' using errcode = '22023';
  end if;
  update public.tiwat_usage_events set status=p_status, provider=p_provider, model=p_model,
    prompt_tokens=greatest(p_prompt_tokens,0), completion_tokens=greatest(p_completion_tokens,0),
    latency_ms=greatest(p_latency_ms,0), completed_at=now()
   where id=p_event_id;
  return found;
end;
$$;

revoke all on function public.tiwat_reserve_daily_usage(text,text,integer,integer) from public, anon, authenticated;
revoke all on function public.tiwat_finish_usage(uuid,text,text,text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.tiwat_reserve_daily_usage(text,text,integer,integer) to service_role;
grant execute on function public.tiwat_finish_usage(uuid,text,text,text,integer,integer,integer) to service_role;
