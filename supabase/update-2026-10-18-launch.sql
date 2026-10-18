-- The Yellow Pieces: launch update (photos, featured, pick-one pairs, trending)
-- Run this ONCE, after schema.sql, in Supabase: SQL Editor -> New query -> paste all -> Run.
-- Then add yourself as the site admin with the one line at the very bottom.

-- ---------- Site admins (who can upload photos, feature pieces and set up pairs) ----------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
create policy "admins can see the admin list" on public.admins for select using (user_id = auth.uid());

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ---------- Pieces: photos, featured, picture posts, reply counts ----------

alter table public.pieces
  add column photo_path text not null default '' check (char_length(photo_path) <= 300),
  add column photo_has_text boolean not null default false,   -- true for quote posts with the words already in the picture
  add column photo_alt text not null default '' check (char_length(photo_alt) <= 300),
  add column featured boolean not null default false,
  add column featured_at timestamptz,
  add column comment_count int not null default 0;

-- New kind: 'photo' (Pictures along the way). Only admins can post these for now.
alter table public.pieces drop constraint pieces_kind_check;
alter table public.pieces add constraint pieces_kind_check
  check (kind in ('quote', 'piece', 'story', 'humor', 'sketch', 'photo'));

create index pieces_featured_idx on public.pieces (featured, featured_at desc);

-- Members still post the same way; only admins (through the functions below) set photos and featured.
drop policy "post your own pieces" on public.pieces;
create policy "post your own pieces" on public.pieces for insert
  with check (author_id = auth.uid() and (kind <> 'photo' or public.is_admin()));

create function public.admin_set_piece_media(
  p_id uuid, p_photo_path text, p_photo_has_text boolean, p_photo_alt text, p_featured boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only site admins can do that.'; end if;
  update public.pieces set
    photo_path = coalesce(p_photo_path, photo_path),
    photo_has_text = coalesce(p_photo_has_text, photo_has_text),
    photo_alt = coalesce(p_photo_alt, photo_alt),
    featured = coalesce(p_featured, featured),
    featured_at = case when p_featured is true and not featured then now()
                       when p_featured is false then null else featured_at end,
    updated_at = now()
  where id = p_id;
end $$;

-- Reply count stays in sync, so Trending can weigh conversation, not just "stuck".
create function public.sync_comment_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.pieces set comment_count = comment_count + 1 where id = new.piece_id;
  elsif tg_op = 'DELETE' then
    update public.pieces set comment_count = greatest(comment_count - 1, 0) where id = old.piece_id;
  end if;
  return null;
end $$;
create trigger comment_sync after insert or delete on public.comments
for each row execute function public.sync_comment_count();
update public.pieces p set comment_count = (select count(*) from public.comments c where c.piece_id = p.id);

-- ---------- Pick-one pairs ("Which one speaks to you?") ----------

create table public.pairs (
  id bigserial primary key,
  a_piece uuid not null references public.pieces (id) on delete cascade,
  b_piece uuid not null references public.pieces (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (a_piece <> b_piece)
);
alter table public.pairs enable row level security;
create policy "pairs are public" on public.pairs for select using (true);
create policy "admins add pairs" on public.pairs for insert with check (public.is_admin());
create policy "admins change pairs" on public.pairs for update using (public.is_admin());
create policy "admins remove pairs" on public.pairs for delete using (public.is_admin());

-- Votes don't need an account: each browser gets a random key, one vote per pair.
create table public.pair_votes (
  pair_id bigint not null references public.pairs (id) on delete cascade,
  voter_key text not null check (char_length(voter_key) between 16 and 64),
  choice text not null check (choice in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (pair_id, voter_key)
);
alter table public.pair_votes enable row level security;
create policy "anyone can vote once" on public.pair_votes for insert to anon, authenticated with check (true);

-- Totals only; individual votes stay private.
create function public.pair_results(p_pair bigint) returns table (a_votes bigint, b_votes bigint)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where choice = 'a'), count(*) filter (where choice = 'b')
  from public.pair_votes where pair_id = p_pair
$$;

-- ---------- Photo storage ----------
-- A public "photos" bucket: anyone can view; only admins can add, replace or remove.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png']);

create policy "admins upload photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_admin());
create policy "admins replace photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.is_admin());
create policy "admins remove photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());

-- ---------- Make yourself the admin ----------
-- Sign in to the site once first. Then put your sign-in email between the quotes,
-- and run just this line (select it and click Run). Don't save your email in this file.
--
-- insert into public.admins (user_id) select id from auth.users where email = 'YOUR SIGN-IN EMAIL';
