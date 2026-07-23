# Planning de repas — vue calendrier — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le mode "Planifier" éphémère (cases à cocher + ajout groupé, livré le 2026-07-22) par une vraie vue calendrier persistante : planifier une recette par jour/créneau (Midi/Soir), naviguer entre les semaines, et ajouter toute une semaine planifiée au panier en un clic.

**Architecture:** Nouvelle table Supabase `meal_plan` (une ligne par créneau rempli, propre à chaque compte comme le panier). Un nouveau module `public/js/meal-plan.js` porte à la fois la couche de données (chargement/sauvegarde d'une semaine, file d'attente hors ligne) et le rendu de la vue plein écran "Planning" (nouvelle entrée du tiroir de navigation, remplace le bouton "Planifier" retiré de l'en-tête). L'assignation d'une recette à un créneau vide ouvre un petit sélecteur de recherche interne à la vue (pas une nouvelle vue plein écran séparée). Cliquer sur un créneau déjà rempli ferme le Planning et ouvre la fiche recette normalement (même comportement que toutes les autres vues de l'app aujourd'hui — une seule vue plein écran ouverte à la fois).

**Tech Stack:** Vanilla JS (modules ES natifs, pas de bundler), Supabase (nouvelle table + RLS), aucun framework de test — vérification manuelle dans le navigateur.

## Global Constraints

- Zéro étape de build côté client, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Vraies dates, semaines navigables (Précédent/Suivant + bouton "Aujourd'hui"), semaine du lundi au dimanche.
- Deux créneaux nommés par jour : `midi` et `soir`.
- Le planning est propre à chaque compte (RLS `user_id = auth.uid()`, comme `cart_state`/`favorites`) — **pas** partagé entre comptes du foyer comme `recipes`.
- Synchronisé via Supabase, avec le même mécanisme de file d'attente hors ligne que le panier (`write-queue.js`), une clé de file distincte par créneau (`` `${date}:${slot}` ``) pour ne pas écraser des modifications concurrentes sur des créneaux différents.
- Cliquer sur un créneau rempli ferme la vue Planning et ouvre la fiche recette normalement (décision explicite de l'utilisateur : cohérent avec le fonctionnement actuel de toutes les autres vues de l'app — à retester après implémentation, et à revoir seulement si ça ne convainc pas en usage réel).
- Le mode "Planifier" éphémère (bouton `#planBtn`, barre `#planBar`, cases `.card-plan`) livré le 2026-07-22 est entièrement retiré. `addRecipesToCartBatch` dans `public/js/cart.js` est conservé et réutilisé.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur avant ce plan : `carnet-cache-v68`).
- Les fichiers du site sont dans `public/`.

---

### Task 1: Retirer l'ancien mode "Planifier"

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/dom.js`
- Modify: `public/js/grid.js`
- Modify: `public/js/main.js`
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- Ne touche pas à `public/js/cart.js` — `addRecipesToCartBatch` y reste exporté, inutilisé jusqu'à la Task 3 qui le réutilisera.
- Après cette task, plus aucune référence à `planBtn`/`planBar`/`planBarCount`/`planAddBtn`/`state.isPlanning`/`state.plannedRecipes`/`.card-plan` ne doit subsister dans le code.

- [ ] **Step 1: Retirer le bouton et la barre du HTML**

Dans `public/index.html`, remplacer :

```html
      <button id="planBtn" class="cart-toggle" type="button" aria-pressed="false" aria-label="Planifier des recettes">
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 6h9M9 12h9M9 18h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m4 6 1.5 1.5L8 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="m4 12 1.5 1.5L8 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="4" y="16" width="4" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
      </button>
      <button id="favToggle" class="fav-toggle" type="button" aria-pressed="false" aria-label="Favoris">
```

par :

```html
      <button id="favToggle" class="fav-toggle" type="button" aria-pressed="false" aria-label="Favoris">
```

Puis remplacer :

```html
</main>

<div class="plan-bar" id="planBar" hidden>
  <span id="planBarCount" aria-live="polite" aria-atomic="true">Aucune recette sélectionnée</span>
  <button class="btn-primary" id="planAddBtn" type="button" disabled>Ajouter au panier</button>
</div>

<!-- ===== FOND ASSOMBRI PARTAGÉ (fiche recette / ajout / panier / compte) ===== -->
```

par :

```html
</main>

<!-- ===== FOND ASSOMBRI PARTAGÉ (fiche recette / ajout / panier / compte) ===== -->
```

- [ ] **Step 2: Retirer l'état et les références DOM**

Dans `public/js/dom.js`, remplacer :

```js
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

par :

```js
export const allergenFilterList = document.getElementById("allergenFilterList");

/* ---- état de l'application ---- */
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]")),
  excludedAllergens: new Set(JSON.parse(localStorage.getItem("carnet-allergenes-exclus") || "[]"))
};
```

- [ ] **Step 3: Retirer les cases à cocher et la barre du rendu de la grille**

Dans `public/js/grid.js`, remplacer :

```js
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList, planBar, planBarCount, planAddBtn } from "./dom.js";
```

par :

```js
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList } from "./dom.js";
```

