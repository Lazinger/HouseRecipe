# "Cuisinable avec mon frigo" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an additive "Cuisinable" toggle chip to the main recipe grid that, when active, sorts recipes by how many ingredients are missing from the fridge and shows a badge per card — without hiding any recipe.

**Architecture:** Pure static-site frontend change (no backend, no build step). A new toggle chip in `public/index.html`'s existing `.chip-row`, styled distinctly from the mutually-exclusive category chips it sits next to. `public/js/recipes/grid.js` gains a small helper that reuses the already-existing `checkFridgeAvailability` (from `public/js/recipes/quantity.js`) to count `"manque"` ingredients per recipe against `fridgeItems` (from `public/js/planning/fridge.js`), then sorts the already-filtered recipe list by that count and renders a badge per card when the toggle is active. `public/js/main.js` wires the chip's click to a new boolean in the shared `state` object and re-renders.

**Tech Stack:** Vanilla JS (ES modules), plain CSS, no framework, no bundler, no test runner (this project's UI has no automated test suite — verification is manual in the browser, per the approved spec's own "Vérification" section).

## Global Constraints

- No new dependencies, no build step — plain HTML/CSS/JS only.
- Reuse `checkFridgeAvailability` from `public/js/recipes/quantity.js` and `fridgeItems` from `public/js/planning/fridge.js` as-is — do not modify either.
- The toggle never removes a recipe from the grid — it only reorders and adds a badge. No requirement in this plan should ever filter/hide a recipe based on fridge stock.
- `"a-verifier"`-status ingredients (from `checkFridgeAvailability`) do NOT count toward the missing count — only `"manque"` does.
- The toggle state (`state.fridgeReadyToggle`) is NOT persisted to `localStorage` — it resets to `false` on every page load, matching `state.filter`'s behavior (unlike `state.excludedAllergens`, which IS persisted).
- No automated tests exist for this project's UI layer; verify manually via the browser preview tool.

---

### Task 1: State, DOM wiring, markup, and styling

**Files:**
- Modify: `public/js/core/dom.js:8` (the `chips` selector) and its `state` object
- Modify: `public/index.html:71-80` (the `.chip-row`)
- Modify: `public/style.css` (near the existing `.chip`/`.chip-fav` rules, and near `.card-fav`)

**Interfaces:**
- Consumes: nothing new.
- Produces (consumed by Task 2): `state.fridgeReadyToggle` (boolean, default `false`) on the shared `state` object exported from `public/js/core/dom.js`; a new exported DOM reference `fridgeReadyChip` (the chip `<button>`); CSS classes `.chip-fridge` (base) and `.card-fridge-badge` / `.card-fridge-badge.is-ok` (badge, default = "manque" terracotta styling, `.is-ok` = emerald "fully covered" styling).

- [ ] **Step 1: Narrow the `chips` NodeList to exclude the new toggle**

The existing `chips` export currently selects every `.chip` element and is used by `public/js/main.js` and `public/js/core/ui.js` to implement **mutually-exclusive** category/favorites selection (`chips.forEach(c => c.classList.remove("is-active"))` then activate exactly one). The new "Cuisinable" chip must NOT participate in that exclusive-selection behavior — it's an independent on/off toggle. All 5 existing chips (`Tout`, `Entrées`, `Plats`, `Desserts`, `Mes favoris`) already carry a `data-filter` attribute; the new chip will not. Narrowing the selector to `.chip[data-filter]` excludes the new chip from that logic with no change in behavior for the 5 existing ones.

Find this exact line in `public/js/core/dom.js` (line 8):

```js
export const chips = document.querySelectorAll(".chip");
```

Replace it with:

```js
export const chips = document.querySelectorAll(".chip[data-filter]");
```

- [ ] **Step 2: Add the new DOM reference and state field in `public/js/core/dom.js`**

Find this exact line (currently line 72, right after `seasonalFilterChip`):

```js
export const seasonalFilterChip = document.getElementById("seasonalFilterChip");
```

