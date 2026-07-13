# Synchro des recettes (Plan B1) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les recettes (les 8 de base + celles ajoutées) deviennent un livre de cuisine unique, partagé et synchronisé via Supabase entre tous les comptes du foyer — ajouter/modifier/supprimer une recette sur un appareil la fait apparaître sur l'autre après rafraîchissement.

**Architecture:** Nouveau module `js/sync.js` qui télécharge les recettes depuis la table `recipes` de Supabase, les met en cache dans IndexedDB, et alimente un miroir en mémoire (`ALL_RECIPES`, dans `js/recipes-store.js`) — lu de façon synchrone par `grid.js`/`detail.js` comme aujourd'hui. Les écritures (ajout/modif/suppression) passent directement par Supabase. Favoris et panier restent en `localStorage`, inchangés (synchronisés dans un lot ultérieur).

**Tech Stack:** Client Supabase déjà en place (`js/supabase-client.js`), IndexedDB natif (pas de nouvelle dépendance).

**Ce que ce plan NE fait PAS** (prévu dans des plans ultérieurs) : synchro des favoris/panier (toujours locaux après ce plan), file d'attente hors-ligne pour les écritures (une écriture hors-ligne échoue simplement avec un message d'erreur dans ce plan — la mise en attente arrive avec B3), migration des photos vers Supabase Storage (B4), inscription par code d'invitation (B5).

## Global Constraints

- Zéro étape de build : tout reste en `<script type="module">`, aucune dépendance npm ajoutée.
- Texte de l'interface en français, cohérent avec le reste de l'app.
- Pas de framework de test automatisé — vérification manuelle dans le navigateur à chaque tâche.
- Toute écriture vers `recipes` doit inclure `updated_at` (pas de trigger Postgres pour l'auto-mettre à jour — voir `supabase/schema.sql`).
- La colonne Postgres s'appelle `description` (pas `desc` — `desc` est un mot-clé SQL, décision prise à l'implémentation du schéma) ; le code JS continue d'utiliser `desc` comme nom de propriété (comme aujourd'hui) — la conversion se fait dans `js/sync.js`.
- Les fichiers du site sont dans `public/js/`, `public/index.html`, etc. (voir restructuration du 2026-07-13) — tous les chemins de ce plan sont relatifs à `public/`.

---

### Task 1: Module de synchronisation (`js/sync.js`)

**Files:**
- Create: `public/js/sync.js`

**Interfaces:**
- Produces: `loadCachedRecipes()`, `pullRecipes()`, `cacheRecipe(recipe)`, `uncacheRecipe(id)`, `recipeToRow(recipe)` — toutes utilisées par `js/recipes-store.js` (Task 3).

- [ ] **Step 1: Écrire le module**

