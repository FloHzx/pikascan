# PikaScan — notes pour Claude Code

Appli d'achat/revente de cartes Pokémon (Flo, francophone). **Répondre en français, de façon concise.** Aperçus et captures en **thème sombre**. Quand on identifie des cartes, montrer les images. UI détaillée et interactive (graphiques).

## Déploiement
- Site : https://flohzx.github.io/pikascan/ (GitHub Pages, branche `main`, racine). Dépôt public `FloHzx/pikascan`.
- **Push auto** (autorisé explicitement par Flo, 12/11/2026) : à chaque livraison, Claude commit et pousse directement sur `main` du dépôt GitHub en ligne (plus de GitHub Desktop). Incrémenter la version avant de pousser.
- Netlify est bloqué (crédits épuisés) : ne pas l'utiliser.
- Aucun secret dans le dépôt. `firebase-config.js` ne contient que des clés publiques (la protection vient des règles Firestore). Les secrets (ex. `APIFY_TOKEN`) sont dans GitHub Secrets.

## Structure
- `index.html` (~725 Ko) : **toute l'appli** (HTML + CSS + JS). Version affichée dans le bloc de build (`1.18.0 | date UTC`) : l'incrémenter à chaque livraison.
  - Le script principal est le **3ᵉ bloc `<script>` inline** (index 2). Vérif syntaxe : extraire avec `re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', s, re.S)[2]` puis `node --check`.
  - **Fin de ligne CRLF** : lire/écrire en Python avec `newline=''`, ne pas normaliser.
- `ocr/` : index visuel (~17 000 cartes FR : `cardidx.bin/json`, `cardclu.*`, `cardlang.json`) + Tesseract (`fra.traineddata.gz`, wasm). Aucune IA payante : comparaison de pixels en JS.
- `extension/` : extension Chrome/Edge MV3 (v1.5.1). `background.js` (`extractLbc`, Vinted, Cardmarket), `content.js`, `cardmarket.js`, `ebay.js`. Importe les annonces Vinted/Leboncoin dans l'onglet Annonces. `store/` = paquet pour le Chrome Web Store.
- `sw.js`, `manifest.webmanifest`, icônes : PWA.
- `data/` : `tracked.json` (cartes suivies), `history.json` (prix quotidiens), `annonces.json` (flux auto).
- `scripts/` + `.github/workflows/` : `snapshot.yml` (relevé quotidien 05:00 UTC → `snapshot.mjs`), `annonces.yml` (toutes les 5 min → `pull_annonces.mjs`, Apify, lit les photos via `photo_engine.mjs` = Chromium headless + scanner de l'appli).
- `collection.csv` : exemple de collection (la vraie est importée par Flo dans Réglages).

## Architecture de l'appli (index.html)
- Données : `LocalDB` (localStorage `pikascan_live_v1`, collections `set/update/delete/onSnapshot/setMany`), `S` (état, `S.db=LocalDB`, `S.cards`). Sync cloud : `CloudSync` (Firestore, liste `COLS=['cards','alerts','listings','settings','buys','stock']`, docs `{j:JSON,u:timestamp}` sous `users/{uid}/{collection}/{id}`). **Toute nouvelle collection doit être ajoutée à `COLS` et autorisée dans les règles Firestore** (sinon « Règles Firestore non publiées »).
- Prix : API gratuite **TCGdex** (prix Cardmarket 24 h / 7 j / 30 j) via `tcCard/tcSearch/fxSum/fxSummary/fxSave`. Cardmarket direct est bloqué (403).
- Onglets : Ma base, Scanner (« Par l'image »), Annonces (`FLUX`), **Achats/Ventes** (module `TR*`, `renderTrade`, `trAction`, `trBuyOpen`, `trCalc`…), Réglages.
- Scanner : `window.__ocr`, `phRunVis`, `phMatchAll`, `phWork`, `phCellState`, `fxScanPhotos`.
  - **Détection v2** `phDetectCards(im,opt)` : intégrales de gradients, score de rectangle, rejet des groupes à couture interne, taille dominante, complétion de grille, raffinage de perspective par arête. Retourne `{cards:[{q,s,src}],rows,cols,quad}`.
  - **Pré-traitement** `phRectify(im,q,opt)` : homographie, bicubique (Catmull-Rom), étirement du contraste (percentiles 1/99), netteté (unsharp). Appliqué à chaque carte détectée.
  - `fxScanPhotos` tente d'abord le mode `cards`, puis l'ancienne chaîne (zones/auto/single/full) en secours.
- Module Achats/Ventes : prix de revient réparti au prorata de la valeur Cardmarket (ou parts égales), découpage de quantités, statuts stock → en vente → gradation → vendue, alertes (dormant > 60 j, annonce > 30 j, gradation > 60 j, baisse ≥ 10 %/30 j, prix sous le coût), export CSV, lien depuis le bouton « 🛒 J'ai acheté » des annonces (`it.bought`).

## Pièges connus
- Leboncoin : données dans `__NEXT_DATA__` → `props.pageProps.ad` ; la navigation client peut laisser un `__NEXT_DATA__` périmé (re-fetch si `list_id` ≠ URL). Résolution max ≈ 800 px (`rule=ad-large`) : les noms de cartes restent parfois illisibles.
- Sandbox cloud : `assets.tcgdex.net`, `img.leboncoin.fr`, Vinted et favicons Google sont bloqués ; testables seulement depuis le navigateur de Flo.
- Lecture d'une page de 9 cartes ≈ 45 s ; en test via navigateur piloté, les appels JS expirent à 45 s → lancer en tâche de fond et sonder.
- Les reflets sur pochettes et les promos absentes de l'index (ex. Évoli) donnent des non-reconnues : prévoir la recherche par nom.

## Tests
- Servir le site en local (`python3 -m http.server 8765`) et piloter avec Playwright. Dans le sandbox : `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
- Vérifier : syntaxe du script principal, absence de débordement horizontal à 390 px, clair/sombre.
- Les notes détaillées de conception sont dans `docs/` (commencer par `docs/README.md`). Les mettre à jour quand une fonction change.

## Chantiers ouverts (non demandés à nouveau)
- Prix Cardmarket FR / état NM (source directe bloquée, TCGGraph tiers possible).
- Estimation des frais de port selon la zone du vendeur.
- Extension sur mobile (Vivaldi / Web Store non répertorié) ; installation PWA sur Edge Android.
- « Ajuster un cadre → recaler les autres cartes » dans l'éditeur de grille.
- Vérifier que les règles Firestore autorisent `buys` et `stock`.
