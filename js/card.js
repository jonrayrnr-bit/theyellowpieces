// Quote cards: the quote over a background, as HTML for the page and as a
// 1080x1350 PNG people can save and share (Instagram portrait size).
// The words are live text, so they rewrap to fit whatever frame they land in.

export const BACKDROPS = {
  aged:      { name: 'Aged paper', bg: ['#F6ECCF', '#E9D9AC'], ink: '#2E2618', soft: '#6E5F3E' },
  highlight: { name: 'Highlighter', bg: ['#FFF3A6', '#F8E06A'], ink: '#26221A', soft: '#5E5428' },
  parchment: { name: 'Parchment', bg: ['#EAD8B4', '#D2B98A'], ink: '#2F2416', soft: '#5F4C2E' },
  ink:       { name: 'Lemon Dusk', bg: ['#242A33', '#15181C'], ink: '#F4F0E6', soft: '#F2D24A' },
  dusk:      { name: 'Dusk', bg: ['#F7C873', '#B76E79'], ink: '#2A1B20', soft: '#4A2E35' },
};
const PHOTO_INK = { ink: '#F4F0E6', soft: '#E8D98A' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// photo: the photo's web address, when the quote sits over a photo.
export function quoteCardHtml(p, { large = false, photo = '' } = {}) {
  const b = BACKDROPS[p.backdrop] || BACKDROPS.aged;
  const long = (p.body || '').length > 140;
  return `<figure class="qcard ${photo ? 'photo' : ''} ${large ? 'qcard-lg' : ''} ${long ? 'qcard-long' : ''}" style="--qa:${b.bg[0]};--qb:${b.bg[1]};--qi:${b.ink};--qs:${b.soft}">
    ${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : ''}
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function quoteCardPng(p, { photo = '' } = {}) {
  const W = 1080, H = 1350, pad = 120;
  const b = photo ? { ...BACKDROPS.ink, ...PHOTO_INK } : (BACKDROPS[p.backdrop] || BACKDROPS.aged);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  try { await document.fonts.load('italic 60px "Newsreader"'); await document.fonts.load('700 30px "Instrument Sans"'); } catch {}

  let drewPhoto = false;
  if (photo) {
    try {
      const img = await loadImage(photo);
      const s = Math.max(W / img.width, H / img.height);
      const w = img.width * s, h = img.height * s;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(21,24,28,0.35)'); shade.addColorStop(1, 'rgba(21,24,28,0.75)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
      drewPhoto = true;
    } catch { /* fall back to the plain backdrop */ }
  }
  if (!drewPhoto) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, b.bg[0]); g.addColorStop(1, b.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // big opening quote mark
  ctx.fillStyle = b.soft; ctx.globalAlpha = 0.35;
  ctx.font = 'italic 300px "Newsreader", Georgia, serif';
  ctx.fillText('“', pad - 20, 330);
  ctx.globalAlpha = 1;

  // fit the quote: shrink until it fits the middle of the card
  let size = 72, lines;
  for (; size >= 34; size -= 4) {
    ctx.font = `italic ${size}px "Newsreader", Georgia, serif`;
    lines = wrap(ctx, p.body, W - pad * 2);
    if (lines.length * size * 1.35 < H - 560) break;
  }
  const lh = size * 1.35;
  let y = (H - lines.length * lh) / 2 + size * 0.2;
  ctx.fillStyle = b.ink; ctx.textBaseline = 'top';
  if (drewPhoto) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; }
  for (const line of lines) { ctx.fillText(line, pad, y); y += lh; }

  if (p.said_by) {
    ctx.font = '700 38px "Instrument Sans", Arial, sans-serif';
    ctx.fillStyle = b.soft;
    ctx.fillText('— ' + p.said_by, pad, y + 30);
  }
  ctx.shadowBlur = 0;
  // footer mark: a lemon highlighter swipe behind the site name
  ctx.font = '700 30px "Instrument Sans", Arial, sans-serif';
  const label = 'theyellowpieces.com';
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = '#F2D24A';
  ctx.fillRect(pad - 10, H - 150, lw + 20, 42);
  ctx.fillStyle = '#15181C';
  ctx.fillText(label, pad, H - 144);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}
