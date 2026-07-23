# Planification de repas — ajout groupé au panier — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un mode "Planifier" sur la grille de recettes : une case à cocher par carte pour sélectionner plusieurs recettes, et un bouton pour les ajouter toutes au panier en un clic.

**Architecture:** Un état éphémère (`state.isPlanning`, `state.plannedRecipes`) piloté depuis un nouveau bouton d'en-tête. `grid.js` affiche les cases à cocher et une barre fixe en bas de l'écran (compteur + bouton d'ajout). `main.js` orchestre le clic sur ce bouton : résout les ids sélectionnés en objets recette complets (`ALL_RECIPES`), les passe à une nouvelle fonction `addRecipesToCartBatch()` dans `cart.js` qui réutilise l'`addRecipeToCart()` déjà existant pour chacune, puis réinitialise l'état et quitte le mode.

**Tech Stack:** Vanilla JS (modules ES natifs, pas de bundler), aucun framework de test — vérification manuelle dans le navigateur.

## Global Constraints

- Zéro étape de build côté client, pas de framework de test automatisé — vérification manuelle dans le navigateur, comme pour toutes les fonctionnalités précédentes de ce projet.
- Pas de calendrier ni de notion de jour/date — version simple uniquement (voir le design, hors périmètre explicite).
- La sélection (`state.plannedRecipes`) est **éphémère** : aucune sauvegarde en `localStorage` ni synchronisation Supabase. Elle se vide silencieusement en sortant du mode Planifier (avec ou sans ajout au panier).
- Ajouter une recette déjà présente au panier la remplace simplement (comportement déjà existant d'`addRecipeToCart`, ne pas le modifier).
- Aucun ajustement du nombre de personnes avant l'ajout groupé — chaque recette est ajoutée à son nombre de personnes par défaut (`recipe.servings`).
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v64`).
- Les fichiers du site sont dans `public/`.

---

### Task 1: État, bouton "Planifier", cases à cocher sur la grille, barre du bas

**Files:**
- Modify: `public/js/dom.js`
- Modify: `public/index.html`
- Modify: `public/js/grid.js`
- Modify: `public/js/main.js`
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- Produces (dans `public/js/dom.js`) : `state.isPlanning` (booléen, défaut `false`), `state.plannedRecipes` (`Set<string>`, défaut vide) — consommés par `public/js/grid.js` (ce task) et par le Task 2 (`public/js/main.js`). Éléments DOM `planBtn`, `planBar`, `planBarCount`, `planAddBtn` — `planAddBtn` est consommé par le Task 2 pour y attacher le clic d'ajout groupé.
- Ce task ne câble **aucun** ajout réel au panier — `planAddBtn` existe dans le DOM mais n'a pas encore d'écouteur de clic (ajouté au Task 2). Le vérifier dans ce task, c'est seulement s'assurer qu'il apparaît et se désactive/active correctement selon le compteur.

- [ ] **Step 1: Nouvel état et éléments du DOM**

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
export const planBtn = document.getElementById("planBtn");
export const planBar = document.getElementById("planBar");
export const planBarCount = document.getElementById("planBarCount");
export const planAddBtn = document.getElementById("planAddBtn");

/* ---- état de l'application ---- */
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]")),
  excludedAllergens: new Set(JSON.parse(localStorage.getItem("carnet-allergenes-exclus") || "[]")),
  isPlanning: false,
  plannedRecipes: new Set()
};
```

- [ ] **Step 2: Bouton "Planifier" dans l'en-tête**

Dans `public/index.html`, remplacer :

```html
      <button id="cartToggle" class="cart-toggle" type="button" aria-label="Panier de courses">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span id="cartBadge" class="cart-badge" hidden>0</span>
      </button>
```

par :

```html
      <button id="cartToggle" class="cart-toggle" type="button" aria-label="Panier de courses">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span id="cartBadge" class="cart-badge" hidden>0</span>
      </button>
      <button id="planBtn" class="cart-toggle" type="button" aria-pressed="false" aria-label="Planifier des recettes">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6h9M9 12h9M9 18h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m4 6 1.5 1.5L8 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m4 12 1.5 1.5L8 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="16" width="4" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
      </button>
```

Puis, juste avant la fermeture `</main>`, ajouter la barre fixe (elle est en `position:fixed`, donc son emplacement exact dans le HTML n'affecte pas son rendu — la placer ici la garde à proximité du contenu qu'elle contrôle) :

Remplacer :

```html
    <p id="emptyState" class="empty-state" hidden>
      Rien à se mettre sous la dent. Essayez un autre mot-clé ou une autre catégorie.
    </p>
  </section>
</main>
```

par :

```html
    <p id="emptyState" class="empty-state" hidden>
      Rien à se mettre sous la dent. Essayez un autre mot-clé ou une autre catégorie.
    </p>
  </section>
</main>

<div class="plan-bar" id="planBar" hidden>
  <span id="planBarCount">Aucune recette sélectionnée</span>
  <button class="btn-primary" id="planAddBtn" type="button" disabled>Ajouter au panier</button>
</div>
```

- [ ] **Step 3: Cases à cocher sur les cartes et mise à jour de la barre, dans `grid.js`**

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
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList, planBar, planBarCount, planAddBtn } from "./dom.js";
```

Puis remplacer :

```js
/* ---- rendu de la grille ---- */
function renderGrid(){
  const list = getFilteredRecipes();
  heroSlot.hidden = state.query.trim() !== "";
  resultTitle.textContent = CATEGORY_LABELS[state.filter] || "Recettes";
  resultCount.textContent = list.length + (list.length > 1 ? " recettes" : " recette");

  grid.innerHTML = "";
  emptyState.hidden = list.length !== 0;

  list.forEach(r => {
    const card = document.createElement("button");
    card.className = `recipe-card cat-${r.category}`;
    card.type = "button";
    card.dataset.id = r.id;
    const isFav = state.favorites.has(r.id);
    card.innerHTML = `
      <div class="card-photo">
        <span class="card-icon">${ICONS[r.icon]}</span>
        <button class="card-fav" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris" data-favid="${r.id}">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="card-body">
        <span class="card-cat">${r.category}</span>
        <h3 class="card-title">${r.title}</h3>
        <p class="card-desc">${r.desc}</p>
        <div class="card-meta">
          <span>⏱ ${r.time} min</span>
          <span>${r.servings} pers.</span>
          <span>${r.difficulty}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-fav")) return;
      openDetail(r.id);
    });
    card.querySelector(".card-fav").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(r.id);
    });
    grid.appendChild(card);
    applyCardPhoto(r.id, card.querySelector(".card-icon"));
  });
}

export function render(){
  renderGrid();
}
```

par :

```js
/* ---- rendu de la grille ---- */
function planCheckboxHtml(r){
  const isPlanned = state.plannedRecipes.has(r.id);
  return `
    <button class="card-plan" type="button" aria-pressed="${isPlanned}" aria-label="Sélectionner pour le panier" data-planid="${r.id}">
      <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="${isPlanned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8"/>${isPlanned ? '<path d="m8 12 3 3 5-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : ""}</svg>
    </button>
  `;
}

function updatePlanBar(){
  planBar.hidden = !state.isPlanning;
  const count = state.plannedRecipes.size;
  planBarCount.textContent = count === 0
    ? "Aucune recette sélectionnée"
    : `${count} recette${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""}`;
  planAddBtn.disabled = count === 0;
}

function renderGrid(){
  const list = getFilteredRecipes();
  heroSlot.hidden = state.query.trim() !== "";
  resultTitle.textContent = CATEGORY_LABELS[state.filter] || "Recettes";
  resultCount.textContent = list.length + (list.length > 1 ? " recettes" : " recette");

  grid.innerHTML = "";
  emptyState.hidden = list.length !== 0;

  list.forEach(r => {
    const card = document.createElement("button");
    card.className = `recipe-card cat-${r.category}`;
    card.type = "button";
    card.dataset.id = r.id;
    const isFav = state.favorites.has(r.id);
    card.innerHTML = `
      <div class="card-photo">
        <span class="card-icon">${ICONS[r.icon]}</span>
        ${state.isPlanning ? planCheckboxHtml(r) : ""}
        <button class="card-fav" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris" data-favid="${r.id}">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="card-body">
        <span class="card-cat">${r.category}</span>
        <h3 class="card-title">${r.title}</h3>
        <p class="card-desc">${r.desc}</p>
        <div class="card-meta">
          <span>⏱ ${r.time} min</span>
          <span>${r.servings} pers.</span>
          <span>${r.difficulty}</span>
        </div>
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-fav") || e.target.closest(".card-plan")) return;
      openDetail(r.id);
    });
    card.querySelector(".card-fav").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(r.id);
    });
    if (state.isPlanning) {
      card.querySelector(".card-plan").addEventListener("click", (e) => {
        e.stopPropagation();
        if (state.plannedRecipes.has(r.id)) state.plannedRecipes.delete(r.id);
        else state.plannedRecipes.add(r.id);
        render();
      });
    }
    grid.appendChild(card);
    applyCardPhoto(r.id, card.querySelector(".card-icon"));
  });

  updatePlanBar();
}

