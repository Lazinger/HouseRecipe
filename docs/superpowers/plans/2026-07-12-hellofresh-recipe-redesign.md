# Refonte fiche recette + formulaire façon HelloFresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the recipe detail page and the add/edit recipe form to match HelloFresh's real recipe-page structure and palette (green/cream/Poppins), and extend the recipe data model with optional nutrition/allergens/utensils fields plus per-step photos — scoped to these two views only (see spec, site-wide rollout is a separate future project).

**Architecture:** Pure CSS/JS changes to a dependency-free static site (`index.html`/`style.css`/`script.js`, no build step, no framework). New visual tokens are scoped via a `.hf-theme` class applied only to `#detailView` and `#addView`, so the rest of the site (home, grid, header) keeps its current "carnet lumineux épuré" look untouched. New recipe fields are optional and additive to the existing plain-object recipe model; per-step photos reuse the existing IndexedDB photo store with composite keys, no schema migration needed.

**Tech Stack:** Vanilla HTML/CSS/JS, `localStorage` (recipe/favorites/cart data), IndexedDB (photos), no test framework/build step.

## Global Constraints

- **No build step, no dependencies** — everything must run by opening `index.html` via a static file server (`npx serve .` or the project's existing dev preview). Never introduce npm packages, bundlers, or a CDN font dependency in the shipped app.
- **100% offline-capable (PWA)** — every new asset (fonts) must be self-hosted under `fonts/` as `.woff2`, exactly like the existing Fraunces/DM Sans/Caveat setup. No `@import url(fonts.googleapis.com/...)` in the shipped CSS.
- **No automated test runner exists in this project.** "Tests" in this plan are concrete, scripted browser verifications (exact clicks/inputs and exact expected DOM/visual state) run through the Browser pane tools — this mirrors how the project has been verified throughout its history (see project memory: UI changes are verified by driving the real app in a browser, not by reading code).
- **Never break existing recipes.** All new fields (`nutrition`, `allergens`, `utensils`, per-step photos) are optional; the 8 built-in `RECIPES` entries have none of them and must keep rendering exactly as before (no empty sections, no `undefined` text).
- **Built-in `RECIPES` are read-only** — never editable/deletable in the UI (existing rule, unaffected by this plan).
- **Photos never go in `localStorage`/export JSON** — they stay in IndexedDB only (existing rule, extended to per-step photos).
- French UI strings throughout (existing convention).
- Every task edits `script.js`/`style.css` with **find-this-exact-snippet / replace-with-this-snippet** instructions rather than relying on absolute line numbers (which shift as earlier tasks land) — line numbers given are locator hints only, valid *at planning time*.

---

## File Structure

- **`fonts/`** — 4 new files: `poppins-regular.woff2` (400), `poppins-semibold.woff2` (600), `poppins-bold.woff2` (700), `poppins-extrabold.woff2` (800).
- **`style.css`** — modified in place (no new file; project deliberately has a single stylesheet, see existing spec docs):
  - New `@font-face` block for Poppins (4 rules), near the existing font-face rules at the top.
  - New `.hf-theme{...}` token-override block + `.hf-theme .detail-heading h2{font-style:normal}` override, placed right after the existing `:root{...}` token block.
  - `.detail-hero` becomes a full-bleed photo/gradient banner with a dark overlay and white heading text (was: sticky translucent bar with no image). Old `.detail-photo`/`.detail-photo img` rules removed (that block no longer exists in the markup). New `.detail-info`/`.stats-flat` rules replace `.detail-stats`/`.stat`/`.stat-stepper`.
  - Rewritten `.ingredient-list` rules → 2-column grid + icon.
  - New `.allergen-line`, `.tool-line`, `.stats-flat .cell.is-nutri` rules.
  - Rewritten `.step-list` rules (drops the CSS-counter `::before` numbering in favor of explicit `.step-num` spans, to make room for `.step-photo` thumbnails).
  - New `.dyn-row .step-photo-input` rule (small file input inside step rows).
- **`script.js`** — modified in place (no new file; same single-file convention as `style.css`):
  - `openDetail()` — apply `.hf-theme`, restructure the hero into a photo/gradient banner, new stats-flat markup (relocated out of the hero into a new `.detail-info` block), allergens/utensils lines, restructured step list with photo lookups.
  - `applyDetailPhoto()` — repurposed to set the hero's background image instead of filling a separate `<div class="detail-photo">`.
  - `renderAddForm()` — reordered fields, 3 new optional fields, per-step photo input, submit handler changes.
  - `createStepRow()` — add the photo file input.
  - New: `createUstensileRow()` (mirrors `createStepRow`).
  - New: `stepPhotoKey()`, `saveStepPhoto()`, `getStepPhoto()`, `deleteAllPhotosForRecipe()`.
  - `deleteRecipe()` — use `deleteAllPhotosForRecipe()` instead of `deletePhoto()`.
- **`index.html`** — one-line change: add `hf-theme` to `#addView`'s static class list (`#detailView`'s class is fully overwritten by JS on every render, so its `hf-theme` class is added in `script.js` instead — see Task 1).

---

### Task 1: Self-host Poppins & define the HelloFresh-theme scoped tokens

**Files:**
- Create: `fonts/poppins-regular.woff2`, `fonts/poppins-semibold.woff2`, `fonts/poppins-bold.woff2`, `fonts/poppins-extrabold.woff2`
- Modify: `style.css:1-51` (font-face block + `:root` token block), `index.html:92`, `script.js:802`

**Interfaces:**
- Produces: CSS class `.hf-theme` and the token overrides it carries (`--bg`, `--surface`, `--ink`, `--ink-soft`, `--ink-faint`, `--line`, `--emerald`, `--emerald-dark`, `--emerald-tint`, `--font-display`, `--font-body`) — every later task's new CSS must live inside `.hf-theme ...` selectors or reuse `var(--emerald)`/etc. so it inherits automatically.

- [ ] **Step 1: Download the 4 Poppins weights**

These exact URLs were verified during planning (Google Fonts `v24`, latin subset, real `.woff2` format — confirmed by downloading and checking the file signature):

```bash
cd "C:\Users\Jeremy\Documents\App_Projects\HouseRecipe\fonts"
curl -sL -o poppins-regular.woff2 "https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrJJfecg.woff2"
curl -sL -o poppins-semibold.woff2 "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6Z1xlFQ.woff2"
curl -sL -o poppins-bold.woff2 "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2"
curl -sL -o poppins-extrabold.woff2 "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLDD4Z1xlFQ.woff2"
```

Expected: 4 files created, each 7-8 KB.

- [ ] **Step 2: Verify the downloaded files are valid woff2**

```bash
cd "C:\Users\Jeremy\Documents\App_Projects\HouseRecipe\fonts"
for f in poppins-regular.woff2 poppins-semibold.woff2 poppins-bold.woff2 poppins-extrabold.woff2; do head -c4 "$f" | grep -q "wOF2" && echo "$f OK" || echo "$f INVALID"; done
```

Expected: all 4 lines print `OK`.

- [ ] **Step 3: Add the Poppins `@font-face` rules**

In `style.css`, immediately after the existing 4 `@font-face` rules (after line 20, before the `LE CARNET — design tokens` comment on line 22), insert:

```css
@font-face{
  font-family: 'Poppins'; font-style: normal; font-weight: 400;
  font-display: swap; src: url('fonts/poppins-regular.woff2') format('woff2');
}
@font-face{
  font-family: 'Poppins'; font-style: normal; font-weight: 600;
  font-display: swap; src: url('fonts/poppins-semibold.woff2') format('woff2');
}
@font-face{
  font-family: 'Poppins'; font-style: normal; font-weight: 700;
  font-display: swap; src: url('fonts/poppins-bold.woff2') format('woff2');
}
@font-face{
  font-family: 'Poppins'; font-style: normal; font-weight: 800;
  font-display: swap; src: url('fonts/poppins-extrabold.woff2') format('woff2');
}
```

