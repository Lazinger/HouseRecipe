# Recadrage/rotation de photo + fiche recette compacte sur téléphone — Design

**Date :** 2026-07-20
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Le test en direct du scan de recette (carte HelloFresh photographiée au téléphone, auto-attachée comme photo principale) a révélé deux problèmes préexistants, jusqu'ici masqués par le fait que peu de recettes avaient une vraie photo :

1. **Aucun contrôle sur le cadrage/l'orientation** de la photo choisie (scan ou manuel) — une photo mal orientée ou mal cadrée s'affiche telle quelle.
2. **`.detail-hero`** (le bandeau photo de la fiche recette) est en `position:sticky` avec une hauteur qui suit son contenu (titre + description + boutons superposés sur la photo) au lieu d'une taille fixe — avec une vraie photo, ça peut dépasser 300-400px et rester collé en haut de l'écran pendant tout le défilement, réduisant l'accès au reste de la recette sur un petit écran.

Une troisième amélioration a été demandée en cours de route pour le même objectif (fiche recette plus compacte sur téléphone) : tronquer la description courte avec un lien d'expansion.

## Portée

- Un outil de recadrage/rotation réutilisable, utilisé à 3 endroits : champ photo principale (choix manuel), champs photo d'étape (choix manuel), photo auto-attachée par le flux de scan.
- Refonte de `.detail-hero` : bandeau photo à ratio fixe, non-sticky, séparé du bloc titre/description.
- Troncature de `.detail-sub` (description courte) à 2 lignes avec lien "Voir plus".
- Hors périmètre : pas de librairie tierce (l'app n'a aucune dépendance externe, fonctionne 100% hors-ligne) ; pas de geste de pincement pour le zoom (un curseur suffit, plus fiable à coder sans librairie) ; pas de recadrage automatique par IA.

## Outil de recadrage/rotation (`public/js/photo-editor.js`, nouveau)

**Interface :** `export function openPhotoEditor(blob, aspectRatio)` → `Promise<Blob|null>`. `aspectRatio` est un nombre (largeur/hauteur, ex. `16/9` ou `1`). Résout avec la photo éditée (Blob JPEG) si l'utilisateur valide, `null` s'il annule.

**Vue plein écran** (même pattern `.detail-view` que les autres vues de l'app : `photoEditorView`/`photoEditorScroll` dans `index.html`, exports dans `dom.js`, intégration dans `ui.js`/`main.js` comme `scanView` l'a été) :
- La photo est affichée dans un cadre centré au ratio demandé, avec un masque semi-transparent en dehors du cadre.
- **Déplacer :** glisser au doigt/souris repositionne la photo dans le cadre (pan).
- **Zoom :** un curseur (`<input type="range">`) de 1× à 3×.
- **Pivoter :** un bouton qui tourne la photo de 90° à chaque tap (4 taps = tour complet).
- **Valider :** dessine la zone visible dans le cadre sur un `<canvas>` (taille de sortie fixe, ex. 1200×675 pour 16:9 ou 800×800 pour 1:1) et résout la promesse avec le résultat (`canvas.toBlob(..., "image/jpeg", 0.85)`).
- **Annuler :** résout avec `null`.

Aucune dépendance externe (pas de librairie de crop) — implémentation par manipulation directe de `<canvas>` (transformations `translate`/`rotate`/`scale` du contexte 2D).

## Points d'intégration

1. **Photo principale du formulaire** (`public/js/add-form.js`, champ `#addPhoto`) : à chaque changement de fichier, appelle `openPhotoEditor(file, 16/9)` ; si le résultat n'est pas `null`, remplace le fichier attaché via l'astuce `DataTransfer` déjà utilisée pour la photo scannée. Si l'utilisateur annule, le champ reste vide (aucune photo choisie).
2. **Photos d'étape** (`public/js/add-form.js`, chaque `.step-photo-input`) : même principe, avec `openPhotoEditor(file, 1)` (ratio 1:1, cohérent avec l'affichage en vignette carrée 56×56 existant).
3. **Flux de scan** (`public/js/scan-recipe.js`) : juste après `sanitizeExtractedRecipe`, avant `openAddForm`, appelle `openPhotoEditor(capturedFiles[0], 16/9)` sur la première photo capturée ; le résultat (ou la photo d'origine si l'utilisateur annule l'édition) devient `prefillData.photoBlob`.

Dans les trois cas, si l'utilisateur annule l'édition, le comportement retombe sur "pas de photo" plutôt que de bloquer le flux — cohérent avec le principe existant que rien n'est jamais obligatoire pour ce champ.

## Refonte de `.detail-hero` (fiche recette)

- La photo passe dans un bandeau à ratio fixe 16:9 (même famille de traitement que les bandeaux de carte de la grille), `object-fit:cover`, **plus de `position:sticky`** — il défile normalement avec le reste de la fiche.
- Le bloc titre/catégorie/description/boutons d'action, actuellement superposé sur la photo, passe **en dessous** du bandeau, sur le fond clair habituel de la fiche (comme le reste du contenu).
- Sans photo, le bandeau garde le fond dégradé actuel par catégorie (`--accent-tint` → `--accent`), sans changement visuel par rapport à aujourd'hui à part le ratio fixe.
- `public/js/photos.js` : `applyDetailPhoto(recipeId, heroEl)` passe d'un `background-image` CSS à une vraie balise `<img>` avec `object-fit:cover` à l'intérieur du bandeau (plus simple à contraindre proprement à un ratio fixe qu'un `background-image` sur un conteneur `position:sticky` — qui disparaît de toute façon).

## Description courte tronquée

`.detail-sub` limité à 2 lignes par défaut via `-webkit-line-clamp:2; overflow:hidden`. Un script vérifie après rendu si `scrollHeight > clientHeight` (texte réellement tronqué) ; si oui, affiche un lien "Voir plus" juste après. Un clic retire le `line-clamp` (texte complet visible) et fait disparaître le lien. Si le texte tient déjà en 2 lignes, aucun lien n'apparaît.

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur :
- Choisir une photo principale dans le formulaire → l'éditeur s'ouvre en 16:9, déplacer/zoomer/pivoter fonctionnent, valider attache la photo éditée, annuler laisse le champ vide.
- Même test sur une photo d'étape, en 1:1.
- Scanner une recette → après extraction, l'éditeur s'ouvre sur la première photo avant que le formulaire pré-rempli n'apparaisse.
- Fiche recette avec photo : bandeau à ratio fixe, défile normalement (n'est plus collé en haut), titre/description bien lisibles en dessous.
- Fiche recette sans photo : fond dégradé par catégorie inchangé, même ratio de bandeau.
- Description longue : 2 lignes + "Voir plus" visible, clic affiche le texte complet et fait disparaître le lien. Description courte : pas de lien.
- Aucune régression sur le reste de la fiche recette (favoris, panier, minuteur, étapes).
