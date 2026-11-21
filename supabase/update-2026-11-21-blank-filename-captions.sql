-- 1) Let pictures and quote cards have an empty caption (so a card can wait for its real words).
alter table public.pieces drop constraint if exists pieces_body_check;
alter table public.pieces add constraint pieces_body_check
  check (char_length(body) <= 20000 and (char_length(body) >= 1 or kind in ('quote', 'photo')));

-- 2) PREVIEW: every picture/quote whose title, words or alt text looks like a file name (033, 0xx, IMG_0345, DSC 12, something.jpg ...). Nothing changes yet.
with fn as (
  select id, kind, title, body, photo_alt,
    (title     ~* '^\s*((img|dscn?|dscf|pxl|mvimg|screenshot|scan|image|photo|pic|card|file)?[ _-]*[0-9x][0-9x _.()-]*|[^\n]*\.(jpe?g|png|gif|webp|heic))\s*$') as t_bad,
    (body      ~* '^\s*((img|dscn?|dscf|pxl|mvimg|screenshot|scan|image|photo|pic|card|file)?[ _-]*[0-9x][0-9x _.()-]*|[^\n]*\.(jpe?g|png|gif|webp|heic))\s*$') as b_bad,
    (photo_alt ~* '^\s*((img|dscn?|dscf|pxl|mvimg|screenshot|scan|image|photo|pic|card|file)?[ _-]*[0-9x][0-9x _.()-]*|[^\n]*\.(jpe?g|png|gif|webp|heic))\s*$') as a_bad
  from public.pieces
  where photo_path <> '' or kind in ('quote', 'photo')
)
select id, kind, title, body, photo_alt from fn where (t_bad and title <> '') or (b_bad and body <> '') or (a_bad and photo_alt <> '') order by kind, title, body;

-- 3) CLEAN UP: blank only the fields that look like file names (real captions are left alone).
update public.pieces set
  title     = case when title     ~* '^\s*((img|dscn?|dscf|pxl|mvimg|screenshot|scan|image|photo|pic|card|file)?[ _-]*[0-9x][0-9x _.()-]*|[^\n]*\.(jpe?g|png|gif|webp|heic))\s*$' then '' else title end,
  body      = case when body      ~* '^\s*((img|dscn?|dscf|pxl|mvimg|screenshot|scan|image|photo|pic|card|file)?[ _-]*[0-9x][0-9x _.()-]*|[^\n]*\.(jpe?g|png|gif|webp|heic))\s*$' then '' else body end,
  photo_alt = case when photo_alt ~* '^\s*((img|dscn?|dscf|pxl|mvimg|screenshot|scan|image|photo|pic|card|file)?[ _-]*[0-9x][0-9x _.()-]*|[^\n]*\.(jpe?g|png|gif|webp|heic))\s*$' then '' else photo_alt end
where photo_path <> '' or kind in ('quote', 'photo');
