// Moteur de lecture des photos : ouvre PikaScan dans un Chromium sans écran et réutilise son scanner « Par l'image »
// (comparaison de pixels avec l'index de ~17 000 cartes). Aucun service externe, aucune IA payante.
import { createRequire } from 'node:module'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gz': 'application/gzip', '.wasm': 'application/wasm' };

export async function startEngine({ root = process.cwd(), port = 0, textAssist = true, log = () => {}, launch = {}, context = {} } = {}) {
  const { chromium } = require('playwright');
  const srv = http.createServer((q, s) => {
    let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(root)) { s.writeHead(403); s.end(); return; }
    if (p.endsWith(path.sep)) p += 'index.html';
    fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); s.end(d); });
  });
  await new Promise(r => srv.listen(port, '127.0.0.1', r)); const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch(launch); const page = await (await browser.newContext(Object.assign({ viewport: { width: 1000, height: 900 } }, context))).newPage();
  page.on('pageerror', e => log('page:', e.message));
  await page.goto(url); await page.waitForFunction(() => window.__ocr && window.__ocr.PH, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  await page.click('#tab-photo'); await page.evaluate(() => { __ocr.PH.quiet = true; });
  await page.evaluate(ta => { document.getElementById('phAuto').checked = false; document.getElementById('phTxtAssist').checked = ta; }, textAssist);

  // Lit une photo (Buffer) et renvoie les cartes reconnues : [{id, name, conf, s1, margin, qty, alt}]
  // Même lecteur que l'appli (onglet Scanner photo et Annonces) : __ocr.readBest = fxReadOne
  // (repérage carte par carte v2 + redressement, zones, grille, carte seule, photo entière → meilleur résultat).
  async function readPhoto(buf, name = 'photo.jpg') {
    const r = await page.evaluate(async ({ b64, name }) => {
      const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const file = new File([u8], name, { type: /png$/i.test(name) ? 'image/png' : 'image/jpeg' }), url = URL.createObjectURL(file);
      const PH = __ocr.PH, keep = { files: PH.files, items: PH.items };
      try {
        const w = await __ocr.readBest(file, url, 0, () => {});
        return { grid: String(w.r.grid || ''), cells: w.r.cs.map(c => ({ id: c.id, name: c.name || '', conf: c.conf, s1: +(c.s1 || 0).toFixed(3), margin: +(c.margin || 0).toFixed(3), qty: c.qty || 1, alt: c.alt || [] })), lost: w.r.lc.length };
      } finally { PH.files = keep.files; PH.items = keep.items; URL.revokeObjectURL(url); }
    }, { b64: buf.toString('base64'), name });
    return r;
  }
  return { readPhoto, close: async () => { await browser.close(); srv.close(); } };
}
