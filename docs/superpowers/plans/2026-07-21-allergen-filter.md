# Filtre par allergène — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le champ "Allergènes" en texte libre par une liste fixe de 14 allergènes à cocher, et ajouter un bouton "Filtres" qui masque les recettes contenant les allergènes sélectionnés.

**Architecture:** Une liste statique `ALLERGENS` (clé + libellé) dans `public/js/recipes-data.js` sert de source unique pour le formulaire d'édition (cases à cocher), l'affichage sur la fiche recette (libellés), et le panneau de filtre. La colonne Supabase `allergens` passe de `text` à `jsonb` pour stocker un tableau de clés (comme `ingredients`/`steps`/`utensils` déjà). Le filtre lui-même est un nouvel état `state.excludedAllergens` (un `Set`, persistant en `localStorage`) consommé par `getFilteredRecipes()` dans `public/js/grid.js`.

**Tech Stack:** Supabase Postgres (colonne jsonb), localStorage, aucun framework de build/test.

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v45`).
- Le texte libre déjà saisi dans les recettes existantes n'est **pas** reconverti automatiquement — la migration réinitialise ce champ à vide pour toutes les recettes actuelles (décision validée avec l'utilisateur).
- Les 14 allergènes (clé technique → libellé) :
  `gluten` → Gluten, `crustaces` → Crustacés, `oeufs` → Œufs, `poisson` → Poisson, `arachides` → Arachides, `soja` → Soja, `lait` → Lait, `fruits-a-coque` → Fruits à coque, `celeri` → Céleri, `moutarde` → Moutarde, `sesame` → Sésame, `sulfites` → Sulfites, `lupin` → Lupin, `mollusques` → Mollusques.
- Le filtre exclut (masque), il ne montre jamais que les recettes contenant un allergène.
- La sélection du filtre est persistée en `localStorage`, pas synchronisée entre comptes/appareils (contrairement aux favoris).
- Les fichiers du site sont dans `public/`.

---

### Task 1: Liste ALLERGENS, migration Supabase, cases à cocher dans le formulaire

**Files:**
- Modify: `public/js/recipes-data.js`
- Modify: `public/js/add-form.js`
- Modify: `public/style.css`
- Modify: `supabase/schema.sql`
- Modify: `public/sw.js`

**Interfaces:**
- Produces: `ALLERGENS` (tableau de `{ key, label }`), exporté depuis `public/js/recipes-data.js` — consommé par Task 1 (ce fichier), Task 2 (`detail.js`) et Task 3 (`grid.js`).
- Le format de `recipe.allergens` passe de `string | undefined` à `string[] | undefined` (tableau de clés). Consommé par Task 2 et Task 3.

- [x] **Step 1: Ajouter la liste ALLERGENS**

Dans `public/js/recipes-data.js`, remplacer :

```js
/* ---- données des recettes intégrées ---- */
export const CATEGORY_ICON = { "entrée": "bowl", plat: "pot", dessert: "tart" };
export const CATEGORY_LABELS = { tout: "Toutes les recettes", "entrée": "Entrées", plat: "Plats", dessert: "Desserts", favoris: "Mes favoris" };
```

par :

```js
/* ---- données des recettes intégrées ---- */
export const CATEGORY_ICON = { "entrée": "bowl", plat: "pot", dessert: "tart" };
export const CATEGORY_LABELS = { tout: "Toutes les recettes", "entrée": "Entrées", plat: "Plats", dessert: "Desserts", favoris: "Mes favoris" };

export const ALLERGENS = [
  { key: "gluten", label: "Gluten" },
  { key: "crustaces", label: "Crustacés" },
  { key: "oeufs", label: "Œufs" },
  { key: "poisson", label: "Poisson" },
  { key: "arachides", label: "Arachides" },
  { key: "soja", label: "Soja" },
  { key: "lait", label: "Lait" },
  { key: "fruits-a-coque", label: "Fruits à coque" },
  { key: "celeri", label: "Céleri" },
  { key: "moutarde", label: "Moutarde" },
  { key: "sesame", label: "Sésame" },
  { key: "sulfites", label: "Sulfites" },
  { key: "lupin", label: "Lupin" },
  { key: "mollusques", label: "Mollusques" }
];
```

- [x] **Step 2: Migration Supabase (colonne `allergens` en `jsonb`)**

Dans `supabase/schema.sql`, remplacer :

```sql
  nutrition jsonb,
  allergens text,
  utensils jsonb,
