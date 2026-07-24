# Fruits et légumes de saison — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un écran "Saison" listant les fruits/légumes de pleine saison par mois, avec un tap sur un produit qui ouvre la grille de recettes filtrée sur les recettes contenant cet ingrédient.

**Architecture:** Une liste statique `SEASONAL_PRODUCE` (id, libellé, mois de pleine saison, alias texte) dans un nouveau fichier `public/js/season-data.js`, avec une fonction pure `produceMatchesRecipe()` qui compare les alias au texte des ingrédients d'une recette (normalisation accents/majuscules, substring simple). Aucune table Supabase — donnée statique embarquée, comme `ALLERGENS`. Le filtre saisonnier est un nouvel état `state.seasonalFilter` non persistant, consommé par `getFilteredRecipes()` dans `grid.js` (combiné en ET avec les filtres existants), avec un chip retirable au-dessus de la grille. Un nouveau fichier `public/js/season.js` gère la vue plein écran dédiée (navigation par mois, liste avec compteur de recettes), suivant exactement le pattern déjà établi par `public/js/meal-plan.js`.

**Tech Stack:** JavaScript vanilla (modules ES), aucun framework de build/test, localStorage non utilisé pour cette fonctionnalité (filtre non persistant).

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur (comme tout le reste du projet).
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v75`) et l'ajout de tout nouveau fichier JS à `APP_SHELL`.
- Le filtre saisonnier (`state.seasonalFilter`) n'est **pas** persisté en `localStorage` (contrairement aux favoris/allergènes) — réinitialisé à chaque rechargement de page.
- Les fichiers du site sont dans `public/`.
- Aucune donnée de saisonnalité ne transite par Supabase.

---

### Task 1: Données de saisonnalité et matching (`season-data.js`)

**Files:**
- Create: `public/js/season-data.js`
- Modify: `public/sw.js`

**Interfaces:**
- Produces : `SEASONAL_PRODUCE` (tableau de `{ id: string, label: string, months: number[], aliases: string[] }`, `months` en 1=janvier..12=décembre), `produceMatchesRecipe(produce, recipe)` (retourne un booléen), `seasonalProduceForMonth(month)` (retourne un sous-tableau de `SEASONAL_PRODUCE` trié par libellé) — tous exportés depuis `public/js/season-data.js`, consommés par Task 2 (`grid.js`) et Task 3 (`season.js`).

- [ ] **Step 1: Créer `public/js/season-data.js` avec la liste et les fonctions de matching**

Créer le fichier `public/js/season-data.js` avec ce contenu exact :

```js
/* ---- calendrier de saisonnalité (France, pleine saison) et matching avec
   les ingrédients des recettes. Donnée statique, jamais modifiée par
   l'utilisateur — pas de table Supabase, comme ALLERGENS. ---- */