export function render(){
  renderGrid();
}
```

Notes pour l'implémenteur :
- `planCheckboxHtml(r)` n'est appelée que si `state.isPlanning` est vrai — la case n'existe tout simplement pas dans le DOM hors de ce mode (pas juste masquée en CSS), donc pas besoin d'un `if` supplémentaire pour l'écouteur de clic ailleurs que celui déjà montré.
- `updatePlanBar()` est appelée à **chaque** `renderGrid()`, donc aussi bien quand on change de filtre/recherche que quand on coche une case (via le `render()` dans le nouvel écouteur de clic) — elle reste donc toujours synchronisée sans logique séparée.
- Le clic sur la case (`.card-plan`) et le clic sur le cœur favori (`.card-fav`) utilisent tous deux `stopPropagation()` pour ne jamais déclencher l'ouverture de la fiche recette (`openDetail`) — la carte elle-même reste un `<button>` cliquable pour ouvrir la recette normalement en dehors de ces deux zones, y compris en mode Planifier.

- [ ] **Step 4: Bouton "Planifier" — bascule du mode, dans `main.js`**

Dans `public/js/main.js`, remplacer :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel, planBtn
} from "./dom.js";
```

Puis remplacer :

```js
addFab.addEventListener("click", () => openAddForm());
cartToggle.addEventListener("click", openPanier);
```

