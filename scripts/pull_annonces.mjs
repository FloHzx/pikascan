// Récupère les annonces trouvées par ton service de surveillance Apify, reconnaît la carte, calcule le verdict
// (mêmes règles que l'onglet Flux de PikaScan) et ne garde que les annonces intéressantes dans data/annonces.json.
// Variables : APIFY_TOKEN (secret) + APIFY_TASK (id de tâche) ou APIFY_DATASET.
// Options   : MODE=good (défaut : seulement les bons plans) | all (tout garder), TARGET_MARGIN (30), MIN_MARGIN_EUR (2),
//             MAX_PRICE, DEFAULT_SHIP (3), HAIRCUT (10), FEE_PCT (5), SHIP_OUT (1.5), NTFY_TOPIC (notification push gratuite via l'appli ntfy).
// Photos    : PHOTOS=off pour ne lire que les titres ; MAX_PHOTOS (3) photos par annonce ; MAX_ANALYSES (12) annonces lues par passage.
//             Les photos sont lues par le scanner « Par l'image » de PikaScan (Chromium sans écran, voir photo_engine.mjs).
import fs from 'node:fs';
import { startEngine } from './photo_engine.mjs';
const { APIFY_TOKEN, APIFY_TASK, APIFY_DATASET, NTFY_TOPIC } = process.env;
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? +process.env[k] : d);
const BASE = process.env.APIFY_BASE || 'https://api.apify.com', TCD = process.env.TCGDEX_BASE || 'https://api.tcgdex.net/v2/';
const FILE = 'data/annonces.json', KEEP = env('KEEP', 300), MAXP = env('MAX_PRICE', null), DSHIP = env('DEFAULT_SHIP', 3);
const MODE = process.env.MODE === 'all' ? 'all' : 'good';
const ST = { haircut: env('HAIRCUT', 10), feePct: env('FEE_PCT', 5), shipOut: env('SHIP_OUT', 1.5), targetMargin: env('TARGET_MARGIN', 30) }, MIN_EUR = env('MIN_MARGIN_EUR', 2);
if (!APIFY_TOKEN || !(APIFY_TASK || APIFY_DATASET)) { console.log('APIFY_TOKEN et APIFY_TASK (ou APIFY_DATASET) non renseignés : rien à faire.'); process.exit(0); }

