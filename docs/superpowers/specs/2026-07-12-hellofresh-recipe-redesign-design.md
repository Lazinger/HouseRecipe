# Refonte fiche recette façon HelloFresh — design approuvé

Statut : **approuvé par l'utilisateur (maquettes V1→V5 dans `.superpowers/brainstorm/`), implémentation pas commencée.**

## Contexte

L'utilisateur recopie principalement des recettes issues de ses livraisons HelloFresh et veut que la fiche recette de l'app ressemble visuellement et structurellement à une vraie page recette HelloFresh — mêmes couleurs, mêmes infos, même typographie — plutôt qu'une simple inspiration adaptée au système "carnet lumineux épuré" actuel.

Ceci **remplace** l'identité visuelle "carnet lumineux épuré" (Fraunces/DM Sans, near-white, emerald unique) pour les pages concernées. Voir `[[project-le-carnet-overview]]` / mémoire `feedback-le-carnet-workflow` : ce projet a déjà vécu plusieurs redémarrages complets de direction visuelle — celui-ci est traité avec le même sérieux (maquettes itérées, spec écrite avant code).

## Décisions issues du brainstorming

1. **Périmètre** : le nouveau style (couleurs, police) s'applique à **tout le site**, pas seulement la fiche recette. Cette spec couvre en détail la **fiche recette** et le **formulaire d'ajout/édition** (qui doit reprendre le même style et le même ordre de champs, voir section dédiée plus bas — l'utilisateur recopie ses recettes depuis de vraies fiches HelloFresh, donc la cohérence entre formulaire et fiche facilite la saisie). La déclinaison sur l'accueil / la grille / le header / le panier / le tiroir de navigation réutilisera les mêmes tokens (couleurs, police) mais n'a pas été maquettée — à traiter comme une suite logique une fois la fiche recette validée en usage réel, pas dans le même plan d'implémentation (trop de surface pour une seule passe).
2. **Palette** : vert de marque HelloFresh (`#5C9A1B` foncé / `#8DC63F`-ish clair selon usage), fond crème `#FFFBF5`, texte quasi-noir `#1F1B16`. Remplace `--emerald`/`--bg`/`--ink` actuels (à décider en implémentation : nouveaux tokens ou réassignation des tokens existants — probablement réassignation pour ne pas dupliquer tout le système de variables).
3. **Typographie** : Poppins (bold/rounded sans-serif) remplace Fraunces (titres) et DM Sans (corps). **Pas la police propriétaire exacte de HelloFresh** (inaccessible/non libre) — Poppins est l'équivalent visuel le plus proche en police libre. Doit être **auto-hébergée en `.woff2`** (comme Fraunces/DM Sans/Caveat aujourd'hui) pour préserver le fonctionnement 100% hors-ligne — pas de dépendance Google Fonts CDN en prod.
4. **Structure de la fiche recette**, dans cet ordre (voir maquette V5) :
   - Bannière photo pleine largeur avec dégradé sombre en bas, titre + sous-titre en blanc superposés
   - Barre d'infos plate (pas de pavés/ombres) : libellé en petit au-dessus, valeur+icône en dessous — Temps, Personnes, Difficulté, + Calories/Protéines si renseignées
   - Description
   - Allergènes (si renseignés) : ligne de texte + note
   - Ingrédients : grille 2 colonnes, icône ronde pastel + nom + quantité (pas de photo réelle par ingrédient — pas de données pour ça)
   - Ustensiles (si renseignés) : ligne compacte séparée par des points
   - Valeurs nutritionnelles (si renseignées) : vraie table (Nutriments | Par portion | pour 100g)
   - Préparation : étapes numérotées, **format inchangé** (une phrase = une étape, voir décision 6), avec photo optionnelle par étape
   - Boutons Ajouter au panier / Minuteur
5. **Exclusions volontaires** (infos présentes dans les captures HelloFresh mais spécifiques à la livraison en kit, sans équivalent pertinent pour une recette recopiée à la maison) :
   - Origine des ingrédients (tags FR/UE)
   - Section "Non inclus dans la livraison"
   - Tags diététiques/rapidité (Végétarien, Rapide, Épicé) — pas de donnée source actuelle, pourra être ajouté plus tard si besoin s'en fait sentir
6. **Étapes : pas de restructuration en titre + sous-puces.** Les captures HelloFresh groupent plusieurs actions sous un titre avec une liste à puces ; on garde le modèle actuel (`steps: string[]`, une étape = une carte numérotée) pour ne pas casser les 8 recettes existantes ni complexifier le formulaire d'ajout. Chaque étape peut avoir une photo optionnelle associée.

## Modèle de données — changements

Champs **optionnels**, ajoutés à l'objet recette (recettes existantes non affectées, sections masquées si absentes) :

```js
{
  // ... champs existants inchangés (id, title, category, icon, desc, time, servings, difficulty, ingredients, steps, note) ...
  nutrition: { calories: number, protein: number } | undefined,  // ex. { calories: 783, protein: 20.2 }
  allergens: string | undefined,   // texte libre, ex. "Gluten, blé, lait (lactose)"
  utensils: string[] | undefined  // ex. ["Casserole", "Poêle avec couvercle"]
}
```