- [ ] **Step 4: Define the `.hf-theme` scoped token overrides**

In `style.css`, immediately after the `:root{...}` block closes (after line 51, before the `.cat-entrée` rule on line 54), insert:

```css
/* =========================================================
   THEME HELLOFRESH — appliqué uniquement à la fiche recette
   (#detailView) et au formulaire d'ajout (#addView) via .hf-theme.
   Redéfinit les tokens existants localement : tout le CSS qui
   utilise déjà var(--emerald)/var(--bg)/var(--ink)/etc. en hérite
   automatiquement dans ce sous-arbre, sans dupliquer les règles.
   ========================================================= */
.hf-theme{
  --bg: #FFFBF5;
  --surface: #FFFFFF;
  --ink: #1F1B16;
  --ink-soft: #6B6459;
  --ink-faint: #A39C8E;
  --line: #EDE6D9;

  --emerald: #5C9A1B;
  --emerald-dark: #46780F;
  --emerald-tint: #EAF3DC;

  --font-display: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-body: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
}
/* Fraunces italic n'existe pas en Poppins — annule l'italique forcé du titre */
.hf-theme .detail-heading h2{ font-style: normal; font-weight: 800; }
```

- [ ] **Step 5: Apply `.hf-theme` to the add-recipe view (static HTML)**

In `index.html:92`, change:

```html
<section id="addView" class="detail-view add-view" aria-hidden="true">
```

to:

```html
<section id="addView" class="detail-view add-view hf-theme" aria-hidden="true">
```

- [ ] **Step 6: Apply `.hf-theme` to the recipe detail view (JS-driven class)**

`#detailView`'s class attribute is fully overwritten on every render by `openDetail()`, so it can't be set once in HTML. In `script.js:802`, change:

```js
  detailView.className = `detail-view cat-${r.category}`;
```

to:

```js
  detailView.className = `detail-view hf-theme cat-${r.category}`;
```

- [ ] **Step 7: Verify in the browser**

