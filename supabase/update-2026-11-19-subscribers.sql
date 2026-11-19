-- Email list: anyone can sign up from the homepage; only site admins can read or remove addresses.
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;
drop policy if exists "anyone can subscribe" on public.subscribers;
create policy "anyone can subscribe" on public.subscribers for insert to anon, authenticated with check (true);
drop policy if exists "admins read subscribers" on public.subscribers;
create policy "admins read subscribers" on public.subscribers for select using (public.is_admin());
drop policy if exists "admins delete subscribers" on public.subscribers;
create policy "admins delete subscribers" on public.subscribers for delete using (public.is_admin());
