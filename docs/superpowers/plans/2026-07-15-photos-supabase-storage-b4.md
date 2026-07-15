# Photos vers Supabase Storage (Plan B4) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les photos de recettes (principale + par étape), aujourd'hui stockées uniquement en local (IndexedDB), sont synchronisées vers un bucket Supabase Storage public — une photo ajoutée sur un appareil apparaît sur les autres, avec migration automatique des photos déjà présentes localement avant B4.

**Architecture:** `write-queue.js` (construit en B3) est réutilisé tel quel — les `Blob` sont nativement sérialisables en IndexedDB, donc `enqueue`/`registerHandler`/`flush` fonctionnent sans changement pour un nouveau type `"photo"`. Chaque écriture (ajout, suppression) réussit toujours instantanément en local (cache IndexedDB inchangé) puis tente l'upload/suppression Supabase Storage ; échec → mise en file d'attente, exactement comme les recettes/favoris/panier en B3. En lecture, si une photo est absente du cache local, l'app tente de la charger depuis l'URL publique Supabase Storage et la met en cache pour la prochaine consultation hors-ligne.

**Tech Stack:** `supabase.storage` (déjà disponible via le client `js/supabase-client.js`), `js/write-queue.js` (B3, inchangé).

**Ce que ce plan NE fait PAS** : compression/redimensionnement des images, barre de progression d'upload, nettoyage des photos orphelines côté Storage si une suppression échoue et n'est jamais rejouée.

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Les fichiers du site sont dans `public/`.
- Bucket Supabase Storage : `recipe-photos`, **public**, policies calquées sur celles de la table `recipes` (tout utilisateur authentifié peut lire/écrire/supprimer — pas de restriction par propriétaire).
- Chemin des objets Storage : `{recipeId}` pour la photo principale, `{recipeId}::step::{index}` pour une photo d'étape (même format de clé que le cache IndexedDB existant — pas de nouveau schéma de nommage).
- `write-queue.js` n'est **pas modifié** par ce plan — toute la logique photo passe par `registerHandler("photo", ...)`/`enqueue("photo", ...)` déjà exposés par ce module.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v11`).

---

### Task 1: Bucket Supabase Storage + policies (`supabase/schema.sql`)

**Files:**
- Modify: `supabase/schema.sql` (ajout en fin de fichier)

**Interfaces:**
- Produces: bucket Storage `recipe-photos` et ses policies, nécessaires à toutes les tâches suivantes (l'utilisateur doit exécuter ce SQL manuellement avant que les Tasks 2-7 puissent être testées en direct — voir Step 2).

- [ ] **Step 1: Ajouter le bucket et les policies**

À la fin de `supabase/schema.sql`, ajouter :

```sql

-- ===== recipe-photos : photos de recettes (bucket Storage public) =====
insert into storage.buckets (id, name, public) values ('recipe-photos', 'recipe-photos', true);

create policy "Household members can read recipe photos"
  on storage.objects for select
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can upload recipe photos"
  on storage.objects for insert
  with check (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can update recipe photos"
  on storage.objects for update
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can delete recipe photos"
  on storage.objects for delete
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);
```

- [ ] **Step 2: Note pour l'utilisateur (étape manuelle, hors de portée d'un subagent)**

Ce SQL doit être exécuté dans le tableau de bord Supabase du projet : **SQL Editor** → **New query** → coller uniquement le nouveau bloc ci-dessus (pas besoin de rejouer tout le fichier) → **Run**. Résultat attendu : `Success. No rows returned`. Vérifier ensuite dans **Storage** que le bucket `recipe-photos` existe et est marqué **Public**.