Start the dev server (`preview_start` with the project's existing launch config, or `npx serve .`), then:
1. Navigate to the home page, open any recipe (e.g. "Quiche lorraine").
2. Screenshot the detail page. Expected: cream background, green accents (favorite icon border, add-to-cart button, step-number circles), title in bold upright Poppins (not italic serif) — layout otherwise unchanged at this point (hero restructuring is Task 2).
3. Click the "+" FAB to open the add-recipe form. Expected: same cream/green/Poppins look on the form's inputs and buttons.
4. Navigate back to the home page. Expected: home page still shows the original near-white/emerald/Fraunces "carnet lumineux épuré" look, completely unaffected — confirms the theme is properly scoped.
5. Check the browser console for errors: none expected.

- [ ] **Step 8: Commit**

```bash
git add fonts/poppins-regular.woff2 fonts/poppins-semibold.woff2 fonts/poppins-bold.woff2 fonts/poppins-extrabold.woff2 style.css index.html script.js
git commit -m "Add HelloFresh-style theme scoped to recipe detail + add-recipe views

Self-hosts Poppins (4 weights) and defines a .hf-theme token override
block applied only to #detailView/#addView, so the rest of the site
keeps its current carnet lumineux épuré look untouched."
```

---

### Task 2: Full-bleed hero photo banner + flat stats bar

The approved mockup (V5) shows the recipe photo as a full-width banner behind the title, with a dark gradient for legibility — the current app instead shows a small rounded photo *below* the title. This task restructures the hero to match, and moves the time/servings/difficulty stats out of the hero into a flat bar right underneath it (also matching the mockup, where the stats sit on the plain background, not on the photo).

**Files:**
- Modify: `style.css:332-362` (`.detail-hero`/`.detail-topbar`/`.detail-heading`/`.detail-eyebrow`/`.detail-heading h2`/`.detail-sub`), `style.css:364-379` (`.detail-stats`/`.stat`/`.stat-stepper`/`.step-btn`), `style.css:424-425` (`.detail-photo` — deleted), `script.js:796-873` (`openDetail()` template), `script.js:256-262` (`applyDetailPhoto`)

**Interfaces:**
- Produces: `.detail-info` wrapper containing `#statsFlat` (`.stats-flat` with `.cell`/`.cell .l`/`.cell .v` structure) — Task 6 appends 2 more `.cell` elements to this same container when nutrition data is present, and inserts allergens/utensils lines as siblings after it inside `.detail-info`.
- Consumes: `.hf-theme` tokens from Task 1 (`--line`, `--ink`, `--emerald-dark`), existing `--accent`/`--accent-tint` (set per `.cat-xxx` class, already present on `#detailView`) for the no-photo gradient fallback.

- [ ] **Step 1: Turn `.detail-hero` into a photo/gradient banner with white overlaid text**

In `style.css`, replace lines 332-337:

```css
.detail-hero{
  position: sticky; top:0; z-index:2;
  background: rgba(251,250,246,.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line);
  padding: 20px 20px 26px;
}
```

with:

```css
.detail-hero{
  position: sticky; top:0; z-index:2;
  min-height: 220px;
  background: linear-gradient(135deg, var(--accent-tint), var(--accent) 130%);
  background-size: cover; background-position: center;
  padding: 20px 20px 24px;
  display:flex; flex-direction:column; justify-content:space-between;
}
.hf-theme .detail-hero::after{
  content:""; position:absolute; inset:0; z-index:0;
  background: linear-gradient(180deg, rgba(0,0,0,.05) 35%, rgba(0,0,0,.62));
  pointer-events:none;
}
```

(the fallback gradient uses `--accent`/`--accent-tint`, which are already defined per category via the existing `.cat-plat`/`.cat-dessert`/`.cat-entrée` rules on `#detailView` — no new category-color work needed. The `::after` dark overlay is scoped to `.hf-theme` only, since the non-`.hf-theme` version of `.detail-hero` doesn't exist anymore outside this view.)

- [ ] **Step 2: Keep topbar/heading above the dark overlay, recolor heading text to white**

In `style.css`, replace lines 359-362:

```css
.detail-heading{ max-width:760px; margin:0 auto; }
.detail-eyebrow{ font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; font-weight:700; color: var(--accent-dark); }
.detail-heading h2{ font-family: var(--font-display); font-style: italic; color: var(--ink); font-size: clamp(1.8rem,4vw,2.5rem); margin-top:8px; font-weight:600; }
.detail-sub{ color: var(--ink-soft); font-size:.9rem; margin-top:10px; max-width:60ch; }
```

with:

```css
.detail-topbar, .detail-heading{ position:relative; z-index:1; }
.detail-heading{ max-width:760px; margin:0 auto; }
.detail-eyebrow{ font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; font-weight:700; color: var(--accent-dark); }
.detail-heading h2{ font-family: var(--font-display); font-style: italic; color: var(--ink); font-size: clamp(1.8rem,4vw,2.5rem); margin-top:8px; font-weight:600; }
.detail-sub{ color: var(--ink-soft); font-size:.9rem; margin-top:10px; max-width:60ch; }
.hf-theme .detail-eyebrow{ color:#fff; opacity:.9; }
.hf-theme .detail-heading h2{ color:#fff; }
.hf-theme .detail-sub{ color: rgba(255,255,255,.9); }
```

(the base `.detail-eyebrow`/`.detail-heading h2`/`.detail-sub` rules stay as they were for the un-themed use on... actually this view only exists themed, but leaving the base rule untouched and adding `.hf-theme` overrides after it is the same low-risk pattern used everywhere else in this plan, and keeps the diff minimal and easy to review.)

Note: Task 1's Step 4 already added `.hf-theme .detail-heading h2{ font-style: normal; font-weight: 800; }` — that rule and this task's `.hf-theme .detail-heading h2{ color:#fff; }` both target the same selector but set different properties, so both apply (no conflict).

- [ ] **Step 3: Delete the now-unused `.detail-photo` rules**

In `style.css`, delete lines 424-425:

```css
.detail-photo{ max-width:760px; margin: 0 auto; padding: 20px 20px 0; }
.detail-photo img{ width:100%; max-height:320px; object-fit:cover; border-radius:6px; display:block; }
```

- [ ] **Step 4: Add `.detail-info`/`.stats-flat` rules**

In `style.css`, in place of the just-deleted `.detail-photo` rules (same location, right before `.detail-body{...}`), insert:

```css
.detail-info{ max-width:760px; margin:0 auto; padding:16px 20px 0; }

.stats-flat{ display:flex; border-top:1px solid var(--line); border-bottom:1px solid var(--line); flex-wrap:wrap; }
.stats-flat .cell{ flex:1; min-width:76px; text-align:center; padding:12px 8px; border-right:1px solid var(--line); }
.stats-flat .cell:last-child{ border-right:none; }
.stats-flat .cell .v{ font-weight:700; font-size:.9rem; color: var(--ink); display:flex; align-items:center; justify-content:center; gap:8px; }
.stats-flat .cell .l{ display:block; font-size:.62rem; text-transform:uppercase; letter-spacing:.05em; color: var(--emerald-dark); opacity:.8; margin-bottom:3px; }

.stat-stepper{ display:flex; align-items:center; justify-content:center; gap:8px; }
.stat-stepper .v{ min-width:14px; text-align:center; }
```

- [ ] **Step 5: Replace the old boxed `.stat`/`.detail-stats`/`.stat-stepper` rules**

In `style.css`, delete lines 364-370 entirely (they're fully superseded by Step 4's `.stats-flat` rules):

```css
.detail-stats{ display:flex; gap:10px; margin-top:18px; flex-wrap:wrap; }
.stat{ display:flex; flex-direction:column; gap:2px; background: var(--emerald-tint); padding: 8px 14px; border-radius: 4px; }
.stat-value{ font-weight:700; font-size:.9rem; color: var(--emerald-dark); }
.stat-label{ font-size:.64rem; text-transform:uppercase; letter-spacing:.05em; color: var(--emerald-dark); opacity:.75; }

.stat-stepper .servings-row{ display:flex; align-items:center; gap:10px; }
.stat-stepper .stat-value{ min-width:14px; text-align:center; }
```

Keep lines 371-379 (`.step-btn` rules) — unchanged, still used by the servings +/- buttons.

- [ ] **Step 6: Restructure the `openDetail()` template — hero contains only topbar+title, stats move to a new `.detail-info` block, `.detail-photo` div removed**

In `script.js`, replace the whole block from the `detail-hero` opening div through the old `.detail-photo` div (currently lines 804-852, i.e. from `detailScroll.innerHTML = \`` through the `<div class="detail-photo" id="detailPhoto" hidden></div>` line):

```js
  detailScroll.innerHTML = `
    <div class="detail-hero">
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          <button class="detail-fav is-menu" id="detailMenuBtn" type="button" aria-label="Ouvrir le menu">
            <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="back-btn" id="backBtn" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Retour
          </button>
        </div>
        <div class="detail-topbar-actions">
          ${isCustom ? `
          <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
          <button class="detail-fav" id="detailDeleteBtn" type="button" aria-label="Supprimer la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          ` : ""}
          <button class="detail-fav has-cart-badge" id="detailCartBtn" type="button" aria-label="Ouvrir le panier de courses">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span id="detailCartBadge" class="cart-badge" ${cart.length === 0 ? "hidden" : ""}>${cart.length}</span>
          </button>
          <button class="detail-fav" id="detailFavBtn" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="detail-heading">
        <span class="detail-eyebrow">${r.category}</span>
        <h2>${r.title}</h2>
        <p class="detail-sub">${r.desc}</p>
        <div class="detail-stats">
          <div class="stat"><span class="stat-value">${r.time} min</span><span class="stat-label">Préparation</span></div>
          <div class="stat stat-stepper">
            <div class="servings-row">
              <button class="step-btn" id="serveMinus" type="button" aria-label="Réduire le nombre de personnes">–</button>
              <span class="stat-value" id="servingsValue">${r.servings}</span>
              <button class="step-btn" id="servePlus" type="button" aria-label="Augmenter le nombre de personnes">+</button>
            </div>
            <span class="stat-label">Personnes</span>
          </div>
          <div class="stat"><span class="stat-value">${r.difficulty}</span><span class="stat-label">Difficulté</span></div>
        </div>
      </div>
    </div>
    <div class="detail-photo" id="detailPhoto" hidden></div>
```

with:

```js
  detailScroll.innerHTML = `
    <div class="detail-hero" id="detailHero">
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          <button class="detail-fav is-menu" id="detailMenuBtn" type="button" aria-label="Ouvrir le menu">
            <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="back-btn" id="backBtn" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Retour
          </button>
        </div>
        <div class="detail-topbar-actions">
          ${isCustom ? `
          <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
          <button class="detail-fav" id="detailDeleteBtn" type="button" aria-label="Supprimer la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          ` : ""}
          <button class="detail-fav has-cart-badge" id="detailCartBtn" type="button" aria-label="Ouvrir le panier de courses">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span id="detailCartBadge" class="cart-badge" ${cart.length === 0 ? "hidden" : ""}>${cart.length}</span>
          </button>
          <button class="detail-fav" id="detailFavBtn" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="detail-heading">
        <span class="detail-eyebrow">${r.category}</span>
        <h2>${r.title}</h2>
        <p class="detail-sub">${r.desc}</p>
      </div>
    </div>
    <div class="detail-info">
      <div class="stats-flat" id="statsFlat">
        <div class="cell"><span class="l">Préparation</span><span class="v">${r.time} min</span></div>
        <div class="cell"><span class="l">Personnes</span><span class="v stat-stepper">
          <button class="step-btn" id="serveMinus" type="button" aria-label="Réduire le nombre de personnes">–</button>
          <span id="servingsValue">${r.servings}</span>
          <button class="step-btn" id="servePlus" type="button" aria-label="Augmenter le nombre de personnes">+</button>
        </span></div>
        <div class="cell"><span class="l">Difficulté</span><span class="v">${r.difficulty}</span></div>
      </div>
    </div>
```

Note: `#servingsValue` keeps the same id, so the existing `minusBtn`/`plusBtn` event listeners later in `openDetail()` (unchanged by this task) keep working without modification.

- [ ] **Step 7: Repurpose `applyDetailPhoto` to set the hero's background image**

In `script.js`, replace lines 256-262:

```js
function applyDetailPhoto(recipeId, photoEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !photoEl) return;
    photoEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
    photoEl.hidden = false;
  }).catch(() => {});
}
```

with:

```js
function applyDetailPhoto(recipeId, heroEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  }).catch(() => {});
}
```

- [ ] **Step 8: Update the `applyDetailPhoto` call site**

In `script.js`, find:

```js
  applyDetailPhoto(r.id, detailScroll.querySelector("#detailPhoto"));
```

and replace it with:

```js
  applyDetailPhoto(r.id, detailScroll.querySelector("#detailHero"));
```

- [ ] **Step 9: Verify in the browser**

1. Open a built-in recipe with **no photo**, e.g. "Quiche lorraine". Screenshot. Expected: hero shows a category-colored gradient (terracotta-ish for "plat") with a dark bottom fade, white bold title/subtitle readable over it, topbar buttons (back/cart/fav) still visible as white circles above the gradient. Right below the hero: a flat 3-cell stats bar (Préparation/Personnes/Difficulté) on the plain cream background — no photo box anywhere.
2. Click the servings "+"/"-" stepper: expected unchanged behavior (ingredient quantities rescale — this was already verified working in earlier sessions and this task doesn't touch that logic, only the stat bar's DOM location).
3. Add a recipe with a photo via the "+" FAB (fill required fields, attach a photo). Open it. Expected: the hero now shows the actual uploaded photo as its background (with the same dark gradient + white text), not the category-color fallback.
4. Check the browser console: no errors.

- [ ] **Step 10: Commit**

```bash
git add style.css script.js
git commit -m "Restructure recipe hero into a full-bleed photo banner

Photo (or a category-color gradient fallback when none exists) now
sits behind the title/subtitle with a dark overlay for legibility,
matching the HelloFresh reference. Time/servings/difficulty move out
of the hero into a flat stats bar on the plain background below,
matching the approved mockup layout."
```

---

### Task 3: Ingredients as a 2-column icon grid

**Files:**
- Modify: `style.css:437-445` (`.ingredient-list`/`.ing-name`/`.ing-qty` rules), `script.js` (initial ingredient markup + `renderScaledIngredients()`, both inside `openDetail()`)

**Interfaces:**
- Consumes: `.hf-theme` tokens from Task 1.
- No new interfaces produced (purely visual; the `#ingredientList` id and the `[name, qty]` tuple shape are unchanged, so Task 6 and the cart/export code that reads `r.ingredients` elsewhere are unaffected).

- [ ] **Step 1: Add a generic ingredient icon and rewrite the ingredient-list CSS**

In `style.css`, replace lines 437-445:

```css
.ingredient-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; }
.ingredient-list li{
  display:flex; justify-content:space-between; align-items:center; gap:10px;
  padding: 11px 2px;
  font-size:.88rem;
  border-bottom: 1px solid var(--line);
}
.ing-name{ color: var(--ink); font-weight:500; }
.ing-qty{ color: var(--emerald-dark); font-weight:600; white-space:nowrap; font-size:.82rem; }
```

with:

```css
.ingredient-list{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:1fr; gap:0 20px; }
@media (min-width: 420px){
  .ingredient-list{ grid-template-columns: 1fr 1fr; }
}
.ingredient-list li{
  display:flex; align-items:center; gap:10px;
  padding: 9px 2px;
  border-bottom: 1px solid var(--line);
}
.ing-icon{
  flex:none; width:30px; height:30px; border-radius:50%;
  background: var(--emerald-tint); color: var(--emerald-dark);
  display:flex; align-items:center; justify-content:center;
}
.ing-icon svg{ width:15px; height:15px; }
.ing-text{ display:flex; flex-direction:column; min-width:0; }
.ing-name{ color: var(--ink); font-weight:700; font-size:.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ing-qty{ color: var(--ink-faint); font-weight:600; white-space:nowrap; font-size:.72rem; }
```

Note: this drops the `justify-content:space-between` layout (name left, qty right) in favor of name-over-qty stacked next to a fixed icon, matching HelloFresh's compact row style. Same generic icon for every ingredient (no per-item image data exists) — a small leaf glyph, defined inline in the markup below.

- [ ] **Step 2: Define the shared ingredient-row markup as a JS constant**

In `script.js`, immediately before `function openDetail(id){`, insert:

```js
const ING_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21c-4.5 0-8-3.5-8-8 0-6 8-11 8-11s8 5 8 11c0 4.5-3.5 8-8 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 21V10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
function ingredientRowHtml(name, qty){
  return `<li><span class="ing-icon">${ING_ICON}</span><span class="ing-text"><span class="ing-name">${name}</span><span class="ing-qty">${qty}</span></span></li>`;
}
```

- [ ] **Step 3: Use `ingredientRowHtml()` in the initial render**

In `script.js`, `openDetail()`, replace:

```js
        <ul class="ingredient-list" id="ingredientList">
          ${r.ingredients.map(([name, qty]) => `<li><span class="ing-name">${name}</span><span class="ing-qty">${qty}</span></li>`).join("")}
```

with:

```js
        <ul class="ingredient-list" id="ingredientList">
          ${r.ingredients.map(([name, qty]) => ingredientRowHtml(name, qty)).join("")}
```

(keep the closing `</ul>` line as-is right after).

- [ ] **Step 4: Use `ingredientRowHtml()` in `renderScaledIngredients()`**

Find `function renderScaledIngredients(){` inside `openDetail()` and replace its body:

```js
  function renderScaledIngredients(){
    ingredientListEl.innerHTML = currentIngredients()
      .map(([name, qty]) => `<li><span class="ing-name">${name}</span><span class="ing-qty">${qty}</span></li>`)
      .join("");
  }
```

with:

```js
  function renderScaledIngredients(){
    ingredientListEl.innerHTML = currentIngredients()
      .map(([name, qty]) => ingredientRowHtml(name, qty))
      .join("");
  }
```

- [ ] **Step 5: Verify in the browser**

1. Open "Quiche lorraine" (7 ingredients).
2. Screenshot at desktop width (≥720px, where `.detail-body` already switches to 2 columns) and at mobile width (<420px).
3. Expected desktop: ingredients panel shows a 2×4 grid (2 columns), each row has a small green circular leaf icon, bold name above, gray quantity below.
4. Expected mobile (<420px): ingredients stack in 1 column (the `@media (min-width:420px)` rule not yet active) — still readable, no overflow.
5. Use the servings +/- stepper: expected quantities update live in the same 2-column grid layout (confirms `renderScaledIngredients()` regenerates correctly).

- [ ] **Step 6: Commit**

```bash
git add style.css script.js
git commit -m "Show recipe ingredients as a 2-column icon grid

Matches the HelloFresh reference layout. Uses one generic leaf icon
per row (no per-ingredient photo data exists) instead of guessing an
emoji per ingredient name."
```

---

### Task 4: Per-step photo storage helpers (IndexedDB)

**Files:**
- Modify: `script.js:210-248` (photo storage block — add new functions after `deletePhoto`)

**Interfaces:**
- Produces: `stepPhotoKey(recipeId, index) -> string`, `saveStepPhoto(recipeId, index, file) -> Promise<void>`, `getStepPhoto(recipeId, index) -> Promise<Blob|null>`, `deleteAllPhotosForRecipe(recipeId) -> Promise<void>`. Task 5 calls `saveStepPhoto`; Task 6 calls `getStepPhoto`; Task 7 calls `deleteAllPhotosForRecipe`.
- Consumes: existing `openPhotoDB()`, `PHOTO_STORE` (both defined just above, unchanged).

- [ ] **Step 1: Add the new functions**

In `script.js`, immediately after `function deletePhoto(recipeId){...}` (before `function applyCardPhoto`), insert:

```js
function stepPhotoKey(recipeId, index){
  return `${recipeId}::step::${index}`;
}
async function saveStepPhoto(recipeId, index, file){
  return savePhoto(stepPhotoKey(recipeId, index), file);
}
async function getStepPhoto(recipeId, index){
  return getPhoto(stepPhotoKey(recipeId, index));
}
async function deleteAllPhotosForRecipe(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    const range = IDBKeyRange.bound(recipeId, recipeId + "￿");
    const req = tx.objectStore(PHOTO_STORE).delete(range);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(req.error);
  });
}
```

`IDBKeyRange.bound(recipeId, recipeId + "￿")` covers both the exact key `recipeId` (main photo) and every `recipeId::step::N` key (step photos), since those are lexicographically greater than `recipeId` alone and less than `recipeId` followed by the maximum Unicode code point. `IDBObjectStore.delete()` accepts a range directly (no cursor loop needed).

- [ ] **Step 2: Verify via the browser console**

Open the app in the Browser pane, then run (via `javascript_tool`):

```js
(async () => {
  await savePhoto("test-recipe", new Blob(["main"], {type:"text/plain"}));
  await saveStepPhoto("test-recipe", 0, new Blob(["step0"], {type:"text/plain"}));
  await saveStepPhoto("test-recipe", 1, new Blob(["step1"], {type:"text/plain"}));

  const main = await getPhoto("test-recipe");
  const s0 = await getStepPhoto("test-recipe", 0);
  const s1 = await getStepPhoto("test-recipe", 1);
  const beforeCount = [main, s0, s1].filter(Boolean).length; // expect 3

  await deleteAllPhotosForRecipe("test-recipe");
  const mainAfter = await getPhoto("test-recipe");
  const s0After = await getStepPhoto("test-recipe", 0);
  const s1After = await getStepPhoto("test-recipe", 1);
  const afterCount = [mainAfter, s0After, s1After].filter(Boolean).length; // expect 0

  return JSON.stringify({ beforeCount, afterCount });
})();
```

Expected result: `{"beforeCount":3,"afterCount":0}`.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Add per-step photo storage helpers

Reuses the existing carnet-photos IndexedDB store with composite keys
(recipeId::step::index) — no schema change. deleteAllPhotosForRecipe
uses an IDBKeyRange to remove a recipe's main + all step photos in
one call."
```

---

### Task 5: Add-recipe form — new fields, reordering, per-step photo input

**Files:**
- Modify: `style.css:530-539` (`.dyn-row` rules — add step-photo-input styling), `script.js` (`createStepRow`, `renderAddForm`)

**Interfaces:**
- Consumes: `saveStepPhoto` from Task 4.
- Produces: recipe objects that may now carry `nutrition: {calories, protein}`, `allergens: string`, `utensils: string[]` — Task 6 reads these when rendering.

- [ ] **Step 1: Add file-input styling for step rows**

In `style.css`, after `.dyn-row-step .step-input{ flex:1; min-width:0; }`, insert:

```css
.dyn-row-step .step-photo-input{ flex:none; width:120px; font-size:.68rem; color: var(--ink-faint); }
```

- [ ] **Step 2: Add a photo file input to `createStepRow`**

In `script.js`, replace the `createStepRow` function:

```js
function createStepRow(container, text = ""){
  const row = document.createElement("div");
  row.className = "dyn-row dyn-row-step";
  row.innerHTML = `
    <input type="text" class="step-input" placeholder="Décrivez l'étape…" value="${escapeAttr(text)}">
    <button type="button" class="dyn-remove" aria-label="Supprimer cette étape">✕</button>
  `;
  row.querySelector(".dyn-remove").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(container);
  });
  return row;
}
```

with:

```js
function createStepRow(container, text = ""){
  const row = document.createElement("div");
  row.className = "dyn-row dyn-row-step";
  row.innerHTML = `
    <input type="text" class="step-input" placeholder="Décrivez l'étape…" value="${escapeAttr(text)}">
    <input type="file" class="step-photo-input" accept="image/*" title="Photo de l'étape (optionnel)">
    <button type="button" class="dyn-remove" aria-label="Supprimer cette étape">✕</button>
  `;
  row.querySelector(".dyn-remove").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(container);
  });
  return row;
}
```

- [ ] **Step 3: Add `createUstensileRow`**

In `script.js`, immediately after the `createStepRow` function, insert:

```js
function createUstensileRow(container, text = ""){
  const row = document.createElement("div");
  row.className = "dyn-row dyn-row-step";
  row.innerHTML = `
    <input type="text" class="tool-input" placeholder="Ex. Casserole" value="${escapeAttr(text)}">
    <button type="button" class="dyn-remove" aria-label="Supprimer cet ustensile">✕</button>
  `;
  row.querySelector(".dyn-remove").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(container);
  });
  return row;
}
```

`.tool-input` reuses the existing `.dyn-row input` base styling (border/padding/font already apply to any `input` inside `.dyn-row`); no new CSS rule is needed for it specifically.

- [ ] **Step 4: Reorder fields and add the 3 new field groups in `renderAddForm`'s template**

In `script.js`, in `renderAddForm`, replace the whole template literal assigned to `addScroll.innerHTML`:

```js
  addScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="addMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="back-btn" id="addBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
      </div>
      <h2>${editingRecipe ? "Modifier la recette" : "Nouvelle recette"}</h2>
    </div>
    <form id="addForm" class="add-form" novalidate>
      <div class="field">
        <label for="addTitle">Titre *</label>
        <input id="addTitle" type="text" placeholder="Ex. Tarte aux pommes" value="${escapeAttr(editingRecipe?.title || "")}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addCategory">Catégorie *</label>
          <select id="addCategory">
            <option value="">Choisir…</option>
            <option value="entrée">Entrée</option>
            <option value="plat">Plat</option>
            <option value="dessert">Dessert</option>
          </select>
        </div>
        <div class="field">
          <label for="addDifficulty">Difficulté</label>
          <select id="addDifficulty">
            <option value="Facile">Facile</option>
            <option value="Intermédiaire">Intermédiaire</option>
            <option value="Difficile">Difficile</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="addDesc">Description courte</label>
        <input id="addDesc" type="text" placeholder="Une phrase pour donner envie" value="${escapeAttr(editingRecipe?.desc || "")}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addTime">Temps (min)</label>
          <input id="addTime" type="number" min="0" placeholder="30" value="${editingRecipe?.time || ""}">
        </div>
        <div class="field">
          <label for="addServings">Personnes</label>
          <input id="addServings" type="number" min="1" placeholder="4" value="${editingRecipe?.servings || ""}">
        </div>
      </div>
      <div class="field">
        <label for="addPhoto">Photo (optionnel)${editingRecipe ? " — laisse vide pour garder la photo actuelle" : ""}</label>
        <input id="addPhoto" type="file" accept="image/*">
      </div>
      <div class="field">
        <label>Ingrédients *</label>
        <div id="ingredientRows" class="dyn-rows"></div>
        <button type="button" class="dyn-add" id="addIngredientRow">+ Ajouter un ingrédient</button>
      </div>
      <div class="field">
        <label>Étapes *</label>
        <div id="stepRows" class="dyn-rows"></div>
        <button type="button" class="dyn-add" id="addStepRow">+ Ajouter une étape</button>
      </div>
      <div class="field">
        <label for="addNote">Astuce (optionnel)</label>
        <textarea id="addNote" rows="2" placeholder="Un conseil, une variante…">${editingRecipe?.note || ""}</textarea>
      </div>
      <p id="addError" class="add-error" hidden></p>
      <div class="add-actions">
        <button type="button" class="btn-secondary" id="addCancelBtn">Annuler</button>
        <button type="submit" class="btn-primary">${editingRecipe ? "Enregistrer les modifications" : "Enregistrer"}</button>
      </div>
    </form>
  `;
```