export const SEASONAL_PRODUCE = [
  { id: "ail", label: "Ail", months: [6,7,8,9], aliases: ["ail"] },
  { id: "artichaut", label: "Artichaut", months: [5,6,7,8,9,10], aliases: ["artichaut","artichauts"] },
  { id: "asperge", label: "Asperge", months: [4,5,6], aliases: ["asperge","asperges"] },
  { id: "aubergine", label: "Aubergine", months: [6,7,8,9,10], aliases: ["aubergine","aubergines"] },
  { id: "betterave", label: "Betterave", months: [6,7,8,9,10,11], aliases: ["betterave","betteraves"] },
  { id: "brocoli", label: "Brocoli", months: [1,2,3,9,10,11,12], aliases: ["brocoli","brocolis"] },
  { id: "carotte", label: "Carotte", months: [1,2,3,4,5,6,7,8,9,10,11,12], aliases: ["carotte","carottes"] },
  { id: "celeri-branche", label: "Céleri branche", months: [6,7,8,9,10,11], aliases: ["celeri branche","celeri"] },
  { id: "champignon", label: "Champignon", months: [9,10,11], aliases: ["champignon","champignons"] },
  { id: "chou-blanc", label: "Chou blanc", months: [1,2,3,9,10,11,12], aliases: ["chou blanc","choux blancs","chou vert","choux verts"] },
  { id: "chou-fleur", label: "Chou-fleur", months: [1,2,3,4,9,10,11,12], aliases: ["chou-fleur","choux-fleurs"] },
  { id: "chou-de-bruxelles", label: "Chou de Bruxelles", months: [10,11,12,1,2], aliases: ["chou de bruxelles","choux de bruxelles"] },
  { id: "concombre", label: "Concombre", months: [5,6,7,8,9], aliases: ["concombre","concombres"] },
  { id: "courgette", label: "Courgette", months: [5,6,7,8,9,10], aliases: ["courgette","courgettes"] },
  { id: "endive", label: "Endive", months: [10,11,12,1,2,3,4], aliases: ["endive","endives"] },
  { id: "epinard", label: "Épinard", months: [3,4,5,9,10,11], aliases: ["epinard","epinards"] },
  { id: "fenouil", label: "Fenouil", months: [6,7,8,9,10,11], aliases: ["fenouil"] },
  { id: "haricot-vert", label: "Haricot vert", months: [6,7,8,9], aliases: ["haricot vert","haricots verts"] },
  { id: "laitue", label: "Laitue / Salade verte", months: [4,5,6,7,8,9,10], aliases: ["laitue","laitues","salade verte","salades vertes"] },
  { id: "mais", label: "Maïs doux", months: [7,8,9], aliases: ["mais"] },
  { id: "navet", label: "Navet", months: [6,7,8,9,10,11,12,1,2,3], aliases: ["navet","navets"] },
  { id: "oignon", label: "Oignon", months: [1,2,3,4,5,6,7,8,9,10,11,12], aliases: ["oignon","oignons"] },
  { id: "petit-pois", label: "Petit pois", months: [5,6,7], aliases: ["petit pois","petits pois"] },
  { id: "poireau", label: "Poireau", months: [9,10,11,12,1,2,3,4], aliases: ["poireau","poireaux"] },
  { id: "poivron", label: "Poivron", months: [6,7,8,9,10], aliases: ["poivron","poivrons"] },
  { id: "pomme-de-terre", label: "Pomme de terre", months: [1,2,3,4,5,6,7,8,9,10,11,12], aliases: ["pomme de terre","pommes de terre","patate","patates"] },
  { id: "potiron", label: "Potiron / Courge", months: [9,10,11,12], aliases: ["potiron","potirons","courge","courges","citrouille","citrouilles"] },
  { id: "radis", label: "Radis", months: [4,5,6,7,8,9], aliases: ["radis"] },
  { id: "salsifis", label: "Salsifis", months: [10,11,12,1,2,3], aliases: ["salsifis"] },
  { id: "tomate", label: "Tomate", months: [6,7,8,9,10], aliases: ["tomate","tomates"] },
  { id: "abricot", label: "Abricot", months: [6,7,8], aliases: ["abricot","abricots"] },
  { id: "cerise", label: "Cerise", months: [5,6,7], aliases: ["cerise","cerises"] },
  { id: "citron", label: "Citron", months: [11,12,1,2,3,4], aliases: ["citron","citrons"] },
  { id: "clementine", label: "Clémentine", months: [11,12,1], aliases: ["clementine","clementines","mandarine","mandarines"] },
  { id: "fraise", label: "Fraise", months: [4,5,6,7], aliases: ["fraise","fraises"] },
  { id: "framboise", label: "Framboise", months: [6,7,8,9], aliases: ["framboise","framboises"] },
  { id: "kiwi", label: "Kiwi", months: [11,12,1,2,3], aliases: ["kiwi","kiwis"] },
  { id: "melon", label: "Melon", months: [6,7,8,9], aliases: ["melon","melons"] },
  { id: "mirabelle", label: "Mirabelle", months: [8,9], aliases: ["mirabelle","mirabelles"] },
  { id: "mure", label: "Mûre", months: [8,9,10], aliases: ["mure","mures"] },
  { id: "myrtille", label: "Myrtille", months: [7,8,9], aliases: ["myrtille","myrtilles"] },
  { id: "peche", label: "Pêche / Nectarine", months: [6,7,8,9], aliases: ["peche","peches","nectarine","nectarines"] },
  { id: "poire", label: "Poire", months: [9,10,11,12,1], aliases: ["poire","poires"] },
  { id: "pomme", label: "Pomme", months: [9,10,11,12,1,2,3], aliases: ["pomme","pommes"] },
  { id: "prune", label: "Prune / Quetsche", months: [7,8,9], aliases: ["prune","prunes","quetsche","quetsches"] },
  { id: "raisin", label: "Raisin", months: [8,9,10], aliases: ["raisin","raisins"] },
  { id: "rhubarbe", label: "Rhubarbe", months: [4,5,6,7], aliases: ["rhubarbe"] }
];

function normalizeForMatch(str){
  return String(str).toLowerCase().normalize("NFD")
    .split("").filter(ch => ch.codePointAt(0) < 0x300 || ch.codePointAt(0) > 0x36f).join("");
}

// "Pomme de terre"/"Patate" contiennent "pomme" en tête de mot : sans cette
// exclusion, toute recette avec des pommes de terre serait aussi comptée
// dans le fruit "Pomme" — seule collision connue de ce jeu de données,
// corrigée ici plutôt que de complexifier le matching général (substring
// simple, volontairement pas de découpage par mot).
const POMME_DE_TERRE_PATTERN = /pommes?\s+de\s+terre/;