par :

```js
addFab.addEventListener("click", () => openAddForm());
cartToggle.addEventListener("click", openPanier);

planBtn.addEventListener("click", () => {
  state.isPlanning = !state.isPlanning;
  state.plannedRecipes.clear();
  document.body.classList.toggle("is-planning", state.isPlanning);
  planBtn.setAttribute("aria-pressed", String(state.isPlanning));
  render();
});
```

Note pour l'implémenteur : `state.plannedRecipes.clear()` s'exécute à **chaque** clic sur le bouton, qu'on entre ou qu'on sorte du mode — en sortant, ça vide la sélection (comportement voulu) ; en entrant, la sélection est de toute façon déjà vide puisque la sortie précédente l'a vidée. Pas besoin de logique conditionnelle.

- [ ] **Step 5: Styles — bouton actif, case à cocher, barre du bas, masquage du bouton flottant**

Dans `public/style.css`, repérer la règle `.cart-toggle:active{ transform: scale(.94); }` et ajouter juste après :

```css
.cart-toggle[aria-pressed="true"]{ background: var(--emerald); color:#fff; border-color: var(--emerald); }
```

Puis, repérer la règle `.card-fav svg{ width:16px; height:16px; }` et ajouter juste après :

```css
.card-plan{
  position:absolute; top:10px; left:10px; z-index:1;
  background: rgba(255,255,255,.92); border:none; color: var(--ink-faint); padding:8px;
  display:flex; border-radius: 999px;
  box-shadow: var(--shadow-raised);
  transition: color .15s ease;
}
.card-plan[aria-pressed="true"]{ color: var(--emerald-dark); }
.card-plan svg{ width:16px; height:16px; }
```

Puis, repérer la règle `.fab:active{ transform: scale(.94); }` et ajouter juste après :

