-- Durable chat history keyed to the verified Firebase identity.
-- The legacy public.chats table uses Supabase Auth UUIDs, not Firebase UIDs.
create table if not exists public.tiwat_chats (
  id text not null,
  firebase_uid text not null references public.tiwat_accounts(firebase_uid) on delete cascade,
  title text not null default 'New chat' check (char_length(title) <= 200),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (firebase_uid, id),
  check (jsonb_typeof(messages) = 'array')
);
-- Composite ownership key prevents one Firebase user from overwriting another user's chat by guessing an ID.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.tiwat_chats'::regclass and conname = 'tiwat_chats_pkey'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) then
    alter table public.tiwat_chats drop constraint tiwat_chats_pkey;
    alter table public.tiwat_chats add constraint tiwat_chats_pkey primary key (firebase_uid, id);
  end if;
end $$;
create index if not exists tiwat_chats_uid_updated_idx
  on public.tiwat_chats(firebase_uid, updated_at desc);
alter table public.tiwat_chats enable row level security;
revoke all on public.tiwat_chats from anon, authenticated;
grant all on public.tiwat_chats to service_role;
