# Vérifier le frigo / "J'ai fait la recette" — depuis la fiche recette

## Contexte

Idée proposée lors du brainstorming du 2026-07-30, en complément de [[Mon Frigo]] (2026-07-29, voir `2026-07-29-mon-frigo-design.md`), qui posait explicitement en hors périmètre : "Décrément automatique du frigo à la cuisson/consommation d'une recette". L'utilisateur veut désormais, depuis la fiche recette elle-même :
1. Vérifier en un clic si son frigo a de quoi faire la recette.
2. Décrémenter le frigo en un clic une fois la recette réellement cuisinée.

Ces deux actions ont mis en évidence une limite de Mon Frigo v1 : la quantité y est un texte libre, ce qui rend toute comparaison fiable impossible dès qu'on tape "1 CS" ou "1 boîte". L'utilisateur a choisi de restreindre Mon Frigo à des unités réellement quantifiables pour que la comparaison ait un sens.

## Portée retenue

- **Mon Frigo passe de "quantité en texte libre" à "nombre + unité fixe"** (g, kg, ml, L, pièce(s)). Le format stocké reste une chaîne (`"250 g"`) — compatible avec `parseQuantity` existant, aucune migration de schéma.
- **kg↔g et L↔ml sont convertis automatiquement** partout où une comparaison de quantité a lieu (déduction panier existante, nouvelle vérification frigo, nouveau décrément) — pas seulement dans les deux nouvelles fonctionnalités.
- Les unités de recette non quantifiables (CS, CC, pincée, sachet(s), tranche(s), "selon le goût"...) restent, elles, non comparables : un ingrédient de recette dans une telle unité tombera toujours dans l'état "à vérifier" (voir plus bas), quelle que soit la quantité au frigo.
- **"Vérifier mon frigo"** : annote chaque ligne d'ingrédient de la fiche recette (pas de popup séparée) avec un des 3 états : *ok* (vert), *manque* (rouge, avec la quantité manquante), *à vérifier* (gris, unité non comparable ou ingrédient absent du frigo dans une unité comparable — mais présent dans une unité incomparable serait aussi "à vérifier"; absent purement et simplement du frigo = *manque*, montré plus bas). Recalcul à la demande uniquement (bouton), pas automatique à l'ouverture de la fiche. Les annotations sont invalidées (retirées) si le nombre de personnes change, pour ne jamais afficher un résultat périmé.
- **"J'ai fait la recette"** : décrémente le frigo des quantités de la recette (mises à l'échelle selon le nombre de personnes courant). **Popup de confirmation personnalisée** avant d'appliquer (pas la boîte `confirm()` native du navigateur, dont les boutons ne sont pas personnalisables) : message explicite ("Valider retirera les ingrédients de cette recette de ton frigo. Continuer ?") avec deux boutons **Oui** / **Non**. "Non" (ou fermeture de la popup) annule sans rien modifier ; "Oui" applique le décrément. Ingrédients absents du frigo ou dans une unité incomparable : ignorés silencieusement (aucune erreur), comme le reste de la logique de quantités dans l'app.
- Les deux boutons vivent dans le panneau Ingrédients de la fiche recette, juste au-dessus du bouton existant "Ajouter au panier".

## Flux utilisateur

1. Dans "Mon Frigo", chaque ligne a maintenant : nom (texte + autocomplétion, inchangé), un champ nombre, et un menu déroulant d'unité (g / kg / ml / L / pièce(s), "g" par défaut sur une nouvelle ligne). La sauvegarde au fil de l'eau est inchangée (déclenchée au `change` de n'importe lequel des 3 champs).
2. Sur une fiche recette, deux nouveaux boutons secondaires apparaissent au-dessus de "Ajouter au panier" : **"Vérifier mon frigo"** et **"J'ai fait la recette"**.
3. Clic sur "Vérifier mon frigo" : chaque ligne d'ingrédient de la liste affichée se colore/s'annote selon son état (ok / manque X / à vérifier). Un nouveau clic sur "Vérifier mon frigo" (ou sur le stepper de personnes, qui invalide silencieusement l'annotation) relance le calcul.
4. Clic sur "J'ai fait la recette" : popup personnalisée ("Valider retirera les ingrédients de cette recette de ton frigo. Continuer ?", boutons **Oui** / **Non**). Sur "Oui", chaque ingrédient trouvé dans le frigo (unité comparable) voit sa quantité diminuée (jusqu'à 0, puis la ligne est supprimée du frigo) ; toast de confirmation ensuite. Sur "Non" (ou fermeture) : rien ne se passe.

## État et données

Aucune nouvelle table. `fridge_items.qty` continue de stocker une chaîne libre au niveau base — seule la *saisie* est restreinte côté UI à un format `"N unité"` généré par le formulaire.

## Composants touchés

- **`public/js/recipes/quantity.js`** :
  - Nouvelle fonction `normalizeQuantity(qty)` : appelle `parseQuantity`, puis convertit `kg`→`g` (valeur ×1000) et `l`/`L`→`ml` (valeur ×1000), insensible à la casse. Retourne `null` si `parseQuantity` échoue.
  - `subtractQuantity` et `mergeQuantityParts` : remplacent leur usage de `parseQuantity` par `normalizeQuantity` pour la comparaison d'unité et le calcul de valeur (le résultat formaté utilise donc l'unité normalisée — ex. un frigo "1 kg" moins un besoin "500 g" affichera "500 g", pas "0,5 kg"). C'est un changement de comportement volontaire et global (validé avec l'utilisateur), pas limité aux deux nouveaux boutons.
  - `applyFridgeStock` : idem, comparaison d'unité via `normalizeQuantity`.
  - Nouvelle fonction `checkFridgeAvailability(ingredients, fridgeItems)` : pour chaque `[name, qty]` d'ingrédient (déjà mis à l'échelle par l'appelant), cherche l'entrée frigo correspondante (même normalisation de nom que l'existant, `trim().toLowerCase()`) et renvoie `{ name, qty, status: "ok" | "manque" | "a-verifier", missing? }` :
    - Pas d'entrée frigo du tout → `status: "manque"`, `missing` = le besoin complet.
    - Entrée trouvée, `normalizeQuantity` échoue sur l'une des deux valeurs ou les unités normalisées diffèrent → `status: "a-verifier"`.
    - Entrée trouvée, unités identiques après normalisation, `stock.value >= need.value` → `status: "ok"`.
    - Entrée trouvée, `stock.value < need.value` → `status: "manque"`, `missing` = `need.value - stock.value` formaté (réutilise `formatScaledNumber`).
  - Nouveaux cas dans `quantity.test.mjs` pour `normalizeQuantity` et `checkFridgeAvailability` (voir Tests).

- **`public/js/planning/fridge.js`** :
  - Nouvelle fonction `decrementFridgeItems(ingredients)`, miroir de `incrementFridgeItems` existant : pour chaque `[name, qty]`, cherche l'entrée frigo ; si absente ou unité incomparable (`normalizeQuantity` échoue/diffère), ne fait rien pour cet ingrédient ; sinon calcule `max(0, stock.value - need.value)` et soit met à jour la ligne (si résultat > 0), soit la supprime via `removeFridgeItem` (si résultat === 0).
  - `addFridgeRow` / le rendu de `renderFridge` : le second `<input>` texte libre est remplacé par un `<input type="number" min="0" step="any">` + un `<select>` d'unités (g/kg/ml/L/pièce(s)). Ne touche pas à `createIngredientRow` dans `dyn-rows.js` (partagé avec le formulaire d'ajout de recette, qui doit garder la quantité en texte libre) — Mon Frigo construit sa propre ligne, pas via `createIngredientRow`.
  - La logique de commit (sauvegarde au `change`) combine `${valeur} ${unité}` en une seule chaîne avant d'appeler `saveFridgeItem`, comme aujourd'hui.

- **`public/js/core/ui.js`** :
  - Nouvelle fonction réutilisable `confirmModal(message, { confirmLabel = "Oui", cancelLabel = "Non" } = {})` → `Promise<boolean>`. Construit une petite popup (backdrop + boîte centrée, même famille visuelle que le reste de l'app) avec le message et deux boutons ; se résout à `true`/`false` puis se détruit. Remplace la boîte `confirm()` native partout où on veut des libellés de bouton personnalisés — utilisée ici par "J'ai fait la recette", réutilisable telle quelle pour un futur besoin similaire (ex. `deleteRecipe` dans `detail.js` utilise aujourd'hui `confirm()` natif ; pas touché par ce chantier, mais pourrait migrer plus tard).

- **`public/js/recipes/detail.js`** :
  - Deux nouveaux boutons secondaires (`#checkFridgeBtn` "Vérifier mon frigo", `#cookedRecipeBtn` "J'ai fait la recette") au-dessus de `#addToCartBtn`.
  - `ingredientRowHtml` : ajoute `data-ing-name="${escapeAttr(name)}"` sur le `<li>` pour permettre l'annotation post-rendu sans dupliquer le template de rendu.
  - `#checkFridgeBtn` : appelle `checkFridgeAvailability(currentIngredients(), fridgeItems)`, puis pour chaque résultat retrouve le `<li>` correspondant par `data-ing-name` et y ajoute une classe (`ing-ok` / `ing-manque` / `ing-a-verifier`) plus, si `status === "manque"`, un petit texte "manque {missing}".
  - `#cookedRecipeBtn` : `await confirmModal("Valider retirera les ingrédients de cette recette de ton frigo. Continuer ?")` ; si `true`, `decrementFridgeItems(currentIngredients())` (import depuis `fridge.js`, déjà importé ailleurs dans le module) + `showToast(...)`.
  - Les gestionnaires `minusBtn`/`plusBtn` (stepper personnes) : après `renderScaledIngredients()`, s'assurent que les classes d'annotation précédentes sont bien reparties (elles le sont de fait puisque `renderScaledIngredients` regénère le HTML des `<li>` depuis `ingredientRowHtml`, sans les classes d'état) — aucun code supplémentaire nécessaire, comportement hérité de la régénération du HTML.

- **CSS** (`public/style.css` ou équivalent) : classes `.ing-ok` / `.ing-manque` / `.ing-a-verifier` (couleur du texte/icône), styles des deux nouveaux boutons secondaires, mise en page de la nouvelle ligne Mon Frigo à 3 champs + croix, et le backdrop/boîte de `confirmModal`.

## Logique de quantités (détail)

**`normalizeQuantity(qty)`** :
```
parsed = parseQuantity(qty)
si parsed est null → retourner null
unit = parsed.unit.trim().toLowerCase()
si unit === "kg" → { value: parsed.value * 1000, unit: "g" }
si unit === "l" → { value: parsed.value * 1000, unit: "ml" }
sinon → { value: parsed.value, unit }
```

**`checkFridgeAvailability`** et **`decrementFridgeItems`** réutilisent cette même normalisation, pas de logique dupliquée.

**Correspondance des noms** : identique à l'existant (`name.trim().toLowerCase()`), pas de nouvelle logique.

## Cas particuliers

- **Ingrédient de recette dans une unité non quantifiable** (CS, CC, pincée, sachet(s), tranche(s), "selon le goût"...) : `normalizeQuantity` réussit à parser (retourne l'unité telle quelle, ex. `"cs"`) mais ne trouvera jamais de correspondance avec les unités fixes du frigo (g/kg/ml/L/pièce(s)) sauf coïncidence exacte de chaîne (ex. les deux valent "pièce(s)") → `status: "a-verifier"` dans l'immense majorité des cas. Documenté comme comportement attendu, pas un bug.
- **Ingrédient jamais renseigné au frigo** : `status: "manque"` avec la quantité complète en `missing` (pas "a-verifier" — l'absence pure et simple est un vrai manque, pas une ambiguïté).
- **Frigo vide** : "Vérifier mon frigo" marque tout en "manque" ; "J'ai fait la recette" ne fait rien nulle part (aucune ligne à décrémenter), toast de confirmation quand même affiché.
- **"J'ai fait la recette" avec quantités partiellement suffisantes** : chaque ingrédient est traité indépendamment ; certains peuvent atteindre 0 (et disparaître du frigo) pendant que d'autres restent avec un reliquat positif.
- **Fermeture de la popup `confirmModal` sans cliquer un bouton** (clic sur le fond, touche Échap) : équivaut à "Non", aucune modification du frigo.
- **Changement du nombre de personnes après un "Vérifier"** : les classes d'état sont perdues (regénération du HTML), aucun affichage trompeur ; l'utilisateur doit recliquer "Vérifier mon frigo" pour un résultat à jour à la nouvelle quantité.
- **Anciennes lignes Mon Frigo déjà en base avec une unité libre non standard** (ne devrait plus arriver après ce changement, mais possible via une synchro d'un autre appareil pas encore mis à jour, ou des données antérieures) : `parseQuantity`/`normalizeQuantity` les traitent comme n'importe quelle chaîne "nombre + unité" — pas de crash, juste `status: "a-verifier"` si l'unité ne correspond à rien de connu. Aucune migration nécessaire.

## Tests

- `quantity.test.mjs` : cas pour `normalizeQuantity` (kg→g, L→ml, unité déjà standard, valeur non parsable) ; cas pour `checkFridgeAvailability` (ok, manque avec quantité partielle, manque total ingrédient absent, à vérifier pour unité incomparable, à vérifier pour ingrédient présent en unité non quantifiable).
- Cas de non-régression pour `subtractQuantity`/`mergeQuantityParts`/`applyFridgeStock` avec des unités kg/L mélangées à g/ml, en plus des cas déjà existants.
- Vérification manuelle dans le navigateur (comme le reste du projet, pas de test de bout en bout automatisé) : saisir des quantités au frigo dans les nouvelles unités, vérifier une recette dont certains ingrédients sont couverts/partiellement couverts/absents/en unité non quantifiable, confirmer "J'ai fait la recette" et vérifier la décrémentation en base.

## Hors périmètre (explicitement)

- Conversion entre unités de nature différente (ex. "pièce(s)" vers "g" pour un ingrédient comptable — nécessiterait une base de densités par ingrédient, non demandée).
- Historique des recettes cuisinées / statistiques de consommation.
- Annulation ("J'ai fait la recette" n'a pas de bouton "annuler" — correction manuelle via Mon Frigo si erreur de clic, après confirmation explicite au clic).
- Rétro-migration des lignes `fridge_items` existantes vers le nouveau format restreint (le frigo de l'utilisateur est vide au moment de cette conception, donc sans objet immédiat ; si des lignes non conformes apparaissent plus tard, elles sont juste traitées comme "à vérifier", pas bloquantes).
