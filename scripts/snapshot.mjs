// Relevé quotidien des prix Cardmarket (via TCGdex) pour les cartes listées dans data/tracked.json
// Écrit data/history.json : { "<id carte>": [ { t, usd, low } ] }  (usd = prix en euros, nom historique)
import { readFile, writeFile } from 'node:fs/promises';
const TCD = 'https://api.tcgdex.net/v2/fr/cards/', MAX_POINTS = 800;
const load = async (p) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return {}; } };
const tracked = await load('data/tracked.json'), hist = await load('data/history.json');
// Liste publiée par l'appli (synchro cloud activée) : documents Firestore public/{uid} = { j: '{"<id>":{"v":"normal"}}' }
// Lecture publique en lecture seule (voir firestore.rules) ; ajoutée à data/tracked.json.
async function fromFirestore() {
  let project = process.env.FIREBASE_PROJECT;
  if (!project) { try { project = ((await readFile('firebase-config.js', 'utf8')).match(/projectId:\s*["']([^"']+)/) || [])[1]; } catch {} }
  if (!project) return 0;
  let n = 0, page = '';
  for (let k = 0; k < 20; k++) {
    let r; try { r = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/public?pageSize=100${page ? '&pageToken=' + encodeURIComponent(page) : ''}`); } catch (e) { console.log('Firestore injoignable :', e.message); return n; }
    if (!r.ok) { console.log(`Firestore : liste publique illisible (${r.status}) — règles firestore.rules publiées ?`); return n; }
    const d = await r.json();
    for (const doc of d.documents || []) { try { const o = JSON.parse(doc.fields.j.stringValue); for (const [id, x] of Object.entries(o)) if (!tracked[id]) { tracked[id] = { v: x && x.v === 'reverse' ? 'reverse' : 'normal' }; n++; } } catch {} }
    if (!(page = d.nextPageToken)) break;
  }
  return n;
}
const fromCloud = await fromFirestore();
if (fromCloud) console.log(`cartes suivies ajoutées depuis l'appli (Firestore) : ${fromCloud}`);
const ids = Object.keys(tracked).filter(id => /^[A-Za-z0-9_.\-]{2,40}$/.test(id));
async function fetchCard(id) {
  for (let k = 0; k < 3; k++) {
    try { const r = await fetch(TCD + encodeURIComponent(id)); if (r.status === 404) return null; if (r.ok) return await r.json(); } catch {}
    await new Promise(r => setTimeout(r, 500 * (k + 1)));
  }
  return null;
}
function pickPoint(card, variant) {
  const cm = card && card.pricing && card.pricing.cardmarket; if (!cm) return null;
  const sfx = variant === 'reverse' ? '-holo' : '';
  const g = k => { const v = cm[k + sfx]; return (v == null || v === 0) ? null : v; };
  const p = g('trend') ?? g('avg'); if (p == null) return null;
  return { t: cm.updated, usd: p, low: g('low') };
}
let added = 0, i = 0;
await Promise.all(Array.from({ length: Math.min(5, ids.length) }, async () => {
  while (i < ids.length) {
    const id = ids[i++], card = await fetchCard(id); if (!card) continue;
    const pt = pickPoint(card, tracked[id].v); if (!pt || !pt.t) continue;
    const arr = hist[id] || (hist[id] = []);
    if (!arr.some(x => x.t.slice(0, 10) === pt.t.slice(0, 10))) { arr.push(pt); arr.sort((a, b) => a.t.localeCompare(b.t)); if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS); added++; }
  }
}));
await writeFile('data/history.json', JSON.stringify(hist));
console.log(`cartes suivies : ${ids.length}, nouveaux points : ${added}`);
