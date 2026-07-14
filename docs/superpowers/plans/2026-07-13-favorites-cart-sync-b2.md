# Synchro favoris + panier (Plan B2) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les favoris et le panier de chaque compte se synchronisent avec Supabase (tables `favorites`/`cart_state`, déjà créées et RLS-protégées depuis le Plan A) — un favori ajouté ou un article de panier coché sur un appareil apparaît sur l'autre appareil connecté au même compte.

**Architecture:** Écritures optimistes et non-bloquantes : chaque action (cocher un favori, ajouter au panier...) reste instantanée localement comme aujourd'hui, et une synchronisation vers Supabase part en arrière-plan sans bloquer l'interface ni afficher d'erreur en cas d'échec — cohérent avec la manière dont les photos sont déjà gérées dans ce projet. Au démarrage, l'état local (`localStorage`, déjà en place) est rafraîchi depuis Supabase.

**Tech Stack:** Client Supabase déjà en place (`js/supabase-client.js`).

**Ce que ce plan NE fait PAS** : file d'attente hors-ligne pour rejouer une écriture manquée (B3), aucun changement à la synchro des recettes (B1, déjà en place).

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Les écritures favoris/panier sont **best-effort** : si Supabase échoue (hors-ligne, erreur réseau), l'action reste appliquée localement sans message d'erreur ni blocage — contrairement aux recettes (B1) qui bloquent et affichent une erreur, car favoris/panier sont personnels et moins critiques.
- Toute écriture vers `cart_state` doit inclure `updated_at` (pas de trigger Postgres pour l'auto-mettre à jour).
- Les fichiers du site sont dans `public/`.

---

### Task 1: Synchro des favoris (`js/recipes-store.js`)

**Files:**
- Modify: `public/js/recipes-store.js`

**Interfaces:**
- Produces: `initFavoritesSync()` — consommée par `js/main.js` (Task 3).
- `toggleFavorite(id)` garde exactement la même signature et le même comportement synchrone observable (favoris, toast, re-rendu) — seul un envoi Supabase en arrière-plan s'ajoute.

- [ ] **Step 1: Ajouter la synchro des favoris**

Dans `public/js/recipes-store.js`, remplacer :

```js
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

par :

```js
/* ---- persistance des favoris (Supabase, avec cache localStorage) ---- */
export function saveFavorites(){
  localStorage.setItem("carnet-favoris", JSON.stringify([...state.favorites]));
}

async function currentUserId(){
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

function syncFavoriteRemote(id, isFavorite){
  currentUserId().then(userId => {
    if (!userId) return;
    const query = isFavorite
      ? supabase.from("favorites").insert({ user_id: userId, recipe_id: id })
      : supabase.from("favorites").delete().eq("user_id", userId).eq("recipe_id", id);
    query.then(() => {}).catch(() => {});
  }).catch(() => {});
}

export function toggleFavorite(id){
  let isFavorite;
  if (state.favorites.has(id)) { state.favorites.delete(id); isFavorite = false; showToast("Retiré des favoris"); }
  else { state.favorites.add(id); isFavorite = true; showToast("Ajouté aux favoris"); }
  saveFavorites();
  syncFavoriteRemote(id, isFavorite);
  render();
  if (!detailView.hidden && detailView.classList.contains("is-open")) {
    syncDetailFavButton(id);
  }
}

export async function initFavoritesSync(){
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const { data, error } = await supabase.from("favorites").select("recipe_id").eq("user_id", userId);
    if (error) throw error;
    state.favorites = new Set(data.map(r => r.recipe_id));
    saveFavorites();
    render();
  } catch {
    /* hors-ligne ou erreur réseau : on garde les favoris déjà en cache localStorage */
  }
}
```

- [ ] **Step 2: Vérifier**

Relecture statique : `supabase` est déjà importé en haut du fichier (`import { supabase } from "./supabase-client.js";`), pas de nouvel import nécessaire. `initFavoritesSync` n'est pas encore appelée (Task 3 le fait) — pas de test fonctionnel possible avant.

- [ ] **Step 3: Commit**

```bash
git add public/js/recipes-store.js
git commit -m "Sync favorites with Supabase (optimistic, non-blocking writes)"
```

---

### Task 2: Synchro du panier (`js/cart.js`)

**Files:**
- Modify: `public/js/cart.js`

**Interfaces:**
- Produces: `initCartSync()` — consommée par `js/main.js` (Task 3).
- `addRecipeToCart`, `removeRecipeFromCart`, `clearCart`, et le clic sur une case à cocher gardent le même comportement observable — un envoi Supabase en arrière-plan s'ajoute à chacun.

- [ ] **Step 1: Ajouter l'import de `supabase`**

Dans `public/js/cart.js`, remplacer :

```js
import { parseQuantity, formatScaledNumber } from "./quantity.js";
import { cartBadge, panierView, panierScroll } from "./dom.js";
```

par :

```js
import { supabase } from "./supabase-client.js";
import { parseQuantity, formatScaledNumber } from "./quantity.js";
import { cartBadge, panierView, panierScroll } from "./dom.js";
```

- [ ] **Step 2: Ajouter les fonctions de synchro**

Toujours dans `public/js/cart.js`, juste après le bloc :

```js
export const cart = loadCart();
const checkedItems = loadCheckedItems();
```

ajouter :

```js
async function currentUserId(){
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

function syncCartRemote(){
  currentUserId().then(userId => {
    if (!userId) return;
    supabase.from("cart_state").upsert({
      user_id: userId,
      items: cart,
      checked: [...checkedItems],
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" }).then(() => {}).catch(() => {});
  }).catch(() => {});
}

export async function initCartSync(){
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const { data, error } = await supabase.from("cart_state").select("items, checked").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (data) {
      cart.splice(0, cart.length, ...(data.items || []));
      checkedItems.clear();
      (data.checked || []).forEach(k => checkedItems.add(k));
      saveCart();
      saveCheckedItems();
      updateCartBadge();
    }
  } catch {
    /* hors-ligne ou erreur réseau : on garde le panier déjà en cache localStorage */
  }
}
```

- [ ] **Step 3: Appeler `syncCartRemote()` après chaque écriture**

Remplacer :

```js
export function addRecipeToCart(recipe, servings, ingredients){
  const idx = cart.findIndex(e => e.recipeId === recipe.id);
  const entry = { recipeId: recipe.id, title: recipe.title, category: recipe.category, servings, ingredients };
  if (idx >= 0) cart[idx] = entry; else cart.push(entry);
  saveCart();
  updateCartBadge();
}
```

par :

```js
export function addRecipeToCart(recipe, servings, ingredients){
  const idx = cart.findIndex(e => e.recipeId === recipe.id);
  const entry = { recipeId: recipe.id, title: recipe.title, category: recipe.category, servings, ingredients };
  if (idx >= 0) cart[idx] = entry; else cart.push(entry);
  saveCart();
  updateCartBadge();
  syncCartRemote();
}
```

Remplacer :

```js
export function removeRecipeFromCart(recipeId){
  const idx = cart.findIndex(e => e.recipeId === recipeId);
  if (idx >= 0) cart.splice(idx, 1);
  saveCart();
  updateCartBadge();
  renderPanier();
}
```

par :

```js
export function removeRecipeFromCart(recipeId){
  const idx = cart.findIndex(e => e.recipeId === recipeId);
  if (idx >= 0) cart.splice(idx, 1);
  saveCart();
  updateCartBadge();
  syncCartRemote();
  renderPanier();
}
```

Remplacer :

```js
function clearCart(){
  cart.length = 0;
  checkedItems.clear();
  saveCart();
  saveCheckedItems();
  updateCartBadge();
  renderPanier();
  showToast("Panier vidé");
}
```

par :

```js
function clearCart(){
  cart.length = 0;
  checkedItems.clear();
  saveCart();
  saveCheckedItems();
  updateCartBadge();
  syncCartRemote();
  renderPanier();
  showToast("Panier vidé");
}
```

Remplacer, dans `renderPanier`, le gestionnaire de clic sur les cases à cocher :

```js
  panierScroll.querySelectorAll(".checkbox[data-key]").forEach(box => {
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const key = box.dataset.key;
      if (checkedItems.has(key)) checkedItems.delete(key); else checkedItems.add(key);
      saveCheckedItems();
      renderPanier();
    });
  });
```

par :

```js
  panierScroll.querySelectorAll(".checkbox[data-key]").forEach(box => {
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const key = box.dataset.key;
      if (checkedItems.has(key)) checkedItems.delete(key); else checkedItems.add(key);
      saveCheckedItems();
      syncCartRemote();
      renderPanier();
    });
  });
