/* PikaScan : service worker. Le site reste toujours à jour (réseau d'abord pour la page),
   et les polices, images, icônes et index de reconnaissance sont gardés pour l'usage hors ligne. */
const V='pikascan-sw-1.20.3', SHELL=['./','index.html','manifest.webmanifest','banner.jpg','logo.webp','icon.svg','firebase-config.js','icon-192.png','icon-512.png',
 'fonts/lilita-one-latin-400-normal.woff2','fonts/nunito-latin-400-normal.woff2','fonts/nunito-latin-500-normal.woff2','fonts/nunito-latin-600-normal.woff2','fonts/nunito-latin-700-normal.woff2','fonts/nunito-latin-800-normal.woff2',
 'fonts/ibm-plex-mono-latin-400-normal.woff2','fonts/ibm-plex-mono-latin-500-normal.woff2','fonts/ibm-plex-mono-latin-600-normal.woff2'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('message',e=>{ if(e.data==='skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url); if(u.origin!==location.origin) return;           // API (TCGdex, Firebase…) : jamais interceptées
  if(u.pathname.includes('/extension/')) return;
  const isPage = r.mode==='navigate' || u.pathname.endsWith('/index.html') || u.pathname.endsWith('/firebase-config.js');
  if(isPage){   // réseau d'abord : une mise à jour publiée est visible tout de suite
    e.respondWith(fetch(r).then(res=>{ if(res&&res.ok){ const cp=res.clone(); caches.open(V).then(c=>c.put(r.mode==='navigate'?'./':r,cp)); } return res; })
      .catch(()=>caches.match(r.mode==='navigate'?'./':r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(r).then(m=>{   // le reste : cache d'abord, rafraîchi en arrière-plan
    const net=fetch(r).then(res=>{ if(res&&res.ok){ const cp=res.clone(); caches.open(V).then(c=>c.put(r,cp)); } return res; }).catch(()=>m);
    return m||net;
  }));
});
