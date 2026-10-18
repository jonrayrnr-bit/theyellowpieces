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
const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
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

// ---------- shared pieces ----------
function stuckBtn(p, on) {
  return `<button class="stuck ${on ? 'on' : ''}" data-stuck="${esc(p.id)}" aria-pressed="${on}" aria-label="This stuck with me">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16l-7-4-7 4z"/></svg><span>${p.stuck_count}</span></button>`;
}
function card(p, stuck) {
  const k = KINDS[p.kind];
  let inner;
  if (p.kind === 'quote') {
    inner = `<a class="qlink" href="#/p/${esc(p.id)}" aria-label="Open quote">${quoteCardHtml(p)}</a>
      ${p.writeup ? `<p class="writeup-ex">${esc(excerpt(p.writeup, 140))}</p>` : ''}`;
  } else {
    inner = `<h3><a class="hl hl-${esc(p.color)}" href="#/p/${esc(p.id)}">${esc(p.title || excerpt(p.body, 50))}</a></h3>
      <p class="body-ex">${esc(excerpt(p.body, 260))}</p>`;
  }
  return `<article class="card sheet-${esc(p.kind)}">
    ${inner}
    <footer>${stuckBtn(p, stuck.has(p.id))}
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
async function viewHome() {
  const [quotes, latest] = await Promise.all([db.feed({ kind: 'quote', sort: 'hot', limit: 7 }), db.feed({ sort: 'new', limit: 40 })]);
  const top = quotes[0];
  const of = (kind, n) => latest.filter((p) => p.kind === kind).slice(0, n);
  main.innerHTML = `
    <section class="hero">
      <div>
        <h1>Highlight the <span class="hl hl-yellow">best words</span> in your life.</h1>
        <p class="lede">Great lines, words of wisdom, and the stories behind them — the pieces worth passing down.</p>
        <p class="hero-actions"><a class="btn" href="#/share/quote">Share a quote</a> <a class="btn-ghost" href="#/about">What's a yellow piece?</a></p>
      </div>
      ${top ? `<div class="today"><p class="eyebrow">Today's Yellow Piece</p>
        <a class="qlink" href="#/p/${esc(top.id)}">${quoteCardHtml(top, { large: true })}</a>
        <p class="meta">shared by @${esc(top.author?.username)}${top.source ? ` · ${esc(top.source.name)}` : ''}</p></div>` : ''}
    </section>
    ${await colorStrip()}
    <section><div class="sec-head"><h2 class="section-title">Quotes</h2><a href="#/quotes">See all</a></div>${await cards(quotes.slice(1, 7))}</section>
    <section><div class="sec-head"><h2 class="section-title">Stories</h2><a href="#/stories">See all</a></div>${await cards(of('story', 3))}</section>
    <section><div class="sec-head"><h2 class="section-title">Pieces</h2><a href="#/pieces">See all</a></div>${await cards(of('piece', 3))}</section>
    <section><div class="sec-head"><h2 class="section-title">Humor</h2><a href="#/humor">See all</a></div>${await cards(of('humor', 3))}</section>
    <section><div class="sec-head"><h2 class="section-title">Sketches<sup>2</sup></h2><a href="#/sketches">See all</a></div>${await cards(of('sketch', 3))}</section>
    <section class="learn-teaser">
      <h2 class="section-title">Learn to Write</h2>
      <p>Free writing lessons are coming: pieces with worksheets, prompts and further reading — and the writer's own take, unlocked once enough readers weigh in.</p>
      <a class="btn-ghost" href="#/learn">Take a look</a>
    </section>`;
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
  if (p.kind === 'quote') {
    content = `${quoteCardHtml(p, { large: true })}
      ${p.source ? `<p class="from">Filed under <b>${esc(p.source.name)}</b></p>` : ''}
      ${p.writeup ? `<h2 class="sub">Why it stuck</h2><p class="prose">${esc(p.writeup)}</p>` : ''}`;
  } else if (p.kind === 'sketch') {
    content = `<h1 class="sheet-title"><span class="hl hl-${esc(p.color)}">${esc(p.title)}</span></h1>
      ${p.aiming_for ? `<p class="aim"><b>What I'm going for:</b> ${esc(p.aiming_for)}</p>` : ''}
      <h2 class="sub">Where I'm at now</h2><pre class="scene">${esc(p.body)}</pre>
      ${p.started_at ? `<details><summary>Where I started</summary><pre class="scene">${esc(p.started_at)}</pre></details>` : ''}`;
  } else {
    content = `${p.title ? `<h1 class="sheet-title"><span class="hl hl-${esc(p.color)}">${esc(p.title)}</span></h1>` : ''}
      <div class="prose ${p.kind === 'piece' ? 'verse' : ''}">${esc(p.body)}</div>`;
  }
  main.innerHTML = `
    <article class="sheet paper">
      ${p.status === 'draft' ? `<p class="pill">Draft · only you can see this</p>` : ''}
      ${content}
      ${byline(p)}
      <div class="actions">
        ${stuckBtn(p, st.has(p.id))}
        ${p.kind === 'quote' ? `<button class="btn-ghost" data-download>Save as image</button>` : ''}
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
    <section class="comments">
      <h2 class="section-title">${p.kind === 'sketch' ? 'Notes for the writer' : 'Responses'}</h2>
      ${comments.length ? `<ul class="comment-list">${comments.map((c) => `
        <li><p class="meta"><a href="#/u/${esc(c.author?.username)}">@${esc(c.author?.username)}</a> · ${ago(c.created_at)}
          ${user && user.id === c.author_id ? `<button class="link danger" data-del-comment="${c.id}">delete</button>` : ''}</p>
          <p>${esc(c.body)}</p></li>`).join('')}</ul>` : `<p class="empty">No responses yet.</p>`}
      ${user ? `<form id="comment-form" class="stack">
          <label for="comment-body">${p.kind === 'sketch' ? 'Leave a note' : 'Add a response'}</label>
          <textarea id="comment-body" required maxlength="3000" rows="3" placeholder="${p.kind === 'sketch' ? 'What worked, what didn\'t ring true…' : 'Me too — my family always said…'}"></textarea>
          <button class="btn" type="submit">Post</button></form>`
        : `<p><a href="#/signin">Sign in</a> to respond.</p>`}
    </section>`;

  main.querySelector('[data-share]').onclick = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: 'The Yellow Pieces', text: p.kind === 'quote' ? `“${p.body}”` : (p.title || ''), url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch {}
  };
  const dl = main.querySelector('[data-download]');
  if (dl) dl.onclick = async () => {
    const blob = await quoteCardPng(p);
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
  main.innerHTML = `
    <header class="page-head"><h1>Share a yellow piece</h1><p class="lede">What would you like to pass along?</p></header>
    <ul class="choices">${Object.entries(KINDS).map(([kind, k]) => `
      <li><a class="paper choice" href="#/share/${kind}"><b>${kind === 'sketch' ? 'Sketches<sup>2</sup>' : esc(k.name)}</b><span>${esc(k.blurb)}</span></a></li>`).join('')}
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

// ---------- account + routing ----------
async function renderAccount() {
  const [user, prof] = [await db.currentUser(), await db.myProfile()];
  if (prof) accountEl.innerHTML = `<a href="#/u/${esc(prof.username)}">@${esc(prof.username)}</a> <button class="link" id="signout">Sign out</button>`;
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
  const path = (location.hash.slice(1) || '/').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  document.title = 'The Yellow Pieces';
  document.querySelectorAll('.nav [data-nav]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.nav === parts[0]));
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
    else if (parts[0] === 'signin') await viewSignIn();
    else if (parts[0] === 'welcome') await viewWelcome();
    else main.innerHTML = `<p class="empty">Page not found. <a href="#/">Go home</a></p>`;
  } catch (err) {
    console.error(err);
    main.innerHTML = errorBox(err);
  }
  main.removeAttribute('aria-busy');
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
