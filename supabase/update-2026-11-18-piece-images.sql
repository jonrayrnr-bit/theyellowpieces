-- Piece images: a small SVG picture for a piece (from the Writing Desk).
-- Shown as the piece's tile and, faded, as the page background while reading.
alter table public.pieces add column if not exists image_svg text not null default ''
  check (char_length(image_svg) <= 80000);

-- Members still post as before; only admins attach images.
drop policy if exists "post your own pieces" on public.pieces;
create policy "post your own pieces" on public.pieces for insert
  with check (author_id = auth.uid() and (kind <> 'photo' or public.is_admin()) and (image_svg = '' or public.is_admin()));

create or replace function public.admin_set_piece_image(p_id uuid, p_svg text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only site admins can do that.'; end if;
  update public.pieces set image_svg = coalesce(p_svg, ''), updated_at = now() where id = p_id;
end $$;