```

par :

```sql
  nutrition jsonb,
  allergens jsonb,
  utensils jsonb,
```

Puis, à la toute fin du fichier, ajouter :

```sql

-- ===== Migration : allergens passe de texte libre à une liste fixe (jsonb) =====
-- Réinitialise le champ à vide pour les recettes existantes (le texte libre
-- n'est pas reconvertible en clés fixes) — décision validée avec l'utilisateur.
alter table public.recipes alter column allergens type jsonb using '[]'::jsonb;
```

Note pour l'utilisateur (étape manuelle, hors de portée d'un subagent) : ce bloc SQL doit être exécuté dans le tableau de bord Supabase du projet : **SQL Editor** → **New query** → coller uniquement le nouveau bloc ci-dessus (pas tout le fichier) → **Run**. Résultat attendu : `Success. No rows returned`. Sans cette étape, l'application plantera à la sauvegarde d'une recette (la colonne reste de type `text` côté serveur alors que le client envoie désormais un tableau).

- [x] **Step 3: Remplacer le champ texte par des cases à cocher dans le formulaire**

Dans `public/js/add-form.js`, remplacer :

```js
import { CATEGORY_ICON } from "./recipes-data.js";
```

par :

```js
import { CATEGORY_ICON, ALLERGENS } from "./recipes-data.js";
```

Puis remplacer :

```js
      <div class="field">
        <label for="addAllergens">Allergènes (optionnel)</label>
        <input id="addAllergens" type="text" placeholder="Ex. Gluten, blé, lait" value="${escapeAttr(data?.allergens || "")}">
      </div>
```

par :

```js
      <div class="field">
        <label>Allergènes (optionnel)</label>
        <div class="allergen-checks" id="addAllergenChecks">
          ${ALLERGENS.map(a => `
            <label class="allergen-check">
              <input type="checkbox" value="${a.key}" ${data?.allergens?.includes(a.key) ? "checked" : ""}>
              ${a.label}
            </label>
          `).join("")}
        </div>
      </div>
```

- [x] **Step 4: Lire les cases cochées à la soumission**

Dans `public/js/add-form.js`, remplacer :

```js
    const allergens = addForm.querySelector("#addAllergens").value.trim() || undefined;
```

par :

```js
    const allergensChecked = [...addForm.querySelectorAll("#addAllergenChecks input:checked")].map(cb => cb.value);
    const allergens = allergensChecked.length ? allergensChecked : undefined;
```

- [x] **Step 5: Styles des cases à cocher**

Dans `public/style.css`, repérer la règle `.add-error{` et ajouter juste avant :

```css
.allergen-checks{ display:flex; flex-wrap:wrap; gap:8px 18px; }
.allergen-check{ display:flex; align-items:center; gap:6px; font-size:.86rem; color: var(--ink); }

```

- [x] **Step 6: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v45";
```

par :

```js
const CACHE_NAME = "carnet-cache-v46";
```

- [x] **Step 7: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois. Aucune erreur console. DevTools → Application → Cache Storage doit montrer `carnet-cache-v46`.

`ALLERGENS` est testable en console sans être connecté :

```js
const mod = await import('/js/recipes-data.js');
console.log(mod.ALLERGENS.length, mod.ALLERGENS[0]);
```

- `mod.ALLERGENS.length === 14`, `mod.ALLERGENS[0]` vaut `{ key: "gluten", label: "Gluten" }`.

Le formulaire d'ajout/édition est derrière l'écran de connexion — si une session authentifiée est disponible : ouvrir "Nouvelle recette", vérifier que le champ "Allergènes" affiche 14 cases à cocher (pas un champ texte) ; en cocher 2-3, enregistrer une recette de test, rouvrir son édition → les mêmes cases sont cochées. Si aucune session n'est disponible dans cet environnement, relecture statique attentive du diff et le signaler dans le rapport (DONE_WITH_CONCERNS) plutôt que de bloquer sur cette étape.

- [x] **Step 8: Commit**

```bash
git add public/js/recipes-data.js public/js/add-form.js public/style.css supabase/schema.sql public/sw.js
git commit -m "Remplacer le champ allergenes en texte libre par une liste fixe a cocher"
```

---

### Task 2: Affichage sur la fiche recette, retrait de l'allergène extrait par le scan

**Files:**
- Modify: `public/js/detail.js`
- Modify: `public/js/scan-recipe.js`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `ALLERGENS` de `public/js/recipes-data.js` (Task 1).

- [x] **Step 1: Afficher les libellés des allergènes cochés**

Dans `public/js/detail.js`, remplacer :

```js
import { ING_ICON } from "./icons.js";
```

par :

```js
import { ING_ICON } from "./icons.js";
import { ALLERGENS } from "./recipes-data.js";
```

Puis remplacer :

```js
      ${r.allergens ? `<p class="allergen-line"><b>Allergènes :</b> ${r.allergens}</p>` : ""}
```

par :

```js
      ${r.allergens && r.allergens.length ? `<p class="allergen-line"><b>Allergènes :</b> ${r.allergens.map(key => ALLERGENS.find(a => a.key === key)?.label || key).join(", ")}</p>` : ""}
```

Note pour l'implémenteur : `?.label || key` protège l'affichage même si une ancienne valeur ne correspond à aucune clé connue (ne devrait plus arriver après la migration de la Task 1, mais évite un `undefined` affiché si jamais).

- [x] **Step 2: Retirer l'allergène extrait par l'IA du scan**

Dans `public/js/scan-recipe.js`, repérer la fonction `sanitizeExtractedRecipe` et remplacer :

```js
  return {
    title: typeof raw?.title === "string" ? raw.title : "",
    category, difficulty,
    desc: typeof raw?.desc === "string" ? raw.desc : "",
    time: typeof raw?.time === "number" ? raw.time : undefined,
    servings: typeof raw?.servings === "number" ? raw.servings : undefined,
    nutrition,
    allergens: typeof raw?.allergens === "string" ? raw.allergens : undefined,
    ingredients, utensils, steps,
    photoBlob
  };
```

par :

```js
  return {
    title: typeof raw?.title === "string" ? raw.title : "",
    category, difficulty,
    desc: typeof raw?.desc === "string" ? raw.desc : "",
    time: typeof raw?.time === "number" ? raw.time : undefined,
    servings: typeof raw?.servings === "number" ? raw.servings : undefined,
    nutrition,
    ingredients, utensils, steps,
    photoBlob
  };
```

Note pour l'implémenteur : le texte libre extrait par l'IA (`raw.allergens`, une chaîne) n'est plus compatible avec le nouveau format en tableau de clés fixes — on ne tente pas de le faire correspondre automatiquement (hors scope, voir le design). Le formulaire pré-rempli après un scan n'aura donc aucune case pré-cochée ; c'est le comportement attendu, pas une régression.

- [x] **Step 3: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v46";
```

par :

```js
const CACHE_NAME = "carnet-cache-v47";
```

- [x] **Step 4: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v47`. Aucune erreur console au chargement.

Vérifier l'affichage sans être connecté, en testant `ingredientRowHtml`-like logique directement — comme `detail.js` dépend de `ALL_RECIPES`/`state` réels, le test le plus simple sans session est une relecture statique du diff (le mapping clé → libellé est une simple fonction pure, déjà couverte par le test de Task 1 sur `ALLERGENS`).

Si une session authentifiée est disponible : ouvrir une recette dont l'édition (Task 1) a coché des allergènes → la fiche recette affiche la ligne "Allergènes :" avec les libellés en français, pas les clés techniques (ex. "Gluten, Lait", pas "gluten, lait"). Scanner une recette (si la fonctionnalité de scan est testable dans cet environnement) → le formulaire pré-rempli n'a aucune case allergène cochée.

Si aucune session n'est disponible, relecture statique attentive du diff et le signaler dans le rapport (DONE_WITH_CONCERNS) plutôt que de bloquer sur cette étape.

- [x] **Step 5: Commit**

```bash
git add public/js/detail.js public/js/scan-recipe.js public/sw.js
git commit -m "Afficher les libelles d'allergenes sur la fiche recette, retirer l'allergene du scan IA"
```

---

### Task 3: Bouton "Filtres" et panneau d'exclusion

**Files:**
- Modify: `public/js/dom.js`
- Modify: `public/index.html`
- Modify: `public/js/grid.js`
- Modify: `public/js/main.js`
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `ALLERGENS` de `public/js/recipes-data.js` (Task 1).
- Produces: `renderAllergenFilterPanel()`, exporté depuis `public/js/grid.js` — consommé par `public/js/main.js` (appelé une fois au démarrage, la liste des 14 allergènes ne dépendant pas des données de recettes).
- `state.excludedAllergens` (nouveau, un `Set<string>`) dans `public/js/dom.js`.

- [x] **Step 1: Nouvel état persistant et éléments du DOM**

Dans `public/js/dom.js`, remplacer :

```js
export const brandHomeBtn = document.getElementById("brandHomeBtn");

/* ---- état de l'application ---- */
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]"))
};
```

par :

```js
export const brandHomeBtn = document.getElementById("brandHomeBtn");
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

- [x] **Step 2: Bouton et panneau dans le HTML**

Dans `public/index.html`, remplacer :

```html
  <div class="search-row">
    <label class="search-box" for="searchInput">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.8-4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <input id="searchInput" type="text" placeholder="Chercher une recette, un ingrédient…" autocomplete="off">
    </label>
  </div>
```

par :

```html
  <div class="search-row">
    <label class="search-box" for="searchInput">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-4.8-4.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <input id="searchInput" type="text" placeholder="Chercher une recette, un ingrédient…" autocomplete="off">
    </label>
    <button id="allergenFilterToggle" class="cart-toggle" type="button" aria-label="Filtrer par allergène">
      <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 5h16M7 12h10M10 19h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span id="allergenFilterBadge" class="cart-badge" hidden>0</span>
    </button>
    <div class="allergen-filter-panel" id="allergenFilterPanel" hidden>
      <div class="allergen-filter-list" id="allergenFilterList"></div>
    </div>
  </div>
```

Note pour l'implémenteur : la classe `cart-toggle`/`cart-badge` (déjà stylée pour le bouton panier) est réutilisée telle quelle pour le bouton et son badge — même apparence de bouton rond avec pastille, pas besoin de nouvelles règles CSS pour ça.

- [x] **Step 3: Panneau et filtrage dans `grid.js`**

Dans `public/js/grid.js`, remplacer :

```js
import { CATEGORY_LABELS } from "./recipes-data.js";
import { ICONS } from "./icons.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state } from "./dom.js";
```

par :

```js
import { CATEGORY_LABELS, ALLERGENS } from "./recipes-data.js";
import { ICONS } from "./icons.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList } from "./dom.js";
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
    if (!q) return true;
    const haystack = (r.title + " " + r.desc + " " + r.ingredients.map(i => i[0]).join(" ")).toLowerCase();
    return haystack.includes(q);
  });
}