```

- [ ] **Step 4: Vérifier**

Relecture statique — `initCartSync`/`syncCartRemote` ne sont pas encore appelées au démarrage (Task 3 le fait). Confirmer que les 4 points d'appel de `syncCartRemote()` sont bien en place et qu'aucun autre comportement n'a changé.

- [ ] **Step 5: Commit**

```bash
git add public/js/cart.js
git commit -m "Sync cart with Supabase (optimistic, non-blocking writes)"
```

---

### Task 3: Brancher la synchro dans `main.js`

**Files:**
- Modify: `public/js/main.js`

**Interfaces:**
- Consumes: `initFavoritesSync` from `./recipes-store.js` (Task 1), `initCartSync` from `./cart.js` (Task 2).

- [ ] **Step 1: Mettre à jour les imports**

Dans `public/js/main.js`, remplacer :

```js
import { openPanier, closePanier, updateCartBadge } from "./cart.js";
```

par :

```js
import { openPanier, closePanier, updateCartBadge, initCartSync } from "./cart.js";
```

Remplacer :

```js
import { initRecipesSync } from "./recipes-store.js";
```

par :

```js
import { initRecipesSync, initFavoritesSync } from "./recipes-store.js";
```

- [ ] **Step 2: Appeler les deux nouvelles fonctions au démarrage**

Remplacer :

```js
/* ---- démarrage (attend une session valide) ---- */
initAuth(() => {
  initRecipesSync();
  updateCartBadge();
  updateAccountBadge();
});
```

par :

```js
/* ---- démarrage (attend une session valide) ---- */
initAuth(() => {
  initRecipesSync();
  initFavoritesSync();
  initCartSync();
  updateCartBadge();
  updateAccountBadge();
});
```

- [ ] **Step 3: Vérifier dans le navigateur**

Lancer `lancer-le-carnet.bat`, recharger deux fois. Aucune erreur dans la console. L'app se comporte comme avant (connexion requise, recettes, panier, favoris tous accessibles) — la vérification complète multi-comptes se fait à la Task 5.

- [ ] **Step 4: Commit**

```bash
git add public/js/main.js
git commit -m "Wire favorites/cart sync into app startup"
```

---

### Task 4: Mettre à jour le service worker

**Files:**
- Modify: `public/sw.js`

Aucun nouveau fichier n'est ajouté à `APP_SHELL` dans ce plan (Tasks 1-3 modifient des fichiers déjà listés) — seul le contenu de `js/recipes-store.js`, `js/cart.js` et `js/main.js` a changé, donc le cache doit être invalidé pour que ces changements atteignent les utilisateurs.

- [ ] **Step 1: Incrémenter `CACHE_NAME`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v8";
```

