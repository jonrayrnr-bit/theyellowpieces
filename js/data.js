// Data layer. Talks to Supabase when it's set up; otherwise runs a demo
// mode with sample pieces kept in memory (handy for previews).
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_LIB } from './config.js';
import { demoSeed } from './demo.js';

let sb = null;
let mode = 'demo';
const listeners = new Set();

export async function init() {
  const forceDemo = new URLSearchParams(location.search).has('demo');
  if (!forceDemo && SUPABASE_URL && SUPABASE_KEY) {
    try {
      const { createClient } = await import(SUPABASE_LIB);
      sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
      });
      mode = 'live';
      sb.auth.onAuthStateChange(() => listeners.forEach((fn) => fn()));
    } catch (e) {
      console.warn('Supabase unavailable, running demo mode', e);
    }
  }
  if (mode === 'demo') demo.load();
  return mode;
}
export const getMode = () => mode;
export const onAuth = (fn) => listeners.add(fn);

const PIECE_SELECT =
  'id,kind,title,body,said_by,source_slug,writeup,started_at,aiming_for,color,backdrop,visibility,status,stuck_count,created_at,author_id,' +
  'photo_path,photo_has_text,photo_alt,featured,featured_at,comment_count,' +
  'author:profiles!pieces_author_id_fkey(username),source:sources!pieces_source_slug_fkey(name,slug)';

function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
const fire = () => listeners.forEach((fn) => fn());

