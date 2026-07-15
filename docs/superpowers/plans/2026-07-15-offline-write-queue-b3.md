# File d'attente d'écriture hors-ligne (Plan B3) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toute écriture (recette, favori, panier) réussit toujours instantanément en local, même hors-ligne ; une file d'attente persistante (IndexedDB) réessaie l'envoi vers Supabase dès que la connexion revient, avec un petit indicateur visuel pendant l'attente.

**Architecture:** Un module générique `js/write-queue.js` gère une file d'attente IndexedDB à clé composite `${type}:${key}` avec coalescing (une seule opération en attente par clé — la nouvelle remplace l'ancienne). Chaque module métier (`recipes-store.js`, `cart.js`) enregistre un handler par type d'opération et l'appelle lui-même en premier ; si l'appel échoue, il enfile l'opération au lieu de la perdre ou de bloquer l'utilisateur. `flush()` est déclenché par l'événement `online` et une fois au démarrage de l'app.

**Tech Stack:** IndexedDB (déjà utilisé par `js/sync.js`), client Supabase déjà en place.

**Ce que ce plan NE fait PAS** : résolution de conflits multi-appareils (reste last-write-wins), file d'attente pour la lecture (pull, déjà gérée par B1), retry avec backoff exponentiel.

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur (DevTools → Network → Offline).
- Les fichiers du site sont dans `public/`.
- Une seule opération en attente par clé `${type}:${key}` dans la file (coalescing) — une nouvelle `enqueue` sur une clé déjà présente remplace l'entrée existante.
- `flush()` ne tente les envois que quand `navigator.onLine` est vrai ; toute erreur rencontrée pendant un flush est donc traitée comme un échec réel (pas juste hors-ligne) → l'entrée sort de la file et un toast prévient l'utilisateur.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v10`).

---

### Task 1: Étendre le schéma IndexedDB (`js/sync.js`)

**Files:**
- Modify: `public/js/sync.js:1-16`

**Interfaces:**
- Produces: `openSyncDB()` (désormais exportée) et `QUEUE_STORE` (constante exportée, valeur `"write-queue"`) — consommées par `js/write-queue.js` (Task 2).
- Le comportement observable de `loadCachedRecipes`, `pullRecipes`, `cacheRecipe`, `uncacheRecipe` (déjà dans ce fichier) ne change pas.

- [ ] **Step 1: Bump `DB_VERSION` et rendre `openSyncDB` idempotente/exportée**

Dans `public/js/sync.js`, remplacer :

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
```

par :

```js
import { supabase } from "./supabase-client.js";

const DB_NAME = "carnet-sync";
const DB_VERSION = 2;
const RECIPES_STORE = "recipes";
export const QUEUE_STORE = "write-queue";

export function openSyncDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECIPES_STORE)) {
        db.createObjectStore(RECIPES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

Les autres fonctions du fichier (`loadCachedRecipes`, `pullRecipes`, `cacheRecipe`, `uncacheRecipe`) appellent déjà `openSyncDB()` sans le préfixe `export` — aucun changement nécessaire sur ces appels, ils continuent de fonctionner puisque c'est la même référence dans le même module.

- [ ] **Step 2: Vérifier dans le navigateur**

Lancer `lancer-le-carnet.bat`, recharger deux fois. DevTools → Application → IndexedDB → `carnet-sync` doit maintenant afficher **version 2** avec deux object stores : `recipes` et `write-queue`. Aucune erreur console. Les recettes se chargent toujours normalement (régression à surveiller : la base existante passe de v1 à v2 sans perdre les recettes déjà en cache).

- [ ] **Step 3: Commit**

```bash
git add public/js/sync.js
git commit -m "Add write-queue IndexedDB store, bump DB_VERSION to 2"
```

---

### Task 2: Créer le module `js/write-queue.js`

**Files:**
- Create: `public/js/write-queue.js`

**Interfaces:**
- Consumes: `openSyncDB`, `QUEUE_STORE` from `./sync.js` (Task 1) ; `showToast` from `./ui.js` (déjà existant).
- Produces (consommées par Tasks 3-6) :
  - `enqueue(type: string, key: string, payload: object): Promise<void>`
  - `registerHandler(type: string, handler: (payload: object) => Promise<void>): void`
  - `flush(): Promise<void>`
  - `getQueueSize(): Promise<number>`
  - `onQueueChange(callback: (size: number) => void): void`

- [ ] **Step 1: Créer le fichier**

Créer `public/js/write-queue.js` :

```js
import { openSyncDB, QUEUE_STORE } from "./sync.js";
import { showToast } from "./ui.js";