```js
import { supabase } from "./supabase-client.js";

const DB_NAME = "carnet-sync";
const DB_VERSION = 1;
const RECIPES_STORE = "recipes";

function openSyncDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(RECIPES_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function rowToRecipe(row){
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    icon: row.icon,
    desc: row.description,
    time: row.time,
    servings: row.servings,
    difficulty: row.difficulty,
    note: row.note,
    ingredients: row.ingredients,
    steps: row.steps,
    nutrition: row.nutrition || undefined,
    allergens: row.allergens || undefined,
    utensils: row.utensils || undefined
  };
}

export function recipeToRow(recipe){
  return {
    id: recipe.id,
    title: recipe.title,
    category: recipe.category,
    icon: recipe.icon,
    description: recipe.desc || "",
    time: recipe.time,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    note: recipe.note || "",
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    nutrition: recipe.nutrition ?? null,
    allergens: recipe.allergens ?? null,
    utensils: recipe.utensils ?? null,
    updated_at: new Date().toISOString()
  };
}

export async function loadCachedRecipes(){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readonly");
    const req = tx.objectStore(RECIPES_STORE).getAll();
    req.onsuccess = () => resolve(req.result.map(rowToRecipe));
    req.onerror = () => reject(req.error);
  });
}

export async function pullRecipes(){
  const { data, error } = await supabase.from("recipes").select("*").order("title");
  if (error) throw error;
  const db = await openSyncDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readwrite");
    const store = tx.objectStore(RECIPES_STORE);
    store.clear();
    data.forEach(row => store.put(row));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return data.map(rowToRecipe);
}

export async function cacheRecipe(recipe){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readwrite");
    tx.objectStore(RECIPES_STORE).put(recipeToRow(recipe));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function uncacheRecipe(id){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readwrite");
    tx.objectStore(RECIPES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 2: Vérifier manuellement**

Ce module n'est pas encore branché à l'app (les tâches suivantes le font). Vérifier seulement qu'il n'y a pas d'erreur de syntaxe : ouvrir `public/js/sync.js` et relire attentivement, ou ajouter temporairement `import "./sync.js";` en première ligne de `public/js/main.js`, lancer `lancer-le-carnet.bat`, vérifier l'absence d'erreur dans la console (F12), puis retirer cette ligne temporaire avant de continuer.

- [ ] **Step 3: Commit**

```bash
git add public/js/sync.js
git commit -m "Add recipe sync module (Supabase <-> IndexedDB cache)"
```

---

### Task 2: Alléger `js/recipes-data.js`

**Files:**
- Modify: `public/js/recipes-data.js`

**Interfaces:**
- Produces: `CATEGORY_ICON`, `CATEGORY_LABELS` (inchangés). Le tableau `RECIPES` est supprimé — ses 8 recettes vivent maintenant dans la table Supabase `recipes` (déjà seedée par `supabase/schema.sql`, Plan A Task 1).
- Consumes: aucune tâche de ce plan n'importe plus `RECIPES` après Task 4.

- [ ] **Step 1: Supprimer le tableau `RECIPES`**

Dans `public/js/recipes-data.js`, supprimer tout le contenu depuis `export const RECIPES = [` jusqu'à la ligne `];` qui le termine (juste avant `export const CATEGORY_ICON = ...`). Le fichier ne doit garder que :

```js
/* ---- données des recettes intégrées ---- */
export const CATEGORY_ICON = { "entrée": "bowl", plat: "pot", dessert: "tart" };
export const CATEGORY_LABELS = { tout: "Toutes les recettes", "entrée": "Entrées", plat: "Plats", dessert: "Desserts", favoris: "Mes favoris" };
```

- [ ] **Step 2: Vérifier**

Ce fichier a maintenant deux consommateurs restants (`js/add-form.js` pour `CATEGORY_ICON`, `js/grid.js` pour `CATEGORY_LABELS`) — les deux continuent de fonctionner tels quels, aucune autre vérification possible avant les tâches suivantes (qui retirent les imports de `RECIPES`).

- [ ] **Step 3: Commit**

```bash
git add public/js/recipes-data.js
git commit -m "Remove built-in RECIPES array (now seeded in Supabase)"
```

---

### Task 3: Réécrire `js/recipes-store.js`

**Files:**
- Modify: `public/js/recipes-store.js`

**Interfaces:**
- Consumes: `loadCachedRecipes`, `pullRecipes`, `cacheRecipe`, `uncacheRecipe`, `recipeToRow` from `./sync.js` (Task 1); `render`, `renderHero` from `./grid.js` (Task 4 makes `renderHero` tolerate an empty `ALL_RECIPES`, but the function already exists today).
- Produces: `ALL_RECIPES` (array, mutable in place via `.push`/`.splice`, never reassigned), `initRecipesSync()`, `saveRecipe(recipe)`, `deleteRecipeRemote(id)`, `generateRecipeId(title)`, `saveFavorites()`, `toggleFavorite(id)` — consumed by `grid.js` (Task 4), `detail.js` (Task 5), `add-form.js` (Task 6), `main.js` (Task 8).

- [ ] **Step 1: Remplacer tout le fichier**

Remplacer l'intégralité du contenu de `public/js/recipes-store.js` par :

```js
import { supabase } from "./supabase-client.js";
import { loadCachedRecipes, pullRecipes, cacheRecipe, uncacheRecipe, recipeToRow } from "./sync.js";
import { state, detailView } from "./dom.js";
import { showToast } from "./ui.js";
import { render, renderHero } from "./grid.js";
import { syncDetailFavButton } from "./detail.js";

