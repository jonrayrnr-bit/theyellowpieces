-- The Yellow Pieces: line -> passage links (run once, after the earlier updates). Safe to run again.
-- A line (quote card) can say which piece it is an excerpt from and carry the passage around it.
-- The site then shows "An excerpt from ..." on the card page and a "Read the passage" page with the line highlighted.

alter table public.pieces
  add column if not exists from_title text not null default '' check (char_length(from_title) <= 140),   -- name of the piece the line comes from
  add column if not exists passage text not null default '' check (char_length(passage) <= 6000),         -- the paragraph or so around the line
  add column if not exists from_piece_id uuid references public.pieces (id) on delete set null;         -- the full piece, once it is posted

-- Admins set a line's passage from the Edit page.
create or replace function public.admin_set_passage(p_id uuid, p_from_title text, p_passage text, p_from_piece uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only site admins can do that.'; end if;
  update public.pieces set
    from_title = coalesce(p_from_title, from_title),
    passage = coalesce(p_passage, passage),
    from_piece_id = p_from_piece,
    updated_at = now()
  where id = p_id;
end $$;
grant execute on function public.admin_set_passage(uuid, text, text, uuid) to authenticated;