with:

```js
  addScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="addMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="back-btn" id="addBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
      </div>
      <h2>${editingRecipe ? "Modifier la recette" : "Nouvelle recette"}</h2>
    </div>
    <form id="addForm" class="add-form" novalidate>
      <div class="field">
        <label for="addTitle">Titre *</label>
        <input id="addTitle" type="text" placeholder="Ex. Tarte aux pommes" value="${escapeAttr(editingRecipe?.title || "")}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addCategory">Catégorie *</label>
          <select id="addCategory">
            <option value="">Choisir…</option>
            <option value="entrée">Entrée</option>
            <option value="plat">Plat</option>
            <option value="dessert">Dessert</option>
          </select>
        </div>
        <div class="field">
          <label for="addDifficulty">Difficulté</label>
          <select id="addDifficulty">
            <option value="Facile">Facile</option>
            <option value="Intermédiaire">Intermédiaire</option>
            <option value="Difficile">Difficile</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="addDesc">Description courte</label>
        <input id="addDesc" type="text" placeholder="Une phrase pour donner envie" value="${escapeAttr(editingRecipe?.desc || "")}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addTime">Temps (min)</label>
          <input id="addTime" type="number" min="0" placeholder="30" value="${editingRecipe?.time || ""}">
        </div>
        <div class="field">
          <label for="addServings">Personnes</label>
          <input id="addServings" type="number" min="1" placeholder="4" value="${editingRecipe?.servings || ""}">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addCalories">Calories (optionnel)</label>
          <input id="addCalories" type="number" min="0" placeholder="Ex. 650" value="${editingRecipe?.nutrition?.calories ?? ""}">
        </div>
        <div class="field">
          <label for="addProtein">Protéines en g (optionnel)</label>
          <input id="addProtein" type="number" min="0" step="0.1" placeholder="Ex. 20" value="${editingRecipe?.nutrition?.protein ?? ""}">
        </div>
      </div>
      <div class="field">
        <label for="addAllergens">Allergènes (optionnel)</label>
        <input id="addAllergens" type="text" placeholder="Ex. Gluten, blé, lait" value="${escapeAttr(editingRecipe?.allergens || "")}">
      </div>
      <div class="field">
        <label for="addPhoto">Photo (optionnel)${editingRecipe ? " — laisse vide pour garder la photo actuelle" : ""}</label>
        <input id="addPhoto" type="file" accept="image/*">
      </div>
      <div class="field">
        <label>Ingrédients *</label>
        <div id="ingredientRows" class="dyn-rows"></div>
        <button type="button" class="dyn-add" id="addIngredientRow">+ Ajouter un ingrédient</button>
      </div>
      <div class="field">
        <label>Ustensiles (optionnel)</label>
        <div id="ustensilRows" class="dyn-rows"></div>
        <button type="button" class="dyn-add" id="addUstensilRow">+ Ajouter un ustensile</button>
      </div>
      <div class="field">
        <label>Étapes * ${editingRecipe ? "(photo : laisse vide pour garder la photo actuelle de l'étape)" : ""}</label>
        <div id="stepRows" class="dyn-rows"></div>
        <button type="button" class="dyn-add" id="addStepRow">+ Ajouter une étape</button>
      </div>
      <div class="field">
        <label for="addNote">Astuce (optionnel)</label>
        <textarea id="addNote" rows="2" placeholder="Un conseil, une variante…">${editingRecipe?.note || ""}</textarea>
      </div>
      <p id="addError" class="add-error" hidden></p>
      <div class="add-actions">
        <button type="button" class="btn-secondary" id="addCancelBtn">Annuler</button>
        <button type="submit" class="btn-primary">${editingRecipe ? "Enregistrer les modifications" : "Enregistrer"}</button>
      </div>
    </form>
  `;