/* ---- recettes (partagées, synchronisées avec Supabase) ---- */
export const ALL_RECIPES = [];

export async function initRecipesSync(){
  try {
    const cached = await loadCachedRecipes();
    ALL_RECIPES.splice(0, ALL_RECIPES.length, ...cached);
  } catch {}
  if (ALL_RECIPES.length) { renderHero(); render(); }

  try {
    const fresh = await pullRecipes();
    ALL_RECIPES.splice(0, ALL_RECIPES.length, ...fresh);
  } catch {
    return;
  }
  renderHero();
  render();
}

export async function saveRecipe(recipe){
  const row = recipeToRow(recipe);
  const { error } = await supabase.from("recipes").upsert(row);
  if (error) throw error;
  const idx = ALL_RECIPES.findIndex(r => r.id === recipe.id);
  if (idx >= 0) ALL_RECIPES[idx] = recipe; else ALL_RECIPES.push(recipe);
  await cacheRecipe(recipe);
}

export async function deleteRecipeRemote(id){
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
  const idx = ALL_RECIPES.findIndex(r => r.id === id);
  if (idx >= 0) ALL_RECIPES.splice(idx, 1);
  await uncacheRecipe(id);
}

function slugify(str){
  const withoutAccents = str.toLowerCase().normalize("NFD")
    .split("").filter(ch => ch.codePointAt(0) < 0x300 || ch.codePointAt(0) > 0x36f).join("");
  return withoutAccents.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
export function generateRecipeId(title){
  const base = slugify(title) || "recette";
  let id = base, n = 2;
  while (ALL_RECIPES.some(r => r.id === id)) { id = `${base}-${n}`; n++; }
  return id;
}

/* ---- persistance des favoris (encore locale — synchronisée dans un lot ultérieur) ---- */
export function saveFavorites(){
  localStorage.setItem("carnet-favoris", JSON.stringify([...state.favorites]));
}
export function toggleFavorite(id){
  if (state.favorites.has(id)) { state.favorites.delete(id); showToast("Retiré des favoris"); }
  else { state.favorites.add(id); showToast("Ajouté aux favoris"); }
  saveFavorites();
  render();
  if (!detailView.hidden && detailView.classList.contains("is-open")) {
    syncDetailFavButton(id);
  }
}
```

Notez que `customRecipes`, `exportRecipes`, `importRecipesFromFile` n'existent plus dans ce fichier — ils seront retirés des autres fichiers qui les référencent aux tâches suivantes (Task 6, 7).

- [ ] **Step 2: Vérifier**

Ce fichier importe maintenant `renderHero` depuis `grid.js`, qui doit tolérer un `ALL_RECIPES` vide — c'est fait à la Task 4, donc ne pas encore tester ce fichier isolément ; les tâches suivantes complètent le câblage.

- [ ] **Step 3: Commit**

```bash
git add public/js/recipes-store.js
git commit -m "Rewrite recipes-store.js to sync recipes via Supabase"
```

---

### Task 4: Adapter `js/grid.js`

**Files:**
- Modify: `public/js/grid.js`

**Interfaces:**
- Consumes: `ALL_RECIPES` from `./recipes-store.js` (Task 3, désormais vide au démarrage puis peuplé par `initRecipesSync`).

- [ ] **Step 1: Retirer l'import de `RECIPES` et adapter `renderHero`**

Dans `public/js/grid.js`, remplacer :

```js
import { RECIPES, CATEGORY_LABELS } from "./recipes-data.js";
import { ICONS } from "./icons.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state } from "./dom.js";
import { ALL_RECIPES, toggleFavorite } from "./recipes-store.js";
import { applyCardPhoto } from "./photos.js";
import { openDetail } from "./detail.js";

/* ---- rendu du héros (recette du jour, fixe pour la démo) ---- */
export function renderHero(){
  const featured = RECIPES[0];
  heroSlot.innerHTML = `
```

par :

```js
import { CATEGORY_LABELS } from "./recipes-data.js";
import { ICONS } from "./icons.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state } from "./dom.js";
import { ALL_RECIPES, toggleFavorite } from "./recipes-store.js";
import { applyCardPhoto } from "./photos.js";
import { openDetail } from "./detail.js";

/* ---- rendu du héros (recette mise en avant) ---- */
export function renderHero(){
  const featured = ALL_RECIPES[0];
  if (!featured) { heroSlot.innerHTML = ""; return; }
  heroSlot.innerHTML = `
```

Le reste de `renderHero` (le template et l'écouteur de clic après) ne change pas.

- [ ] **Step 2: Vérifier**

`getFilteredRecipes`/`renderGrid`/`render` n'ont besoin d'aucun changement : ils lisent déjà `ALL_RECIPES` depuis `recipes-store.js`.

- [ ] **Step 3: Commit**

```bash
git add public/js/grid.js
git commit -m "grid.js: feature the first synced recipe instead of a hardcoded one"
```

---

### Task 5: Adapter `js/detail.js`

**Files:**
- Modify: `public/js/detail.js`

**Interfaces:**
- Consumes: `deleteRecipeRemote` from `./recipes-store.js` (Task 3), remplace l'usage de `customRecipes`/`saveCustomRecipes`.

- [ ] **Step 1: Mettre à jour les imports**

Remplacer :

```js
import { ALL_RECIPES, customRecipes, toggleFavorite, saveFavorites, saveCustomRecipes } from "./recipes-store.js";
```

par :

```js
import { ALL_RECIPES, toggleFavorite, saveFavorites, deleteRecipeRemote } from "./recipes-store.js";
```

- [ ] **Step 2: Supprimer la restriction `isCustom` dans `openDetail`**

Remplacer :

```js
export function openDetail(id){
  const r = ALL_RECIPES.find(x => x.id === id);
  if (!r) return;
  const isFav = state.favorites.has(r.id);
  const isCustom = customRecipes.some(cr => cr.id === r.id);
```

par :

```js
export function openDetail(id){
  const r = ALL_RECIPES.find(x => x.id === id);
  if (!r) return;
  const isFav = state.favorites.has(r.id);
```

Remplacer le bloc conditionnel des boutons modifier/supprimer :

```js
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
```

par :

```js
        <div class="detail-topbar-actions">
          <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
          <button class="detail-fav" id="detailDeleteBtn" type="button" aria-label="Supprimer la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="detail-fav has-cart-badge" id="detailCartBtn" type="button" aria-label="Ouvrir le panier de courses">
```

- [ ] **Step 3: Toujours attacher les écouteurs édition/suppression**

Remplacer :

```js
  if (isCustom) {
    detailScroll.querySelector("#detailEditBtn").addEventListener("click", () => goToEditRecipe(r));
    detailScroll.querySelector("#detailDeleteBtn").addEventListener("click", () => deleteRecipe(r.id));
  }
```

par :

```js
  detailScroll.querySelector("#detailEditBtn").addEventListener("click", () => goToEditRecipe(r));
  detailScroll.querySelector("#detailDeleteBtn").addEventListener("click", () => deleteRecipe(r.id));
```

- [ ] **Step 4: Réécrire `deleteRecipe` en async, via Supabase**

Remplacer :

```js
function deleteRecipe(id){
  if (!confirm("Supprimer définitivement cette recette ?")) return;
  const ci = customRecipes.findIndex(r => r.id === id);
  if (ci >= 0) customRecipes.splice(ci, 1);
  const ai = ALL_RECIPES.findIndex(r => r.id === id);
  if (ai >= 0) ALL_RECIPES.splice(ai, 1);
  saveCustomRecipes();
  state.favorites.delete(id);
  saveFavorites();
  removeRecipeFromCart(id);
  deleteAllPhotosForRecipe(id).catch(() => {});
  closeDetail();
  render();
  showToast("Recette supprimée");
}
```

par :

```js
async function deleteRecipe(id){
  if (!confirm("Supprimer définitivement cette recette ?")) return;
  try {
    await deleteRecipeRemote(id);
  } catch {
    showToast("Impossible de supprimer la recette. Vérifie ta connexion.");
    return;
  }
  state.favorites.delete(id);
  saveFavorites();
  removeRecipeFromCart(id);
  deleteAllPhotosForRecipe(id).catch(() => {});
  closeDetail();
  render();
  showToast("Recette supprimée");
}
```

- [ ] **Step 5: Vérifier**

Pas de vérification isolée possible (dépend de `add-form.js`, Task 6, pour créer une recette à tester) — la vérification complète se fait à la Task 10.

- [ ] **Step 6: Commit**

```bash
git add public/js/detail.js
git commit -m "detail.js: every recipe is editable/deletable, delete goes through Supabase"
```

---

### Task 6: Adapter `js/add-form.js`

**Files:**
- Modify: `public/js/add-form.js`

**Interfaces:**
- Consumes: `saveRecipe`, `generateRecipeId` from `./recipes-store.js` (Task 3), remplace `customRecipes`/`saveCustomRecipes`.

- [ ] **Step 1: Mettre à jour les imports**

Remplacer :

```js
import { customRecipes, ALL_RECIPES, saveCustomRecipes, generateRecipeId } from "./recipes-store.js";
```

par :

```js
import { saveRecipe, generateRecipeId } from "./recipes-store.js";
```

- [ ] **Step 2: Unifier ajout/modification via `saveRecipe`**

Remplacer tout le bloc depuis `const photoFile = ...` jusqu'à la fin du gestionnaire `submit` (juste avant le `});` qui le ferme) :

```js
    const photoFile = addForm.querySelector("#addPhoto").files[0];

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

    closeAddForm();
    showToast("Recette ajoutée");

    chips.forEach(c => c.classList.remove("is-active"));
    document.querySelector('.chip[data-filter="tout"]').classList.add("is-active");
    state.filter = "tout";
    state.query = "";
    searchInput.value = "";
    render();
  });
