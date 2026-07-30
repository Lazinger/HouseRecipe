# Vérifier le frigo / "J'ai fait la recette" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two buttons to the recipe detail view — "Vérifier mon frigo" (annotates each ingredient with ok/manque/à vérifier against fridge stock) and "J'ai fait la recette" (decrements fridge stock after a custom Oui/Non confirmation) — and restrict Mon Frigo's quantity input to real, comparable units (g/kg/ml/L/pièce(s)) so the comparison is meaningful.

**Architecture:** Pure comparison/decrement logic lives in `public/js/recipes/quantity.js` (new `normalizeQuantity`, `checkFridgeAvailability`) and `public/js/planning/fridge.js` (new `decrementFridgeItems`), reusing the existing fridge-stock/cart-merge patterns. A new generic `confirmModal()` helper in `public/js/core/ui.js` replaces the native `confirm()` for this one case (native dialog buttons aren't customizable). All UI wiring lands in `public/js/recipes/detail.js`. No schema changes, no new dependencies — vanilla ESM modules served statically, same as the rest of the app.

**Tech Stack:** Vanilla JS (ES modules), no build step, no test framework beyond the project's own tiny `node --test`-free assertion runner (`quantity.test.mjs`, run directly with `node`).

## Global Constraints

- All UI copy is in French, matching the existing app's tone (see other button labels like "Ajouter au panier", "Valider").
- Quantity strings are always `"<number> <unit>"` (e.g. `"250 g"`), parsed by `parseQuantity` in `quantity.js` — never change this wire format.
- Do **not** modify `public/js/recipes/dyn-rows.js` — `createIngredientRow` is shared with the recipe add/edit form, which must keep free-text quantities.
- No new npm dependencies, no bundler — files are loaded directly by the browser as ES modules and cached by `public/sw.js`.
- Any change to a cached JS/CSS file requires bumping `CACHE_NAME` in `public/sw.js` before real users see it (last task of this plan).
- When testing locally in a browser, the service worker can silently serve stale cached JS/CSS. Before trusting any manual browser check, unregister service workers and clear caches (`navigator.serviceWorker.getRegistrations()` → `unregister()`, `caches.keys()` → `caches.delete()`), then hard-navigate. See `docs/superpowers/specs/2026-07-30-recipe-fridge-check-and-cook-design.md` and the project's `gotcha_local_test_service_worker_cache` note for why this matters.
- Run `node public/js/recipes/quantity.test.mjs` after every change to `quantity.js` — it must print only `OK:` lines and exit 0.

---

### Task 1: `normalizeQuantity` in quantity.js

**Files:**
- Modify: `public/js/recipes/quantity.js`
- Modify: `public/js/recipes/quantity.test.mjs`

**Interfaces:**
- Produces: `normalizeQuantity(qty: string): { value: number, unit: string } | null` — exported from `quantity.js`. Behaves like `parseQuantity` but converts `kg` → `g` (×1000) and `l`/`L` → `ml` (×1000); every other unit (including `""`, `"CS"`, `"pièce(s)"`, `"g"`, `"ml"`) is returned unchanged, case preserved. Returns `null` when `parseQuantity` can't parse the input.

- [ ] **Step 1: Write the failing tests**

Open `public/js/recipes/quantity.test.mjs`. Add this import to the top (replace the existing import line):

```js
import assert from "node:assert/strict";
import { normalizeIngredientPair, resolveStepQuantities, subtractQuantity, applyFridgeStock, normalizeQuantity } from "./quantity.js";
```

Then append this block at the very end of the file:

```js

const normalizeCases = [
  { input: "1 kg", expected: { value: 1000, unit: "g" } },
  { input: "2.5 L", expected: { value: 2500, unit: "ml" } },
  { input: "1 l", expected: { value: 1000, unit: "ml" } },
  { input: "500 g", expected: { value: 500, unit: "g" } },
  { input: "1 CS", expected: { value: 1, unit: "CS" } },
  { input: "1 pièce(s)", expected: { value: 1, unit: "pièce(s)" } },
  { input: "selon le goût", expected: null }
];

let normalizeFailures = 0;
for (const { input, expected } of normalizeCases) {
  const result = normalizeQuantity(input);
  try {
    assert.deepStrictEqual(result, expected);
  } catch {
    normalizeFailures++;
    console.error(`FAIL: normalizeQuantity(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (normalizeFailures > 0) {
  console.error(`${normalizeFailures}/${normalizeCases.length} cas normalizeQuantity en echec.`);
  process.exit(1);
}
console.log(`OK: ${normalizeCases.length} cas normalizeQuantity passes.`);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: crashes with `SyntaxError` or `TypeError` — `normalizeQuantity` is not exported yet from `quantity.js`.

- [ ] **Step 3: Implement `normalizeQuantity`**

In `public/js/recipes/quantity.js`, insert this right after the `parseQuantity` function (after line 6, before the `splitLeadingQuantity` comment block):

```js

/* ---- conversion vers l'unite de base utilisee par les recettes (g/ml),
   pour que le frigo (qui peut stocker en kg/L pour les grosses quantites)
   reste comparable. Ne touche a aucune autre unite (CS, CC, pinc.,
   piece(s)...), qui restent non convertibles telles quelles. ---- */
const BASE_UNIT_CONVERSIONS = {
  kg: { unit: "g", factor: 1000 },
  l: { unit: "ml", factor: 1000 }
};

export function normalizeQuantity(qty){
  const parsed = parseQuantity(qty);
  if (!parsed) return null;
  const conversion = BASE_UNIT_CONVERSIONS[parsed.unit.toLowerCase()];
  if (!conversion) return parsed;
  return { value: parsed.value * conversion.factor, unit: conversion.unit };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: last line printed is `OK: 7 cas normalizeQuantity passes.`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add public/js/recipes/quantity.js public/js/recipes/quantity.test.mjs
git commit -m "Ajouter normalizeQuantity (conversion kg/g et L/ml)"
```

---

### Task 2: `subtractQuantity` uses `normalizeQuantity`

**Files:**
- Modify: `public/js/recipes/quantity.js:123-131` (function `subtractQuantity`)
- Modify: `public/js/recipes/quantity.test.mjs`

**Interfaces:**
- Consumes: `normalizeQuantity` from Task 1.
- Produces: `subtractQuantity` unchanged signature/behavior for existing callers (`applyFridgeStock` in this file, `mergeIngredientsForShopping` in `cart.js`), except it now also handles kg/L transparently.

- [ ] **Step 1: Write the failing tests**

In `public/js/recipes/quantity.test.mjs`, find the `subtractCases` array and add three new entries (append inside the existing array, keep all existing entries):

```js
const subtractCases = [
  { input: ["400 g", "150 g"], expected: "250 g" },
  { input: ["150 g", "400 g"], expected: "0 g" },
  { input: ["3", "2"], expected: "1" },
  { input: ["400 g", "1 boîte"], expected: "400 g" },
  { input: ["selon les goûts", "1 pinc."], expected: "selon les goûts" },
  { input: ["400 g", "selon les goûts"], expected: "400 g" },
  { input: ["1 kg", "500 g"], expected: "500 g" },
  { input: ["500 g", "1 kg"], expected: "0 g" },
  { input: ["2 L", "500 ml"], expected: "1500 ml" }
];
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: `FAIL: subtractQuantity(["1 kg","500 g"]) => 500 g, attendu 500 g` — actually re-check: with the OLD `subtractQuantity` (not yet updated), `parseQuantity("1 kg")` gives `{value:1,unit:"kg"}` and `parseQuantity("500 g")` gives `{value:500,unit:"g"}` — units `"kg"` vs `"g"` differ, so it returns `need` unchanged: `"1 kg"`, not `"500 g"`. Expected output: `FAIL: subtractQuantity(["1 kg","500 g"]) => 1 kg, attendu 500 g` (and two more FAIL lines for the other new cases), then `3/9 cas subtractQuantity en echec.`, exit code 1.

- [ ] **Step 3: Update `subtractQuantity`**

In `public/js/recipes/quantity.js`, replace the function body (currently lines 123-131):

```js
export function subtractQuantity(need, stock){
  const parsedNeed = parseQuantity(need);
  const parsedStock = parseQuantity(stock);
  if (!parsedNeed || !parsedStock) return need;
  if (parsedNeed.unit.toLowerCase() !== parsedStock.unit.toLowerCase()) return need;
  const remaining = Math.max(0, parsedNeed.value - parsedStock.value);
  const formatted = formatScaledNumber(remaining);
  return parsedNeed.unit ? `${formatted} ${parsedNeed.unit}` : formatted;
}
```

with:

```js
export function subtractQuantity(need, stock){
  const parsedNeed = normalizeQuantity(need);
  const parsedStock = normalizeQuantity(stock);
  if (!parsedNeed || !parsedStock) return need;
  if (parsedNeed.unit.toLowerCase() !== parsedStock.unit.toLowerCase()) return need;
  const remaining = Math.max(0, parsedNeed.value - parsedStock.value);
  const formatted = formatScaledNumber(remaining);
  return parsedNeed.unit ? `${formatted} ${parsedNeed.unit}` : formatted;
}
```

(Only the two `parseQuantity` calls become `normalizeQuantity`; the rest of the function is identical.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: `OK: 9 cas subtractQuantity passes.` among the output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add public/js/recipes/quantity.js public/js/recipes/quantity.test.mjs
git commit -m "Faire utiliser normalizeQuantity a subtractQuantity (kg/L compares a g/ml)"
```

---

### Task 3: `mergeQuantityParts` uses `normalizeQuantity` + `applyFridgeStock` non-regression

**Files:**
- Modify: `public/js/recipes/quantity.js:139-150` (function `mergeQuantityParts`)
- Modify: `public/js/recipes/quantity.test.mjs`

**Interfaces:**
- Consumes: `normalizeQuantity` from Task 1.
- Produces: `mergeQuantityParts` unchanged signature/behavior for existing callers (`incrementFridgeItems` in `fridge.js`, `mergeIngredientsForShopping` in `cart.js`), now also merging kg/L with g/ml transparently. `applyFridgeStock` requires **no code change** — it already delegates to `subtractQuantity` (Task 2), this step only adds a test proving the kg/L ripple effect reaches it.

- [ ] **Step 1: Write the failing tests**

`mergeQuantityParts` has no dedicated test block yet. In `public/js/recipes/quantity.test.mjs`, add this new block right after the `subtractCases` block (after its closing `console.log` line, before the `fridgeCases` block), and add `mergeQuantityParts` to the import at the top of the file:

```js
import { normalizeIngredientPair, resolveStepQuantities, subtractQuantity, applyFridgeStock, normalizeQuantity, mergeQuantityParts } from "./quantity.js";
```

```js

const mergeCases = [
  { input: [["200 g", "300 g"]], expected: "500 g" },
  { input: [["1 CS", "2 CS"]], expected: "3 CS" },
  { input: [["400 g", "1 boîte"]], expected: "400 g + 1 boîte" },
  { input: [["1 kg", "500 g"]], expected: "1500 g" },
  { input: [["1 L", "250 ml", "250 ml"]], expected: "1500 ml" }
];

let mergeFailures = 0;
for (const { input, expected } of mergeCases) {
  const result = mergeQuantityParts(...input);
  try {
    assert.equal(result, expected);
  } catch {
    mergeFailures++;
    console.error(`FAIL: mergeQuantityParts(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (mergeFailures > 0) {
  console.error(`${mergeFailures}/${mergeCases.length} cas mergeQuantityParts en echec.`);
  process.exit(1);
}
console.log(`OK: ${mergeCases.length} cas mergeQuantityParts passes.`);
```

Also add one new entry to the existing `fridgeCases` array (append, keep all existing entries):

```js
  {
    merged: [{ key: "lait", name: "Lait", qty: "1 L" }],
    fridge: [["Lait", "500 ml"]],
    expected: [{ key: "lait", name: "Lait", qty: "500 ml" }]
  }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: two of the five new `mergeQuantityParts` cases fail, since `mergeQuantityParts` still uses raw `parseQuantity` (not yet updated) and treats `"kg"`/`"g"` (or `"L"`/`"ml"`) as different, non-mergeable units:
- `mergeQuantityParts(["1 kg","500 g"])` returns `"1 kg + 500 g"` (fallback concat) instead of the expected `"1500 g"`.
- `mergeQuantityParts(["1 L","250 ml","250 ml"])` returns `"1 L + 250 ml"` instead of the expected `"1500 ml"`.

Output includes `2/5 cas mergeQuantityParts en echec.`, exit code 1. The new `fridgeCases` entry (Lait, 1 L vs 500 ml) should already PASS at this point — `applyFridgeStock` delegates to `subtractQuantity`, which Task 2 already fixed — so it does not appear in the failures; it's included here purely as a regression lock for that ripple effect, not as a new failing case.

- [ ] **Step 3: Update `mergeQuantityParts`**

In `public/js/recipes/quantity.js`, replace the function body (currently lines 139-150):

```js
export function mergeQuantityParts(parts){
  const parsed = parts.map(parseQuantity);
  if (parsed.every(Boolean)) {
    const unit = parsed[0].unit.toLowerCase();
    if (parsed.every(p => p.unit.toLowerCase() === unit)) {
      const sum = parsed.reduce((acc, p) => acc + p.value, 0);
      const formatted = formatScaledNumber(sum);
      return parsed[0].unit ? `${formatted} ${parsed[0].unit}` : formatted;
    }
  }
  return [...new Set(parts.map(p => p.trim()))].join(" + ");
}
```

with:

```js
export function mergeQuantityParts(parts){
  const parsed = parts.map(normalizeQuantity);
  if (parsed.every(Boolean)) {
    const unit = parsed[0].unit.toLowerCase();
    if (parsed.every(p => p.unit.toLowerCase() === unit)) {
      const sum = parsed.reduce((acc, p) => acc + p.value, 0);
      const formatted = formatScaledNumber(sum);
      return parsed[0].unit ? `${formatted} ${parsed[0].unit}` : formatted;
    }
  }
  return [...new Set(parts.map(p => p.trim()))].join(" + ");
}
```

(Only `parts.map(parseQuantity)` becomes `parts.map(normalizeQuantity)`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: `OK: 5 cas mergeQuantityParts passes.` and `OK: 5 cas applyFridgeStock passes.` (was 4, now 5) among the output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add public/js/recipes/quantity.js public/js/recipes/quantity.test.mjs
git commit -m "Faire utiliser normalizeQuantity a mergeQuantityParts (kg/L fusionnes avec g/ml)"
```

---

### Task 4: `checkFridgeAvailability` in quantity.js

**Files:**
- Modify: `public/js/recipes/quantity.js` (new function, append at end of file)
- Modify: `public/js/recipes/quantity.test.mjs`

**Interfaces:**
- Consumes: `normalizeQuantity` (Task 1), `formatScaledNumber` (existing).
- Produces: `checkFridgeAvailability(ingredients: [string, string][], fridgeItems: [string, string][]): { name: string, qty: string, status: "ok" | "manque" | "a-verifier", missing?: string }[]` — exported from `quantity.js`. Consumed by `detail.js` in Task 8.

- [ ] **Step 1: Write the failing tests**

Add `checkFridgeAvailability` to the import at the top of `public/js/recipes/quantity.test.mjs`:

```js
import { normalizeIngredientPair, resolveStepQuantities, subtractQuantity, applyFridgeStock, normalizeQuantity, mergeQuantityParts, checkFridgeAvailability } from "./quantity.js";
```

Append this block at the end of the file:

```js

const checkCases = [
  {
    ingredients: [["Farine", "200 g"]],
    fridge: [["Farine", "500 g"]],
    expected: [{ name: "Farine", qty: "200 g", status: "ok" }]
  },
  {
    ingredients: [["Farine", "400 g"]],
    fridge: [["Farine", "150 g"]],
    expected: [{ name: "Farine", qty: "400 g", status: "manque", missing: "250 g" }]
  },
  {
    ingredients: [["Farine", "400 g"]],
    fridge: [],
    expected: [{ name: "Farine", qty: "400 g", status: "manque", missing: "400 g" }]
  },
  {
    ingredients: [["Farine", "400 g"]],
    fridge: [["Farine", "1 boîte"]],
    expected: [{ name: "Farine", qty: "400 g", status: "a-verifier" }]
  },
  {
    ingredients: [["Beurre", "1 CS"]],
    fridge: [["Beurre", "30 g"]],
    expected: [{ name: "Beurre", qty: "1 CS", status: "a-verifier" }]
  },
  {
    ingredients: [["Farine", "500 g"]],
    fridge: [["Farine", "1 kg"]],
    expected: [{ name: "Farine", qty: "500 g", status: "ok" }]
  }
];

let checkFailures = 0;
for (const { ingredients, fridge, expected } of checkCases) {
  const result = checkFridgeAvailability(ingredients, fridge);
  try {
    assert.deepStrictEqual(result, expected);
  } catch {
    checkFailures++;
    console.error(`FAIL: checkFridgeAvailability(${JSON.stringify(ingredients)}, ${JSON.stringify(fridge)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (checkFailures > 0) {
  console.error(`${checkFailures}/${checkCases.length} cas checkFridgeAvailability en echec.`);
  process.exit(1);
}
console.log(`OK: ${checkCases.length} cas checkFridgeAvailability passes.`);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: crashes — `checkFridgeAvailability` is not exported yet.

- [ ] **Step 3: Implement `checkFridgeAvailability`**

Append this at the end of `public/js/recipes/quantity.js`:

```js

/* ---- verifie si le frigo couvre le besoin d'une recette, ingredient par
   ingredient (quantites deja mises a l'echelle par l'appelant selon le
   nombre de personnes). Trois etats :
   - "ok" : le frigo a au moins la quantite demandee.
   - "manque" : le frigo n'a rien pour cet ingredient, ou pas assez ; la
     quantite manquante est fournie dans `missing`.
   - "a-verifier" : comparaison impossible (unite non quantifiable cote
     recette, absente du frigo dans une unite comparable, ou incoherente).
   Meme regle de correspondance de nom que le reste de l'app
   (trim().toLowerCase()). ---- */
export function checkFridgeAvailability(ingredients, fridgeItems){
  const fridgeMap = new Map(fridgeItems.map(([name, qty]) => [name.trim().toLowerCase(), qty]));
  return ingredients.map(([name, qty]) => {
    const stockQty = fridgeMap.get(name.trim().toLowerCase());
    if (!stockQty) return { name, qty, status: "manque", missing: qty };

    const parsedNeed = normalizeQuantity(qty);
    const parsedStock = normalizeQuantity(stockQty);
    if (!parsedNeed || !parsedStock || parsedNeed.unit.toLowerCase() !== parsedStock.unit.toLowerCase()) {
      return { name, qty, status: "a-verifier" };
    }

    if (parsedStock.value >= parsedNeed.value) return { name, qty, status: "ok" };

    const missingValue = formatScaledNumber(parsedNeed.value - parsedStock.value);
    const missing = parsedNeed.unit ? `${missingValue} ${parsedNeed.unit}` : missingValue;
    return { name, qty, status: "manque", missing };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: `OK: 6 cas checkFridgeAvailability passes.` among the output, exit code 0, no FAIL lines anywhere in the file.

- [ ] **Step 5: Commit**

```bash
git add public/js/recipes/quantity.js public/js/recipes/quantity.test.mjs
git commit -m "Ajouter checkFridgeAvailability (verification frigo vs besoin recette)"
```

---

### Task 5: `decrementFridgeItems` in fridge.js

**Files:**
- Modify: `public/js/planning/fridge.js:1-8` (imports), append new function after `incrementFridgeItems` (currently ends at line 93)

**Interfaces:**
- Consumes: `normalizeQuantity`, `formatScaledNumber` (Task 1, existing) from `quantity.js`; `findFridgeIndex`, `fridgeItems`, `saveFridgeItem`, `removeFridgeItem` (existing, same file).
- Produces: `decrementFridgeItems(ingredients: [string, string][]): void` — exported from `fridge.js`. Consumed by `detail.js` in Task 9.

No automated test for this one: it has side effects on `fridgeItems`, `localStorage`, and (indirectly) Supabase via the write-queue, none of which the project's plain-`node` test runner can exercise (same reason `incrementFridgeItems` has no unit test today — see `applyFridgeStock`'s tests instead, which cover the pure math). Verified manually in Task 10.

- [ ] **Step 1: Update the import line**

In `public/js/planning/fridge.js`, replace line 3:

```js
import { mergeQuantityParts } from "../recipes/quantity.js";
```

with:

```js
import { mergeQuantityParts, normalizeQuantity, formatScaledNumber } from "../recipes/quantity.js";
```

- [ ] **Step 2: Implement `decrementFridgeItems`**

Append this right after the closing `}` of `incrementFridgeItems` (currently line 93), before the `/* ---- autocompletion... */` comment:

```js

/* ---- decrement au clic sur "J'ai fait la recette" (fiche recette) :
   ingredients est la liste de la recette, quantites deja mises a
   l'echelle par l'appelant selon le nombre de personnes. Un ingredient
   absent du frigo, ou dans une unite non comparable, n'est pas touche —
   repli sur : pas de modification plutot qu'un calcul faux, meme regle
   que subtractQuantity/checkFridgeAvailability. ---- */
export function decrementFridgeItems(ingredients){
  ingredients.forEach(([name, qty]) => {
    const idx = findFridgeIndex(name);
    if (idx < 0) return;
    const [existingName, existingQty] = fridgeItems[idx];
    const parsedNeed = normalizeQuantity(qty);
    const parsedStock = normalizeQuantity(existingQty);
    if (!parsedNeed || !parsedStock || parsedNeed.unit.toLowerCase() !== parsedStock.unit.toLowerCase()) return;
    const remaining = Math.max(0, parsedStock.value - parsedNeed.value);
    if (remaining === 0) {
      removeFridgeItem(existingName);
    } else {
      const formatted = formatScaledNumber(remaining);
      saveFridgeItem(existingName, parsedStock.unit ? `${formatted} ${parsedStock.unit}` : formatted);
    }
  });
}
```

- [ ] **Step 3: Sanity-check the file has no syntax errors**

Run: `node --check public/js/planning/fridge.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add public/js/planning/fridge.js
git commit -m "Ajouter decrementFridgeItems (bouton J'ai fait la recette)"
```

---

### Task 6: Mon Frigo — quantité en nombre + unité fixe

**Files:**
- Modify: `public/js/planning/fridge.js` (imports, `addFridgeRow`, remove now-unused `createIngredientRow` import)
- Modify: `public/style.css` (new rules for `.fridge-row`)

**Interfaces:**
- Consumes: `parseQuantity` (existing, `quantity.js`) — needs adding to the import line.
- Produces: no new exports; `addFridgeRow` now renders number + `<select>` instead of a free-text quantity input, still calling the existing `saveFridgeItem(name, qty)` / `removeFridgeItem(name)` with a `"<number> <unit>"` string, so nothing downstream changes.

No automated test (DOM-building function, same category as the rest of the app's UI code — verified manually in Task 10).

- [ ] **Step 1: Update imports**

In `public/js/planning/fridge.js`, replace the import block (lines 1-8, after Task 5's edit to line 3):

```js
import { supabase, currentUserId } from "../auth/supabase-client.js";
import { enqueue, registerHandler } from "../core/write-queue.js";
import { mergeQuantityParts, normalizeQuantity, formatScaledNumber } from "../recipes/quantity.js";
import { fridgeView, fridgeScroll } from "../core/dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry } from "../core/ui.js";
import { escapeAttr } from "../core/utils.js";
import { ALL_RECIPES } from "../recipes/recipes-store.js";
import { createIngredientRow, updateRemoveButtons } from "../recipes/dyn-rows.js";
```

with:

```js
import { supabase, currentUserId } from "../auth/supabase-client.js";
import { enqueue, registerHandler } from "../core/write-queue.js";
import { mergeQuantityParts, normalizeQuantity, formatScaledNumber, parseQuantity } from "../recipes/quantity.js";
import { fridgeView, fridgeScroll } from "../core/dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry } from "../core/ui.js";
import { escapeAttr } from "../core/utils.js";
import { ALL_RECIPES } from "../recipes/recipes-store.js";
import { updateRemoveButtons } from "../recipes/dyn-rows.js";
```

(`createIngredientRow` is dropped — Mon Frigo no longer uses it, per the Global Constraints note about not touching that shared component.)

- [ ] **Step 2: Replace `addFridgeRow`**

Find this block (currently around line 104-130):

```js
function addFridgeRow(container, name, qty){
  const row = createIngredientRow(container, name, qty);
  row.querySelector(".ing-name-input").setAttribute("list", "ingredientNamesList");
  row.dataset.savedName = name;

  const commit = () => {
    const newName = row.querySelector(".ing-name-input").value.trim();
    const newQty = row.querySelector(".ing-qty-input").value.trim();
    const oldName = row.dataset.savedName || "";
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) removeFridgeItem(oldName);
    if (newName) {
      saveFridgeItem(newName, newQty);
      row.dataset.savedName = newName;
    } else {
      row.dataset.savedName = "";
    }
  };
  row.querySelector(".ing-name-input").addEventListener("change", commit);
  row.querySelector(".ing-qty-input").addEventListener("change", commit);

  row.querySelector(".dyn-remove").addEventListener("click", () => {
    if (row.dataset.savedName) removeFridgeItem(row.dataset.savedName);
  });

  container.appendChild(row);
  return row;
}
```

Replace it with:

```js
const FRIDGE_UNITS = ["g", "kg", "ml", "L", "pièce(s)"];

function splitFridgeQty(qty){
  const parsed = parseQuantity(qty);
  if (!parsed || !FRIDGE_UNITS.includes(parsed.unit)) return { value: "", unit: FRIDGE_UNITS[0] };
  return { value: String(parsed.value), unit: parsed.unit };
}

function fridgeUnitOptionsHtml(selected){
  return FRIDGE_UNITS.map(u => `<option value="${u}"${u === selected ? " selected" : ""}>${u}</option>`).join("");
}

function addFridgeRow(container, name, qty){
  const { value, unit } = splitFridgeQty(qty);
  const row = document.createElement("div");
  row.className = "dyn-row fridge-row";
  row.innerHTML = `
    <input type="text" class="ing-name-input" placeholder="Nom" value="${escapeAttr(name)}" list="ingredientNamesList">
    <input type="number" class="fridge-qty-input" placeholder="Quantité" min="0" step="any" value="${escapeAttr(value)}">
    <select class="fridge-unit-select">${fridgeUnitOptionsHtml(unit)}</select>
    <button type="button" class="dyn-remove" aria-label="Supprimer cet ingrédient">✕</button>
  `;
  row.dataset.savedName = name;

  const commit = () => {
    const newName = row.querySelector(".ing-name-input").value.trim();
    const newValue = row.querySelector(".fridge-qty-input").value.trim();
    const newUnit = row.querySelector(".fridge-unit-select").value;
    const oldName = row.dataset.savedName || "";
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) removeFridgeItem(oldName);
    if (newName && newValue) {
      saveFridgeItem(newName, `${newValue} ${newUnit}`);
      row.dataset.savedName = newName;
    } else {
      row.dataset.savedName = "";
    }
  };
  row.querySelector(".ing-name-input").addEventListener("change", commit);
  row.querySelector(".fridge-qty-input").addEventListener("change", commit);
  row.querySelector(".fridge-unit-select").addEventListener("change", commit);

  row.querySelector(".dyn-remove").addEventListener("click", () => {
    if (row.dataset.savedName) removeFridgeItem(row.dataset.savedName);
    row.remove();
    updateRemoveButtons(container);
  });

  container.appendChild(row);
  return row;
}
```

- [ ] **Step 3: Add CSS for the new row layout**

In `public/style.css`, find this block:

```css
.dyn-row .ing-name-input{ flex:2; min-width:0; }
.dyn-row .ing-qty-input{ flex:1; min-width:0; }
```

Add these two lines right after it:

```css
.fridge-row .fridge-qty-input{ flex:1; min-width:0; width:0; }
.fridge-row .fridge-unit-select{
  flex:1; min-width:0; border:1px solid var(--line); background: var(--surface);
  border-radius:6px; padding:12px 8px; font-size:.92rem; color: var(--ink); outline:none;
}
.fridge-row .fridge-unit-select:focus{ border-color: var(--emerald); }
```

- [ ] **Step 4: Sanity-check the file has no syntax errors**

Run: `node --check public/js/planning/fridge.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Manual verification in the browser**

1. Start the static server (`npx serve public` on port 3000, or use the project's existing dev-server task/launch config).
2. Unregister the service worker and clear caches (see Global Constraints), then hard-navigate to `http://localhost:3000`.
3. Log in, open the menu, click "Mon Frigo".
4. Confirm the row now shows: name field, a number field, and a unit dropdown with options g/kg/ml/L/pièce(s) (default "g" on an empty row).
5. Type a name (e.g. "Farine"), enter `1` in the number field, pick "kg" in the dropdown, then click elsewhere (blur) to trigger the `change` event.
6. Reload the page (hard reload again) and reopen Mon Frigo — confirm the row still shows "Farine", `1`, "kg" (persisted round-trip).
7. Click the "✕" on that row — confirm it disappears and does not reappear after another reload.

- [ ] **Step 6: Commit**

```bash
git add public/js/planning/fridge.js public/style.css
git commit -m "Restreindre la quantite de Mon Frigo a nombre + unite fixe"
```

---

### Task 7: `confirmModal` reusable popup in ui.js

**Files:**
- Modify: `public/js/core/ui.js` (append new function)
- Modify: `public/style.css` (new `.confirm-modal*` rules)

**Interfaces:**
- Produces: `confirmModal(message: string, options?: { confirmLabel?: string, cancelLabel?: string }): Promise<boolean>` — exported from `ui.js`. Consumed by `detail.js` in Task 9.

No automated test (DOM/Promise-based UI helper — verified manually in Task 10, and directly in this task's manual check below since it's simple enough to eyeball in isolation).

- [ ] **Step 1: Implement `confirmModal`**

Append this at the end of `public/js/core/ui.js`:

```js

/* ---- popup de confirmation generique : contrairement a confirm() natif,
   les libelles des boutons sont personnalisables. Creee/detruite
   dynamiquement (pas d'element statique dans index.html), resout
   true (bouton de confirmation) ou false (annulation, Echap, ou clic
   hors de la boite). ---- */
export function confirmModal(message, { confirmLabel = "Oui", cancelLabel = "Non" } = {}){
  return new Promise(resolve => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-modal-backdrop";
    backdrop.innerHTML = `
      <div class="confirm-modal" role="alertdialog" aria-modal="true">
        <p>${message}</p>
        <div class="confirm-modal-actions">
          <button type="button" class="btn-secondary" data-action="cancel">${cancelLabel}</button>
          <button type="button" class="btn-primary" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    function close(result){
      backdrop.remove();
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }
    function onKeydown(e){
      if (e.key === "Escape") close(false);
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(false);
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener("click", () => close(false));
    backdrop.querySelector('[data-action="confirm"]').addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKeydown);

    document.body.appendChild(backdrop);
  });
}
```

- [ ] **Step 2: Add CSS for the modal**

Append this to `public/style.css` (e.g. right after the `.toast.is-visible{...}` rule):

```css

/* =========================================================
   POPUP DE CONFIRMATION GENERIQUE
   ========================================================= */
.confirm-modal-backdrop{
  position: fixed; inset:0; z-index:70;
  background: rgba(32,36,29,.55);
  display:flex; align-items:center; justify-content:center;
  padding: 20px;
}
.confirm-modal{
  background: var(--surface); border-radius:8px; padding:22px;
  max-width: 360px; width:100%;
  box-shadow: var(--shadow-raised);
}
.confirm-modal p{ margin:0 0 18px; color: var(--ink); font-size:.92rem; line-height:1.5; }
.confirm-modal-actions{ display:flex; gap:10px; justify-content:flex-end; }
```

- [ ] **Step 3: Sanity-check the file has no syntax errors**

Run: `node --check public/js/core/ui.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Manual verification in the browser**

1. With the server running (from Task 6) and the SW cache cleared, open the browser console on any page of the app.
2. Run: `const { confirmModal } = await import("/js/core/ui.js"); confirmModal("Test ?").then(r => console.log("result:", r));`
3. Confirm a centered popup appears over a dark backdrop, with the message "Test ?" and two buttons "Non" / "Oui".
4. Click "Non" — confirm the popup disappears and the console logs `result: false`.
5. Repeat and click "Oui" this time — confirm it logs `result: true`.
6. Repeat once more and press the Escape key — confirm it closes and logs `result: false`.
7. Repeat once more and click on the dark backdrop (outside the box) — confirm it closes and logs `result: false`.

- [ ] **Step 5: Commit**

```bash
git add public/js/core/ui.js public/style.css
git commit -m "Ajouter confirmModal (popup de confirmation Oui/Non reutilisable)"
```

---

### Task 8: "Vérifier mon frigo" button + annotations in detail.js

**Files:**
- Modify: `public/js/recipes/detail.js:1-21` (imports, `ingredientRowHtml`)
- Modify: `public/js/recipes/detail.js:87-107` (template — insert button)
- Modify: `public/js/recipes/detail.js:183-186` (wire the new button, near `#addToCartBtn`'s listener)
- Modify: `public/style.css` (new `.fridge-actions`, `.ing-ok`/`.ing-manque`/`.ing-a-verifier`, `.ing-missing`)

**Interfaces:**
- Consumes: `checkFridgeAvailability` (Task 4, `quantity.js`), `fridgeItems` (existing export, `fridge.js`), `currentIngredients()` (existing local function in `detail.js`, already used by the cart button).
- Produces: no new exports; purely additive UI wiring inside `openDetail`.

No automated test (DOM rendering — verified manually below).

- [ ] **Step 1: Update imports**

In `public/js/recipes/detail.js`, replace lines 1-9:

```js
import { ING_ICON } from "../core/icons.js";
import { ALLERGENS } from "../data/recipes-data.js";
import { escapeHtml } from "../core/utils.js";
import { state, detailView, detailScroll } from "../core/dom.js";
import { ALL_RECIPES, toggleFavorite, saveFavorites, deleteRecipeRemote } from "./recipes-store.js";
import { cart, addRecipeToCart, removeRecipeFromCart, openPanier } from "../planning/cart.js";
import { scaleQuantity, resolveStepQuantities } from "./quantity.js";
import { applyDetailPhoto, getStepPhoto, deleteAllPhotosForRecipe } from "../photos/photos.js";
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "../core/ui.js";
```

with:

```js
import { ING_ICON } from "../core/icons.js";
import { ALLERGENS } from "../data/recipes-data.js";
import { escapeHtml, escapeAttr } from "../core/utils.js";
import { state, detailView, detailScroll } from "../core/dom.js";
import { ALL_RECIPES, toggleFavorite, saveFavorites, deleteRecipeRemote } from "./recipes-store.js";
import { cart, addRecipeToCart, removeRecipeFromCart, openPanier } from "../planning/cart.js";
import { scaleQuantity, resolveStepQuantities, checkFridgeAvailability } from "./quantity.js";
import { fridgeItems } from "../planning/fridge.js";
import { applyDetailPhoto, getStepPhoto, deleteAllPhotosForRecipe } from "../photos/photos.js";
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "../core/ui.js";
```

- [ ] **Step 2: Add `data-ing-name` to `ingredientRowHtml`**

Replace (currently lines 15-17):

```js
function ingredientRowHtml(name, qty){
  return `<li><span class="ing-icon">${ING_ICON}</span><span class="ing-text"><span class="ing-name">${escapeHtml(name)}</span><span class="ing-qty">${escapeHtml(qty)}</span></span></li>`;
}
```

with:

```js
function ingredientRowHtml(name, qty){
  return `<li data-ing-name="${escapeAttr(name)}"><span class="ing-icon">${ING_ICON}</span><span class="ing-text"><span class="ing-name">${escapeHtml(name)}</span><span class="ing-qty">${escapeHtml(qty)}</span></span></li>`;
}
```

- [ ] **Step 3: Insert the button in the template**

Find this line inside the `detailScroll.innerHTML` template (currently line 92, right before `#addToCartBtn`):

```js
        </ul>
        <button class="add-to-cart-btn" id="addToCartBtn" type="button">
```

Replace with:

```js
        </ul>
        <div class="fridge-actions">
          <button type="button" class="btn-secondary" id="checkFridgeBtn">Vérifier mon frigo</button>
          <button type="button" class="btn-secondary" id="cookedRecipeBtn">J'ai fait la recette</button>
        </div>
        <button class="add-to-cart-btn" id="addToCartBtn" type="button">
```

- [ ] **Step 4: Wire the "Vérifier mon frigo" button**

Find this block (currently lines 183-186):

```js
  detailScroll.querySelector("#addToCartBtn").addEventListener("click", () => {
    addRecipeToCart(r, currentServings, currentIngredients());
    showToast("Ajouté au panier");
  });
```

Add this right before it (so both listeners are attached in the same region of `openDetail`):

```js
  detailScroll.querySelector("#checkFridgeBtn").addEventListener("click", () => {
    const results = checkFridgeAvailability(currentIngredients(), fridgeItems);
    const resultByName = new Map(results.map(res => [res.name, res]));
    [...ingredientListEl.children].forEach(li => {
      li.classList.remove("ing-ok", "ing-manque", "ing-a-verifier");
      const oldMissing = li.querySelector(".ing-missing");
      if (oldMissing) oldMissing.remove();
      const result = resultByName.get(li.dataset.ingName);
      if (!result) return;
      li.classList.add(`ing-${result.status}`);
      if (result.status === "manque" && result.missing) {
        const span = document.createElement("span");
        span.className = "ing-missing";
        span.textContent = `manque ${result.missing}`;
        li.querySelector(".ing-text").appendChild(span);
      }
    });
  });
  detailScroll.querySelector("#addToCartBtn").addEventListener("click", () => {
    addRecipeToCart(r, currentServings, currentIngredients());
    showToast("Ajouté au panier");
  });
```

(`ingredientListEl` is already defined earlier in `openDetail`, at `const ingredientListEl = detailScroll.querySelector("#ingredientList");` — no new variable needed.)

- [ ] **Step 5: Add CSS**

Append to `public/style.css`:

```css

/* =========================================================
   FICHE RECETTE — verification frigo
   ========================================================= */
.fridge-actions{ display:flex; gap:10px; margin-top:14px; }
.fridge-actions .btn-secondary{ flex:1; padding:10px 14px; font-size:.82rem; text-align:center; }

.ingredient-list li.ing-ok .ing-icon{ background: var(--emerald-tint); color: var(--emerald-dark); }
.ingredient-list li.ing-manque .ing-icon{ background: var(--terracotta-tint); color: var(--terracotta-dark); }
.ingredient-list li.ing-a-verifier .ing-icon{ background: var(--line); color: var(--ink-soft); }
.ing-missing{ display:block; color: var(--terracotta-dark); font-weight:700; font-size:.68rem; }
```

- [ ] **Step 6: Sanity-check the file has no syntax errors**

Run: `node --check public/js/recipes/detail.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Manual verification in the browser**

1. With the server running and SW cache cleared (see Global Constraints), log in and open any recipe that has at least 2 ingredients.
2. In "Mon Frigo" (Task 6's UI), add one of that recipe's ingredients with a quantity clearly *more* than the recipe needs (e.g. if the recipe needs "200 g" of an ingredient, add "500 g" to the fridge), and another of its ingredients with clearly *less* (e.g. fridge "50 g" vs recipe need "200 g"). Leave a third ingredient untouched (absent from the fridge).
3. Open the recipe, click "Vérifier mon frigo".
4. Confirm: the ingredient with more stock than needed shows a green-tinted icon (`ing-ok`); the one with less shows a red-tinted icon (`ing-manque`) plus a red "manque X" line under its quantity; the untouched one also shows red "manque" with the full recipe quantity as the missing amount.
5. Click the "+" servings stepper, then click "Vérifier mon frigo" again — confirm the annotations recompute (a previously-"ok" ingredient may now show "manque" if the scaled-up need exceeds fridge stock).
6. Click the "+"/"−" servings stepper WITHOUT re-clicking "Vérifier mon frigo" — confirm the previous annotations (colors, "manque" text) are gone (plain ingredient list), not stale.

- [ ] **Step 8: Commit**

```bash
git add public/js/recipes/detail.js public/style.css
git commit -m "Ajouter le bouton Verifier mon frigo sur la fiche recette"
```

---

### Task 9: "J'ai fait la recette" button in detail.js

**Files:**
- Modify: `public/js/recipes/detail.js` (imports, wire button)

**Interfaces:**
- Consumes: `confirmModal` (Task 7, `ui.js`), `decrementFridgeItems` (Task 5, `fridge.js`), `currentIngredients()` (existing).
- Produces: no new exports.

No automated test (DOM/Promise-based UI wiring — verified manually below).

- [ ] **Step 1: Update imports**

Replace (after Task 8's edit):

```js
import { fridgeItems } from "../planning/fridge.js";
import { applyDetailPhoto, getStepPhoto, deleteAllPhotosForRecipe } from "../photos/photos.js";
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "../core/ui.js";
```

with:

```js
import { fridgeItems, decrementFridgeItems } from "../planning/fridge.js";
import { applyDetailPhoto, getStepPhoto, deleteAllPhotosForRecipe } from "../photos/photos.js";
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet, confirmModal } from "../core/ui.js";
```

- [ ] **Step 2: Wire the "J'ai fait la recette" button**

Find the block added in Task 8, Step 4 (the `#checkFridgeBtn` listener followed by the `#addToCartBtn` listener). Add this right after the `#addToCartBtn` listener's closing `});`:

```js
  detailScroll.querySelector("#cookedRecipeBtn").addEventListener("click", async () => {
    const confirmed = await confirmModal("Valider retirera les ingrédients de cette recette de ton frigo. Continuer ?");
    if (!confirmed) return;
    decrementFridgeItems(currentIngredients());
    showToast("Frigo mis à jour");
  });
```

- [ ] **Step 3: Sanity-check the file has no syntax errors**

Run: `node --check public/js/recipes/detail.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Manual verification in the browser**

1. With the server running and SW cache cleared, in "Mon Frigo" add one of an open recipe's ingredients with a quantity larger than the recipe needs (e.g. fridge "500 g", recipe needs "200 g" — note the ingredient name).
2. Open that recipe, click "J'ai fait la recette".
3. Confirm the custom popup appears with the text "Valider retirera les ingrédients de cette recette de ton frigo. Continuer ?" and two buttons "Non"/"Oui" (not the browser's native confirm dialog).
4. Click "Non" — confirm the popup closes and nothing changes (reopen "Mon Frigo", quantity is still "500 g").
5. Click "J'ai fait la recette" again, this time click "Oui".
6. Confirm a toast "Frigo mis à jour" appears, then reopen "Mon Frigo" and confirm that ingredient's quantity dropped to "300 g" (500 − 200).
7. Repeat once more (click "J'ai fait la recette" → "Oui") until the quantity would go to 0 or below — confirm the ingredient's row disappears entirely from "Mon Frigo" rather than showing a negative number.

- [ ] **Step 5: Commit**

```bash
git add public/js/recipes/detail.js
git commit -m "Ajouter le bouton J'ai fait la recette sur la fiche recette"
```

---

### Task 10: Service worker cache bump + full regression pass

**Files:**
- Modify: `public/sw.js:3`

**Interfaces:** none (deployment/cache-busting only).

- [ ] **Step 1: Bump `CACHE_NAME`**

In `public/sw.js`, replace line 3:

```js
const CACHE_NAME = "carnet-cache-v83";
```

with the next integer (check the current value first — if a later task in this plan or another change has already bumped it past v83, use the next integer from whatever is actually in the file):

```js
const CACHE_NAME = "carnet-cache-v84";
```

- [ ] **Step 2: Run the full unit test suite**

Run: `node public/js/recipes/quantity.test.mjs`
Expected: only `OK:` lines, no `FAIL:` lines, exit code 0. There should now be 7 `OK:` lines total, in this order: normalizeIngredientPair, resolveStepQuantities, subtractQuantity, mergeQuantityParts, applyFridgeStock, normalizeQuantity, checkFridgeAvailability (the order follows where each test block sits in the file — see Tasks 1-4 for where each was inserted).

- [ ] **Step 3: Full manual regression pass in the browser**

With the server running and SW cache cleared:
1. Repeat Task 6 Step 5, Task 7 Step 4, Task 8 Step 7, and Task 9 Step 4 in sequence, end to end, without skipping any — confirm all still pass together (catches any cross-task interference).
2. Additionally: open the cart ("Panier de courses"), add a recipe, confirm the existing "à acheter" deduction against fridge stock still works (uses `applyFridgeStock`/`subtractQuantity`, touched in Tasks 2-3) — add an ingredient to the fridge that exactly matches a cart recipe's need, confirm it's excluded from "à acheter".
3. In "Mon Frigo", add an ingredient with unit "kg" (e.g. "Farine", "1", "kg"), then in the cart add a recipe needing that same ingredient in "g" (e.g. "500 g") — confirm "à acheter" either omits it (if 1 kg covers the need) or shows the correctly-reduced remainder in grams (not still showing "1 kg" untouched).

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit -m "Incrementer le cache du service worker (verification frigo + J'ai fait la recette)"
```