export function produceMatchesRecipe(produce, recipe){
  return recipe.ingredients.some(([name]) => {
    const normName = normalizeForMatch(name);
    if (produce.id === "pomme" && POMME_DE_TERRE_PATTERN.test(normName)) return false;
    return produce.aliases.some(alias => normName.includes(normalizeForMatch(alias)));
  });
}

export function seasonalProduceForMonth(month){
  return SEASONAL_PRODUCE.filter(p => p.months.includes(month))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
```

- [ ] **Step 2: Ajouter le fichier au service worker**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v75";
```

par :

```js
const CACHE_NAME = "carnet-cache-v76";
```

Puis, dans le même fichier, remplacer :

```js
  "./js/meal-plan.js",
```

par :

```js
  "./js/meal-plan.js",
  "./js/season-data.js",
```

- [ ] **Step 3: Vérifier dans le navigateur (sans session requise)**

Lancer un serveur local sur `public/`, ouvrir la page, puis en console :

```js
const mod = await import('/js/season-data.js');
const juillet = mod.seasonalProduceForMonth(7);
console.log(juillet.length, juillet[0]);

const fauxRecipePatate = { ingredients: [["Pommes de terre", "500 g"]] };
const fauxRecipePomme = { ingredients: [["Pommes", "3 pièce(s)"]] };
const potiron = mod.SEASONAL_PRODUCE.find(p => p.id === "pomme-de-terre");
const pomme = mod.SEASONAL_PRODUCE.find(p => p.id === "pomme");

console.log({
  patateMatchPotiron: mod.produceMatchesRecipe(potiron, fauxRecipePatate),
  patateMatchPomme: mod.produceMatchesRecipe(pomme, fauxRecipePatate),
  pommeMatchPomme: mod.produceMatchesRecipe(pomme, fauxRecipePomme)
});
```

Résultats attendus :
- `juillet.length` est un nombre positif (plusieurs produits sont en saison en juillet) ; `juillet[0]` a bien les champs `id`/`label`/`months`/`aliases`.
- `patateMatchPotiron === true` (la recette de pommes de terre matche bien "Pomme de terre").
- `patateMatchPomme === false` (la recette de pommes de terre ne doit **pas** matcher le fruit "Pomme" — c'est l'exclusion du Step 1 qui doit l'empêcher).
- `pommeMatchPomme === true` (une vraie recette avec des pommes matche bien le fruit "Pomme").

Aucune erreur console.

- [ ] **Step 4: Commit**

```bash
git add public/js/season-data.js public/sw.js
git commit -m "Ajouter la donnee de saisonnalite des fruits et legumes"
```

---

### Task 2: Filtre saisonnier dans la grille de recettes

**Files:**
- Modify: `public/js/dom.js`
- Modify: `public/js/grid.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `produceMatchesRecipe` de `public/js/season-data.js` (Task 1).
- Produces: `state.seasonalFilter` (nouveau, `{ id, label, months, aliases } | null`) dans `public/js/dom.js`, non persistant — consommé par Task 3 (`season.js`) et par `public/js/ui.js` (Task 3, pour le déclencher).

- [ ] **Step 1: Nouvel état et élément du DOM pour le chip**

Dans `public/js/dom.js`, remplacer :

```js
export const allergenFilterToggle = document.getElementById("allergenFilterToggle");
export const allergenFilterBadge = document.getElementById("allergenFilterBadge");
export const allergenFilterPanel = document.getElementById("allergenFilterPanel");
export const allergenFilterList = document.getElementById("allergenFilterList");

/* ---- état de l'application ---- */
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]")),
  excludedAllergens: new Set(JSON.parse(localStorage.getItem("carnet-allergenes-exclus") || "[]"))
};
```

par :

```js
export const allergenFilterToggle = document.getElementById("allergenFilterToggle");
export const allergenFilterBadge = document.getElementById("allergenFilterBadge");
export const allergenFilterPanel = document.getElementById("allergenFilterPanel");
export const allergenFilterList = document.getElementById("allergenFilterList");
export const seasonalFilterChip = document.getElementById("seasonalFilterChip");

/* ---- état de l'application ---- */
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]")),
  excludedAllergens: new Set(JSON.parse(localStorage.getItem("carnet-allergenes-exclus") || "[]")),
  seasonalFilter: null
};
```

Note pour l'implémenteur : `seasonalFilter` n'est volontairement pas persisté en `localStorage` (voir Global Constraints) — c'est un point d'entrée ponctuel depuis l'écran Saison, pas un réglage durable comme `excludedAllergens`.

- [ ] **Step 2: Emplacement du chip dans le HTML**

Dans `public/index.html`, remplacer :

```html
    <div class="grid-heading">
      <h2 id="resultTitle">Toutes les recettes</h2>
      <span id="resultCount" class="result-count"></span>
    </div>
    <div id="recipeGrid" class="recipe-grid"></div>