/* ---------- lecture des annonces Apify ---------- */
const num = v => { if (v == null) return null; if (typeof v === 'object') v = v.amount ?? v.value ?? v.price; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const cur = it => (it.currency || it.currency_code || (it.price && it.price.currency_code) || 'EUR').toString().toUpperCase();
function pick(it) {
  const url = it.url || it.link || (it.path ? 'https://www.vinted.fr' + it.path : '');
  const idm = /\/items\/(\d+)/.exec(url);
  const id = String(it.id ?? it.itemId ?? (idm && idm[1]) ?? '');
  const title = String(it.title ?? it.name ?? '').trim(), ask = num(it.price);
  if (!id || !title || ask == null || cur(it) !== 'EUR') return null;
  const total = num(it.total_item_price ?? it.totalItemPrice);
  const ship = total != null && total > ask && total - ask < 20 ? Math.round((total - ask) * 100) / 100 : DSHIP;
  const urls = [it.photo_url, it.photo && (it.photo.full_size_url || it.photo.url), ...(Array.isArray(it.photo_urls) ? it.photo_urls : []), ...(Array.isArray(it.photos) ? it.photos.map(x => (x && (x.full_size_url || x.url)) || x) : [])].filter(u => typeof u === 'string' && /^https?:\/\//.test(u));
  const photos = [...new Set(urls)].slice(0, 6), photo = photos[0] || '';
  const t = new Date(it.created_at || it.published_at || it.extraction_datetime || Date.now());
  const desc = String(it.description || it.desc || '').replace(/\r/g, '').trim().slice(0, 3000);
  return { id, title, ask, shipIn: ship, url, photo, photos, desc, t: isNaN(t) ? new Date().toISOString() : t.toISOString() };
}

/* ---------- reconnaissance de la carte (TCGdex) ---------- */
const jget = async u => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) return null; } catch (e) {} await new Promise(r => setTimeout(r, 400 * (k + 1))); } return null; };
const NOISE = /\b(carte|cartes|pok[eé]mon|pokemon|neuve?s?|tbe|tr[eè]s bon [eé]tat|[eé]tat|nm|mint|fr|vf|fran[cç]aise?|anglaise?|lot|holo|brillante?|collection|vinted|vends?|vente)\b/gi;
function query(title) {
  let t = ' ' + title + ' ', n = null, total = null, m = /(\d{1,3})\s*\/\s*(\d{1,3})/.exec(t);
  if (m) { n = String(parseInt(m[1], 10)); total = parseInt(m[2], 10); t = t.replace(m[0], ' '); }
  else { m = /\b((?:swsh|svp|sv|smp|sm|xy|bw|tg|gg)\s?-?\d{1,3})\b/i.exec(t); if (m) { n = m[1].toLowerCase().replace(/[\s-]/g, ''); t = t.replace(m[0], ' '); } }
  return { name: t.replace(NOISE, ' ').replace(/[()\[\],.!]/g, ' ').replace(/\s+/g, ' ').trim(), num: n, total };
}
const nz = s => String(s).toLowerCase().replace(/^0+(?=\d)/, '');
const setCache = new Map();
const officialOf = async sid => { if (!setCache.has(sid)) { const s = await jget(TCD + 'fr/sets/' + encodeURIComponent(sid)); setCache.set(sid, s && s.cardCount ? s.cardCount.official : null); } return setCache.get(sid); };
const idCache = new Map();
async function identify(title) {
  const q = query(title); if (!q.name || !q.num) return null;           // sans numéro on ne tranche pas : trop ambigu
  const key = q.name + '|' + q.num + '|' + q.total; if (idCache.has(key)) return idCache.get(key);
  const w = q.name.split(' '), tries = [...new Set([q.name, w.slice(0, 3).join(' '), w.slice(0, 2).join(' '), w[0]])].filter(Boolean);
  let found = [];
  for (const t of tries) {
    const hy = t.replace(/\s+(ex|gx|vmax|vstar|v|break|lv\.x|prime|star)\b/ig, '-$1');
    const qs = [...new Set([t, hy])];
    const got = (await Promise.all(qs.flatMap(x => ['fr', 'en'].map(l => jget(TCD + l + '/cards?name=' + encodeURIComponent(x)))))).flat().filter(Boolean);
    const seen = new Set(); found = got.filter(c => c && !seen.has(c.id) && seen.add(c.id) && nz(c.localId) === nz(q.num));
    if (found.length) break;
  }
  let res = null;
  if (found.length) {
    if (q.total) { const ok = []; for (const c of found.slice(0, 8)) { const sid = c.id.slice(0, c.id.lastIndexOf('-')); if ((await officialOf(sid)) === q.total) ok.push(c); } found = ok; }
    if (found.length === 1) res = found[0].id;
  }
  idCache.set(key, res); return res;
}