Un subagent implémenteur ne peut pas effectuer cette étape (accès au tableau de bord Supabase requis) — il doit simplement committer le fichier modifié et signaler dans son rapport que cette étape manuelle reste à faire par l'utilisateur avant toute vérification live des tâches suivantes.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add recipe-photos Storage bucket and policies"
```

---

### Task 2: Écriture des photos vers Supabase Storage (`js/photos.js`)

**Files:**
- Modify: `public/js/photos.js` (réécriture complète du fichier)

**Interfaces:**
- Consumes: `supabase` from `./supabase-client.js` ; `enqueue`, `registerHandler` from `./write-queue.js` (B3, inchangé).
- Produces : `savePhoto(recipeId, file)`, `saveStepPhoto(recipeId, index, file)` gardent leurs signatures exactes (consommées par `add-form.js`, inchangé) mais ne rejettent plus jamais en cas d'échec réseau — comportement local toujours réussi, écriture Supabase en file d'attente si besoin. `photoWriteHandler(payload)` (non exportée) sera réutilisée telle quelle par les Tasks 4 et 5.

- [ ] **Step 1: Remplacer tout le contenu du fichier**

Remplacer l'intégralité de `public/js/photos.js` par :

```js
import { supabase } from "./supabase-client.js";
import { enqueue, registerHandler } from "./write-queue.js";

/* ---- photos de recettes (Supabase Storage, avec cache IndexedDB pour l'usage hors-ligne) ---- */
const PHOTO_DB_NAME = "carnet-photos";
const PHOTO_STORE = "photos";
const SYNCED_KEY = "carnet-photos-synced";

function openPhotoDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(PHOTO_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cachePhotoLocally(key, blob){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPhoto(key){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deletePhoto(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).delete(recipeId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function stepPhotoKey(recipeId, index){
  return `${recipeId}::step::${index}`;
}

/* ---- synchro Supabase Storage ---- */
function markPhotoSynced(key){
  const synced = new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || "[]"));
  synced.add(key);
  localStorage.setItem(SYNCED_KEY, JSON.stringify([...synced]));
}

function isPhotoSynced(key){
  const synced = new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || "[]"));
  return synced.has(key);
}

async function photoWriteHandler(payload){
  if (payload.op === "delete") {
    const { error } = await supabase.storage.from("recipe-photos").remove([payload.key]);
    if (error) throw error;
  } else {
    const { error } = await supabase.storage.from("recipe-photos").upload(payload.key, payload.blob, {
      upsert: true,
      contentType: payload.blob.type || "application/octet-stream"
    });
    if (error) throw error;
    markPhotoSynced(payload.key);
  }
}
registerHandler("photo", photoWriteHandler);

/* ---- API publique ---- */
export async function savePhoto(recipeId, file){
  await cachePhotoLocally(recipeId, file);
  await photoWriteHandler({ op: "upload", key: recipeId, blob: file }).catch(() => enqueue("photo", recipeId, { op: "upload", key: recipeId, blob: file }));
}

export async function saveStepPhoto(recipeId, index, file){
  const key = stepPhotoKey(recipeId, index);
  await cachePhotoLocally(key, file);
  await photoWriteHandler({ op: "upload", key, blob: file }).catch(() => enqueue("photo", key, { op: "upload", key, blob: file }));
}

export async function getStepPhoto(recipeId, index){
  return getPhoto(stepPhotoKey(recipeId, index));
}