```

par :

```html
    <div class="grid-heading">
      <h2 id="resultTitle">Toutes les recettes</h2>
      <span id="resultCount" class="result-count"></span>
    </div>
    <div id="seasonalFilterChip" class="seasonal-filter-chip" hidden></div>
    <div id="recipeGrid" class="recipe-grid"></div>
```

- [ ] **Step 3: Filtrage et rendu du chip dans `grid.js`**

Dans `public/js/grid.js`, remplacer :

```js
import { CATEGORY_LABELS, ALLERGENS } from "./recipes-data.js";
import { ICONS } from "./icons.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList } from "./dom.js";
```

par :

```js
import { CATEGORY_LABELS, ALLERGENS } from "./recipes-data.js";
import { ICONS } from "./icons.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList, seasonalFilterChip } from "./dom.js";
import { produceMatchesRecipe } from "./season-data.js";
```

Puis remplacer :

```js
/* ---- filtrage ---- */
function getFilteredRecipes(){
  const q = state.query.trim().toLowerCase();
  return ALL_RECIPES.filter(r => {
    const matchesFilter =
      state.filter === "tout" ? true :
      state.filter === "favoris" ? state.favorites.has(r.id) :
      r.category === state.filter;
    if (!matchesFilter) return false;
    if (state.excludedAllergens.size && r.allergens?.some(a => state.excludedAllergens.has(a))) return false;
    if (!q) return true;
    const haystack = (r.title + " " + r.desc + " " + r.ingredients.map(i => i[0]).join(" ")).toLowerCase();
    return haystack.includes(q);
  });
}
```

par :

```js
/* ---- filtrage ---- */
function getFilteredRecipes(){
  const q = state.query.trim().toLowerCase();
  return ALL_RECIPES.filter(r => {
    const matchesFilter =
      state.filter === "tout" ? true :
      state.filter === "favoris" ? state.favorites.has(r.id) :
      r.category === state.filter;
    if (!matchesFilter) return false;
    if (state.excludedAllergens.size && r.allergens?.some(a => state.excludedAllergens.has(a))) return false;
    if (state.seasonalFilter && !produceMatchesRecipe(state.seasonalFilter, r)) return false;
    if (!q) return true;
    const haystack = (r.title + " " + r.desc + " " + r.ingredients.map(i => i[0]).join(" ")).toLowerCase();
    return haystack.includes(q);
  });
}

