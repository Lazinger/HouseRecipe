# Robustesse du découpage nom/quantité + élargissement sel/poivre — Design

**Date :** 2026-08-03
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Deux recettes scannées ("Pavés de saumon sauce soja", "Cake aux olives sans gluten") avaient des ingrédients dont le nom et la quantité étaient inversés ("Soja" / "4 sauce" au lieu de "Sauce soja" / "4 CS" ; "Séchées" / "12 tomates" au lieu de "Tomates séchées" / "12"). Corrigées manuellement en base le 2026-08-03. Cette fiche vise à empêcher que le même bug se reproduise sur une future recette importée/scannée, et traite au passage une demande connexe : élargir la reconnaissance "sel/poivre toujours disponibles" à toutes leurs variantes.

Root cause identifiée : `splitLeadingQuantity` (`public/js/recipes/quantity.js`), appelée par `normalizeIngredientPair` quand une recette importée arrive avec un nom brut et aucune quantité séparée (cas du chemin JSON-LD de `import-recipe-url`, et du scan photo). Ses branches `withConnector` et `unitAndName` acceptent **n'importe quel mot** situé juste après le nombre comme étant "l'unité", sans vérifier qu'il s'agit réellement d'une unité de mesure. Pour "12 tomates séchées", ça découpe unité="tomates" (faux), nom="séchées" (faux) — le vrai nom composé "tomates séchées" se retrouve coupé en deux à travers la frontière quantité/nom.

## Tâche A : liste blanche des unités reconnues

Nouvelle constante `KNOWN_QUANTITY_UNITS` dans `quantity.js` (insensible à la casse). Doit couvrir aussi bien la forme "avec parenthèse" que l'app utilise en interne (ex. `"pièce(s)"`, déjà un cas de test existant) que les formes brutes singulier/pluriel telles qu'elles apparaissent réellement dans un texte scrapé (ex. `"pièces"`, `"pièce"`) :
```
g, kg, ml, cl, l, cs, cc,
pinc., pincée, pincées,
pièce, pièces, pièce(s),
sachet, sachets, sachet(s),
tranche, tranches, tranche(s),
pot, pots, pot(s),
botte, bottes, botte(s),
paquet, paquets, paquet(s),
filet, filets, filet(s),
noix, cm,
pavé, pavés, pavé(s),
gousse, gousses, gousse(s),
feuille, feuilles, feuille(s),
boîte, boîtes, boite, boites, boîte(s), boite(s)
```

