# Quantités dynamiques dans les étapes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les quantités mentionnées dans les étapes de préparation d'une recette importée (scan photo ou URL) se mettent à jour automatiquement quand on change le nombre de portions, via un repère `{{qty:NomIngrédient}}` inséré par Gemini à l'extraction et résolu au rendu.

**Architecture:** `steps` reste `string[]` (aucun changement de structure de données). Une fonction pure `resolveStepQuantities` dans `quantity.js` remplace les repères `{{qty:Nom}}` par la quantité (déjà mise à l'échelle) de l'ingrédient correspondant. Les prompts Gemini des deux fonctions edge d'import reçoivent une règle pour insérer ces repères. `detail.js` appelle la fonction de résolution au rendu initial et à chaque changement de portions, en réutilisant le mécanisme de mise à l'échelle déjà en place pour les ingrédients.

**Tech Stack:** JavaScript ES modules vanilla, Deno (fonctions edge Supabase), Node.js pour les tests ponctuels.

## Global Constraints

- Aucun changement de la structure de données `steps` (reste `string[]`).
- Le repère est `{{qty:NomIngrédient}}`, où `NomIngrédient` reprend le nom exact tel qu'il apparaît dans le tableau `ingredients` de la même recette.
- Comparaison de nom insensible à la casse et aux espaces superflus lors de la résolution.
- Si aucun ingrédient ne correspond au nom du repère, le repère reste affiché tel quel (pas de disparition silencieuse).
- Les 8 recettes déjà en base ne sont PAS converties rétroactivement — hors périmètre de ce plan.
- Le formulaire manuel ("Nouvelle recette" / "Modifier la recette") n'a AUCUN changement d'interface — le champ de texte d'une étape reste un simple input texte.
- Ne jamais insérer de repère pour un temps de cuisson, une température, ou une quantité qui ne correspond à aucun ingrédient de la liste.
- Aucun changement visuel (pas de badge/couleur) sur une quantité résolue.

---

### Task 1: Fonction pure `resolveStepQuantities`

**Files:**
- Modify: `public/js/quantity.js`
- Modify: `public/js/quantity.test.mjs`

**Interfaces:**
- Consumes: rien de nouveau (fonction autonome).
- Produces: `resolveStepQuantities(step: string, ingredients: [string, string][]) => string`, exportée de `quantity.js`. Task 3 en dépend directement.

- [ ] **Step 1: Write the failing test**

Ajouter ces cas à la fin du tableau `cases` existant dans `public/js/quantity.test.mjs` (le fichier importe déjà `normalizeIngredientPair` en haut — ajouter `resolveStepQuantities` au même import) :

```js
import assert from "node:assert/strict";
import { normalizeIngredientPair, resolveStepQuantities } from "./quantity.js";
```

Et un second bloc de tests après la boucle existante des `cases` de `normalizeIngredientPair` (à la fin du fichier, après le `console.log` existant) :

```js
const stepCases = [
  {
    step: "Ajoutez {{qty:Farine}} de farine et mélangez.",
    ingredients: [["Farine", "400 g"], ["Sel", "1 pinc."]],
    expected: "Ajoutez 400 g de farine et mélangez."
  },
  {
    step: "Versez {{qty:huile d'olive}} puis {{qty:Sel}}.",
    ingredients: [["Huile d'olive", "2 CS"], ["Sel", "1 pinc."]],
    expected: "Versez 2 CS puis 1 pinc.."
  },
  {
    step: "Cuire 20 minutes à 180°C.",
    ingredients: [["Farine", "400 g"]],
    expected: "Cuire 20 minutes à 180°C."
  },
  {
    step: "Ajoutez {{qty:Beurre}} fondu.",
    ingredients: [["Farine", "400 g"]],
    expected: "Ajoutez {{qty:Beurre}} fondu."
  }
];

let stepFailures = 0;
for (const { step, ingredients, expected } of stepCases) {
  const result = resolveStepQuantities(step, ingredients);
  try {
    assert.equal(result, expected);
  } catch {
    stepFailures++;
    console.error(`FAIL: resolveStepQuantities(${JSON.stringify(step)}, ...) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (stepFailures > 0) {
  console.error(`${stepFailures}/${stepCases.length} cas resolveStepQuantities en echec.`);
  process.exit(1);
}
console.log(`OK: ${stepCases.length} cas resolveStepQuantities passes.`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node public/js/quantity.test.mjs`
Expected: FAIL — `SyntaxError: The requested module './quantity.js' does not provide an export named 'resolveStepQuantities'`.

- [ ] **Step 3: Write minimal implementation**

Ajouter à la fin de `public/js/quantity.js` :

```js
/* ---- resolution des reperes de quantite dynamique dans une etape
   (ex. "Ajoutez {{qty:Farine}} de farine") : remplace chaque repere par la
   quantite de l'ingredient correspondant (deja mise a l'echelle par
   l'appelant). Si aucun ingredient ne correspond, le repere reste affiche
   tel quel plutot que de disparaitre silencieusement. ---- */
export function resolveStepQuantities(step, ingredients){
  return String(step ?? "").replace(/\{\{qty:([^}]+)\}\}/g, (match, rawName) => {
    const target = rawName.trim().toLowerCase();
    const found = ingredients.find(([name]) => String(name).trim().toLowerCase() === target);
    return found ? found[1] : match;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node public/js/quantity.test.mjs`
Expected: `OK: 17 cas passes.` puis `OK: 4 cas resolveStepQuantities passes.`

- [ ] **Step 5: Commit**

```bash
git add public/js/quantity.js public/js/quantity.test.mjs
git commit -m "Ajouter resolveStepQuantities pour les reperes de quantite dans les etapes"
```

---

### Task 2: Prompts Gemini (scan photo + import URL)

**Files:**
- Modify: `supabase/functions/scan-recipe/index.ts` (constante `EXTRACTION_PROMPT`)
- Modify: `supabase/functions/import-recipe-url/index.ts` (constante `TEXT_EXTRACTION_PROMPT`)

**Interfaces:**
- Consumes: rien (changement de texte de prompt uniquement, pas de code).
- Produces: rien de consommable par du code — le format de sortie JSON de Gemini est inchangé (toujours `title`/`category`/.../`steps`), seul le contenu texte des `steps` peut désormais contenir des repères `{{qty:Nom}}`.

- [ ] **Step 1: Ajouter la règle dans `EXTRACTION_PROMPT`**

Dans `supabase/functions/scan-recipe/index.ts`, à la fin de la liste à puces "Règles :" de `EXTRACTION_PROMPT` (juste avant le backtick fermant), ajouter une puce :

```
- Dans "steps", quand une phrase mentionne la quantité d'un ingrédient qui figure dans "ingredients", remplace cette quantité dans le texte par {{qty:NomExactDeLIngredient}} en reprenant le nom exactement comme il apparaît dans "ingredients" (ex. si ingredients contient ["Farine", "400 g"], écris "Ajoutez {{qty:Farine}} de farine" au lieu de "Ajoutez 400 g de farine"). Ne fais JAMAIS ça pour un temps de cuisson, une température, une taille de plat/moule, ou toute quantité qui ne correspond à aucun ingrédient de la liste — ces nombres restent en texte normal.
```

- [ ] **Step 2: Ajouter la même règle dans `TEXT_EXTRACTION_PROMPT`**

Dans `supabase/functions/import-recipe-url/index.ts`, même ajout à la fin de la liste à puces "Règles :" de `TEXT_EXTRACTION_PROMPT`, avec le texte identique à l'étape 1.

- [ ] **Step 3: Déployer les deux fonctions**

Utiliser l'outil MCP Supabase `deploy_edge_function` (project_id `bmotbwubruvsrflaufis`) pour redéployer `scan-recipe` et `import-recipe-url` avec le contenu complet et à jour de chaque fichier (`verify_jwt: true` pour les deux, comme aujourd'hui).

- [ ] **Step 4: Smoke test (pas de regression)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://bmotbwubruvsrflaufis.supabase.co/functions/v1/scan-recipe" -H "Content-Type: application/json" -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://bmotbwubruvsrflaufis.supabase.co/functions/v1/import-recipe-url" -H "Content-Type: application/json" -d '{}'
```

Expected: `401` pour les deux (pas d'authentification fournie) — confirme que le déploiement n'a pas cassé le démarrage de la fonction.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/scan-recipe/index.ts supabase/functions/import-recipe-url/index.ts
git commit -m "Demander a Gemini de reperer les quantites d'ingredients dans les etapes"
```

- [ ] **Step 6: Note pour le controleur (pas une etape d'implementeur)**

Le smoke test de l'étape 4 confirme seulement l'absence de crash — il ne prouve pas que Gemini respecte réellement la nouvelle règle de repérage (comportement d'un LLM, non déterministe). Avant de considérer cette tâche entièrement close, le contrôleur (pas le subagent implémenteur) doit vérifier le comportement réel de Gemini avec la technique déjà utilisée en session précédente (fonction de diagnostic temporaire sans authentification, appelant Gemini directement avec un exemple contenant une quantité d'ingrédient dans une phrase d'étape, puis suppression/neutralisation de la fonction de diagnostic après usage) — cette étape nécessite une confirmation explicite de l'utilisateur avant de déployer une fonction sans authentification, comme lors des sessions précédentes.

---

### Task 3: Intégration dans la fiche recette

**Files:**
- Modify: `public/js/detail.js`

**Interfaces:**
- Consumes: `resolveStepQuantities(step, ingredients)` de Task 1 (`./quantity.js`).
- Produces: rien de consommable par du code — comportement utilisateur uniquement (affichage de la fiche recette).

- [ ] **Step 1: Importer `resolveStepQuantities`**

Dans `public/js/detail.js` ligne 6, remplacer :

```js
import { scaleQuantity } from "./quantity.js";
```

par :

```js
import { scaleQuantity, resolveStepQuantities } from "./quantity.js";
```

- [ ] **Step 2: Ajouter `stepRowHtml`**

Juste après la fonction `ingredientRowHtml` existante (après la ligne `}` qui la termine, vers la ligne 16), ajouter :

```js
function stepRowHtml(step, index, ingredients){
  return `<li data-step-index="${index}"><span class="step-num">${index + 1}</span><p>${resolveStepQuantities(step, ingredients)}</p></li>`;
}
```

- [ ] **Step 3: Utiliser `stepRowHtml` au rendu initial**

Remplacer la ligne (dans le gros template du rendu initial, actuellement) :

```js
          ${r.steps.map((s, i) => `<li data-step-index="${i}"><span class="step-num">${i + 1}</span><p>${s}</p></li>`).join("")}
```

par :

```js
          ${r.steps.map((s, i) => stepRowHtml(s, i, r.ingredients)).join("")}
```

- [ ] **Step 4: Extraire l'attache des photos d'étape en fonction reutilisable**

Remplacer le bloc actuel (juste après `const stepListEl = detailScroll.querySelector("#stepList");`) :

```js
  r.steps.forEach((_, i) => {
    getStepPhoto(r.id, i).then(blob => {
      if (!blob) return;
      const li = stepListEl.querySelector(`li[data-step-index="${i}"]`);
      if (!li) return;
      const img = document.createElement("img");
      img.className = "step-photo";
      img.src = URL.createObjectURL(blob);
      img.alt = "";
      li.querySelector(".step-num").after(img);
    }).catch(() => {});
  });
```

par :

```js
  function attachStepPhotos(){
    r.steps.forEach((_, i) => {
      getStepPhoto(r.id, i).then(blob => {
        if (!blob) return;
        const li = stepListEl.querySelector(`li[data-step-index="${i}"]`);
        if (!li) return;
        const img = document.createElement("img");
        img.className = "step-photo";
        img.src = URL.createObjectURL(blob);
        img.alt = "";
        li.querySelector(".step-num").after(img);
      }).catch(() => {});
    });
  }
  attachStepPhotos();
```

- [ ] **Step 5: Regenerer les etapes quand les portions changent**

Après la fonction `renderScaledIngredients` existante (juste avant les deux `addEventListener` de `minusBtn`/`plusBtn`), ajouter :

```js
  function renderScaledSteps(){
    const ingredients = currentIngredients();
    stepListEl.innerHTML = r.steps.map((s, i) => stepRowHtml(s, i, ingredients)).join("");
    attachStepPhotos();
  }
```

Puis, dans les deux handlers `minusBtn.addEventListener("click", ...)` et `plusBtn.addEventListener("click", ...)`, ajouter `renderScaledSteps();` juste après l'appel existant à `renderScaledIngredients();` (dans chacun des deux handlers).

- [ ] **Step 6: Verifier dans le navigateur**

`detail.js` dépend du DOM (pas testable via Node). Démarrer le serveur de dev existant (`static-serve`), puis dans la console du navigateur (`javascript_tool`) :

```js
(async () => {
  const store = await import("/js/recipes-store.js");
  store.ALL_RECIPES.push({
    id: "test-recipe-dyn-steps",
    title: "Test",
    category: "plat",
    desc: "Test",
    time: 10,
    servings: 2,
    difficulty: "Facile",
    note: "",
    ingredients: [["Farine", "200 g"], ["Sel", "1 pinc."]],
    utensils: [],
    steps: [
      "Ajoutez {{qty:Farine}} de farine.",
      "Ajoutez {{qty:Sel}} et mélangez.",
      "Cuire 20 minutes à 180°C."
    ]
  });
  const mod = await import("/js/detail.js");
  mod.openDetail("test-recipe-dyn-steps");
  const stepsBefore = [...document.querySelectorAll("#stepList p")].map(p => p.textContent);
  document.querySelector("#servePlus").click();
  const stepsAfter = [...document.querySelectorAll("#stepList p")].map(p => p.textContent);
  return { stepsBefore, stepsAfter };
})();
```

Expected : `stepsBefore` = `["Ajoutez 200 g de farine.", "Ajoutez 1 pinc. et mélangez.", "Cuire 20 minutes à 180°C."]` (portions = 2, ratio 1). Après un clic sur `#servePlus` (portions = 3, ratio 1.5), `stepsAfter` = `["Ajoutez 300 g de farine.", "Ajoutez 1,5 pinc. et mélangez.", "Cuire 20 minutes à 180°C."]` (`scaleQuantity("1 pinc.", 1.5)` donne `"1,5 pinc."` — vérifié par calcul direct ; la 3e étape ne change jamais car elle ne contient aucun repère `{{qty:...}}`).

- [ ] **Step 7: Commit**

```bash
git add public/js/detail.js
git commit -m "Resoudre les quantites dynamiques dans les etapes de la fiche recette"
```

## Self-Review

**Couverture de la spec :** fonction de résolution (Task 1), règle de prompt Gemini (Task 2), intégration au rendu + mise à l'échelle sur changement de portions (Task 3). Portée limitée aux imports, formulaire manuel inchangé, recettes existantes non converties — aucune tâche ne les touche, conforme au périmètre.

**Placeholders :** aucun "TBD". La seule note explicitement marquée "pour le contrôleur" (Task 2, Step 6) est délibérée : elle documente une vérification qui ne peut pas être déléguée à un subagent (dépend d'une confirmation utilisateur explicite pour déployer une fonction de diagnostic sans authentification), pas un travail non spécifié.

**Cohérence des types/signatures :** `resolveStepQuantities(step: string, ingredients: [string, string][]) => string` définie dans Task 1, utilisée à l'identique dans Task 3 (`stepRowHtml`). Le format `{{qty:Nom}}` est identique dans la spec, le prompt (Task 2) et l'implémentation (Task 1).