// ---------- Auth (same sign-in-by-emailed-code as YellowChecklist) ----------
export async function currentUser() {
  if (mode === 'demo') return demo.user;
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}
export async function signInEmail(email) {
  if (mode === 'demo') { demo.signIn(email); fire(); return; }
  check(await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin + '/' } }));
}
// The emailed code works in any browser or in the installed phone app,
// unlike the link, which only works in the browser that asked for it.
export async function verifyCode(email, token) {
  if (mode === 'demo') return;
  check(await sb.auth.verifyOtp({ email, token, type: 'email' }));
  fire();
}
export function authErrorFromUrl() {
  const q = new URLSearchParams(location.search);
  const h = new URLSearchParams(location.hash.replace(/^#/, ''));
  return q.get('error_description') || h.get('error_description') || null;
}
export async function signOut() {
  if (mode === 'demo') { demo.user = null; fire(); return; }
  await sb.auth.signOut();
}
export async function myProfile() {
  const u = await currentUser();
  if (!u) return null;
  if (mode === 'demo') return demo.profiles.find((p) => p.id === u.id) || null;
  return check(await sb.from('profiles').select('*').eq('id', u.id).maybeSingle());
}
export async function createProfile(username) {
  const u = await currentUser();
  if (mode === 'demo') {
    if (demo.profiles.some((p) => p.username === username)) throw new Error('That username is taken.');
    demo.profiles.push({ id: u.id, username, bio: '' });
    return;
  }
  const res = await sb.from('profiles').insert({ id: u.id, username });
  if (res.error && res.error.code === '23505') throw new Error('That username is taken.');
  check(res);
}
export async function updateBio(bio) {
  const u = await currentUser();
  if (mode === 'demo') { demo.profiles.find((p) => p.id === u.id).bio = bio; return; }
  check(await sb.from('profiles').update({ bio }).eq('id', u.id));
}
export async function profileByUsername(username) {
  if (mode === 'demo') return demo.profiles.find((p) => p.username === username) || null;
  return check(await sb.from('profiles').select('*').eq('username', username).maybeSingle());
}

// ---------- Colors & sources ----------
let colorCache = null;
export async function colors() {
  if (!colorCache) colorCache = mode === 'demo' ? demo.colors : check(await sb.from('colors').select('*').order('sort'));
  return colorCache;
}
let sourceCache = null;
export async function sources() {
  if (!sourceCache) sourceCache = mode === 'demo' ? demo.sources : check(await sb.from('sources').select('*').order('sort'));
  return sourceCache;
}

// ---------- Pieces ----------
// Trending weighs conversation (replies) a little more than "stuck with me".
function hotScore(p) {
  const hours = (Date.now() - new Date(p.created_at).getTime()) / 3600000;
  return (p.stuck_count + 2 * (p.comment_count || 0) + 1) / Math.pow(hours + 2, 1.2);
}
// color: pieces the author marked with that color OR that readers highlighted with it.
export async function feed({ kind, color, authorId, sort = 'new', q, limit = 30, includePrivate = false } = {}) {
  let rows;
  if (mode === 'demo') {
    rows = demo.pieces.filter((p) => p.status !== 'draft' && (includePrivate || (p.visibility || 'public') === 'public'));
    if (kind) rows = rows.filter((p) => p.kind === kind);
    if (authorId) rows = rows.filter((p) => p.author_id === authorId);
    if (color) {
      const hl = new Set(demo.highlights.filter((h) => h.color === color).map((h) => h.piece_id));
      rows = rows.filter((p) => p.color === color || hl.has(p.id));
    }
    if (q) { const s = q.toLowerCase(); rows = rows.filter((p) => (p.title + ' ' + p.body + ' ' + p.said_by).toLowerCase().includes(s)); }
    rows = rows.map(demo.hydrate);
  } else {
    let query = sb.from('pieces').select(PIECE_SELECT).eq('status', 'published');
    if (!includePrivate) query = query.eq('visibility', 'public');
    if (kind) query = query.eq('kind', kind);
    if (authorId) query = query.eq('author_id', authorId);
    if (color) {
      const hl = check(await sb.from('highlights').select('piece_id').eq('color', color).limit(500));
      const ids = [...new Set(hl.map((h) => h.piece_id))];
      query = ids.length ? query.or(`color.eq.${color},id.in.(${ids.join(',')})`) : query.eq('color', color);
    }
    if (q) {
      const s = q.replace(/[%_,()]/g, '');
      query = query.or(`title.ilike.%${s}%,body.ilike.%${s}%,said_by.ilike.%${s}%`);
    }
    query = sort === 'top' ? query.order('stuck_count', { ascending: false }) : query.order('created_at', { ascending: false });
    rows = check(await query.limit(sort === 'hot' ? 200 : limit));
  }
  if (sort === 'hot') rows.sort((a, b) => hotScore(b) - hotScore(a));
  else if (sort === 'top') rows.sort((a, b) => b.stuck_count - a.stuck_count);
  else rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows.slice(0, limit);
}
export async function drafts() {
  const u = await currentUser();
  if (!u) return [];
  if (mode === 'demo') return demo.pieces.filter((p) => p.author_id === u.id && p.status === 'draft').map(demo.hydrate);
  return check(await sb.from('pieces').select(PIECE_SELECT).eq('author_id', u.id).eq('status', 'draft').order('created_at', { ascending: false }));
}
export async function getPiece(id) {
  if (mode === 'demo') {
    const p = demo.pieces.find((x) => x.id === id);
    return p ? demo.hydrate(p) : null;
  }
  return check(await sb.from('pieces').select(PIECE_SELECT).eq('id', id).maybeSingle());
}
export async function createPiece(piece) {
  const u = await currentUser();
  if (mode === 'demo') {
    const id = 'demo-' + Math.random().toString(36).slice(2, 10);
    demo.pieces.unshift({ said_by: '', writeup: '', started_at: '', aiming_for: '', title: '', ...piece,
      id, author_id: u.id, stuck_count: 0, created_at: new Date().toISOString() });
    return id;
  }
  return check(await sb.from('pieces').insert({ ...piece, author_id: u.id }).select('id').single()).id;
}
export async function publishDraft(id) {
  if (mode === 'demo') { demo.pieces.find((p) => p.id === id).status = 'published'; return; }
  check(await sb.from('pieces').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', id));
}
export async function deletePiece(id) {
  if (mode === 'demo') { demo.pieces = demo.pieces.filter((p) => p.id !== id); return; }
  check(await sb.from('pieces').delete().eq('id', id));
}

// ---------- "This stuck with me" ----------
export async function myStuck(ids) {
  const u = await currentUser();
  if (!u || !ids.length) return new Set();
  if (mode === 'demo') return new Set(demo.stuck.filter((s) => s.user_id === u.id).map((s) => s.piece_id));
  const rows = check(await sb.from('stuck').select('piece_id').eq('user_id', u.id).in('piece_id', ids));
  return new Set(rows.map((r) => r.piece_id));
}
export async function setStuck(id, on) {
  const u = await currentUser();
  if (mode === 'demo') {
    const p = demo.pieces.find((x) => x.id === id);
    if (on) { demo.stuck.push({ user_id: u.id, piece_id: id }); p.stuck_count++; }
    else { demo.stuck = demo.stuck.filter((s) => !(s.user_id === u.id && s.piece_id === id)); p.stuck_count--; }
    return;
  }
  if (on) check(await sb.from('stuck').insert({ piece_id: id, user_id: u.id }));
  else check(await sb.from('stuck').delete().eq('piece_id', id).eq('user_id', u.id));
}

// ---------- Readers' highlights ----------
// Returns { counts: {color: n}, mine: Set(color) } for one piece.
export async function highlightsFor(pieceId) {
  const u = await currentUser();
  const rows = mode === 'demo'
    ? demo.highlights.filter((h) => h.piece_id === pieceId)
    : check(await sb.from('highlights').select('color,user_id').eq('piece_id', pieceId));
  const counts = {};
  rows.forEach((r) => { counts[r.color] = (counts[r.color] || 0) + 1; });
  const mine = new Set(u ? rows.filter((r) => r.user_id === u.id).map((r) => r.color) : []);
  return { counts, mine };
}
export async function setHighlight(pieceId, color, on) {
  const u = await currentUser();
  if (mode === 'demo') {
    if (on) demo.highlights.push({ user_id: u.id, piece_id: pieceId, color });
    else demo.highlights = demo.highlights.filter((h) => !(h.user_id === u.id && h.piece_id === pieceId && h.color === color));
    return;
  }
  if (on) check(await sb.from('highlights').insert({ piece_id: pieceId, color, user_id: u.id }));
  else check(await sb.from('highlights').delete().eq('piece_id', pieceId).eq('color', color).eq('user_id', u.id));
}

// ---------- Comments & reports ----------
export async function comments(pieceId) {
  if (mode === 'demo') return demo.comments.filter((c) => c.piece_id === pieceId).map(demo.hydrateComment);
  return check(await sb.from('comments').select('id,body,created_at,author_id,author:profiles!comments_author_id_fkey(username)').eq('piece_id', pieceId).order('created_at'));
}
export async function addComment(pieceId, body) {
  const u = await currentUser();
  if (mode === 'demo') { demo.comments.push({ id: Date.now(), piece_id: pieceId, author_id: u.id, body, created_at: new Date().toISOString() }); return; }
  check(await sb.from('comments').insert({ piece_id: pieceId, body, author_id: u.id }));
}
export async function deleteComment(id) {
  if (mode === 'demo') { demo.comments = demo.comments.filter((c) => c.id !== id); return; }
  check(await sb.from('comments').delete().eq('id', id));
}
export async function report({ pieceId = null, commentId = null, reason = '' }) {
  const u = await currentUser();
  if (mode === 'demo') return;
  check(await sb.from('reports').insert({ piece_id: pieceId, comment_id: commentId, reason, reporter_id: u.id }));
}

// ---------- Photos ----------
// Photos live in the Supabase "photos" bucket (public to view, admins upload).
export function photoUrl(path) {
  if (!path) return '';
  if (/^(blob:|data:|https?:)/.test(path)) return path;
  if (mode === 'demo') return 'demo/photos/' + path;
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${path.split('/').map(encodeURIComponent).join('/')}`;
}

// Shrinks a photo to web size (1600px on the long side, WebP) before it's stored.
// The full-size original stays on your computer.
export async function resizePhoto(file, maxEdge = 1600) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.82));
  return blob || new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
}
export async function uploadPhoto(file) {
  const blob = await resizePhoto(file);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const d = new Date();
  const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  if (mode === 'demo') return URL.createObjectURL(blob);
  check(await sb.storage.from('photos').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }));
  return path;
}

// ---------- Admin ----------
export async function isAdmin() {
  const u = await currentUser();
  if (!u) return false;
  if (mode === 'demo') return true; // so the preview can show the admin page
  const rows = check(await sb.from('admins').select('user_id').eq('user_id', u.id));
  return rows.length > 0;
}
// fields: { photo_path, photo_has_text, photo_alt, featured } (leave any out to keep it as is)
export async function setPieceMedia(id, fields) {
  if (mode === 'demo') {
    const p = demo.pieces.find((x) => x.id === id);
    if (fields.featured === true && !p.featured) p.featured_at = new Date().toISOString();
    Object.entries(fields).forEach(([k, v]) => { if (v !== undefined && v !== null) p[k] = v; });
    return;
  }
  check(await sb.rpc('admin_set_piece_media', {
    p_id: id, p_photo_path: fields.photo_path ?? null, p_photo_has_text: fields.photo_has_text ?? null,
    p_photo_alt: fields.photo_alt ?? null, p_featured: fields.featured ?? null,
  }));
}

// ---------- Featured ----------
export async function featured(limit = 3) {
  let rows;
  if (mode === 'demo') rows = demo.pieces.filter((p) => p.featured && p.status !== 'draft').map(demo.hydrate);
  else rows = check(await sb.from('pieces').select(PIECE_SELECT).eq('featured', true).eq('status', 'published').order('featured_at', { ascending: false }).limit(limit));
  rows.sort((a, b) => new Date(b.featured_at || 0) - new Date(a.featured_at || 0));
  return rows.slice(0, limit);
}

// ---------- Pick-one pairs ----------
const VOTE_KEY = 'yp-voter';
const VOTES_KEY = 'yp-votes';
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } return null; }
function voterKey() {
  let k = store(VOTE_KEY);
  if (!k) { k = crypto.randomUUID().replace(/-/g, ''); store(VOTE_KEY, k); }
  return k;
}
export function myVotes() { try { return JSON.parse(store(VOTES_KEY) || '{}'); } catch { return {}; } }

async function piecesByIds(ids) {
  if (!ids.length) return [];
  if (mode === 'demo') return demo.pieces.filter((p) => ids.includes(p.id)).map(demo.hydrate);
  return check(await sb.from('pieces').select(PIECE_SELECT).in('id', ids));
}
export async function pairs({ includeInactive = false } = {}) {
  let rows;
  if (mode === 'demo') rows = demo.pairs.filter((x) => includeInactive || x.active);
  else {
    let q = sb.from('pairs').select('id,a_piece,b_piece,active,created_at').order('created_at', { ascending: false });
    if (!includeInactive) q = q.eq('active', true);
    rows = check(await q);
  }
  const ps = await piecesByIds([...new Set(rows.flatMap((r) => [r.a_piece, r.b_piece]))]);
  const byId = Object.fromEntries(ps.map((p) => [p.id, p]));
  return rows.filter((r) => byId[r.a_piece] && byId[r.b_piece]).map((r) => ({ ...r, a: byId[r.a_piece], b: byId[r.b_piece] }));
}
export async function vote(pairId, choice) {
  const votes = myVotes();
  if (!votes[pairId]) {
    if (mode === 'demo') demo.votes.push({ pair_id: pairId, choice });
    else {
      const res = await sb.from('pair_votes').insert({ pair_id: pairId, voter_key: voterKey(), choice });
      if (res.error && res.error.code !== '23505') throw new Error(res.error.message);
    }
    votes[pairId] = choice;
    store(VOTES_KEY, JSON.stringify(votes));
  }
  return pairResults(pairId);
}
export async function pairResults(pairId) {
  if (mode === 'demo') {
    const v = demo.votes.filter((x) => x.pair_id === pairId);
    return { a: v.filter((x) => x.choice === 'a').length, b: v.filter((x) => x.choice === 'b').length };
  }
  const rows = check(await sb.rpc('pair_results', { p_pair: pairId }));
  const r = rows[0] || { a_votes: 0, b_votes: 0 };
  return { a: Number(r.a_votes), b: Number(r.b_votes) };
}
export async function addPair(aId, bId) {
  if (mode === 'demo') { demo.pairs.unshift({ id: Date.now(), a_piece: aId, b_piece: bId, active: true, created_at: new Date().toISOString() }); return; }
  check(await sb.from('pairs').insert({ a_piece: aId, b_piece: bId }));
}
export async function setPairActive(id, active) {
  if (mode === 'demo') { demo.pairs.find((x) => x.id === id).active = active; return; }
  check(await sb.from('pairs').update({ active }).eq('id', id));
}
export async function removePair(id) {
  if (mode === 'demo') { demo.pairs = demo.pairs.filter((x) => x.id !== id); return; }
  check(await sb.from('pairs').delete().eq('id', id));
}

// ---------- Demo store ----------
const demo = {
  user: null, profiles: [], colors: [], sources: [], pieces: [], stuck: [], highlights: [], comments: [], pairs: [], votes: [],
  load() { Object.assign(this, structuredClone(demoSeed)); this.pieces.forEach((p) => { p.status ||= 'published'; p.visibility ||= 'public'; p.started_at ||= ''; p.aiming_for ||= ''; }); },
  signIn(email) { this.user = { id: 'demo-user-' + email.toLowerCase(), email }; },
  hydrate(p) {
    const src = demo.sources.find((s) => s.slug === p.source_slug);
    return {
      photo_path: '', photo_has_text: false, photo_alt: '', featured: false,
      ...p,
      comment_count: demo.comments.filter((c) => c.piece_id === p.id).length,
      author: { username: (demo.profiles.find((x) => x.id === p.author_id) || {}).username || 'someone' },
      source: src ? { name: src.name, slug: src.slug } : null,
    };
  },
  hydrateComment(c) {
    return { ...c, author: { username: (demo.profiles.find((p) => p.id === c.author_id) || {}).username || 'someone' } };
  },
};
