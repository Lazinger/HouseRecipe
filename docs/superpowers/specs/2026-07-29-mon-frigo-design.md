# Mon Frigo — inventaire personnel lié au panier

## Contexte

Idée proposée lors du brainstorming du 2026-07-29, en complément de la barre de recherche existante (qui ne fait que du texte libre sur titre/description/ingrédients, une recette à la fois). Objectif : un onglet "Mon Frigo" où l'utilisateur note les ingrédients qu'il a chez lui, pour que la liste "à acheter" du panier ne propose que ce qui manque réellement, plutôt que la quantité brute de la recette.

## Portée retenue

- **Personnel par compte**, pas partagé par le foyer (contrairement à `recipes`) — même modèle que le panier, les favoris, le planning.
- Le frigo ne suit **que la quantité**, en texte libre (comme les lignes d'ingrédients ailleurs dans l'app) — pas de statut "toujours en stock" pour les produits de base, pas de date de péremption.
- **Aucune automatisation de la consommation** : ajouter une recette au panier ne touche jamais au frigo. Cuisiner une recette ne décrémente rien automatiquement — l'utilisateur doit penser à ajuster les quantités du frigo lui-même après coup. C'est une limite acceptée pour cette version.
- Le frigo n'est mis à jour automatiquement que dans un seul sens : **à la hausse**, quand on valide des courses depuis le panier.

## Flux utilisateur

