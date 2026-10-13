-- Enforce per-user uniqueness so a guessed chat ID cannot overwrite another account's row.
alter table public.tiwat_chats drop constraint if exists tiwat_chats_pkey;
alter table public.tiwat_chats add constraint tiwat_chats_pkey primary key (firebase_uid, id);
