import * as db from './data.js';
import { BACKDROPS, quoteCardHtml, quoteCardPng } from './card.js';
import { ABOUT, CONTACT_EMAIL, ANALYTICS_TOKEN } from './config.js';

const main = document.getElementById('main');
const accountEl = document.getElementById('account');
const banner = document.getElementById('banner');

// ---------- sections ----------
const KINDS = {
  quote:  { slug: 'quotes',   name: 'Quotes',     blurb: 'Lines from real life, and the story of why they stuck.', cta: 'Share a quote' },
  piece:  { slug: 'pieces',   name: 'Pieces',     blurb: 'Original prose and reflections.', cta: 'Post a piece' },
  poem:   { slug: 'poems',    name: 'Poems',      blurb: 'Poems and song lyrics.', cta: 'Post a poem' },
  line:   { slug: 'lines',    name: 'Lines',      blurb: 'One-liners, quips and lines worth keeping.', cta: 'Share a line' },
  story:  { slug: 'stories',  name: 'Stories',    blurb: 'Words that changed something — short or long.', cta: 'Tell a story' },
  humor:  { slug: 'humor',    name: 'Humor',      blurb: 'The quips, one-liners and family stories that still make you laugh.', cta: 'Share something funny' },
  sketch: { slug: 'sketches', name: 'Sketches & Scratches',  blurb: 'The Works In Progress section for pieces under construction. Discussions and feedback are encouraged (Hard hat recommended, but not required.)', cta: 'Share a sketch' },
  photo:  { slug: 'pictures', name: 'Pictures',   blurb: 'Favorite photos from the places in between.', cta: 'Add a picture' },
};
// Sections kept out of sight until there is something in them (their pieces still work if someone has the link).
const HIDDEN = new Set(['story', 'humor']);
const UNDER_CONSTRUCTION = new Set(['sketch']);
const kindBySlug = (slug) => Object.keys(KINDS).find((k) => KINDS[k].slug === slug);

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};
const params = () => new URLSearchParams(location.hash.split('#')[1]?.split('?')[1] || '');
const go = (hash) => { location.hash = hash; };
const plain = (s) => String(s ?? '').replace(/==([^=]+?)==/g, '$1').replace(/<\/?(b|strong|i|em)>/gi, '').replace(/\*\*([^*]+?)\*\*/g, '$1').replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1$2');
const excerpt = (s, n) => { s = plain(s); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; };
// Highlighted word in a title: ==word== shows with a yellow marker swipe.
const ttl = (s) => esc(s).replace(/==([^=]+?)==/g, '<mark class="hlw">$1</mark>');
const hasHl = (s) => /==[^=]+?==/.test(s || '');
// Wrap the selected text in a text box with a marker (or remove it if already wrapped).
function wrapSel(t, m) {
  if (!t) return;
  const { selectionStart: a, selectionEnd: z, value: v } = t, n = m.length;
  if (a === z && m === '==') { toast('Select the word to highlight first'); return; }
  if (v.slice(a - n, a) === m && v.slice(z, z + n) === m) { t.value = v.slice(0, a - n) + v.slice(a, z) + v.slice(z + n); t.setSelectionRange(a - n, z - n); }
  else { t.value = v.slice(0, a) + m + v.slice(a, z) + m + v.slice(z); t.setSelectionRange(a + n, z + n); }
  t.focus();
}
// Bold and italic: **bold**, *italic* (also <b>/<i> from pasted or exported text). Everything else stays escaped plain text.
const rich = (s) => esc(s)
  .replace(/&lt;(b|strong)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, '<strong>$2</strong>')
  .replace(/&lt;(i|em)&gt;([\s\S]*?)&lt;\/\1&gt;/gi, '<em>$2</em>')
  .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
const errorBox = (e) => `<p class="error" role="alert">${esc(e.message || e)}</p>`;
async function needProfile() {
  const p = await db.myProfile();
  if (!p) { go((await db.currentUser()) ? '#/welcome' : '#/signin'); return null; }
  return p;
}
const byline = (p) => `<p class="meta">shared by <a href="#/u/${esc(p.author?.username)}">@${esc(p.author?.username)}</a>
  · <a href="#/${KINDS[p.kind].slug}">${esc(KINDS[p.kind].name)}</a> · ${ago(p.created_at)}</p>`;

