import * as db from './data.js';
import { BACKDROPS, quoteCardHtml, quoteCardPng } from './card.js';

const main = document.getElementById('main');
const accountEl = document.getElementById('account');
const banner = document.getElementById('banner');

// ---------- sections ----------
const KINDS = {
  quote:  { slug: 'quotes',   name: 'Quotes',     blurb: 'Lines from real life, and the story of why they stuck.', cta: 'Share a quote' },
  piece:  { slug: 'pieces',   name: 'Pieces',     blurb: 'Original lines, poems, lyrics and prose.', cta: 'Post a piece' },
  story:  { slug: 'stories',  name: 'Stories',    blurb: 'Words that changed something — short or long.', cta: 'Tell a story' },
  humor:  { slug: 'humor',    name: 'Humor',      blurb: 'The quips, one-liners and family stories that still make you laugh.', cta: 'Share something funny' },
  sketch: { slug: 'sketches', name: 'Sketches²',  blurb: '(sketches of sketches) Short scenes, shared for feedback.', cta: 'Share a sketch' },
  photo:  { slug: 'pictures', name: 'Pictures',   blurb: 'Favorite photos from the places in between.', cta: 'Add a picture' },
};
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
const excerpt = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s);
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
  return '';
}
const label = (p) => p.title || excerpt(p.body, 60);

