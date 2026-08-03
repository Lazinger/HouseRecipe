# Robustesse du découpage nom/quantité + sel/poivre élargi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent future recipe imports from producing name/quantity pairs where a real measurement unit gets swapped with the ingredient's own name (e.g. "Soja"/"4 sauce" instead of "Sauce soja"/"4 CS"), and widen automatic "always in stock" recognition for salt/pepper to any variant containing those words.

**Architecture:** Both changes live entirely in `public/js/recipes/quantity.js`, a pure-function module with an existing Node test suite (`quantity.test.mjs`, no framework, run via `node public/js/recipes/quantity.test.mjs`). Task 1 makes `splitLeadingQuantity` only treat a word as a unit if it's in a new whitelist (`KNOWN_QUANTITY_UNITS`), replacing its previous "any word after the number is the unit" assumption; when no whitelisted unit is found, it falls back to keeping the full remaining text as the name with just the bare leading number as quantity. Task 2 changes `isPantryStaple` from "every word in the name must be sel/poivre" to "at least one whole word in the name is sel or poivre".

**Tech Stack:** Vanilla JS (ES modules), Node's built-in `assert` module for tests, no framework, no build step.

## Global Constraints

- Both tasks touch only `public/js/recipes/quantity.js` and its test file `public/js/recipes/quantity.test.mjs` — no other file changes.
- Every currently-passing case in `quantity.test.mjs` must keep passing unchanged (this is an existing, working test suite for a function used across imports, cart, and fridge features — regressions here are high-blast-radius).
- No new dependencies, no build step.
- `isPantryStaple` must match on whole words only, never substrings — "Poivron" (bell pepper) and "Céleri" must never be treated as a pantry staple.

---

### Task 1: Whitelist known units in `splitLeadingQuantity`

**Files:**
- Modify: `public/js/recipes/quantity.js:41-62` (the `splitLeadingQuantity` function and its doc comment)
- Modify: `public/js/recipes/quantity.test.mjs:4-26` (the `cases` array used to test `normalizeIngredientPair`, which calls `splitLeadingQuantity` internally)

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change — `splitLeadingQuantity(name)` still returns `{ qty, name }` or `null`, and `normalizeIngredientPair` (unchanged, calls `splitLeadingQuantity` internally) still returns `[name, qty]`. Task 2 does not depend on this task's internals.

- [ ] **Step 1: Add 3 failing test cases to `quantity.test.mjs`**

Find this exact block (lines 4-26):

```js
const cases = [
  { input: ["1 cuillère à soupe d'huile d'olive", ""], expected: ["Huile d'olive", "1 CS"] },
  { input: ["Huile d'olive", "1 cuillère à soupe"], expected: ["Huile d'olive", "1 CS"] },
  { input: ["farine", "200 g"], expected: ["Farine", "200 g"] },
  { input: ["2 gousses d'ail", ""], expected: ["Ail", "2 gousses"] },
  { input: ["ail", "1 gousse"], expected: ["Ail", "1 gousse"] },
  { input: ["sel", "1 pincée"], expected: ["Sel", "1 pinc."] },
  { input: ["1 càc de vanille", ""], expected: ["Vanille", "1 CC"] },
  { input: ["1 c. à s. de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["poivre", ""], expected: ["Poivre", ""] },
  { input: ["1 pièce(s) Poireau", ""], expected: ["Poireau", "1 pièce(s)"] },
  { input: ["1 c. à soupe de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["Vanille", "1 c. à café"], expected: ["Vanille", "1 CC"] },
  { input: ["Huile d'olive", "1 cs"], expected: ["Huile d'olive", "1 CS"] },
  { input: ["Beurre", "2 cc"], expected: ["Beurre", "2 CC"] },
  { input: ["Noix de muscade", "1 pincée(s)"], expected: ["Noix de muscade", "1 pinc."] },
  { input: ["1 pincée(s) de sel", ""], expected: ["Sel", "1 pinc."] },
  { input: ["1 cs de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["150 g de pistaches", ""], expected: ["Pistaches", "150 g"] },
  { input: ["140 g de beurre fondu", ""], expected: ["Beurre fondu", "140 g"] },
  { input: ["120 g d'eau", ""], expected: ["Eau", "120 g"] },
  { input: ["3 oeufs", ""], expected: ["Oeufs", "3"] }
];
```

Replace it with (3 new cases appended at the end, reproducing the exact real-world bugs found and fixed manually in the database on 2026-08-03):