```

- [ ] **Step 5: Wire up the ustensiles dynamic rows (prefill + add button)**

In `script.js`, `renderAddForm`, find this block:

```js
  const addForm = addScroll.querySelector("#addForm");
  const ingredientRowsEl = addScroll.querySelector("#ingredientRows");
  const stepRowsEl = addScroll.querySelector("#stepRows");
  const addError = addScroll.querySelector("#addError");

  addForm.querySelector("#addCategory").value = editingRecipe?.category || "";
  addForm.querySelector("#addDifficulty").value = editingRecipe?.difficulty || "Facile";

  if (editingRecipe && editingRecipe.ingredients.length) {
    editingRecipe.ingredients.forEach(([name, qty]) => ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl, name, qty)));
  } else {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
  }
  if (editingRecipe && editingRecipe.steps.length) {
    editingRecipe.steps.forEach(text => stepRowsEl.appendChild(createStepRow(stepRowsEl, text)));
  } else {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
  }
  updateRemoveButtons(ingredientRowsEl);
  updateRemoveButtons(stepRowsEl);
```

and replace it with:

```js
  const addForm = addScroll.querySelector("#addForm");
  const ingredientRowsEl = addScroll.querySelector("#ingredientRows");
  const ustensilRowsEl = addScroll.querySelector("#ustensilRows");
  const stepRowsEl = addScroll.querySelector("#stepRows");
  const addError = addScroll.querySelector("#addError");

  addForm.querySelector("#addCategory").value = editingRecipe?.category || "";
  addForm.querySelector("#addDifficulty").value = editingRecipe?.difficulty || "Facile";

  if (editingRecipe && editingRecipe.ingredients.length) {
    editingRecipe.ingredients.forEach(([name, qty]) => ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl, name, qty)));
  } else {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
  }
  if (editingRecipe && editingRecipe.utensils && editingRecipe.utensils.length) {
    editingRecipe.utensils.forEach(text => ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl, text)));
  } else {
    ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl));
  }
  if (editingRecipe && editingRecipe.steps.length) {
    editingRecipe.steps.forEach(text => stepRowsEl.appendChild(createStepRow(stepRowsEl, text)));
  } else {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
  }
  updateRemoveButtons(ingredientRowsEl);
  updateRemoveButtons(ustensilRowsEl);
  updateRemoveButtons(stepRowsEl);
