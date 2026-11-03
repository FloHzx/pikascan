// Moteur de lecture des photos : ouvre PikaScan dans un Chromium sans écran et réutilise son scanner « Par l'image »
// (comparaison de pixels avec l'index de ~17 000 cartes). Aucun service externe, aucune IA payante.
import { createRequire } from 'node:module'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.gz': 'application/gzip', '.wasm': 'application/wasm' };

export async function startEngine({ root = process.cwd(), port = 0, textAssist = false, log = () => {} } = {}) {
  const { chromium } = require('playwright');
  const srv = http.createServer((q, s) => {
    let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(root)) { s.writeHead(403); s.end(); return; }
    if (p.endsWith(path.sep)) p += 'index.html';
    fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); s.end(d); });
  });
  await new Promise(r => srv.listen(port, '127.0.0.1', r)); const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch(); const page = await (await browser.newContext({ viewport: { width: 1000, height: 900 } })).newPage();
  page.on('pageerror', e => log('page:', e.message));
  await page.goto(url); await page.waitForFunction(() => window.__ocr && window.__ocr.PH, null, { timeout: 60000 }); await page.waitForTimeout(1500);
  await page.click('#tab-photo');
  await page.evaluate(ta => { document.getElementById('phAuto').checked = false; document.getElementById('phTxtAssist').checked = ta; }, textAssist);

  // Lit une photo (Buffer) et renvoie les cartes reconnues : [{id, name, conf, s1, margin, qty}]
  async function readPhoto(buf, name = 'photo.jpg') {
    const run = async mode => {   // mode 'auto' = grille détectée par l'appli ; 'single' = une seule carte sur toute la zone texturée
      await page.evaluate(() => { __ocr.PH.files.length = 0; __ocr.PH.items = []; });
      await page.setInputFiles('#phFile', { name, mimeType: /png$/i.test(name) ? 'image/png' : 'image/jpeg', buffer: buf });
      await page.waitForFunction(() => __ocr.PH.files.length && __ocr.PH.files.every(x => x.grid) && !__ocr.PH.busy, null, { timeout: 120000 });
      if (mode === 'single' || mode === 'full') await page.evaluate(async mode => { const f = __ocr.PH.files[0], im = await new Promise(r => { if (f.im) return r(f.im); const i = new Image(); i.onload = () => r(i); i.src = f.url; }); f.im = im; const tb = mode === 'full' ? { x0: 0.03, y0: 0.03, x1: 0.97, y1: 0.97 } : __ocr.phTextureBox(im); f.grid = { quad: [[tb.x0, tb.y0], [tb.x1, tb.y0], [tb.x1, tb.y1], [tb.x0, tb.y1]], rows: 1, cols: 1 }; }, mode);
      const grid = await page.evaluate(() => { const g = __ocr.PH.files[0].grid; return g.rows + 'x' + g.cols; });
      await page.evaluate(() => __ocr.phRunVis());
      await page.waitForFunction(() => !__ocr.PH.busy, null, { timeout: 300000 });
      const cells = await page.evaluate(() => __ocr.PH.items.filter(i => i.kind !== 'lost' && i.conf !== 'lost' && i.cands.length).map(i => ({ id: i.cands[0].id, name: i.cands[0].name, conf: i.conf, s1: +(i.s1 || 0).toFixed(3), margin: +(i.margin || 0).toFixed(3), qty: i.qty || 1, alt: i.cands.slice(1, 4).map(c => c.id) })));
      const lost = await page.evaluate(() => __ocr.PH.items.filter(i => i.kind === 'lost' || i.conf === 'lost' || !i.cands.length).length);
      return { grid, cells, lost };
    };
    let r = await run('auto');
    const ok = x => x.cells.some(c => c.conf === 'sure' || c.conf === 'probable');
    for (const m of ['single', 'full']) { if (ok(r)) break; if (m === 'single' && r.grid === '1x1') continue; const r2 = await run(m); if (r2.cells.length && (!r.cells.length || ok(r2))) r = Object.assign(r2, { fallback: m }); }
    return r;
  }
  return { readPhoto, close: async () => { await browser.close(); srv.close(); } };
}
