# Bouton + : menu d'ajout mobile uniquement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the floating `+` button into a small mobile-only menu with 3 add options (manual/scan/import), and hide the button entirely on desktop where the drawer menu already covers the same actions.

**Architecture:** Pure static-site frontend change (no backend, no build step). New markup (`#fabMenu` + 3 buttons) sits next to the existing `#addFab` button in `public/index.html`. New CSS in `public/style.css` styles the menu (visually modeled on `.drawer-item`, but as its own `.fab-menu-item` class — reusing `.drawer-item` directly would pick up its unrelated `nth-child(2)`/`nth-child(3)` color-override rules, which are positionally coupled to the drawer's own list and would wrongly recolor the fab menu's icons) and hides `.fab`/`.fab-menu` above the existing 768px desktop breakpoint. New JS in `public/js/main.js` wires the 3 buttons to the already-existing `goToAddRecipe`/`goToScanRecipe`/`goToImportUrl` functions in `public/js/core/ui.js` (already imported, already used by the drawer's own add/scan/import buttons) and replaces the FAB's direct `openAddForm()` call with a show/hide toggle for the new menu, mirroring the existing `allergenFilterPanel` open/outside-click/Escape pattern already in `main.js`.

**Tech Stack:** Vanilla JS (ES modules), plain CSS, no framework, no bundler, no test runner (this project's UI has no automated test suite — verification is manual in the browser, same as the approved spec's own "Vérification" section).

## Global Constraints

- No new dependencies, no build step — plain HTML/CSS/JS only, matching the rest of the site.
- Reuse the existing `goToAddRecipe`, `goToScanRecipe`, `goToImportUrl` functions from `public/js/core/ui.js` as-is — do not duplicate their logic.
- Desktop breakpoint is `min-width: 768px`, matching the value already used elsewhere in `public/style.css` (line 437).
- Do not modify the drawer menu, `goToAddRecipe`/`goToScanRecipe`/`goToImportUrl`, or any of the add/scan/import views themselves.
- No automated tests exist for this project's UI layer; verify manually via the browser preview tool at both a mobile width (<768px) and a desktop width (≥768px).

---

### Task 1: Static markup and styling for the fab menu

**Files:**
- Modify: `public/index.html:167-169`
- Modify: `public/style.css:672` (insert new rules right after the existing `.fab:active{...}` rule)

**Interfaces:**
- Consumes: existing CSS custom properties `--surface`, `--line`, `--shadow-raised`, `--bg`, `--ink`, `--emerald-tint`, `--emerald-dark` (all already defined and used elsewhere in `public/style.css`).
- Produces (consumed by Task 2): DOM elements with ids `fabMenu` (wrapper, `hidden` attribute present by default), `fabMenuAddBtn`, `fabMenuScanBtn`, `fabMenuImportBtn` (the 3 rows, in that order). CSS classes `.fab-menu`, `.fab-menu-item`, `.fab-menu-item-icon` and a `@media (min-width: 768px)` rule that hides both `.fab` and `.fab-menu`.

- [ ] **Step 1: Add the fab menu markup to `public/index.html`**

Find this exact block (around line 167-169):

```html
<button id="addFab" class="fab" type="button" aria-label="Ajouter une recette">
  <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
</button>
```

Replace it with:

```html
<button id="addFab" class="fab" type="button" aria-label="Ajouter une recette">
  <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
</button>
<div id="fabMenu" class="fab-menu" hidden>
  <button class="fab-menu-item" id="fabMenuAddBtn" type="button">
    <span class="fab-menu-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
    Ajouter manuellement
  </button>
  <button class="fab-menu-item" id="fabMenuScanBtn" type="button">
    <span class="fab-menu-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 8.96 4h6.08a1 1 0 0 1 .86.5L16.8 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.8" fill="none"/></svg></span>
    Scanner une recette
  </button>
  <button class="fab-menu-item" id="fabMenuImportBtn" type="button">
    <span class="fab-menu-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg></span>
    Importer une URL
  </button>
</div>
```

(The 3 SVG icons are copied verbatim from the drawer's `#navAddBtn`, `#navScanBtn`, `#navImportUrlBtn` icons in the same file, for visual consistency.)

- [ ] **Step 2: Add the fab menu CSS to `public/style.css`**

Find this exact block (around line 662-672):

```css
.fab{
  position: fixed; right: 20px; bottom: 24px; z-index: 40;
  width: 56px; height:56px; border-radius:50%;
  background: var(--emerald);
  color:#fff; border: none;
  display:flex; align-items:center; justify-content:center;
  box-shadow: var(--shadow-raised);
  transition: transform .18s ease, background .18s ease;
}
.fab:hover{ transform: translateY(-2px); background: var(--emerald-dark); }
.fab:active{ transform: scale(.94); }
```

Insert this immediately after it:

```css

.fab-menu{
  position: fixed; right: 20px; bottom: 90px; z-index: 40;
  background: var(--surface); border:1px solid var(--line); border-radius:12px;
  box-shadow: var(--shadow-raised); padding:8px; width:220px;
  display:flex; flex-direction:column; gap:2px;
}
.fab-menu[hidden]{ display:none; }
.fab-menu-item{
  display:flex; align-items:center; gap:12px;
  border:none; background:transparent; color: var(--ink);
  padding: 10px 10px; border-radius:8px; font-size:.86rem; font-weight:600;
  text-align:left; transition: background .15s ease;
}
.fab-menu-item:hover{ background: var(--bg); }
.fab-menu-item-icon{
  flex:none; width:30px; height:30px; border-radius:8px;
  background: var(--emerald-tint); color: var(--emerald-dark);
  display:flex; align-items:center; justify-content:center;
}

@media (min-width: 768px){
  .fab, .fab-menu{ display:none; }
}
```

- [ ] **Step 3: Verify visually in the browser (no interactivity yet)**

Use the `preview_start` tool with the `static-serve` launch config, then `navigate` to the local URL.

- At a desktop viewport (`resize_window` preset `desktop`, or leave default ≥768px): the `+` button must be completely absent from the page (`read_page` or `find` for "Ajouter une recette" button should find nothing visible).
- At a mobile viewport (`resize_window` preset `mobile`, 375×812): the `+` button must be visible; the new menu must NOT be visible (it has the `hidden` attribute) — confirm via `read_page` that `#fabMenu` exists in the DOM but has no visible text/rows rendered.
- Check `read_console_messages` for errors on both viewports — expect none.

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/style.css
git commit -m "Ajouter le markup et le style du menu d'ajout mobile (bouton +)"
```

---

### Task 2: Wire up the fab menu interactivity

**Files:**
- Modify: `public/js/core/dom.js:12` (add new element references right after the existing `addFab` line)
- Modify: `public/js/main.js:7-18` (import block)
- Modify: `public/js/main.js:107` (replace the current FAB click handler)

**Interfaces:**
- Consumes: `#fabMenu`, `#fabMenuAddBtn`, `#fabMenuScanBtn`, `#fabMenuImportBtn` DOM ids from Task 1. Existing `goToAddRecipe`, `goToScanRecipe`, `goToImportUrl` from `public/js/core/ui.js` (already imported in `main.js:28`, unchanged). Existing `addFab` from `public/js/core/dom.js`.
- Produces: no new exports — this is the final wiring, nothing downstream depends on it.

- [ ] **Step 1: Export the new DOM references in `public/js/core/dom.js`**

Find this exact line (line 12):

```js
export const addFab = document.getElementById("addFab");
```

Replace it with:

```js
export const addFab = document.getElementById("addFab");
export const fabMenu = document.getElementById("fabMenu");
export const fabMenuAddBtn = document.getElementById("fabMenuAddBtn");
export const fabMenuScanBtn = document.getElementById("fabMenuScanBtn");
export const fabMenuImportBtn = document.getElementById("fabMenuImportBtn");
```

- [ ] **Step 2: Update the import block in `public/js/main.js`**

Find this exact block (lines 7-18):

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn, navMealPlanBtn, navSeasonBtn, navFridgeBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, mealPlanView, seasonView, fridgeView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, mealPlanCloseBtn, seasonCloseBtn, fridgeCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./core/dom.js";
import { render, renderAllergenFilterPanel } from "./recipes/grid.js";
import { closeDetail } from "./recipes/detail.js";
import { openAddForm, closeAddForm } from "./recipes/add-form.js";
```

Replace it with:

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, fabMenu, fabMenuAddBtn, fabMenuScanBtn, fabMenuImportBtn, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn, navMealPlanBtn, navSeasonBtn, navFridgeBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, mealPlanView, seasonView, fridgeView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, mealPlanCloseBtn, seasonCloseBtn, fridgeCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./core/dom.js";
import { render, renderAllergenFilterPanel } from "./recipes/grid.js";
import { closeDetail } from "./recipes/detail.js";
import { closeAddForm } from "./recipes/add-form.js";
```

(`openAddForm` is removed from this import — after Step 3 below, nothing in `main.js` calls it directly anymore; `goToAddRecipe` in `core/ui.js` already calls it internally.)

- [ ] **Step 3: Replace the FAB click handler in `public/js/main.js`**

Find this exact line (line 107):

```js
addFab.addEventListener("click", () => openAddForm());
```

Replace it with:

```js
addFab.addEventListener("click", (e) => {
  e.stopPropagation();
  fabMenu.hidden = !fabMenu.hidden;
});
document.addEventListener("click", (e) => {
  if (fabMenu.hidden) return;
  if (fabMenu.contains(e.target) || addFab.contains(e.target)) return;
  fabMenu.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !fabMenu.hidden) fabMenu.hidden = true;
});
fabMenuAddBtn.addEventListener("click", () => {
  fabMenu.hidden = true;
  goToAddRecipe();
});
fabMenuScanBtn.addEventListener("click", () => {
  fabMenu.hidden = true;
  goToScanRecipe();
});
fabMenuImportBtn.addEventListener("click", () => {
  fabMenu.hidden = true;
  goToImportUrl();
});
```

(`goToAddRecipe`, `goToScanRecipe`, `goToImportUrl` are already imported from `./core/ui.js` at `main.js:28` — no import change needed for these three.)

- [ ] **Step 4: Verify interactivity manually in the browser**

Use `preview_start` (`static-serve`) and `navigate`, at a mobile viewport (375×812):

- Click the `+` button → the 3-row menu appears above it.
- Click "Ajouter manuellement" → the manual add form view opens, the menu is gone (hidden).
- Reload, click `+` again, click "Scanner une recette" → the scan view opens, menu hidden.
- Reload, click `+` again, click "Importer une URL" → the import view opens, menu hidden.
- Reload, click `+` again, then click somewhere else on the page (e.g. the search box) → the menu closes without navigating anywhere.
- Reload, click `+` again, then press Escape → the menu closes without navigating anywhere.
- Check `read_console_messages` for errors throughout — expect none.

At a desktop viewport (≥768px): confirm the `+` button is still absent (from Task 1's CSS) and the drawer's own "Ajouter une recette" / "Scanner une recette" / "Importer depuis une URL" entries still work exactly as before (unchanged).

- [ ] **Step 5: Commit**

```bash
git add public/js/core/dom.js public/js/main.js
git commit -m "Basculer le bouton + en menu d'ajout (mobile) au lieu d'ouvrir directement le formulaire"
```

---

### Task 3: Bump the service worker cache and deploy

**Files:**
- Modify: `public/sw.js:3`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (deployment step only).

- [ ] **Step 1: Increment the cache version**

Run `grep -n "CACHE_NAME =" public/sw.js` to read the current value. As of this plan being written, line 3 reads:

```js
const CACHE_NAME = "carnet-cache-v89";
```

If it still reads `v89`, replace it with:

```js
const CACHE_NAME = "carnet-cache-v90";
```

If a later, unrelated change has already bumped it past `v89` by the time this task runs, use that value + 1 instead (the rule is always "current value + 1", never a fixed number) — the git history and the file's own current content are the source of truth, not this plan.

- [ ] **Step 2: Commit and push**

```bash
git add public/sw.js
git commit -m "Incrementer le cache du service worker (menu d'ajout mobile)"
git push origin master
```

- [ ] **Step 3: Verify the GitHub Pages deploy**

Run: `gh run list --limit 1`
Expected: the latest "Déployer sur GitHub Pages" run for this push shows `in_progress` then `completed`/`success` (poll with `gh run watch <run-id> --exit-status` if still in progress).