```

par :

```js
    const photoFile = addForm.querySelector("#addPhoto").files[0];
    const submitBtn = addForm.querySelector(".btn-primary");
    submitBtn.disabled = true;

    const recipe = {
      id: editingRecipe ? editingRecipe.id : generateRecipeId(title),
      title, category,
      icon: CATEGORY_ICON[category],
      desc, time, servings, difficulty, note,
      ingredients, steps, nutrition, allergens, utensils
    };

    try {
      await saveRecipe(recipe);
    } catch {
      submitBtn.disabled = false;
      addError.textContent = "Impossible d'enregistrer la recette. Vérifie ta connexion.";
      addError.hidden = false;
      return;
    }

    if (photoFile) await savePhoto(recipe.id, photoFile);
    for (let i = 0; i < stepPhotoFiles.length; i++) {
      if (stepPhotoFiles[i]) await saveStepPhoto(recipe.id, i, stepPhotoFiles[i]);
    }

    closeAddForm();

    if (editingRecipe) {
      showToast("Recette modifiée");
      openDetail(recipe.id);
      return;
    }

    showToast("Recette ajoutée");
    chips.forEach(c => c.classList.remove("is-active"));
    document.querySelector('.chip[data-filter="tout"]').classList.add("is-active");
    state.filter = "tout";
    state.query = "";
    searchInput.value = "";
    render();
  });