Replace it with:

```js
export const seasonalFilterChip = document.getElementById("seasonalFilterChip");
export const fridgeReadyChip = document.getElementById("fridgeReadyChip");
```

Then find this exact block (the `state` object, currently lines 75-81):

```js
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]")),
  excludedAllergens: new Set(JSON.parse(localStorage.getItem("carnet-allergenes-exclus") || "[]")),
  seasonalFilter: null
};
```

Replace it with:

```js
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]")),
  excludedAllergens: new Set(JSON.parse(localStorage.getItem("carnet-allergenes-exclus") || "[]")),
  seasonalFilter: null,
  fridgeReadyToggle: false
};
```

- [ ] **Step 3: Add the chip markup in `public/index.html`**

Find this exact block (lines 71-80):

```html
  <nav class="chip-row" aria-label="Filtrer par catégorie">
    <button class="chip is-active" data-filter="tout" type="button">Tout</button>
    <button class="chip" data-filter="entrée" type="button">Entrées</button>
    <button class="chip" data-filter="plat" type="button">Plats</button>
    <button class="chip" data-filter="dessert" type="button">Desserts</button>
    <button class="chip chip-fav" data-filter="favoris" type="button">
      <svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="currentColor"/></svg>
      Mes favoris
    </button>
  </nav>
```

Replace it with:

```html
  <nav class="chip-row" aria-label="Filtrer par catégorie">
    <button class="chip is-active" data-filter="tout" type="button">Tout</button>
    <button class="chip" data-filter="entrée" type="button">Entrées</button>
    <button class="chip" data-filter="plat" type="button">Plats</button>
    <button class="chip" data-filter="dessert" type="button">Desserts</button>
    <button class="chip chip-fav" data-filter="favoris" type="button">
      <svg viewBox="0 0 24 24" width="13" height="13"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="currentColor"/></svg>
      Mes favoris
    </button>
    <button class="chip chip-fridge" id="fridgeReadyChip" type="button" aria-pressed="false">
      <svg viewBox="0 0 24 24" width="13" height="13"><path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/><path d="M5 9h14" stroke="currentColor" stroke-width="1.8"/></svg>
      Cuisinable
    </button>
  </nav>
```

(The fridge icon is copied verbatim from the existing `#navFridgeBtn` drawer icon in the same file, for visual consistency.)

- [ ] **Step 4: Add the chip and badge CSS in `public/style.css`**

Find this exact line (around line 280):

```css
.chip-fav.is-active{ background: var(--emerald); color: #fff; border-color: var(--emerald); }
```

Insert this immediately after it:

```css
.chip-fridge.is-active{ background: var(--emerald); color: #fff; border-color: var(--emerald); }
```

Find this exact block (around lines 384-392):

```css
.card-fav{
  position:absolute; bottom:10px; right:10px; z-index:1;
  background: rgba(255,255,255,.92); border:none; color: var(--ink-faint); padding:8px;
  display:flex; border-radius: 999px;
  box-shadow: var(--shadow-raised);
  transition: color .15s ease;
}
.card-fav[aria-pressed="true"]{ color: var(--terracotta-dark); }
.card-fav svg{ width:16px; height:16px; }
```

Insert this immediately after it:

```css

.card-fridge-badge{
  position:absolute; top:10px; left:10px; z-index:1;
  padding: 4px 9px; border-radius: 999px;
  font-size:.68rem; font-weight:700;
  background: var(--terracotta-tint); color: var(--terracotta-dark);
}
.card-fridge-badge.is-ok{ background: var(--emerald-tint); color: var(--emerald-dark); }
```

- [ ] **Step 5: Verify visually in the browser (no interactivity yet)**

Use `preview_start` (`static-serve` launch config) or, if working in a worktree, start your own `npx serve public -l <port>` from the worktree directory instead (the named `static-serve` config is known to sometimes serve the wrong directory from inside a worktree — confirm with `curl -s http://localhost:<port>/index.html | grep fridgeReadyChip` before trusting the browser).