```

- [ ] **Step 6: Wire up the "+ Ajouter un ustensile" button**

In `script.js`, find:

```js
  addScroll.querySelector("#addIngredientRow").addEventListener("click", () => {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
    updateRemoveButtons(ingredientRowsEl);
  });
  addScroll.querySelector("#addStepRow").addEventListener("click", () => {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
    updateRemoveButtons(stepRowsEl);
  });
```

and insert a new block between them:

```js
  addScroll.querySelector("#addIngredientRow").addEventListener("click", () => {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
    updateRemoveButtons(ingredientRowsEl);
  });
  addScroll.querySelector("#addUstensilRow").addEventListener("click", () => {
    ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl));
    updateRemoveButtons(ustensilRowsEl);
  });
  addScroll.querySelector("#addStepRow").addEventListener("click", () => {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
    updateRemoveButtons(stepRowsEl);
  });
```

- [ ] **Step 7: Read the new field values and save step photos in the submit handler**

In `script.js`, inside the `addForm.addEventListener("submit", async (e) => { ... })` handler, find:

```js
    const title = addForm.querySelector("#addTitle").value.trim();
    const category = addForm.querySelector("#addCategory").value;
    const desc = addForm.querySelector("#addDesc").value.trim();
    const time = parseInt(addForm.querySelector("#addTime").value, 10) || 0;
    const servings = parseInt(addForm.querySelector("#addServings").value, 10) || 0;
    const difficulty = addForm.querySelector("#addDifficulty").value;
    const note = addForm.querySelector("#addNote").value.trim();

    const ingredients = [...ingredientRowsEl.querySelectorAll(".dyn-row")]
      .map(row => [row.querySelector(".ing-name-input").value.trim(), row.querySelector(".ing-qty-input").value.trim()])
      .filter(([name]) => name);

    const steps = [...stepRowsEl.querySelectorAll(".dyn-row")]
      .map(row => row.querySelector(".step-input").value.trim())
      .filter(Boolean);