/* ---- panneau de filtre par allergène ---- */
function updateAllergenFilterBadge(){
  const count = state.excludedAllergens.size;
  allergenFilterBadge.textContent = count;
  allergenFilterBadge.hidden = count === 0;
}

export function renderAllergenFilterPanel(){
  allergenFilterList.innerHTML = ALLERGENS.map(a => `
    <label class="allergen-filter-item">
      <input type="checkbox" value="${a.key}" ${state.excludedAllergens.has(a.key) ? "checked" : ""}>
      ${a.label}
    </label>
  `).join("");
  allergenFilterList.querySelectorAll("input").forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) state.excludedAllergens.add(cb.value);
      else state.excludedAllergens.delete(cb.value);
      localStorage.setItem("carnet-allergenes-exclus", JSON.stringify([...state.excludedAllergens]));
      updateAllergenFilterBadge();
      render();
    });
  });
  updateAllergenFilterBadge();
}
```

Notes pour l'implémenteur :
- `r.allergens?.some(...)` gère le cas où `allergens` est `undefined` (recette sans allergène renseigné) sans lever d'erreur — cette recette n'est jamais exclue par ce filtre, conforme au design.
- `renderAllergenFilterPanel()` ne dépend d'aucune donnée de recette (seulement de `ALLERGENS`, une liste statique, et de `state.excludedAllergens`) — elle peut donc être appelée une seule fois au démarrage de l'app, indépendamment du chargement des recettes (câblée dans `main.js` au Step 4 ci-dessous).

- [x] **Step 4: Ouvrir/fermer le panneau, l'initialiser au démarrage**

Dans `public/js/main.js`, remplacer :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, brandHomeBtn
} from "./dom.js";
import { render } from "./grid.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
import { render, renderAllergenFilterPanel } from "./grid.js";
```