export async function deleteAllPhotosForRecipe(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    const store = tx.objectStore(PHOTO_STORE);
    store.delete(recipeId);
    store.delete(IDBKeyRange.bound(recipeId + "::", recipeId + "::￿"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function applyCardPhoto(recipeId, iconEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !iconEl) return;
    iconEl.classList.add("has-photo");
    iconEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
  }).catch(() => {});
}
export function applyDetailPhoto(recipeId, heroEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  }).catch(() => {});
}
```

Note : `deletePhoto` (singulier) n'est appelée nulle part dans le fichier ni ailleurs dans le projet — elle existait déjà dans le fichier original avant B4 (code mort préexistant, hors de portée de ce plan). La laisser telle quelle, ne pas la supprimer.

`getStepPhoto`, `deleteAllPhotosForRecipe`, `applyCardPhoto`, `applyDetailPhoto` gardent pour l'instant leur comportement local-uniquement d'origine (`getPhoto` direct, pas encore de repli Supabase Storage) — la lecture avec repli sera ajoutée en Task 3, la suppression Storage en Task 4.

- [ ] **Step 2: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois. Aucune erreur console au chargement (confirme que `registerHandler("photo", ...)` au niveau module ne provoque pas de plantage par import circulaire, comme rencontré en B3 — `photos.js` n'importe pas `ui.js`, donc pas de risque de cycle ici, mais vérifier quand même qu'aucune erreur de type `ReferenceError`/`Cannot access before initialization` n'apparaît). Si un compte de test est disponible, ajouter une photo à une recette en étant en ligne → doit apparaître immédiatement dans la fiche recette (comportement local inchangé) ; vérifier dans le tableau de bord Supabase → **Storage** → `recipe-photos` que le fichier est bien apparu (nécessite que la Task 1 ait été appliquée manuellement). Si aucun compte de test n'est disponible, faire une relecture statique attentive et le signaler dans le rapport (DONE_WITH_CONCERNS).

- [ ] **Step 3: Commit**

```bash
git add public/js/photos.js
git commit -m "Route photo uploads through Supabase Storage with offline queue fallback"
```

---

### Task 3: Lecture avec repli Supabase Storage (`js/photos.js`)

**Files:**
- Modify: `public/js/photos.js`

**Interfaces:**
- Consumes: `getPhoto`, `cachePhotoLocally`, `stepPhotoKey`, `supabase` (déjà en place depuis Task 2).
- Produces : `getStepPhoto`, `applyCardPhoto`, `applyDetailPhoto` gardent leurs signatures exactes (consommées par `detail.js`/`grid.js`, inchangé) mais tentent désormais un repli sur Supabase Storage si la photo est absente du cache local.

- [ ] **Step 1: Ajouter les fonctions de repli**

Dans `public/js/photos.js`, juste après le bloc `registerHandler("photo", photoWriteHandler);` (et avant `/* ---- API publique ---- */`), ajouter :

```js

async function fetchAndCacheFromStorage(key){
  const { data } = supabase.storage.from("recipe-photos").getPublicUrl(key);
  const res = await fetch(data.publicUrl);
  if (!res.ok) throw new Error("photo introuvable");
  const blob = await res.blob();
  await cachePhotoLocally(key, blob);
  return blob;
}

