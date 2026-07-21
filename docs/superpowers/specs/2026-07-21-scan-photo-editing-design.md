# Édition photo à la capture (scan) + bouton d'amélioration — Design

**Date :** 2026-07-21
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Dans "Scanner une recette" (`public/js/scan-recipe.js`), l'écran d'édition de photo (`openPhotoEditor`, zoom/pan/pivoter) ne s'ouvre aujourd'hui qu'une seule fois, après avoir cliqué "Extraire" et attendu la fin de l'analyse IA — et uniquement sur la première photo capturée. Un utilisateur qui prend une photo mais ne clique jamais "Extraire" (par exemple parce qu'il ne sait pas que ce bouton déclenche aussi l'édition) n'a donc jamais l'occasion d'ajuster sa photo. C'est le problème signalé : "j'ai voulu ajouter une recette en prenant une photo mais je n'ai pas eu la possibilité de modifier la photo".

Par ailleurs, l'éditeur photo (`public/js/photo-editor.js`) est un composant partagé utilisé à 3 endroits (photo principale de recette en 16:9, photo d'étape en 1:1, et maintenant la capture de scan) mais n'offre aujourd'hui que recadrage/zoom/pivoter — pas de réglage de luminosité, alors que les photos prises au téléphone (notamment de livres/pages de recettes) sont souvent mal exposées, ce qui nuit à la fois au rendu visuel et à la qualité de l'extraction IA.

## Portée

- `public/js/scan-recipe.js` : déplacer le déclenchement de l'édition de "après Extraire" à "après chaque photo prise".
- `public/js/photo-editor.js` : accepter un ratio d'aspect optionnel (ratio naturel de l'image si omis), et ajouter un bouton "Améliorer" (luminosité/contraste/saturation).
- `public/style.css` : style du nouvel état actif du bouton "Améliorer".
- Pas de changement aux flux d'édition existants pour la photo principale et les photos d'étape autre que l'apparition du nouveau bouton "Améliorer" (ils gardent leur ratio d'aspect fixe actuel, 16:9 et 1:1 respectivement).

## Édition à chaque photo capturée

- Le bouton "+ Ajouter une photo" du scan déclenche toujours la capture caméra (`#scanCameraInput`), mais son handler `change` ouvre désormais `openPhotoEditor` immédiatement sur le fichier capturé, **avant** de l'ajouter à `capturedFiles` :
  - Si c'est la première photo (`capturedFiles.length === 0` au moment de la capture) : édition avec le ratio fixe **16:9**, identique au comportement actuel — c'est cette photo qui devient la photo affichée de la recette.
  - Sinon (2e à 4e photo, qui ne servent qu'à l'extraction IA et sont jetées après analyse) : édition avec le **ratio naturel de la photo** (aucun recadrage forcé) — l'utilisateur peut pivoter/zoomer s'il le souhaite, mais rien n'est coupé par défaut. Évite de perdre des informations utiles (ex. une liste d'ingrédients en haut/bas de l'image) avant l'extraction.
  - Si l'utilisateur annule l'édition (bouton Annuler ou ✕), la photo est écartée — elle n'est pas ajoutée à `capturedFiles`, l'utilisateur peut la reprendre.
  - Si l'utilisateur valide, c'est le blob édité (pas le fichier brut) qui est ajouté à `capturedFiles` et affiché en miniature.
- L'appel à `openPhotoEditor` déclenché après "Extraire" (ajouté le 20 juillet dans `c7293b8`) est retiré — il devient redondant puisque l'édition a déjà eu lieu à la capture. Le clic sur "Extraire" enchaîne directement sur l'analyse IA (`scanRecipeImages`) puis `sanitizeExtractedRecipe(raw, capturedFiles[0])`, sans étape d'édition intermédiaire.

**Limite acceptée :** si l'utilisateur prend 2 photos puis supprime la 1re (bouton ✕ sur la miniature), la 2e devient `capturedFiles[0]` (photo principale) sans avoir été éditée en 16:9 — elle avait été éditée en ratio naturel au moment de sa capture. Cas rare, non traité automatiquement (pas de re-déclenchement d'édition sur suppression) — cohérent avec la tolérance déjà acceptée pour un cas similaire sur les photos d'étape (positionnement par index final, pas par identité stable).

## Bouton "Améliorer" dans l'éditeur photo