```js
const cases = [
  { input: ["1 cuillère à soupe d'huile d'olive", ""], expected: ["Huile d'olive", "1 CS"] },
  { input: ["Huile d'olive", "1 cuillère à soupe"], expected: ["Huile d'olive", "1 CS"] },
  { input: ["farine", "200 g"], expected: ["Farine", "200 g"] },
  { input: ["2 gousses d'ail", ""], expected: ["Ail", "2 gousses"] },
  { input: ["ail", "1 gousse"], expected: ["Ail", "1 gousse"] },
  { input: ["sel", "1 pincée"], expected: ["Sel", "1 pinc."] },
  { input: ["1 càc de vanille", ""], expected: ["Vanille", "1 CC"] },
  { input: ["1 c. à s. de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["poivre", ""], expected: ["Poivre", ""] },
  { input: ["1 pièce(s) Poireau", ""], expected: ["Poireau", "1 pièce(s)"] },
  { input: ["1 c. à soupe de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["Vanille", "1 c. à café"], expected: ["Vanille", "1 CC"] },
  { input: ["Huile d'olive", "1 cs"], expected: ["Huile d'olive", "1 CS"] },
  { input: ["Beurre", "2 cc"], expected: ["Beurre", "2 CC"] },
  { input: ["Noix de muscade", "1 pincée(s)"], expected: ["Noix de muscade", "1 pinc."] },
  { input: ["1 pincée(s) de sel", ""], expected: ["Sel", "1 pinc."] },
  { input: ["1 cs de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["150 g de pistaches", ""], expected: ["Pistaches", "150 g"] },
  { input: ["140 g de beurre fondu", ""], expected: ["Beurre fondu", "140 g"] },
  { input: ["120 g d'eau", ""], expected: ["Eau", "120 g"] },
  { input: ["3 oeufs", ""], expected: ["Oeufs", "3"] },
  { input: ["12 tomates séchées", ""], expected: ["Tomates séchées", "12"] },
  { input: ["4 sauce soja", ""], expected: ["Sauce soja", "4"] },
  { input: ["1 huile d'olive", ""], expected: ["Huile d'olive", "1"] }
];
```

- [ ] **Step 2: Run the test to verify the 3 new cases fail**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: the first block of output (`cas passes.` / `FAIL:` lines for `normalizeIngredientPair`) shows 3 failures, specifically:
```
FAIL: normalizeIngredientPair(["12 tomates séchées",""]) => ["Séchées","12 tomates"], attendu ["Tomates séchées","12"]
FAIL: normalizeIngredientPair(["4 sauce soja",""]) => ["Soja","4 sauce"], attendu ["Sauce soja","4"]
FAIL: normalizeIngredientPair(["1 huile d'olive",""]) => ["Olive","1 huile"], attendu ["Huile d'olive","1"]
3/24 cas en echec.
```
(The exact wrong output reproduces the real bug found in production on 2026-08-03 — this confirms the test is actually exercising the broken behavior before you fix it.)

- [ ] **Step 3: Add the unit whitelist and rewrite `splitLeadingQuantity` in `quantity.js`**

Find this exact block (lines 41-62):

```js
/* ---- extraction d'une quantité collée en tête du nom d'un ingrédient.
   Trois formes reelles rencontrees a l'import, essayees de la plus specifique
   a la plus generale :
   1. "150 g de pistaches" / "120 g d'eau" -> unite + connecteur a retirer.
   2. "1 pièce(s) Poireau" -> unite directement suivie du nom, sans connecteur.
   3. "3 oeufs" -> pas d'unite separee, le mot final EST le nom. ---- */
export function splitLeadingQuantity(name){
  const text = String(name).trim();

  const withConnector = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)\s+(?:de\s+|d')(.+)$/);
  if (withConnector) return { qty: `${withConnector[1]} ${withConnector[2]}`, name: withConnector[3].trim() };

  const unitAndName = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)\s+(.+)$/);
  if (unitAndName) return { qty: `${unitAndName[1]} ${unitAndName[2]}`, name: unitAndName[3].trim() };

  const countOnly = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)$/);
  if (countOnly) return { qty: countOnly[1], name: countOnly[2].trim() };

  const toTaste = text.match(/^(selon (?:le|votre|vos) goûts?)\s+(.+)$/i);
  if (toTaste) return { qty: toTaste[1], name: toTaste[2].trim() };
  return null;
}
```

Replace it with:

```js
/* ---- unites reconnues pour la 1ere et la 2eme forme ci-dessous : sans
   cette liste, splitLeadingQuantity acceptait n'importe quel mot comme
   "l'unite" (ex. "12 tomates sechees" -> unite="tomates", nom="sechees",
   confirme en base le 2026-08-03 sur 2 recettes scannees ou le nom et la
   quantite avaient ete inverses). Couvre a la fois la forme "avec
   parenthese" que l'app utilise en interne (ex. "pièce(s)") et les formes
   brutes singulier/pluriel telles qu'elles apparaissent dans un texte
   scrape. ---- */
const KNOWN_QUANTITY_UNITS = new Set([
  "g", "kg", "ml", "cl", "l", "cs", "cc",
  "pinc.", "pincée", "pincées",
  "pièce", "pièces", "pièce(s)",
  "sachet", "sachets", "sachet(s)",
  "tranche", "tranches", "tranche(s)",
  "pot", "pots", "pot(s)",
  "botte", "bottes", "botte(s)",
  "paquet", "paquets", "paquet(s)",
  "filet", "filets", "filet(s)",
  "noix", "cm",
  "pavé", "pavés", "pavé(s)",
  "gousse", "gousses", "gousse(s)",
  "feuille", "feuilles", "feuille(s)",
  "boîte", "boîtes", "boite", "boites", "boîte(s)", "boite(s)"
]);

/* ---- extraction d'une quantité collée en tête du nom d'un ingrédient.
   Formes reelles rencontrees a l'import, essayees de la plus specifique
   a la plus generale :
   1. "150 g de pistaches" / "120 g d'eau" -> unite reconnue + connecteur a retirer.
   2. "1 pièce(s) Poireau" -> unite reconnue directement suivie du nom, sans connecteur.
   3. "3 oeufs" / "4 sauce soja" -> aucune unite reconnue : le nombre est
      separe mais tout le reste (un ou plusieurs mots) reste le nom, sans
      unite invente. Repli volontairement conservateur : mieux vaut une
      quantite incomplete (a corriger a la main) qu'un nom/quantite faux
      avec un decoupage qui a l'air correct. ---- */
export function splitLeadingQuantity(name){
  const text = String(name).trim();

  const withConnector = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)\s+(?:de\s+|d')(.+)$/);
  if (withConnector && KNOWN_QUANTITY_UNITS.has(withConnector[2].toLowerCase())) {
    return { qty: `${withConnector[1]} ${withConnector[2]}`, name: withConnector[3].trim() };
  }

  const unitAndName = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)\s+(.+)$/);
  if (unitAndName && KNOWN_QUANTITY_UNITS.has(unitAndName[2].toLowerCase())) {
    return { qty: `${unitAndName[1]} ${unitAndName[2]}`, name: unitAndName[3].trim() };
  }

  const noUnit = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(.+)$/);
  if (noUnit) return { qty: noUnit[1], name: noUnit[2].trim() };

  const toTaste = text.match(/^(selon (?:le|votre|vos) goûts?)\s+(.+)$/i);
  if (toTaste) return { qty: toTaste[1], name: toTaste[2].trim() };
  return null;
}
```

- [ ] **Step 4: Run the test to verify all cases pass**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: the first line of output reads `OK: 24 cas passes.` (21 previous + 3 new), and every other test block below it (`resolveStepQuantities`, `subtractQuantity`, etc.) still prints its own `OK:` line with its original count — nothing else in the file should regress, since this task only touches `splitLeadingQuantity`.

- [ ] **Step 5: Commit**

```bash
git add public/js/recipes/quantity.js public/js/recipes/quantity.test.mjs
git commit -m "Restreindre splitLeadingQuantity a une liste d'unites reconnues"
```

---

### Task 2: Widen `isPantryStaple` to match salt/pepper as whole words anywhere

**Files:**
- Modify: `public/js/recipes/quantity.js:191-207` (the `PANTRY_STAPLE_WORDS`/`PANTRY_STAPLE_IGNORED_WORDS` constants, doc comment, and `isPantryStaple` function)
- Modify: `public/js/recipes/quantity.test.mjs:303-312` (the `pantryStapleCases` array)

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature change — `isPantryStaple(name)` still returns a boolean. Already consumed elsewhere (`checkFridgeAvailability` in this same file, and `mergeIngredientsForShopping` in `public/js/planning/cart.js`) — neither needs any change, since both just call `isPantryStaple(name)` and use the boolean result as before.

- [ ] **Step 1: Update `pantryStapleCases` in `quantity.test.mjs` (2 changed expectations + 5 new cases)**

Find this exact block (lines 303-312):

```js
const pantryStapleCases = [
  { input: "Sel", expected: true },
  { input: "Poivre", expected: true },
  { input: "Sel et poivre", expected: true },
  { input: "Poivre et sel", expected: true },
  { input: "Sel, poivre", expected: true },
  { input: "Poivre noir", expected: false },
  { input: "Fleur de sel", expected: false },
  { input: "Farine", expected: false }
];
```

Replace it with:

```js
const pantryStapleCases = [
  { input: "Sel", expected: true },
  { input: "Poivre", expected: true },
  { input: "Sel et poivre", expected: true },
  { input: "Poivre et sel", expected: true },
  { input: "Sel, poivre", expected: true },
  { input: "Poivre noir", expected: true },
  { input: "Fleur de sel", expected: true },
  { input: "Farine", expected: false },
  { input: "morceau de sel", expected: true },
  { input: "poivre du Pérou", expected: true },
  { input: "pincée de poivre", expected: true },
  { input: "Poivron", expected: false },
  { input: "Céleri", expected: false }
];
```

- [ ] **Step 2: Run the test to verify the changed/new cases fail**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: in the `isPantryStaple` block, 2 failures for the changed cases:
```
FAIL: isPantryStaple("Poivre noir") => false, attendu true
FAIL: isPantryStaple("Fleur de sel") => false, attendu true
```
(The 3 brand-new `true` cases — "morceau de sel", "poivre du Pérou", "pincée de poivre" — will also report FAIL here since the current implementation requires every word to be sel/poivre. The 2 new `false` guard cases, "Poivron" and "Céleri", already pass with the current implementation — that's expected and fine; they're guards for the *next* step, not failing tests right now.)

- [ ] **Step 3: Widen `isPantryStaple` in `quantity.js`**

Find this exact block (lines 191-207):

```js
/* ---- ingredients "de placard" que tout le monde a en permanence chez
   soi (sel, poivre, seuls ou combines : "Sel", "Poivre", "Sel et poivre",
   "Poivre et sel", "Sel, poivre"...) : jamais a verifier au frigo, jamais
   a ajouter au panier de courses. Volontairement restreint a ces deux
   mots pour rester simple — une variante specifique ("Poivre noir",
   "Fleur de sel") n'est pas consideree illimitee. ---- */
const PANTRY_STAPLE_WORDS = new Set(["sel", "poivre"]);
const PANTRY_STAPLE_IGNORED_WORDS = new Set(["et", "de", "d"]);

export function isPantryStaple(name){
  const words = String(name ?? "")
    .toLowerCase()
    .split(/[^a-zàâäéèêëîïôöùûüç]+/i)
    .filter(Boolean)
    .filter(w => !PANTRY_STAPLE_IGNORED_WORDS.has(w));
  return words.length > 0 && words.every(w => PANTRY_STAPLE_WORDS.has(w));
}
```

Replace it with:

```js
/* ---- ingredients "de placard" que tout le monde a en permanence chez
   soi : jamais a verifier au frigo, jamais a ajouter au panier de
   courses, des qu'un mot ENTIER du nom est "sel" ou "poivre" — couvre
   "Sel", "Poivre", "Sel et poivre", "Fleur de sel", "morceau de sel",
   "Poivre noir", "poivre du Perou", etc. Comparaison par mot entier (pas
   sous-chaine) : "Poivron" (poivron != poivre) et "Celeri" restent des
   ingredients normaux a acheter/verifier. ---- */
const PANTRY_STAPLE_WORDS = new Set(["sel", "poivre"]);

export function isPantryStaple(name){
  const words = String(name ?? "")
    .toLowerCase()
    .split(/[^a-zàâäéèêëîïôöùûüç]+/i)
    .filter(Boolean);
  return words.some(w => PANTRY_STAPLE_WORDS.has(w));
}
```

- [ ] **Step 4: Run the test to verify all cases pass**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: the `isPantryStaple` block reads `OK: 13 cas isPantryStaple passes.` (8 previous + 5 new), and every other block in the file (including Task 1's `normalizeIngredientPair` block, now at 24 cases) still reads its own `OK:` line — full file output ends without any `FAIL:` lines and without a non-zero exit.

- [ ] **Step 5: Commit**

```bash
git add public/js/recipes/quantity.js public/js/recipes/quantity.test.mjs
git commit -m "Elargir isPantryStaple a toute variante contenant sel ou poivre"
```

---

### Task 3: Bump the service worker cache and deploy

**Files:**
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (deployment step only).

- [ ] **Step 1: Increment the cache version**

Run `grep -n "CACHE_NAME =" public/sw.js` to read the current value, then increment it by exactly 1 (current value + 1 — the file's own content is the source of truth, not any number quoted in this plan).

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "Incrementer le cache du service worker (parsing ingredients + sel/poivre)"
```

**If working in an isolated worktree/branch:** stop here — do not push. Pushing and verifying the GitHub Pages deploy happens only after this branch is reviewed and merged (via `superpowers:finishing-a-development-branch`). **If working directly on `master`:** push and verify:

```bash
git push origin master
gh run list --limit 1
```

Then `gh run watch <run-id> --exit-status` if the run is still in progress, and confirm it completes with `success`.