async function getPhotoWithFallback(key){
  const local = await getPhoto(key);
  if (local) return local;
  try {
    return await fetchAndCacheFromStorage(key);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Utiliser le repli dans les trois fonctions de lecture**

Remplacer :

```js
export async function getStepPhoto(recipeId, index){
  return getPhoto(stepPhotoKey(recipeId, index));
}
```

par :

```js
export async function getStepPhoto(recipeId, index){
  return getPhotoWithFallback(stepPhotoKey(recipeId, index));
}
```

Remplacer :

```js
export function applyCardPhoto(recipeId, iconEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !iconEl) return;
    iconEl.classList.add("has-photo");
    iconEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
  }).catch(() => {});
}
export function applyDetailPhoto(recipeId, heroEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  }).catch(() => {});
}
```

par :

```js
export function applyCardPhoto(recipeId, iconEl){
  getPhotoWithFallback(recipeId).then(blob => {
    if (!blob || !iconEl) return;
    iconEl.classList.add("has-photo");
    iconEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
  }).catch(() => {});
}
export function applyDetailPhoto(recipeId, heroEl){
  getPhotoWithFallback(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  }).catch(() => {});
}
```

- [ ] **Step 3: Vérifier dans le navigateur**

Si un compte de test est disponible sur deux profils/navigateurs différents : ajouter une photo depuis le profil A (en ligne), puis ouvrir la même recette depuis le profil B (qui n'a jamais vu cette photo localement) → la photo doit apparaître (chargée depuis l'URL publique Supabase Storage), et DevTools → Application → IndexedDB → `carnet-photos` doit maintenant contenir une entrée pour cette clé sur le profil B aussi (mise en cache après le repli). Si aucun compte de test n'est disponible, relecture statique + signalement (DONE_WITH_CONCERNS).

- [ ] **Step 4: Commit**

```bash
git add public/js/photos.js
git commit -m "Fall back to Supabase Storage when a photo is missing from the local cache"
```

---

### Task 4: Suppression synchronisée (`js/photos.js`)

**Files:**
- Modify: `public/js/photos.js`

**Interfaces:**
- Consumes: `photoWriteHandler`, `enqueue` (déjà en place depuis Task 2).
- Produces : `deleteAllPhotosForRecipe(recipeId)` garde sa signature exacte (consommée par `detail.js`, inchangé) mais supprime désormais aussi les objets Supabase Storage correspondants (avec repli en file d'attente).

- [ ] **Step 1: Ajouter la collecte des clés existantes**

Juste avant `export async function deleteAllPhotosForRecipe(recipeId){`, ajouter :

```js
async function collectPhotoKeysForRecipe(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const store = tx.objectStore(PHOTO_STORE);
    const keys = [];
    const mainReq = store.getKey(recipeId);
    mainReq.onsuccess = () => { if (mainReq.result !== undefined) keys.push(recipeId); };
    const cursorReq = store.openKeyCursor(IDBKeyRange.bound(recipeId + "::", recipeId + "::￿"));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) { keys.push(cursor.key); cursor.continue(); }
    };
    tx.oncomplete = () => resolve(keys);
    tx.onerror = () => reject(tx.error);
  });
}

```

- [ ] **Step 2: Réécrire `deleteAllPhotosForRecipe`**

Remplacer :

```js
export async function deleteAllPhotosForRecipe(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    const store = tx.objectStore(PHOTO_STORE);
    store.delete(recipeId);
    store.delete(IDBKeyRange.bound(recipeId + "::", recipeId + "::￿"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

par :

```js
export async function deleteAllPhotosForRecipe(recipeId){
  const keys = await collectPhotoKeysForRecipe(recipeId);
  const db = await openPhotoDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    const store = tx.objectStore(PHOTO_STORE);
    store.delete(recipeId);
    store.delete(IDBKeyRange.bound(recipeId + "::", recipeId + "::￿"));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  for (const key of keys) {
    await photoWriteHandler({ op: "delete", key }).catch(() => enqueue("photo", key, { op: "delete", key }));
  }
}
```

- [ ] **Step 3: Vérifier dans le navigateur**

Si un compte de test est disponible : ajouter une photo principale et une photo d'étape à une recette, la supprimer (bouton de suppression de recette dans `detail.js`) → vérifier dans le tableau de bord Supabase → **Storage** → `recipe-photos` que les deux objets ont bien disparu. Tester aussi hors-ligne (DevTools → Network → Offline) → la suppression locale doit rester instantanée, les entrées `photo:<clé>` doivent apparaître dans IndexedDB → `carnet-sync` → `write-queue`, puis disparaître au retour du réseau. Si aucun compte de test n'est disponible, relecture statique + signalement (DONE_WITH_CONCERNS).

- [ ] **Step 4: Commit**

```bash
git add public/js/photos.js
git commit -m "Delete photos from Supabase Storage through the offline queue"
```

---

### Task 5: Migration des photos existantes + branchement au démarrage

**Files:**
- Modify: `public/js/photos.js`
- Modify: `public/js/main.js`

**Interfaces:**
- Produces: `initPhotosSync()` (exportée depuis `photos.js`) — consommée par `main.js`.

- [ ] **Step 1: Ajouter `initPhotosSync` dans `photos.js`**

Juste avant `/* ---- API publique ---- */`, ajouter :

```js

export async function initPhotosSync(){
  const db = await openPhotoDB();
  const allKeys = await new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  for (const key of allKeys) {
    if (isPhotoSynced(key)) continue;
    const blob = await getPhoto(key);
    if (!blob) continue;
    await photoWriteHandler({ op: "upload", key, blob }).catch(() => enqueue("photo", key, { op: "upload", key, blob }));
  }
}
```

- [ ] **Step 2: Brancher dans `main.js`**

Dans `public/js/main.js`, remplacer :

```js
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
```

par :

```js
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
```

Puis remplacer :

```js
/* ---- démarrage (attend une session valide) ---- */
initAuth(async () => {
  await flush().catch(() => {});
  initRecipesSync();
  initFavoritesSync();
  initCartSync();
  initSyncBadge();
  updateCartBadge();
  updateAccountBadge();
});
```

par :

```js
/* ---- démarrage (attend une session valide) ---- */
initAuth(async () => {
  await flush().catch(() => {});
  initRecipesSync();
  initFavoritesSync();
  initCartSync();
  initPhotosSync();
  initSyncBadge();
  updateCartBadge();
  updateAccountBadge();
});
```

- [ ] **Step 3: Vérifier dans le navigateur**

Si un compte de test est disponible et possède déjà des photos ajoutées avant B4 (uniquement locales) : recharger l'app connectée et en ligne → après quelques secondes, vérifier dans le tableau de bord Supabase → **Storage** → `recipe-photos` que ces photos sont apparues, et dans `localStorage` → `carnet-photos-synced` que leurs clés y figurent. Recharger une seconde fois → aucun nouvel upload ne doit repartir pour ces mêmes clés (déjà dans `carnet-photos-synced`). Si aucun compte de test n'est disponible, relecture statique + signalement (DONE_WITH_CONCERNS).

- [ ] **Step 4: Commit**

```bash
git add public/js/photos.js public/js/main.js
git commit -m "Migrate existing local photos to Supabase Storage on startup"
```

---

### Task 6: Mettre à jour le service worker

**Files:**
- Modify: `public/sw.js`

Aucun nouveau fichier n'est ajouté à `APP_SHELL` (`js/photos.js` y est déjà listé depuis avant B4) — seul son contenu a changé, donc le cache doit être invalidé.

- [ ] **Step 1: Incrémenter `CACHE_NAME`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v11";
```

par :

```js
const CACHE_NAME = "carnet-cache-v12";
```

- [ ] **Step 2: Vérifier**

Recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v12` (l'ancien `v11` disparu).

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "Bump cache version for photo Storage sync"
```

---

### Task 7: Vérification complète et push

**Files:** aucun.

- [ ] **Step 1: Confirmer que la Task 1 a été appliquée**

Vérifier dans le tableau de bord Supabase → **Storage** que le bucket `recipe-photos` existe et est public. Si ce n'est pas le cas, l'appliquer maintenant (voir Task 1, Step 2) avant de continuer.

- [ ] **Step 2: Parcours complet, en ligne**

Connecté, en ligne : ajouter une recette avec une photo principale et au moins une photo d'étape → les deux apparaissent immédiatement dans la fiche recette et dans la grille (vignette). Vérifier leur présence dans le bucket Supabase Storage.

- [ ] **Step 3: Parcours cross-appareil**

Se connecter avec le même compte sur un second navigateur/profil n'ayant jamais vu ces photos localement → elles doivent s'afficher (chargées depuis Supabase Storage), et se retrouver ensuite dans le cache IndexedDB de ce second profil.

- [ ] **Step 4: Parcours hors-ligne**

Couper le réseau (DevTools → Network → Offline), ajouter une photo à une autre recette → apparaît instantanément, entrée en file d'attente (`carnet-sync` → `write-queue`). Repasser en ligne → synchronisée, entrée disparue de la file.

- [ ] **Step 5: Suppression**

Supprimer une recette ayant des photos → les objets correspondants disparaissent du bucket Supabase Storage.

- [ ] **Step 6: Migration**

Si des photos existaient déjà avant B4 sur le compte de test, confirmer qu'elles sont bien apparues dans le bucket après le premier démarrage post-déploiement (voir Task 5, Step 3).

- [ ] **Step 7: Vérifier l'absence d'erreurs console** sur tout le parcours ci-dessus.

- [ ] **Step 8: Push**

```bash
git push
```