1. Un nouvel item "Mon Frigo" apparaît dans le tiroir de menu, à côté de Planning/Saison.
2. La vue "Mon Frigo" liste les ingrédients possédés sous forme de lignes éditables (nom + quantité), avec un bouton "+ Ajouter une ligne" et une croix pour retirer une ligne — même look que les lignes dynamiques du formulaire d'ajout de recette.
3. Le champ nom propose une autocomplétion (liste déroulante native `<datalist>`) construite à partir de tous les noms d'ingrédients déjà rencontrés dans les recettes, pour encourager à reprendre exactement le même nom — sans empêcher la saisie libre si rien ne correspond.
4. Chaque modification (ajout, édition, suppression d'une ligne) est sauvegardée au fil de l'eau, sans bouton "Enregistrer" séparé — comme le panier.
5. Dans le panier, la section "À acheter" ne montre plus le besoin brut des recettes mais le besoin **moins** ce qui est déjà dans le frigo (par ingrédient correspondant). Un ingrédient entièrement couvert par le frigo disparaît de la liste.
6. Un nouveau bouton **"Validé"** apparaît dans le panier à côté de "Vider le panier". Il prend la liste "à acheter" telle qu'affichée à cet instant, l'ajoute au frigo (les quantités achetées s'additionnent à ce qui existe déjà), puis vide le panier — même effet que "Vider le panier" en plus de la mise à jour du frigo.

## État et données

- **Nouvelle table Supabase `fridge_items`** (personnelle, RLS par `user_id`) :
  ```sql
  create table public.fridge_items (
    user_id uuid not null references auth.users(id),
    name text not null,
    qty text not null default '',
    updated_at timestamptz not null default now(),
    primary key (user_id, name)
  );
  ```
  Une ligne par ingrédient et par compte, clé primaire composite pour un upsert direct par nom.
- **Synchro** : même schéma que le reste de l'app — cache local + file d'attente hors-ligne (`write-queue.js`) pour que l'édition marche hors-ligne et se synchronise au retour réseau. Pas de nouveau mécanisme à inventer.
- **Nouveau module `public/js/planning/fridge.js`** (même dossier que `cart.js`/`meal-plan.js`, domaine "planification") :
  - `fridgeItems` — liste en mémoire `[name, qty][]`, chargée au démarrage (comme `cart`).
  - `initFridgeSync()` — charge depuis Supabase au démarrage, appelé depuis `main.js` comme `initCartSync()`.
  - `saveFridgeItem(name, qty)` / `removeFridgeItem(name)` — édition manuelle depuis la vue Mon Frigo.
  - `incrementFridgeItems(items)` — utilisé uniquement par le bouton "Validé" du panier ; additionne les quantités à ce qui existe déjà pour chaque nom (même logique de fusion que `mergeQuantityParts`, voir plus bas).
  - `getFridgeQtyFor(name)` — recherche par nom normalisé, utilisée par le panier pour le calcul de "à acheter".

## Composants touchés

- **`public/js/planning/fridge.js`** (nouveau) : logique décrite ci-dessus.
- **`public/js/recipes/quantity.js`** : nouvelle fonction `subtractQuantity(need, stock)` — voir "Logique de quantités" plus bas.
- **`public/js/planning/cart.js`** :
  - `mergeIngredientsForShopping()` : après la fusion habituelle des quantités par recette, soustrait la quantité en frigo pour chaque ingrédient via `subtractQuantity`. Un ingrédient dont le résultat est nul (`0`) est retiré de la liste "à acheter".
  - Nouveau bouton `#validateCartBtn` à côté de `#clearCartBtn` dans `renderPanier()` : appelle `incrementFridgeItems(merged)` avec la liste "à acheter" actuellement affichée, puis `clearCart()` (réutilisation directe de la fonction existante).
- **`public/js/core/dom.js`** : nouvelles références `fridgeView`, `fridgeScroll`, boutons associés (menu, fermeture) — même pattern que `mealPlanView`/`mealPlanScroll`.
- **`public/js/core/ui.js`** : `openFridge()`/`closeFridge()`, câblage dans `closeAnyOpenSheet()` et le tiroir de menu — même pattern que Planning/Saison.
- **`public/index.html`** : nouvelle vue plein écran pour Mon Frigo, nouvel item de menu dans le tiroir, `<datalist>` pour l'autocomplétion des noms.
- **`public/sw.js`** : ajout de `fridge.js` à `APP_SHELL`, `CACHE_NAME` incrémenté.
- **`supabase/schema.sql`** : migration `fridge_items` ajoutée en fin de fichier (append, comme les migrations précédentes), appliquée manuellement via Supabase MCP comme d'habitude sur ce projet.

## Logique de quantités

**`subtractQuantity(need, stock)`** (nouveau, dans `quantity.js`) :
- Parse les deux valeurs avec `parseQuantity` (déjà existant).
- Si l'une des deux ne se parse pas (ex. "selon les goûts"), ou si les unités diffèrent (comparaison insensible à la casse) → retourne `need` inchangé. Comportement de repli sûr : pas de déduction plutôt qu'un calcul faux.
- Sinon → `max(0, need.value - stock.value)`, reformaté avec `formatScaledNumber`, unité ré-accolée si non vide.

**Correspondance des noms** : même normalisation que le panier utilise déjà pour fusionner les ingrédients (`name.trim().toLowerCase()`) — réutilisée telle quelle, pas de nouvelle logique de correspondance à inventer.

**`incrementFridgeItems`** : réutilise la même logique de fusion de quantités que `mergeQuantityParts` (déjà dans `cart.js`, à extraire/partager si besoin) — même unité → addition ; unité différente ou absente → concaténation ("X + Y"), comportement déjà en place ailleurs dans l'app pour ce cas.

## Cas particuliers

- **Nom du frigo qui ne correspond à aucun ingrédient de recette** : reste simplement inutilisé pour le calcul du panier, aucune erreur, aucun message — l'autocomplétion réduit ce risque sans l'éliminer complètement.
- **Unité incompatible entre frigo et recette** (ex. "1 boîte" vs "400 g") : traité comme une non-correspondance, le besoin brut de la recette reste affiché intégralement dans "à acheter".
- **Frigo vide ou jamais renseigné** : comportement identique à aujourd'hui, "à acheter" affiche le besoin brut des recettes.
- **Retirer une recette du panier après ajout** : aucun impact sur le frigo, puisque le frigo n'est jamais modifié à l'ajout — seul "Validé" le modifie.
- **Panier vide** : le bouton "Validé", comme "Vider le panier" aujourd'hui, ne s'affiche pas du tout quand le panier est vide (les deux boutons vivent dans la branche non-vide de `renderPanier()`) — pas de nouvelle garde à ajouter, comportement hérité tel quel.

## Tests

- Quelques cas unitaires pour `subtractQuantity` dans `quantity.test.mjs` (même unité, unité différente, non parsable, résultat à zéro) — suit la convention déjà en place pour les fonctions pures de `quantity.js`.
- Aucun test automatisé de bout en bout (comme le reste du projet) : vérification manuelle dans le navigateur — remplir le frigo, ajouter une recette au panier, confirmer que "à acheter" reflète la déduction, cliquer "Validé", confirmer que le frigo est incrémenté et le panier vidé.

## Hors périmètre (explicitement)

- Décrément automatique du frigo à la cuisson/consommation d'une recette.
- Statut "toujours en stock" / produits de base ignorés du calcul.
- Dates de péremption, gestion de stock avancée (quantités par lot, historique).
- Frigo partagé par le foyer (reste personnel par compte pour cette version).
- Ajustement de la granularité d'achat (ex. "tu as besoin d'1 œuf mais on les vend par 6") — le calcul reste une simple soustraction arithmétique.