```

- [ ] **Step 3: Vérifier**

Pas de vérification isolée possible avant que le reste soit branché (Task 8) — vérification complète à la Task 10.

- [ ] **Step 4: Commit**

```bash
git add public/js/add-form.js
git commit -m "add-form.js: save recipes through Supabase, unify add/edit paths"
```

---

### Task 7: Retirer la fonctionnalité export/import

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/dom.js`
- Modify: `public/js/main.js`

**Interfaces:** aucune — retrait pur, pas de nouvelle interface.

- [ ] **Step 1: Retirer les boutons du tiroir dans `index.html`**

Dans `public/index.html`, remplacer :

```html
    <div class="drawer-divider"></div>
    <button class="drawer-item" id="navExportBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M12 3v13M7 11l5 5 5-5M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      Exporter mes recettes
    </button>
    <button class="drawer-item" id="navImportBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M12 16V3M7 8l5-5 5 5M5 20h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      Importer une sauvegarde
    </button>
    <input type="file" id="importFileInput" accept="application/json,.json" hidden>
    <div class="drawer-divider"></div>
    <button class="drawer-item" id="navLogoutBtn" type="button">
```

par :

```html
    <div class="drawer-divider"></div>
    <button class="drawer-item" id="navLogoutBtn" type="button">
```