Puis, juste après le bloc :

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

ajouter :

```js
renderAllergenFilterPanel();
allergenFilterToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  allergenFilterPanel.hidden = !allergenFilterPanel.hidden;
});
document.addEventListener("click", (e) => {
  if (allergenFilterPanel.hidden) return;
  if (allergenFilterPanel.contains(e.target) || allergenFilterToggle.contains(e.target)) return;
  allergenFilterPanel.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !allergenFilterPanel.hidden) allergenFilterPanel.hidden = true;
});
```

- [x] **Step 5: Styles de la rangée de recherche et du panneau**

Dans `public/style.css`, remplacer :

```css
.search-row{ max-width:1080px; margin: 16px auto 0; }
.search-box{
  display:flex; align-items:center; gap:10px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 12px 16px;
  color: var(--ink-faint);
  transition: border-color .15s ease;
}
```

par :

```css
.search-row{ max-width:1080px; margin: 16px auto 0; display:flex; gap:10px; align-items:flex-start; position:relative; }
.search-box{
  flex:1; min-width:0;
  display:flex; align-items:center; gap:10px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 12px 16px;
  color: var(--ink-faint);
  transition: border-color .15s ease;
}
```

Puis, dans le même fichier, repérer la règle `.chip-row{` et ajouter juste avant :