par :

```js
const CACHE_NAME = "carnet-cache-v9";
```

- [ ] **Step 2: Vérifier**

Recharger deux fois — DevTools → Application → Cache Storage doit montrer `carnet-cache-v9` (l'ancien `v8` disparu).

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "Bump cache version for favorites/cart sync"
```

---

### Task 5: Vérification complète et push

**Files:** aucun.

- [ ] **Step 1: Parcours cross-compte**

Compte 1 (fenêtre normale) et Compte 2 (navigation privée), tous deux connectés.

1. Compte 1 : ajoute un favori sur une recette, ajoute une recette au panier.
2. Compte 2 : recharge → ses favoris/panier à lui restent **inchangés** (favoris/panier sont personnels, pas partagés — vérifie qu'ils ne voient PAS les favoris/panier du compte 1).
3. Compte 1 : recharge la page (F5, même compte, même appareil virtuel) → ses favoris/panier restent bien affichés (persistance confirmée).
4. Ouvre une session privée supplémentaire avec le compte 1 (simulateur de "deuxième appareil, même compte") → les favoris/panier du compte 1 apparaissent bien dedans aussi.

- [ ] **Step 2: Vérifier le comportement hors-ligne**

Compte 1, en ligne, recharger une fois (pour peupler le cache localStorage). Couper le réseau, ajouter un favori → doit fonctionner instantanément sans erreur ni blocage (écriture Supabase échoue silencieusement en arrière-plan, comportement attendu de ce plan).

- [ ] **Step 3: Vérifier l'absence d'erreurs console** sur tout le parcours.

- [ ] **Step 4: Push**

```bash
git push
```