- The app shows a login screen (auth-locked) — for verification purposes only, run `document.body.classList.remove('auth-locked')` and, if a login overlay still blocks the view, `document.getElementById('authView').style.display = 'none'` via the browser JS tool. This is purely to inspect static markup/CSS, not a real auth bypass.
- Confirm the new "Cuisinable" chip renders in the chip row, styled like the other chips but not visually "active" by default (`aria-pressed="false"`, no `is-active` class).
- Confirm clicking the 4 pre-existing category/favorites chips still works exactly as before (this checks Step 1's selector narrowing didn't break anything) — clicking "Entrées" still shows only entrée recipes, clicking it doesn't touch "Cuisinable"'s state, and vice versa.
- Check `read_console_messages` for errors — expect none.
- **Before re-testing after this step, always clear the service worker cache** (`navigator.serviceWorker.getRegistrations()` → unregister each, then `caches.keys()` → delete each) — this project's service worker caches JS/CSS aggressively and can silently serve stale code otherwise, then hard-navigate again.

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/style.css public/js/core/dom.js
git commit -m "Ajouter le markup, le style et l'etat du toggle Cuisinable"
```

---

### Task 2: Fridge-availability computation, sort, badge rendering, and click wiring

**Files:**
- Modify: `public/js/recipes/grid.js` (imports, new helper function, `renderGrid()`)
- Modify: `public/js/main.js` (imports, new click listener)

**Interfaces:**
- Consumes: `state.fridgeReadyToggle`, `fridgeReadyChip` from `public/js/core/dom.js` (Task 1). `checkFridgeAvailability(ingredients, fridgeItems)` from `public/js/recipes/quantity.js` — existing signature, returns `[{name, qty, status: "ok"|"manque"|"a-verifier", missing?}]`. `fridgeItems` (array of `[name, qty]` pairs) from `public/js/planning/fridge.js` — existing export.
- Produces: no new exports — this is the final wiring for this feature.

- [ ] **Step 1: Add the fridge-availability imports and helper to `public/js/recipes/grid.js`**

Find this exact line (line 1-8, the import block):

```js
import { CATEGORY_LABELS, ALLERGENS } from "../data/recipes-data.js";
import { ICONS } from "../core/icons.js";
import { escapeHtml } from "../core/utils.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList, seasonalFilterChip } from "../core/dom.js";
import { produceMatchesRecipe } from "../data/season-data.js";
import { ALL_RECIPES, toggleFavorite } from "./recipes-store.js";
import { applyCardPhoto } from "../photos/photos.js";
import { openDetail } from "./detail.js";
```

Replace it with:

```js
import { CATEGORY_LABELS, ALLERGENS } from "../data/recipes-data.js";
import { ICONS } from "../core/icons.js";
import { escapeHtml } from "../core/utils.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList, seasonalFilterChip } from "../core/dom.js";
import { produceMatchesRecipe } from "../data/season-data.js";
import { ALL_RECIPES, toggleFavorite } from "./recipes-store.js";
import { applyCardPhoto } from "../photos/photos.js";
import { openDetail } from "./detail.js";
import { checkFridgeAvailability } from "./quantity.js";
import { fridgeItems } from "../planning/fridge.js";
```

(This introduces a circular import at the module-graph level: `grid.js` → `fridge.js` → `core/ui.js` → `grid.js`. This is not new to the codebase — `grid.js` already reaches `fridge.js` indirectly via `detail.js`, and the app already runs correctly today with that cycle. It works because the only thing consumed across the cycle (`render`, `fridgeItems`) is either a hoisted function declaration or a value only read inside a function body — never read at module top-level — so it's resolved by the time anything actually calls it. Step 4's console check re-confirms no "Cannot access before initialization" error appears.)

Now find this exact block (the `renderSeasonalFilterChip` function, so the new helper goes right after it and before `updateAllergenFilterBadge`):

```js
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

