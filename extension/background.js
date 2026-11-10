// PikaScan – Envoyer l'annonce. Au clic sur l'icône, sur une page d'annonce Vinted que TU consultes :
//  1. lit titre, prix et adresses des photos dans la page ;
//  2. télécharge les photos (l'extension a le droit de lire les images de Vinted, contrairement à un simple favori) ;
//  3. les transmet à PikaScan, qui lit les cartes visuellement et affiche le verdict.
// Rien n'est envoyé ailleurs que vers PikaScan (adresse ci-dessous).
importScripts('ebay.js', 'cardmarket.js');
const APP = 'https://flohzx.github.io/pikascan/';

function extract() {
  const d = document, q = x => d.querySelector(x), imgs = []; let title = '', price = '', desc = '', postedAt = '', postedSrc = '';
  const bodyText = (d.body && d.body.innerText) || '';
  d.querySelectorAll('script[type="application/ld+json"]').forEach(sc => { try {
    const j = JSON.parse(sc.textContent); (Array.isArray(j) ? j : [j]).forEach(o => {
      if (o && /Product/.test(JSON.stringify(o['@type'] || ''))) {
        title = title || o.name || ''; desc = desc.length > String(o.description || '').length ? desc : String(o.description || '');
        let of = o.offers; if (Array.isArray(of)) of = of[0];
        if (of && of.price != null && (!of.priceCurrency || of.priceCurrency === 'EUR')) price = price || String(of.price);
        let im = o.image; if (typeof im === 'string') im = [im]; if (Array.isArray(im)) im.forEach(u => imgs.push(typeof u === 'string' ? u : (u && u.url)));
        const dp = o.datePublished || o.uploadDate || o.dateCreated; if (dp && !isNaN(new Date(dp))) { postedAt = new Date(dp).toISOString(); postedSrc = 'page'; }
      } }); } catch (e) {} });
  const mt = p => { const e = q('meta[property="' + p + '"]') || q('meta[name="' + p + '"]'); return e && e.content; };
  title = title || mt('og:title') || ((q('h1') || {}).innerText) || d.title; if (mt('og:image')) imgs.push(mt('og:image'));
  price = price || mt('product:price:amount') || mt('og:price:amount') || '';
  if (!price) { const x = /(\d{1,4}(?:[.,]\d{1,2})?)\s*€/.exec(bodyText.slice(0, 4000)); if (x) price = x[1]; }
  /* description : on garde la version la plus complète (le balisage tronque parfois) */
  const dom = q('[itemprop="description"]') || q('[data-testid*="description"]'); const dt = dom ? (dom.innerText || '').trim() : '';
  const og = mt('og:description') || mt('description') || '';
  [dt, og].forEach(t => { if (t && t.length > desc.length) desc = t; });
  /* date de mise en ligne : données de la page, sinon texte « Ajouté … », sinon horodatage inscrit dans le nom des photos */
  let html = ''; try { html = d.documentElement.innerHTML; } catch (e) {}
  if (!postedAt) { const m = /"(?:created_at_ts|created_at|upload_date|uploaded_at|published_at)"\s*:\s*"(\d{4}-\d\d-\d\d[T ][^"]{4,40})"/.exec(html); if (m && !isNaN(new Date(m[1]))) { postedAt = new Date(m[1]).toISOString(); postedSrc = 'page'; } }
  if (!postedAt) { const m = /"(?:created_at_ts|created_at|upload_date|uploaded_at|published_at)"\s*:\s*"?(1[5-9]\d{8})"?/.exec(html); if (m) { postedAt = new Date(+m[1] * 1000).toISOString(); postedSrc = 'page'; } }
  const pm = /(?:Ajouté|Mis en ligne|Publié|Posté)\s*(?:le|il y a)?\s*:?\s*\n?\s*([^\n]{2,40})/i.exec(bodyText); const postedText = pm ? pm[0].replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  /* photos de l'annonce : toutes celles de la galerie (y compris les miniatures pas encore chargées), sans mélanger avec les autres articles du vendeur */
  const srcOf = i => { let u = i.currentSrc || i.src || i.getAttribute('data-src') || i.getAttribute('data-lazy-src') || ''; if (!u) { const ss = i.getAttribute('srcset') || i.getAttribute('data-srcset') || ''; const last = ss.split(',').map(x => x.trim().split(/\s+/)[0]).filter(Boolean).pop(); if (last) u = last; } return u; };
  let pageImgs = 0;
  const notPhoto = i => { try { return !!i.closest('a[href*="/member/"], a[href*="/members/"], a[href*="/users/"], [data-testid*="avatar" i], [class*="avatar" i], [data-testid*="profile" i], [data-testid*="seller" i], [data-testid*="user" i], [class*="user-photo" i], header, nav, footer'); } catch (e) { return false; } };
  d.querySelectorAll('img').forEach(i => { const u = srcOf(i); if (u && /vinted/.test(u) && !/avatar|\/users?\/|portrait|\/assets\/|logo|icon/.test(u) && !notPhoto(i) && (/\/t\//.test(u) || (i.naturalWidth || 0) >= 150)) { imgs.push(u); pageImgs++; } });
  const sizeOf = u => { const p = u.split('?')[0], m = /\/(?:f|c)?(\d{3,4})(?:x\d+)?\//.exec(p); return m ? +m[1] : (/\/tc?\/[^\/]+\/[^\/]+\.(?:jpe?g|png|webp)$/i.test(p) ? 3000 : 0); };
  const keyOf = u => { const p = u.split('?')[0], m = /\/tc?\/([^\/]+)\/(?:(?:f\d+|\d+x\d+)\/)?([^\/]+)$/.exec(p); return m ? m[1] + '/' + m[2] : p.replace(/\/(?:f\d+|\d+x\d+)\//, '/'); };
  const tsOf = u => { const m = /\/(1[3-9]\d{8})\.(?:jpe?g|png|webp)/.exec(u); return m ? +m[1] : 0; };
  const best = {}, order = [];
  imgs.forEach(u => { if (!u || typeof u !== 'string') return; const k = keyOf(u); if (!best[k]) { best[k] = u; order.push(k); } else if (sizeOf(u) > sizeOf(best[k])) best[k] = u; });
  let list = order.map(k => best[k]), src = 'dom';
  /* source la plus fiable : le tableau « photos » des données de la page, celui qui contient la photo principale de CETTE annonce */
  try {
    const h2 = html.replace(/\\+u002F/gi, '/').replace(/\\+\//g, '/').replace(/\\+"/g, '"'), ogk = keyOf(mt('og:image') || '') || (list.length ? keyOf(list[0]) : ''), re = /"photos"\s*:\s*\[/g, arrays = []; let m;
    while ((m = re.exec(h2))) { let i = m.index + m[0].length, depth = 1, j = i; for (; j < h2.length && depth > 0 && j - i < 300000; j++) { const ch = h2[j]; if (ch === '[') depth++; else if (ch === ']') depth--; }
      const urls = [...h2.slice(i, j - 1).matchAll(/https:\/\/images\d*\.vinted\.net\/[^"'\s\\<>]+/g)].map(x => x[0]); if (urls.length) arrays.push(urls); }
    const mine = arrays.filter(a => ogk && a.some(u => keyOf(u) === ogk)).sort((a, b) => b.length - a.length)[0];
    if (mine) { const bj = {}, oj = []; mine.forEach(u => { const k = keyOf(u); if (!bj[k]) { bj[k] = u; oj.push(k); } else if (sizeOf(u) > sizeOf(bj[k])) bj[k] = u; }); const jl = oj.map(k => bj[k]); if (jl.length >= list.length || jl.length > 4) { list = jl; src = 'json'; } }
  } catch (e) {}
  /* les photos d'une même annonce sont envoyées à quelques minutes d'écart : on écarte celles des autres articles (horodatage dans le nom du fichier) */
  const refTs = tsOf(mt('og:image') || '') || (list.length ? tsOf(list[0]) : 0);
  let dropped = 0; if (refTs && src === 'dom') { const withTs = list.filter(u => tsOf(u)).length; const keep = list.filter(u => { const t = tsOf(u); return t ? Math.abs(t - refTs) <= 1800 : withTs < 2; }); dropped = list.length - keep.length; if (keep.length) list = keep; }
  const seen = {};
  if (!postedAt && !postedText) { for (const u of list) { const m = /\/(1[3-9]\d{8})\.(?:jpe?g|png|webp)/.exec(u); if (m && +m[1] * 1000 < Date.now()) { postedAt = new Date(+m[1] * 1000).toISOString(); postedSrc = 'photo'; break; } } }
  /* frais lus sur la page (protection acheteurs, livraison) : repérage simple, à vérifier */
  const money = r => { const m = r.exec(bodyText); return m ? parseFloat(m[1].replace(',', '.')) : null; };
  const fee = money(/Protection acheteurs?[^\d\n]{0,40}(\d+[.,]\d{2})\s*€/i), shipping = money(/(?:Livraison|Frais de port|Envoi)[^\d\n]{0,40}(\d+[.,]\d{2})\s*€/i);
  return { title: String(title || '').slice(0, 200), price: String(price || ''), url: location.href.split('?')[0], urls: list.slice(0, 24), desc: String(desc || '').slice(0, 4000), postedAt, postedSrc, postedText, fee, shipping, pageImgs, dropped, src };
}
// Annonce Leboncoin : les données de la page (bloc __NEXT_DATA__) donnent titre, prix, description, date et TOUTES les photos.
function extractLbc() {
  const d = document; let ad = null;
  try { const nd = JSON.parse((d.getElementById('__NEXT_DATA__') || {}).textContent || '{}'); const pp = (nd.props && nd.props.pageProps) || {}; ad = pp.ad || pp.adview || null; } catch (e) {}
  const mt = p => { const e = d.querySelector('meta[property="' + p + '"]') || d.querySelector('meta[name="' + p + '"]'); return e && e.content; };
  let title = '', price = '', desc = '', postedAt = '', imgs = [], src = 'dom';
  if (ad) {
    src = 'json'; title = ad.subject || ''; desc = ad.body || '';
    const pr = Array.isArray(ad.price) ? ad.price[0] : (ad.price_cents != null ? ad.price_cents / 100 : ad.price); if (pr != null && isFinite(+pr)) price = String(pr);
    const im = ad.images || {}; imgs = (im.urls_large && im.urls_large.length ? im.urls_large : (im.urls || [])).slice(); if (!imgs.length && im.thumb_url) imgs = [im.thumb_url];
    const dp = ad.first_publication_date || ad.index_date; if (dp) { const t = new Date(String(dp).replace(' ', 'T')); if (!isNaN(t)) postedAt = t.toISOString(); }
  }
  title = title || mt('og:title') || ((d.querySelector('h1') || {}).innerText) || d.title;
  desc = desc || mt('og:description') || mt('description') || '';
  const bodyText = (d.body && d.body.innerText) || '';
  if (!price) { const x = /(\d[\d\s ]{0,6}(?:[.,]\d{1,2})?)\s*€/.exec(bodyText.slice(0, 5000)); if (x) price = x[1].replace(/[\s ]/g, ''); }
  if (!imgs.length) {   // repli : photos visibles de la galerie, jamais celles du profil du vendeur ni des annonces similaires
    const bad = i => { try { return !!i.closest('a[href*="/profile"], a[href*="/boutique"], a[href*="/pro/"], [data-qa-id*="profile" i], [data-test-id*="profile" i], [class*="avatar" i], [data-qa-id*="similar" i], aside, header, footer, nav'); } catch (e) { return false; } };
    if (mt('og:image')) imgs.push(mt('og:image'));
    d.querySelectorAll('img').forEach(i => { const u = i.currentSrc || i.src || ''; if (/img\.leboncoin\.fr/.test(u) && !bad(i) && ((i.naturalWidth || 0) >= 150 || /rule=ad-/.test(u))) imgs.push(u); });
  }
  const seen = {}, list = [];
  imgs.forEach(u => { if (!u || typeof u !== 'string') return; const k = u.split('?')[0]; if (!seen[k]) { seen[k] = 1; list.push(u); } });
  return { title: String(title || '').slice(0, 200), price: String(price || ''), url: location.href.split('?')[0], urls: list.slice(0, 24), desc: String(desc || '').slice(0, 4000), postedAt, postedSrc: postedAt ? 'page' : '', postedText: '', fee: null, shipping: null, pageImgs: list.length, dropped: 0, src };
}
const isLbc = u => /^https:\/\/(www\.)?leboncoin\.fr\//.test(String(u || ''));
function b64(buf) { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
const wait = ms => new Promise(r => setTimeout(r, ms));

async function sendFromTab(tab) {
  const badge = (t, c) => { try { chrome.action.setBadgeText({ text: t, tabId: tab.id }); if (c) chrome.action.setBadgeBackgroundColor({ color: c }); } catch (e) {} };
  try {
    badge('…', '#888');
    const lbc = isLbc(tab.url);
    const [{ result: info }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: lbc ? extractLbc : extract });
    const dataUrls = [];
    for (const u of info.urls) {
      try { let r = null;
        if (lbc && /\?rule=/.test(u) && !/rule=ad-large/.test(u)) { try { const r1 = await fetch(u.replace(/rule=[^&]+/, 'rule=ad-large'), { credentials: 'omit' }); if (r1.ok) r = r1; } catch (e) {} }   // la grande version d'abord
        if (!r) r = await fetch(u, { credentials: 'omit' }); if (!r.ok) continue; const buf = await r.arrayBuffer(); const t = (r.headers.get('content-type') || 'image/jpeg').split(';')[0]; if (!/^image\/(jpeg|png|webp)$/.test(t) || buf.byteLength > 8e6) continue; dataUrls.push('data:' + t + ';base64,' + b64(buf)); } catch (e) {}
    }
    const payload = { type: 'pikascan-annonce', ext: true, site: lbc ? 'leboncoin' : 'vinted', url: info.url, title: info.title, price: info.price, desc: info.desc, postedAt: info.postedAt, postedSrc: info.postedSrc, postedText: info.postedText, fee: info.fee, shipping: info.shipping, dataUrls, extVer: chrome.runtime.getManifest().version, dbg: { found: info.urls.length, pageImgs: info.pageImgs, dropped: info.dropped, src: info.src } };
    let [app] = await chrome.tabs.query({ url: APP + '*' }), fresh = false;
    if (app) { await chrome.tabs.update(app.id, { active: true }); await chrome.windows.update(app.windowId, { focused: true }); }
    else { app = await chrome.tabs.create({ url: APP + '#annonce' }); fresh = true; }
    for (let i = 0; i < 60; i++) { const t = await chrome.tabs.get(app.id); if (t.status === 'complete') break; await wait(500); }
    if (fresh) await wait(1500);
    await chrome.scripting.executeScript({ target: { tabId: app.id }, args: [payload], func: p => { window.postMessage(p, location.origin); } });
    badge(dataUrls.length ? String(dataUrls.length) : '0', dataUrls.length ? '#2a9d3a' : '#c0392b');
    setTimeout(() => badge(''), 6000);
  } catch (e) { console.error(e); badge('!', '#c0392b'); }
}
self.sendFromTab = sendFromTab;
chrome.action.onClicked.addListener(tab => { sendFromTab(tab); });

// Prix des ventes eBay terminées : PikaScan (page ouverte) demande, l'extension charge la page de résultats eBay.fr dans TON navigateur
// (une seule page par demande, uniquement quand tu cliques) et ne renvoie à PikaScan que les prix lus.
chrome.runtime.onMessage.addListener((m, sender, send) => {
  if (!m || m.type !== 'ebay') return;
  if (!sender.tab || !String(sender.tab.url || '').startsWith(APP)) { send({ error: 'origine' }); return; }
  const q = String(m.q || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (!q) { send({ error: 'requête vide' }); return; }
  (async () => {
    try {
      const url = 'https://www.ebay.fr/sch/i.html?_nkw=' + encodeURIComponent(q) + '&LH_Sold=1&LH_Complete=1&_sop=13&_ipg=60';
      const r = await fetch(url, { credentials: 'include', headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' } });
      if (!r.ok) { send({ error: 'eBay a répondu ' + r.status }); return; }
      const res = ebayParse(await r.text(), { name: String(m.name || '').slice(0, 80), num: String(m.num || '').slice(0, 12) }); res.q = q; res.url = url; send(res);
    } catch (e) { send({ error: String(e && e.message || e) }); }
  })();
  return true;
});

// Offres Cardmarket filtrées « français + Near Mint ou mieux » : PikaScan (page ouverte) demande, l'extension
// charge UNE page produit dans TON navigateur, une à la fois et espacées, puis ne renvoie que les prix lus.
let cmLast = 0, cmChain = Promise.resolve();
chrome.runtime.onMessage.addListener((m, sender, send) => {
  if (!m || m.type !== 'cardmarket') return;
  if (!sender.tab || !String(sender.tab.url || '').startsWith(APP)) { send({ error: 'origine' }); return; }
  const id = String(m.idProduct || '').replace(/\D/g, '').slice(0, 12);
  if (!id) { send({ error: 'carte sans identifiant Cardmarket' }); return; }
  const k = Math.min(10, Math.max(1, +m.k || 5));
  cmChain = cmChain.then(async () => {
    try {
      const gap = 1500 - (Date.now() - cmLast); if (gap > 0) await wait(gap);     // une page à la fois, espacée
      cmLast = Date.now();
      const url = 'https://www.cardmarket.com/fr/Pokemon/Products?idProduct=' + id + '&language=2&minCondition=2';
      const hdr = { credentials: 'include', headers: { 'Accept-Language': 'fr-FR,fr;q=0.9' } };
      const hasF = u => /[?&]language=2(?:&|$)/.test(u || '') && /[?&]minCondition=2(?:&|$)/.test(u || '');
      let r = await fetch(url, hdr);
      // la redirection vers l'adresse « avec nom » peut perdre les filtres : on les remet pour ne lire QUE français + NM+
      if (r.ok && r.url && !hasF(r.url)) { const x = new URL(r.url); x.searchParams.set('language', '2'); x.searchParams.set('minCondition', '2'); r = await fetch(x.toString(), hdr); }
      const html = await r.text();
      if (!r.ok) { send({ error: 'Cardmarket a répondu ' + r.status, status: r.status, finalUrl: r.url || url, htmlLen: html.length, head: html.slice(0, 300).replace(/\s+/g, ' ') }); return; }
      const res = cmParse(html, { idProduct: id, k });
      res.url = url; res.finalUrl = r.url || url; res.idProduct = id; res.status = r.status; res.filtered = hasF(r.url || url); send(res);
    } catch (e) { send({ error: String(e && e.message || e) }); }
  });
  return true;
});
