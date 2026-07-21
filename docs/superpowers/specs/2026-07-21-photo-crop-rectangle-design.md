# Cadre de recadrage à poignées (remplace zoom + déplacement) — Design

**Date :** 2026-07-21
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

L'éditeur photo partagé (`public/js/photo-editor.js`, utilisé pour la photo principale de recette, les photos d'étape, et les photos capturées via "Scanner une recette") recadre aujourd'hui par un mécanisme de zoom + déplacement : la photo est affichée derrière un cadre fixe (de la forme du ratio cible), et l'utilisateur la fait glisser / zoome pour choisir ce qui reste visible. Retour utilisateur après usage réel : ce principe manque de précision, l'utilisateur veut pouvoir "rogner l'image parfaitement".

## Portée

- `public/js/photo-editor.js` uniquement — remplace entièrement le mécanisme d'interaction (zoom/pan → cadre de recadrage à poignées), pour les 3 contextes qui utilisent ce composant.
- Le bouton "Pivoter" (rotation 90°) et le bouton "Améliorer" (luminosité/contraste, ajouté récemment) sont conservés tels quels.
- Le curseur de zoom disparaît.
- Aucun changement à `public/js/add-form.js` ou `public/js/scan-recipe.js` — ils continuent d'appeler `openPhotoEditor(blob, aspectRatio)` avec la même signature qu'aujourd'hui (`16/9` pour la photo principale, `1` pour une étape, omis pour une photo de scan autre que la première).

## Nouveau mécanisme

**Affichage :** la photo entière est dessinée dans le canevas, à l'échelle "contenir" (elle tient en entier, centrée, sans être rognée à l'affichage) — contrairement à aujourd'hui où le canevas a la forme du ratio cible et la photo le remplit en débordant.

**Cadre de recadrage :** un rectangle est dessiné par-dessus la photo, avec une poignée à chacun de ses 4 coins.
- Faire glisser **à l'intérieur** du cadre le déplace (sans le redimensionner).
- Faire glisser **une poignée** le redimensionne depuis le coin opposé (qui reste fixe).
- La zone hors du cadre est légèrement assombrie, pour distinguer clairement ce qui sera gardé.
- **Ratio imposé** (photo principale 16:9, photo d'étape 1:1, c'est-à-dire chaque fois que l'appelant passe un `aspectRatio` explicite) : le redimensionnement conserve toujours cette forme — seule la partie de la photo sélectionnée change, jamais la forme finale.
- **Ratio libre** (photo de scan sans `aspectRatio`, cas déjà existant) : le redimensionnement est libre dans les deux dimensions.
- **Le cadre peut dépasser les bords de la photo** (jusqu'aux limites du canevas de travail) : la zone qui dépasse est simplement remplie avec le fond neutre déjà utilisé aujourd'hui pour les zones sans photo. Un seul geste couvre donc à la fois "rogner" (cadre plus petit que la photo) et "adapter/montrer toute la photo" (cadre plus grand, avec marges neutres) — pas de bouton séparé.
- **Position/taille par défaut :** au chargement, et à chaque clic sur "Pivoter", le cadre est recentré à la plus grande taille respectant le ratio (imposé ou, en ratio libre, la photo entière) qui tient dans la photo affichée. Pivoter ne tente pas de conserver la position relative du cadre précédent — trop complexe pour le bénéfice, on repart d'un cadrage par défaut propre.
- Taille minimale du cadre appliquée (évite un cadre dégénéré, quasi nul) ; le cadre reste toujours contenu dans le canevas de travail (il peut dépasser la photo, pas le canevas lui-même).

**Amélioration (luminosité/contraste) :** inchangée, s'applique toujours à l'ensemble du rendu (aperçu et export final), indépendamment du cadre.

## Export final

La photo exportée reflète exactement le cadre au moment de valider :
- Les dimensions de sortie suivent le ratio réel du cadre final (toujours le ratio imposé quand il y en a un ; le ratio choisi par l'utilisateur en mode libre).
- La zone de la photo source qui correspond au cadre est dessinée dans l'image de sortie ; toute portion du cadre qui dépassait la photo reste en fond neutre dans l'image exportée aussi (cohérence aperçu ↔ export).

## Hors scope

- Pas de saisie numérique précise des dimensions du cadre (uniquement à la souris/au doigt).
- Pas de conservation de la position du cadre lors d'une rotation (reset au cadrage par défaut, voir plus haut).
- Pas de zoom "d'appoint" (loupe) en complément du redimensionnement du cadre.

## Implémentation (aperçu, détaillé dans le plan)

- **`public/js/photo-editor.js`** : remplacement de l'état `zoom/panX/panY` par un état de cadre (`cropX, cropY, cropW, cropH`, en coordonnées du canevas), et d'un flag "ratio imposé ou libre" dérivé de la présence de `aspectRatio`. Le rendu dessine la photo en "contenir", puis le cadre (zone assombrie hors cadre + bordure + poignées). Les handlers `pointerdown/pointermove/pointerup` sont réécrits pour distinguer "déplacer le cadre" vs "redimensionner depuis une poignée" selon la position de départ du pointeur. Le champ HTML du curseur de zoom est retiré. Le calcul de l'image finale exportée mappe le cadre (coordonnées canevas) vers les pixels de la photo source, avec remplissage en fond neutre pour toute portion hors photo.
- **`public/style.css`** : éventuel ajustement mineur si la suppression du champ zoom change l'espacement vertical de l'écran d'édition (à confirmer dans le plan).
- **`public/sw.js`** : bump `CACHE_NAME`, convention du projet.

## Vérification

Pas de suite de tests automatisée — vérification manuelle dans le navigateur, dans les 3 contextes (photo principale, photo d'étape, capture de scan) :
- À l'ouverture, le cadre apparaît centré sur la photo entière visible, à la bonne forme (16:9 / 1:1 / photo entière selon le contexte).
- Glisser à l'intérieur du cadre le déplace sans changer sa taille.
- Glisser une poignée de coin le redimensionne en gardant la forme imposée (photo principale, étape) ou librement (scan, photo autre que la 1re).
- Agrandir le cadre au-delà des bords de la photo : la zone qui dépasse apparaît en fond neutre, aussi bien dans l'aperçu que dans la photo validée.
- "Pivoter" fait tourner la photo et remet le cadre à sa position par défaut.
- "Améliorer" fonctionne comme avant, indépendamment du cadrage.
- Valider produit une photo dont le cadrage correspond exactement à ce qui était visible dans le cadre au moment du clic.
- Aucune erreur console sur l'ensemble de ces parcours.
