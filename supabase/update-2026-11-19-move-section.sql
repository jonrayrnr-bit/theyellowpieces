-- Lets site admins move a piece to a different section from the Edit page.
create or replace function public.admin_set_piece_kind(p_id uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only site admins can do that.'; end if;
  if p_kind not in ('quote', 'piece', 'poem', 'line', 'story', 'humor', 'sketch', 'photo') then raise exception 'Unknown section.'; end if;
  update public.pieces set kind = p_kind, updated_at = now() where id = p_id;
end $$;
grant execute on function public.admin_set_piece_kind(uuid, text) to authenticated;

-- Move the two pieces now (shows the rows it changed so you can check them).
update public.pieces set kind = 'poem', updated_at = now()
where kind = 'piece' and (title ilike '%good love poem%' or body ilike '%good love poem%')
returning id, kind, title;

update public.pieces set kind = 'line', updated_at = now()
where kind <> 'quote' and title ilike 'grow up%write now%'
returning id, kind, title;