Insert this immediately after it:

```js

/* ---- disponibilite au frigo : nombre d'ingredients "manque" par recette
   (les "a-verifier" ne comptent pas — meme regle que "Verifier mon frigo"
   sur la fiche recette, on ne penalise jamais un cas ambigu). Calcule une
   seule fois par recette, reutilise a la fois pour le tri et le badge. ---- */
function computeFridgeMissingCounts(list){
  const counts = new Map();
  list.forEach(r => {
    const missing = checkFridgeAvailability(r.ingredients, fridgeItems)
      .filter(item => item.status === "manque").length;
    counts.set(r.id, missing);
  });
  return counts;
}
```

- [ ] **Step 2: Sort by fridge availability and render the badge in `renderGrid()`**

Find this exact block (the start of `renderGrid()`, roughly lines 100-110):

```js
/* ---- rendu de la grille ---- */
function renderGrid(){
  const list = getFilteredRecipes();
  heroSlot.hidden = state.query.trim() !== "";
  resultTitle.textContent = CATEGORY_LABELS[state.filter] || "Recettes";
  resultCount.textContent = list.length + (list.length > 1 ? " recettes" : " recette");
  renderSeasonalFilterChip();

  grid.innerHTML = "";
  emptyState.hidden = list.length !== 0;
```

Replace it with:

```js
/* ---- rendu de la grille ---- */
function renderGrid(){
  const list = getFilteredRecipes();
  heroSlot.hidden = state.query.trim() !== "";
  resultTitle.textContent = CATEGORY_LABELS[state.filter] || "Recettes";
  resultCount.textContent = list.length + (list.length > 1 ? " recettes" : " recette");
  renderSeasonalFilterChip();

  const fridgeMissingCounts = state.fridgeReadyToggle ? computeFridgeMissingCounts(list) : null;
  if (fridgeMissingCounts) {
    list.sort((a, b) => fridgeMissingCounts.get(a.id) - fridgeMissingCounts.get(b.id));
  }

  grid.innerHTML = "";
  emptyState.hidden = list.length !== 0;
```