- [ ] **Step 2: Retirer les exports dans `dom.js`**

Dans `public/js/dom.js`, supprimer ces trois lignes :

```js
export const navExportBtn = document.getElementById("navExportBtn");
export const navImportBtn = document.getElementById("navImportBtn");
```
et
```js
export const importFileInput = document.getElementById("importFileInput");
```

- [ ] **Step 3: Retirer le câblage dans `main.js`**

Dans `public/js/main.js`, dans le bloc d'import depuis `./dom.js`, remplacer :

```js
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navExportBtn, navImportBtn, importFileInput,
  navLogoutBtn, accountToggle,
```

par :

```js
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn,
  navLogoutBtn, accountToggle,
```

Retirer complètement l'import de `./recipes-store.js` pour `exportRecipes`/`importRecipesFromFile` :

```js
import { exportRecipes, importRecipesFromFile } from "./recipes-store.js";
```

Retirer les écouteurs associés :

```js
navExportBtn.addEventListener("click", () => { exportRecipes(); closeDrawer(); });
navImportBtn.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importRecipesFromFile(file);
  e.target.value = "";
  closeDrawer();
});
```

- [ ] **Step 4: Vérifier**

Lancer `lancer-le-carnet.bat`, ouvrir le tiroir de navigation (☰) : "Exporter mes recettes" et "Importer une sauvegarde" ne doivent plus apparaître, la liste va directement de "Ajouter une recette" à "Se déconnecter" (séparés par un seul trait). Aucune erreur dans la console.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/dom.js public/js/main.js
git commit -m "Remove export/import (redundant now that recipes sync via Supabase)"
```

---

### Task 8: Brancher `initRecipesSync()` dans `main.js`

**Files:**
- Modify: `public/js/main.js`

**Interfaces:**
- Consumes: `initRecipesSync` from `./recipes-store.js` (Task 3).

- [ ] **Step 1: Ajouter l'import et retirer `renderHero` (devenu inutile dans ce fichier)**

Dans `public/js/main.js`, remplacer :

```js
import { render, renderHero } from "./grid.js";
```

par :

```js
import { render } from "./grid.js";
```

(`render` reste utilisé par les écouteurs de recherche/filtres/favoris plus bas dans ce fichier — seul `renderHero` n'est plus appelé directement une fois cette tâche terminée.)

Puis ajouter une nouvelle ligne d'import juste après l'import de `./cart.js` :

```js
import { initRecipesSync } from "./recipes-store.js";
```

- [ ] **Step 2: Remplacer le démarrage**

Remplacer :

```js
/* ---- démarrage (attend une session valide) ---- */
initAuth(() => {
  renderHero();
  render();
  updateCartBadge();
  updateAccountBadge();
});
```

par :

```js
/* ---- démarrage (attend une session valide) ---- */
initAuth(() => {
  initRecipesSync();
  updateCartBadge();
  updateAccountBadge();
});
```

`renderHero`/`render` ne sont plus appelés directement ici — `initRecipesSync()` s'en charge lui-même une fois les données disponibles (cache local, puis données fraîches de Supabase).

- [ ] **Step 3: Vérifier dans le navigateur**

Lancer `lancer-le-carnet.bat`. Se connecter. Résultat attendu : la grille de recettes s'affiche (8 recettes au minimum), la recette du jour (héros) s'affiche. Recharger la page : même résultat, sans délai perceptible (chargement depuis le cache IndexedDB avant même que le réseau ait répondu). Aucune erreur console.

- [ ] **Step 4: Commit**

```bash
git add public/js/main.js
git commit -m "Wire initRecipesSync into app startup"
```

---

### Task 9: Mettre à jour le service worker

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Ajouter `js/sync.js` à `APP_SHELL` et incrémenter `CACHE_NAME`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v7";
```