Puis remplacer :

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
```

par :

```js
/* ---- rendu de la grille ---- */
function renderGrid(){
```

Puis remplacer :

```js
    card.innerHTML = `
      <div class="card-photo">
        <span class="card-icon">${ICONS[r.icon]}</span>
        ${state.isPlanning ? planCheckboxHtml(r) : ""}
        <button class="card-fav" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris" data-favid="${r.id}">
```

par :

```js
    card.innerHTML = `
      <div class="card-photo">
        <span class="card-icon">${ICONS[r.icon]}</span>
        <button class="card-fav" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris" data-favid="${r.id}">
```

Puis remplacer :

```js
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
```

par :

```js
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
```

- [ ] **Step 4: Retirer le câblage dans `main.js`**

Dans `public/js/main.js`, remplacer :

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
import { render, renderAllergenFilterPanel } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal, addRecipesToCartBatch } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal, ALL_RECIPES } from "./recipes-store.js";
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
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
import { render, renderAllergenFilterPanel } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
```

Puis remplacer :

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

menuToggle.addEventListener("click", openDrawer);
```

par :

```js
addFab.addEventListener("click", () => openAddForm());
cartToggle.addEventListener("click", openPanier);

menuToggle.addEventListener("click", openDrawer);
```

- [ ] **Step 5: Retirer les styles devenus orphelins**

Dans `public/style.css`, repérer et supprimer entièrement la ligne :

```css
.cart-toggle[aria-pressed="true"]{ background: var(--emerald); color:#fff; border-color: var(--emerald); }
```

(Vérifier avant suppression qu'aucun autre élément que l'ancien `#planBtn` n'utilise `.cart-toggle` avec `aria-pressed` — ce n'est le cas ni de `#cartToggle` ni de `#allergenFilterToggle`, qui ne définissent jamais cet attribut dynamiquement.)

Puis remplacer :

```css
.card-fav[aria-pressed="true"]{ color: var(--terracotta-dark); }
.card-fav svg{ width:16px; height:16px; }
.card-plan{
  position:absolute; top:10px; left:10px; z-index:1;
  background: rgba(255,255,255,.92); border:none; color: var(--ink-faint); padding:8px;
  display:flex; border-radius: 999px;
  box-shadow: var(--shadow-raised);
  transition: color .15s ease;
}
.card-plan[aria-pressed="true"]{ color: var(--emerald-dark); }
.card-plan svg{ width:16px; height:16px; }

.card-body{ display:flex; flex-direction:column; gap:12px; padding:14px 16px 16px; }
```

par :

```css
.card-fav[aria-pressed="true"]{ color: var(--terracotta-dark); }
.card-fav svg{ width:16px; height:16px; }

.card-body{ display:flex; flex-direction:column; gap:12px; padding:14px 16px 16px; }
```

Puis remplacer :

```css
.fab:hover{ transform: translateY(-2px); background: var(--emerald-dark); }
.fab:active{ transform: scale(.94); }

.plan-bar{
  position:fixed; left:0; right:0; bottom:0; z-index:45;
  display:flex; align-items:center; justify-content:space-between; gap:16px;
  background: var(--surface); border-top:1px solid var(--line);
  padding: 14px 20px; box-shadow: var(--shadow-raised);
}
.plan-bar[hidden]{ display:none; }
#planBarCount{ font-size:.86rem; font-weight:600; color: var(--ink); }
#planAddBtn:disabled{ opacity:.4; cursor:not-allowed; }

body.is-planning{ padding-bottom: 90px; }

/* =========================================================
   VUE AJOUT — formulaire plein écran
```

par :

```css
.fab:hover{ transform: translateY(-2px); background: var(--emerald-dark); }
.fab:active{ transform: scale(.94); }

/* =========================================================
   VUE AJOUT — formulaire plein écran
```

Puis repérer et supprimer entièrement la ligne (près de `body.auth-locked .site-header, body.auth-locked #addFab{ display:none; }`) :

```css
body.is-planning #addFab{ display:none; }
```

- [ ] **Step 6: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v68";
```

par :

```js
const CACHE_NAME = "carnet-cache-v69";
```

- [ ] **Step 7: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois (cache-bust `style.css` si le navigateur sert une version en cache — voir les sessions précédentes de ce projet pour la technique : changer temporairement le `href` du `<link rel="stylesheet">` via la console avec un paramètre `?bust=`). DevTools → Application → Cache Storage doit montrer `carnet-cache-v69`. Aucune erreur console au chargement.

Testable **sans session authentifiée** :

```js
JSON.stringify({
  planBtnGone: document.getElementById('planBtn') === null,
  planBarGone: document.getElementById('planBar') === null,
  cartToggleStillThere: document.getElementById('cartToggle') !== null
});
```

- `planBtnGone === true`, `planBarGone === true`, `cartToggleStillThere === true`.

Puis injecter des recettes de test et vérifier que la grille se comporte normalement sans aucune trace de l'ancien mode :

```js
const domMod = await import('/js/dom.js');
const gridMod = await import('/js/grid.js');
const storeMod = await import('/js/recipes-store.js');
storeMod.ALL_RECIPES.push({ id: 't1', title: 'Test', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[], steps:[] });
gridMod.render();
JSON.stringify({
  cardCount: document.querySelectorAll('.recipe-card').length,
  cardPlanCount: document.querySelectorAll('.card-plan').length,
  stateHasIsPlanning: 'isPlanning' in domMod.state,
  stateHasPlannedRecipes: 'plannedRecipes' in domMod.state
});
```

- `cardCount === 1`, `cardPlanCount === 0`, `stateHasIsPlanning === false`, `stateHasPlannedRecipes === false`.

Aucune erreur console sur ce parcours.

- [ ] **Step 8: Commit**

```bash
git add public/index.html public/js/dom.js public/js/grid.js public/js/main.js public/style.css public/sw.js
git commit -m "Retirer l'ancien mode Planifier (remplace par le planning calendrier)"
```

---

### Task 2: Migration Supabase et couche de données `meal-plan.js`

**Files:**
- Modify: `supabase/schema.sql`
- Create: `public/js/meal-plan.js`
- Modify: `public/sw.js`

**Interfaces:**
- Produces (exportés depuis `public/js/meal-plan.js`, tous consommés par la Task 3) :
  - `DAY_NAMES` — tableau de 7 chaînes, `["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]`.
  - `getWeekStart(date: Date): Date` — pure, retourne le lundi 00:00 de la semaine contenant `date`.
  - `weekDates(weekStart: Date): Date[]` — pure, retourne les 7 `Date` de la semaine (lundi à dimanche).
  - `formatDateKey(date: Date): string` — pure, `"YYYY-MM-DD"`.
  - `formatWeekLabel(weekStart: Date): string` — pure, `"Semaine du 21 juillet"`.
  - `loadWeekPlan(weekStart: Date): Promise<void>` — charge la semaine depuis Supabase dans le cache interne du module (échoue silencieusement si hors ligne ou non connecté — le cache reste vide).
  - `getSlotRecipeId(dateKey: string, slot: "midi" | "soir"): string | null` — lit le cache interne (synchrone, pas d'appel réseau).
  - `setSlot(dateKey: string, slot: "midi" | "soir", recipeId: string): Promise<void>` — met à jour le cache interne immédiatement (synchrone en pratique malgré la signature `async`), puis synchronise vers Supabase (file d'attente hors ligne en cas d'échec).
  - `clearSlot(dateKey: string, slot: "midi" | "soir"): Promise<void>` — même principe, supprime l'entrée.

- [ ] **Step 1: Migration Supabase**

À la fin de `supabase/schema.sql`, ajouter :

```sql

-- ===== meal_plan : planning de repas, strictement personnel (un compte = un planning) =====
create table public.meal_plan (
  user_id uuid not null references auth.users(id),
  date date not null,
  slot text not null check (slot in ('midi', 'soir')),
  recipe_id text not null references public.recipes(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, date, slot)
);

alter table public.meal_plan enable row level security;

create policy "Users manage their own meal plan"
  on public.meal_plan for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

Note pour l'utilisateur (étape manuelle, hors de portée d'un subagent) : ce bloc SQL doit être exécuté dans le tableau de bord Supabase du projet : **SQL Editor** → **New query** → coller uniquement le nouveau bloc ci-dessus (pas tout le fichier) → **Run**. Résultat attendu : `Success. No rows returned`. Sans cette étape, la vue Planning (Task 3) ne pourra ni charger ni sauvegarder quoi que ce soit (toutes les requêtes échoueront silencieusement, les créneaux resteront vides).

- [ ] **Step 2: Créer `public/js/meal-plan.js` (couche de données)**

Créer `public/js/meal-plan.js` :

```js
import { supabase } from "./supabase-client.js";
import { enqueue, registerHandler } from "./write-queue.js";

/* ---- semaine : calculs de dates (fonctions pures, aucune dépendance à Supabase) ---- */
export const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function getWeekStart(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function weekDates(weekStart){
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function formatDateKey(date){
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatWeekLabel(weekStart){
  return `Semaine du ${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}`;
}

/* ---- chargement/sauvegarde d'une semaine (Supabase + file d'attente hors ligne) ---- */
let weekPlan = new Map(); // clé `${dateKey}:${slot}` -> recipeId

async function currentUserId(){
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

async function mealPlanWriteHandler(payload){
  if (payload.action === "clear") {
    const { error } = await supabase.from("meal_plan").delete()
      .eq("user_id", payload.userId).eq("date", payload.date).eq("slot", payload.slot);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("meal_plan").upsert({
      user_id: payload.userId, date: payload.date, slot: payload.slot,
      recipe_id: payload.recipeId, updated_at: new Date().toISOString()
    }, { onConflict: "user_id,date,slot" });
    if (error) throw error;
  }
}
registerHandler("meal_plan", mealPlanWriteHandler);

export async function loadWeekPlan(weekStart){
  weekPlan = new Map();
  const userId = await currentUserId();
  if (!userId) return;
  const dates = weekDates(weekStart).map(formatDateKey);
  try {
    const { data, error } = await supabase.from("meal_plan")
      .select("date, slot, recipe_id")
      .eq("user_id", userId)
      .gte("date", dates[0])
      .lte("date", dates[6]);
    if (error) throw error;
    (data || []).forEach(row => weekPlan.set(`${row.date}:${row.slot}`, row.recipe_id));
  } catch {
    /* hors ligne ou erreur réseau : la semaine s'affiche vide plutôt que de bloquer l'ouverture de la vue */
  }
}

export function getSlotRecipeId(dateKey, slot){
  return weekPlan.get(`${dateKey}:${slot}`) || null;
}

export async function setSlot(dateKey, slot, recipeId){
  weekPlan.set(`${dateKey}:${slot}`, recipeId);
  const userId = await currentUserId();
  if (!userId) return;
  const payload = { action: "set", userId, date: dateKey, slot, recipeId };
  mealPlanWriteHandler(payload).catch(() => enqueue("meal_plan", `${dateKey}:${slot}`, payload));
}

export async function clearSlot(dateKey, slot){
  weekPlan.delete(`${dateKey}:${slot}`);
  const userId = await currentUserId();
  if (!userId) return;
  const payload = { action: "clear", userId, date: dateKey, slot };
  mealPlanWriteHandler(payload).catch(() => enqueue("meal_plan", `${dateKey}:${slot}`, payload));
}
```

Notes pour l'implémenteur :
- `weekPlan` n'est volontairement PAS exporté — tout accès passe par `getSlotRecipeId`/`setSlot`/`clearSlot`, qui restent les seules fonctions à connaître la structure interne du cache. La Task 3 (rendu) n'importera jamais `weekPlan` directement.
- `setSlot`/`clearSlot` mettent à jour `weekPlan` **avant** toute tentative réseau — même hors ligne ou déconnecté, l'état en mémoire reflète immédiatement le changement (permet à la Task 3 de re-rendre la vue tout de suite sans attendre la confirmation réseau, exactement comme `cart.js` le fait pour le panier).
- Contrairement à `cart.js` (qui charge tout le panier une fois au démarrage de l'app via `initCartSync`), il n'y a **pas** d'équivalent `initMealPlanSync()` appelé au démarrage — `loadWeekPlan` n'est appelée qu'à l'ouverture de la vue Planning (Task 3) et à chaque changement de semaine affichée. C'est un choix délibéré : charger tout l'historique du planning au démarrage de l'app n'aurait aucun intérêt tant que la vue n'est pas ouverte.
- Ne pas confondre `formatDateKey` (clé technique `"2026-07-21"`, utilisée pour Supabase et les clés internes) avec `formatWeekLabel` (texte affiché à l'utilisateur, `"Semaine du 21 juillet"`) — la Task 3 utilise les deux mais pour des usages différents.

- [ ] **Step 3: Ajouter le fichier à la liste de cache du service worker**

Dans `public/sw.js`, remplacer :

```js
  "./js/import-url.js",
  "./js/photo-editor.js",
```

par :

```js
  "./js/import-url.js",
  "./js/meal-plan.js",
  "./js/photo-editor.js",
```

Puis remplacer :

```js
const CACHE_NAME = "carnet-cache-v69";
```

par :

```js
const CACHE_NAME = "carnet-cache-v70";
```

- [ ] **Step 4: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. Aucune erreur console (le fichier n'est encore importé par aucun autre module à ce stade — vérifier qu'il n'y a pas d'erreur de syntaxe en l'important manuellement).

Testable **entièrement sans session authentifiée**, en deux parties :

**1. Fonctions pures (dates) :**

```js
const mealPlanMod = await import('/js/meal-plan.js');

const monday = mealPlanMod.getWeekStart(new Date('2026-07-22')); // un mercredi
const sunday = mealPlanMod.getWeekStart(new Date('2026-07-26')); // un dimanche
const dates = mealPlanMod.weekDates(monday);

JSON.stringify({
  mondayFromWednesday: mealPlanMod.formatDateKey(monday),
  mondayFromSunday: mealPlanMod.formatDateKey(sunday),
  sameMonday: mealPlanMod.formatDateKey(monday) === mealPlanMod.formatDateKey(sunday),
  weekDatesCount: dates.length,
  firstDate: mealPlanMod.formatDateKey(dates[0]),
  lastDate: mealPlanMod.formatDateKey(dates[6]),
  label: mealPlanMod.formatWeekLabel(monday),
  dayNamesCount: mealPlanMod.DAY_NAMES.length
});
```

Résultats attendus :
- `mondayFromWednesday === "2026-07-20"` (le lundi de la semaine du mercredi 22 juillet 2026).
- `sameMonday === true` (le dimanche 26 juillet 2026 appartient à la même semaine que le mercredi 22 — même lundi de départ).
- `weekDatesCount === 7`, `firstDate === "2026-07-20"`, `lastDate === "2026-07-26"`.
- `label === "Semaine du 20 juillet"`.
- `dayNamesCount === 7`.

**2. Fonctions dépendantes de Supabase, appelées sans session (doivent échouer silencieusement, pas planter) :**

```js
await mealPlanMod.loadWeekPlan(monday);
await mealPlanMod.setSlot('2026-07-20', 'midi', 'un-id-quelconque');
await mealPlanMod.clearSlot('2026-07-20', 'midi');
const recipeId = mealPlanMod.getSlotRecipeId('2026-07-20', 'midi');
JSON.stringify({ noThrow: true, recipeIdAfterClear: recipeId });
```

- Le script s'exécute sans lever d'exception (`noThrow` s'affiche bien) — confirme que `currentUserId()` renvoyant `null` (pas de session) fait sortir `loadWeekPlan`/`setSlot`/`clearSlot` proprement via leurs gardes `if (!userId) return;`.
- `recipeIdAfterClear === null` (le cache interne a bien été mis à jour en mémoire indépendamment de l'absence de session : `setSlot` l'a rempli, `clearSlot` l'a vidé).

Aucune erreur console sur l'ensemble de ce parcours.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql public/js/meal-plan.js public/sw.js
git commit -m "Ajouter la table meal_plan et la couche de donnees du planning"
```

---

### Task 3: Vue Planning — rendu, navigation, sélecteur de recette, ajout au panier

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/dom.js`
- Modify: `public/js/main.js`
- Modify: `public/js/ui.js`
- Modify: `public/js/meal-plan.js`
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes : tout ce qu'exporte `public/js/meal-plan.js` depuis la Task 2 (`getWeekStart`, `weekDates`, `formatDateKey`, `formatWeekLabel`, `DAY_NAMES`, `loadWeekPlan`, `getSlotRecipeId`, `setSlot`, `clearSlot`) ; `ALL_RECIPES` de `public/js/recipes-store.js` ; `openDetail` de `public/js/detail.js` ; `addRecipesToCartBatch` de `public/js/cart.js` (déjà exporté depuis le plan du 2026-07-22, inchangé) ; `openDrawer`, `syncBodyScrollLock`, `openSheetBackdrop`, `closeSheetBackdrop`, `ensureSheetHistoryEntry`, `requestCloseSheet` de `public/js/ui.js`.
- Produces : `openMealPlan()` et `closeMealPlan()`, exportés depuis `public/js/meal-plan.js` — consommés par `public/js/ui.js` (`goToMealPlan`) dans ce même task.

- [ ] **Step 1: Nouvelle vue et entrée du tiroir de navigation dans le HTML**

Dans `public/index.html`, remplacer :

```html
<!-- ===== VUE IMPORT URL (saisie d'un lien pour pré-remplir une recette) ===== -->
<section id="importUrlView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="importUrlCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="importUrlScroll"></div>
</section>
```

par :

```html
<!-- ===== VUE IMPORT URL (saisie d'un lien pour pré-remplir une recette) ===== -->
<section id="importUrlView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="importUrlCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="importUrlScroll"></div>
</section>

<!-- ===== VUE PLANNING (calendrier de repas) ===== -->
<section id="mealPlanView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="mealPlanCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="mealPlanScroll"></div>
</section>
```

Puis remplacer :

```html
    <button class="drawer-item" id="navImportUrlBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg></span>
      Importer depuis une URL
    </button>
    <div class="drawer-divider"></div>
```

par :

```html
    <button class="drawer-item" id="navImportUrlBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg></span>
      Importer depuis une URL
    </button>
    <button class="drawer-item" id="navMealPlanBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
      Planning
    </button>
    <div class="drawer-divider"></div>
```

- [ ] **Step 2: Références DOM**

Dans `public/js/dom.js`, remplacer :

```js
export const importUrlCloseBtn = document.getElementById("importUrlCloseBtn");
export const navImportUrlBtn = document.getElementById("navImportUrlBtn");
```

par :

```js
export const importUrlCloseBtn = document.getElementById("importUrlCloseBtn");
export const navImportUrlBtn = document.getElementById("navImportUrlBtn");
export const mealPlanView = document.getElementById("mealPlanView");
export const mealPlanScroll = document.getElementById("mealPlanScroll");
export const mealPlanCloseBtn = document.getElementById("mealPlanCloseBtn");
export const navMealPlanBtn = document.getElementById("navMealPlanBtn");
```

- [ ] **Step 3: Câblage transversal dans `ui.js`**

Dans `public/js/ui.js`, remplacer :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView, photoEditorView, importUrlView } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { closeScanRecipe, openScanRecipe } from "./scan-recipe.js";
import { closeImportUrl, openImportUrl } from "./import-url.js";
import { closePhotoEditor } from "./photo-editor.js";
import { render } from "./grid.js";
```

par :

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

Puis remplacer :

```js
export function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || scanView.classList.contains("is-open")
    || importUrlView.classList.contains("is-open")
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
  closePhotoEditor();
}
```

Puis remplacer :

```js
export function goToImportUrl(){
  closeAllOverlays();
  closeDrawer();
  openImportUrl();
}
```

par :

```js
export function goToImportUrl(){
  closeAllOverlays();
  closeDrawer();
  openImportUrl();
}
export function goToMealPlan(){
  closeAllOverlays();
  closeDrawer();
  openMealPlan();
}
```

- [ ] **Step 4: Câblage dans `main.js`**

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
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn, navMealPlanBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, mealPlanView, sheetBackdrop,
  addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, mealPlanCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
```

Puis remplacer :

```js
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, goToImportUrl, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
```

par :

```js
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, goToImportUrl, goToMealPlan, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
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
  closePhotoEditor();
}
```

Puis remplacer :

```js
sheetBackdrop.addEventListener("click", requestCloseSheet);
addCloseBtn.addEventListener("click", requestCloseSheet);
panierCloseBtn.addEventListener("click", requestCloseSheet);
profileCloseBtn.addEventListener("click", requestCloseSheet);
scanCloseBtn.addEventListener("click", requestCloseSheet);
importUrlCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);
```

par :

```js
sheetBackdrop.addEventListener("click", requestCloseSheet);
addCloseBtn.addEventListener("click", requestCloseSheet);
panierCloseBtn.addEventListener("click", requestCloseSheet);
profileCloseBtn.addEventListener("click", requestCloseSheet);
scanCloseBtn.addEventListener("click", requestCloseSheet);
importUrlCloseBtn.addEventListener("click", requestCloseSheet);
mealPlanCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);
```

Puis remplacer :

```js
navScanBtn.addEventListener("click", goToScanRecipe);
navImportUrlBtn.addEventListener("click", goToImportUrl);
```

par :

```js
navScanBtn.addEventListener("click", goToScanRecipe);
navImportUrlBtn.addEventListener("click", goToImportUrl);
navMealPlanBtn.addEventListener("click", goToMealPlan);
```

- [ ] **Step 5: Rendu de la vue, navigation, sélecteur de recette, ajout au panier — ajouts dans `meal-plan.js`**

Dans `public/js/meal-plan.js`, remplacer :

```js
import { supabase } from "./supabase-client.js";
import { enqueue, registerHandler } from "./write-queue.js";
```

par :

```js
import { supabase } from "./supabase-client.js";
import { enqueue, registerHandler } from "./write-queue.js";
import { mealPlanView, mealPlanScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
import { ALL_RECIPES } from "./recipes-store.js";
import { openDetail } from "./detail.js";
import { addRecipesToCartBatch } from "./cart.js";
```

Puis, à la toute fin du fichier (après la fonction `clearSlot`), ajouter :

```js

/* ---- vue plein écran : rendu du calendrier ---- */
let currentWeekStart = getWeekStart(new Date());
let pickerContext = null; // { dateKey, slot } pendant qu'un sélecteur de recette est ouvert, sinon null

function slotHtml(dateKey, slot, label){
  const recipeId = getSlotRecipeId(dateKey, slot);
  const recipe = recipeId ? ALL_RECIPES.find(r => r.id === recipeId) : null;
  if (!recipe) {
    return `
      <div class="meal-plan-slot">
        <span class="meal-plan-slot-label">${label}</span>
        <button class="slot-add" type="button" data-date="${dateKey}" data-slot="${slot}">+ Ajouter</button>
      </div>
    `;
  }
  return `
    <div class="meal-plan-slot is-filled">
      <span class="meal-plan-slot-label">${label}</span>
      <button class="slot-recipe" type="button" data-date="${dateKey}" data-slot="${slot}" data-recipeid="${recipe.id}">${recipe.title}</button>
      <button class="slot-remove" type="button" data-date="${dateKey}" data-slot="${slot}" aria-label="Retirer">✕</button>
    </div>
  `;
}

function weekHasAnyFilledSlot(dates){
  return dates.some(d => {
    const dateKey = formatDateKey(d);
    return getSlotRecipeId(dateKey, "midi") || getSlotRecipeId(dateKey, "soir");
  });
}

async function renderMealPlan(){
  await loadWeekPlan(currentWeekStart);
  const dates = weekDates(currentWeekStart);

  mealPlanScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="mealPlanMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Planning</h2>
    </div>
    <div class="meal-plan-body">
      <div class="week-nav">
        <button id="weekPrevBtn" type="button" aria-label="Semaine précédente">‹</button>
        <span id="weekLabel">${formatWeekLabel(currentWeekStart)}</span>
        <button id="weekNextBtn" type="button" aria-label="Semaine suivante">›</button>
      </div>
      <button id="weekTodayBtn" class="btn-secondary" type="button">Aujourd'hui</button>
      <div class="meal-plan-days">
        ${dates.map(d => {
          const dateKey = formatDateKey(d);
          const dayName = DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1];
          return `
            <div class="meal-plan-day">
              <h3 class="meal-plan-day-title">${dayName} ${d.getDate()}</h3>
              <div class="meal-plan-slots">
                ${slotHtml(dateKey, "midi", "Midi")}
                ${slotHtml(dateKey, "soir", "Soir")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
      <button id="addWeekToCartBtn" class="btn-primary" type="button" ${weekHasAnyFilledSlot(dates) ? "" : "disabled"}>Ajouter la semaine au panier</button>
    </div>
  `;

  mealPlanScroll.querySelector("#mealPlanMenuBtn").addEventListener("click", openDrawer);
  mealPlanScroll.querySelector("#weekPrevBtn").addEventListener("click", () => changeWeek(-7));
  mealPlanScroll.querySelector("#weekNextBtn").addEventListener("click", () => changeWeek(7));
  mealPlanScroll.querySelector("#weekTodayBtn").addEventListener("click", () => {
    currentWeekStart = getWeekStart(new Date());
    renderMealPlan();
  });

  mealPlanScroll.querySelectorAll(".slot-add").forEach(btn => {
    btn.addEventListener("click", () => openRecipePicker(btn.dataset.date, btn.dataset.slot));
  });
  mealPlanScroll.querySelectorAll(".slot-remove").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await clearSlot(btn.dataset.date, btn.dataset.slot);
      renderMealPlan();
    });
  });
  mealPlanScroll.querySelectorAll(".slot-recipe").forEach(btn => {
    btn.addEventListener("click", () => {
      const recipeId = btn.dataset.recipeid;
      closeMealPlan();
      requestCloseSheet();
      openDetail(recipeId);
    });
  });

  const addWeekBtn = mealPlanScroll.querySelector("#addWeekToCartBtn");
  addWeekBtn.addEventListener("click", () => {
    const recipeIds = new Set();
    dates.forEach(d => {
      const dateKey = formatDateKey(d);
      ["midi", "soir"].forEach(slot => {
        const recipeId = getSlotRecipeId(dateKey, slot);
        if (recipeId) recipeIds.add(recipeId);
      });
    });
    const recipes = ALL_RECIPES.filter(r => recipeIds.has(r.id));
    if (!recipes.length) return;
    addRecipesToCartBatch(recipes);
  });
}

function changeWeek(offsetDays){
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() + offsetDays);
  currentWeekStart = getWeekStart(d);
  renderMealPlan();
}

/* ---- sélecteur de recette (assignation d'un créneau vide) ---- */
function renderRecipePickerList(query){
  const q = query.trim().toLowerCase();
  const list = ALL_RECIPES.filter(r => !q || r.title.toLowerCase().includes(q));
  const listEl = mealPlanScroll.querySelector("#recipePickerList");
  listEl.innerHTML = list.length
    ? list.map(r => `<button class="recipe-picker-item" type="button" data-recipeid="${r.id}">${r.title}</button>`).join("")
    : `<p class="empty-state">Aucune recette trouvée.</p>`;
  listEl.querySelectorAll(".recipe-picker-item").forEach(btn => {
    btn.addEventListener("click", async () => {
      await setSlot(pickerContext.dateKey, pickerContext.slot, btn.dataset.recipeid);
      closeRecipePicker();
      renderMealPlan();
    });
  });
}

function openRecipePicker(dateKey, slot){
  pickerContext = { dateKey, slot };
  mealPlanScroll.insertAdjacentHTML("beforeend", `
    <div class="recipe-picker-backdrop" id="recipePickerBackdrop"></div>
    <div class="recipe-picker" id="recipePicker">
      <div class="recipe-picker-head">
        <input type="text" id="recipePickerSearch" placeholder="Chercher une recette…" autocomplete="off">
        <button class="detail-close" id="recipePickerCloseBtn" type="button" aria-label="Fermer">✕</button>
      </div>
      <div class="recipe-picker-list" id="recipePickerList"></div>
    </div>
  `);
  renderRecipePickerList("");
  mealPlanScroll.querySelector("#recipePickerSearch").addEventListener("input", (e) => renderRecipePickerList(e.target.value));
  mealPlanScroll.querySelector("#recipePickerCloseBtn").addEventListener("click", closeRecipePicker);
  mealPlanScroll.querySelector("#recipePickerBackdrop").addEventListener("click", closeRecipePicker);
  mealPlanScroll.querySelector("#recipePickerSearch").focus();
}

function closeRecipePicker(){
  pickerContext = null;
  mealPlanScroll.querySelector("#recipePicker")?.remove();
  mealPlanScroll.querySelector("#recipePickerBackdrop")?.remove();
}

/* ---- ouverture/fermeture de la vue ---- */
export async function openMealPlan(){
  currentWeekStart = getWeekStart(new Date());
  await renderMealPlan();
  mealPlanView.classList.add("is-open");
  mealPlanView.setAttribute("aria-hidden", "false");
  mealPlanScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeMealPlan(){
  if (!mealPlanView.classList.contains("is-open")) return;
  mealPlanView.classList.remove("is-open");
  mealPlanView.setAttribute("aria-hidden", "true");
  closeRecipePicker();
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

Notes pour l'implémenteur :
- `openMealPlan` est `async` et attend la fin de `renderMealPlan()` (donc du chargement Supabase de la semaine) **avant** de rendre la vue visible (`classList.add("is-open")`) — évite un flash de contenu vide/périmé. Il n'y a volontairement pas d'indicateur de chargement pour cette première version (choix de simplicité assumé, à revoir seulement si la latence perçue pose problème en usage réel) ; `goToMealPlan` dans `ui.js` (Step 3) n'attend pas cette promesse (appel "fire-and-forget", comme le reste des fonctions `goToX`), ce qui est correct : le clic sur le bouton du tiroir ne doit pas bloquer.
- Cliquer sur une recette planifiée (`.slot-recipe`) appelle `closeMealPlan()` puis `requestCloseSheet()` puis `openDetail(recipeId)` — ferme la vue Planning et ouvre la fiche recette normalement, exactement comme n'importe quelle autre navigation dans cette app (une seule vue plein écran à la fois). Revenir en arrière depuis la fiche recette ramène à la grille principale, pas au Planning — c'est le comportement voulu (voir Global Constraints).
- Le sélecteur de recette (`openRecipePicker`/`closeRecipePicker`) est un panneau **interne à la vue Planning elle-même** (inséré/retiré directement dans `mealPlanScroll`), pas une nouvelle vue plein écran séparée — il n'utilise ni `sheetBackdrop`, ni `ensureSheetHistoryEntry`. Le bouton matériel "retour" d'Android fermera donc la vue Planning entière si le sélecteur est ouvert (pas juste le sélecteur) — limitation acceptée pour cette première version.
- `closeMealPlan()` appelle `closeRecipePicker()` pour éviter de laisser le sélecteur orphelin dans le DOM si l'utilisateur ferme le Planning pendant qu'il est ouvert.
- `weekHasAnyFilledSlot` désactive le bouton "Ajouter la semaine au panier" seulement quand **aucun** créneau de la semaine affichée n'est rempli — recalculé à chaque rendu de semaine.
- Le bouton d'ajout dédoublonne via un `Set` d'ids de recettes avant de filtrer `ALL_RECIPES` — si la même recette est planifiée deux fois dans la semaine (ex. midi ET soir un autre jour), elle n'est ajoutée qu'une seule fois au panier (pas de doublon, pas de toast comptant deux fois la même recette).

- [ ] **Step 6: Styles de la vue Planning**

Dans `public/style.css`, repérer la règle `.panier-body{ max-width:760px; margin:0 auto; padding: 12px 20px 100px; }` et ajouter juste après :

```css

.meal-plan-body{ max-width:760px; margin:0 auto; padding:12px 20px 100px; }
.week-nav{ display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:12px; }
.week-nav button{ background:none; border:none; font-size:1.4rem; color: var(--ink); cursor:pointer; padding:4px 10px; }
#weekLabel{ font-weight:700; font-size:1rem; min-width:170px; text-align:center; }
#weekTodayBtn{ display:block; margin:0 auto 20px; }

.meal-plan-days{ display:flex; flex-direction:column; gap:14px; margin-bottom:20px; }
.meal-plan-day{ background: var(--surface); border:1px solid var(--line); border-radius:6px; padding:12px 16px; }
.meal-plan-day-title{ font-size:.82rem; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color: var(--accent-dark); margin-bottom:10px; }
.meal-plan-slots{ display:flex; flex-direction:column; gap:8px; }
.meal-plan-slot{ display:flex; align-items:center; gap:10px; }
.meal-plan-slot-label{ flex:none; width:44px; font-size:.78rem; color: var(--ink-soft); font-weight:600; }
.slot-add{ flex:1; text-align:left; background: var(--bg); border:1px dashed var(--line); border-radius:6px; padding:8px 12px; color: var(--ink-faint); font-size:.86rem; }
.slot-recipe{ flex:1; min-width:0; text-align:left; background:none; border:none; padding:8px 0; color: var(--ink); font-weight:600; font-size:.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.slot-remove{ flex:none; background: var(--terracotta-tint); color: var(--terracotta-dark); border:none; border-radius:50%; width:26px; height:26px; font-size:.75rem; }

.recipe-picker-backdrop{ position:fixed; inset:0; background: rgba(0,0,0,.4); z-index:70; }
.recipe-picker{
  position:fixed; left:50%; bottom:0; transform: translateX(-50%);
  width:100%; max-width:500px; max-height:70vh;
  background: var(--bg); border-radius:16px 16px 0 0; z-index:71;
  display:flex; flex-direction:column; padding:16px;
}
.recipe-picker-head{ display:flex; align-items:center; gap:10px; margin-bottom:12px; }
#recipePickerSearch{ flex:1; padding:10px 14px; border:1px solid var(--line); border-radius:6px; font-size:.9rem; }
.recipe-picker-list{ overflow-y:auto; display:flex; flex-direction:column; gap:2px; }
.recipe-picker-item{ text-align:left; background:none; border:none; padding:10px 8px; border-radius:6px; font-size:.9rem; color: var(--ink); width:100%; }
.recipe-picker-item:hover{ background: var(--surface); }
```

Note pour l'implémenteur : `.slot-recipe` a `min-width:0` explicitement — c'est un item flex (`.meal-plan-slot{ display:flex; }`) qui doit pouvoir rétrécir en dessous de la largeur de son contenu pour que `text-overflow:ellipsis` fonctionne sur un titre de recette long (un item flex a `min-width:auto` par défaut, qui bloque l'ellipse — piège déjà rencontré et corrigé ailleurs dans ce projet le 2026-07-22, voir la liste d'ingrédients de la fiche recette).

- [ ] **Step 7: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v70";
```

par :

```js
const CACHE_NAME = "carnet-cache-v71";
```

- [ ] **Step 8: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v71`. Aucune erreur console au chargement.

Cette vue dépend d'une session Supabase authentifiée pour son chargement/sauvegarde réels — non disponible dans cet environnement. Cependant, l'essentiel du comportement (rendu, navigation, assignation, retrait, ajout au panier) fonctionne **entièrement en mémoire** même sans session, car `setSlot`/`clearSlot` mettent à jour le cache interne `weekPlan` avant toute tentative réseau (voir Task 2). Vérifier ainsi :

```js
const domMod = await import('/js/dom.js');
const storeMod = await import('/js/recipes-store.js');
const cartMod = await import('/js/cart.js');
const uiMod = await import('/js/ui.js');

storeMod.ALL_RECIPES.push(
  { id: 'lasagnes', title: 'Lasagnes maison', category:'plat', desc:'', time:40, servings:4, difficulty:'Facile', icon:'plat', ingredients:[['Pâtes à lasagne','12 pièce(s)']], steps:[] },
  { id: 'salade', title: 'Salade de saison', category:'entrée', desc:'', time:10, servings:2, difficulty:'Facile', icon:'entrée', ingredients:[['Salade','1 pièce(s)']], steps:[] }
);

uiMod.goToMealPlan();
await new Promise(r => setTimeout(r, 50)); // openMealPlan est async (attend loadWeekPlan)

const openedOk = domMod.mealPlanView.classList.contains('is-open');
const weekLabelText = document.getElementById('weekLabel').textContent;
const slotAddCountBefore = document.querySelectorAll('.slot-add').length;

document.querySelector('.slot-add').click(); // ouvre le sélecteur sur le premier créneau vide (lundi midi)
const pickerOpen = document.getElementById('recipePicker') !== null;
document.getElementById('recipePickerSearch').value = 'lasagnes';
document.getElementById('recipePickerSearch').dispatchEvent(new Event('input'));
await new Promise(r => setTimeout(r, 10));
const filteredCount = document.querySelectorAll('.recipe-picker-item').length;
document.querySelector('.recipe-picker-item[data-recipeid="lasagnes"]').click();
await new Promise(r => setTimeout(r, 50));

const slotFilledCount = document.querySelectorAll('.slot-recipe').length;
const addWeekBtnEnabled = !document.getElementById('addWeekToCartBtn').disabled;

document.getElementById('addWeekToCartBtn').click();
const cartAfterAdd = cartMod.cart.map(e => e.recipeId);

document.querySelector('.slot-remove').click();
await new Promise(r => setTimeout(r, 50));
const slotFilledCountAfterRemove = document.querySelectorAll('.slot-recipe').length;

console.log({
  openedOk, weekLabelText, slotAddCountBefore,
  pickerOpen, filteredCount,
  slotFilledCount, addWeekBtnEnabled,
  cartAfterAdd, slotFilledCountAfterRemove
});
```

Résultats attendus :
- `openedOk === true`, `weekLabelText` commence par `"Semaine du "`, `slotAddCountBefore === 14` (7 jours × 2 créneaux, tous vides au départ).
- `pickerOpen === true`, `filteredCount === 1` (recherche "lasagnes" ne retrouve que "Lasagnes maison").
- `slotFilledCount === 1` (le créneau lundi midi affiche maintenant la recette assignée, le sélecteur s'est refermé).
- `addWeekBtnEnabled === true` (au moins un créneau rempli active le bouton).
- `cartAfterAdd` contient `'lasagnes'`.
- `slotFilledCountAfterRemove === 0` (après avoir cliqué "Retirer" sur ce créneau).

Vérifier aussi manuellement (capture d'écran ou lecture de la structure) : les flèches `#weekPrevBtn`/`#weekNextBtn` changent bien `#weekLabel` et redessinent les 7 jours (semaine différente, tous les créneaux vides puisqu'aucune donnée n'a été chargée pour ces autres semaines dans cet environnement sans session). Le bouton `#weekTodayBtn` revient à la semaine de départ.

Aucune erreur console sur l'ensemble de ce parcours. Signaler en DONE_WITH_CONCERNS le fait que le chargement/sauvegarde réels via Supabase (avec une vraie session) n'ont pas pu être testés dans cet environnement — ce sera la première vérification manuelle de l'utilisateur après avoir exécuté la migration de la Task 2.

- [ ] **Step 9: Commit**

```bash
git add public/index.html public/js/dom.js public/js/main.js public/js/ui.js public/js/meal-plan.js public/style.css public/sw.js
git commit -m "Ajouter la vue Planning (calendrier, selecteur de recette, ajout au panier)"
```
