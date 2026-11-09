// Signale à PikaScan que l'extension est installée (affichage « ✅ Extension installée »).
document.documentElement.dataset.pikascanExt = chrome.runtime.getManifest().version;

// Relais PikaScan ⇄ extension pour les prix eBay (la page envoie une demande, l'extension répond).
window.addEventListener('message', e => {
  const d = e.data;
  if (e.source !== window || !d || d.type !== 'pikascan-ebay-req' || typeof d.q !== 'string') return;
  const id = d.id;
  try {
    chrome.runtime.sendMessage({ type: 'ebay', q: d.q.slice(0, 140), name: String(d.name || '').slice(0, 80), num: String(d.num || '').slice(0, 12) }, res => {
      const err = chrome.runtime.lastError;
      window.postMessage(Object.assign({ type: 'pikascan-ebay-res', id, ext: true }, err ? { error: err.message } : (res || { error: 'pas de réponse' })), location.origin);
    });
  } catch (x) { window.postMessage({ type: 'pikascan-ebay-res', id, ext: true, error: String(x && x.message || x) }, location.origin); }
});

// Relais PikaScan ⇄ extension pour les offres Cardmarket filtrées (français + Near Mint).
window.addEventListener('message', e => {
  const d = e.data;
  if (e.source !== window || !d || d.type !== 'pikascan-cm-req') return;
  const id = d.id;
  try {
    chrome.runtime.sendMessage({ type: 'cardmarket', idProduct: String(d.idProduct || '').slice(0, 12), k: +d.k || 5 }, res => {
      const err = chrome.runtime.lastError;
      window.postMessage(Object.assign({ type: 'pikascan-cm-res', id, ext: true }, err ? { error: err.message } : (res || { error: 'pas de réponse' })), location.origin);
    });
  } catch (x) { window.postMessage({ type: 'pikascan-cm-res', id, ext: true, error: String(x && x.message || x) }, location.origin); }
});
