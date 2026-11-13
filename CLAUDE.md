# PikaScan — notes pour Claude Code

Appli d'achat/revente de cartes Pokémon (Flo, francophone). **Répondre en français, de façon concise.** Aperçus et captures en **thème sombre**. Quand on identifie des cartes, montrer les images. UI détaillée et interactive (graphiques).

## Déploiement
- Site : https://flohzx.github.io/pikascan/ (GitHub Pages, branche `main`, racine). Dépôt public `FloHzx/pikascan`.
- **Push auto** (autorisé explicitement par Flo, 12/11/2026) : à chaque livraison, Claude commit et pousse directement sur `main` du dépôt GitHub en ligne (plus de GitHub Desktop). Incrémenter la version avant de pousser.
- **Prévisualisations systématiques** (demandé par Flo) : pour chaque changement visible, fournir des captures (thème sombre, 390 px mobile + desktop) via Playwright en local avant/avec le push, et les montrer à Flo.
- Netlify est bloqué (crédits épuisés) : ne pas l'utiliser.
- Aucun secret dans le dépôt. `firebase-config.js` ne contient que des clés publiques (la protection vient des règles Firestore). Les secrets (ex. `APIFY_TOKEN`) sont dans GitHub Secrets.

## Structure
- `index.html` (~725 Ko) : **toute l'appli** (HTML + CSS + JS). Version affichée dans le bloc de build (`1.22.0 | date UTC`, + badge `#verBadge`) : l'incrémenter à chaque livraison.
  - Le script principal est le **3ᵉ bloc `<script>` inline** (index 2). Vérif syntaxe : extraire avec `re.findall(r'<script(?![^>]*src)[^>]*>(.*?)</script>', s, re.S)[2]` puis `node --check`.
  - **Fins de ligne LF** (vérifié le 12/11/2026) : lire/écrire en Python avec `newline=''`, ne pas normaliser.
  - Interface : `body[data-tab]` suit l'onglet actif (`setTab`). La bannière n'apparaît que sur « Repérer » ; ailleurs, en-tête compact avec `logo.webp` (l'icône officielle, 256×256, affichée en 72 px / 54 px sur mobile). Fond « holo » (`--holo` : reflets violet/cyan/rose, versions sombre et claire) derrière des panneaux translucides (`--panel-a`, flou). Sous le logo : « Achète malin, revends au bon prix. » sur l'accueil (`.tg2-home`), ailleurs ligne dynamique `#mastLive` (cartes · valeur · évolution pondérée 30 j, calculée dans `renderMeta`). ≤ 600 px : barre d'onglets fixe en bas (libellés courts `.ts`). « Ma base » : bloc « Marché de ma base » à 3 onglets (`S.mk` / `pk_mk` : `var` = `renderVariation`, `bars` = `renderBars`, `top` = `renderTop`), 5+5 / 8 / 10 lignes, « Voir plus » (`S.mkMore`) → 10+10 / 25 / 25. Fiches de « Ma base » repliées par défaut (`S.open` = ids dépliés, actions `unfold`/`fold`/`foldall`, `goToCard` déplie) ; ≥ 860 px les fiches repliées sont sur 2 colonnes.
- `ocr/` : index visuel (18 599 cartes : `cardidx.bin/json`, `cardclu.*`, `cardlang.json`, version dans `idxver.json`) + Tesseract (`fra.traineddata.gz`, wasm). Aucune IA payante : comparaison de pixels en JS. Mise à jour auto chaque lundi : `index.yml` → `scripts/build_index.mjs` (ajoute les cartes dont l'image TCGdex est en ligne, hors TCG Pocket ; incrémente `idxver.json`, l'appli recharge alors l'index).
- `extension/` : extension Chrome/Edge MV3 (v1.5.1). `background.js` (`extractLbc`, Vinted, Cardmarket), `content.js`, `cardmarket.js`, `ebay.js`. Importe les annonces Vinted/Leboncoin dans l'onglet Annonces. `store/` = paquet pour le Chrome Web Store.
- `sw.js`, `manifest.webmanifest`, icônes : PWA. Icône officielle (fournie par Flo le 13/11/2026 : Pikachu néon, cartes, Poké Ball dans le cadre de scan, « PikaScan ») : `icon-192/512.png` et `extension/icon16/48/128.png` détourées (coins transparents), `apple-touch-icon.png` pleine, `icon-maskable-512.png` (icône à 80 % sur fond #120305), favicon = `icon-192.png`.
- `data/` : `tracked.json` (cartes suivies), `history.json` (prix quotidiens), `annonces.json` (flux auto).
- `scripts/` + `.github/workflows/` : `index.yml` (index du scanner, lundi 03:17 UTC), `snapshot.yml` (relevé quotidien 05:00 UTC → `snapshot.mjs`), `annonces.yml` (toutes les 5 min → `pull_annonces.mjs`, Apify, lit les photos via `photo_engine.mjs` = Chromium headless + scanner de l'appli).
- `collection.csv` : exemple de collection (la vraie est importée par Flo dans Réglages).

## Architecture de l'appli (index.html)
- Données : `LocalDB` (localStorage `pikascan_live_v1`, collections `set/update/delete/onSnapshot/setMany`), `S` (état, `S.db=LocalDB`, `S.cards`). Sync cloud : `CloudSync` (Firestore, liste `COLS=['cards','alerts','listings','settings','buys','stock']`, docs `{j:JSON,u:timestamp}` sous `users/{uid}/{collection}/{id}`). **Toute nouvelle collection doit être ajoutée à `COLS` et autorisée dans les règles Firestore** (sinon « Règles Firestore non publiées »). Règles de référence : `firestore.rules` (à coller par Flo dans la console Firebase). Relevé quotidien : l'appli connectée publie `public/{uid}` = `{j: liste des cartes suivies (base + stock non vendu), u}` (`pubSoon` dans `CloudSync`), lu sans clé par `snapshot.mjs` via l'API REST Firestore.
- Prix : API gratuite **TCGdex** (prix Cardmarket 24 h / 7 j / 30 j) via `tcCard/tcSearch/fxSum/fxSummary/fxSave`. Cardmarket direct est bloqué (403).
- Onglets : Ma base, Scanner (« Par l'image »), Annonces (`FLUX`), **Achats/Ventes** (module `TR*`, `renderTrade`, `trAction`, `trBuyOpen`, `trCalc`…), Réglages.
- Scanner : `window.__ocr`, `phRunVis`, `phMatchAll`, `phWork`, `phCellState`, `fxScanPhotos`.
  - **Détection v2** `phDetectCards(im,opt)` : intégrales de gradients, score de rectangle, rejet des groupes à couture interne, taille dominante, complétion de grille, raffinage de perspective par arête. Retourne `{cards:[{q,s,src}],rows,cols,quad}`.
  - **Pré-traitement** `phRectify(im,q,opt)` : homographie, bicubique (Catmull-Rom), étirement du contraste (percentiles 1/99), netteté (unsharp). Appliqué à chaque carte détectée.
  - **Lecteur unique** `fxReadOne(file,url,n,onMsg)` = `window.__ocr.readBest` : cascade cartes v2 (`phDetectCards`+`phRectify`) → zones (`fxSegCore`) → grille (`phPrepare(f,{noCards:true})`) → carte seule → photo entière, garde le meilleur. Utilisé par les Annonces (`fxScanPhotos`), l'onglet Scanner photo (`phRunTab` : photos sans retouche manuelle, `f.auto!==false`) et `scripts/photo_engine.mjs` (GitHub). **Toute amélioration de lecture se fait dans `fxReadOne`/`phPrepare`/`phRunVis` : les 3 lecteurs suivent.** Une grille retouchée à la main (`f.auto=false`) est lue telle quelle par `phRunVis`. Même réglage partout : lecture du nom (Tesseract) activée par défaut dans l'appli (`#phTxtAssist`) **et** dans `photo_engine` (`textAssist=true`, `TEXT_ASSIST=0` pour couper). `phPrepare` essaie aussi la détection v2 en premier (aperçu des cadres jaunes). `PH.prep` : la lecture attend la fin du repérage des photos ajoutées.
- Module Achats/Ventes : prix de revient réparti au prorata de la valeur Cardmarket (ou parts égales), découpage de quantités, statuts stock → en vente → gradation → vendue, alertes (dormant > 60 j, annonce > 30 j, gradation > 60 j, baisse ≥ 10 %/30 j, prix sous le coût), export CSV, lien depuis le bouton « 🛒 J'ai acheté » des annonces (`it.bought`).

## Pièges connus
- Leboncoin : données dans `__NEXT_DATA__` → `props.pageProps.ad` ; la navigation client peut laisser un `__NEXT_DATA__` périmé (re-fetch si `list_id` ≠ URL). Résolution max ≈ 800 px (`rule=ad-large`) : les noms de cartes restent parfois illisibles.
- Sandbox cloud : `assets.tcgdex.net`, `img.leboncoin.fr`, Vinted et favicons Google sont bloqués ; testables seulement depuis le navigateur de Flo.
- Lecture d'une page de 9 cartes ≈ 45 s ; en test via navigateur piloté, les appels JS expirent à 45 s → lancer en tâche de fond et sonder.
- Les reflets sur pochettes et les promos absentes de l'index (ex. Évoli) donnent des non-reconnues : prévoir la recherche par nom.

## Tests
- Servir le site en local (`python3 -m http.server 8765`) et piloter avec Playwright. Dans le sandbox : `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
- Vérifier : syntaxe du script principal, absence de débordement horizontal à 390 px, clair/sombre.
- Skills du dépôt (`.claude/skills/`, chargés à chaque session) : `webapp-testing` (tests/captures Playwright) et `frontend-design` (direction visuelle), tous deux d'`anthropics/skills` (Apache 2.0). Graphiques : suivre le skill `dataviz`.
- Les notes détaillées de conception sont dans `docs/` (commencer par `docs/README.md`). Les mettre à jour quand une fonction change.

## Chantiers ouverts (non demandés à nouveau)
- Prix Cardmarket FR / état NM (source directe bloquée, TCGGraph tiers possible).
- Estimation des frais de port selon la zone du vendeur.
- Extension sur mobile (Vivaldi / Web Store non répertorié) ; installation PWA sur Edge Android.
- « Ajuster un cadre → recaler les autres cartes » dans l'éditeur de grille.
- Flo doit publier `firestore.rules` (couvre `buys`, `stock`, `media` et `public/{uid}` pour le relevé quotidien). Tant que ce n'est pas fait, le relevé lit 403 et ne relève rien.
