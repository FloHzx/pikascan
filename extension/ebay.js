// Lecture des prix des ventes terminées d'une page de résultats eBay.fr (HTML brut, sans DOM : utilisable dans le service worker).
function ebayParse(html) {
  const out = { n: 0, items: [], htmlLen: html.length, blocks: 0, blocked: false };
  const hasList = /\b(?:s-item|s-card)\b/.test(html);
  if (!hasList && /captcha|Pardon Our Interruption|splashui\/challenge|n.êtes pas un robot/i.test(html)) { out.blocked = true; return out; }
  const starts = [], re = /<li[^>]+class="[^"]*\b(?:s-item|s-card)\b[^"]*"/g; let m;
  while ((m = re.exec(html))) starts.push(m.index);
  out.blocks = starts.length;
  const text = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
  const items = [];
  for (let i = 0; i < starts.length; i++) {
    const chunk = html.slice(starts[i], starts[i + 1] || starts[i] + 8000);
    const tm = chunk.match(/(?:s-item__title|s-card__title)[^>]*>([\s\S]*?)<\/(?:div|h3)>/), title = tm ? text(tm[1]) : '';
    if (/shop on ebay|découvrez|explorez/i.test(title)) continue;
    const pm = chunk.match(/(?:s-item__price|s-card__price)[^>]*>([\s\S]*?)<\/span>/); if (!pm) continue;
    const pt = text(pm[1]); if (/\bà\b|\bto\b/i.test(pt)) continue;                       // fourchette de prix : ignorée
    if (!/EUR|€/i.test(pt)) continue;                                                      // autre devise : ignorée
    const nm = pt.match(/(\d{1,3}(?:[\s. ]\d{3})+|\d+)(?:,(\d{1,2}))?/); if (!nm) continue;
    const p = parseFloat(nm[1].replace(/[\s. ]/g, '') + '.' + (nm[2] || '0').padEnd(2, '0'));
    if (!(p > 0 && p < 100000)) continue;
    const sold = /\bVendu\b|vendu le/i.test(chunk), dm = chunk.match(/Vendu(?:e)?\s+le\s+([^<]{3,24})/i);
    items.push({ p, t: title.replace(/^Nouvelle annonce\s*/i, '').slice(0, 90), d: dm ? text(dm[1]) : '', sold });
  }
  const sold = items.filter(x => x.sold), use = sold.length ? sold : items;
  const list = use.slice(0, 60); if (!list.length) return out;
  const srt = list.map(x => x.p).sort((a, b) => a - b), q = f => srt[Math.min(srt.length - 1, Math.floor(f * (srt.length - 1) + 0.5))], med = q(0.5);
  const keep = srt.length >= 4 ? list.filter(x => x.p >= med * 0.4 && x.p <= med * 2.5) : list, ks = keep.map(x => x.p), r2 = v => Math.round(v * 100) / 100;
  out.n = keep.length; out.dropped = list.length - keep.length;
  const ss = ks.slice().sort((a, b) => a - b); out.median = r2(ss.length % 2 ? ss[(ss.length - 1) / 2] : (ss[ss.length / 2 - 1] + ss[ss.length / 2]) / 2);
  out.mean = r2(ks.reduce((a, b) => a + b, 0) / ks.length); out.min = r2(ss[0]); out.max = r2(ss[ss.length - 1]);
  out.items = keep.slice(0, 6).map(x => ({ p: x.p, t: x.t, d: x.d }));
  return out;
}
if (typeof self !== 'undefined') self.ebayParse = ebayParse;
if (typeof module !== 'undefined') module.exports = { ebayParse };
