// Signale à PikaScan que l'extension est installée (affichage « ✅ Extension installée »).
document.documentElement.dataset.pikascanExt = chrome.runtime.getManifest().version;

// Relais PikaScan ⇄ extension pour les prix eBay (la page envoie une demande, l'extension répond).
window.addEventListener('message', e => {
  const d = e.data;
  if (e.source !== window || !d || d.type !== 'pikascan-ebay-req' || typeof d.q !== 'string') return;
  const id = d.id;
  try {
    chrome.runtime.sendMessage({ type: 'ebay', q: d.q.slice(0, 140) }, res => {
      const err = chrome.runtime.lastError;
      window.postMessage(Object.assign({ type: 'pikascan-ebay-res', id, ext: true }, err ? { error: err.message } : (res || { error: 'pas de réponse' })), location.origin);
    });
  } catch (x) { window.postMessage({ type: 'pikascan-ebay-res', id, ext: true, error: String(x && x.message || x) }, location.origin); }
});
