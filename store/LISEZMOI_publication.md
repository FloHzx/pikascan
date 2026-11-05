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

## Texte de la fiche
**Nom** : PikaScan – Envoyer l'annonce
**Résumé (132 car. max)** : Sur une annonce Vinted, un clic envoie photos, prix, description et date à PikaScan pour lire les cartes.
**Description** : Cette extension complète l'application web PikaScan (achat/revente de cartes Pokémon). Sur une annonce Vinted, clique sur l'icône : l'extension lit le titre, le prix, la description, la date de mise en ligne et les photos de la page que tu consultes, et les envoie à ton onglet PikaScan. PikaScan reconnaît visuellement les cartes, les compare aux prix Cardmarket et affiche un verdict (bon plan ou non). Rien n'est envoyé à un serveur : tout se passe entre deux onglets de ton navigateur. L'extension ne fait rien tant que tu ne cliques pas dessus.
**Catégorie** : Productivité · **Langue** : Français

## Justification des autorisations
- activeTab / scripting : lire l'annonce de l'onglet actif au clic et transmettre le résultat à l'onglet PikaScan.
- Hôtes vinted.* : lire la page d'annonce et télécharger ses photos (vinted.net), uniquement au clic de l'utilisateur.
- Hôte flohzx.github.io : retrouver/ouvrir l'onglet PikaScan et y déposer l'annonce ; un petit script signale à la page que l'extension est installée.
- Usage unique : transmettre les données de l'annonce à l'application PikaScan ; aucune donnée n'est collectée, stockée ou vendue.