`steps` **ne change pas de forme** (reste `string[]`). Les photos par étape ne sont **pas** stockées dans l'objet recette — elles suivent le pattern déjà en place pour la photo principale (IndexedDB, jamais dans `localStorage`/JSON).

## Stockage des photos par étape

Réutilise la DB IndexedDB existante (`carnet-photos`, store `photos`), déjà keyed par recipe id pour la photo principale. Pas de changement de schéma : les clés sont des chaînes libres.

- Photo principale : clé `recipeId` (inchangé)
- Photo d'étape `i` (0-indexé) : clé `` `${recipeId}::step::${i}` ``

`getPhoto`/`savePhoto` fonctionnent tels quels avec ces clés composites. `deletePhoto(recipeId)` (suppression de recette) doit être étendu pour supprimer aussi toutes les clés `${recipeId}::step::*` — utiliser un curseur avec `IDBKeyRange.bound(recipeId, recipeId + '￿')` plutôt qu'un `delete` simple, puisqu'il faut couvrir plusieurs clés.

## Export / import JSON

`nutrition`, `allergens`, `utensils` sont du texte/nombres simples → **inclus** dans l'export comme les autres champs texte (title, desc, etc.). Les photos (principale et par étape) restent **exclues** de l'export, comme aujourd'hui (binaire, IndexedDB, hors export volontairement).

## Formulaire d'ajout/édition (`renderAddForm`)

**Décision ajoutée après revue de la spec** : l'utilisateur recopie ses recettes depuis de vraies fiches HelloFresh papier/appli. Le formulaire doit donc :
1. Reprendre le **même habillage visuel** que la fiche recette (Poppins, vert, mêmes styles de champs) plutôt que le style carnet actuel — un formulaire qui a déjà l'air d'une fiche HelloFresh est plus rapide à remplir en recopiant une vraie fiche sous les yeux.
2. Suivre le **même ordre de champs que l'ordre d'affichage de la fiche recette** (voir structure ci-dessus), pour que recopier une recette HelloFresh se fasse dans l'ordre où l'info apparaît sur l'originale : Titre → Catégorie/Difficulté → Description → Temps/Personnes → Calories/Protéines → Allergènes → Photo principale → Ingrédients → Ustensiles → Étapes (texte + photo par étape) → Astuce.

Nouveaux champs, tous optionnels :
- Calories (number), Protéines en g (number) — deux inputs courts, même ligne, positionnés juste après Temps/Personnes
- Allergènes (text, libre), positionné juste après Calories/Protéines
- Ustensiles : liste dynamique (même pattern que les lignes d'étapes actuelles — un input texte par ligne, bouton "+ Ajouter un ustensile"), positionnée entre Ingrédients et Étapes
- Chaque ligne d'étape existante (`createStepRow`) gagne un input `type="file"` optionnel pour sa photo, en plus du texte. À la soumission, pour chaque ligne d'étape ayant un fichier sélectionné : `savePhoto(`${recipe.id}::step::${index}`, file)`.

## Rendu de la fiche recette (`openDetail` / template HTML)

- Bannière, barre d'infos plate, tags, description, allergènes, ingrédients, ustensiles, nutrition, étapes+photo : voir maquette V5 (`.superpowers/brainstorm/52-1783876660/content/recipe-detail-v5-hellofresh-exact.html`) pour le CSS/markup de référence — à adapter dans `style.css`/`script.js` avec les vraies classes du site (pas de duplication de nom de classe avec le système actuel).
- Chaque section optionnelle (allergènes/ustensiles/nutrition/calories-protéines) : `hidden` ou non générée si la donnée est absente — pas de section vide affichée.
- Photo d'étape : `getPhoto(`${recipeId}::step::${i}`)` en fire-and-forget après le rendu de la liste d'étapes (même pattern async que `applyCardPhoto`/`applyDetailPhoto` existants), insère une vignette si trouvée.

## Cohérence avec le reste de l'app

- Remplace les tokens de couleur/police dans `style.css` (probablement réassignation de `--emerald`→vert HelloFresh, `--bg`/`--ink`, `--font-display`/`--font-body`→Poppins) plutôt que duplication — à trancher en écrivant le plan.
- Nouvelle police à ajouter dans `fonts/` (`.woff2`) + `@font-face` en haut de `style.css`, suivant exactement le pattern Fraunces/DM Sans/Caveat déjà en place (voir `[[project-le-carnet-overview]]`, point sur les polices auto-hébergées).
- Le pattern des vues plein écran (`.detail-view`, `position:fixed; inset:0`) ne change pas.

## Prochaine étape

Écrire un plan d'implémentation (`writing-plans`) pour la **fiche recette + le formulaire d'ajout/édition** (périmètre de cette spec) : modèle de données, stockage photos par étape, formulaire (nouveaux champs, réordonnancement, restyle), rendu de la fiche, palette/police. La déclinaison du style au reste du site (accueil, grille, header) sera un projet suivant, une fois la fiche recette validée en usage réel.
