-- Let site admins delete any piece (not just their own) from the Site admin page.
drop policy if exists "admins delete any piece" on public.pieces;
create policy "admins delete any piece" on public.pieces for delete using (public.is_admin());
