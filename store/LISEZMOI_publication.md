# Publier l'extension PikaScan (installation en un clic pour tout le monde)

Une extension publiée sur le **Chrome Web Store** s'installe en un clic (« Ajouter à Chrome »), sans ZIP ni mode développeur.
Ça passe obligatoirement par ton compte : je ne peux pas le faire à ta place (identité + paiement + validation).

## Chrome Web Store (aussi pour Opera/Brave/Vivaldi) — 5 $ une seule fois
1. Va sur https://chrome.google.com/webstore/devconsole et connecte-toi (compte Google), paie les 5 $ de frais d'inscription.
2. « Nouvel élément » → envoie `store/pikascan-extension-store.zip`.
3. Fiche : colle les textes ci-dessous, ajoute `store/screenshot-1280x800.png` et l'icône (déjà dans le ZIP).
4. Onglet « Confidentialité » : URL de la politique = `https://flohzx.github.io/pikascan/privacy.html` (le fichier `privacy.html` doit être publié) ; coche « Je ne collecte aucune donnée utilisateur transmise à des tiers » ; justifie les autorisations avec le texte plus bas.
5. Distribution → **Visibilité : « Non répertoriée »** (seules les personnes avec le lien l'installent ; pas besoin d'être dans la recherche du store) → Soumettre à l'examen. Délai : de quelques heures à environ une semaine (les accès à des sites sont examinés de près).
6. Une fois validée, copie l'adresse de la fiche et donne-la-moi : j'en ferai le bouton « Ajouter à Chrome » du site.

## Microsoft Edge (gratuit) — https://partner.microsoft.com/dashboard/microsoftedge
Même ZIP, même texte, inscription gratuite.

## Texte de la fiche (paquet v1.5.1, reconstruit le 13 nov. 2026)
**Nom** : PikaScan – Envoyer l'annonce
**Résumé (132 car. max)** : Sur une annonce Vinted ou Leboncoin, un clic envoie photos, prix, description et date à PikaScan pour lire les cartes.
**Description** : Cette extension complète l'application web PikaScan (achat/revente de cartes Pokémon). Sur une annonce Vinted ou Leboncoin, clique sur l'icône : l'extension lit le titre, le prix, la description, la date de mise en ligne et les photos de la page que tu consultes, et les envoie à ton onglet PikaScan. PikaScan reconnaît visuellement les cartes, les compare aux prix Cardmarket et affiche un verdict (bon plan ou non). À ta demande, depuis PikaScan, l'extension peut aussi lire les prix des ventes eBay.fr terminées et les offres Cardmarket en français / Near Mint d'une carte, comme si tu ouvrais ces pages toi-même. Rien n'est envoyé à un serveur : tout se passe entre les onglets de ton navigateur. L'extension ne fait rien tant que tu ne cliques pas.
**Catégorie** : Productivité · **Langue** : Français

## Justification des autorisations
- activeTab / scripting : lire l'annonce de l'onglet actif au clic et transmettre le résultat à l'onglet PikaScan.
- Hôtes vinted.* et leboncoin.fr (+ img.leboncoin.fr, vinted.net pour les photos) : lire la page d'annonce et télécharger ses photos, uniquement au clic de l'utilisateur.
- Hôte www.ebay.fr : à la demande de l'utilisateur dans PikaScan, lire une page de résultats « ventes terminées » pour en extraire les prix (aucun achat, aucun compte utilisé).
- Hôte www.cardmarket.com : à la demande de l'utilisateur, lire la page produit d'une carte filtrée en français / Near Mint pour en extraire les prix des offres (aucun panier, aucune action sur le compte).
- Hôte flohzx.github.io : retrouver/ouvrir l'onglet PikaScan et y déposer l'annonce ; un petit script signale à la page que l'extension est installée.
- Usage unique : transmettre ces informations à l'application PikaScan de l'utilisateur ; aucune donnée n'est collectée, stockée sur un serveur ou vendue.

## Contenu du paquet
`manifest.json`, `background.js`, `content.js`, `ebay.js`, `cardmarket.js`, `icon16/48/128.png` (nouvelle icône, style de la bannière). Capture : `store/screenshot-1280x800.png` (onglet Annonces, thème sombre).
