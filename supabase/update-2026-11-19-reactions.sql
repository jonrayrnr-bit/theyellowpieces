-- Emoji reactions: one reaction per person per piece (they can change or remove it).
create table if not exists public.reactions (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  piece_id uuid not null references public.pieces (id) on delete cascade,
  emoji text not null check (emoji in ('smile', 'laugh', 'cry', 'love', 'mindblown', 'uneasy')),
  created_at timestamptz not null default now(),
  primary key (user_id, piece_id)
);

alter table public.reactions enable row level security;

drop policy if exists "reactions are public" on public.reactions;
drop policy if exists "react as yourself" on public.reactions;
drop policy if exists "change your reaction" on public.reactions;
drop policy if exists "remove your reaction" on public.reactions;
create policy "reactions are public" on public.reactions for select using (true);
create policy "react as yourself" on public.reactions for insert with check (user_id = auth.uid());
create policy "change your reaction" on public.reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "remove your reaction" on public.reactions for delete using (user_id = auth.uid());

-- Counts per emoji for a list of pieces (one call per page of cards).
create or replace function public.reaction_counts(ids uuid[])
returns table (piece_id uuid, emoji text, n bigint)
language sql stable as $$
  select r.piece_id, r.emoji, count(*) from public.reactions r
  where r.piece_id = any(ids) group by r.piece_id, r.emoji
$$;
grant execute on function public.reaction_counts(uuid[]) to anon, authenticated;