// ---------- piece images (SVGs made in the Writing Desk) ----------
const svgUri = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
// Cleans an SVG before it is stored: only plain shapes survive (no scripts, links or embedded pages).
// Images are always shown through <img>/CSS, where scripts can't run, so this is a second lock.
function cleanSvg(raw) {
  raw = String(raw || '').trim();
  if (!raw) return '';
  if (raw.length > 400000) return '';
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return '';
  doc.querySelectorAll('script,foreignObject,iframe,object,embed,audio,video,a,animate,set,animateTransform,animateMotion,image,use').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((at) => {
    const nm = at.name.toLowerCase(), v = at.value.trim().toLowerCase();
    if (nm.startsWith('on') || nm === 'href' || nm === 'xlink:href' || /javascript:|data:text\/html|url\(\s*['"]?\s*(https?:|\/\/|data:)/.test(v)) n.removeAttribute(at.name);
  }));
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', '0 0 400 400');
  root.removeAttribute('width'); root.removeAttribute('height');
  const out = new XMLSerializer().serializeToString(root);
  return out.length > 80000 ? '' : out;
}
const artImg = (p, cls = 'art') => `<img class="${cls}" src="${esc(svgUri(p.image_svg))}" alt="" loading="lazy">`;
// The faded picture behind a piece while it's read.
function clearPieceBg() { document.getElementById('piece-bg')?.remove(); }
function setPieceBg(svg) {
  clearPieceBg();
  const d = document.createElement('div');
  d.id = 'piece-bg'; d.className = 'piece-bg'; d.setAttribute('aria-hidden', 'true');
  d.style.backgroundImage = `url("${svgUri(svg)}")`;
  document.body.appendChild(d);
}

// ---------- media ----------
// Pictures with words already in them are shown whole (never cropped), over a soft blur of themselves.
// Everything else fills its frame, with the muted "Lemon Dusk" tone that blooms to full color on hover.
function photoHtml(p, { tone = true } = {}) {
  const src = esc(db.photoUrl(p.photo_path));
  const alt = esc(p.photo_alt || (p.photo_has_text ? p.body : ''));
  if (p.photo_has_text) return `<figure class="media fit"><img class="blur" src="${src}" alt="" loading="lazy"><img class="main" src="${src}" alt="${alt}" loading="lazy"></figure>`;
  return `<figure class="media ${tone ? 'tone' : ''}"><img src="${src}" alt="${alt}" loading="lazy"></figure>`;
}
// The visual for a piece inside a fixed frame (pair option, featured tile, card top).
function visualHtml(p, opts = {}) {
  if (p.kind === 'quote' && !p.photo_has_text) return quoteCardHtml(p, { photo: db.photoUrl(p.photo_path) });
  if (p.photo_path) return photoHtml(p, opts);
  if (p.image_svg) return `<div class="artvis">${artImg(p)}</div>`;
  return '';
}
const NEEDS_WORDS = 'Untitled picture (needs words)';
const label = (p) => plain(p.title) || excerpt(p.body, 60) || (p.photo_path ? NEEDS_WORDS : '');
const labelHtml = (p) => (p.title ? ttl(p.title) : esc(excerpt(p.body, 60) || (p.photo_path ? NEEDS_WORDS : '')));

// ---------- emoji reactions ----------
const REACTIONS = [
  { key: 'smile', emoji: '😊', label: 'Smile' }, { key: 'laugh', emoji: '😂', label: 'Laughing' },
  { key: 'cry', emoji: '😢', label: 'Sad' }, { key: 'love', emoji: '🥰', label: 'Love' },
  { key: 'mindblown', emoji: '🤯', label: 'Mind blown' }, { key: 'uneasy', emoji: '😬', label: 'Uneasy' },
];
let rxState = { ok: false, counts: {}, mine: {} };
async function loadReactions(ids) {
  const r = await db.reactionsFor(ids);
  rxState = { ok: r.ok, counts: { ...rxState.counts, ...r.counts }, mine: { ...rxState.mine, ...r.mine } };
  ids.forEach((id) => { if (!r.counts[id]) delete rxState.counts[id]; if (!r.mine[id]) delete rxState.mine[id]; });
}
function rxHtml(id, open = false) {
  if (!rxState.ok) return '';
  const counts = rxState.counts[id] || {}, mine = rxState.mine[id];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const face = REACTIONS.find((x) => x.key === mine);
  return `<span class="rx" data-rx-wrap="${esc(id)}">
    <button class="rx-btn ${mine ? 'on' : ''}" type="button" data-rx-open="${esc(id)}" aria-haspopup="true" aria-expanded="${open}" aria-label="${face ? `You reacted: ${face.label}. Change reaction` : 'React with an emoji'}">
      <span aria-hidden="true">${face ? face.emoji : '☺'}</span>${total ? `<b>${total}</b>` : ''}</button>
    <span class="rx-pop" role="group" aria-label="Choose a reaction" ${open ? '' : 'hidden'}>${REACTIONS.map((x) => `<button type="button" class="${mine === x.key ? 'on' : ''}" data-rx="${esc(id)}" data-rx-key="${x.key}" aria-pressed="${mine === x.key}" aria-label="${x.label}" title="${x.label}"><span aria-hidden="true">${x.emoji}</span>${counts[x.key] ? `<b>${counts[x.key]}</b>` : ''}</button>`).join('')}</span></span>`;
}

// ---------- shared pieces ----------
function stuckBtn(p, on) {
  return `<button class="stuck ${on ? 'on' : ''}" data-stuck="${esc(p.id)}" aria-pressed="${on}" aria-label="This stuck with me" title="This stuck with me">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg><span>${p.stuck_count}</span></button>`;
}
function card(p, stuck) {
  const bare = p.kind === 'photo';
  const k = KINDS[p.kind];
  let inner;
  if (p.kind === 'quote') {
    inner = `<a class="qlink" href="#/p/${esc(p.id)}" aria-label="Open quote">${p.photo_has_text ? `<div class="media-box">${photoHtml(p)}</div>` : quoteCardHtml(p, { photo: db.photoUrl(p.photo_path) })}</a>
      ${p.writeup ? `<p class="writeup-ex">${esc(excerpt(p.writeup, 140))}</p>` : ''}`;
  } else {
    inner = p.image_svg && !p.photo_path
      ? `<a class="arttile" href="#/p/${esc(p.id)}" aria-label="${esc(label(p))}">${artImg(p)}<span class="arttitle">${labelHtml(p)}</span></a>
      <p class="body-ex">${esc(excerpt(p.body, 220))}</p>`
      : `${p.photo_path ? `<a href="#/p/${esc(p.id)}" tabindex="-1" aria-hidden="true"><div class="media-box ${p.kind === 'photo' ? '' : 'wide'}">${photoHtml(p)}</div></a>` : ''}
      ${bare && p.kind === 'photo' ? '' : `<h3><a href="#/p/${esc(p.id)}">${labelHtml(p)}</a></h3>`}
      ${p.kind === 'photo' ? (bare ? '' : p.body ? `<p class="writeup-ex">${esc(excerpt(p.body, 140))}</p>` : '') : `<p class="body-ex">${esc(excerpt(p.body, 220))}</p>`}`;
  }
  return `<article class="card sheet-${esc(p.kind)} ${p.image_svg && !p.photo_path && p.kind !== 'quote' ? 'has-art' : ''}">
    ${inner}
    <footer>${stuckBtn(p, stuck.has(p.id))}${rxHtml(p.id)}
      <a class="replies" href="#/p/${esc(p.id)}#responses">${p.comment_count || 0} ${p.comment_count === 1 ? 'reply' : 'replies'}</a>
      <span class="meta">@${esc(p.author?.username)} · ${esc(k.name)}</span>
      <span class="dot dot-${esc(p.color)}" title="${esc(p.color)} highlight"></span></footer>
  </article>`;
}
async function cards(list, empty = 'Nothing here yet. Be the first.', bare = false) {
  if (!list.length) return `<p class="empty">${esc(empty)}</p>`;
  const ids = list.map((p) => p.id);
  const [st] = await Promise.all([db.myStuck(ids), loadReactions(ids)]);
  return `<div class="grid">${list.map((p) => card(p, st, bare)).join('')}</div>`;
}
async function colorStrip(active) {
  const cs = await db.colors();
  return `<nav class="colors" aria-label="Filter by highlighter color">
    <span class="colors-label">Find by feeling:</span>
    ${cs.map((c) => `<a href="#/color/${esc(c.slug)}" class="chip" style="--c:${esc(c.hex)}" ${active === c.slug ? 'aria-current="page"' : ''} title="${esc(c.meaning)}">${esc(c.name)}</a>`).join('')}
  </nav>`;
}

// ---------- views ----------
let pickTimer = null;
function stopPickTimer() { if (pickTimer) { clearInterval(pickTimer); pickTimer = null; } }

async function viewHome() {
  const [pairList, feat, hot, latest] = await Promise.all([
    db.pairs(), db.featured(3), db.feed({ sort: 'hot', limit: 40 }), db.feed({ sort: 'new', limit: 80 }),
  ]);
  const of = (kind, n) => latest.filter((p) => p.kind === kind).slice(0, n);
  const featIds = new Set(feat.map((p) => p.id));
  const trending = hot.filter((p) => !featIds.has(p.id)).slice(0, 4);
  const row = async (kind, title) => {
    const list = of(kind, 3);
    if (!list.length && (kind === 'photo')) return '';
    const k = KINDS[kind];
    return `<section aria-labelledby="sec-${kind}"><div class="sec-head"><div><p class="kicker">${esc(k.name)}</p><h2 class="section-title" id="sec-${kind}">${title}</h2></div>
      <a class="sec-all" href="#/${k.slug}">All ${esc(k.name.toLowerCase())} →</a></div>
      ${await cards(list, kind === 'photo' ? '' : 'Nothing here yet. Be the first.', kind === 'photo')}</section>`;
  };
  const tile = (p, big) => {
    const vis = visualHtml(p);
    const kicker = { quote: 'Quote', piece: 'Piece', poem: 'Poem', line: 'Line', story: 'Story', humor: 'Humor', sketch: 'Sketch', photo: 'Picture' }[p.kind];
    if (!vis) return `<a class="tile text ${big ? 'big' : ''}" href="#/p/${esc(p.id)}"><p class="kicker">${kicker}</p>
      <p class="lineq">${esc(excerpt(p.body, big ? 260 : 120))}</p><b>${ttl(p.title || '')}</b>
      <span class="acts"><span>${p.stuck_count} stuck with it</span><span>${p.comment_count || 0} replies</span></span></a>`;
    const showPanel = !(p.kind === 'quote');
    return `<a class="tile ${big ? 'big' : ''}" href="#/p/${esc(p.id)}" aria-label="${esc(label(p))}">${vis}
      ${showPanel ? `<span class="panel"><span class="kicker">${kicker}</span><b>${labelHtml(p)}</b>${p.title && p.kind !== 'photo' ? `<q>${esc(excerpt(p.body, big ? 140 : 80))}</q>` : ''}
        <span class="acts"><span>${p.stuck_count} stuck with it</span><span>${p.comment_count || 0} replies</span></span></span>` : ''}</a>`;
  };

  main.innerHTML = `<div class="home">
    <section class="intro"><p class="intro-line"><b>Highlight the best words in your life.</b> Great lines, words of wisdom, and the stories behind them: the pieces worth passing down.</p></section>

    ${feat.length ? `<section aria-labelledby="feat-h"><div class="sec-head"><div><p class="kicker">Featured</p><h2 class="section-title" id="feat-h">Yellow pieces to start with</h2></div>
      <p class="sec-blurb">Lines and stories from life. Read one, then take a side.</p></div>
      <div class="featured">${tile(feat[0], true)}${feat.length > 1 ? `<div class="featured-side">${feat.slice(1).map((p) => tile(p, false)).join('')}</div>` : ''}</div>
    </section>` : ''}

    ${pairList.length ? `<section class="pick" aria-labelledby="pick-h">
      <div class="pick-head"><h1 id="pick-h">Which one speaks to you?</h1>
        <p class="lede">Two yellow pieces, side by side. Pick one, then say why. What comes to mind?</p></div>
      <div id="pick"></div>
    </section>` : ''}

    ${trending.length ? `<section aria-labelledby="trend-h"><div class="sec-head"><div><p class="kicker">Trending</p><h2 class="section-title" id="trend-h">Join the conversation</h2></div>
      <p class="sec-blurb">See what's being said: the pieces drawing the most replies this week.</p></div>
      <ol class="trend">${trending.map((p, i) => `<li><a href="#/p/${esc(p.id)}">
        ${visualHtml(p) ? `<span class="trend-vis">${visualHtml(p)}</span>` : ''}
        <span class="top"><span>${esc(KINDS[p.kind].name)}</span><span>#${i + 1}</span></span>
        <span class="line">${p.kind === 'photo' ? '' : p.kind === 'quote' ? (visualHtml(p) ? '' : `“${esc(excerpt(p.body, 140))}”`) : (p.title ? ttl(p.title) + ' — ' + esc(excerpt(p.body, 90)) : esc(excerpt(p.body, 140)))}</span>
        <span class="by">@${esc(p.author?.username)}</span>
        <span class="counts"><span>${p.stuck_count} stuck with it</span><span>${p.comment_count || 0} ${p.comment_count === 1 ? 'reply' : 'replies'}</span></span></a></li>`).join('')}</ol>
    </section>` : ''}

    <section class="from" aria-labelledby="from-h"><div class="from-card">
      <div class="from-photo">${ABOUT.photo ? `<img src="${esc(ABOUT.photo)}" alt="${esc(ABOUT.name)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'${esc(ABOUT.initials)}'}))">` : `<span class="ph">${esc(ABOUT.initials)}</span>`}</div>
      <div><p class="kicker">From ${esc(ABOUT.name)}</p><h2 class="section-title" id="from-h">${esc(ABOUT.headline)}</h2>
        ${ABOUT.bio.map((t) => `<p>${esc(t)}</p>`).join('')}
        <a class="sec-all" href="#/about">Why yellow? →</a></div></div></section>

    <section class="signup" aria-labelledby="signup-h"><div class="signup-card">
      <div><p class="kicker">Stay close</p><h2 class="section-title" id="signup-h">${esc(ABOUT.signupHeadline)}</h2><p>${esc(ABOUT.signupLine)}</p></div>
      <form id="subscribe" class="signup-form" novalidate><label class="sr" for="sub-email">Email</label>
        <input id="sub-email" type="email" autocomplete="email" required maxlength="200" placeholder="you@example.com">
        <button class="btn" type="submit">Send me yellow pieces</button><p class="hint" id="sub-msg" aria-live="polite"></p></form></div></section>

    <section><div class="band"><div><h2>Your turn. What's a line you still carry?</h2>
      <p>A family motto, something a grandparent said, words that came in handy at a surprising time. Share it, and tell us who said it and why it stuck.</p></div>
      <div class="band-actions"><a class="btn-dark" href="#/share/quote">Share a quote</a><a class="btn-ghost" href="#/share/piece">Share a piece</a></div></div></section>

    ${await row('quote', 'Lines worth passing down')}
    ${await row('piece', 'Prose and pieces')}
    ${await row('poem', 'Poems and songs')}
    ${await row('line', 'Lines and quips')}
    ${await row('photo', 'Pictures along the way')}

    <section><div class="learn-teaser"><div><p class="kicker">Coming soon</p><h2 class="section-title">Writer's Corner</h2>
      <p>Work on your writing with these free lessons. Pieces with worksheets, prompts and further reading, and the writer's own take, unlocked once enough readers weigh in.</p></div>
      <a class="btn-ghost" href="#/learn">Take a look →</a></div></section>
  </div>`;
  if (pairList.length) startPick(pairList);
  const sf = document.getElementById('subscribe');
  if (sf) sf.onsubmit = async (e) => {
    e.preventDefault();
    const em = document.getElementById('sub-email').value.trim(), msg = document.getElementById('sub-msg');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { msg.textContent = 'That email doesn\'t look quite right.'; return; }
    const b = sf.querySelector('button'); b.disabled = true;
    try { await db.subscribe(em); sf.innerHTML = '<p class="signup-thanks"><b>You\'re on the list.</b> Thanks for being here.</p>'; }
    catch (err) { msg.textContent = 'Couldn\'t sign you up just now. Please try again.'; b.disabled = false; }
  };
}

// ---------- pick one ----------
function startPick(all) {
  const voted = db.myVotes();
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const queue = [...shuffle(all.filter((x) => !voted[x.id])), ...shuffle(all.filter((x) => voted[x.id]))];
  let i = 0, paused = false, elapsed = 0, flip = Math.random() < 0.5; // flip: show the pair's sides swapped (votes still count for the right piece)
  const STEP = 100, LIMIT = 10000;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = document.getElementById('pick');

  const optHtml = (side, p, pos) => `<button type="button" class="pair-opt" data-side="${side}" aria-pressed="false"
      aria-label="Choose ${pos}: ${esc(p.photo_alt || label(p))}">${visualHtml(p, { tone: false }) || quoteCardHtml(p)}</button>`;

  async function show(pair, results) {
    stopPickTimer();
    const mine = db.myVotes()[pair.id];
    box.innerHTML = `
      <div class="pair ${mine ? 'voted' : ''}">${flip ? optHtml('b', pair.b, 'A') + optHtml('a', pair.a, 'B') : optHtml('a', pair.a, 'A') + optHtml('b', pair.b, 'B')}<div class="pair-or" aria-hidden="true">or</div></div>
      ${mine && results ? (() => {
        const total = results.a + results.b || 1;
        const pct = (n) => Math.round((n / total) * 100);
        const one = (side, n) => `<div class="pair-result"><span>${pct(n)}% chose this${mine === side ? ' (you too)' : ''}</span>
          <span class="bar"><i style="width:${pct(n)}%"></i></span><small>${n} ${n === 1 ? 'vote' : 'votes'}</small></div>`;
        return `<div class="pair-results">${flip ? one('b', results.b) + one('a', results.a) : one('a', results.a) + one('b', results.b)}</div>`;
      })() : ''}
      ${mine ? `<form class="take" id="take"><label>Why that one?
          <textarea id="take-body" rows="2" maxlength="3000" placeholder="It reminded me of… / I'd pick the other one because…"></textarea></label>
          <div class="pair-buttons"><button class="btn" type="submit">Post my take</button>
          <button class="btn-ghost" type="button" data-next>Next pair</button>
          <a href="#/p/${esc(mine === 'a' ? pair.a.id : pair.b.id)}#responses">What others said →</a></div></form>`
      : `<div class="pair-controls">${reduce ? '' : '<div class="timer" aria-hidden="true"><i></i></div>'}
          <p class="pair-hint">Tap the one that speaks to you.${reduce ? '' : ' A new pair comes up in 10 seconds.'}</p>
          <div class="pair-buttons">${reduce ? '' : `<button class="btn-ghost btn-small" type="button" data-pause aria-pressed="${paused}">${paused ? 'Resume' : 'Pause'}</button>`}
          ${all.length > 1 ? '<button class="btn-ghost btn-small" type="button" data-next>Next pair</button>' : ''}</div></div>`}`;

    box.querySelectorAll('.pair-opt').forEach((b) => {
      if (mine) b.setAttribute('aria-pressed', String(b.dataset.side === mine));
      b.onclick = async () => {
        if (db.myVotes()[pair.id]) { go('#/p/' + (b.dataset.side === 'a' ? pair.a.id : pair.b.id)); return; }
        try { const r = await db.vote(pair.id, b.dataset.side); await show(pair, r); document.getElementById('take-body')?.focus(); }
        catch (err) { toast(err.message); }
      };
    });
    box.querySelectorAll('[data-next]').forEach((b) => { b.onclick = () => next(); });
    const pb = box.querySelector('[data-pause]');
    if (pb) pb.onclick = () => { paused = !paused; pb.textContent = paused ? 'Resume' : 'Pause'; pb.setAttribute('aria-pressed', String(paused)); };
    const take = document.getElementById('take');
    if (take) take.onsubmit = async (e) => {
      e.preventDefault();
      const body = take.querySelector('textarea').value.trim();
      if (!body) return;
      if (!(await needProfile())) return;
      const pieceId = mine === 'a' ? pair.a.id : pair.b.id;
      try { await db.addComment(pieceId, body); toast('Posted. Thanks for weighing in.'); next(); } catch (err) { toast(err.message); }
    };
    if (!mine && !reduce && all.length > 1) {
      elapsed = 0;
      const bar = box.querySelector('.timer i');
      const hold = () => paused || box.matches(':hover') || box.contains(document.activeElement);
      pickTimer = setInterval(() => {
        if (!document.body.contains(box)) { stopPickTimer(); return; }
        if (hold()) return;
        elapsed += STEP;
        if (bar) bar.style.width = Math.min(100, (elapsed / LIMIT) * 100) + '%';
        if (elapsed >= LIMIT) next();
      }, STEP);
    }
  }
  async function next() { i = (i + 1) % queue.length; flip = Math.random() < 0.5; const p = queue[i]; await show(p, db.myVotes()[p.id] ? await db.pairResults(p.id) : null); }
  const first = queue[0];
  (async () => show(first, db.myVotes()[first.id] ? await db.pairResults(first.id) : null))();
}

async function viewSection(kind) {
  const k = KINDS[kind];
  const sort = params().get('sort') || 'new';
  document.title = `${k.name} · The Yellow Pieces`;
  const list = await db.feed({ kind, sort, limit: 60 });
  const tab = (s, label) => `<a href="#/${k.slug}?sort=${s}" ${sort === s ? 'aria-current="page"' : ''}>${label}</a>`;
  main.innerHTML = `
    <header class="page-head">
      <h1>${esc(k.name)}</h1>
      <p class="lede">${esc(k.blurb)}</p>
      <div class="head-row"><nav class="tabs" aria-label="Sort">${tab('new', 'Newest')}${tab('hot', 'Trending')}${tab('top', 'Most stuck')}</nav>
        <a class="btn" href="#/share/${kind}">${esc(k.cta)}</a></div>
    </header>
    ${await cards(list)}`;
}

function viewSketches() {
  const k = KINDS.sketch;
  document.title = `${k.name} · The Yellow Pieces`;
  const stills = [
    ['img/lil-jp/turnaround.jpg', 'Lil JP character sheet: a freckled, red-haired boy in a striped shirt and rolled-up cords, drawn from the front, side and back, plus a pencil sketch.'],
    ['img/lil-jp/classroom.jpg', 'Lil JP and a dark-haired friend read aloud in front of a classroom while their teacher laughs and the other students cry.'],
    ['img/lil-jp/kitchen.jpg', 'Lil JP writing late at night under a kitchen lamp while his mom watches over his shoulder.'],
    ['img/lil-jp/incident.jpg', 'A school incident report for JP, 7th grade, Fall 1994, clipped beside a blue-pen drawing of two boys and a giant cookie.'],
  ];
  main.innerHTML = `
    <header class="page-head">
      <p class="kicker">Under construction</p>
      <h1>${esc(k.name)}</h1>
      <p class="lede">This corner is still being built. Hard hats on. Pieces still in progress will land here soon, with room for your notes and feedback.</p>
    </header>
    <section class="construction" aria-labelledby="soon-h">
      <div class="sec-head"><div><p class="kicker">A peek ahead</p><h2 class="section-title" id="soon-h">Stills from the Lil JP series</h2></div></div>
      <ul class="stills">${stills.map(([src, alt]) => `
        <li><figure><img src="${src}" alt="${esc(alt)}" loading="lazy" decoding="async"><figcaption><span class="soon-tag">Coming Soon…</span> Lil JP</figcaption></figure></li>`).join('')}
      </ul>
    </section>`;
}

async function viewColor(slug) {
  const cs = await db.colors();
  const c = cs.find((x) => x.slug === slug);
  if (!c) { main.innerHTML = `<p class="empty">No such color.</p>`; return; }
  document.title = `${c.name} · The Yellow Pieces`;
  const list = await db.feed({ color: slug, sort: 'new', limit: 60 });
  main.innerHTML = `
    <header class="page-head">
      <h1><span class="hl" style="--hlc:${esc(c.hex)}">${esc(c.name)}</span> pieces</h1>
      <p class="lede">${esc(c.meaning)}. Marked by the writer or highlighted by readers.</p>
    </header>
    ${await colorStrip(slug)}
    ${await cards(list, 'Nothing highlighted this color yet.')}`;
}

async function viewPiece(id) {
  const p = await db.getPiece(id);
  if (!p) { main.innerHTML = `<p class="empty">That piece isn't here. It may be private or deleted.</p>`; return; }
  const [st, , user, comments, hl, cs, admin] = await Promise.all([db.myStuck([p.id]), loadReactions([p.id]), db.currentUser(), db.comments(p.id), db.highlightsFor(p.id), db.colors(), db.isAdmin()]);
  const mine = user && user.id === p.author_id;
  const k = KINDS[p.kind];
  document.title = `${plain(p.title) || excerpt(p.body, 40) || 'A picture'} · The Yellow Pieces`;
  let content;
  if (p.kind === 'quote' && p.photo_has_text) {
    content = `<div class="hero-media"><div class="media-box">${photoHtml(p, { tone: false })}</div></div>
      ${p.source ? `<p class="from">Filed under <b>${esc(p.source.name)}</b></p>` : ''}
      ${p.writeup ? `<h2 class="sub">Why it stuck</h2><p class="prose">${rich(p.writeup)}</p>` : ''}`;
  } else if (p.kind === 'quote') {
    content = `${quoteCardHtml(p, { large: true, photo: db.photoUrl(p.photo_path) })}
      ${p.source ? `<p class="from">Filed under <b>${esc(p.source.name)}</b></p>` : ''}
      ${p.writeup ? `<h2 class="sub">Why it stuck</h2><p class="prose">${rich(p.writeup)}</p>` : ''}`;
  } else if (p.kind === 'sketch') {
    content = `<h1 class="sheet-title">${(hasHl(p.title) ? `<span class="hl-${esc(p.color)}">${ttl(p.title)}</span>` : `<span class="hl hl-${esc(p.color)}">${esc(p.title)}</span>`)}</h1>
      ${p.aiming_for ? `<p class="aim"><b>What I'm going for:</b> ${esc(p.aiming_for)}</p>` : ''}
      <h2 class="sub">Where I'm at now</h2><pre class="scene">${rich(p.body)}</pre>
      ${p.started_at ? `<details><summary>Where I started</summary><pre class="scene">${esc(p.started_at)}</pre></details>` : ''}`;
  } else if (p.kind === 'photo') {
    content = `<div class="hero-media"><div class="media-box" style="aspect-ratio:auto"><img src="${esc(db.photoUrl(p.photo_path))}" alt="${esc(p.photo_alt)}" style="display:block;width:100%"></div></div>
      <h1 class="sheet-title">${ttl(p.title)}</h1>${p.body ? `<p class="prose">${rich(p.body)}</p>` : ''}`;
  } else {
    content = `${p.photo_path ? `<div class="hero-media"><div class="media-box wide">${photoHtml(p, { tone: false })}</div></div>` : ''}
      ${p.title ? `<h1 class="sheet-title">${(hasHl(p.title) ? `<span class="hl-${esc(p.color)}">${ttl(p.title)}</span>` : `<span class="hl hl-${esc(p.color)}">${esc(p.title)}</span>`)}</h1>` : ''}
      <div class="prose ${p.kind === 'piece' || p.kind === 'poem' ? 'verse' : ''}">${rich(p.body)}</div>`;
  }
  main.innerHTML = `
    <article class="sheet paper ${p.image_svg ? 'has-bg' : ''}">
      ${p.status === 'draft' ? `<p class="pill">Draft · only you can see this</p>` : ''}
      ${content}
      ${p.passage ? `<div class="excerpt"><p>An excerpt from <i>${esc(p.from_title || 'a longer piece')}</i></p>
        <a class="btn-dark" href="#/passage/${esc(p.id)}">Read the passage →</a></div>` : ''}
      ${byline(p)}
      <div class="actions">
        ${stuckBtn(p, st.has(p.id))}${rxHtml(p.id)}
        ${p.kind === 'quote' && !p.photo_has_text ? `<button class="btn-ghost" data-download>Save as image</button>` : ''}
        <button class="btn-ghost" data-share>Share</button>
        ${mine && p.status === 'draft' ? `<button class="btn-ghost" data-publish>Publish</button>` : ''}
        ${admin ? `<a class="btn" href="#/edit/${esc(p.id)}">Edit</a>` : ''}
        ${mine ? `<button class="btn-ghost danger" data-delete>Delete</button>` : `<button class="btn-ghost" data-report>Report</button>`}
      </div>
      <div class="highlighter">
        <p class="label">Highlight it <span class="opt">— what does this piece feel like to you?</span></p>
        <div class="chips">${cs.map((c) => `<button class="chip" style="--c:${esc(c.hex)}" data-hl="${esc(c.slug)}" aria-pressed="${hl.mine.has(c.slug)}" title="${esc(c.meaning)}">
          ${esc(c.name)}${hl.counts[c.slug] ? ` <b>${hl.counts[c.slug]}</b>` : ''}</button>`).join('')}</div>
      </div>
    </article>
    <section class="comments" id="responses">
      <h2 class="section-title">${p.kind === 'sketch' ? 'Notes for the writer' : 'Join the conversation'}</h2>
      ${comments.length ? `<ul class="comment-list">${comments.map((c) => `
        <li><p class="meta"><a href="#/u/${esc(c.author?.username)}">@${esc(c.author?.username)}</a> · ${ago(c.created_at)}
          ${user && user.id === c.author_id ? `<button class="link danger" data-del-comment="${c.id}">delete</button>` : ''}</p>
          <p>${esc(c.body)}</p></li>`).join('')}</ul>` : `<p class="empty">No responses yet.</p>`}
      ${user ? `<form id="comment-form" class="stack">
          <label for="comment-body">${p.kind === 'sketch' ? 'Leave a note' : 'Add a response'}</label>
          <textarea id="comment-body" required maxlength="3000" rows="3" placeholder="${p.kind === 'sketch' ? 'What worked, what didn\'t ring true…' : 'Agree? See it differently? Me too — my family always said…'}"></textarea>
          <button class="btn" type="submit">Post</button></form>`
        : `<p><a href="#/signin">Sign in</a> to respond.</p>`}
    </section>`;

  if (p.image_svg) setPieceBg(p.image_svg);
  main.querySelector('[data-share]').onclick = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: 'The Yellow Pieces', text: p.kind === 'quote' ? (p.body ? `“${p.body}”` : '') : (p.title || ''), url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch {}
  };
  const dl = main.querySelector('[data-download]');
  if (dl) dl.onclick = async () => {
    const blob = await quoteCardPng(p, { photo: db.photoUrl(p.photo_path) });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'yellow-piece.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const pub = main.querySelector('[data-publish]');
  if (pub) pub.onclick = async () => { await db.publishDraft(p.id); toast('Published'); route(); };
  const del = main.querySelector('[data-delete]');
  if (del) del.onclick = async () => { if (confirm('Delete this piece for good?')) { await db.deletePiece(p.id); toast('Deleted'); go('#/'); } };
  const rep = main.querySelector('[data-report]');
  if (rep) rep.onclick = async () => {
    if (!(await needProfile())) return;
    const reason = prompt('What\'s wrong with this piece? (optional)');
    if (reason === null) return;
    await db.report({ pieceId: p.id, reason }); toast('Thanks — we\'ll take a look');
  };
  main.querySelectorAll('[data-hl]').forEach((b) => {
    b.onclick = async () => {
      if (!(await needProfile())) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.disabled = true;
      try { await db.setHighlight(p.id, b.dataset.hl, on); route(); } catch (err) { toast(err.message); b.disabled = false; }
    };
  });
  main.querySelectorAll('[data-del-comment]').forEach((b) => {
    b.onclick = async () => { await db.deleteComment(Number(b.dataset.delComment)); route(); };
  });
  const cf = document.getElementById('comment-form');
  if (cf) cf.onsubmit = async (e) => {
    e.preventDefault();
    if (!(await needProfile())) return;
    const body = cf.querySelector('textarea').value.trim();
    if (!body) return;
    try { await db.addComment(p.id, body); route(); } catch (err) { toast(err.message); }
  };
}

// ---------- sharing a piece ----------
async function viewShareChooser() {
  const admin = await db.isAdmin();
  main.innerHTML = `
    <header class="page-head"><h1>Share a yellow piece</h1><p class="lede">What would you like to pass along?</p></header>
    <ul class="choices">${Object.entries(KINDS).filter(([kind]) => !HIDDEN.has(kind) && !UNDER_CONSTRUCTION.has(kind) && (kind !== 'photo' || admin)).map(([kind, k]) => `
      <li><a class="paper choice" href="${kind === 'photo' ? '#/admin' : '#/share/' + kind}"><b>${esc(k.name)}</b><span>${esc(k.blurb)}</span></a></li>`).join('')}
    </ul>`;
}


// ---------- passage page: the paragraph around a line, with the line highlighted ----------
const PASSAGE_SKY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F1B3A"/><stop offset=".5" stop-color="#3B2C55"/><stop offset=".8" stop-color="#8E5A78"/><stop offset=".93" stop-color="#C98E62"/></linearGradient></defs><rect width="400" height="500" fill="url(#s)"/><circle cx="268" cy="452" r="24" fill="#E9B930" opacity=".7"/><path d="M0 460 L60 430 L110 445 L170 410 L230 442 L290 425 L340 440 L400 418 L400 500 L0 500 Z" fill="#33254A"/><path d="M0 480 L80 458 L150 474 L220 454 L300 478 L360 466 L400 474 L400 500 L0 500 Z" fill="#1A1429"/></svg>`;
function passageHtml(passage, line) {
  const want = plain(line).trim();
  const norm = (t) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  let marked = false;
  return String(passage).split(/\n\s*\n/).map((para) => {
    const i = !marked && want ? norm(para).toLowerCase().indexOf(norm(want).toLowerCase()) : -1;
    if (i < 0) return `<p>${esc(para.trim())}</p>`;
    marked = true;
    return `<p>${esc(para.slice(0, i))}<mark class="hlw">${esc(para.slice(i, i + want.length))}</mark>${esc(para.slice(i + want.length))}</p>`;
  }).join('');
}
async function viewPassage(id) {
  const p = await db.getPiece(id);
  if (!p || !p.passage) { main.innerHTML = `<p class="empty">That passage isn't here. <a href="#/">Go home</a></p>`; return; }
  const [st] = await Promise.all([db.myStuck([p.id]), loadReactions([p.id])]);
  const full = p.from_piece_id ? await db.getPiece(p.from_piece_id).catch(() => null) : null;
  document.title = `${p.from_title || 'The passage'} · The Yellow Pieces`;
  setPieceBg(PASSAGE_SKY);
  document.getElementById('piece-bg').classList.add('passage-bg');
  main.innerHTML = `<article class="sheet passage">
    <p class="kicker">The passage</p>
    ${p.from_title ? `<h1 class="sheet-title passage-title">${esc(p.from_title)}</h1>` : ''}
    <div class="prose passage-text">${passageHtml(p.passage, p.body)}</div>
    <div class="actions">
      ${stuckBtn(p, st.has(p.id))}${rxHtml(p.id)}
      ${full ? `<a class="btn" href="#/p/${esc(full.id)}">Read the whole piece →</a>` : ''}
      <a class="btn-ghost" href="#/p/${esc(p.id)}">← Back to the line</a>
    </div>
    ${full ? '' : `<p class="hint">“Read the whole piece” shows up once the full piece is posted.</p>`}
  </article>`;
}

function colorPicker(cs, selected = 'yellow') {
  return `<fieldset class="chips" id="f-color"><legend class="label">Highlighter color</legend>
    ${cs.map((c) => `<label class="chip chip-radio" style="--c:${esc(c.hex)}" title="${esc(c.meaning)}">
      <input type="radio" name="color" value="${esc(c.slug)}" ${c.slug === selected ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}
    <p class="hint" id="color-meaning"></p></fieldset>`;
}

async function viewShare(kind) {
  if (!(await needProfile())) return;
  if (kind === 'photo') { go('#/admin'); return; }
  const k = KINDS[kind];
  const [cs, srcs] = await Promise.all([db.colors(), db.sources()]);
  document.title = `${k.cta} · The Yellow Pieces`;
  let fields = '';
  if (kind === 'quote') {
    fields = `
      <label for="f-body">The line</label>
      <textarea id="f-body" required maxlength="400" rows="3" placeholder="Leave the porch light on. Somebody always comes home late."></textarea>
      <div class="row">
        <div class="stack"><label for="f-said">Who said it</label><input id="f-said" maxlength="140" placeholder="My grandmother"></div>
        <div class="stack"><label for="f-src">Where it came from</label>
          <select id="f-src">${srcs.map((s) => `<option value="${esc(s.slug)}">${esc(s.name)}</option>`).join('')}</select></div>
      </div>
      <label class="label">Background</label>
      <div class="backdrops" id="f-backdrop">${Object.entries(BACKDROPS).map(([slug, b], i) => `
        <label class="bd" style="--qa:${b.bg[0]};--qb:${b.bg[1]};--qi:${b.ink}"><input type="radio" name="backdrop" value="${slug}" ${i === 0 ? 'checked' : ''}><span>${esc(b.name)}</span></label>`).join('')}</div>
      <div id="preview" aria-live="polite"></div>
      <label for="f-writeup">Why it stuck <span class="opt">— who said it, what it meant, when it mattered</span></label>
      <textarea id="f-writeup" maxlength="3000" rows="5" placeholder="She said it every night…"></textarea>`;
  } else if (kind === 'sketch') {
    fields = `
      <label for="f-title">Scene title</label>
      <input id="f-title" required maxlength="140" placeholder="Father and son, the night before he leaves">
      <label for="f-aim">What I'm trying to do with this scene</label>
      <textarea id="f-aim" maxlength="1500" rows="2" placeholder="Say I love you without either of them saying it."></textarea>
      <label for="f-body">Where I'm at now</label>
      <textarea id="f-body" class="scene-input" required maxlength="20000" rows="10" placeholder="DAD: You packed socks?"></textarea>
      <label for="f-start">Where I started <span class="opt">(optional — an earlier draft)</span></label>
      <textarea id="f-start" class="scene-input" maxlength="3000" rows="5"></textarea>`;
  } else if (kind === 'line') {
    fields = `
      <label for="f-body">Your line</label>
      <textarea id="f-body" required maxlength="500" rows="3" placeholder="A one-liner, a quip, a thought worth keeping…"></textarea>`;
  } else {
    const ph = { poem: ['Untitled', 'Roses are red…'], piece: ['Margins', 'Every page I ever loved…'], story: ['The note in the toolbox', 'When my dad passed, I found…'], humor: ['Dinner rules, Southern edition', 'My aunt\'s only rule at Thanksgiving…'] }[kind];
    fields = `
      <label for="f-title">Title</label>
      <input id="f-title" ${kind === 'piece' || kind === 'poem' ? '' : 'required'} maxlength="140" placeholder="${esc(ph[0])}">
      <label for="f-body">${kind === 'piece' ? 'Your piece' : kind === 'poem' ? 'Your poem or song' : kind === 'story' ? 'Your story' : 'The funny part'}</label>
      <textarea id="f-body" class="${kind === 'piece' || kind === 'poem' ? 'verse-input' : ''}" required maxlength="20000" rows="${kind === 'humor' ? 5 : 10}" placeholder="${esc(ph[1])}"></textarea>`;
  }
  main.innerHTML = `
    <form id="share" class="sheet paper stack">
      <h1 class="sheet-title">${esc(k.cta)}</h1>
      <p class="lede">${esc(k.blurb)}</p>
      ${fields}
      ${colorPicker(cs, kind === 'sketch' ? 'gray' : 'yellow')}
      <fieldset class="toggles"><legend class="label">Who can see it</legend>
        <label><input type="radio" name="vis" value="public" checked> Everyone</label>
        <label><input type="radio" name="vis" value="unlisted"> Only people with the link</label>
        <label><input type="radio" name="vis" value="private"> Just me</label>
      </fieldset>
      <div class="actions"><button class="btn" type="submit" name="publish">Post it</button>
        <button class="btn-ghost" type="submit" name="draft">Save draft</button></div>
      <div id="form-msg"></div>
    </form>`;

  const f = document.getElementById('share');
  { const ti = f.querySelector('#f-title');
    if (ti) { const bar = document.createElement('div'); bar.className = 'fmt-bar';
      bar.innerHTML = '<button type="button" class="btn-ghost btn-small" title="Highlight the selected word in the title"><mark class="hlw">Highlight</mark></button><span class="hint">Select a word in the title, then tap Highlight.</span>';
      bar.querySelector('button').addEventListener('mousedown', (e) => e.preventDefault());
      bar.querySelector('button').addEventListener('click', () => wrapSel(ti, '=='));
      ti.after(bar); } }
  const val = (id) => (f.querySelector('#' + id)?.value || '').trim();
  const meaning = () => {
    const sel = f.querySelector('input[name=color]:checked').value;
    document.getElementById('color-meaning').textContent = (cs.find((c) => c.slug === sel) || {}).meaning || '';
  };
  f.querySelectorAll('input[name=color]').forEach((r) => r.addEventListener('change', meaning)); meaning();
  if (kind === 'quote') {
    const preview = () => {
      const body = val('f-body') || 'Your line will show up here.';
      document.getElementById('preview').innerHTML = quoteCardHtml({ body, said_by: val('f-said'), backdrop: f.querySelector('input[name=backdrop]:checked').value });
    };
    f.addEventListener('input', preview); f.addEventListener('change', preview); preview();
  }
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('form-msg');
    const draft = e.submitter && e.submitter.name === 'draft';
    const piece = {
      kind, body: val('f-body'), title: val('f-title'),
      color: f.querySelector('input[name=color]:checked').value,
      visibility: f.querySelector('input[name=vis]:checked').value,
      status: draft ? 'draft' : 'published',
    };
    if (kind === 'quote') Object.assign(piece, { said_by: val('f-said'), source_slug: val('f-src') || null, writeup: val('f-writeup'), backdrop: f.querySelector('input[name=backdrop]:checked').value });
    if (kind === 'sketch') Object.assign(piece, { aiming_for: val('f-aim'), started_at: val('f-start') });
    if (!piece.body) { msg.innerHTML = errorBox('Add the words first.'); return; }
    f.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try { const id = await db.createPiece(piece); toast(draft ? 'Draft saved' : 'Posted'); go('#/p/' + id); }
    catch (err) { msg.innerHTML = errorBox(err); f.querySelectorAll('button').forEach((b) => { b.disabled = false; }); }
  };
}

// ---------- other pages ----------
function viewAbout() {
  document.title = 'What is a yellow piece? · The Yellow Pieces';
  main.innerHTML = `
    <article class="sheet paper prose-page">
      <h1 class="sheet-title">What's a <span class="hl hl-yellow">yellow piece</span>?</h1>
      <p>Think of the yellowed pages of an old book, an old newspaper, a letter kept in a drawer. The words that survive that long usually earned it — repeated, passed down, and useful enough to last.</p>
      <p>The Yellow Pieces is a place to highlight those words: the line your grandmother always said, the motto your family lived by, the thing a stranger told you right when you needed it, the sentence a child said that stopped you cold.</p>
      <h2 class="sub">Your experience is the evidence</h2>
      <p>Nothing here has to be true for everyone, all the time. A yellow piece only has to have been true for you. Nobody has to defend their words — this is lived experience and lived wisdom, and we celebrate it even when someone else sees it differently.</p>
      <h2 class="sub">The highlighter colors</h2>
      <div id="about-colors"></div>
      <p class="actions"><a class="btn" href="#/share/quote">Share a quote</a> <a class="btn-ghost" href="#/quotes">Read the quotes</a></p>
    </article>`;
  db.colors().then((cs) => {
    document.getElementById('about-colors').innerHTML = `<ul class="legend">${cs.map((c) => `<li><span class="hl" style="--hlc:${esc(c.hex)}">${esc(c.name)}</span> ${esc(c.meaning)}</li>`).join('')}</ul>`;
  });
}

function viewPrivacy() {
  document.title = 'Privacy · The Yellow Pieces';
  const contact = CONTACT_EMAIL ? `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>` : 'the email address in any message from us';
  main.innerHTML = `
    <article class="sheet paper prose-page">
      <h1 class="sheet-title">Privacy</h1>
      <p>Short version: we keep what we need to run the site, and we don't sell or share it.</p>
      <h2 class="sub">Your email</h2>
      <p>If you sign up for "A yellow piece now and then," we store your email address to send you the occasional line or story. Every email includes a link to unsubscribe, and you can also ask us to remove you at ${contact}.</p>
      <h2 class="sub">Your account and what you share</h2>
      <p>If you create an account, we keep your sign-in email and the name and pieces you choose to post. Pieces marked public can be read by anyone. Drafts and private pieces stay yours. You can ask us to delete your account and your pieces at ${contact}.</p>
      <h2 class="sub">Visitor stats</h2>
      <p>We may use simple, cookie-free visitor counts (page views and where visitors come from) to see what people enjoy. They don't identify you.</p>
      <h2 class="sub">Who handles the data</h2>
      <p>The site's data is stored with Supabase, the site is served by Cloudflare, and emails are sent through Resend. They process it only to run the service. We never sell your information.</p>
      <p class="actions"><a class="btn-ghost" href="#/">Back to the pieces</a></p>
    </article>`;
}

function viewLearn() {
  document.title = 'Writer\'s Corner · The Yellow Pieces';
  main.innerHTML = `
    <article class="sheet paper prose-page">
      <p class="pill">Coming soon</p>
      <h1 class="sheet-title">Writer's Corner</h1>
      <p>Free writing lessons, built the way a good class works: a piece to read, then questions that make you a sharper reader.</p>
      <ul class="plain">
        <li><b>Pieces with prompts</b> — stories, poems and letters, each with teacher-style questions on what the writer is trying to capture.</li>
        <li><b>Worksheets</b> — download them, or type your answers right here and see how other readers took it.</li>
        <li><b>Further reading</b> — the book, quote or song an idea came from.</li>
        <li><b>The writer's take</b> — revealed once enough readers have weighed in.</li>
      </ul>
    </article>`;
}

async function viewProfile(username) {
  const prof = await db.profileByUsername(username);
  if (!prof) { main.innerHTML = `<p class="empty">No one here by that name.</p>`; return; }
  const me = await db.myProfile();
  const isMe = me && me.id === prof.id;
  const [list, drafts] = await Promise.all([db.feed({ authorId: prof.id, includePrivate: isMe, limit: 60 }), isMe ? db.drafts() : []]);
  document.title = `@${prof.username} · The Yellow Pieces`;
  main.innerHTML = `
    <header class="page-head"><h1>@${esc(prof.username)}</h1>
      ${isMe ? `<form id="bio-form" class="stack"><label for="bio">About you</label><textarea id="bio" maxlength="280" rows="2">${esc(prof.bio)}</textarea><button class="btn btn-small" type="submit">Save</button></form>`
        : prof.bio ? `<p class="lede">${esc(prof.bio)}</p>` : ''}
    </header>
    ${isMe && drafts.length ? `<section><h2 class="section-title">Your drafts</h2>${await cards(drafts)}</section>` : ''}
    <section><h2 class="section-title">Shared pieces</h2>${await cards(list, 'Nothing shared yet.')}</section>`;
  const bf = document.getElementById('bio-form');
  if (bf) bf.onsubmit = async (e) => { e.preventDefault(); await db.updateBio(bf.querySelector('textarea').value.trim()); toast('Saved'); };
}

async function viewSearch() {
  const q = params().get('q') || '';
  document.title = 'Search · The Yellow Pieces';
  main.innerHTML = `
    <header class="page-head"><h1>Search</h1>
      <form class="search" id="search-form" role="search"><label class="sr-only" for="q">Search words, titles and who said it</label>
        <input id="q" type="search" value="${esc(q)}" placeholder="grandmother, porch, river…"><button class="btn" type="submit">Search</button></form>
    </header>
    <div id="results">${q ? await cards(await db.feed({ q, limit: 60 }), 'Nothing matched.') : ''}</div>`;
  document.getElementById('search-form').onsubmit = (e) => { e.preventDefault(); go('#/search?q=' + encodeURIComponent(document.getElementById('q').value.trim())); };
}

async function viewSignIn() {
  if (await db.myProfile()) { go('#/'); return; }
  if (await db.currentUser()) { go('#/welcome'); return; }
  main.innerHTML = `
    <form id="signin" class="sheet paper stack narrow">
      <h1 class="sheet-title">Sign in</h1>
      <p>No password needed. We'll email you a sign-in code.</p>
      <label for="f-email">Email</label>
      <input id="f-email" type="email" required autocomplete="email">
      <button class="btn" type="submit">Email me a code</button>
      <div id="form-msg"></div>
    </form>`;
  const f = document.getElementById('signin');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('form-msg');
    const email = f.querySelector('input').value.trim();
    f.querySelector('button').disabled = true;
    try {
      await db.signInEmail(email);
      if (db.getMode() === 'demo') { go('#/welcome'); return; }
      showCodeStep(email);
    } catch (err) { msg.innerHTML = errorBox(err); f.querySelector('button').disabled = false; }
  };
}
function showCodeStep(email) {
  main.innerHTML = `
    <form id="code" class="sheet paper stack narrow">
      <h1 class="sheet-title">Check your email</h1>
      <p>We emailed <b>${esc(email)}</b>. Type the code from the email here, or open the email's link in <b>this same browser</b>. (It can take a minute.)</p>
      <p class="hint">Don't see it? Check your <b>Junk or Spam</b> folder (Outlook and Hotmail often put it there). Marking it "Not junk" makes the next one arrive in your inbox.</p>
      <label for="f-code">Sign-in code</label>
      <input id="f-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" maxlength="10" required>
      <button class="btn" type="submit">Sign in</button>
      <button class="link" type="button" data-again>Send a new code</button>
      <div id="form-msg"></div>
    </form>`;
  const f = document.getElementById('code');
  f.querySelector('input').focus();
  f.querySelector('[data-again]').onclick = () => viewSignIn();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('form-msg');
    const token = f.querySelector('input').value.replace(/\D/g, '');
    f.querySelector('button[type=submit]').disabled = true;
    try {
      await db.verifyCode(email, token);
      await renderAccount();
      go((await db.myProfile()) ? '#/' : '#/welcome');
    } catch (err) {
      msg.innerHTML = errorBox('That code didn\'t work. Check it, or send a new one.');
      f.querySelector('button[type=submit]').disabled = false;
    }
  };
}

async function viewWelcome() {
  const user = await db.currentUser();
  if (!user) { go('#/signin'); return; }
  if (await db.myProfile()) { go('#/'); return; }
  main.innerHTML = `
    <form id="welcome" class="sheet paper stack narrow">
      <h1 class="sheet-title">Pick a username</h1>
      <p>This is how people will see you. Lowercase letters, numbers and underscores, 3 to 24 characters.</p>
      <label for="f-user">Username</label>
      <input id="f-user" required pattern="[a-z0-9_]{3,24}" maxlength="24" autocapitalize="none" autocomplete="username">
      <button class="btn" type="submit">Save</button>
      <div id="form-msg"></div>
    </form>`;
  const f = document.getElementById('welcome');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const name = f.querySelector('input').value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(name)) { document.getElementById('form-msg').innerHTML = errorBox('Use 3 to 24 lowercase letters, numbers or underscores.'); return; }
    try { await db.createProfile(name); renderAccount(); toast(`Welcome, @${name}`); go('#/share'); }
    catch (err) { document.getElementById('form-msg').innerHTML = errorBox(err); }
  };
}

// ---------- admin: photos, featured, pick-one pairs ----------
async function viewAdmin() {
  if (!(await needProfile())) return;
  if (!(await db.isAdmin())) { main.innerHTML = `<p class="empty">This page is for site admins.</p>`; return; }
  document.title = 'Site admin · The Yellow Pieces';
  const recent = await db.feed({ sort: 'new', limit: 300, includePrivate: true });
  const pairList = await db.pairs({ includeInactive: true });
  const opt = (p) => `<option value="${esc(p.id)}">${esc(KINDS[p.kind].name)} · ${esc(excerpt(label(p), 60))}</option>`;
  const thumb = (p) => p.photo_path ? `<img class="thumb" src="${esc(db.photoUrl(p.photo_path))}" alt="">` : `<span class="thumb" aria-hidden="true"></span>`;
  main.innerHTML = `<div class="admin-grid">
    <header class="page-head"><h1>Site admin</h1><p class="lede">Add pictures, choose what's featured, and set up the pick-one pairs. Changes show on the site right away.</p></header>

    <form id="photo-form" class="paper stack">
      <h2 class="section-title">Add a picture</h2>
      <p class="hint">It's resized for the web (1600 px, WebP) before it's stored. Your full-size original stays on your computer.</p>
      <label for="ph-file">Photo</label><input id="ph-file" type="file" accept="image/*" required>
      <label for="ph-size">Downsize to</label><select id="ph-size"><option value="1200">1200 px (smallest)</option><option value="1600" selected>1600 px (recommended)</option><option value="2048">2048 px (sharpest)</option></select>
      <div id="photo-preview"></div>
      <fieldset class="toggles"><legend class="label">Use it for</legend>
        <label><input type="radio" name="ph-use" value="new" checked> A new picture post (Pictures section)</label>
        <label><input type="radio" name="ph-use" value="attach"> An existing piece (quote, story, piece…)</label></fieldset>
      <div id="ph-new" class="stack"><label for="ph-title">Title</label><input id="ph-title" maxlength="140" placeholder="Pavilion at sunset">
        <label for="ph-caption">Caption <span class="opt">(place, date, a line about it)</span></label><input id="ph-caption" maxlength="400" placeholder="New Port Richey, Florida · Spring 2017"></div>
      <div id="ph-attach" class="stack" hidden><label for="ph-piece">Piece</label><select id="ph-piece">${recent.filter((p) => p.kind !== 'photo').map(opt).join('')}</select></div>
      <label for="ph-alt">Describe the picture <span class="opt">(for people using screen readers)</span></label><input id="ph-alt" maxlength="300" placeholder="A bike under a pavilion at sunset">
      <label class="check"><input type="checkbox" id="ph-text"> The words are already in the picture (a quote post). It'll always be shown whole, never cropped.</label>
      <label class="check"><input type="checkbox" id="ph-feat"> Feature it on the homepage</label>
      <div class="actions"><button class="btn" type="submit">Upload</button></div><div id="ph-msg" aria-live="polite"></div>
    </form>

    <section class="paper stack" id="batch-cards">
      <h2 class="section-title">Add many quote cards at once</h2>
      <p class="hint">Drop a whole batch of finished quote-card pictures here (or choose them). Each one is resized for the web and posted as a quote with the words already in the picture. Drop the batch's list file (.csv) in with the pictures to fill in each full line automatically, or type the lines yourself; otherwise the file name is used.</p>
      <label class="dropzone" id="bc-drop" for="bc-files"><b>Drag your quote cards here</b><span>or click to choose them (as many as you like)</span></label>
      <input id="bc-files" class="sr" type="file" accept="image/*,.csv" multiple>
      <div id="bc-list"></div>
      <label class="check" id="bc-opts" hidden><input type="checkbox" id="bc-feat"> Feature the first one on the homepage</label>
      <div class="actions"><button class="btn" type="button" id="bc-post" hidden>Post all</button><button class="btn-ghost" type="button" id="bc-clear" hidden>Clear</button></div>
      <div id="bc-msg" aria-live="polite"></div>
    </section>

    <section class="paper stack" id="desk-import">
      <h2 class="section-title">Import from Writing Desk</h2>
      <p class="hint">Choose the file the Writing Desk exported ("Export ready"). You'll see each piece first, then post the ones you tick.</p>
      <label for="di-file">Export file</label><input id="di-file" type="file" accept=".json,application/json">
      <div id="di-list"></div><div id="di-msg" aria-live="polite"></div>
    </section>

    <section class="paper"><h2 class="section-title">Your pieces</h2><p class="hint">Edit the words or photo of any piece, choose what's featured, or delete old versions. The newest three featured pieces show on the homepage.</p>
      <label for="pl-filter">Find a piece</label><input id="pl-filter" type="search" placeholder="Type a word from the title or text">
      <ul class="admin-list" id="piece-list">${recent.filter((p) => p.status === 'published').map((p) => `<li data-find="${esc((label(p) + ' ' + (p.title || '') + ' ' + (p.body || '')).toLowerCase().slice(0, 400))}">${thumb(p)}
        <span class="what">${esc(excerpt(label(p), 80))}<small>${esc(KINDS[p.kind].name)} · @${esc(p.author?.username)}</small></span>
        <a class="btn-ghost btn-small" href="#/edit/${esc(p.id)}">Edit</a>
        <button class="btn-ghost btn-small" type="button" data-feature="${esc(p.id)}" aria-pressed="${!!p.featured}">${p.featured ? '★ Featured' : 'Feature'}</button>
        <button class="link danger" type="button" data-del-piece="${esc(p.id)}" data-photo="${esc(p.photo_path || '')}">Delete</button></li>`).join('')}</ul></section>

    <section class="paper"><h2 class="section-title">Pick-one pairs</h2>
      <p class="hint">Pairs work best as a picture against a quote, or two quotes that pull different ways.</p>
      <form id="pair-form" class="stack">
        <div class="row">${['a', 'b'].map((k) => `<div class="stack pair-side"><label for="p${k}">${k === 'a' ? 'Left' : 'Right'}</label>
          <select id="p${k}"><option value="">Choose a piece on the site…</option>${recent.map(opt).join('')}</select>
          <label for="p${k}-file" class="opt">…or upload a new picture</label><input id="p${k}-file" type="file" accept="image/*"></div>`).join('')}</div>
        <label class="check"><input type="checkbox" id="p-text"> The words are already in the uploaded picture(s) (a quote card). Shown whole, never cropped.</label>
        <div class="actions"><button class="btn" type="submit">Add pair</button></div><div id="pair-msg" aria-live="polite"></div></form>
      <ul class="admin-list">${pairList.map((x) => `<li>${thumb(x.a)}${thumb(x.b)}
        <span class="what">${esc(excerpt(label(x.a), 40))} <b>or</b> ${esc(excerpt(label(x.b), 40))}<small>${x.active ? 'Showing' : 'Hidden'}</small></span>
        <button class="btn-ghost btn-small" type="button" data-pair-toggle="${x.id}" data-on="${x.active}">${x.active ? 'Hide' : 'Show'}</button>
        <button class="link danger" type="button" data-pair-del="${x.id}">Remove</button></li>`).join('') || '<li class="empty">No pairs yet.</li>'}</ul></section>
  </div>`;

  const f = document.getElementById('photo-form');
  const file = f.querySelector('#ph-file');
  file.onchange = () => { const x = file.files[0]; document.getElementById('photo-preview').innerHTML = x ? `<img src="${URL.createObjectURL(x)}" alt="">` : ''; };
  f.querySelectorAll('input[name=ph-use]').forEach((r) => { r.onchange = () => {
    const attach = f.querySelector('input[name=ph-use]:checked').value === 'attach';
    document.getElementById('ph-new').hidden = attach; document.getElementById('ph-attach').hidden = !attach; }; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('ph-msg');
    const x = file.files[0];
    if (!x) return;
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = 'Resizing and uploading…';
    try {
      const path = await db.uploadPhoto(x, Number(f.querySelector('#ph-size')?.value || 1600));
      const fields = { photo_path: path, photo_has_text: f.querySelector('#ph-text').checked, photo_alt: f.querySelector('#ph-alt').value.trim(),
        featured: f.querySelector('#ph-feat').checked || undefined };
      let id;
      if (f.querySelector('input[name=ph-use]:checked').value === 'attach') id = f.querySelector('#ph-piece').value;
      else id = await db.createPiece({ kind: 'photo', title: f.querySelector('#ph-title').value.trim(), body: f.querySelector('#ph-caption').value.trim() || f.querySelector('#ph-title').value.trim() || 'Picture',
        color: 'yellow', visibility: 'public', status: 'published' });
      await db.setPieceMedia(id, fields);
      toast('Picture added'); route();
    } catch (err) { msg.innerHTML = errorBox(err); btn.disabled = false; }
  };
  // Batch of quote cards: drop many pictures, post them all as quote cards (words already in the picture).
  { const drop = document.getElementById('bc-drop'), inp = document.getElementById('bc-files'), list = document.getElementById('bc-list');
    const postBtn = document.getElementById('bc-post'), clearBtn = document.getElementById('bc-clear'), opts = document.getElementById('bc-opts'), bmsg = document.getElementById('bc-msg');
    let files = [];
    const lines = new Map(); // file name -> full line, from a dropped list (.csv with columns #, Quote, File)
    const parseCsv = (t) => { const rows = []; let r = [], f = '', q = false;
      for (let i = 0; i < t.length; i++) { const c = t[i];
        if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
        else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; } else if (c === '\n') { r.push(f); rows.push(r); r = []; f = ''; } else if (c !== '\r') f += c; }
      if (f || r.length) { r.push(f); rows.push(r); } return rows; };
    const draw = () => {
      list.innerHTML = files.length ? `<ul class="admin-list">${files.map((x, i) => `<li><img class="thumb" src="${esc(x.url)}" alt=""><span class="what"><input data-bc="${i}" maxlength="400" value="${esc(x.line)}" aria-label="The line on card ${i + 1}" placeholder="The line on this card (optional)"><small>${esc(x.file.name)} · ${kb(x.file.size)}</small></span><button class="link danger" type="button" data-bc-rm="${i}">Remove</button></li>`).join('')}</ul>` : '';
      [postBtn, clearBtn, opts].forEach((el) => { el.hidden = !files.length; });
      postBtn.textContent = `Post all ${files.length} card${files.length === 1 ? '' : 's'}`;
      list.querySelectorAll('[data-bc]').forEach((el) => el.oninput = () => { files[Number(el.dataset.bc)].line = el.value; });
      list.querySelectorAll('[data-bc-rm]').forEach((el) => el.onclick = () => { files.splice(Number(el.dataset.bcRm), 1); draw(); });
    };
    const add = async (fl) => {
      for (const file of fl) if (/\.csv$/i.test(file.name)) { const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
        const h = rows[0].map((x) => x.trim().toLowerCase()), qi = h.indexOf('quote'), fi = h.indexOf('file');
        if (qi > -1 && fi > -1) rows.slice(1).forEach((r) => { if (r[fi]) lines.set(r[fi].trim(), r[qi].trim()); }); }
      for (const file of fl) if (/^image\//.test(file.type)) files.push({ file, url: URL.createObjectURL(file), line: '' });
      files.forEach((x) => { if (lines.has(x.file.name)) x.line = lines.get(x.file.name); });
      files.sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })); draw(); };
    inp.onchange = async () => { await add([...inp.files]); inp.value = ''; };
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => add([...e.dataTransfer.files]));
    clearBtn.onclick = () => { files = []; bmsg.textContent = ''; draw(); };
    postBtn.onclick = async () => {
      postBtn.disabled = clearBtn.disabled = true; let ok = 0; const bad = []; const left = [];
      for (let i = 0; i < files.length; i++) {
        const x = files[i]; bmsg.textContent = `Posting ${i + 1} of ${files.length}…`;
        try {
          const line = (x.line || '').trim(); // left blank when you haven't typed the words: file names never become captions
          const path = await db.uploadPhoto(x.file, 1600);
          const id = await db.createPiece({ kind: 'quote', body: line, said_by: '', source_slug: null, writeup: '', backdrop: 'aged', color: 'yellow', visibility: 'public', status: 'published' });
          await db.setPieceMedia(id, { photo_path: path, photo_has_text: true, photo_alt: line, featured: (ok === 0 && document.getElementById('bc-feat').checked) || undefined });
          ok++;
        } catch (err) { bad.push(`${x.file.name} (${err.message})`); left.push(x); }
      }
      files = left; draw(); postBtn.disabled = clearBtn.disabled = false;
      bmsg.innerHTML = `Posted ${ok} card${ok === 1 ? '' : 's'}.` + (bad.length ? ` These did not post and are still listed so you can try again: ${esc(bad.join('; '))}` : ' All done.');
      if (ok) toast(`Posted ${ok} quote cards`);
    };
  }
  // Import from the Writing Desk: a JSON file of finished pieces, posted as you after a preview.
  const diFile = document.getElementById('di-file'), diList = document.getElementById('di-list'), diMsg = document.getElementById('di-msg');
  const DI_KINDS = ['piece', 'poem', 'line', 'story', 'humor'];
  diFile.onchange = async () => {
    diList.innerHTML = ''; diMsg.textContent = '';
    const x = diFile.files[0]; if (!x) return;
    let data;
    try { data = JSON.parse(await x.text()); } catch { diMsg.textContent = 'That file is not a Writing Desk export.'; return; }
    if (data.format !== 'writing-desk-v1' || !Array.isArray(data.pieces)) { diMsg.textContent = 'That file is not a Writing Desk export.'; return; }
    const have = new Set(recent.map((p) => (p.title || '').trim().toLowerCase()).filter(Boolean));
    const byTitle = new Map(recent.map((p) => [(p.title || '').trim().toLowerCase(), p]));
    const items = data.pieces.map((p) => ({ kind: DI_KINDS.includes(p.kind) ? p.kind : 'piece', title: String(p.title || '').trim().slice(0, 140), body: String(p.body || '').trim().slice(0, 20000),
      color: String(p.color || 'yellow'), backdrop: 'aged', visibility: 'public', status: 'published', image_svg: cleanSvg(p.image_svg),
      from_title: String(p.from_title || '').trim().slice(0, 140), passage: String(p.passage || '').trim().slice(0, 6000) })).filter((p) => p.body);
    diList.innerHTML = `<ul class="admin-list">${items.map((p, i) => { const dup = p.title && have.has(p.title.toLowerCase()); const ex = dup ? byTitle.get(p.title.toLowerCase()) : null;
      const addImg = ex && p.image_svg && ex.image_svg !== p.image_svg;
      return `<li>
      <label class="check"><input type="checkbox" data-di="${i}" ${dup ? '' : 'checked'}> <span class="what">${p.image_svg ? `<img class="import-art" src="${esc(svgUri(p.image_svg))}" alt="">` : ''}${esc(plain(p.title) || excerpt(p.body, 60))}<small>${esc(KINDS[p.kind].name)} · ${esc(p.color)} · ${p.body.split(/\s+/).length} words${p.image_svg ? ' · with picture' : ''}${dup ? ' · already on the site, unticked' : ''}</small></span></label>
      ${addImg ? `<label class="check"><input type="checkbox" data-di-img="${i}" checked> <span class="what"><small>${ex.image_svg ? 'Replace' : 'Add'} the picture on the existing piece</small></span></label>` : ''}</li>`; }).join('')}</ul>
      <div class="actions"><button class="btn" type="button" id="di-post">Post ticked pieces</button></div>`;
    document.getElementById('di-post').onclick = async (e) => {
      const btn = e.currentTarget; const picks = [...diList.querySelectorAll('[data-di]:checked')].map((c) => items[Number(c.dataset.di)]);
      const imgPicks = [...diList.querySelectorAll('[data-di-img]:checked')].map((c) => items[Number(c.dataset.diImg)]);
      if (!picks.length && !imgPicks.length) { diMsg.textContent = 'Tick at least one piece.'; return; }
      btn.disabled = true; let ok = 0, bad = [];
      for (const p of picks) {
        try {
          const { image_svg, from_title, passage, ...fields } = p;
          const id = await db.createPiece(fields); ok++;
          if (passage) { try { await db.setPassage(id, { from_title, passage }); } catch (err) { bad.push(`${p.title || excerpt(p.body, 40)} passage (${err.message})`); } }
          if (image_svg) { try { await db.setPieceImage(id, image_svg); } catch (err) { bad.push(`${p.title || excerpt(p.body, 40)} picture (${err.message})`); } }
          diMsg.textContent = `Posted ${ok} of ${picks.length}…`;
        }
        catch (err) { bad.push(`${p.title || excerpt(p.body, 40)} (${err.message})`); }
      }
      let pics = 0;
      for (const p of imgPicks) {
        try { const ex = recent.find((r) => (r.title || '').trim().toLowerCase() === p.title.toLowerCase()); if (ex) { await db.setPieceImage(ex.id, p.image_svg); pics++; } }
        catch (err) { bad.push(`${p.title} picture (${err.message})`); }
      }
      diMsg.innerHTML = `Posted ${ok} of ${picks.length}.${pics ? ` Added ${pics} picture${pics === 1 ? '' : 's'} to pieces already on the site.` : ''}` + (bad.length ? ` These did not post: ${esc(bad.join('; '))}` : ' Mark them Published in the Writing Desk.');
      if (ok) toast(`${ok} posted`);
      btn.disabled = false;
    };
  };
  main.querySelectorAll('[data-feature]').forEach((b) => { b.onclick = async () => {
    const on = b.getAttribute('aria-pressed') !== 'true'; b.disabled = true;
    try { await db.setPieceMedia(b.dataset.feature, { featured: on }); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★ Featured' : 'Feature'; }
    catch (err) { toast(err.message); }
    b.disabled = false; }; });
  document.getElementById('pair-form').onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('pair-msg'), btn = e.currentTarget.querySelector('button[type=submit]');
    const side = async (k) => {
      const fl = document.getElementById('p' + k + '-file').files[0];
      if (fl) {
        const path = await db.uploadPhoto(fl, 1600);
        const t = fl.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 140) || 'Picture';
        const id = await db.createPiece({ kind: 'photo', title: t, body: t, color: 'yellow', visibility: 'public', status: 'published' });
        await db.setPieceMedia(id, { photo_path: path, photo_has_text: document.getElementById('p-text').checked, photo_alt: t });
        return id;
      }
      return document.getElementById('p' + k).value;
    };
    btn.disabled = true; msg.textContent = 'Working…';
    try {
      const a = await side('a'), b = await side('b');
      if (!a || !b) throw new Error('Choose or upload something for both sides.');
      if (a === b) throw new Error('Pick two different pieces.');
      await db.addPair(a, b); toast('Pair added'); route();
    } catch (err) { msg.textContent = err.message; btn.disabled = false; }
  };
  document.getElementById('pl-filter').oninput = (e) => { const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#piece-list li').forEach((li) => { li.hidden = !!q && !li.dataset.find.includes(q); }); };
  main.querySelectorAll('[data-del-piece]').forEach((b) => { b.onclick = async () => {
    if (!confirm('Delete this piece for good? Its comments, votes and any pairs using it go too.')) return;
    try { await db.deletePiece(b.dataset.delPiece); if (b.dataset.photo) await db.removePhotoFile(b.dataset.photo).catch(() => {}); toast('Deleted'); route(); }
    catch (err) { toast(err.message); } }; });
  main.querySelectorAll('[data-pair-toggle]').forEach((b) => { b.onclick = async () => {
    try { await db.setPairActive(Number(b.dataset.pairToggle), b.dataset.on !== 'true'); route(); } catch (err) { toast(err.message); } }; });
  main.querySelectorAll('[data-pair-del]').forEach((b) => { b.onclick = async () => {
    if (!confirm('Remove this pair and its votes?')) return;
    try { await db.removePair(Number(b.dataset.pairDel)); route(); } catch (err) { toast(err.message); } }; });
}

// ---------- admin: edit a piece (words, color, featured, photo with downsizer) ----------
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');
async function viewEdit(id) {
  if (!(await needProfile())) return;
  if (!(await db.isAdmin())) { main.innerHTML = `<p class="empty">Only site admins can edit pieces.</p>`; return; }
  const p = await db.getPiece(id);
  if (!p) { main.innerHTML = `<p class="empty">That piece isn't here.</p>`; return; }
  const [cs, srcs] = await Promise.all([db.colors(), db.sources()]);
  document.title = `Edit · The Yellow Pieces`;
  const k = KINDS[p.kind];
  const field = (id, lbl, val, { area = false, rows = 3, max = 140, hint = '' } = {}) => `<label for="${id}">${lbl}${hint ? ` <span class="opt">${hint}</span>` : ''}</label>
    ${area ? `<textarea id="${id}" rows="${rows}" maxlength="${max}">${esc(val)}</textarea>` : `<input id="${id}" maxlength="${max}" value="${esc(val)}">`}`;
  main.innerHTML = `<form id="edit" class="sheet paper stack">
    <p class="kicker">${esc(k.name)} · @${esc(p.author?.username)}</p>
    <h1 class="sheet-title">Edit</h1>
    <label for="e-kind">Section <span class="opt">(move it to a different page of the site)</span></label>
    <select id="e-kind">${Object.keys(KINDS).map((x) => `<option value="${esc(x)}" ${x === p.kind ? 'selected' : ''}>${esc(KINDS[x].name)}</option>`).join('')}</select>
    ${p.kind !== 'quote' ? field('e-title', 'Title', p.title, { hint: '(select a word, then tap Highlight)' }) + `<div class="fmt-bar"><button type="button" class="btn-ghost btn-small" data-hl="e-title" title="Highlight the selected word in the title"><mark class="hlw">Highlight</mark></button></div>` : ''}
    <div class="fmt-bar" role="toolbar" aria-label="Text formatting"><button type="button" class="btn-ghost btn-small" data-fmt="**" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button><button type="button" class="btn-ghost btn-small" data-fmt="*" title="Italic (Ctrl+I)" aria-label="Italic"><i>I</i></button><span class="hint">Select words, then tap B or I. Saved as **bold** and *italic*.</span></div>
    ${field('e-body', p.kind === 'quote' ? 'The line' : p.kind === 'photo' ? 'Caption' : p.kind === 'sketch' ? 'Where I\'m at now' : 'The words', p.body, { area: true, rows: p.kind === 'quote' || p.kind === 'photo' ? 3 : 14, max: p.kind === 'quote' ? 400 : 20000 })}
    ${p.kind === 'quote' ? `<div class="row"><div class="stack">${field('e-said', 'Who said it', p.said_by)}</div>
      <div class="stack"><label for="e-src">Where it came from</label><select id="e-src">${srcs.map((x) => `<option value="${esc(x.slug)}" ${x.slug === p.source_slug ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div>
      ${field('e-writeup', 'Why it stuck', p.writeup, { area: true, rows: 5, max: 3000 })}` : ''}
    ${p.kind === 'sketch' ? `${field('e-aim', 'What I\'m trying to do with this scene', p.aiming_for, { area: true, rows: 2, max: 1500 })}
      ${field('e-start', 'Where I started', p.started_at, { area: true, rows: 5, max: 3000 })}` : ''}
    ${p.kind === 'quote' || p.kind === 'line' ? `<fieldset class="stack" style="border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-top:14px">
      <legend class="label">From a longer piece <span class="opt">(optional: makes this line a teaser)</span></legend>
      ${field('e-from', 'From piece', p.from_title, { hint: '(its title, shown as “An excerpt from …”)' })}
      ${field('e-passage', 'The passage', p.passage, { area: true, rows: 7, max: 6000, hint: '(the paragraph or so around the line; blank lines split paragraphs; the line is highlighted automatically)' })}
      ${field('e-fullurl', 'Full piece link', p.from_piece_id ? location.origin + location.pathname + '#/p/' + p.from_piece_id : '', { max: 300, hint: '(paste its page address once it is posted; leave blank until then)' })}
    </fieldset>` : ''}
    ${colorPicker(cs, p.color)}
    <label class="check"><input type="checkbox" id="e-feat" ${p.featured ? 'checked' : ''}> Feature it on the homepage</label>

    <fieldset class="stack" style="border:1px solid var(--line);border-radius:var(--radius);padding:16px 18px;margin-top:14px">
      <legend class="label">Photo</legend>
      <div id="e-photo-now">${p.photo_path ? `<img src="${esc(db.photoUrl(p.photo_path))}" alt="" style="max-width:260px;border-radius:12px;display:block">` : '<p class="empty">No photo yet.</p>'}</div>
      <label for="e-file">${p.photo_path ? 'Replace with a new photo' : 'Add a photo'}</label>
      <input id="e-file" type="file" accept="image/*">
      <label for="e-size">Downsize to</label>
      <select id="e-size"><option value="1200">1200 px (smallest)</option><option value="1600" selected>1600 px (recommended)</option><option value="2048">2048 px (sharpest)</option></select>
      <p class="hint" id="e-size-info" aria-live="polite">Pick a photo to see how much the downsizer saves.</p>
      ${field('e-alt', 'Describe the picture', p.photo_alt, { max: 300, hint: '(for people using screen readers)' })}
      <label class="check"><input type="checkbox" id="e-text" ${p.photo_has_text ? 'checked' : ''}> The words are already in the picture (always shown whole, never cropped)</label>
      ${p.photo_path ? `<label class="check"><input type="checkbox" id="e-remove"> Remove the photo from this piece</label>` : ''}
      <label for="e-svg">${p.image_svg ? 'Replace the Writing Desk picture' : 'Add a Writing Desk picture'} <span class="opt">(an .svg file; shown as the tile and, faded, behind the text)</span></label>
      ${p.image_svg ? `<img class="import-art" src="${esc(svgUri(p.image_svg))}" alt="" style="width:88px;height:88px">` : ''}
      <input id="e-svg" type="file" accept=".svg,image/svg+xml">
      ${p.image_svg ? `<label class="check"><input type="checkbox" id="e-svg-remove"> Remove the Writing Desk picture</label>` : ''}
    </fieldset>

    <div class="actions"><button class="btn" type="submit">Save changes</button><a class="btn-ghost" href="#/p/${esc(p.id)}">Cancel</a></div>
    <div id="e-msg" aria-live="polite"></div>
  </form>`;

  const f = document.getElementById('edit');
  const val = (id) => (f.querySelector('#' + id)?.value ?? null);
  // Bold / Italic: wrap the selection in the textarea you last used (or unwrap if already wrapped).
  let lastTa = f.querySelector('#e-body');
  f.querySelectorAll('textarea').forEach((t) => t.addEventListener('focus', () => { lastTa = t; }));
  const wrap = (m) => wrapSel(lastTa, m);
  f.querySelectorAll('[data-hl]').forEach((b) => { b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => wrapSel(f.querySelector('#' + b.dataset.hl), '==')); });
  f.querySelectorAll('[data-fmt]').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()) || b.addEventListener('click', () => wrap(b.dataset.fmt)));
  f.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.target.tagName === 'TEXTAREA' && ['b', 'i'].includes(e.key.toLowerCase())) { e.preventDefault(); lastTa = e.target; wrap(e.key.toLowerCase() === 'b' ? '**' : '*'); } });
  let prepared = null; // { blob, width, height, origWidth, origHeight }
  const prep = async () => {
    const file = f.querySelector('#e-file').files[0];
    const info = document.getElementById('e-size-info');
    if (!file) { prepared = null; info.textContent = 'Pick a photo to see how much the downsizer saves.'; return; }
    info.textContent = 'Downsizing…';
    try {
      prepared = await db.resizePhoto(file, Number(val('e-size')));
      info.textContent = `Original ${prepared.origWidth}×${prepared.origHeight}, ${kb(file.size)} → stored ${prepared.width}×${prepared.height}, ${kb(prepared.blob.size)}.`;
      document.getElementById('e-photo-now').innerHTML = `<img src="${URL.createObjectURL(prepared.blob)}" alt="" style="max-width:260px;border-radius:12px;display:block"><p class="hint">New photo (not saved yet)</p>`;
    } catch (err) { prepared = null; info.textContent = 'That file couldn\'t be read as a picture. Try a JPG, PNG or WebP.'; }
  };
  f.querySelector('#e-file').addEventListener('change', prep);
  f.querySelector('#e-size').addEventListener('change', prep);

  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('e-msg');
    const btn = f.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = 'Saving…';
    try {
      const fields = { body: (val('e-body') || '').trim(), color: f.querySelector('input[name=color]:checked').value };
      if (!fields.body) throw new Error('The words can\'t be empty.');
      if (f.querySelector('#e-title')) fields.title = val('e-title').trim();
      if (p.kind === 'quote') Object.assign(fields, { said_by: val('e-said').trim(), source_slug: val('e-src'), writeup: val('e-writeup').trim() });
      if (p.kind === 'sketch') Object.assign(fields, { aiming_for: val('e-aim').trim(), started_at: val('e-start').trim() });
      await db.updatePiece(p.id, fields);
      if (f.querySelector('#e-from')) {
        const url = val('e-fullurl').trim();
        const m = url && url.match(/#\/p\/([0-9a-f-]{8,})/i);
        if (url && !m) throw new Error('That link doesn\'t look like a piece address (it should end in #/p/…).');
        await db.setPassage(p.id, { from_title: val('e-from').trim(), passage: val('e-passage').trim(), from_piece_id: m ? m[1] : null });
      }
      if (val('e-kind') && val('e-kind') !== p.kind) await db.setPieceKind(p.id, val('e-kind'));

      const media = { featured: f.querySelector('#e-feat').checked, photo_alt: val('e-alt').trim(), photo_has_text: f.querySelector('#e-text').checked };
      const removing = f.querySelector('#e-remove')?.checked;
      if (prepared) { msg.textContent = 'Uploading the photo…'; media.photo_path = await db.uploadBlob(prepared.blob); }
      else if (removing) media.photo_path = '';
      await db.setPieceMedia(p.id, media);
      const svgFile = f.querySelector('#e-svg').files[0];
      if (svgFile) { const clean = cleanSvg(await svgFile.text()); if (!clean) throw new Error('That does not look like a usable SVG file.'); await db.setPieceImage(p.id, clean); }
      else if (f.querySelector('#e-svg-remove')?.checked) await db.setPieceImage(p.id, '');
      if ((prepared || removing) && p.photo_path) await db.removePhotoFile(p.photo_path).catch(() => {});
      toast('Saved'); go('#/p/' + p.id);
    } catch (err) { msg.innerHTML = errorBox(err); btn.disabled = false; }
  };
}

// ---------- account + routing ----------
async function renderAccount() {
  const [user, prof] = [await db.currentUser(), await db.myProfile()];
  if (prof) accountEl.innerHTML = `${(await db.isAdmin()) ? '<a href="#/admin">Admin</a>' : ''}<a href="#/u/${esc(prof.username)}">@${esc(prof.username)}</a> <button class="link" id="signout">Sign out</button>`;
  else if (user) accountEl.innerHTML = `<a href="#/welcome">Finish signing up</a>`;
  else accountEl.innerHTML = `<a href="#/signin">Sign in</a>`;
  const so = document.getElementById('signout');
  if (so) so.onclick = async () => { await db.signOut(); renderAccount(); go('#/'); };
}

document.addEventListener('click', async (e) => {
  const open = e.target.closest('[data-rx-open]'), pick = e.target.closest('[data-rx]');
  document.querySelectorAll('.rx-pop:not([hidden])').forEach((pop) => {
    if (open && pop.parentElement === open.parentElement) return;
    pop.hidden = true; pop.parentElement.querySelector('.rx-btn')?.setAttribute('aria-expanded', 'false'); });
  if (open) { const pop = open.parentElement.querySelector('.rx-pop'); pop.hidden = !pop.hidden; open.setAttribute('aria-expanded', String(!pop.hidden)); return; }
  if (!pick) return;
  if (!(await needProfile())) return;
  const id = pick.dataset.rx, key = pick.dataset.rxKey, wrap = pick.closest('[data-rx-wrap]');
  const was = rxState.mine[id], next = was === key ? null : key;
  pick.disabled = true;
  try {
    await db.setReaction(id, next);
    const c = (rxState.counts[id] ||= {});
    if (was) c[was] = Math.max((c[was] || 1) - 1, 0);
    if (next) { c[next] = (c[next] || 0) + 1; rxState.mine[id] = next; } else delete rxState.mine[id];
    wrap.outerHTML = rxHtml(id);
  } catch (err) { toast(err.message); pick.disabled = false; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.rx-pop:not([hidden])').forEach((pop) => { pop.hidden = true; pop.parentElement.querySelector('.rx-btn')?.setAttribute('aria-expanded', 'false'); pop.parentElement.querySelector('.rx-btn')?.focus(); }); });

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-stuck]');
  if (!b) return;
  if (!(await needProfile())) return;
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.disabled = true;
  try {
    await db.setStuck(b.dataset.stuck, on);
    const n = b.querySelector('span');
    n.textContent = Number(n.textContent) + (on ? 1 : -1);
    b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on);
  } catch (err) { toast(err.message); }
  b.disabled = false;
});


// Optional visitor stats (Cloudflare Web Analytics). Off until a token is set in js/config.js.
if (ANALYTICS_TOKEN && !new URLSearchParams(location.search).has('demo')) {
  const a = document.createElement('script'); a.defer = true; a.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  a.dataset.cfBeacon = JSON.stringify({ token: ANALYTICS_TOKEN, spa: true }); document.head.appendChild(a);
}

async function route() {
  const [hashPath, anchor] = location.hash.slice(1).split('#');
  const path = (hashPath || '/').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  document.title = 'The Yellow Pieces';
  stopPickTimer();
  clearPieceBg();
  document.querySelectorAll('.cats [data-nav]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === (parts[0] || '')));
  main.setAttribute('aria-busy', 'true');
  try {
    if (!parts.length) await viewHome();
    else if (kindBySlug(parts[0]) && HIDDEN.has(kindBySlug(parts[0]))) { history.replaceState(null, '', location.pathname + '#/'); await viewHome(); }
    else if (kindBySlug(parts[0]) === 'sketch') viewSketches();
    else if (kindBySlug(parts[0])) await viewSection(kindBySlug(parts[0]));
    else if (parts[0] === 'p' && parts[1]) await viewPiece(decodeURIComponent(parts[1]));
    else if (parts[0] === 'passage' && parts[1]) await viewPassage(decodeURIComponent(parts[1]));
    else if (parts[0] === 'color' && parts[1]) await viewColor(decodeURIComponent(parts[1]));
    else if (parts[0] === 'share' && parts[1] && KINDS[parts[1]] && !HIDDEN.has(parts[1]) && !UNDER_CONSTRUCTION.has(parts[1])) await viewShare(parts[1]);
    else if (parts[0] === 'share') await viewShareChooser();
    else if (parts[0] === 'about') viewAbout();
    else if (parts[0] === 'privacy') viewPrivacy();
    else if (parts[0] === 'learn') viewLearn();
    else if (parts[0] === 'u' && parts[1]) await viewProfile(decodeURIComponent(parts[1]));
    else if (parts[0] === 'search') await viewSearch();
    else if (parts[0] === 'admin') await viewAdmin();
    else if (parts[0] === 'edit' && parts[1]) await viewEdit(decodeURIComponent(parts[1]));
    else if (parts[0] === 'signin') await viewSignIn();
    else if (parts[0] === 'welcome') await viewWelcome();
    else main.innerHTML = `<p class="empty">Page not found. <a href="#/">Go home</a></p>`;
  } catch (err) {
    console.error(err);
    main.innerHTML = errorBox(err);
  }
  main.removeAttribute('aria-busy');
  if (anchor) document.getElementById(anchor)?.scrollIntoView();
}

(async function start() {
  const mode = await db.init();
  if (mode === 'demo') {
    banner.hidden = false;
    banner.textContent = 'Demo mode: sample pieces, nothing is saved.';
  }
  const authErr = db.authErrorFromUrl();
  if (authErr) {
    banner.hidden = false;
    banner.textContent = `Sign-in link didn't work (${authErr}). Sign in again and type the emailed code instead.`;
    history.replaceState(null, '', location.pathname + '#/signin');
  } else if (new URLSearchParams(location.search).has('code')) {
    const signedIn = await db.currentUser();
    history.replaceState(null, '', location.pathname + (signedIn ? (location.hash || '#/') : '#/signin'));
    if (!signedIn) {
      banner.hidden = false;
      banner.textContent = 'That link opened in a different browser than the one you signed in from. Sign in here and type the emailed code instead.';
    }
  }
  db.onAuth(async () => {
    await renderAccount();
    const user = await db.currentUser();
    if (user && !(await db.myProfile()) && !location.hash.startsWith('#/welcome')) go('#/welcome');
  });
  const setTiles = (v) => {
    document.body.dataset.tiles = v;
    document.querySelectorAll('#tilepref [data-tiles]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tiles === v)));
    try { localStorage.setItem('yp-tiles', v); } catch {}
  };
  let tp = 'over'; try { tp = localStorage.getItem('yp-tiles') || 'over'; } catch {}
  setTiles(tp === 'beside' ? 'beside' : 'over');
  document.querySelectorAll('#tilepref [data-tiles]').forEach((b) => { b.onclick = () => setTiles(b.dataset.tiles); });
  await renderAccount();
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  await route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
