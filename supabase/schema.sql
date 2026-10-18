-- The Yellow Pieces database setup
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- Safe to run once on a fresh project.

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  bio text not null default '' check (char_length(bio) <= 280),
  created_at timestamptz not null default now()
);

-- The highlighter colors. Yellow is the site's own: the best words and pieces.
-- The others come from Jon's original highlighter map.
create table public.colors (
  slug text primary key,
  name text not null,
  meaning text not null,
  hex text not null,
  sort int not null default 0
);

-- Where a quote came from (the submission categories).
create table public.sources (
  slug text primary key,
  name text not null,
  description text not null default '',
  sort int not null default 0
);

-- Every post is a "piece". The kind decides which section it lives in.
--   quote  : a line from someone's life, shown over a background, plus the story behind it
--   piece  : the writer's own work: a line, poem, lyric or prose
--   story  : a short or long story about words that mattered
--   humor  : an anecdote, one-liner or quip that made people laugh
--   sketch : Sketches² — a short scene shared for feedback
create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('quote', 'piece', 'story', 'humor', 'sketch')),
  title text not null default '' check (char_length(title) <= 140),
  body text not null check (char_length(body) between 1 and 20000),
  said_by text not null default '' check (char_length(said_by) <= 140),       -- quotes: who said it
  source_slug text references public.sources (slug) on delete set null,      -- quotes: where it came from
  writeup text not null default '' check (char_length(writeup) <= 3000),     -- quotes: what it meant / why it stuck
  started_at text not null default '' check (char_length(started_at) <= 3000), -- sketches: where I started
  aiming_for text not null default '' check (char_length(aiming_for) <= 1500), -- sketches: what I'm trying to do
  color text not null default 'yellow' references public.colors (slug),
  backdrop text not null default 'aged' check (backdrop in ('aged', 'highlight', 'ink', 'parchment', 'dusk')),
  visibility text not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  status text not null default 'published' check (status in ('draft', 'published')),
  stuck_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- "This stuck with me": one per person per piece.
create table public.stuck (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  piece_id uuid not null references public.pieces (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, piece_id)
);

-- Readers' highlights: anyone signed in can mark a piece with a highlighter color.
create table public.highlights (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  piece_id uuid not null references public.pieces (id) on delete cascade,
  color text not null references public.colors (slug),
  created_at timestamptz not null default now(),
  primary key (user_id, piece_id, color)
);

create table public.comments (
  id bigserial primary key,
  piece_id uuid not null references public.pieces (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);

create table public.reports (
  id bigserial primary key,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  piece_id uuid references public.pieces (id) on delete cascade,
  comment_id bigint references public.comments (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index pieces_kind_idx on public.pieces (kind, created_at desc);
create index pieces_author_idx on public.pieces (author_id, created_at desc);
create index pieces_color_idx on public.pieces (color, created_at desc);
create index highlights_piece_idx on public.highlights (piece_id);
create index highlights_color_idx on public.highlights (color, piece_id);
create index comments_piece_idx on public.comments (piece_id, created_at);

-- ---------- "Stuck with me" count stays in sync ----------

create function public.sync_stuck_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.pieces set stuck_count = stuck_count + 1 where id = new.piece_id;
  elsif tg_op = 'DELETE' then
    update public.pieces set stuck_count = greatest(stuck_count - 1, 0) where id = old.piece_id;
  end if;
  return null;
end $$;

create trigger stuck_sync after insert or delete on public.stuck
for each row execute function public.sync_stuck_count();

-- ---------- Who can see a piece ----------

create function public.can_view_piece(p public.pieces) returns boolean
language sql stable as $$
  select (p.status = 'published' and p.visibility in ('public', 'unlisted'))
      or p.author_id = auth.uid()
$$;

-- ---------- Security rules ----------

alter table public.profiles enable row level security;
alter table public.colors enable row level security;
alter table public.sources enable row level security;
alter table public.pieces enable row level security;
alter table public.stuck enable row level security;
alter table public.highlights enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "make your own profile" on public.profiles for insert with check (id = auth.uid());
create policy "edit your own profile" on public.profiles for update using (id = auth.uid());

create policy "colors are public" on public.colors for select using (true);
create policy "sources are public" on public.sources for select using (true);

create policy "see visible pieces" on public.pieces for select using (public.can_view_piece(pieces));
create policy "post your own pieces" on public.pieces for insert with check (author_id = auth.uid());
create policy "edit your own pieces" on public.pieces for update using (author_id = auth.uid());
create policy "delete your own pieces" on public.pieces for delete using (author_id = auth.uid());

create policy "stuck is public" on public.stuck for select using (true);
create policy "mark as yourself" on public.stuck for insert with check (user_id = auth.uid());
create policy "unmark your own" on public.stuck for delete using (user_id = auth.uid());

create policy "highlights on visible pieces" on public.highlights for select
  using (exists (select 1 from public.pieces p where p.id = piece_id and public.can_view_piece(p)));
create policy "highlight as yourself" on public.highlights for insert with check (user_id = auth.uid());
create policy "remove your highlight" on public.highlights for delete using (user_id = auth.uid());

create policy "comments on visible pieces" on public.comments for select
  using (exists (select 1 from public.pieces p where p.id = piece_id and public.can_view_piece(p)));
create policy "comment as yourself" on public.comments for insert with check (author_id = auth.uid());
create policy "delete your own comments" on public.comments for delete using (author_id = auth.uid());

create policy "anyone signed in can report" on public.reports for insert with check (reporter_id = auth.uid());

-- Nobody can set the "stuck" count by hand: only the trigger above changes it.
revoke insert, update on public.pieces from anon, authenticated;
grant insert (author_id, kind, title, body, said_by, source_slug, writeup, started_at, aiming_for,
  color, backdrop, visibility, status) on public.pieces to authenticated;
grant update (title, body, said_by, source_slug, writeup, started_at, aiming_for,
  color, backdrop, visibility, status, updated_at) on public.pieces to authenticated;

-- ---------- Starter data ----------

insert into public.colors (slug, name, meaning, hex, sort) values
  ('yellow', 'Yellow', 'The best words and pieces: wisdom that lasted', '#F5D547', 1),
  ('blue',   'Blue',   'School and class pieces', '#7FB8E8', 2),
  ('green',  'Green',  'Family stories and reflections', '#8FD18A', 3),
  ('red',    'Red',    'Passion, love and relationships', '#F28B82', 4),
  ('orange', 'Orange', 'Other kinds of pieces', '#F7B267', 5),
  ('purple', 'Purple', 'Other kinds of pieces', '#C3A3E6', 6),
  ('gray',   'Gray',   'Rough drafts and works in progress', '#BDBDBD', 7);

insert into public.sources (slug, name, description, sort) values
  ('wisdom-passed-down', 'Words of wisdom passed to me', 'From a grandparent, a teacher, an elder, a culture', 1),
  ('family-motto', 'Family mottos', 'The things your family always said', 2),
  ('people-in-my-life', 'People in my life', 'Something someone close to you said', 3),
  ('helpful-words', 'Helpful, useful words', 'Lines you actually use', 4),
  ('surprising-time', 'Words that came in handy at a surprising time', 'They showed up right when you needed them', 5),
  ('highlights', 'Highlights of my day or life', 'A line that marks a moment', 6),
  ('old-words-young-mouths', 'Old words, young mouths', 'Wisdom from a child', 7);