/* ---- chip de filtre saisonnier ---- */
function renderSeasonalFilterChip(){
  if (!state.seasonalFilter) {
    seasonalFilterChip.hidden = true;
    seasonalFilterChip.innerHTML = "";
    return;
  }
  seasonalFilterChip.hidden = false;
  seasonalFilterChip.innerHTML = `
    <span>${state.seasonalFilter.label}</span>
    <button type="button" id="seasonalFilterClear" aria-label="Retirer le filtre de saison">✕</button>
  `;
  seasonalFilterChip.querySelector("#seasonalFilterClear").addEventListener("click", () => {
    state.seasonalFilter = null;
    render();
  });
}
```

Puis, dans la fonction `renderGrid()`, remplacer :

```js
function renderGrid(){
  const list = getFilteredRecipes();
  heroSlot.hidden = state.query.trim() !== "";
  resultTitle.textContent = CATEGORY_LABELS[state.filter] || "Recettes";
  resultCount.textContent = list.length + (list.length > 1 ? " recettes" : " recette");
```

par :

```js
function renderGrid(){
  const list = getFilteredRecipes();
  heroSlot.hidden = state.query.trim() !== "";
  resultTitle.textContent = CATEGORY_LABELS[state.filter] || "Recettes";
  resultCount.textContent = list.length + (list.length > 1 ? " recettes" : " recette");
  renderSeasonalFilterChip();
```

Note pour l'implémenteur : `renderSeasonalFilterChip()` est appelée à chaque `render()` (via `renderGrid()`), donc le chip reste synchronisé avec `state.seasonalFilter` sans câblage supplémentaire — cliquer sa croix appelle `render()` qui, à son tour, réévalue `getFilteredRecipes()` et re-rend le chip (maintenant caché).

- [ ] **Step 4: Styles du chip**

Dans `public/style.css`, remplacer :

```css
.grid-section{ max-width:1080px; margin: 36px auto 0; padding: 0 20px; }
.grid-heading{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:16px; }
```

par :

```css
.grid-section{ max-width:1080px; margin: 36px auto 0; padding: 0 20px; }
.seasonal-filter-chip{
  display:inline-flex; align-items:center; gap:8px;
  background: var(--emerald-tint); color: var(--emerald-dark); border-radius:999px;
  padding:6px 8px 6px 14px; font-size:.84rem; font-weight:700; margin-bottom:14px;
}
.seasonal-filter-chip[hidden]{ display:none; }
.seasonal-filter-chip button{
  background: rgba(0,0,0,.08); border:none; border-radius:50%; width:20px; height:20px;
  color: inherit; font-size:.7rem; line-height:1; cursor:pointer;
}
.grid-heading{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:16px; }
```

- [ ] **Step 5: Bump `CACHE_NAME`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v76";
```

par :

```js
const CACHE_NAME = "carnet-cache-v77";
```

- [ ] **Step 6: Vérifier dans le navigateur (sans session requise)**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v77`. Aucune erreur console.

Ce filtre est entièrement testable **sans session authentifiée**, en injectant des recettes de test comme pour le filtre allergène :

```js
const domMod = await import('/js/dom.js');
const gridMod = await import('/js/grid.js');
const storeMod = await import('/js/recipes-store.js');

storeMod.ALL_RECIPES.push(
  { id: 'avec-patate', title: 'Gratin', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[["Pommes de terre","500 g"]], steps:[] },
  { id: 'sans-patate', title: 'Salade', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[["Tomates","2 pièce(s)"]], steps:[] }
);

const seasonMod = await import('/js/season-data.js');
const patate = seasonMod.SEASONAL_PRODUCE.find(p => p.id === 'pomme-de-terre');

gridMod.render();
domMod.state.seasonalFilter = patate;
gridMod.render();
const idsFiltered = [...document.querySelectorAll('.recipe-card')].map(c => c.dataset.id);
const chipVisible = !domMod.seasonalFilterChip.hidden;
const chipText = domMod.seasonalFilterChip.textContent.trim();

domMod.seasonalFilterChip.querySelector('#seasonalFilterClear').click();
const idsAfterClear = [...document.querySelectorAll('.recipe-card')].map(c => c.dataset.id);
const chipHiddenAfterClear = domMod.seasonalFilterChip.hidden;
const stateResetAfterClear = domMod.state.seasonalFilter === null;

console.log({ idsFiltered, chipVisible, chipText, idsAfterClear, chipHiddenAfterClear, stateResetAfterClear });
```

- `idsFiltered` contient `avec-patate` mais pas `sans-patate`.
- `chipVisible === true`, `chipText` contient "Pomme de terre".
- Après le clic sur la croix : `idsAfterClear` contient les deux recettes de test à nouveau, `chipHiddenAfterClear === true`, `stateResetAfterClear === true`.

Aucune erreur console sur l'ensemble de ce parcours.

- [ ] **Step 7: Commit**

```bash
git add public/js/dom.js public/js/grid.js public/index.html public/style.css public/sw.js
git commit -m "Ajouter le filtre saisonnier a la grille de recettes"
```

---

### Task 3: Nouvelle vue "Saison" et navigation

**Files:**
- Create: `public/js/season.js`
- Modify: `public/js/meal-plan.js`
- Modify: `public/js/dom.js`
- Modify: `public/js/ui.js`
- Modify: `public/js/main.js`
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `SEASONAL_PRODUCE`, `seasonalProduceForMonth`, `produceMatchesRecipe` de `public/js/season-data.js` (Task 1) ; `state.seasonalFilter` de `public/js/dom.js` (Task 2).
- Produces: `openSeason()`, `closeSeason()` exportés depuis `public/js/season.js` — consommés par `public/js/ui.js` et `public/js/main.js`. `goToSeason()`, `goToSeasonalRecipes(produce)` exportés depuis `public/js/ui.js` — consommés par `public/js/main.js` (le premier) et `public/js/season.js` (le second).

- [ ] **Step 1: Exporter `MONTH_NAMES` depuis `meal-plan.js`**

Dans `public/js/meal-plan.js`, remplacer :

```js
const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
```

par :

```js
export const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
```

- [ ] **Step 2: Éléments du DOM pour la vue Saison**

Dans `public/js/dom.js`, remplacer :

```js
export const mealPlanView = document.getElementById("mealPlanView");
export const mealPlanScroll = document.getElementById("mealPlanScroll");
export const mealPlanCloseBtn = document.getElementById("mealPlanCloseBtn");
export const navMealPlanBtn = document.getElementById("navMealPlanBtn");
```

par :

```js
export const mealPlanView = document.getElementById("mealPlanView");
export const mealPlanScroll = document.getElementById("mealPlanScroll");
export const mealPlanCloseBtn = document.getElementById("mealPlanCloseBtn");
export const navMealPlanBtn = document.getElementById("navMealPlanBtn");
export const seasonView = document.getElementById("seasonView");
export const seasonScroll = document.getElementById("seasonScroll");
export const seasonCloseBtn = document.getElementById("seasonCloseBtn");
export const navSeasonBtn = document.getElementById("navSeasonBtn");
```

- [ ] **Step 3: Section de vue et entrée du tiroir dans le HTML**

Dans `public/index.html`, remplacer :

```html
<!-- ===== VUE ÉDITEUR PHOTO (recadrage/rotation avant sauvegarde) ===== -->
<section id="photoEditorView" class="detail-view add-view" aria-hidden="true">
```

par :

```html
<!-- ===== VUE SAISON (fruits/légumes de saison, liés aux recettes) ===== -->
<section id="seasonView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="seasonCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="seasonScroll"></div>
</section>

<!-- ===== VUE ÉDITEUR PHOTO (recadrage/rotation avant sauvegarde) ===== -->
<section id="photoEditorView" class="detail-view add-view" aria-hidden="true">
```

Puis, dans le même fichier, remplacer :

```html
    <button class="drawer-item" id="navMealPlanBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
      Planning
    </button>
    <div class="drawer-divider"></div>
```

par :

```html
    <button class="drawer-item" id="navMealPlanBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
      Planning
    </button>
    <button class="drawer-item" id="navSeasonBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M5 19c8-1 13-6 14-14-8 1-13 6-14 14Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/><path d="M6 18c3-4 6-7 10-10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
      Saison
    </button>
    <div class="drawer-divider"></div>
```

- [ ] **Step 4: Créer `public/js/season.js`**

Créer le fichier `public/js/season.js` avec ce contenu exact :

```js
import { seasonView, seasonScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, goToSeasonalRecipes } from "./ui.js";
import { ALL_RECIPES } from "./recipes-store.js";
import { SEASONAL_PRODUCE, seasonalProduceForMonth, produceMatchesRecipe } from "./season-data.js";
import { MONTH_NAMES } from "./meal-plan.js";

/* ---- vue plein écran : liste des fruits/légumes du mois affiché ---- */
let currentMonth = new Date().getMonth() + 1; // 1=janvier..12=décembre

function produceWithCounts(month){
  return seasonalProduceForMonth(month).map(p => ({
    ...p,
    count: ALL_RECIPES.filter(r => produceMatchesRecipe(p, r)).length
  }));
}

function renderSeason(){
  const list = produceWithCounts(currentMonth);

  seasonScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="seasonMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Saison</h2>
    </div>
    <div class="season-body">
      <div class="month-nav">
        <button id="monthPrevBtn" type="button" aria-label="Mois précédent">‹</button>
        <span id="monthLabel">${MONTH_NAMES[currentMonth - 1]}</span>
        <button id="monthNextBtn" type="button" aria-label="Mois suivant">›</button>
      </div>
      <div class="season-list">
        ${list.map(p => `
          <button type="button" class="season-item" data-id="${p.id}">
            <span class="season-item-label">${p.label}</span>
            <span class="season-item-count">${p.count}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  seasonScroll.querySelector("#seasonMenuBtn").addEventListener("click", openDrawer);
  seasonScroll.querySelector("#monthPrevBtn").addEventListener("click", () => changeMonth(-1));
  seasonScroll.querySelector("#monthNextBtn").addEventListener("click", () => changeMonth(1));
  seasonScroll.querySelectorAll(".season-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const produce = SEASONAL_PRODUCE.find(p => p.id === btn.dataset.id);
      goToSeasonalRecipes(produce);
    });
  });
}

function changeMonth(offset){
  currentMonth = ((currentMonth - 1 + offset + 12) % 12) + 1;
  renderSeason();
}

/* ---- ouverture/fermeture de la vue ---- */
export function openSeason(){
  currentMonth = new Date().getMonth() + 1;
  renderSeason();
  seasonView.classList.add("is-open");
  seasonView.setAttribute("aria-hidden", "false");
  seasonScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeSeason(){
  if (!seasonView.classList.contains("is-open")) return;
  seasonView.classList.remove("is-open");
  seasonView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

Note pour l'implémenteur : `season.js` importe `goToSeasonalRecipes` depuis `ui.js`, et `ui.js` importera `openSeason`/`closeSeason` depuis `season.js` au Step 5 — c'est une dépendance circulaire, mais elle est **déjà le pattern établi** dans ce projet entre `ui.js` et `meal-plan.js`/`scan-recipe.js`/`import-url.js` (aucun des deux modules n'appelle la fonction importée pendant l'évaluation du module, seulement à l'intérieur de gestionnaires d'événements) — sans danger avec les modules ES.

- [ ] **Step 5: Câblage dans `ui.js`**

Dans `public/js/ui.js`, remplacer :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView, photoEditorView, importUrlView, mealPlanView } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { closeScanRecipe, openScanRecipe } from "./scan-recipe.js";
import { closeImportUrl, openImportUrl } from "./import-url.js";
import { closePhotoEditor } from "./photo-editor.js";
import { closeMealPlan, openMealPlan } from "./meal-plan.js";
import { render } from "./grid.js";
```

par :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView, photoEditorView, importUrlView, mealPlanView, seasonView } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { closeScanRecipe, openScanRecipe } from "./scan-recipe.js";
import { closeImportUrl, openImportUrl } from "./import-url.js";
import { closePhotoEditor } from "./photo-editor.js";
import { closeMealPlan, openMealPlan } from "./meal-plan.js";
import { closeSeason, openSeason } from "./season.js";
import { render } from "./grid.js";
```

Puis remplacer :

```js
export function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || scanView.classList.contains("is-open")
    || importUrlView.classList.contains("is-open")
    || mealPlanView.classList.contains("is-open")
    || photoEditorView.classList.contains("is-open")
    || drawer.classList.contains("is-open");
  document.body.style.overflow = anyOpen ? "hidden" : "";
}
```

par :

```js
export function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || scanView.classList.contains("is-open")
    || importUrlView.classList.contains("is-open")
    || mealPlanView.classList.contains("is-open")
    || seasonView.classList.contains("is-open")
    || photoEditorView.classList.contains("is-open")
    || drawer.classList.contains("is-open");
  document.body.style.overflow = anyOpen ? "hidden" : "";
}
```

Puis remplacer :

```js
function closeAllOverlays(){
  closeDetail();
  closeAddForm();
  closePanier();
  closeProfile();
  closeScanRecipe();
  closeImportUrl();
  closeMealPlan();
  closePhotoEditor();
}
```

par :

```js
function closeAllOverlays(){
  closeDetail();
  closeAddForm();
  closePanier();
  closeProfile();
  closeScanRecipe();
  closeImportUrl();
  closeMealPlan();
  closeSeason();
  closePhotoEditor();
}
```

Enfin, à la toute fin du fichier, remplacer :

```js
export function goToMealPlan(){
  closeAllOverlays();
  closeDrawer();
  openMealPlan();
}
```

par :

```js
export function goToMealPlan(){
  closeAllOverlays();
  closeDrawer();
  openMealPlan();
}
export function goToSeason(){
  closeAllOverlays();
  closeDrawer();
  openSeason();
}
export function goToSeasonalRecipes(produce){
  closeAllOverlays();
  requestCloseSheet();
  closeDrawer();
  chips.forEach(c => c.classList.remove("is-active"));
  document.querySelector('.chip[data-filter="tout"]').classList.add("is-active");
  favToggleHeader.setAttribute("aria-pressed", "false");
  state.filter = "tout";
  state.seasonalFilter = produce;
  render();
}
```

Note pour l'implémenteur : `goToSeasonalRecipes` réinitialise le filtre de catégorie à "tout" (comme `goToAllRecipes`/`goToFavoris` le font déjà pour leur propre cas), pour éviter qu'un filtre de catégorie resté actif (ex. "Desserts") ne masque silencieusement des recettes qui matchent pourtant l'ingrédient de saison. `state.query` et `state.excludedAllergens` ne sont volontairement pas touchés (voir le design : ils se combinent avec le filtre saisonnier).

- [ ] **Step 6: Câblage dans `main.js`**

Dans `public/js/main.js`, remplacer :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn, navMealPlanBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, mealPlanView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, mealPlanCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
import { render, renderAllergenFilterPanel } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { closeScanRecipe } from "./scan-recipe.js";
import { closeImportUrl } from "./import-url.js";
import { closeMealPlan } from "./meal-plan.js";
import { closePhotoEditor } from "./photo-editor.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, goToImportUrl, goToMealPlan, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn, navMealPlanBtn, navSeasonBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, mealPlanView, seasonView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, mealPlanCloseBtn, seasonCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
import { render, renderAllergenFilterPanel } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { closeScanRecipe } from "./scan-recipe.js";
import { closeImportUrl } from "./import-url.js";
import { closeMealPlan } from "./meal-plan.js";
import { closeSeason } from "./season.js";
import { closePhotoEditor } from "./photo-editor.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, goToImportUrl, goToMealPlan, goToSeason, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
```

Puis remplacer :

```js
function closeAnyOpenSheet(){
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
  if (scanView.classList.contains("is-open")) closeScanRecipe();
  if (importUrlView.classList.contains("is-open")) closeImportUrl();
  if (mealPlanView.classList.contains("is-open")) closeMealPlan();
  closePhotoEditor();
}
```

par :

```js
function closeAnyOpenSheet(){
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
  if (scanView.classList.contains("is-open")) closeScanRecipe();
  if (importUrlView.classList.contains("is-open")) closeImportUrl();
  if (mealPlanView.classList.contains("is-open")) closeMealPlan();
  if (seasonView.classList.contains("is-open")) closeSeason();
  closePhotoEditor();
}
```

Puis remplacer :

```js
mealPlanCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);
```

par :

```js
mealPlanCloseBtn.addEventListener("click", requestCloseSheet);
seasonCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);
```

Enfin, remplacer :

```js
navMealPlanBtn.addEventListener("click", goToMealPlan);
```

par :

```js
navMealPlanBtn.addEventListener("click", goToMealPlan);
navSeasonBtn.addEventListener("click", goToSeason);
```

Note pour l'implémenteur : `closeProfile` est déjà importé plus haut dans `main.js` (`import { openProfile, closeProfile, ... } from "./profile.js";`, ligne existante non modifiée par ce plan) — ne pas le réimporter en double.

- [ ] **Step 7: Styles de la vue Saison**

Dans `public/style.css`, remplacer :

```css
.recipe-picker-item:hover{ background: var(--surface); }

.recipe-section{
```

par :

```css
.recipe-picker-item:hover{ background: var(--surface); }

.season-body{ max-width:760px; margin:0 auto; padding:12px 20px 100px; }
.month-nav{ display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:16px; }
.month-nav button{ background:none; border:none; font-size:1.4rem; color: var(--ink); cursor:pointer; padding:4px 10px; }
#monthLabel{ font-weight:700; font-size:1rem; min-width:100px; text-align:center; text-transform:capitalize; }
.season-list{ display:flex; flex-direction:column; gap:8px; }
.season-item{
  display:flex; align-items:center; justify-content:space-between;
  width:100%; text-align:left; background: var(--surface); border:1px solid var(--line);
  border-radius:6px; padding:12px 16px; font-size:.92rem; color: var(--ink);
}
.season-item:hover{ border-color: var(--emerald); }
.season-item-count{ flex:none; background: var(--bg); color: var(--ink-soft); font-size:.78rem; font-weight:700; border-radius:999px; padding:2px 10px; }

.recipe-section{
```

- [ ] **Step 8: Bump `CACHE_NAME` et ajout de `season.js` à `APP_SHELL`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v77";
```

par :

```js
const CACHE_NAME = "carnet-cache-v78";
```

Puis, dans le même fichier, remplacer :

```js
  "./js/meal-plan.js",
  "./js/season-data.js",
```

par :

```js
  "./js/meal-plan.js",
  "./js/season-data.js",
  "./js/season.js",
```

- [ ] **Step 9: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v78`. Aucune erreur console au chargement.

Cette tâche dépend d'une vraie session authentifiée pour un test de bout en bout complet (comme le Planning), mais la majeure partie est vérifiable **sans session**, en manipulant directement le module :

```js
const domMod = await import('/js/dom.js');
const seasonMod = await import('/js/season.js');
const storeMod = await import('/js/recipes-store.js');

storeMod.ALL_RECIPES.push(
  { id: 'avec-patate', title: 'Gratin', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[["Pommes de terre","500 g"]], steps:[] }
);

seasonMod.openSeason();
const isOpen = domMod.seasonView.classList.contains('is-open');
const hasMonthLabel = !!domMod.seasonScroll.querySelector('#monthLabel');
const itemCount = domMod.seasonScroll.querySelectorAll('.season-item').length;

console.log({ isOpen, hasMonthLabel, itemCount });
```

- `isOpen === true`.
- `hasMonthLabel === true`.
- `itemCount` est un nombre positif (le mois en cours a au moins un produit de saison — vrai pour n'importe quel mois avec ce jeu de données, puisque "Carotte"/"Oignon"/"Pomme de terre" sont en saison toute l'année).

Si une session authentifiée est disponible : ouvrir "Saison" depuis le tiroir, naviguer d'un mois à l'autre (la liste change), taper un produit avec au moins une recette correspondante (ex. "Pomme de terre" si une recette en contient) → la vue se ferme, la grille s'affiche avec le chip "Pomme de terre ✕" actif et seulement les recettes correspondantes. Cliquer la croix du chip → la grille complète revient.

Si aucune session n'est disponible, relecture statique attentive du diff et le signaler dans le rapport (DONE_WITH_CONCERNS) plutôt que de bloquer sur cette étape.

- [ ] **Step 10: Commit**

```bash
git add public/js/season.js public/js/meal-plan.js public/js/dom.js public/js/ui.js public/js/main.js public/index.html public/style.css public/sw.js
git commit -m "Ajouter la vue Saison et sa navigation vers les recettes filtrees"
```