```css

.plan-bar{
  position:fixed; left:0; right:0; bottom:0; z-index:45;
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  background: var(--surface); border-top:1px solid var(--line);
  padding: 14px 20px; box-shadow: var(--shadow-raised);
}
.plan-bar[hidden]{ display:none; }
#planBarCount{ font-size:.86rem; font-weight:600; color: var(--ink); }
#planAddBtn:disabled{ opacity:.4; cursor:not-allowed; }
```

Enfin, remplacer :

```css
body.auth-locked .site-header,
body.auth-locked #addFab{ display:none; }
```

par :

```css
body.auth-locked .site-header,
body.auth-locked #addFab{ display:none; }
body.is-planning #addFab{ display:none; }
```

Note pour l'implémenteur : le bouton flottant "+" (`#addFab`) est masqué en mode Planifier pour ne pas se superposer visuellement à la nouvelle barre du bas — même pattern que le masquage déjà utilisé pour l'écran de connexion (`body.auth-locked`).

- [ ] **Step 6: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v64";
```

par :

```js
const CACHE_NAME = "carnet-cache-v65";
```

- [ ] **Step 7: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v65`. Aucune erreur console au chargement.

Cette tâche est entièrement testable **sans session authentifiée**, en injectant des recettes de test directement dans `ALL_RECIPES` et en manipulant `state` :

```js
const domMod = await import('/js/dom.js');
const gridMod = await import('/js/grid.js');
const storeMod = await import('/js/recipes-store.js');

storeMod.ALL_RECIPES.push(
  { id: 'r1', title: 'Recette 1', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[], steps:[] },
  { id: 'r2', title: 'Recette 2', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[], steps:[] }
);
gridMod.render();

// avant le mode Planifier : pas de case, barre masquée
const noCheckboxesBefore = document.querySelectorAll('.card-plan').length === 0;
const barHiddenBefore = domMod.planBar.hidden;

// activer le mode Planifier via le vrai bouton
domMod.planBtn.click();
const checkboxesAfterToggle = document.querySelectorAll('.card-plan').length;
const barVisibleAfterToggle = !domMod.planBar.hidden;
const countTextEmpty = domMod.planBarCount.textContent;
const addBtnDisabledEmpty = domMod.planAddBtn.disabled;

// cocher une recette via son vrai bouton
document.querySelector('.card-plan[data-planid="r1"]').click();
const countTextOne = domMod.planBarCount.textContent;
const addBtnDisabledOne = domMod.planAddBtn.disabled;
const r1Checked = document.querySelector('.card-plan[data-planid="r1"]').getAttribute('aria-pressed');

// la sélection doit survivre à un changement de filtre pendant le mode Planifier
domMod.state.filter = "dessert";
gridMod.render();
const r1HiddenByFilter = document.querySelector('.card-plan[data-planid="r1"]') === null;
const selectionSurvivesFilter = domMod.state.plannedRecipes.has('r1');
domMod.state.filter = "tout";
gridMod.render();
const r1StillCheckedAfterFilterRoundtrip = document.querySelector('.card-plan[data-planid="r1"]').getAttribute('aria-pressed');

// décocher
document.querySelector('.card-plan[data-planid="r1"]').click();
const countTextZeroAgain = domMod.planBarCount.textContent;

// sortir du mode Planifier sans ajouter au panier
domMod.planBtn.click();
const checkboxesAfterExit = document.querySelectorAll('.card-plan').length;
const selectionClearedAfterExit = domMod.state.plannedRecipes.size;

console.log({
  noCheckboxesBefore, barHiddenBefore,
  checkboxesAfterToggle, barVisibleAfterToggle, countTextEmpty, addBtnDisabledEmpty,
  countTextOne, addBtnDisabledOne, r1Checked,
  r1HiddenByFilter, selectionSurvivesFilter, r1StillCheckedAfterFilterRoundtrip,
  countTextZeroAgain,
  checkboxesAfterExit, selectionClearedAfterExit
});
```

