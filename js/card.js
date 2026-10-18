// Quote cards: the quote over a background, as HTML for the page and as a
// 1080x1350 PNG people can save and share (Instagram portrait size).

export const BACKDROPS = {
  aged:      { name: 'Aged paper', bg: ['#F6ECCF', '#E9D9AC'], ink: '#2E2618', soft: '#6E5F3E' },
  highlight: { name: 'Highlighter', bg: ['#FFF3A6', '#F8E06A'], ink: '#26221A', soft: '#5E5428' },
  parchment: { name: 'Parchment', bg: ['#EAD8B4', '#D2B98A'], ink: '#2F2416', soft: '#5F4C2E' },
  ink:       { name: 'Ink', bg: ['#25232B', '#141318'], ink: '#FFF3C4', soft: '#D9CD9C' },
  dusk:      { name: 'Dusk', bg: ['#F7C873', '#B76E79'], ink: '#2A1B20', soft: '#4A2E35' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function quoteCardHtml(p, { large = false } = {}) {
  const b = BACKDROPS[p.backdrop] || BACKDROPS.aged;
  const long = (p.body || '').length > 140;
  return `<figure class="qcard ${large ? 'qcard-lg' : ''} ${long ? 'qcard-long' : ''}" style="--qa:${b.bg[0]};--qb:${b.bg[1]};--qi:${b.ink};--qs:${b.soft}">
    <blockquote>${esc(p.body)}</blockquote>
    ${p.said_by ? `<figcaption>— ${esc(p.said_by)}</figcaption>` : ''}
  </figure>`;
}

function wrap(ctx, text, maxWidth) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export async function quoteCardPng(p) {
  const W = 1080, H = 1350, pad = 120;
  const b = BACKDROPS[p.backdrop] || BACKDROPS.aged;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  try { await document.fonts.load('italic 60px "Libre Caslon Text"'); await document.fonts.load('700 30px "Atkinson Hyperlegible"'); } catch {}

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, b.bg[0]); g.addColorStop(1, b.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft edge darkening, like an old page
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,40,0,0.18)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  // big opening quote mark
  ctx.fillStyle = b.soft; ctx.globalAlpha = 0.35;
  ctx.font = 'italic 300px "Libre Caslon Text", Georgia, serif';
  ctx.fillText('“', pad - 20, 330);
  ctx.globalAlpha = 1;

  // fit the quote: shrink until it fits the middle of the card
  let size = 72, lines;
  for (; size >= 34; size -= 4) {
    ctx.font = `italic ${size}px "Libre Caslon Text", Georgia, serif`;
    lines = wrap(ctx, p.body, W - pad * 2);
    if (lines.length * size * 1.35 < H - 560) break;
  }
  const lh = size * 1.35;
  let y = (H - lines.length * lh) / 2 + size * 0.2;
  ctx.fillStyle = b.ink; ctx.textBaseline = 'top';
  for (const line of lines) { ctx.fillText(line, pad, y); y += lh; }

  if (p.said_by) {
    ctx.font = '700 38px "Atkinson Hyperlegible", Arial, sans-serif';
    ctx.fillStyle = b.soft;
    ctx.fillText('— ' + p.said_by, pad, y + 30);
  }
  // footer mark: a highlighter swipe behind the site name
  ctx.font = '700 30px "Atkinson Hyperlegible", Arial, sans-serif';
  const label = 'theyellowpieces.com';
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(245, 213, 71, 0.85)';
  ctx.fillRect(pad - 10, H - 150, lw + 20, 42);
  ctx.fillStyle = '#26221A';
  ctx.fillText(label, pad, H - 144);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}