/* ---------- verdict (mêmes règles que PikaScan) ---------- */
function prices(cm) {
  if (!cm) return [];
  const out = [], mk = (sfx) => { const g = k => { const v = cm[k + sfx]; return v == null || v === 0 ? null : v; }; const trend = g('trend'), base = trend != null ? trend : g('avg'); if (base == null) return; const rel = (a, b) => (a > 0 && b > 0) ? (a - b) / b * 100 : null; out.push({ marketPrice: base, avg7: g('avg7'), mom7: rel(base, g('avg7')), mom30: rel(base, g('avg30')) }); };
  mk(''); mk('-holo'); return out;
}
const refPrice = p => (p.marketPrice != null && p.avg7 > 0 && p.marketPrice > 1.5 * p.avg7) ? p.avg7 : p.marketPrice;
function verdict(mkt, ask, shipIn) {
  const sellGross = mkt * (1 - ST.haircut / 100), fee = sellGross * ST.feePct / 100, net = sellGross - fee - ST.shipOut, cost = ask + shipIn, margin = net - cost;
  return { marketEur: mkt, margin, marginPct: cost > 0 ? margin / cost * 100 : null, maxBuy: net / (1 + ST.targetMargin / 100) - shipIn };
}
const cardInfo = new Map();
async function cardOf(id) {
  if (!cardInfo.has(id)) {
    const d = await jget(TCD + 'fr/cards/' + encodeURIComponent(id)); let r = null;
    if (d) { const ps = prices(d.pricing && d.pricing.cardmarket), pr = ps[0]; r = { id, name: d.name, ed: d.set && d.set.name || '', number: d.localId, img: d.image ? d.image + '/low.webp' : '', price: pr ? refPrice(pr) : null, weak: pr ? ((pr.mom7 != null && pr.mom7 <= -15) || (pr.mom30 != null && pr.mom30 <= -15)) : false }; }
    cardInfo.set(id, r);
  }
  return cardInfo.get(id);
}
const isGood = (v, weak) => v.marginPct != null && v.marginPct >= ST.targetMargin && v.margin >= MIN_EUR && (!weak || process.env.ALLOW_FALLING === '1');
const MIN_CARD = env('MIN_CARD_EUR', 0.3);      // sous ce prix, une carte compte pour 0 (cartes de base)
const LOT_RE = /\b(lot|lots|collection|bundle|classeur|binder|\d{2,4}\s*cartes|x\s?\d{2,4})\b/i;
const MAXPH = env('MAX_PHOTOS', 3), MAXAN = env('MAX_ANALYSES', 12), PHOTOS_ON = process.env.PHOTOS !== 'off';

/* ---------- lecture des photos (scanner par l'image de PikaScan) ---------- */
let engine = null, analysed = 0;
async function readPhotos(p) {
  if (!engine) { console.log('Démarrage du lecteur de photos…'); engine = await startEngine({ root: process.env.ENGINE_ROOT || process.cwd(), textAssist: process.env.TEXT_ASSIST !== '0', log: m => console.log('  [page]', m) }); }
  const cells = new Map(); let lost = 0, nph = 0;
  for (const u of p.photos.slice(0, MAXPH)) {
    try {
      const r0 = await fetch(u); if (!r0.ok) continue; const buf = Buffer.from(await r0.arrayBuffer());
      const r = await engine.readPhoto(buf, /\.png/i.test(u) ? 'p.png' : 'p.jpg'); nph++;
      for (const c of r.cells) { if (c.conf !== 'sure' && c.conf !== 'probable') continue; const o = cells.get(c.id); if (!o) cells.set(c.id, { ...c }); else { o.qty = Math.max(o.qty, c.qty); if (c.s1 > o.s1) { o.s1 = c.s1; o.conf = c.conf; } } }   // même carte sur plusieurs photos : on ne compte pas deux fois
      lost = Math.max(lost, r.lost || 0);
    } catch (e) { console.log('  photo illisible :', String(e.message || e).slice(0, 100)); }
  }
  return { cells: [...cells.values()], lost, nph };
}
const nrm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');
const nameInTitle = (name, title) => { const w = nrm(name).split(' ').filter(x => x.length >= 4); return !!w.length && w.some(x => nrm(title).includes(x)); };

