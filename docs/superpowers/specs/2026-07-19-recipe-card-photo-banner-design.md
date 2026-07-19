# Photo pleine largeur sur les cartes recette — Design

**Date :** 2026-07-19
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Sur la grille d'accueil, la photo d'une recette n'apparaît aujourd'hui que dans une petite icône 42×42 (`.card-icon`) en haut de la carte — trop petite pour bien voir le plat. L'utilisateur veut que la photo remplisse une portion nettement plus grande de la carte. Deux options visuelles ont été comparées (maquettes) : un bandeau photo pleine largeur en haut de la carte, ou la photo en fond de carte entière avec le texte en surimpression (dégradé sombre). L'option **bandeau en haut** a été choisie — plus sûre en lisibilité (le texte reste sur fond clair, indépendant de la photo) et plus proche de la référence que l'utilisateur avait annotée.

## Portée

- Les cartes de la grille de recettes (`.recipe-card`, rendues par `renderGrid()` dans `public/js/grid.js`).
- La carte "recette du jour" mise en avant (`.hero-card`/`.hero-art`, rendue par `renderHero()` dans le même fichier) — confirmé inclus par l'utilisateur.
- Pas d'autre emplacement concerné (fiche recette détaillée, panier, etc. gardent leur traitement photo actuel, déjà en place depuis B4).

## Cartes de la grille

- La zone photo devient un bandeau pleine largeur en haut de la carte, hauteur fixe (~150px), image recadrée en `object-fit:cover`.
- **Avec photo :** l'image remplit le bandeau.
- **Sans photo** (recette sans photo uploadée — encore la majorité) : le bandeau garde la même hauteur (alignement cohérent dans la grille), rempli par le fond teinté par catégorie déjà utilisé aujourd'hui (`--accent-tint`), avec l'icône de catégorie agrandie et centrée dedans (au lieu du petit 42×42 actuel).
- Le bouton favori (cœur) passe en cercle blanc semi-transparent flottant, chevauchant légèrement le bas du bandeau côté droit (au-dessus du texte) — remplace sa position actuelle à côté de la petite icône.
- Catégorie / titre / description / infos (temps, personnes, difficulté) restent en dessous du bandeau, sur le fond clair habituel de la carte, inchangés dans leur contenu et leur ordre.

## Carte "recette du jour"

- Structure en 2 colonnes inchangée (texte à gauche, panneau à droite).
- Le panneau de droite (`.hero-art`) reçoit le même traitement : avec photo, l'image remplit tout le panneau (`object-fit:cover`) ; sans photo, fond teinté par catégorie + icône agrandie et centrée, comme aujourd'hui mais à la même taille agrandie que les cartes normales.

## Implémentation (aperçu, détaillé dans le plan)

- **`public/js/photos.js`** : la fonction existante `applyCardPhoto(recipeId, iconEl)` est déjà générique (ajoute la classe `has-photo` et injecte une `<img>`) — réutilisable telle quelle pour le bandeau de la grille et pour `.hero-art`, sans modification.
- **`public/js/grid.js`** : `renderGrid()` continue d'appeler `applyCardPhoto` sur l'élément bandeau (renommé/restructuré en HTML, voir plus bas) ; `renderHero()` doit désormais aussi appeler `applyCardPhoto` sur `.hero-art`.
- **`public/style.css`** : nouvelles règles pour le bandeau de carte (taille, `object-fit`, état `has-photo` vs fond teinté + icône agrandie) et mise à jour de `.hero-art`/`.hero-art.has-photo` pour le même traitement ; repositionnement du bouton favori en cercle flottant.
- **`public/sw.js`** : bump `CACHE_NAME` (convention du projet).

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur :
- Une recette avec photo affiche l'image en bandeau plein largeur sur la carte de la grille, favori toujours cliquable en cercle flottant.
- Une recette sans photo affiche le fond teinté + icône agrandie, même hauteur de bandeau que les cartes avec photo (grille visuellement alignée).
- La carte "recette du jour" applique le même traitement dans son panneau de droite, avec et sans photo.
- Aucune régression sur le clic (carte entière cliquable, favori cliquable indépendamment) après le changement de structure.
