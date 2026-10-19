-- The Yellow Pieces: admin editing (run once, after update-2026-10-18-launch.sql). Safe to run again.
-- Lets site admins change the words and settings of any piece from the site's Edit page.

create or replace function public.admin_update_piece(
  p_id uuid, p_title text, p_body text, p_said_by text, p_writeup text,
  p_aiming_for text, p_started_at text, p_color text, p_source_slug text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only site admins can do that.'; end if;
  update public.pieces set
    title = coalesce(p_title, title),
    body = coalesce(p_body, body),
    said_by = coalesce(p_said_by, said_by),
    writeup = coalesce(p_writeup, writeup),
    aiming_for = coalesce(p_aiming_for, aiming_for),
    started_at = coalesce(p_started_at, started_at),
    color = coalesce(p_color, color),
    source_slug = coalesce(p_source_slug, source_slug),
    updated_at = now()
  where id = p_id;
end $$;
