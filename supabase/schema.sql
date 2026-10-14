-- ============================================================
-- Cadence — schéma Supabase
-- À exécuter UNE FOIS dans : Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Table des publications (mêmes champs que l'app locale)
create table if not exists public.posts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  pillar text not null default 'educational',
  status text not null default 'draft',
  media_type text not null default 'text',
  scheduled_date text,
  scheduled_time text,
  platforms jsonb not null default '[]',
  variants jsonb not null default '{}',
  media_url text,
  media_preview text,
  media_kind text,
  media_items jsonb not null default '[]',
  duration text,
  script text,
  notes text,
  pinned_comment text,
  created_at text not null,
  updated_at text not null,
  published_at text
);

-- 2) RLS : chacun ne voit que ses propres publications
alter table public.posts enable row level security;

-- Droits d'accès de base (sans ça, RLS bloque tout même avec les policies)
grant all on table public.posts to anon, authenticated;

drop policy if exists "posts_select_own" on public.posts;
create policy "posts_select_own"
  on public.posts for select
  using (auth.uid() = user_id);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
  on public.posts for delete
  using (auth.uid() = user_id);

-- 3) Bucket privé pour les photos/vidéos (phase 2 : upload serveur)
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "media_select_own" on storage.objects;
create policy "media_select_own"
  on storage.objects for select
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "media_insert_own" on storage.objects;
create policy "media_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "media_update_own" on storage.objects;
create policy "media_update_own"
  on storage.objects for update
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "media_delete_own" on storage.objects;
create policy "media_delete_own"
  on storage.objects for delete
  using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