Résultats attendus :
- `noCheckboxesBefore === true`, `barHiddenBefore === true`.
- `checkboxesAfterToggle === 2`, `barVisibleAfterToggle === true`, `countTextEmpty === "Aucune recette sélectionnée"`, `addBtnDisabledEmpty === true`.
- `countTextOne === "1 recette sélectionnée"`, `addBtnDisabledOne === false`, `r1Checked === "true"`.
- `r1HiddenByFilter === true` (le filtre "dessert" masque `r1`, qui est un "plat"), `selectionSurvivesFilter === true` (la sélection est indexée par id, pas par position affichée — elle n'est pas perdue même quand la carte disparaît de la grille filtrée). `r1StillCheckedAfterFilterRoundtrip === "true"` une fois revenu sur "tout".
- `countTextZeroAgain === "Aucune recette sélectionnée"`.
- `checkboxesAfterExit === 0`, `selectionClearedAfterExit === 0`.

Vérifier aussi que cliquer directement sur une carte (en dehors de la case) ouvre bien la fiche recette même en mode Planifier (comportement inchangé), et qu'aucune erreur console n'apparaît sur l'ensemble du parcours.

- [ ] **Step 8: Commit**

```bash
git add public/js/dom.js public/index.html public/js/grid.js public/js/main.js public/style.css public/sw.js
git commit -m "Ajouter le mode Planifier (cases a cocher sur la grille, barre du bas)"
```

---

### Task 2: Ajout groupé au panier

**Files:**
- Modify: `public/js/cart.js`
- Modify: `public/js/main.js`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes : `state.isPlanning`, `state.plannedRecipes`, `planBtn`, `planAddBtn` (Task 1) ; `ALL_RECIPES` de `public/js/recipes-store.js` (déjà existant, pas une nouveauté de ce plan) ; `addRecipeToCart(recipe, servings, ingredients)` déjà existant dans `public/js/cart.js` (ne pas modifier sa signature).
- Produces : `addRecipesToCartBatch(recipes)`, exporté depuis `public/js/cart.js` — `recipes` est un tableau d'objets recette complets (pas des ids), consommé par `public/js/main.js` dans ce même task.

- [ ] **Step 1: Fonction d'ajout groupé dans `cart.js`**

Dans `public/js/cart.js`, repérer la fonction `addRecipeToCart` et ajouter juste après :

```js
export function addRecipesToCartBatch(recipes){
  recipes.forEach(r => addRecipeToCart(r, r.servings, r.ingredients));
  const count = recipes.length;
  showToast(`${count} recette${count > 1 ? "s" : ""} ajoutée${count > 1 ? "s" : ""} au panier`);
}
```

Note pour l'implémenteur : `addRecipeToCart` sauvegarde et synchronise le panier à **chaque** appel (une fois par recette) plutôt qu'une seule fois pour tout le lot — accepté tel quel pour ce plan (le panier ne contient jamais qu'une poignée de recettes, l'inefficacité est négligeable), pas la peine de refactoriser `addRecipeToCart` pour un vrai traitement par lot.

- [ ] **Step 2: Câbler le bouton d'ajout groupé dans `main.js`**

Dans `public/js/main.js`, remplacer :

```js
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
```

par :

```js
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal, addRecipesToCartBatch } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal, ALL_RECIPES } from "./recipes-store.js";
```

Puis remplacer :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel, planBtn
} from "./dom.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel, planBtn, planAddBtn
} from "./dom.js";
```

Puis remplacer :

```js
planBtn.addEventListener("click", () => {
  state.isPlanning = !state.isPlanning;
  state.plannedRecipes.clear();
  document.body.classList.toggle("is-planning", state.isPlanning);
  planBtn.setAttribute("aria-pressed", String(state.isPlanning));
  render();
});
```

par :

```js
planBtn.addEventListener("click", () => {
  state.isPlanning = !state.isPlanning;
  state.plannedRecipes.clear();
  document.body.classList.toggle("is-planning", state.isPlanning);
  planBtn.setAttribute("aria-pressed", String(state.isPlanning));
  render();
});

