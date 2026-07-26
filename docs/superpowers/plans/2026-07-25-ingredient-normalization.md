# Normalisation des ingrédients à l'import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normaliser automatiquement le nom et la quantité de chaque ingrédient extrait par scan photo ou import URL (majuscule initiale, unités abrégées : CS/CC/pinc.), et appliquer la même normalisation aux 8 recettes déjà en base après validation humaine.

**Architecture:** Une fonction pure `normalizeIngredientPair(name, qty)` dans `public/js/quantity.js`, branchée dans `sanitizeExtractedRecipe` (déjà partagée par `scan-recipe.js` et `import-url.js`). Aucun changement de prompt Gemini. La rétro-application aux données existantes est un script Node ponctuel qui réutilise la même fonction, avec une pause obligatoire pour validation humaine avant d'écrire en base.

**Tech Stack:** JavaScript ES modules vanilla (pas de framework, pas de bundler), Node.js pour les scripts ponctuels et les tests, Supabase (table `public.recipes`, projet `bmotbwubruvsrflaufis`) via les outils MCP Supabase.

## Global Constraints

- La normalisation s'applique uniquement aux imports (scan photo + import URL), jamais au formulaire manuel "Nouvelle recette".
- Aucun changement des prompts Gemini (`EXTRACTION_PROMPT` / `TEXT_EXTRACTION_PROMPT`).
- Unités abrégées : `cuillère(s) à soupe` / `c. à soupe` / `càs` → `CS` ; `cuillère(s) à café` / `c. à café` / `càc` → `CC` ; `pincée(s)` → `pinc.` ; `gousse(s)` reste `gousse`/`gousses` (accord selon la valeur), sans abréviation. Toute autre unité n'est pas modifiée.
- Seule la première lettre du nom final est mise en majuscule ; le reste de la chaîne n'est pas modifié.
- La mise à jour des 8 recettes existantes ne doit écrire en base qu'après qu'un avant/après a été montré à l'utilisateur et explicitement approuvé.
- Ne pas toucher aux étapes (`steps`) — hors périmètre de cette spec.

---

### Task 1: Fonction pure `normalizeIngredientPair`

**Files:**
- Modify: `public/js/quantity.js`
- Create: `public/js/quantity.test.mjs`

**Interfaces:**
- Consumes: `splitLeadingQuantity(name)` déjà exporté par `quantity.js` (signature inchangée : retourne `{ name, qty }` ou `null`).
- Produces: `normalizeIngredientPair(name, qty)` — nouvelle export de `quantity.js`, signature `(name: string, qty: string) => [string, string]`. Task 2 et Task 3 en dépendent directement.

- [ ] **Step 1: Write the failing test**

Create `public/js/quantity.test.mjs`:

```js
import assert from "node:assert/strict";
import { normalizeIngredientPair } from "./quantity.js";

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
  { input: ["1 pièce(s) Poireau", ""], expected: ["Poireau", "1 pièce(s)"] }
];

let failures = 0;
for (const { input, expected } of cases) {
  const result = normalizeIngredientPair(...input);
  try {
    assert.deepStrictEqual(result, expected);
  } catch {
    failures++;
    console.error(`FAIL: normalizeIngredientPair(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (failures > 0) {
  console.error(`${failures}/${cases.length} cas en echec.`);
  process.exit(1);
}
console.log(`OK: ${cases.length} cas passes.`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node public/js/quantity.test.mjs`
Expected: FAIL — `SyntaxError: The requested module './quantity.js' does not provide an export named 'normalizeIngredientPair'` (la fonction n'existe pas encore).

- [ ] **Step 3: Write minimal implementation**

Append to `public/js/quantity.js` (garder tout le contenu existant du fichier tel quel, y compris `splitLeadingQuantity`) :

```js
/* ---- normalisation des ingredients extraits par IA (scan photo / import URL) :
   majuscule initiale sur le nom, unites courantes abregees (CS/CC/pinc.) ---- */
const UNIT_ABBREVIATIONS = [
  { pattern: /^(?:cuill[eè]res?\s+à\s+soupe|c\.?\s*à\s*s\.?|càs)$/i, replacement: "CS" },
  { pattern: /^(?:cuill[eè]res?\s+à\s+café|c\.?\s*à\s*c\.?|càc)$/i, replacement: "CC" },
  { pattern: /^pincées?$/i, replacement: "pinc." },
  { pattern: /^gousses?$/i, replacement: null }
];

const LEADING_QUANTITY_UNIT_RE = /^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(cuill[eè]res?\s+à\s+soupe|cuill[eè]res?\s+à\s+café|c\.?\s*à\s*s\.?|c\.?\s*à\s*c\.?|càs|càc|pincées?|gousses?)\s+(?:de\s+|d')(.+)$/i;

function abbreviateUnit(unit, value){
  const trimmedUnit = unit.trim();
  for (const { pattern, replacement } of UNIT_ABBREVIATIONS) {
    if (pattern.test(trimmedUnit)) {
      if (replacement) return replacement;
      const numeric = parseFloat(String(value).replace(",", "."));
      return numeric > 1 ? "gousses" : "gousse";
    }
  }
  return trimmedUnit;
}

function capitalizeFirst(str){
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeIngredientPair(name, qty){
  const trimmedName = String(name ?? "").trim();
  const trimmedQty = String(qty ?? "").trim();

  if (!trimmedQty) {
    const leadingMatch = trimmedName.match(LEADING_QUANTITY_UNIT_RE);
    if (leadingMatch) {
      const [, value, unit, rest] = leadingMatch;
      return [capitalizeFirst(rest.trim()), `${value} ${abbreviateUnit(unit, value)}`];
    }
    const split = splitLeadingQuantity(trimmedName);
    if (split) return [capitalizeFirst(split.name), split.qty];
    return [capitalizeFirst(trimmedName), trimmedQty];
  }

  const qtyMatch = trimmedQty.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(.+)$/);
  if (qtyMatch) {
    const [, value, unit] = qtyMatch;
    return [capitalizeFirst(trimmedName), `${value} ${abbreviateUnit(unit, value)}`];
  }

  return [capitalizeFirst(trimmedName), trimmedQty];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node public/js/quantity.test.mjs`
Expected: `OK: 10 cas passes.`

- [ ] **Step 5: Commit**

```bash
git add public/js/quantity.js public/js/quantity.test.mjs
git commit -m "Ajouter normalizeIngredientPair pour normaliser nom/unite des ingredients"
```

---

### Task 2: Brancher la normalisation dans `sanitizeExtractedRecipe`

**Files:**
- Modify: `public/js/scan-recipe.js:1-60` (import + logique de mapping des ingrédients)

**Interfaces:**
- Consumes: `normalizeIngredientPair(name, qty)` de Task 1 (`./quantity.js`).
- Produces: `sanitizeExtractedRecipe(raw, photoBlob)` continue de retourner le même objet qu'aujourd'hui — seul le contenu du champ `ingredients` change. Aucune autre fonction ne dépend de ce changement.

- [ ] **Step 1: Remplacer l'import et la logique de mapping**

Dans `public/js/scan-recipe.js`, ligne 7, remplacer :

```js
import { splitLeadingQuantity } from "./quantity.js";
```

par :

```js
import { normalizeIngredientPair } from "./quantity.js";
```

Puis remplacer le bloc (lignes ~51-60) :

```js
  const ingredients = Array.isArray(raw?.ingredients)
    ? raw.ingredients.filter(pair => Array.isArray(pair) && pair[0]).map(([name, qty]) => {
        const trimmedQty = String(qty ?? "").trim();
        if (!trimmedQty) {
          const split = splitLeadingQuantity(name);
          if (split) return [split.name, split.qty];
        }
        return [String(name), trimmedQty];
      })
    : [];
```

par :

```js
  const ingredients = Array.isArray(raw?.ingredients)
    ? raw.ingredients.filter(pair => Array.isArray(pair) && pair[0]).map(([name, qty]) => normalizeIngredientPair(name, qty))
    : [];
```

- [ ] **Step 2: Verifier dans le navigateur (scan-recipe.js depend du DOM, pas testable via Node)**

Demarrer le serveur de dev existant (`static-serve`, voir `.claude/launch.json`) et ouvrir la page. Puis, dans la console du navigateur (`javascript_tool`) :

```js
(async () => {
  const mod = await import("/js/scan-recipe.js");
  const result = mod.sanitizeExtractedRecipe({
    title: "Test",
    category: "plat",
    ingredients: [
      ["1 cuillère à soupe d'huile d'olive", ""],
      ["farine", "200 g"],
      ["2 gousses d'ail", ""],
      ["sel", "1 pincée"]
    ],
    utensils: [],
    steps: ["Une étape"]
  });
  return JSON.stringify(result.ingredients);
})();
```

Expected: `[["Huile d'olive","1 CS"],["Farine","200 g"],["Ail","2 gousses"],["Sel","1 pinc."]]`

- [ ] **Step 3: Verifier que l'import URL beneficie aussi du changement**

`import-url.js` reutilise deja `sanitizeExtractedRecipe` sans logique d'ingredients propre — aucune modification necessaire dans ce fichier. Confirmer par lecture (`grep sanitizeExtractedRecipe public/js/import-url.js`) qu'il n'y a pas de traitement d'ingredients duplique a mettre a jour.

- [ ] **Step 4: Commit**

```bash
git add public/js/scan-recipe.js
git commit -m "Appliquer normalizeIngredientPair dans sanitizeExtractedRecipe (scan + import URL)"
```

---

### Task 3: Rétro-application aux 8 recettes existantes

**Files:**
- Aucun fichier du repo modifie de façon permanente (script Node ponctuel dans un dossier scratch, pas commite — coherent avec les corrections de donnees precedentes sur ce projet qui n'ont jamais laisse de script permanent dans le repo).

**Interfaces:**
- Consumes: `normalizeIngredientPair(name, qty)` de Task 1 (`./quantity.js`), et l'outil MCP Supabase `execute_sql` (project_id `bmotbwubruvsrflaufis`).
- Produces: rien de consommable par du code — resultat final : les lignes de `public.recipes.ingredients` mises a jour en base, apres validation humaine explicite.

- [ ] **Step 1: Recuperer les recettes existantes**

Executer via l'outil MCP Supabase `execute_sql` (project_id `bmotbwubruvsrflaufis`) :

```sql
select id, ingredients from public.recipes order by id;
```

Copier le resultat JSON dans un fichier scratch, par exemple `recipes-before.json`, sous la forme `[{ "id": "...", "ingredients": [[name, qty], ...] }, ...]`.

- [ ] **Step 2: Calculer le diff avec normalizeIngredientPair**

Dans le meme dossier scratch, creer `compute-diff.mjs` :

```js
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeIngredientPair } from "../public/js/quantity.js"; // ajuster le chemin relatif reel vers le repo

const recipes = JSON.parse(readFileSync(new URL("./recipes-before.json", import.meta.url)));

const changed = [];
for (const recipe of recipes) {
  const before = recipe.ingredients;
  const after = before.map(([name, qty]) => normalizeIngredientPair(name, qty));
  const hasDiff = before.some(([n, q], i) => n !== after[i][0] || q !== after[i][1]);
  if (hasDiff) changed.push({ id: recipe.id, before, after });
}

writeFileSync(new URL("./recipes-diff.json", import.meta.url), JSON.stringify(changed, null, 2));
console.log(`${changed.length}/${recipes.length} recette(s) avec au moins un changement.`);
for (const c of changed) {
  console.log(`\n--- ${c.id} ---`);
  c.before.forEach(([n, q], i) => {
    const [an, aq] = c.after[i];
    if (n !== an || q !== aq) console.log(`  ["${n}", "${q}"] -> ["${an}", "${aq}"]`);
  });
}
```

Run: `node compute-diff.mjs` (chemin relatif de l'import a ajuster selon l'emplacement reel du dossier scratch par rapport au repo clone).

- [ ] **Step 3: Presenter le diff a l'utilisateur et attendre l'approbation explicite**

Montrer la sortie de la Step 2 (recette par recette, avant -> apres) dans le chat. Ne pas passer a la Step 4 sans un "oui, applique" (ou equivalent explicite) de l'utilisateur. Si l'utilisateur demande des changements sur les regles de normalisation elles-memes, revenir a la Task 1.

- [ ] **Step 4: Appliquer les mises a jour (apres approbation uniquement)**

Pour chaque recette de `recipes-diff.json`, executer via `execute_sql` (project_id `bmotbwubruvsrflaufis`) une requete de la forme :

```sql
update public.recipes
set ingredients = '<JSON.stringify(c.after) echappe pour SQL>'::jsonb
where id = '<c.id>';
```

Executer une requete par recette changee (pas de boucle cote SQL, chaque `execute_sql` est un appel MCP independant).

- [ ] **Step 5: Verifier**

Re-executer la requete de la Step 1 (`select id, ingredients from public.recipes order by id;`) et confirmer que les lignes modifiees correspondent bien a `recipes-diff.json` colonne "after". Demander a l'utilisateur de recharger l'app et de verifier visuellement 1-2 recettes modifiees dans la fiche recette.

---

## Self-Review

**Couverture de la spec :** normalisation du nom/quantite (Task 1+2), portee limitee au scan+import URL (Task 2, formulaire manuel non touche), retro-application avec validation humaine (Task 3). Tous les points de la spec sont couverts.

**Placeholders :** aucun "TBD"/"a implementer plus tard" — toutes les etapes contiennent le code ou la commande exacte. La seule variabilite volontaire est le chemin relatif du dossier scratch (Task 3, Step 2), inevitable puisque cet emplacement depend de l'environnement d'execution.

**Coherence des types/signatures :** `normalizeIngredientPair(name: string, qty: string) => [string, string]` est utilise a l'identique dans les trois taches (Task 1 le definit, Task 2 l'appelle dans `sanitizeExtractedRecipe`, Task 3 l'importe pour le script de diff).
