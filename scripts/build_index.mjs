// Mise à jour de l'index visuel du scanner (ocr/cardidx.*, ocr/cardclu.*, ocr/cardlang.json, ocr/idxver.json).
// Ajoute les cartes TCGdex (françaises) absentes de l'index dès que leur image est en ligne (fr, sinon en).
// Pokémon TCG Pocket (série tcgp, jeu mobile) est ignoré.
//   node scripts/build_index.mjs --count   → écrit new=<n> dans $GITHUB_OUTPUT (cartes à ajouter), sans Chromium
//   node scripts/build_index.mjs           → calcule les vignettes (Chromium via Playwright) et réécrit l'index
// Vignette = image de la carte, marge de 6 % retirée, moyenne RVB sur une grille de 8 × 11 cases (264 octets),
// identique à ce que fait l'appli (phDescQ + phReduce). Les cartes sont rangées par groupe (cardclu.json = bornes,
// cardclu.bin = centre de chaque groupe = moyenne des vignettes normalisées).
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const API = 'https://api.tcgdex.net/v2/', ASSETS = 'https://assets.tcgdex.net/', O = 'ocr/', D = 88, L = 264;
const COUNT = process.argv.includes('--count'), MAX = +(process.env.MAX_NEW || 800);

const jget = async u => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u); if (r.ok) return await r.json(); if (r.status === 404) return null; } catch {} await new Promise(r => setTimeout(r, 800 * (k + 1))); } return null; };
const exists = async u => { for (let k = 0; k < 2; k++) { try { const r = await fetch(u, { method: 'HEAD' }); return r.ok; } catch {} } return false; };
const pool = async (items, n, fn) => { let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); };

const ids = JSON.parse(await readFile(O + 'cardidx.json', 'utf8'));
const lang = JSON.parse(await readFile(O + 'cardlang.json', 'utf8'));
const have = new Set(ids);

// 1. cartes candidates : liste française complète, hors TCG Pocket, absentes de l'index
const [all, series] = await Promise.all([jget(API + 'fr/cards'), jget(API + 'fr/series')]);
if (!all || !series) { console.log('TCGdex injoignable : rien à faire.'); process.exit(0); }
const serieOf = new Map();
await pool(series.map(s => s.id), 4, async sid => { const s = await jget(API + 'fr/series/' + sid); (s && s.sets || []).forEach(st => serieOf.set(st.id, sid)); });
const setOf = c => c.id.slice(0, c.id.length - String(c.localId).length - 1);
const cand = all.filter(c => c && c.id && c.localId != null && !have.has(c.id)).map(c => ({ c, sid: setOf(c) }))
  .filter(x => serieOf.has(x.sid) && serieOf.get(x.sid) !== 'tcgp');

// 2. image disponible ? (l'API ne déclare pas toujours les images qui existent) : fr d'abord, puis en
const found = [];
await pool(cand, 12, async ({ c, sid }) => {
  const path = serieOf.get(sid) + '/' + sid + '/' + c.localId;
  if (c.image && await exists(c.image + '/high.png')) { found.push({ id: c.id, url: c.image + '/high.png', lang: null }); return; }
  for (const lg of ['fr', 'en']) if (await exists(ASSETS + lg + '/' + path + '/high.png')) { found.push({ id: c.id, url: ASSETS + lg + '/' + path + '/high.png', lang: lg }); return; }
});
found.sort((a, b) => a.id.localeCompare(b.id)); found.length = Math.min(found.length, MAX);
console.log(`cartes absentes de l'index (hors Pocket) : ${cand.length}, avec une image en ligne : ${found.length}`);
if (COUNT) { if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `new=${found.length}\n`); process.exit(0); }
if (!found.length) process.exit(0);