/* ---------- décision : titre + photos -> annonce intéressante ou non ---------- */
async function evaluate(p) {
  const T = await identify(p.title), tc = T ? await cardOf(T) : null;
  let ph = { cells: [], lost: 0, nph: 0 };
  if (T && tc && tc.price != null) {                                    // filtre rapide : si le titre seul est déjà hors de prix, inutile de lire la photo
    const v0 = verdict(tc.price, p.ask, p.shipIn);
    if (v0.marginPct != null && v0.marginPct < ST.targetMargin * 0.5 && !LOT_RE.test(p.title)) return { why: `${tc.name} : prix trop élevé (marge ${v0.margin.toFixed(2)} €)`, v: v0 };
  }
  if (PHOTOS_ON && p.photos.length && analysed < MAXAN) { analysed++; ph = await readPhotos(p); }
  const ok = ph.cells, nCards = ok.reduce((a, c) => a + c.qty, 0), lotLike = LOT_RE.test(p.title) || nCards >= 2;
  if (!lotLike) {
    /* carte seule */
    let id = T, how = 'titre';
    if (ok.length) {
      const top = ok.slice().sort((a, b) => b.s1 - a.s1)[0], match = T && ok.some(c => c.id === T || (c.alt || []).includes(T));
      if (T && match) how = 'titre + photo concordent';
      else if (T && top.conf === 'sure' && top.s1 >= 0.85 && top.id !== T) { const o = await cardOf(top.id); if (!o || !tc || o.name !== tc.name) return { why: `la photo (${top.name}) contredit le titre (${tc ? tc.name : T})` }; how = 'titre (photo : autre impression)'; }
      else if (T) how = 'titre (photo non concluante)';
      else if ((top.conf === 'sure' && top.s1 >= 0.85) || nameInTitle(top.name, p.title)) { id = top.id; how = 'photo'; }
      else return { why: 'photo : carte peu sûre et titre sans numéro' };
    } else if (!T) return { why: ph.nph ? 'photo : aucune carte reconnue' : 'carte non reconnue' };
    else how = ph.nph ? 'titre (photo non concluante)' : 'titre';
    const c = await cardOf(id); if (!c) return { why: 'fiche introuvable' }; if (c.price == null) return { why: 'pas de prix', name: c.name };
    const v = verdict(c.price, p.ask, p.shipIn), good = isGood(v, c.weak);
    return { cardId: id, name: c.name, v, good, weak: c.weak, how, note: `Auto (${how}) : marge ${v.margin >= 0 ? '+' : ''}${v.margin.toFixed(2)} € (${v.marginPct == null ? '—' : v.marginPct.toFixed(0)} %), valeur ${v.marketEur.toFixed(2)} €` };
  }
  /* lot : somme des cartes reconnues (les autres comptent pour 0) */
  const list = ok.map(c => ({ id: c.id, q: c.qty })); if (T && !list.some(c => c.id === T)) list.push({ id: T, q: 1 });
  const cards = []; let value = 0, counted = 0;
  for (const c of list.slice(0, 40)) { const d = await cardOf(c.id); if (!d) continue; const p1 = d.price != null && d.price >= MIN_CARD ? d.price : 0; value += p1 * c.q; if (p1) counted += c.q; cards.push({ id: c.id, name: d.name, ed: d.ed, number: d.number, img: d.img, q: c.q, p: p1 }); }
  if (!cards.length) return { why: 'lot : aucune carte reconnue sur la photo' };
  cards.sort((a, b) => b.p * b.q - a.p * a.q);
  const v = verdict(value, p.ask, p.shipIn), good = isGood(v, false) && counted >= 1, cost = p.ask + p.shipIn;
  const nTot = cards.reduce((a, c) => a + c.q, 0);
  return { lot: { cards, value: Math.round(value * 100) / 100, n: nTot, lost: ph.lost }, cardId: cards[0].id, name: `Lot : ${nTot} cartes reconnues`, v, good, weak: false,
    note: `Lot (photo) : ${nTot} carte${nTot > 1 ? 's' : ''} reconnue${nTot > 1 ? 's' : ''} ≈ ${value.toFixed(2)} €, marge ${v.margin >= 0 ? '+' : ''}${v.margin.toFixed(2)} €${ph.lost ? ` · ${ph.lost} non lue${ph.lost > 1 ? 's' : ''} (comptée${ph.lost > 1 ? 's' : ''} 0 €)` : ''}. À vérifier sur les photos.${value > 8 * cost ? ' ⚠ Valeur très supérieure au prix : méfie-toi (fausses cartes, photos d’écran, cartes non officielles).' : ''}` };
}

