// Lecture des offres d'une page produit Cardmarket DÉJÀ filtrée (langue française + état Near Mint ou mieux).
// Travail sur le HTML brut, sans DOM, pour être utilisable dans le service worker de l'extension.
// Ne renvoie que des chiffres lus sur la page : aucun compte, aucun panier, aucune action.
function cmParse(html, opt) {
  const out = { n: 0, offers: [], htmlLen: html.length, rows: 0, blocked: false, empty: false, wrong: false };
  opt = opt || {};

  // Cloudflare / vérification anti-robot : on s'arrête net, on ne contourne rien.
  if (/cf-browser-verification|challenge-platform|__cf_chl|Just a moment\.\.\.|Attention Required! \| Cloudflare/i.test(html)) { out.blocked = true; return out; }
  if (/<title>[^<]*(?:Connexion|Login|Anmelden)[^<]*<\/title>/i.test(html) && !/article-row/.test(html)) { out.needLogin = true; return out; }

  // Vérifie qu'on est bien sur la fiche demandée (l'id produit doit apparaître dans la page).
  if (opt.idProduct && html.indexOf(String(opt.idProduct)) < 0) out.wrong = true;

  const txt = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&euro;/gi, '€').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
  // Prix européens : « 1.234,56 € » ou « 2,50 € ». On refuse ce qui n'a pas de décimale en centimes.
  const euro = s => { const m = /(\d{1,3}(?:[.\s  ]\d{3})*|\d+)[,.](\d{2})\s*(?:€|EUR\b)/.exec(String(s || '')); if (!m) return null;
    const v = parseFloat(m[1].replace(/[.\s  ]/g, '') + '.' + m[2]); return (v > 0 && v < 100000) ? v : null; };

  // Chaque offre est une ligne « article-row » ; on garde aussi une variante au cas où la classe change.
  const starts = [];
  let re = /class="[^"]*\barticle-row\b[^"]*"/g, m;
  while ((m = re.exec(html))) starts.push(m.index);
  if (!starts.length) { re = /id="articleRow\d+"/g; while ((m = re.exec(html))) starts.push(m.index); }
  out.rows = starts.length;

  if (!starts.length) {
    // Page lisible mais aucune offre ne correspond au filtre : cas normal pour une carte rare en français.
    if (/article-row|table-body|aucun article|no articles|keine Artikel/i.test(html) || /Products\b/.test(html)) out.empty = true;
    return out;
  }

  const offers = [];
  for (let i = 0; i < starts.length; i++) {
    const chunk = html.slice(starts[i], starts[i + 1] || Math.min(html.length, starts[i] + 9000));
    // Prix affiché en évidence dans la colonne de droite ; sinon, premier montant en euros de la ligne.
    let p = null;
    const pm = /class="[^"]*\bcolor-primary\b[^"]*"[^>]*>([\s\S]{0,120}?)</.exec(chunk);
    if (pm) p = euro(txt(pm[1]));
    if (p == null) { const pc = /price-container[\s\S]{0,400}?</.exec(chunk); if (pc) p = euro(txt(pc[0])); }
    if (p == null) p = euro(txt(chunk));
    if (p == null) continue;
    const sm = /\/Users\/([^"'\/?#]{2,40})/.exec(chunk);
    const cm2 = /article-condition[\s\S]{0,300}?>\s*([A-Z]{2})\s*</.exec(chunk) || /badge[^>]*>\s*(MT|NM|EX|GD|LP|PL|PO)\s*</.exec(chunk);
    // Pays du vendeur : utile car il change les frais de port (lu dans la colonne vendeur).
    const sellerBlock = (/col-seller[\s\S]{0,900}?(?=col-product|col-offer|$)/.exec(chunk) || [''])[0];
    const fm = /(?:data-bs-original-title|title|aria-label)="([^"]{3,30})"/.exec(sellerBlock);
    const am = /item-count[^>]*>\s*(\d{1,4})\s*</.exec(chunk);
    offers.push({ p, s: sm ? decodeURIComponent(sm[1]).slice(0, 24) : '', c: cm2 ? cm2[1] : '', f: fm ? fm[1].slice(0, 20) : '', q: am ? +am[1] : null });
  }
  if (!offers.length) { out.dbg = cmExcerpt(html); return out; }

  offers.sort((a, b) => a.p - b.p);
  // Garde-fous : une offre à 0,02 € masquant 20 € de port, ou une carte signée à 1 250 €, fausseraient la moyenne.
  const ps = offers.map(o => o.p), h = ps.length >> 1;
  const med = ps.length % 2 ? ps[h] : (ps[h - 1] + ps[h]) / 2;
  const keep = ps.length >= 3 ? offers.filter(o => o.p >= med * 0.25 && o.p <= med * 4) : offers.slice();
  if (!keep.length) { out.dbg = cmExcerpt(html); return out; }
  out.nAll = offers.length;
  out.dropped = offers.length - keep.length;
  const r2 = v => Math.round(v * 100) / 100;
  const top = keep.slice(0, Math.max(1, +opt.k || 5));
  out.n = keep.length;
  out.avg = r2(top.reduce((a, o) => a + o.p, 0) / top.length);      // moyenne des k offres les moins chères
  out.k = top.length;
  out.min = r2(keep[0].p);
  out.max = r2(keep[keep.length - 1].p);
  out.med = r2(med);
  out.offers = keep.slice(0, 12).map(o => ({ p: r2(o.p), s: o.s, c: o.c, f: o.f, q: o.q }));
  return out;
}
// Extrait de page renvoyé seulement quand la lecture échoue, pour pouvoir corriger la lecture.
function cmExcerpt(html) {
  const i = html.indexOf('€'); const j = i < 0 ? 0 : Math.max(0, i - 1200);
  return html.slice(j, j + 2400).replace(/\s+/g, ' ');
}
if (typeof self !== 'undefined') { self.cmParse = cmParse; self.cmExcerpt = cmExcerpt; }
if (typeof module !== 'undefined') module.exports = { cmParse, cmExcerpt };
