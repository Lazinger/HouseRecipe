# Planification de repas — ajout groupé au panier

## Contexte

Idée retenue lors du brainstorming du 2026-07-21 (voir les notes de roadmap), après le travail du 2026-07-22 sur le panier (fusion des ingrédients, sections repliables) qui rend la base solide pour cette fonctionnalité. Objectif : permettre de choisir plusieurs recettes à la fois pour la semaine et les ajouter toutes au panier en un clic, plutôt que d'ouvrir chaque recette une par une.

## Portée retenue

Version simple : pas de calendrier, pas de notion de jour/date, pas de sauvegarde persistante de la sélection. Un mode "Planifier" temporaire sur la grille de recettes existante, avec sélection multiple puis ajout groupé au panier.

## Flux utilisateur

1. Un bouton "Planifier" apparaît dans l'en-tête de l'app, à côté des boutons Panier/Favoris/Compte.
2. Cliquer dessus active le mode Planifier : une case à cocher apparaît sur chaque carte de recette de la grille (filtrée ou non), et une barre fixe apparaît en bas de l'écran avec un compteur ("N recette(s) sélectionnée(s)") et un bouton "Ajouter au panier".
3. Cocher une case sélectionne la recette (par id) sans ouvrir sa fiche détail. Le compteur se met à jour.
4. Cliquer sur "Ajouter au panier" (désactivé si 0 sélection) ajoute toutes les recettes cochées au panier, à leur nombre de personnes par défaut (pas d'ajustement de portions à cette étape). Un toast confirme ("N recette(s) ajoutée(s) au panier"), la sélection se vide, le mode Planifier se referme automatiquement (cases et barre disparaissent).
5. Recliquer sur "Planifier" sans avoir ajouté au panier quitte le mode et vide silencieusement la sélection — rien n'est sauvegardé.

## État et données

- Nouveaux champs sur l'objet `state` partagé (`public/js/dom.js`), aux côtés de `favorites`/`excludedAllergens` :
  - `isPlanning: false` (booléen)
  - `plannedRecipes: new Set()` (ids de recettes cochées)
- Aucune persistance (pas de localStorage, pas de sync Supabase) — la sélection vit uniquement en mémoire tant que l'app reste ouverte sur cette session, et se vide silencieusement en sortant du mode Planifier sans avoir cliqué "Ajouter au panier".

## Composants touchés

- **`public/index.html`** : nouveau bouton `#planBtn` dans `.header-actions`, à côté de `#cartToggle`. Nouvelle barre fixe en bas (`#planBar`, hidden par défaut) avec compteur et bouton d'ajout groupé.
- **`public/js/main.js`** : câblage du clic sur `#planBtn` (bascule `state.isPlanning`, réinitialise `state.plannedRecipes`, appelle `render()`).
- **`public/js/grid.js`** :
  - `renderGrid()` affiche une case à cocher sur chaque carte quand `state.isPlanning` est vrai (élément imbriqué avec `stopPropagation` pour ne pas déclencher l'ouverture de la fiche recette, même pattern que `.card-fav`). Positionnée en haut à gauche de `.card-photo` (coin opposé au cœur favori qui est en bas à droite, pour ne jamais se chevaucher).
  - Nouvelle fonction pour mettre à jour/afficher la barre fixe du bas (compteur + état activé/désactivé du bouton), appelée à chaque changement de sélection.
- **`public/js/cart.js`** : nouvelle fonction (ex. `addRecipesToCartBatch(recipeIds)`) qui boucle sur les ids sélectionnés et appelle `addRecipeToCart()` pour chacun avec ses ingrédients et son nombre de personnes par défaut (aucune nouvelle logique de fusion — réutilise le pipeline existant). Affiche le toast de confirmation groupé.
- **`public/style.css`** : styles pour la case à cocher sur les cartes (variante de `.card-fav`), pour le bouton "Planifier" de l'en-tête (variante de `.cart-toggle`), et pour la nouvelle barre fixe du bas (nouveau pattern `position:fixed; bottom:0`, premier du genre dans l'app).
- **`public/sw.js`** : bump `CACHE_NAME` (tous les fichiers JS/CSS ci-dessus sont mis en cache par le service worker).

## Cas particuliers

- **Recette déjà au panier** : `addRecipeToCart()` remplace l'entrée existante (comportement déjà en place) — pas de doublon.
- **Filtre/recherche actif pendant la sélection** : la sélection est indexée par id de recette, pas par position sur la grille — elle survit à un changement de filtre ou de recherche tant que le mode Planifier reste actif.
- **Grille vide ou recette supprimée entre-temps** : rien de spécifique — un id sélectionné qui ne correspond plus à aucune recette affichée est simplement ignoré silencieusement au moment de l'ajout groupé (garde défensive minimale, pas de message d'erreur pour un cas qui ne devrait pas arriver en usage normal).
- **Aucun test automatisé** : vérification manuelle dans le navigateur (comme pour tout le reste du projet), avec injection de données de test via le référentiel de recettes en mémoire.

## Hors périmètre (explicitement)

- Vue calendrier / assignation par jour de la semaine.
- Ajustement du nombre de personnes par recette avant l'ajout groupé.
- Sauvegarde de la sélection entre sessions ou rechargements de page.