const listeners = new Set();
const handlers = {};

function notifyListeners(size){
  listeners.forEach(cb => cb(size));
}

export function onQueueChange(callback){
  listeners.add(callback);
}

export function registerHandler(type, handler){
  handlers[type] = handler;
}

export async function getQueueSize(){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, "readonly").objectStore(QUEUE_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(type, key, payload){
  const db = await openSyncDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).put({ key: `${type}:${key}`, type, payload });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notifyListeners(await getQueueSize());
}

async function dequeue(queueKey){
  const db = await openSyncDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(queueKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllEntries(){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(QUEUE_STORE, "readonly").objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function flush(){
  if (!navigator.onLine) return;
  const entries = await getAllEntries();
  for (const entry of entries) {
    if (!navigator.onLine) break;
    const handler = handlers[entry.type];
    if (!handler) { await dequeue(entry.key); continue; }
    try {
      await handler(entry.payload);
      await dequeue(entry.key);
    } catch {
      await dequeue(entry.key);
      showToast("Échec de synchronisation d'une modification récente");
    }
  }
  notifyListeners(await getQueueSize());
}
```

Notes pour l'implémenteur :
- Le guard `if (!handler)` gère le cas où une entrée en file référence un `type` inconnu du code actuel (ex. après un futur changement de schéma) — sans lui, une telle entrée bloquerait `flush()` indéfiniment. Ne pas le retirer même s'il semble redondant aujourd'hui.
- `flush()` ne tente les envois que si `navigator.onLine` est vrai (vérifié avant la boucle et à chaque itération) — c'est ce qui permet de traiter toute erreur rencontrée pendant la boucle comme un échec réel plutôt que comme un problème réseau (voir Global Constraints).

- [ ] **Step 2: Vérifier**

Relecture statique — aucun autre module n'importe encore `write-queue.js` (Tasks 3-6 le font), donc pas de test fonctionnel possible à ce stade. Confirmer que les imports (`openSyncDB`, `QUEUE_STORE` depuis `./sync.js`, `showToast` depuis `./ui.js`) correspondent bien aux exports de la Task 1 et de `ui.js` existant.

- [ ] **Step 3: Commit**

```bash
git add public/js/write-queue.js
git commit -m "Add generic offline write-queue module"
```

---

### Task 3: Brancher les recettes sur la file d'attente

**Files:**
- Modify: `public/js/recipes-store.js:1,28-43`
- Modify: `public/js/add-form.js:263-270`
- Modify: `public/js/detail.js:181-189`

**Interfaces:**
- Consumes: `enqueue`, `registerHandler` from `./write-queue.js` (Task 2).
- `saveRecipe(recipe)` et `deleteRecipeRemote(id)` gardent leurs signatures mais **ne rejettent plus jamais** en cas d'échec réseau/serveur — elles réussissent toujours du point de vue de l'appelant (l'écriture locale + cache IndexedDB a déjà eu lieu avant la tentative Supabase).

- [ ] **Step 1: Ajouter l'import**

Dans `public/js/recipes-store.js`, remplacer :

```js
import { supabase } from "./supabase-client.js";
import { loadCachedRecipes, pullRecipes, cacheRecipe, uncacheRecipe, recipeToRow } from "./sync.js";
```

par :

```js
import { supabase } from "./supabase-client.js";
import { loadCachedRecipes, pullRecipes, cacheRecipe, uncacheRecipe, recipeToRow } from "./sync.js";
import { enqueue, registerHandler } from "./write-queue.js";
```

- [ ] **Step 2: Réécrire `saveRecipe`/`deleteRecipeRemote`**

Remplacer :

```js
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
```

par :

```js
async function recipeWriteHandler(payload){
  if (payload.op === "delete") {
    const { error } = await supabase.from("recipes").delete().eq("id", payload.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("recipes").upsert(payload.row);
    if (error) throw error;
  }
}
registerHandler("recipe", recipeWriteHandler);

export async function saveRecipe(recipe){
  const idx = ALL_RECIPES.findIndex(r => r.id === recipe.id);
  if (idx >= 0) ALL_RECIPES[idx] = recipe; else ALL_RECIPES.push(recipe);
  await cacheRecipe(recipe);

  const row = recipeToRow(recipe);
  await recipeWriteHandler({ op: "upsert", row }).catch(() => enqueue("recipe", recipe.id, { op: "upsert", row }));
}

export async function deleteRecipeRemote(id){
  const idx = ALL_RECIPES.findIndex(r => r.id === id);
  if (idx >= 0) ALL_RECIPES.splice(idx, 1);
  await uncacheRecipe(id);

  await recipeWriteHandler({ op: "delete", id }).catch(() => enqueue("recipe", id, { op: "delete", id }));
}
```

- [ ] **Step 3: Retirer le blocage d'erreur dans `add-form.js`**

Dans `public/js/add-form.js`, remplacer :

```js
    try {
      await saveRecipe(recipe);
    } catch {
      submitBtn.disabled = false;
      addError.textContent = "Impossible d'enregistrer la recette. Vérifie ta connexion.";
      addError.hidden = false;
      return;
    }
```

par :

```js
    await saveRecipe(recipe);
```

(L'élément `addError` reste utilisé plus haut dans la fonction pour la validation de formulaire — ne pas le retirer du HTML ni de la fonction, seul ce bloc try/catch disparaît.)

- [ ] **Step 4: Retirer le blocage d'erreur dans `detail.js`**

Dans `public/js/detail.js`, remplacer :

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
```

par :

```js
async function deleteRecipe(id){
  if (!confirm("Supprimer définitivement cette recette ?")) return;
  await deleteRecipeRemote(id);
  state.favorites.delete(id);
```

- [ ] **Step 5: Vérifier dans le navigateur**

Lancer `lancer-le-carnet.bat`, se connecter. DevTools → Network → Offline. Ajouter une nouvelle recette → doit réussir instantanément (pas de message d'erreur), la recette apparaît dans la grille. Éditer une recette existante hors-ligne → réussit instantanément. Supprimer une recette hors-ligne → réussit instantanément, disparaît de la grille. DevTools → Application → IndexedDB → `carnet-sync` → `write-queue` : doit contenir une entrée par recette touchée (clé `recipe:<id>`). Repasser en ligne (Network → No throttling), recharger : les entrées doivent avoir disparu de `write-queue` (flush au démarrage, Task 6) — si Task 6 n'est pas encore faite, c'est normal qu'elles persistent pour l'instant, noter juste qu'aucune erreur console n'apparaît.

- [ ] **Step 6: Commit**

```bash
git add public/js/recipes-store.js public/js/add-form.js public/js/detail.js
git commit -m "Route recipe writes through the offline queue instead of blocking"
```

---

### Task 4: Brancher les favoris sur la file d'attente

**Files:**
- Modify: `public/js/recipes-store.js:67-75`

**Interfaces:**
- Consumes: `enqueue`, `registerHandler` from `./write-queue.js` (déjà importées en Task 3, même fichier).
- `toggleFavorite(id)` garde exactement le même comportement observable (aucun changement à cette fonction).

- [ ] **Step 1: Réécrire `syncFavoriteRemote`**

Dans `public/js/recipes-store.js`, remplacer :

```js
function syncFavoriteRemote(id, isFavorite){
  currentUserId().then(userId => {
    if (!userId) return;
    const query = isFavorite
      ? supabase.from("favorites").insert({ user_id: userId, recipe_id: id })
      : supabase.from("favorites").delete().eq("user_id", userId).eq("recipe_id", id);
    query.then(() => {}).catch(() => {});
  }).catch(() => {});
}
```

par :

```js
async function favoriteWriteHandler({ recipeId, isFavorite }){
  const userId = await currentUserId();
  if (!userId) return;
  const query = isFavorite
    ? supabase.from("favorites").upsert({ user_id: userId, recipe_id: recipeId }, { onConflict: "user_id,recipe_id" })
    : supabase.from("favorites").delete().eq("user_id", userId).eq("recipe_id", recipeId);
  const { error } = await query;
  if (error) throw error;
}
registerHandler("favorite", favoriteWriteHandler);

function syncFavoriteRemote(id, isFavorite){
  favoriteWriteHandler({ recipeId: id, isFavorite }).catch(() => {
    enqueue("favorite", id, { recipeId: id, isFavorite });
  });
}
```

(Le passage de `insert` à `upsert` avec `onConflict: "user_id,recipe_id"` rend l'ajout idempotent — si le favori existe déjà côté serveur, ex. ajouté depuis un autre appareil pendant que celui-ci était hors-ligne, `flush()` ne le traitera pas à tort comme un échec permanent.)

- [ ] **Step 2: Vérifier dans le navigateur**

DevTools → Network → Offline. Basculer un favori (ajouter puis retirer) sur une recette → doit réussir instantanément, toast habituel ("Ajouté aux favoris"/"Retiré des favoris"), aucune erreur. IndexedDB → `write-queue` doit contenir au plus une entrée `favorite:<id>` même après plusieurs bascules successives (coalescing — vérifier que le compte n'augmente pas à chaque clic).

- [ ] **Step 3: Commit**

```bash
git add public/js/recipes-store.js
git commit -m "Route favorite writes through the offline queue"
```

---

### Task 5: Brancher le panier sur la file d'attente

**Files:**
- Modify: `public/js/cart.js:1,34-44`

**Interfaces:**
- Consumes: `enqueue`, `registerHandler` from `./write-queue.js`.
- `addRecipeToCart`, `removeRecipeFromCart`, `clearCart`, et le clic sur une case à cocher gardent le même comportement observable.

- [ ] **Step 1: Ajouter l'import**

Dans `public/js/cart.js`, remplacer :

```js
import { supabase } from "./supabase-client.js";
import { parseQuantity, formatScaledNumber } from "./quantity.js";
import { cartBadge, panierView, panierScroll } from "./dom.js";
```

par :

```js
import { supabase } from "./supabase-client.js";
import { parseQuantity, formatScaledNumber } from "./quantity.js";
import { cartBadge, panierView, panierScroll } from "./dom.js";
import { enqueue, registerHandler } from "./write-queue.js";
```

- [ ] **Step 2: Réécrire `syncCartRemote`**

Remplacer :

```js
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
```

par :

```js
async function cartWriteHandler({ items, checked }){
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("cart_state").upsert({
    user_id: userId,
    items,
    checked,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) throw error;
}
registerHandler("cart", cartWriteHandler);

function syncCartRemote(){
  const payload = { items: [...cart], checked: [...checkedItems] };
  cartWriteHandler(payload).catch(() => enqueue("cart", "main", payload));
}
```

- [ ] **Step 3: Vérifier dans le navigateur**

DevTools → Network → Offline. Ajouter une recette au panier, cocher un article, retirer une recette → chaque action réussit instantanément. IndexedDB → `write-queue` doit contenir au plus une entrée `cart:main` même après plusieurs modifications successives (coalescing).

- [ ] **Step 4: Commit**

```bash
git add public/js/cart.js
git commit -m "Route cart writes through the offline queue"
```

---

### Task 6: Déclencheurs de flush + indicateur visuel

**Files:**
- Modify: `public/js/dom.js`
- Modify: `public/index.html:48-52`
- Modify: `public/style.css:216-220`
- Modify: `public/js/profile.js:1-25`
- Modify: `public/js/main.js`

**Interfaces:**
- Consumes: `onQueueChange`, `getQueueSize`, `flush` from `./write-queue.js` (Task 2).
- Produces: `initSyncBadge()` from `js/profile.js`, consommée par `js/main.js`.

- [ ] **Step 1: Ajouter la référence DOM du badge**

Dans `public/js/dom.js`, remplacer :

```js
export const accountToggle = document.getElementById("accountToggle");
export const accountIcon = document.getElementById("accountIcon");
export const profileView = document.getElementById("profileView");
```

par :

```js
export const accountToggle = document.getElementById("accountToggle");
export const accountIcon = document.getElementById("accountIcon");
export const syncBadge = document.getElementById("syncBadge");
export const profileView = document.getElementById("profileView");
```

- [ ] **Step 2: Ajouter le badge dans le HTML**

Dans `public/index.html`, remplacer :

```html
      <button id="accountToggle" class="account-toggle" type="button" aria-label="Mon compte">
        <span id="accountIcon" class="account-icon">
          <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </span>
      </button>
```

par :

```html
      <button id="accountToggle" class="account-toggle" type="button" aria-label="Mon compte">
        <span id="accountIcon" class="account-icon">
          <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </span>
        <span id="syncBadge" class="sync-badge" hidden title="Synchronisation en attente"></span>
      </button>
```

- [ ] **Step 3: Ajouter le style du badge**

Dans `public/style.css`, remplacer :

```css
.account-icon{ display:flex; align-items:center; justify-content:center; }
.account-icon.has-initials{
  width:100%; height:100%; border-radius:50%;
  background: var(--emerald); color:#fff;
  font-size:.78rem; font-weight:800; letter-spacing:.02em;
}
```

par :

```css
.account-icon{ display:flex; align-items:center; justify-content:center; }
.account-icon.has-initials{
  width:100%; height:100%; border-radius:50%;
  background: var(--emerald); color:#fff;
  font-size:.78rem; font-weight:800; letter-spacing:.02em;
}
.sync-badge{
  position:absolute; top:-2px; right:-2px;
  width:11px; height:11px; border-radius:50%;
  background: var(--mustard);
  border: 2px solid var(--bg);
}
.sync-badge[hidden]{ display:none; }
```

(`.account-toggle` a déjà `position:relative` — voir `public/style.css:205-214` — donc ce badge se positionne correctement en absolu par rapport au bouton compte, comme `.cart-badge` le fait pour `.cart-toggle`.)

- [ ] **Step 4: Gérer le badge dans `profile.js`**

Dans `public/js/profile.js`, remplacer :

```js
import { supabase } from "./supabase-client.js";
import { accountIcon, profileView, profileScroll } from "./dom.js";
import { escapeAttr } from "./utils.js";
import { showToast, openDrawer, syncBodyScrollLock } from "./ui.js";
```

par :

```js
import { supabase } from "./supabase-client.js";
import { accountIcon, syncBadge, profileView, profileScroll } from "./dom.js";
import { escapeAttr } from "./utils.js";
import { showToast, openDrawer, syncBodyScrollLock } from "./ui.js";
import { onQueueChange, getQueueSize } from "./write-queue.js";
```

Puis, juste après la déclaration de `PERSON_ICON` et avant `initials`, ajouter :

```js
function updateSyncBadge(size){
  syncBadge.hidden = size === 0;
}
onQueueChange(updateSyncBadge);

export async function initSyncBadge(){
  updateSyncBadge(await getQueueSize());
}
```

- [ ] **Step 5: Brancher les déclencheurs dans `main.js`**

Dans `public/js/main.js`, remplacer :

```js
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe } from "./ui.js";
import { initAuth, logout } from "./auth.js";
import { openProfile, closeProfile, updateAccountBadge } from "./profile.js";
import "./timer.js";

/* ---- service worker : active le mode hors-ligne ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
```

par :

```js
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe } from "./ui.js";
import { initAuth, logout } from "./auth.js";
import { openProfile, closeProfile, updateAccountBadge, initSyncBadge } from "./profile.js";
import { flush } from "./write-queue.js";
import "./timer.js";

/* ---- service worker : active le mode hors-ligne ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---- file d'attente hors-ligne : réessaie dès que la connexion revient ---- */
window.addEventListener("online", () => { flush(); });
```

Puis remplacer :

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

par :

```js
/* ---- démarrage (attend une session valide) ---- */
initAuth(() => {
  initRecipesSync();
  initFavoritesSync();
  initCartSync();
  initSyncBadge();
  updateCartBadge();
  updateAccountBadge();
  flush();
});
```

- [ ] **Step 6: Vérifier dans le navigateur**

Lancer `lancer-le-carnet.bat`, se connecter, recharger deux fois (service worker pas encore mis à jour tant que Task 7 n'est pas faite — c'est attendu). DevTools → Network → Offline. Ajouter une recette et basculer un favori → le point mustard doit apparaître sur l'icône compte. Repasser en ligne (retirer le throttling) sans recharger la page → dans les ~secondes qui suivent l'événement `online`, le badge doit disparaître (flush automatique). Vérifier dans Supabase (table editor) que la recette et le favori sont bien arrivés. Aucune erreur console.

- [ ] **Step 7: Commit**

```bash
git add public/js/dom.js public/index.html public/style.css public/js/profile.js public/js/main.js
git commit -m "Wire flush triggers and add pending-sync badge on account icon"
```

---

### Task 7: Mettre à jour le service worker

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Ajouter `write-queue.js` à `APP_SHELL` et bump `CACHE_NAME`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v10";
```

par :

```js
const CACHE_NAME = "carnet-cache-v11";
```

Puis remplacer :

```js
  "./js/supabase-client.js",
  "./js/auth.js",
  "./js/profile.js",
  "./js/sync.js",
  "./fonts/caveat.woff2",
```

par :

```js
  "./js/supabase-client.js",
  "./js/auth.js",
  "./js/profile.js",
  "./js/sync.js",
  "./js/write-queue.js",
  "./fonts/caveat.woff2",
```

- [ ] **Step 2: Vérifier**

Recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v11` (l'ancien `v10` disparu), contenant `js/write-queue.js`.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "Bump cache version for offline write queue"
```

---

### Task 8: Vérification complète et push

**Files:** aucun.

- [ ] **Step 1: Parcours recette hors-ligne**

Connecté, en ligne, recharger une fois. Couper le réseau (DevTools → Network → Offline). Ajouter une recette, l'éditer, puis la supprimer, toutes les trois opérations hors-ligne → chacune réussit instantanément sans message d'erreur. IndexedDB → `write-queue` : vérifier qu'il ne reste qu'**une seule** entrée `recipe:<id>` (la suppression a bien remplacé l'édition en attente — coalescing). Repasser en ligne → l'entrée disparaît de la file, le badge compte s'éteint, la suppression est bien reflétée dans Supabase.

- [ ] **Step 2: Parcours favoris/panier hors-ligne**

Toujours hors-ligne : basculer un favori deux fois de suite (ajouter puis retirer) → vérifier une seule entrée `favorite:<id>` en file reflétant l'état final. Ajouter/retirer des articles du panier plusieurs fois → vérifier une seule entrée `cart:main`. Repasser en ligne → tout se synchronise, badge éteint, tables `favorites`/`cart_state` à jour dans Supabase.

- [ ] **Step 3: Échec permanent**

Hors-ligne, éditer une recette existante (pour qu'elle soit en file). Dans le tableau de bord Supabase (SQL editor ou Table editor), supprimer cette recette directement côté serveur. Repasser en ligne côté app → le flush doit échouer pour cette entrée (la recette n'existe plus), afficher le toast "Échec de synchronisation d'une modification récente", et retirer l'entrée de `write-queue` (pas de blocage permanent).

- [ ] **Step 4: Flush au démarrage sans événement `online`**

Hors-ligne, ajouter une recette (reste en file). Fermer complètement l'onglet/la fenêtre. Rétablir le réseau. Rouvrir l'app (déjà en ligne dès le chargement, donc l'événement `online` du navigateur ne se déclenche jamais) → la recette doit se synchroniser automatiquement grâce au `flush()` de démarrage, sans action de l'utilisateur.

- [ ] **Step 5: Vérifier l'absence d'erreurs console** sur tout le parcours ci-dessus.

- [ ] **Step 6: Push**

```bash
git push
```
