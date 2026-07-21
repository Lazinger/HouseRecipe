# Suppression d'une photo existante (recette + étapes) — Design

**Date :** 2026-07-21
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Dans le formulaire d'ajout/édition (`public/js/add-form.js`), les champs photo (`#addPhoto` pour la recette, `.step-photo-input` pour chaque étape) sont de simples `<input type="file">` vides en mode édition — sélectionner un fichier remplace la photo, laisser le champ vide la conserve. Il n'existe aucun moyen de la vider sans la remplacer par une autre image. Côté `public/js/photos.js`, une fonction interne `deletePhoto(key)` (suppression du cache IndexedDB local) et une fonction exportée `deleteAllPhotosForRecipe(recipeId)` (utilisée quand la recette entière est supprimée) existent déjà, mais rien n'est exposé pour supprimer une photo précise tout en gardant la recette.

## Portée

- Formulaire d'édition uniquement (`public/js/add-form.js`) — pas d'action de suppression sur la fiche recette (`detail.js`) elle-même.
- Photo principale de la recette **et** photos d'étape.
- S'applique uniquement en mode édition (`editingRecipe` non nul) — une nouvelle recette n'a jamais de photo existante à supprimer.

## UI du formulaire

Pour la photo principale et pour chaque étape pré-existante (issue de `editingRecipe.steps`, pas les lignes ajoutées via "+ Ajouter une étape") qui a effectivement une photo en stockage, le formulaire affiche au chargement, juste au-dessus du champ fichier correspondant :

- une miniature (60×60, `object-fit:cover`) de la photo actuelle
- un bouton **« Supprimer la photo »** à côté

Comportement :
- Clic sur "Supprimer" : la miniature et le bouton disparaissent, la photo est marquée pour suppression (état tenu en mémoire sur l'élément DOM de la ligne, ex. `dataset.photoRemoved = "1"`). Rien n'est envoyé au serveur avant la soumission du formulaire — cohérent avec le reste du formulaire, qui ne persiste rien avant "Enregistrer".
- Si l'utilisateur choisit ensuite un fichier dans le champ (juste après avoir supprimé, ou sans avoir supprimé), le nouveau fichier remplace comme aujourd'hui, et efface la marque de suppression le cas échéant.
- Pas de bouton "annuler la suppression" séparé : le bouton "Annuler" du formulaire entier permet déjà d'abandonner tout le formulaire sans effet.
- Détection de la photo existante : asynchrone au montage du formulaire (comme le fait déjà `applyDetailPhoto` sur la fiche recette) — la miniature/le bouton n'apparaissent que si une photo est effectivement trouvée pour cette clé.

## Nouvelles fonctions dans `photos.js`

```js
export async function removePhoto(recipeId)
export async function removeStepPhoto(recipeId, index)
export async function getMainPhoto(recipeId)   // pour la miniature de la photo principale ; getStepPhoto existe déjà pour les étapes
```

`removePhoto`/`removeStepPhoto` :
1. retirent l'entrée du cache IndexedDB local (réutilise la fonction interne `deletePhoto(key)` existante) ;
2. ajoutent la clé à `confirmedMissing` pour éviter une tentative de re-téléchargement inutile depuis Supabase Storage ;
3. suppriment côté Supabase Storage via `photoWriteHandler({ op: "delete", key })`, avec mise en file d'attente hors-ligne via `enqueue("photo", key, ...)` en cas d'échec réseau — même mécanisme que `deleteAllPhotosForRecipe`.

## Soumission du formulaire

- Photo principale : si un nouveau fichier est présent → `savePhoto` (inchangé) ; sinon, si marquée supprimée → `removePhoto(recipe.id)` ; sinon → rien (photo actuelle conservée, comportement inchangé).
- Étapes : même logique par ligne d'étape, appliquée à la **position finale** de l'étape dans le tableau soumis — les photos d'étape sont déjà adressées par position (pas par identité stable) dans le mécanisme de remplacement existant ; ce comportement n'est pas modifié.

## Hors scope

- Pas de undo après clic sur "Supprimer" autre que fermer/annuler le formulaire entier.
- Pas de gestion spéciale du réordonnancement des étapes (limitation déjà existante avec le remplacement, non traitée ici).
- Pas d'action de suppression depuis la fiche recette (`detail.js`).

## Implémentation (aperçu, détaillé dans le plan)

- **`public/js/photos.js`** : ajout de `removePhoto`, `removeStepPhoto`, `getMainPhoto`.
- **`public/js/add-form.js`** :
  - `renderAddForm` : nouvelle structure HTML (miniature + bouton) au-dessus de `#addPhoto`, masquée par défaut ; peuplée de façon asynchrone si `editingRecipe` a une photo.
  - `createStepRow` : accepte un index d'origine optionnel (uniquement pour les lignes pré-existantes en édition) pour la détection/l'affichage de la miniature ; nouvelle structure HTML similaire au-dessus de `.step-photo-input`.
  - Handler de soumission : applique `removePhoto`/`removeStepPhoto` selon les marques de suppression, avant/à la place des appels `savePhoto`/`saveStepPhoto` existants.
- **`public/style.css`** : styles pour la miniature + bouton (petite taille, alignement horizontal avec le bouton).
- **`public/sw.js`** : bump `CACHE_NAME` (v36 → v37), convention du projet.

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur :
- Éditer une recette avec photo principale : la miniature + "Supprimer la photo" apparaissent ; cliquer supprimer, enregistrer → la fiche recette n'affiche plus de photo, et rouvrir l'édition ne montre plus de miniature.
- Éditer une recette avec une photo d'étape : même parcours, au niveau de l'étape concernée.
- Éditer une recette avec photo, cliquer "Supprimer" puis choisir un nouveau fichier avant d'enregistrer : la nouvelle photo remplace, l'ancienne n'est pas supprimée à tort.
- Créer une nouvelle recette : aucune miniature/bouton de suppression n'apparaît jamais (pas de photo existante).
- Éditer une recette sans photo (principale ou étape) : aucune miniature/bouton n'apparaît pour ce champ.
- Aucune erreur console sur les parcours ci-dessus.