```css
.allergen-filter-panel{
  position:absolute; top:48px; right:0; z-index:5;
  background: var(--surface); border:1px solid var(--line); border-radius:10px;
  box-shadow: var(--shadow-raised); padding:14px; width:230px; max-height:320px; overflow-y:auto;
}
.allergen-filter-panel[hidden]{ display:none; }
.allergen-filter-list{ display:flex; flex-direction:column; gap:4px; }
.allergen-filter-item{ display:flex; align-items:center; gap:8px; padding:6px 4px; font-size:.86rem; color: var(--ink); border-radius:6px; }
.allergen-filter-item:hover{ background: var(--bg); }

```

- [x] **Step 6: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v47";
```

par :

```js
const CACHE_NAME = "carnet-cache-v48";
```

- [x] **Step 7: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v48`. Aucune erreur console au chargement — le bouton "Filtres" et son panneau (vide de recettes, mais avec les 14 cases) doivent apparaître même sans être connecté, puisque `renderAllergenFilterPanel()` ne dépend pas des données de recettes.

Cette tâche est en grande partie testable **sans session authentifiée**, en manipulant directement l'état :

```js
const domMod = await import('/js/dom.js');
const gridMod = await import('/js/grid.js');
const storeMod = await import('/js/recipes-store.js');

storeMod.ALL_RECIPES.push(
  { id: 'sans-gluten', title: 'Sans gluten', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[], steps:[], allergens: ['lait'] },
  { id: 'avec-gluten', title: 'Avec gluten', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[], steps:[], allergens: ['gluten', 'lait'] },
  { id: 'sans-allergene', title: 'Neutre', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[], steps:[] }
);

gridMod.render();
const idsBefore = [...document.querySelectorAll('.recipe-card')].map(c => c.dataset.id);

domMod.state.excludedAllergens.add('gluten');
gridMod.render();
const idsAfterExclude = [...document.querySelectorAll('.recipe-card')].map(c => c.dataset.id);

domMod.state.excludedAllergens.delete('gluten');
gridMod.render();
const idsAfterClear = [...document.querySelectorAll('.recipe-card')].map(c => c.dataset.id);

console.log({ idsBefore, idsAfterExclude, idsAfterClear });
```

- `idsBefore` contient les 3 recettes de test.
- `idsAfterExclude` contient `sans-gluten` et `sans-allergene`, mais pas `avec-gluten`.
- `idsAfterClear` contient de nouveau les 3.

Vérifier aussi le panneau et le badge, toujours sans session :

```js
domMod.allergenFilterToggle.click();
const panelOpenAfterClick = !domMod.allergenFilterPanel.hidden;
domMod.allergenFilterList.querySelector('input[value="gluten"]').click();
const badgeAfterCheck = domMod.allergenFilterBadge.textContent;
const badgeHiddenAfterCheck = domMod.allergenFilterBadge.hidden;
document.body.click(); // clic en dehors du panneau
const panelClosedAfterOutsideClick = domMod.allergenFilterPanel.hidden;
console.log({ panelOpenAfterClick, badgeAfterCheck, badgeHiddenAfterCheck, panelClosedAfterOutsideClick });
```

- `panelOpenAfterClick === true`.
- `badgeAfterCheck === "1"`, `badgeHiddenAfterCheck === false`.
- `panelClosedAfterOutsideClick === true`.

Recharger la page (sans rien recocher) et vérifier `JSON.parse(localStorage.getItem('carnet-allergenes-exclus'))` contient `["gluten"]` — confirme la persistance.

Aucune erreur console sur l'ensemble de ces parcours.

- [x] **Step 8: Commit**

```bash
git add public/js/dom.js public/index.html public/js/grid.js public/js/main.js public/style.css public/sw.js
git commit -m "Ajouter le bouton et le panneau de filtre par allergene"
```
