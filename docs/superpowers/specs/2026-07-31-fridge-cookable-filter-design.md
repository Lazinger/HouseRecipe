# "Cuisinable avec mon frigo" — Design

**Date :** 2026-07-31
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Deux fonctionnalités existent déjà séparément : Mon Frigo (inventaire personnel avec quantités) et "Vérifier mon frigo" (statut ok/manque/à vérifier par ingrédient, sur une recette à la fois, via `checkFridgeAvailability`). Il n'y a aucun moyen de savoir, à l'échelle de tout le carnet, quelles recettes sont déjà réalisables avec le contenu actuel du frigo — l'utilisateur doit ouvrir chaque recette une par une. Idée déjà envisagée en amont ([[project_roadmap_notes]], "que puis-je cuisiner avec ce que j'ai") mais jamais construite ; redevenue pertinente maintenant que Mon Frigo et la logique de comparaison existent déjà.

## Décision : puce additive sur la grille existante, pas un écran dédié

Contrairement à Saison ou Mon Frigo (écrans plein écran séparés), cette fonctionnalité est une nouvelle puce **"Cuisinable"** dans la barre de filtres déjà présente sur l'écran principal (`chip-row` : Tout / Entrées / Plats / Desserts / Mes favoris). Elle réutilise 100% du rendu de grille existant (recherche, filtre allergènes, filtre saison, catégories) — aucun nouvel écran, aucun nouveau composant de carte.

Différence de comportement avec les puces de catégorie : celles-ci sont **exclusives** (une seule active à la fois) ; "Cuisinable" est un **interrupteur additif** qui se combine avec n'importe quelle autre combinaison de filtres (ex. "Desserts cuisinables maintenant", "Mes favoris cuisinables"). Nouvel état `state.fridgeReadyToggle` (booléen), non persisté (comme le filtre de catégorie — réinitialisé à chaque rechargement, à la différence de `state.excludedAllergens` qui, lui, est sauvegardé en `localStorage`).

## Calcul et tri

Quand la puce est active, pour chaque recette de la liste déjà filtrée (catégorie/recherche/allergènes/saison appliqués normalement) :
- Appeler `checkFridgeAvailability(recette.ingredients, fridgeItems)` (déjà utilisé par "Vérifier mon frigo" sur la fiche recette — aucune nouvelle logique de comparaison).
- Compter les ingrédients au statut `"manque"` uniquement. Les ingrédients `"a-verifier"` (ex. unité incompatible entre la recette et le frigo, comme "1 boîte" vs "400 g") ne comptent **pas** comme manquants — cohérent avec la règle déjà appliquée ailleurs dans l'app : ne jamais pénaliser sur un cas ambigu.
- Trier la liste par ce nombre croissant (tri stable : à égalité, l'ordre naturel de `ALL_RECIPES` est conservé).

Aucune recette n'est masquée ou retirée de la liste — la puce ne fait que réordonner et étiqueter.

Les quantités utilisées sont celles de base de la recette (`recette.ingredients`, non mises à l'échelle selon un nombre de personnes) — cohérent avec le reste de la grille, qui n'ajuste jamais les portions avant ouverture de la fiche recette.

## Affichage

Quand la puce est active, chaque carte recette affiche un petit badge (absent sinon) :
- **0 manquant** → badge vert "Tout y est" (même teinte que le statut "ok" sur la fiche recette).
- **N ≥ 1 manquant** → badge orange/terracotta "N manquant(s)" (même teinte que le statut "manque" sur la fiche recette).

La puce elle-même a un état visuel actif/inactif (`aria-pressed`), comme le bouton favoris de l'en-tête (`favToggleHeader`).

## Portée technique

- `public/index.html` : nouvelle puce dans `.chip-row` (icône + texte "Cuisinable").
- `public/js/core/dom.js` : nouvel élément DOM exporté pour cette puce ; nouveau champ `state.fridgeReadyToggle` (booléen, `false` par défaut, non persisté).
- `public/js/recipes/grid.js` : import de `checkFridgeAvailability` (`./quantity.js`) et `fridgeItems` (`../planning/fridge.js`) ; `getFilteredRecipes()` reste pur (filtrage uniquement, inchangé) ; `renderGrid()` applique un tri supplémentaire sur son résultat quand `state.fridgeReadyToggle` est actif, avant de construire les cartes ; badge ajouté au template de carte ; listener de clic sur la nouvelle puce qui bascule `state.fridgeReadyToggle` et appelle `render()`.
- `public/style.css` : styles du badge (vert/orange, réutilisant les variables de couleur déjà utilisées pour les statuts ok/manque sur la fiche recette) et de la puce (état actif/inactif).

## Cas limites

- Une recette dont tous les ingrédients sont `"a-verifier"` (rien de clairement `"manque"`) remonte en tête avec le badge "Tout y est" — cohérent avec la règle "jamais de pénalité sur un cas ambigu", pas un bug.
- Frigo vide : toutes les recettes sont à égalité (aucune à 0 manquant) — la liste garde son ordre naturel, aucun état d'erreur à gérer.
- Sel/poivre (`isPantryStaple`) sont déjà toujours "ok" via `checkFridgeAvailability` existant — aucun changement nécessaire ici, comportement hérité automatiquement.

## Hors scope

- Pas de prise en compte du nombre de personnes/mise à l'échelle des quantités.
- Pas de persistance de l'état de la puce entre sessions ou rechargements.
- Aucun changement à "Vérifier mon frigo" sur la fiche recette, ni à `checkFridgeAvailability` elle-même (réutilisée telle quelle).
- Pas de nouvel écran dédié (décision explicite, voir section Décision).
- Pas de tri par pourcentage/proportion d'ingrédients disponibles (uniquement le compte brut de manquants) — plus simple à comprendre en un coup d'œil, suffisant pour cette première version.

## Vérification

Pas de suite de tests automatisée pour cette logique de tri/affichage (UI + données locales, cohérent avec le reste du projet) — vérification manuelle dans le navigateur :

- Frigo avec quelques ingrédients en stock, plusieurs recettes dans le carnet : activer "Cuisinable" → les recettes remontent triées par nombre d'ingrédients manquants croissant, badges corrects sur chaque carte.
- Recette entièrement couverte par le frigo → badge vert "Tout y est", en tête de liste.
- Combiner "Cuisinable" avec un filtre de catégorie (ex. "Desserts") → seules les recettes de la catégorie apparaissent, triées/étiquetées normalement.
- Désactiver la puce → badges disparaissent, ordre de la grille revient à la normale (aucune recette masquée à aucun moment).
- Frigo vide → la puce reste utilisable, aucune erreur console, ordre naturel conservé.
- Aucune erreur console sur l'ensemble de ces parcours.