Comportement modifié de `splitLeadingQuantity` :
- `withConnector` (ex. "150 g de pistaches") : ne matche que si le mot capturé comme unité figure dans `KNOWN_QUANTITY_UNITS`. Sinon, le motif est traité comme non concluant et on essaie la branche suivante.
- `unitAndName` (ex. "1 pièce(s) Poireau") : même contrainte.
- `countOnly` est remplacé par un repli plus général : si aucune unité reconnue n'a permis de découper, mais que la chaîne commence bien par un nombre, on sépare ce nombre et on garde **tout le reste** comme nom (qu'il fasse un ou plusieurs mots), sans unité. "4 sauce soja" → nom "Sauce soja", quantité "4". "1 huile d'olive" → nom "Huile d'olive", quantité "1". "3 oeufs" → nom "Oeufs", quantité "3" (comportement déjà existant, désormais couvert par ce même repli généralisé plutôt qu'un cas séparé à un seul mot).
- `toTaste` ("selon le goût...") est inchangé, essayé en dernier comme aujourd'hui.

Aucun changement à `LEADING_QUANTITY_UNIT_RE`/`UNIT_PATTERNS` (CS/CC/pinc./gousse déjà whitelistés par construction, utilisés par `normalizeIngredientPair` avant même d'appeler `splitLeadingQuantity`) ni à la fonction `normalizeIngredientPair` elle-même — seul `splitLeadingQuantity` change.

**Conséquence acceptée :** quand aucune unité n'est reconnue, l'ingrédient garde son nom complet (avec adjectifs/qualificatifs) et une quantité réduite au nombre brut, sans unité affichée. C'est un compromis assumé : mieux vaut une quantité incomplète (que l'utilisateur peut corriger à la main dans le formulaire) qu'une quantité/nom faux avec un total silencieux de confiance.

## Tâche B : élargir `isPantryStaple`

`isPantryStaple` (même fichier) passe d'une règle "tous les mots du nom sont sel/poivre" (combinaisons exactes uniquement) à une règle "au moins un mot entier du nom est *sel* ou *poivre*". Simplification du code au passage : la liste de mots ignorés ("et"/"de"/"d") devient inutile avec la nouvelle règle (on ne vérifie plus que TOUS les mots correspondent, donc les connecteurs n'ont plus besoin d'être filtrés).

Exemples qui passent de `false` à `true` : "Fleur de sel", "morceau de sel", "Poivre noir", "poivre du Pérou", "pincée de poivre".

**Garde-fou (comportement inchangé, à ne pas casser) :** la comparaison reste sur des mots entiers, pas des sous-chaînes — "Poivron" (poivron ≠ poivre) et "Céleri" restent des ingrédients normaux à acheter/vérifier. C'est le point le plus important à couvrir par des tests, car une comparaison par sous-chaîne braderait "poivron" à tort.

Aucun autre fichier ne change : `isPantryStaple` est déjà appelée par `checkFridgeAvailability` (statut "ok" automatique) et par `mergeIngredientsForShopping` dans `cart.js` (exclusion de la liste "à acheter") — l'élargissement s'applique donc automatiquement à toutes les recettes existantes et futures, sans traitement spécifique "à l'import" à ajouter.

## Portée technique

- `public/js/recipes/quantity.js` : `KNOWN_QUANTITY_UNITS` (nouvelle constante), `splitLeadingQuantity` (modifiée), `isPantryStaple` (modifiée).
- `public/js/recipes/quantity.test.mjs` : mise à jour des cas existants pour `isPantryStaple` ("Poivre noir" et "Fleur de sel" passent à `true`), nouveaux cas pour les deux tâches (voir Vérification).
- Aucun changement à `normalizeIngredientPair`, `checkFridgeAvailability`, `cart.js`, aux edge functions, ni à la base de données.

## Hors scope

- Pas de nouvelle passe de relecture automatique sur les recettes déjà en base (les deux recettes connues ont été corrigées manuellement le 2026-08-03) — cette fiche ne couvre que la prévention pour le futur.
- Pas de changement aux regex de repérage `{{qty:Nom}}` dans les étapes (`import-recipe-url`, edge function) — rôle différent (retrouver une quantité déjà connue dans un texte), non concerné par le bug.
- Pas d'extension de `isPantryStaple` à d'autres ingrédients "toujours disponibles" (huile, eau...) — uniquement sel/poivre, comme demandé.

## Vérification

Suite de tests existante (`quantity.test.mjs`, Node, pas de framework) :
- `splitLeadingQuantity`/`normalizeIngredientPair` : ajouter des cas pour "12 tomates séchées" → `["Tomates séchées", "12"]`, "4 sauce soja" → `["Sauce soja", "4"]`, "1 huile d'olive" → `["Huile d'olive", "1"]`, en plus de tous les cas déjà existants qui doivent continuer à passer inchangés (150 g de pistaches, 1 pièce(s) Poireau, 3 oeufs, etc.).
- `isPantryStaple` : mettre à jour "Poivre noir" et "Fleur de sel" à `true` ; ajouter "morceau de sel", "poivre du Pérou", "pincée de poivre" (`true`) ; ajouter "Poivron" et "Céleri" (`false`, garde-fou anti-faux-positif).
- Lancer `node public/js/recipes/quantity.test.mjs`, tous les cas doivent passer.