planAddBtn.addEventListener("click", () => {
  const recipes = ALL_RECIPES.filter(r => state.plannedRecipes.has(r.id));
  if (!recipes.length) return;
  addRecipesToCartBatch(recipes);
  state.plannedRecipes.clear();
  state.isPlanning = false;
  document.body.classList.remove("is-planning");
  planBtn.setAttribute("aria-pressed", "false");
  render();
});
```

Notes pour l'implémenteur :
- Le `if (!recipes.length) return;` est une garde défensive — `planAddBtn` est déjà désactivé (`disabled`) quand la sélection est vide (Task 1), donc ce clic ne devrait normalement jamais arriver avec 0 recette, mais la garde coûte une ligne et évite un appel inutile à `addRecipesToCartBatch([])` si jamais l'état se désynchronisait.
- Un id présent dans `state.plannedRecipes` mais ne correspondant plus à aucune recette de `ALL_RECIPES` (recette supprimée entre-temps) est automatiquement ignoré par le `.filter()` — aucun code supplémentaire n'est nécessaire pour ce cas, c'est une propriété de l'approche "résoudre les ids au moment du clic" plutôt qu'une garde explicite à écrire.

- [ ] **Step 3: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v65";
```

par :

```js
const CACHE_NAME = "carnet-cache-v66";
```

- [ ] **Step 4: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v66`. Aucune erreur console au chargement.

Testable **sans session authentifiée**, en poursuivant sur l'injection de recettes de test de la Task 1 (le panier lui-même — `cart` exporté de `cart.js` — ne dépend pas non plus d'une session pour être manipulé en mémoire ; seule la synchronisation Supabase distante échouera silencieusement hors ligne, ce qui est déjà le comportement attendu et géré par `cart.js`) :

```js
const domMod = await import('/js/dom.js');
const gridMod = await import('/js/grid.js');
const storeMod = await import('/js/recipes-store.js');
const cartMod = await import('/js/cart.js');

storeMod.ALL_RECIPES.push(
  { id: 'batch1', title: 'Recette Batch 1', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[['Poireau','1 pièce(s)']], steps:[] },
  { id: 'batch2', title: 'Recette Batch 2', category:'plat', desc:'', time:10, servings:4, difficulty:'Facile', icon:'plat', ingredients:[['Poireau','1 pièce(s)']], steps:[] }
);
gridMod.render();

const cartBefore = cartMod.cart.length;

domMod.planBtn.click();
document.querySelector('.card-plan[data-planid="batch1"]').click();
document.querySelector('.card-plan[data-planid="batch2"]').click();
domMod.planAddBtn.click();

const cartAfter = cartMod.cart.map(e => ({ id: e.recipeId, servings: e.servings }));
const isPlanningAfter = domMod.state.isPlanning;
const selectionAfter = domMod.state.plannedRecipes.size;
const checkboxesAfter = document.querySelectorAll('.card-plan').length;
const planBarHiddenAfter = domMod.planBar.hidden;

console.log({ cartBefore, cartAfter, isPlanningAfter, selectionAfter, checkboxesAfter, planBarHiddenAfter });
```

Résultats attendus :
- `cartAfter` contient les deux entrées `{ id: 'batch1', servings: 2 }` et `{ id: 'batch2', servings: 4 }` (en plus de ce qui était déjà dans `cartBefore`, s'il y avait déjà un panier).
- `isPlanningAfter === false`, `selectionAfter === 0`, `checkboxesAfter === 0`, `planBarHiddenAfter === true` — le mode Planifier s'est bien refermé tout seul.
- Un toast "2 recettes ajoutées au panier" est apparu brièvement (vérifiable visuellement ou via `document.getElementById('toast').classList.contains('is-visible')` juste après le clic, avant qu'il ne disparaisse).

Ouvrir ensuite le panier (`domMod.panierView` ou cliquer sur le bouton panier réel) et vérifier visuellement que les deux recettes de test apparaissent, et que leurs ingrédients "Poireau" (identiques) se fusionnent bien dans "À acheter" en une seule ligne "Poireau — 2 pièce(s)" — confirme que l'ajout groupé réutilise correctement toute la logique de panier déjà en place (fusion, sections repliables) sans rien casser.

Aucune erreur console sur l'ensemble de ce parcours.

- [ ] **Step 5: Commit**

```bash
git add public/js/cart.js public/js/main.js public/sw.js
git commit -m "Ajouter l'ajout groupe au panier pour les recettes planifiees"
```