- Nouveau bouton dans l'écran d'édition (`public/js/photo-editor.js`), à côté du bouton "Pivoter" existant — donc disponible dans les 3 contextes qui utilisent l'éditeur (photo principale, photo d'étape, capture de scan).
- **Comportement bascule (on/off) :** un clic active une amélioration fixe (luminosité, contraste et saturation légèrement augmentés) appliquée au rendu du canevas ; un second clic la désactive. Le bouton change d'apparence à l'état actif (fond coloré) pour indiquer l'état.
- L'amélioration s'applique aussi bien à l'aperçu en temps réel qu'à l'image finale exportée (donc la photo réellement sauvegardée / envoyée à l'IA reflète l'état du bouton au moment de valider).
- Pas de réglage manuel fin (pas de curseur séparé) — un seul niveau fixe, pour rester simple.
- Techniquement : `ctx.filter = "brightness(1.15) contrast(1.1) saturate(1.05)"` (API Canvas 2D) appliqué juste avant `ctx.drawImage` dans la fonction de rendu partagée `drawFrame` quand actif (sinon `ctx.filter = "none"`), à l'intérieur du `ctx.save()/ctx.restore()` déjà en place — pas de fuite d'état entre les rendus.

## Ratio d'aspect optionnel dans `openPhotoEditor`

- `openPhotoEditor(blob, aspectRatio)` accepte désormais un `aspectRatio` omis/`undefined` — dans ce cas, le ratio utilisé (pour l'aperçu et l'export final) est calculé à partir des dimensions naturelles de l'image chargée (`img.naturalWidth / img.naturalHeight`), une fois l'image chargée.
- Les appels existants (photo principale `16/9`, photo d'étape `1`) sont inchangés — seul le nouvel appel pour les photos de scan autres que la première omet ce paramètre.

## Hors scope

- Pas de réglage manuel de luminosité/contraste (curseur) — un bouton on/off fixe uniquement.
- Pas de re-déclenchement automatique de l'édition si l'ordre des photos capturées change après coup (voir "Limite acceptée" plus haut).
- Pas de changement à la façon dont les photos sont sauvegardées/synchronisées (`public/js/photos.js`) — cette spec ne touche que l'édition en amont de la sauvegarde.

## Implémentation (aperçu, détaillé dans le plan)

- **`public/js/photo-editor.js`** :
  - `drawFrame(...)` reçoit un paramètre `enhanced` supplémentaire, applique `ctx.filter` en conséquence.
  - `openPhotoEditor(blob, aspectRatio)` : si `aspectRatio` est absent, le déduire de `img.naturalWidth/img.naturalHeight` après chargement. Nouvel état local `enhanced` (défaut `false`), nouveau bouton "Améliorer" câblé pour bascule + re-rendu, utilisé aussi dans le rendu de l'export final (bouton Valider).
- **`public/js/scan-recipe.js`** : le handler `change` de `#scanCameraInput` ouvre `openPhotoEditor` sur le fichier capturé (16:9 si c'est la première photo, sans ratio sinon) avant de pousser le résultat dans `capturedFiles` ; le handler du bouton "Extraire" perd son appel à `openPhotoEditor`.
- **`public/style.css`** : état visuel actif du bouton "Améliorer" (ex. fond `--emerald` comme les autres actions primaires), et éventuel ajustement de mise en page pour accueillir 2 boutons (Pivoter + Améliorer) côte à côte dans l'écran d'édition.
- **`public/sw.js`** : bump `CACHE_NAME`, convention du projet.

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur :
- Scanner une recette, prendre une photo : l'écran d'édition s'ouvre immédiatement avec un cadrage 16:9 (mêmes proportions qu'avant).
- Annuler cette édition : la photo n'apparaît pas dans les miniatures, le bouton "Extraire" reste désactivé s'il n'y a aucune autre photo.
- Valider cette édition : la miniature apparaît avec la version éditée.
- Prendre une 2e photo : l'écran d'édition s'ouvre avec le ratio naturel de cette photo (pas de recadrage visible par défaut), pivoter/zoomer fonctionne normalement.
- Cliquer "Extraire" : l'analyse IA se lance directement (pas de nouvel écran d'édition entre "Analyse en cours…" et le formulaire pré-rempli).
- Dans l'écran d'édition (n'importe quel contexte : photo principale, photo d'étape, capture de scan), cliquer "Améliorer" : l'aperçu devient visiblement plus lumineux/contrasté, le bouton change d'apparence ; cliquer à nouveau annule l'effet et l'apparence du bouton revient à l'état initial.
- Valider une photo avec "Améliorer" actif : la photo sauvegardée/affichée reflète bien l'amélioration (comparer avec/sans dans le rendu final).
- Aucune erreur console sur l'ensemble de ces parcours.