// ---------- shared pieces ----------
function stuckBtn(p, on) {
  return `<button class="stuck ${on ? 'on' : ''}" data-stuck="${esc(p.id)}" aria-pressed="${on}" aria-label="This stuck with me">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg><span>${p.stuck_count}</span></button>`;
}
function card(p, stuck) {
  const k = KINDS[p.kind];
  let inner;
  if (p.kind === 'quote') {
    inner = `<a class="qlink" href="#/p/${esc(p.id)}" aria-label="Open quote">${p.photo_has_text ? `<div class="media-box">${photoHtml(p)}</div>` : quoteCardHtml(p, { photo: db.photoUrl(p.photo_path) })}</a>
      ${p.writeup ? `<p class="writeup-ex">${esc(excerpt(p.writeup, 140))}</p>` : ''}`;
  } else {
    inner = `${p.photo_path ? `<a href="#/p/${esc(p.id)}" tabindex="-1" aria-hidden="true"><div class="media-box ${p.kind === 'photo' ? '' : 'wide'}">${photoHtml(p)}</div></a>` : ''}
      <h3><a href="#/p/${esc(p.id)}">${esc(label(p))}</a></h3>
      ${p.kind === 'photo' ? (p.body ? `<p class="writeup-ex">${esc(excerpt(p.body, 140))}</p>` : '') : `<p class="body-ex">${esc(excerpt(p.body, 220))}</p>`}`;
  }
  return `<article class="card sheet-${esc(p.kind)}">
    ${inner}
    <footer>${stuckBtn(p, stuck.has(p.id))}
      <a class="replies" href="#/p/${esc(p.id)}#responses">${p.comment_count || 0} ${p.comment_count === 1 ? 'reply' : 'replies'}</a>
      <span class="meta">@${esc(p.author?.username)} · ${esc(k.name)}</span>
      <span class="dot dot-${esc(p.color)}" title="${esc(p.color)} highlight"></span></footer>
  </article>`;
}
async function cards(list, empty = 'Nothing here yet. Be the first.') {
  if (!list.length) return `<p class="empty">${esc(empty)}</p>`;
  const st = await db.myStuck(list.map((p) => p.id));
  return `<div class="grid">${list.map((p) => card(p, st)).join('')}</div>`;
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
      ${await cards(list, kind === 'photo' ? '' : 'Nothing here yet. Be the first.')}</section>`;
  };
  const tile = (p, big) => {
    const vis = visualHtml(p);
    const kicker = { quote: 'Quote', piece: 'Piece', story: 'Story', humor: 'Humor', sketch: 'Sketch', photo: 'Picture' }[p.kind];
    if (!vis) return `<a class="tile text ${big ? 'big' : ''}" href="#/p/${esc(p.id)}"><p class="kicker">${kicker}</p>
      <p class="lineq">${esc(excerpt(p.body, big ? 260 : 120))}</p><b>${esc(p.title || '')}</b>
      <span class="acts"><span>${p.stuck_count} stuck with it</span><span>${p.comment_count || 0} replies</span></span></a>`;
    const showPanel = !(p.kind === 'quote');
    return `<a class="tile ${big ? 'big' : ''}" href="#/p/${esc(p.id)}" aria-label="${esc(label(p))}">${vis}
      ${showPanel ? `<span class="panel"><span class="kicker">${kicker}</span><b>${esc(label(p))}</b>${p.title && p.kind !== 'photo' ? `<q>${esc(excerpt(p.body, big ? 140 : 80))}</q>` : ''}
        <span class="acts"><span>${p.stuck_count} stuck with it</span><span>${p.comment_count || 0} replies</span></span></span>` : ''}</a>`;
  };

  main.innerHTML = `<div class="home">
    ${pairList.length ? `<section class="pick" aria-labelledby="pick-h">
      <div class="pick-head"><h1 id="pick-h">Which one speaks to you?</h1>
        <p class="lede">Two yellow pieces, side by side. Pick one, then say why. What comes to mind?</p></div>
      <div id="pick"></div>
    </section>` : `<section class="pick"><div class="pick-head"><h1>Highlight the best words in your life.</h1>
      <p class="lede">Great lines, words of wisdom, and the stories behind them: the pieces worth passing down.</p></div></section>`}

    ${feat.length ? `<section aria-labelledby="feat-h"><div class="sec-head"><div><p class="kicker">Featured</p><h2 class="section-title" id="feat-h">Yellow pieces to start with</h2></div>
      <p class="sec-blurb">Lines and stories from J. Ray's journals. Read one, then take a side.</p></div>
      <div class="featured">${tile(feat[0], true)}${feat.length > 1 ? `<div class="featured-side">${feat.slice(1).map((p) => tile(p, false)).join('')}</div>` : ''}</div>
    </section>` : ''}

    ${trending.length ? `<section aria-labelledby="trend-h"><div class="sec-head"><div><p class="kicker">Trending</p><h2 class="section-title" id="trend-h">Join the conversation</h2></div>
      <p class="sec-blurb">See what's being said: the pieces drawing the most replies this week.</p></div>
      <ol class="trend">${trending.map((p, i) => `<li><a href="#/p/${esc(p.id)}">
        <span class="top"><span>${esc(KINDS[p.kind].name)}</span><span>#${i + 1}</span></span>
        <span class="line">${p.kind === 'quote' ? `“${esc(excerpt(p.body, 140))}”` : esc(p.title ? p.title + ' — ' + excerpt(p.body, 90) : excerpt(p.body, 140))}</span>
        <span class="by">@${esc(p.author?.username)}</span>
        <span class="counts"><span>${p.stuck_count} stuck with it</span><span>${p.comment_count || 0} ${p.comment_count === 1 ? 'reply' : 'replies'}</span></span></a></li>`).join('')}</ol>
    </section>` : ''}

    <section><div class="band"><div><h2>Your turn. What's a line you still carry?</h2>
      <p>A family motto, something a grandparent said, words that came in handy at a surprising time. Share it, and tell us who said it and why it stuck.</p></div>
      <div class="band-actions"><a class="btn-dark" href="#/share/quote">Share a quote</a><a class="btn-ghost" href="#/share/story">Share a story</a></div></div></section>

    ${await row('quote', 'Lines worth passing down')}
    ${await row('piece', 'Poems and prose')}
    ${await row('story', 'Words that changed something')}
    ${await row('photo', 'Pictures along the way')}
    ${await row('humor', 'Still makes us laugh')}
    ${await row('sketch', 'Sketches<sup>2</sup>, scenes in progress')}

    <section><div class="learn-teaser"><div><p class="kicker">Coming soon</p><h2 class="section-title">Learn to Write</h2>
      <p>Free writing lessons: pieces with worksheets, prompts and further reading, and the writer's own take, unlocked once enough readers weigh in.</p></div>
      <a class="btn-ghost" href="#/learn">Take a look →</a></div></section>
  </div>`;
  if (pairList.length) startPick(pairList);
}

// ---------- pick one ----------
function startPick(all) {
  const voted = db.myVotes();
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const queue = [...shuffle(all.filter((x) => !voted[x.id])), ...shuffle(all.filter((x) => voted[x.id]))];
  let i = 0, paused = false, elapsed = 0;
  const STEP = 100, LIMIT = 10000;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = document.getElementById('pick');

  const optHtml = (side, p) => `<button type="button" class="pair-opt" data-side="${side}" aria-pressed="false"
      aria-label="Choose ${side.toUpperCase()}: ${esc(p.photo_alt || label(p))}">${visualHtml(p, { tone: false }) || quoteCardHtml(p)}</button>`;

  async function show(pair, results) {
    stopPickTimer();
    const mine = db.myVotes()[pair.id];
    box.innerHTML = `
      <div class="pair ${mine ? 'voted' : ''}">${optHtml('a', pair.a)}${optHtml('b', pair.b)}<div class="pair-or" aria-hidden="true">or</div></div>
      ${mine && results ? (() => {
        const total = results.a + results.b || 1;
        const pct = (n) => Math.round((n / total) * 100);
        const one = (side, n) => `<div class="pair-result"><span>${pct(n)}% chose this${mine === side ? ' (you too)' : ''}</span>
          <span class="bar"><i style="width:${pct(n)}%"></i></span><small>${n} ${n === 1 ? 'vote' : 'votes'}</small></div>`;
        return `<div class="pair-results">${one('a', results.a)}${one('b', results.b)}</div>`;
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
  async function next() { i = (i + 1) % queue.length; const p = queue[i]; await show(p, db.myVotes()[p.id] ? await db.pairResults(p.id) : null); }
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
      <h1>${kind === 'sketch' ? 'Sketches<sup>2</sup>' : esc(k.name)}</h1>
      <p class="lede">${esc(k.blurb)}</p>
      <div class="head-row"><nav class="tabs" aria-label="Sort">${tab('new', 'Newest')}${tab('hot', 'Trending')}${tab('top', 'Most stuck')}</nav>
        <a class="btn" href="#/share/${kind}">${esc(k.cta)}</a></div>
    </header>
    ${await cards(list)}`;
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
  const [st, user, comments, hl, cs] = await Promise.all([db.myStuck([p.id]), db.currentUser(), db.comments(p.id), db.highlightsFor(p.id), db.colors()]);
  const mine = user && user.id === p.author_id;
  const k = KINDS[p.kind];
  document.title = `${p.title || excerpt(p.body, 40)} · The Yellow Pieces`;
  let content;
  if (p.kind === 'quote' && p.photo_has_text) {
    content = `<div class="hero-media"><div class="media-box">${photoHtml(p, { tone: false })}</div></div>
      ${p.source ? `<p class="from">Filed under <b>${esc(p.source.name)}</b></p>` : ''}
      ${p.writeup ? `<h2 class="sub">Why it stuck</h2><p class="prose">${esc(p.writeup)}</p>` : ''}`;
  } else if (p.kind === 'quote') {
    content = `${quoteCardHtml(p, { large: true, photo: db.photoUrl(p.photo_path) })}
      ${p.source ? `<p class="from">Filed under <b>${esc(p.source.name)}</b></p>` : ''}
      ${p.writeup ? `<h2 class="sub">Why it stuck</h2><p class="prose">${esc(p.writeup)}</p>` : ''}`;
  } else if (p.kind === 'sketch') {
    content = `<h1 class="sheet-title"><span class="hl hl-${esc(p.color)}">${esc(p.title)}</span></h1>
      ${p.aiming_for ? `<p class="aim"><b>What I'm going for:</b> ${esc(p.aiming_for)}</p>` : ''}
      <h2 class="sub">Where I'm at now</h2><pre class="scene">${esc(p.body)}</pre>
      ${p.started_at ? `<details><summary>Where I started</summary><pre class="scene">${esc(p.started_at)}</pre></details>` : ''}`;
  } else if (p.kind === 'photo') {
    content = `<div class="hero-media"><div class="media-box" style="aspect-ratio:auto"><img src="${esc(db.photoUrl(p.photo_path))}" alt="${esc(p.photo_alt)}" style="display:block;width:100%"></div></div>
      <h1 class="sheet-title">${esc(p.title)}</h1>${p.body ? `<p class="prose">${esc(p.body)}</p>` : ''}`;
  } else {
    content = `${p.photo_path ? `<div class="hero-media"><div class="media-box wide">${photoHtml(p, { tone: false })}</div></div>` : ''}
      ${p.title ? `<h1 class="sheet-title"><span class="hl hl-${esc(p.color)}">${esc(p.title)}</span></h1>` : ''}
      <div class="prose ${p.kind === 'piece' ? 'verse' : ''}">${esc(p.body)}</div>`;
  }
  main.innerHTML = `
    <article class="sheet paper">
      ${p.status === 'draft' ? `<p class="pill">Draft · only you can see this</p>` : ''}
      ${content}
      ${byline(p)}
      <div class="actions">
        ${stuckBtn(p, st.has(p.id))}
        ${p.kind === 'quote' && !p.photo_has_text ? `<button class="btn-ghost" data-download>Save as image</button>` : ''}
        <button class="btn-ghost" data-share>Share</button>
        ${mine && p.status === 'draft' ? `<button class="btn-ghost" data-publish>Publish</button>` : ''}
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

  main.querySelector('[data-share]').onclick = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: 'The Yellow Pieces', text: p.kind === 'quote' ? `“${p.body}”` : (p.title || ''), url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch {}
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
    <ul class="choices">${Object.entries(KINDS).filter(([kind]) => kind !== 'photo' || admin).map(([kind, k]) => `
      <li><a class="paper choice" href="${kind === 'photo' ? '#/admin' : '#/share/' + kind}"><b>${kind === 'sketch' ? 'Sketches<sup>2</sup>' : esc(k.name)}</b><span>${esc(k.blurb)}</span></a></li>`).join('')}
    </ul>`;
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
  } else {
    const ph = { piece: ['Margins', 'Every page I ever loved…'], story: ['The note in the toolbox', 'When my dad passed, I found…'], humor: ['Dinner rules, Southern edition', 'My aunt\'s only rule at Thanksgiving…'] }[kind];
    fields = `
      <label for="f-title">Title</label>
      <input id="f-title" ${kind === 'piece' ? '' : 'required'} maxlength="140" placeholder="${esc(ph[0])}">
      <label for="f-body">${kind === 'piece' ? 'Your piece' : kind === 'story' ? 'Your story' : 'The funny part'}</label>
      <textarea id="f-body" class="${kind === 'piece' ? 'verse-input' : ''}" required maxlength="20000" rows="${kind === 'humor' ? 5 : 10}" placeholder="${esc(ph[1])}"></textarea>`;
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

function viewLearn() {
  document.title = 'Learn to Write · The Yellow Pieces';
  main.innerHTML = `
    <article class="sheet paper prose-page">
      <p class="pill">Coming soon</p>
      <h1 class="sheet-title">Learn to Write</h1>
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
      <p>We emailed <b>${esc(email)}</b>. Type the code from the email here, or open the email's link in <b>this same browser</b>. (It can take a minute; check spam too.)</p>
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
  const recent = await db.feed({ sort: 'new', limit: 80, includePrivate: true });
  const pairList = await db.pairs({ includeInactive: true });
  const opt = (p) => `<option value="${esc(p.id)}">${esc(KINDS[p.kind].name)} · ${esc(excerpt(label(p), 60))}</option>`;
  const thumb = (p) => p.photo_path ? `<img class="thumb" src="${esc(db.photoUrl(p.photo_path))}" alt="">` : `<span class="thumb" aria-hidden="true"></span>`;
  main.innerHTML = `<div class="admin-grid">
    <header class="page-head"><h1>Site admin</h1><p class="lede">Add pictures, choose what's featured, and set up the pick-one pairs. Changes show on the site right away.</p></header>

    <form id="photo-form" class="paper stack">
      <h2 class="section-title">Add a picture</h2>
      <p class="hint">It's resized for the web (1600 px, WebP) before it's stored. Your full-size original stays on your computer.</p>
      <label for="ph-file">Photo</label><input id="ph-file" type="file" accept="image/*" required>
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

    <section class="paper"><h2 class="section-title">Featured</h2><p class="hint">The newest three featured pieces show on the homepage.</p>
      <ul class="admin-list">${recent.filter((p) => p.status === 'published').slice(0, 40).map((p) => `<li>${thumb(p)}
        <span class="what">${esc(excerpt(label(p), 80))}<small>${esc(KINDS[p.kind].name)} · @${esc(p.author?.username)}</small></span>
        <button class="btn-ghost btn-small" type="button" data-feature="${esc(p.id)}" aria-pressed="${!!p.featured}">${p.featured ? '★ Featured' : 'Feature'}</button></li>`).join('')}</ul></section>

    <section class="paper"><h2 class="section-title">Pick-one pairs</h2>
      <p class="hint">Pairs work best as a picture against a quote, or two quotes that pull different ways.</p>
      <form id="pair-form" class="row"><div class="stack"><label for="pa">Left</label><select id="pa">${recent.map(opt).join('')}</select></div>
        <div class="stack"><label for="pb">Right</label><select id="pb">${recent.map(opt).join('')}</select></div>
        <div class="actions"><button class="btn" type="submit">Add pair</button></div></form>
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
      const path = await db.uploadPhoto(x);
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
  main.querySelectorAll('[data-feature]').forEach((b) => { b.onclick = async () => {
    const on = b.getAttribute('aria-pressed') !== 'true'; b.disabled = true;
    try { await db.setPieceMedia(b.dataset.feature, { featured: on }); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★ Featured' : 'Feature'; }
    catch (err) { toast(err.message); }
    b.disabled = false; }; });
  document.getElementById('pair-form').onsubmit = async (e) => {
    e.preventDefault();
    const a = document.getElementById('pa').value, b = document.getElementById('pb').value;
    if (a === b) { toast('Pick two different pieces.'); return; }
    try { await db.addPair(a, b); toast('Pair added'); route(); } catch (err) { toast(err.message); }
  };
  main.querySelectorAll('[data-pair-toggle]').forEach((b) => { b.onclick = async () => {
    try { await db.setPairActive(Number(b.dataset.pairToggle), b.dataset.on !== 'true'); route(); } catch (err) { toast(err.message); } }; });
  main.querySelectorAll('[data-pair-del]').forEach((b) => { b.onclick = async () => {
    if (!confirm('Remove this pair and its votes?')) return;
    try { await db.removePair(Number(b.dataset.pairDel)); route(); } catch (err) { toast(err.message); } }; });
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

async function route() {
  const [hashPath, anchor] = location.hash.slice(1).split('#');
  const path = (hashPath || '/').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  document.title = 'The Yellow Pieces';
  stopPickTimer();
  document.querySelectorAll('.cats [data-nav]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === (parts[0] || '')));
  main.setAttribute('aria-busy', 'true');
  try {
    if (!parts.length) await viewHome();
    else if (kindBySlug(parts[0])) await viewSection(kindBySlug(parts[0]));
    else if (parts[0] === 'p' && parts[1]) await viewPiece(decodeURIComponent(parts[1]));
    else if (parts[0] === 'color' && parts[1]) await viewColor(decodeURIComponent(parts[1]));
    else if (parts[0] === 'share' && parts[1] && KINDS[parts[1]]) await viewShare(parts[1]);
    else if (parts[0] === 'share') await viewShareChooser();
    else if (parts[0] === 'about') viewAbout();
    else if (parts[0] === 'learn') viewLearn();
    else if (parts[0] === 'u' && parts[1]) await viewProfile(decodeURIComponent(parts[1]));
    else if (parts[0] === 'search') await viewSearch();
    else if (parts[0] === 'admin') await viewAdmin();
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
  await renderAccount();
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  await route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