```

and replace it with:

```js
    const title = addForm.querySelector("#addTitle").value.trim();
    const category = addForm.querySelector("#addCategory").value;
    const desc = addForm.querySelector("#addDesc").value.trim();
    const time = parseInt(addForm.querySelector("#addTime").value, 10) || 0;
    const servings = parseInt(addForm.querySelector("#addServings").value, 10) || 0;
    const difficulty = addForm.querySelector("#addDifficulty").value;
    const note = addForm.querySelector("#addNote").value.trim();

    const caloriesVal = addForm.querySelector("#addCalories").value.trim();
    const proteinVal = addForm.querySelector("#addProtein").value.trim();
    const nutrition = (caloriesVal && proteinVal)
      ? { calories: parseFloat(caloriesVal), protein: parseFloat(proteinVal) }
      : undefined;
    const allergens = addForm.querySelector("#addAllergens").value.trim() || undefined;

    const ingredients = [...ingredientRowsEl.querySelectorAll(".dyn-row")]
      .map(row => [row.querySelector(".ing-name-input").value.trim(), row.querySelector(".ing-qty-input").value.trim()])
      .filter(([name]) => name);

    const utensilsList = [...ustensilRowsEl.querySelectorAll(".dyn-row")]
      .map(row => row.querySelector(".tool-input").value.trim())
      .filter(Boolean);
    const utensils = utensilsList.length ? utensilsList : undefined;

    const stepRowEls = [...stepRowsEl.querySelectorAll(".dyn-row")];
    const steps = stepRowEls
      .map(row => row.querySelector(".step-input").value.trim())
      .filter(Boolean);
    const stepPhotoFiles = stepRowEls.map(row => row.querySelector(".step-photo-input").files[0] || null);
```

Note: `nutrition` requires **both** calories and protein filled in (avoids a stat cell with a blank value); `allergens`/`utensils` are included only if non-empty. `stepPhotoFiles` indices line up with `stepRowEls` (all rows, including any blank ones); a blank step row's photo is simply never saved since blank steps are filtered out of `steps` right after — this is an existing edge case already present for text steps today (blank rows are silently dropped), unchanged by this task.

- [ ] **Step 8: Include the new fields on the saved recipe object and save step photos, both for edit and create**

In `script.js`, find the edit branch:

```js
    if (editingRecipe) {
      const recipe = {
        ...editingRecipe,
        title, category,
        icon: CATEGORY_ICON[category],
        desc, time, servings, difficulty, note,
        ingredients, steps
      };
      const ci = customRecipes.findIndex(r => r.id === editingRecipe.id);
      if (ci >= 0) customRecipes[ci] = recipe;
      const ai = ALL_RECIPES.findIndex(r => r.id === editingRecipe.id);
      if (ai >= 0) ALL_RECIPES[ai] = recipe;
      saveCustomRecipes();

      if (photoFile) await savePhoto(recipe.id, photoFile);

      closeAddForm();
      showToast("Recette modifiée");
      openDetail(recipe.id);
      return;
    }

    const recipe = {
      id: generateRecipeId(title),
      title, category,
      icon: CATEGORY_ICON[category],
      desc, time, servings, difficulty, note,
      ingredients, steps
    };

    customRecipes.push(recipe);
    ALL_RECIPES.push(recipe);
    saveCustomRecipes();

    if (photoFile) await savePhoto(recipe.id, photoFile);
```

and replace it with:

```js
    if (editingRecipe) {
      const recipe = {
        ...editingRecipe,
        title, category,
        icon: CATEGORY_ICON[category],
        desc, time, servings, difficulty, note,
        ingredients, steps, nutrition, allergens, utensils
      };
      const ci = customRecipes.findIndex(r => r.id === editingRecipe.id);
      if (ci >= 0) customRecipes[ci] = recipe;
      const ai = ALL_RECIPES.findIndex(r => r.id === editingRecipe.id);
      if (ai >= 0) ALL_RECIPES[ai] = recipe;
      saveCustomRecipes();

      if (photoFile) await savePhoto(recipe.id, photoFile);
      for (let i = 0; i < stepPhotoFiles.length; i++) {
        if (stepPhotoFiles[i]) await saveStepPhoto(recipe.id, i, stepPhotoFiles[i]);
      }

      closeAddForm();
      showToast("Recette modifiée");
      openDetail(recipe.id);
      return;
    }

    const recipe = {
      id: generateRecipeId(title),
      title, category,
      icon: CATEGORY_ICON[category],
      desc, time, servings, difficulty, note,
      ingredients, steps, nutrition, allergens, utensils
    };

    customRecipes.push(recipe);
    ALL_RECIPES.push(recipe);
    saveCustomRecipes();

    if (photoFile) await savePhoto(recipe.id, photoFile);
    for (let i = 0; i < stepPhotoFiles.length; i++) {
      if (stepPhotoFiles[i]) await saveStepPhoto(recipe.id, i, stepPhotoFiles[i]);
    }
```

- [ ] **Step 9: Verify in the browser**

1. Open the add-recipe form (FAB button). Screenshot. Expected field order top-to-bottom: Titre, Catégorie/Difficulté, Description, Temps/Personnes, Calories/Protéines, Allergènes, Photo, Ingrédients, Ustensiles, Étapes (each with a text input + a small file input), Astuce.
2. Fill in: Titre "Bowl test", Catégorie "Plat", Temps 25, Personnes 2, Calories 783, Protéines 20.2, Allergènes "Gluten, lait", one ingredient ("Tomate" / "4 pièces"), one ustensile ("Poêle"), one step ("Couper les tomates") with a small test image attached to its file input.
3. Submit. Expected: toast "Recette ajoutée", returns to home grid, "Bowl test" card visible.
4. Run in the browser console: `JSON.stringify(customRecipes.find(r => r.title === "Bowl test"))`. Expected: object includes `"nutrition":{"calories":783,"protein":20.2}`, `"allergens":"Gluten, lait"`, `"utensils":["Poêle"]`.
5. Run: `getStepPhoto(customRecipes.find(r => r.title === "Bowl test").id, 0).then(b => console.log(!!b))`. Expected: `true`.
6. Open "Bowl test" from the grid, click the edit (pencil) icon. Expected: all fields pre-filled including Calories/Protéines/Allergènes/Ustensiles; step text pre-filled with the note that the existing photo is kept if the file input is left empty.
7. Open an existing built-in recipe (e.g. "Ratatouille provençale") — it has no edit/delete buttons (existing rule) so this just confirms nothing crashed; open its detail page and confirm it still renders (nutrition/allergens fields absent, handled by Task 6, not yet visible — that's expected at this point in the plan).

- [ ] **Step 10: Commit**

```bash
git add style.css script.js
git commit -m "Extend add-recipe form with HelloFresh-style fields

Adds optional Calories/Protéines, Allergènes, and Ustensiles (dynamic
list) fields, reordered to match the recipe detail page's section
order, plus an optional photo file input per preparation step."
```

---

### Task 6: Recipe detail — allergens, ustensiles, extra stat cells, step photos

**Files:**
- Modify: `style.css:447-459` (`.step-list` rules — rewrite to explicit numbered spans + photo thumbnails; add `.allergen-line`/`.tool-line`/`.stats-flat .cell.is-nutri`), `script.js` (`openDetail()`: `.detail-info` block, step list)

**Interfaces:**
- Consumes: `getStepPhoto` from Task 4; `nutrition`/`allergens`/`utensils` fields from Task 5; `.detail-info`/`#statsFlat` from Task 2.

- [ ] **Step 1: Rewrite `.step-list` CSS (explicit numbered spans + photo thumbnail) and add allergens/ustensiles line styles**

In `style.css`, replace lines 447-459:

```css
.step-list{ list-style:none; margin:0; padding:0; counter-reset: step; display:flex; flex-direction:column; gap:20px; }
.step-list li{
  counter-increment: step;
  position:relative; padding-left:38px; font-size:.93rem; color: var(--ink); line-height:1.6;
}
.step-list li::before{
  content: counter(step);
  position:absolute; left:0; top:-2px;
  width:26px; height:26px; border-radius:50%;
  border: 1.5px solid var(--emerald);
  color: var(--emerald-dark); font-weight:700; font-size:.78rem;
  display:flex; align-items:center; justify-content:center;
}
```

with:

```css
.step-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:16px; }
.step-list li{ display:flex; gap:12px; align-items:flex-start; }
.step-list .step-num{
  flex:none; width:26px; height:26px; border-radius:50%; margin-top:1px;
  border: 1.5px solid var(--emerald);
  color: var(--emerald-dark); font-weight:700; font-size:.78rem;
  display:flex; align-items:center; justify-content:center;
}
.step-list .step-photo{ flex:none; width:56px; height:56px; border-radius:6px; object-fit:cover; background: var(--surface); border:1px solid var(--line); }
.step-list p{ margin:0; font-size:.93rem; color: var(--ink); line-height:1.6; padding-top:2px; }
```

Then, after the `.ing-qty{...}` rule (added in Task 3), insert:

```css
.allergen-line{ font-size:.82rem; color: var(--ink); margin-top:14px; }
.allergen-line b{ color: var(--terracotta-dark); }
.tool-line{ font-size:.82rem; color: var(--ink-soft); margin-top:6px; }
.tool-line span:not(:last-child)::after{ content:" • "; color: var(--line); }
.stats-flat .cell.is-nutri .l{ color: var(--terracotta-dark); }
```

- [ ] **Step 2: Extend the stats bar with calories/protein cells and add allergens/ustensiles lines**

In `script.js`, `openDetail()`, find the `.detail-info` block written in Task 2:

```js
    <div class="detail-info">
      <div class="stats-flat" id="statsFlat">
        <div class="cell"><span class="l">Préparation</span><span class="v">${r.time} min</span></div>
        <div class="cell"><span class="l">Personnes</span><span class="v stat-stepper">
          <button class="step-btn" id="serveMinus" type="button" aria-label="Réduire le nombre de personnes">–</button>
          <span id="servingsValue">${r.servings}</span>
          <button class="step-btn" id="servePlus" type="button" aria-label="Augmenter le nombre de personnes">+</button>
        </span></div>
        <div class="cell"><span class="l">Difficulté</span><span class="v">${r.difficulty}</span></div>
      </div>
    </div>
```

and replace it with:

```js
    <div class="detail-info">
      <div class="stats-flat" id="statsFlat">
        <div class="cell"><span class="l">Préparation</span><span class="v">${r.time} min</span></div>
        <div class="cell"><span class="l">Personnes</span><span class="v stat-stepper">
          <button class="step-btn" id="serveMinus" type="button" aria-label="Réduire le nombre de personnes">–</button>
          <span id="servingsValue">${r.servings}</span>
          <button class="step-btn" id="servePlus" type="button" aria-label="Augmenter le nombre de personnes">+</button>
        </span></div>
        <div class="cell"><span class="l">Difficulté</span><span class="v">${r.difficulty}</span></div>
        ${r.nutrition ? `
        <div class="cell is-nutri"><span class="l">Calories</span><span class="v">${r.nutrition.calories} kcal</span></div>
        <div class="cell is-nutri"><span class="l">Protéines</span><span class="v">${r.nutrition.protein} g</span></div>
        ` : ""}
      </div>
      ${r.allergens ? `<p class="allergen-line"><b>Allergènes :</b> ${r.allergens}</p>` : ""}
      ${r.utensils && r.utensils.length ? `<p class="tool-line">${r.utensils.map(u => `<span>${u}</span>`).join("")}</p>` : ""}
    </div>
```

- [ ] **Step 3: Render steps with explicit numbers + `data-step-index`, drop the CSS-counter markup**

In `script.js`, `openDetail()`, find:

```js
      <div>
        <h3 class="panel-title">Préparation</h3>
        <ol class="step-list">
          ${r.steps.map(s => `<li>${s}</li>`).join("")}
        </ol>
      </div>
```

and replace it with:

```js
      <div>
        <h3 class="panel-title">Préparation</h3>
        <ol class="step-list" id="stepList">
          ${r.steps.map((s, i) => `<li data-step-index="${i}"><span class="step-num">${i + 1}</span><p>${s}</p></li>`).join("")}
        </ol>
      </div>
```

- [ ] **Step 4: Fire-and-forget load step photos after render**

In `script.js`, `openDetail()`, find the line:

```js
  applyDetailPhoto(r.id, detailScroll.querySelector("#detailHero"));
```

and insert immediately after it:

```js
  const stepListEl = detailScroll.querySelector("#stepList");
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

- [ ] **Step 5: Verify in the browser**

1. Open "Quiche lorraine" (no nutrition/allergens/utensils/step photos). Screenshot. Expected: stats bar still shows exactly 3 cells (no Calories/Protéines), no allergens line, no ustensiles line, steps show numbered circles with no photo thumbnails — visually identical to Task 2/3's output, confirming optional sections stay hidden when data is absent.
2. Open "Bowl test" (created in Task 5's verification, which has nutrition/allergens/utensils and one step photo). Screenshot. Expected: stats bar shows 5 cells (Préparation/Personnes/Difficulté/Calories/Protéines), an "Allergènes : Gluten, lait" line, a "Poêle" ustensiles line, and the first step shows a 56×56 photo thumbnail next to its number.
3. Check the browser console: no errors.

- [ ] **Step 6: Commit**

```bash
git add style.css script.js
git commit -m "Render allergens, utensils, nutrition cells, and step photos

Recipe detail page now shows these sections when the data is present
(built-in recipes have none of these fields and render unchanged).
Step list switches from CSS-counter numbering to explicit spans to
make room for optional per-step photo thumbnails."
```

---

### Task 7: Recipe deletion — clean up all associated photos

**Files:**
- Modify: `script.js` (`deleteRecipe()`)

**Interfaces:**
- Consumes: `deleteAllPhotosForRecipe` from Task 4.

- [ ] **Step 1: Replace the single-photo deletion call**

In `script.js`, in `deleteRecipe(id)`, replace:

```js
  deletePhoto(id).catch(() => {});
```

with:

```js
  deleteAllPhotosForRecipe(id).catch(() => {});
```

- [ ] **Step 2: Verify in the browser**

1. Using the "Bowl test" recipe from Task 5/6 (has a step-0 photo), note its id: run `customRecipes.find(r => r.title === "Bowl test").id` in the console.
2. Open "Bowl test", click the delete (trash) icon, confirm the dialog.
3. Run in the console (replace `RECIPE_ID` with the id from step 1): `Promise.all([getPhoto("RECIPE_ID"), getStepPhoto("RECIPE_ID", 0)]).then(r => console.log(r.map(Boolean)))`. Expected: `[false, false]`.
4. Confirm "Bowl test" no longer appears in the home grid.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "Clean up all recipe photos (main + per-step) on delete

deleteRecipe now uses deleteAllPhotosForRecipe instead of the
single-key deletePhoto, so step photos don't leak in IndexedDB after
a recipe is removed."
```

---

## Post-plan note

This plan does not touch `RECIPES` (the 8 built-in recipes) — they intentionally keep zero nutrition/allergens/utensils/step-photo data, per the spec's "never break existing recipes" constraint. If the user later wants to backfill real HelloFresh nutrition/allergen data onto any of them, that's a data-entry task via the edit form (built-ins aren't editable, so it would require converting one to a custom recipe, or a separate small follow-up task to lift the read-only restriction — out of scope here).