/* ---------- boucle principale ---------- */
const path = APIFY_TASK ? `/v2/actor-tasks/${encodeURIComponent(APIFY_TASK)}/runs/last/dataset/items` : `/v2/datasets/${encodeURIComponent(APIFY_DATASET)}/items`;
const r = await fetch(`${BASE}${path}?clean=true&format=json&limit=200`, { headers: { Authorization: 'Bearer ' + APIFY_TOKEN } });
if (!r.ok) { console.error('Apify a répondu', r.status); process.exit(1); }
const raw = await r.json();
let old = { items: [], seen: [] }; try { old = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
const have = new Map((Array.isArray(old) ? old : old.items || []).map(x => [String(x.id), x]));
const seen = new Set((old.seen || []).map(String));
if (process.argv.includes('--count')) {   // mode « y a-t-il du nouveau ? » : permet au workflow de n'installer le lecteur de photos que si nécessaire
  const n = (Array.isArray(raw) ? raw : []).map(pick).filter(p => p && !have.has(p.id) && !seen.has(p.id) && (MAXP == null || p.ask <= MAXP)).length;
  console.log('nouvelles annonces à lire :', n); if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `new=${n}\n`); process.exit(0);
}
let added = 0, skipped = 0, looked = 0; const pushes = [];
try {
  for (const it of Array.isArray(raw) ? raw : []) {
    const p = pick(it); if (!p || have.has(p.id) || seen.has(p.id)) continue;
    if (MAXP != null && p.ask > MAXP) { seen.add(p.id); continue; }
    if (++looked > 40) break;
    const { photos, ...rec } = p; rec.photos = photos.slice(0, 4);
    if (MODE === 'all') { have.set(p.id, rec); added++; seen.add(p.id); continue; }
    let e; try { e = await evaluate(p); } catch (err) { console.log('  erreur :', String(err.message || err).slice(0, 120)); continue; }   // on retentera au prochain passage
    seen.add(p.id);
    console.log(`${e.good ? '✔' : '✘'} ${p.title.slice(0, 50)} — ${p.ask} €` + (e.good || e.v ? ` | ${e.lot ? 'lot ' + e.lot.n + ' cartes, ' : ''}valeur ${e.v.marketEur.toFixed(2)} €, marge ${e.v.margin.toFixed(2)} €${e.weak ? ', marché en baisse' : ''}${e.how ? ' [' + e.how + ']' : ''}` : ` | ${e.why}`));
    if (!e.good) { skipped++; continue; }
    have.set(p.id, Object.assign(rec, { cardId: e.cardId, note: e.note }, e.lot ? { lot: e.lot } : {})); added++;
    pushes.push({ p, e });
  }
} finally { if (engine) await engine.close(); }
const items = [...have.values()].sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, KEEP);
const out = JSON.stringify({ items, seen: [...seen].slice(-3000) }, null, 1) + '\n';
let prev = ''; try { prev = fs.readFileSync(FILE, 'utf8'); } catch (e) {}
if (out !== prev) { fs.mkdirSync('data', { recursive: true }); fs.writeFileSync(FILE, out); }
console.log(`${added} annonce(s) intéressante(s) ajoutée(s), ${skipped} écartée(s), ${items.length} conservée(s).`);
if (NTFY_TOPIC) for (const { p, e } of pushes.slice(0, 5)) {
  try { await fetch('https://ntfy.sh/' + encodeURIComponent(NTFY_TOPIC), { method: 'POST', body: `${p.ask.toFixed(2)} € (+${p.shipIn} € de frais) · valeur ${e.v.marketEur.toFixed(2)} € · marge ${e.v.margin >= 0 ? '+' : ''}${e.v.margin.toFixed(2)} €`, headers: { Title: ('Bon plan : ' + (e.name || p.title)).replace(/[^\x20-\x7E]/g, '?'), Click: p.url || 'https://www.vinted.fr', Tags: 'fire', Priority: '4' } }); } catch (err) {}
}