// 3. vignettes 8 × 11 calculées dans Chromium (même décodage et mêmes arrondis que l'appli)
const { chromium } = require('playwright');
const browser = await chromium.launch(), page = await browser.newPage();
await page.setContent('<html><body></body></html>');
const thumbs = new Map();
await pool(found, 6, async f => {
  let buf; try { const r = await fetch(f.url); if (!r.ok) { console.log('image', f.id, r.status, f.url); return; } buf = Buffer.from(await r.arrayBuffer()); } catch (e) { console.log('image', f.id, e.message); return; }
  const v = await page.evaluate(async b64 => {
    const im = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const W = im.width, H = im.height, cv = new OffscreenCanvas(W, H), c = cv.getContext('2d'); c.drawImage(im, 0, 0); const d = c.getImageData(0, 0, W, H).data;
    const ins = 0.06, x0 = W * ins, x1 = W * (1 - ins), y0 = H * ins, y1 = H * (1 - ins), r = [];
    for (let y = 0; y < 11; y++) for (let x = 0; x < 8; x++) {
      const ax = x0 + (x1 - x0) * x / 8, bx = x0 + (x1 - x0) * (x + 1) / 8, ay = y0 + (y1 - y0) * y / 11, by = y0 + (y1 - y0) * (y + 1) / 11; const s = [0, 0, 0]; let k = 0;
      for (let yy = Math.floor(ay); yy < Math.ceil(by); yy++) for (let xx = Math.floor(ax); xx < Math.ceil(bx); xx++) { const o = (yy * W + xx) * 4; if (d[o + 3] < 10) continue; s[0] += d[o]; s[1] += d[o + 1]; s[2] += d[o + 2]; k++; }
      r.push(...s.map(t => Math.round(t / (k || 1))));
    }
    return r;
  }, buf.toString("base64")).catch(e => { console.log("vignette", f.id, e.message.split("\n")[0]); return null; });
  if (v && v.length === L) thumbs.set(f.id, { v: Uint8Array.from(v), lang: f.lang });
});
await browser.close();
if (!thumbs.size) { console.log('aucune vignette calculée'); process.exit(0); }

// 4. rangement : chaque nouvelle carte va dans le groupe dont le centre est le plus proche, puis les centres touchés sont recalculés
const bin = await readFile(O + 'cardidx.bin'), offs = JSON.parse(await readFile(O + 'cardclu.json', 'utf8')), cb = await readFile(O + 'cardclu.bin');
const K = offs.length - 1, C = new Float32Array(cb.buffer.slice(cb.byteOffset, cb.byteOffset + cb.length));
const norm = raw => { const v = new Float32Array(L); for (let ch = 0; ch < 3; ch++) { let mu = 0; for (let i = 0; i < D; i++) mu += raw[i * 3 + ch]; mu /= D; let sd = 0; for (let i = 0; i < D; i++) { const t = raw[i * 3 + ch] - mu; sd += t * t; } sd = Math.sqrt(sd / D) || 1; for (let i = 0; i < D; i++) v[ch * D + i] = (raw[i * 3 + ch] - mu) / sd; } return v; };
const groups = Array.from({ length: K }, (_, c) => { const g = []; for (let n = offs[c]; n < offs[c + 1]; n++) g.push({ id: ids[n], raw: bin.subarray(n * L, n * L + L) }); return g; });
const touched = new Set();
for (const [id, t] of [...thumbs].sort((a, b) => a[0].localeCompare(b[0]))) {
  const v = norm(t.v); let bc = 0, bd = Infinity;
  for (let c = 0; c < K; c++) { let s = 0; const o = c * L; for (let i = 0; i < L; i++) { const e = C[o + i] - v[i]; s += e * e; } if (s < bd) { bd = s; bc = c; } }
  groups[bc].push({ id, raw: t.v }); touched.add(bc); if (t.lang) lang[id] = t.lang;
}
for (const c of touched) { const m = new Float32Array(L); for (const g of groups[c]) { const v = norm(g.raw); for (let i = 0; i < L; i++) m[i] += v[i]; } for (let i = 0; i < L; i++) C[c * L + i] = m[i] / groups[c].length; }
const nIds = [], nOffs = [0], nBin = Buffer.alloc((ids.length + thumbs.size) * L);
for (const g of groups) { for (const e of g) { nBin.set(e.raw, nIds.length * L); nIds.push(e.id); } nOffs.push(nIds.length); }

// 5. écriture (+ numéro de version pour que l'appli recharge l'index au lieu de garder sa copie locale)
let ver = 3; try { ver = JSON.parse(await readFile(O + 'idxver.json', 'utf8')).v; } catch {}
await writeFile(O + 'cardidx.json', JSON.stringify(nIds));
await writeFile(O + 'cardidx.bin', nBin);
await writeFile(O + 'cardclu.json', JSON.stringify(nOffs).replace(/,/g, ', '));
await writeFile(O + 'cardclu.bin', Buffer.from(C.buffer));
await writeFile(O + 'cardlang.json', JSON.stringify(lang));
await writeFile(O + 'idxver.json', JSON.stringify({ v: ver + 1, n: nIds.length, updated: new Date().toISOString().slice(0, 10) }) + '\n');
console.log(`index : ${ids.length} → ${nIds.length} cartes (+${thumbs.size}), version ${ver + 1}`);
console.log('ajoutées : ' + [...thumbs.keys()].join(', '));