par :

```js
const CACHE_NAME = "carnet-cache-v8";
```

Puis, dans `APP_SHELL`, remplacer :

```js
  "./js/auth.js",
  "./js/profile.js",
```

par :

```js
  "./js/auth.js",
  "./js/profile.js",
  "./js/sync.js",
```

- [ ] **Step 2: Vérifier**

Recharger deux fois (Ctrl+Maj+R) — vérifier dans DevTools → Application → Cache Storage que le nouveau cache contient `js/sync.js` et que l'ancien cache a disparu.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "Cache js/sync.js in service worker, bump cache version"
```

---

### Task 10: Vérification complète et push

**Files:** aucun.

- [ ] **Step 1: Parcours cross-compte**

Avec `lancer-le-carnet.bat` lancé, dans une fenêtre normale, se connecter avec le compte 1. Dans une fenêtre de navigation privée, se connecter avec le compte 2.

1. Compte 1 : ajouter une nouvelle recette (titre, catégorie, un ingrédient, une étape).
2. Compte 2 : recharger la page → la nouvelle recette doit apparaître dans la grille.
3. Compte 2 : ouvrir cette recette, cliquer "Modifier", changer le titre, enregistrer.
4. Compte 1 : recharger → le nouveau titre doit apparaître.
5. Compte 1 : ouvrir une des 8 recettes de base (ex. Ratatouille), confirmer que les boutons modifier/supprimer sont maintenant visibles (elles ne sont plus protégées).
6. Compte 2 : supprimer la recette créée à l'étape 1.
7. Compte 1 : recharger → la recette a disparu.

- [ ] **Step 2: Vérifier le mode hors-ligne (lecture)**

Compte 1, recharger la page une fois en ligne (pour peupler le cache), puis couper le réseau (DevTools → Network → Offline) et recharger. Résultat attendu : les recettes restent visibles (servies depuis le cache IndexedDB), la grille n'est pas vide.

- [ ] **Step 3: Vérifier qu'une écriture hors-ligne échoue proprement**

Toujours hors-ligne, essayer d'ajouter une recette. Résultat attendu : un message d'erreur s'affiche sur le formulaire ("Impossible d'enregistrer la recette. Vérifie ta connexion."), le formulaire reste ouvert (pas de perte des champs saisis), pas d'exception non gérée dans la console. (La mise en file d'attente hors-ligne est prévue pour B3 — ce comportement d'échec propre est le comportement attendu de ce plan.)

- [ ] **Step 4: Vérifier que favoris et panier restent inchangés**

Reconnecter le réseau. Ajouter un favori et un article au panier sur le compte 1 — confirmer que ce comportement fonctionne exactement comme avant ce plan (ces données restent locales, pas de changement attendu ici).

- [ ] **Step 5: Vérifier l'absence d'erreurs en console** sur l'ensemble du parcours ci-dessus.

- [ ] **Step 6: Push**

```bash
git push
```
