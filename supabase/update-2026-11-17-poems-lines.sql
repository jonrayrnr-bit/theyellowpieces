-- New kinds: 'poem' (poems and songs) and 'line' (one-liners and quips).
alter table public.pieces drop constraint if exists pieces_kind_check;
alter table public.pieces add constraint pieces_kind_check
  check (kind in ('quote', 'piece', 'poem', 'line', 'story', 'humor', 'sketch', 'photo'));
