# PikaScan — état au 29 oct. 2026 et marche à suivre pour reprendre

> Document historique (29 oct.). Plusieurs points sont dépassés : le dépôt GitHub est maintenant utilisé et poussé via GitHub Desktop (voir `flux_annonces.md` et `journal_nov_2026.md`). Les décisions de fond restent valables.

## Où en est le projet

- **Appli** : PikaScan Live, un seul fichier `index.html` + dossier `ocr/` (index visuel de ~17 000 cartes FR, Tesseract). Aucune IA, aucun token : comparaison de pixels en JS + API gratuite TCGdex (prix Cardmarket 24 h / 7 j / 30 j).
- **Fonctions** : scanner « Par l'image » (classeurs, planches, carte seule), détection auto de la grille, éditeur de grille, sélecteur visuel de candidats, recherche par nom, zoom comparatif photo / carte trouvée, bouton « Offres Cardmarket FR », bouton « Liste des cartes suivies » (génère `tracked.json`).
- **Hébergement** : Netlify (`pikascan-j7q2.netlify.app`) est **bloqué** — crédits gratuits épuisés. Ne plus déployer sur Netlify sauf demande.
- **Hébergement actuel** : GitHub Pages, dépôt public **FloHzx/pikascan** (branche main, racine). Relevé quotidien des prix : workflow `.github/workflows/snapshot.yml` (cron 05:00 UTC, lançable à la main) + `scripts/snapshot.mjs` qui lit `data/tracked.json` et écrit `data/history.json`.
- La collection complète de Flo (CSV de 401 lignes) n'est pas dans le dépôt public (à importer via Réglages dans l'appli).

## Sécurité
- Un jeton GitHub (`github_pat_…`) a été collé dans un chat le 29 oct. : il doit être **révoqué** (Settings > Developer settings > Fine-grained tokens). Ne jamais le réutiliser ni en demander un nouveau dans un chat.

## Sources et reconstruction (ancienne méthode)
Archive `pikascan_sources.zip` (build_all.sh, patch_live*.py, build_live.py, v*.css, v2_app.js, v2_body.html, ocr_scan.js, findcards.js, visscan.js, tests Playwright). **Depuis, `index.html` est édité directement** (plus de patchs) : c'est la source de vérité. L'index visuel (`ocr/cardidx.bin`…) est dans le dépôt ; le régénérer demande un crawl TCGdex + indexation.
Environnement de test : `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`, serveur `python3 -m http.server 8765`.

## Détail : détection auto de la grille (29 oct. 2026) — remplacée par la détection v2 (voir `achats_ventes.md`)
Repérage des séparations entre cartes (profils de gradient le long de lignes inclinées), choix de la disposition par régularité des espacements, quadrilatère affiné par recherche locale. Tests : classeur 3×3 → 7/9 reconnues ; planche 2×3 et collage 2×4 → disposition correcte (7/8 reconnues).
