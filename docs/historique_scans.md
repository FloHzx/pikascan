# Historique du projet — décisions, choix techniques, scans

Journal du projet d'achat/revente de cartes Pokémon de Flo. Versions : **PikaScan Live** (`index.html`, version recommandée : noms français, vraies images, prix Cardmarket en €, base dans le navigateur + sync Firebase, scanner de photos) ; l'ancien artifact « PikaScan v3 » (Cardrake/TCGplayer en USD, sans images) n'est plus utilisé.

## Décisions prises avec Flo

- **21 août 2026 — Source de prix** : Cardmarket bloque les requêtes automatisées (403) ; estimation TCGplayer (USD → EUR) en attendant.
- **21 août 2026 — Fiches cartes** : PV, dégâts, attaques retirés. Bouton « Voir l'annonce Vinted » sur chaque carte. Menu d'éditions en français (1999 → 2026).
- **27 oct. 2026 — Connecteur Cardrake** : prix US TCGplayer (USD) + score « chase » avec momentum 30 j. Pas de Cardmarket, eBay, ventes réelles ni variation 7 j.
- **27 oct. 2026 — Verdict d'achat** : décote revente 10 %, frais 5 %, envoi 1,50 €, marge cible 30 % → Bon plan / Correct / Marge trop faible / À éviter + prix d'achat max. Base → historique, courbes, alertes hausse ≥ 10 % / baisse ≥ 15 %, actualisation auto à l'ouverture si > 12 h. Période du diagramme réglable (7 j / 30 j / 90 j / depuis l'ajout / personnalisée).
- **27 oct. 2026 — Passage à TCGdex** : l'API publique TCGdex (`api.tcgdex.net/v2`, sans clé, CORS ouvert) fournit les noms français, les images réelles (`assets.tcgdex.net`) et les prix **Cardmarket en €** : trend, moyenne, moyenne 24 h, 7 j, 30 j, variantes holo/reverse. Cardmarket 7 j / 30 j = écart du prix tendance par rapport à la moyenne 7 j / 30 j (pas le prix à une date donnée).
- **Prix FR — limite (27 oct.)** : les prix TCGdex = guide des prix Cardmarket par carte, **toutes langues**. Pas de prix FR seul gratuit : API Cardmarket fermée, pages bloquées par anti-bot. Décision de Flo : garder la moyenne toutes langues ; lien « Cardmarket FR » sur chaque fiche pour comparer.
- **Ventes eBay (27 oct.)** : pas de récupération automatique possible (CGU, API réservée aux partenaires). La fiche a un 2ᵉ graphique « Ventes eBay » à saisie manuelle. Piste ouverte : prix médian des annonces eBay.fr via la Browse API (clés développeur gratuites à créer par Flo).
- **Relevé quotidien (27 oct., puis GitHub Actions)** : à l'origine fonctions Netlify ; remplacé par `snapshot.yml` + `scripts/snapshot.mjs` (`data/tracked.json` → `data/history.json`). Les 3 premiers points « estimés » (moyennes 24 h/7 j/30 j) disparaissent dès 4 relevés réels.
- **Alertes en arrière-plan** : tâche planifiée Claude refusée à l'époque ; les alertes se calculent à l'ouverture de la page.
- **27 oct. 2026 — Éditions** : catalogue TCGdex (français), éditions groupées par série, boutons logo avec logos Pokecardex (163 éditions mappées, repli TCGdex). Sous-éditions Galerie (TG/GG) et Collection Classique 30ᵉ fusionnées avec l'édition principale.
- **27 oct. 2026 — Recherche d'annonces** : Vinted / Leboncoin / eBay n'ont pas d'API publique → boutons qui ouvrent la recherche préremplie « nom du Pokémon + numéro », option de plafond au prix d'achat max.
- **27 oct. 2026 — Import Pokecardex** : script console → `pokecardex-collection.csv` (`edition;numero;nom;prix`) → Réglages > « Importer ma collection ». Filtre de rareté (défaut : cartes rares). Collection de Flo : 401 lignes, 28 éditions, 399 reconnues. Non reconnues : WC23 Genesect-V, WC04 Groudon de Team Magma, reprint 30C hors-set.
- **28 oct. 2026 — Images de secours** : chaîne de repli (TCGdex, autres sources, carte générique) ; cartes sans image (TG/GG, 30ᵉ) → impression alternative de même nom, signalée par infobulle.
- **28 oct. 2026 — Alertes et variations cliquables** : miniature + clic qui ouvre « Ma base » sur la fiche (clignote).
- **29 oct. 2026 — Scanner de photos** : OCR gratuit dans le navigateur (Tesseract.js, `/ocr/`, langue française), puis recentré sur l'image (voir `scanner_image.md`). Résultats classés Sûr / Probable / À choisir / Non reconnu avec miniature, édition, rareté, prix Cardmarket et écart 7 j / 30 j, ajout en lot à la base (« Acheté » ou « Repéré », état au choix) ; doublons regroupés en quantité. Limites : cartes petites, pleine illustration, reflets/flou.

## Schéma d'une carte (PikaScan Live)

id TCGdex (ex. `swsh7-…`), nameFr, nameEn, editionFr, setId, officialTotal, number, rarity, variant, cond (NM/EX/GD/PL), status (spotted/bought), source, askPrice, buyPrice, listingUrl, note, imported (bool), scanned (bool), ebay[{k,t,price}], history[{t, usd(=€), low, est?, srv?}], mom7, mom30, cm{avg, avg1, avg7, avg30}, lowUsd, lastChecked.

## Scan #1 — 21 août 2026 (Vinted, lot de 4 cartes)

| # | Carte | Set / N° | Rareté | 21 août (est., EUR) | 26 oct. Cardrake (→ EUR) | Variation |
|---|-------|----------|--------|--------------------|---------------------------|-----------|
| A | Pikachu Surfeur VMAX | Célébrations · 009/025 | Holo VMAX | 6,72 € | 5,23 € | −22 % |
| B | Pikachu | Célébrations · 005/025 | Holo | 5,15 € | 3,69 € | −28 % |
| C | Pikachu Surfeur V | Célébrations · 008/025 | Holo V | 4,25 € | 3,53 € | −17 % |
| D | Pikachu V | Promos Épée et Bouclier · SWSH061 | Promo | 2,30 € | 1,71 € | −26 % |

Relevé Cardmarket via TCGdex (27 oct.) : Pikachu Surfeur VMAX 4,98 € (−19,0 % vs moy. 30 j) ; Pikachu −1,7 % ; Pikachu V −2,7 % ; Pikachu Surfeur V −19,9 %.
