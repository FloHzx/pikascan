// Signale à PikaScan que l'extension est installée (affichage « ✅ Extension installée »).
document.documentElement.dataset.pikascanExt = chrome.runtime.getManifest().version;
