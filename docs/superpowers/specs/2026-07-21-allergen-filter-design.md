# Filtre par allergène — Design

**Date :** 2026-07-21
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Chaque recette a aujourd'hui un champ "Allergènes" en texte libre (ex. "Gluten, blé, lait"), affiché sur la fiche recette mais pas exploitable pour filtrer. L'utilisateur veut pouvoir masquer automatiquement les recettes contenant certains allergènes (usage sécurité/allergie pour un membre du foyer).

## Décision structurante : liste fixe plutôt que texte libre

Le texte libre actuel ne peut pas servir de base fiable à un filtre (graphies différentes, "blé" vs "gluten", etc.). Le champ "Allergènes" passe donc d'un texte libre à une sélection dans une liste fixe des **14 allergènes à déclaration obligatoire** (réglementation UE) :

```
gluten, crustacés, œufs, poisson, arachides, soja, lait,
fruits à coque, céleri, moutarde, sésame, sulfites, lupin, mollusques
```

**Conséquence acceptée et validée par l'utilisateur :** le texte libre déjà saisi dans les recettes existantes n'est pas reconverti automatiquement — la migration réinitialise ce champ à vide pour toutes les recettes actuelles. L'utilisateur les recochera manuellement au besoin.

## Portée

- `public/js/recipes-data.js` : nouvelle liste statique `ALLERGENS` (clé + libellé).
- `public/js/add-form.js` : le champ texte "Allergènes" devient un groupe de 14 cases à cocher.
- `public/js/detail.js` : affiche les libellés des allergènes cochés au lieu du texte libre.
- `public/js/scan-recipe.js` : l'allergène extrait par l'IA (texte libre) n'est plus assigné à la recette pré-remplie (incompatible avec le nouveau format) — l'utilisateur coche manuellement après le scan, comme pour une recette existante à mettre à jour.
- `public/js/sync.js` : les fonctions `rowToRecipe`/`recipeToRow` passent le tableau d'allergènes tel quel (déjà le comportement de `ingredients`/`utensils`, pas de sérialisation manuelle nécessaire).
- `supabase/schema.sql` + migration SQL manuelle : colonne `allergens` passe de `text` à `jsonb`, cohérent avec `ingredients`/`steps`/`utensils`.
- Nouveau bouton "Filtres" à côté de la barre de recherche (`public/index.html`, `public/js/main.js`, `public/style.css`) ouvrant un petit panneau avec les 14 cases à cocher (allergènes à **exclure**) ; badge sur le bouton avec le nombre de filtres actifs.
- `public/js/grid.js` : `getFilteredRecipes()` exclut toute recette dont `allergens` contient au moins un des allergènes cochés dans le filtre.
- `public/js/dom.js` : nouvel état `state.excludedAllergens` (un `Set`), persistant en `localStorage` (clé dédiée, même mécanisme que `state.favorites` aujourd'hui), initialisé au chargement du module.

## Comportement du filtre

- Le panneau "Filtres" s'ouvre/se ferme au clic sur le bouton, se ferme aussi au clic en dehors du panneau ou sur Échap — pas besoin du mécanisme de feuille remontante/historique existant (réservé aux vues pleine page), un petit panneau positionné sous le bouton suffit.
- Cocher un allergène dans le panneau masque immédiatement (sans validation supplémentaire) toute recette dont la liste d'allergènes contient cette valeur — combiné avec les filtres de catégorie et la recherche texte déjà en place (toutes les conditions s'appliquent ensemble).
- Une recette sans aucun allergène renseigné n'est jamais masquée par ce filtre.
- La sélection reste active après fermeture du panneau et après rechargement de l'app (persistée en `localStorage`, comme les favoris).
- Le badge du bouton "Filtres" affiche le nombre d'allergènes actuellement exclus (masqué si 0).

## Hors scope

- Pas de tentative de conversion automatique de l'ancien texte libre vers la nouvelle liste (voir "Conséquence acceptée" plus haut).
- Pas de tentative de faire correspondre le texte libre extrait par l'IA du scan aux 14 allergènes (l'utilisateur coche manuellement après scan).
- Pas de synchronisation de la sélection de filtre entre appareils/comptes du foyer (préférence locale uniquement, comme un filtre de recherche — à la différence des favoris qui sont, eux, synchronisés par compte).
- Pas de mode "ne montrer que les recettes contenant X" (seulement l'exclusion).

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur :
- Éditer une recette : le champ Allergènes propose 14 cases à cocher ; cocher 2-3, enregistrer, rouvrir l'édition → les mêmes cases restent cochées.
- La fiche recette affiche les libellés des allergènes cochés (pas de texte libre résiduel).
- Ouvrir le panneau "Filtres", cocher "Gluten" → toute recette dont les allergènes incluent "Gluten" disparaît de la grille ; les autres restent ; le badge affiche "1".
- Décocher → la recette réapparaît, badge disparaît.
- Recharger la page avec un filtre actif → le filtre reste appliqué (badge toujours affiché, recettes toujours masquées) sans avoir à recocher.
- Scanner une recette dont la photo mentionne des allergènes : le formulaire pré-rempli n'a aucune case pré-cochée (comportement attendu, pas une régression).
- Aucune erreur console sur l'ensemble de ces parcours.
