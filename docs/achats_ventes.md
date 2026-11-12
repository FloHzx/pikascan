# PikaScan — Repérage v2, pré-traitement et module Achats/Ventes (10 nov. 2026, v1.18.0)

## Repérage des cartes sur une photo (v1.17)
- `phDetectCards(im)` : cherche chaque carte par sa forme (4 bords droits, proportion 63×88), avec un score d'arête sur images intégrales. Un groupe 2×2 ou 3×3 (même proportion) est rejeté grâce à la séparation verticale interne.
- Ensuite : taille dominante (médiane des meilleures boîtes) puis 2e passe à ±12 %, complétion par la grille (trous + un cran au-delà), ajustement bord par bord (perspective).
- Dans `fxScanPhotos`, ce repérage passe en premier (mode `cards`). L'ancienne chaîne (îlots, grille, carte seule) reste en secours si moins de la moitié des cartes sont reconnues ; on garde le meilleur résultat.
- Test sur un classeur Leboncoin de 8 pages (photos 450×800) : cadres justes sur 7 pages sur 8.

## Pré-traitement automatique (v1.18)
- `phRectify(im, quad)` : redressement de la perspective, agrandissement bicubique (largeur 420 px), étirement du contraste (percentiles 1–99 %), masque flou de netteté. Appliqué à chaque carte repérée avant la reconnaissance.
- Mesure en conditions réelles (navigateur de Flo, vérification fine active) sur 5 pages : 17 cartes reconnues au lieu de 14, environ 25 % plus rapide.
- Limite principale : Leboncoin ne sert pas plus de 800 px (règle `ad-large`), les noms restent souvent illisibles et les reflets des pochettes gênent.

## Module Achats/Ventes (onglet `trade`)
- Collections LocalDB synchronisées (CloudSync COLS) : `buys` (achats) et `stock` (lignes de cartes).
- Statuts d'une ligne : stock → listed (en vente) → sold, ou grading → retour (note, certificat), ou kept (gardée).
- Prix de revient : total payé (articles + port + frais) réparti au prorata de la valeur Cardmarket (ou à parts égales), plus les frais de gradation. Bénéfice = prix de vente − frais de la plateforme − port à la charge du vendeur − prix de revient.
- Depuis l'onglet Annonces : bouton « 🛒 J'ai acheté », pré-rempli avec les cartes reconnues. L'annonce garde `it.bought` (bandeau, filtre « Achetées ») ; elle est exclue des « Bons plans » et du badge.
- Tableau de bord : investi, valeur du stock et plus-value latente, ventes, bénéfice net, ROI, délai moyen de revente.
- Graphique achats/ventes par mois (orange/bleu validés pour le thème clair et le sombre, info-bulle, vue tableau).
- Points d'attention : stock de plus de 60 j, annonce de plus de 30 j, gradation de plus de 60 j, marché à −10 % sur 30 j, prix de vente sous le prix de revient.
- Autres fonctions : séparation des quantités (vendre 1 exemplaire sur 3), texte d'annonce à copier, export CSV (séparateur `;`), actualisation des valeurs via TCGdex, ajout optionnel des cartes à « Ma base » (statut Acheté) pour le suivi des prix et les alertes.
- Les règles Firestore doivent couvrir `users/{uid}/{collection}/{doc}` pour toutes les collections, sinon la synchro des nouvelles collections échoue (message « Règles Firestore non publiées »).