(`list` is a fresh array returned by `getFilteredRecipes()`'s `.filter()` call every time, so sorting it in place here never mutates `ALL_RECIPES`. `Array.prototype.sort` is a stable sort per spec, so recipes tied on missing-count keep their relative order — matching the "à égalité, ordre naturel conservé" requirement.)

Now find this exact block (inside the `list.forEach(r => {...})` loop, the card's `innerHTML`, roughly lines 117-134):

```js
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
        <h3 class="card-title">${escapeHtml(r.title)}</h3>
        <p class="card-desc">${escapeHtml(r.desc)}</p>
        <div class="card-meta">
          <span>⏱ ${r.time} min</span>
          <span>${r.servings} pers.</span>
          <span>${r.difficulty}</span>
        </div>
      </div>
    `;
```

Replace it with:

```js
    const isFav = state.favorites.has(r.id);
    const missing = fridgeMissingCounts?.get(r.id);
    const fridgeBadgeHtml = missing === undefined ? "" : missing === 0
      ? `<span class="card-fridge-badge is-ok">Tout y est</span>`
      : `<span class="card-fridge-badge">${missing} manquant${missing > 1 ? "s" : ""}</span>`;
    card.innerHTML = `
      <div class="card-photo">
        <span class="card-icon">${ICONS[r.icon]}</span>
        ${fridgeBadgeHtml}
        <button class="card-fav" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris" data-favid="${r.id}">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="card-body">
        <span class="card-cat">${r.category}</span>
        <h3 class="card-title">${escapeHtml(r.title)}</h3>
        <p class="card-desc">${escapeHtml(r.desc)}</p>
        <div class="card-meta">
          <span>⏱ ${r.time} min</span>
          <span>${r.servings} pers.</span>
          <span>${r.difficulty}</span>
        </div>
      </div>
    `;
```

- [ ] **Step 3: Wire the chip's click in `public/js/main.js`**

Find this exact line in the import block (currently line 8):

```js
  state, searchInput, chips, favToggleHeader, addFab, fabMenu, fabMenuAddBtn, fabMenuScanBtn, fabMenuImportBtn, cartToggle,
```

Replace it with:

```js
  state, searchInput, chips, favToggleHeader, addFab, fabMenu, fabMenuAddBtn, fabMenuScanBtn, fabMenuImportBtn, cartToggle, fridgeReadyChip,
```

Find this exact block (currently lines 84-91, right before `renderAllergenFilterPanel();`):

```js
chips.forEach(chip => {
  chip.addEventListener("click", () => {
    chips.forEach(c => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.filter = chip.dataset.filter;
    render();
  });
});
```

Insert this immediately after it (before the blank line that precedes `renderAllergenFilterPanel();`):

```js
fridgeReadyChip.addEventListener("click", () => {
  state.fridgeReadyToggle = !state.fridgeReadyToggle;
  fridgeReadyChip.classList.toggle("is-active", state.fridgeReadyToggle);
  fridgeReadyChip.setAttribute("aria-pressed", String(state.fridgeReadyToggle));
  render();
});
```

- [ ] **Step 4: Verify interactivity manually in the browser**

Start a static server from the correct directory (see Task 1 Step 5's caveat about `preview_start` inside a worktree), navigate, and — **before testing** — clear any previously-registered service worker/caches for that origin (same steps as Task 1 Step 5), then hard-navigate again. Reveal the app past the login overlay the same way as Task 1 Step 5.

For a recipe to exercise the "0 manquant" path, add at least one ingredient from an existing recipe to the fridge first (open the drawer → "Mon Frigo" → add an ingredient name exactly matching one used by a recipe, with enough quantity — or, for a quick check with no real data, it's fine if every recipe shows as fully or partially missing; the important checks are about ordering and console errors, not specific recipe content).

- Click "Cuisinable" → the chip becomes visually active (`aria-pressed="true"`), and every card gets a badge ("Tout y est" in green, or "N manquant(s)" in orange).
- Confirm the cards are now ordered with the lowest missing-count first.
- Confirm no recipe disappeared from the grid compared to before clicking (same count in `#resultCount` as before toggling — the spec requires nothing is ever hidden by this toggle).
- Click a category chip (e.g. "Desserts") while "Cuisinable" is still active → only dessert recipes show, still sorted/badged by missing-count. Click "Tout" again → the fridge sort/badges are still applied to the full list.
- Click "Cuisinable" again to deactivate → badges disappear, chip is no longer visually active, grid order returns to normal (no badges, no forced sort).
- Check `read_console_messages` for errors throughout (in particular, confirm no "Cannot access 'X' before initialization" from the circular import noted in Step 1) — expect none.

- [ ] **Step 5: Commit**

```bash
git add public/js/recipes/grid.js public/js/main.js
git commit -m "Trier et badger les recettes selon la disponibilite au frigo (toggle Cuisinable)"
```

---

### Task 3: Bump the service worker cache and deploy

**Files:**
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (deployment step only).

- [ ] **Step 1: Increment the cache version**

Run `grep -n "CACHE_NAME =" public/sw.js` to read the current value. Replace it with current-value + 1 (e.g. if it reads `carnet-cache-v90`, change it to `carnet-cache-v91`) — always "current value + 1", never a value copied from an earlier session; the file's own current content is the source of truth.

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "Incrementer le cache du service worker (toggle Cuisinable)"
```

**If working in an isolated worktree/branch:** stop here — do not push. Pushing and verifying the GitHub Pages deploy happens only after this branch is reviewed and merged (via `superpowers:finishing-a-development-branch`), same as the previous feature built in this repo. **If working directly on `master`:** push and verify:

```bash
git push origin master
gh run list --limit 1
```

Then `gh run watch <run-id> --exit-status` if the run is still in progress, and confirm it completes with `success`.
