-- Durable chat history keyed to the verified Firebase identity.
-- The existing public.chats table uses Supabase Auth UUIDs; Firebase UIDs are not UUIDs,
-- so keep the Firebase-backed workspace history in its own server-only table.
create table if not exists public.tiwat_chats (
  id text primary key,
  firebase_uid text not null references public.tiwat_accounts(firebase_uid) on delete cascade,
  title text not null default 'New chat' check (char_length(title) <= 200),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(messages) = 'array')
);
create index if not exists tiwat_chats_uid_updated_idx
  on public.tiwat_chats(firebase_uid, updated_at desc);
alter table public.tiwat_chats enable row level security;
revoke all on public.tiwat_chats from anon, authenticated;
grant all on public.tiwat_chats to service_role;
