# Suppression d'une photo existante (recette + étapes) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dans le formulaire d'édition d'une recette, permettre de supprimer une photo déjà enregistrée (photo principale ou photo d'étape) sans être obligé de la remplacer par une autre.

**Architecture:** Trois nouvelles fonctions dans `public/js/photos.js` (`removePhoto`, `removeStepPhoto`, `getMainPhoto`) exposent la suppression d'une photo précise et la lecture de la photo principale. Le formulaire (`public/js/add-form.js`) affiche, pour chaque champ photo pré-existant en mode édition, une miniature avec un bouton ✕ de suppression (réutilisation du motif déjà utilisé pour les photos de scan, `.scan-photo-thumb`/`.scan-photo-remove`) ; l'intention de suppression est retenue en mémoire jusqu'à la soumission du formulaire, cohérent avec le reste du formulaire qui ne persiste rien avant "Enregistrer".

**Tech Stack:** IndexedDB (cache photo local), Supabase Storage (`photoWriteHandler`), aucun framework de build/test.

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v36`).
- La suppression n'est possible que depuis le formulaire d'édition (`public/js/add-form.js`), pas depuis la fiche recette (`public/js/detail.js`).
- La suppression concerne la photo principale et les photos d'étape.
- Rien n'est persisté avant la soumission du formulaire ("Enregistrer les modifications").
- Les fichiers du site sont dans `public/`.

---

### Task 1: Fonctions de suppression de photo (`public/js/photos.js`)

**Files:**
- Modify: `public/js/photos.js:121-137`

**Interfaces:**
- Produces: `removePhoto(recipeId)`, `removeStepPhoto(recipeId, index)`, `getMainPhoto(recipeId)` — consommées par les Tasks 2 et 3.
- Consumes: fonctions internes déjà existantes dans le fichier — `deletePhoto(key)`, `photoWriteHandler(payload)`, `enqueue(type, key, payload)`, `getPhotoWithFallback(key)`, `stepPhotoKey(recipeId, index)`, l'ensemble `confirmedMissing`.

- [x] **Step 1: Ajouter les trois fonctions**

Dans `public/js/photos.js`, remplacer :

```js
export async function savePhoto(recipeId, file){
  await cachePhotoLocally(recipeId, file);
  confirmedMissing.delete(recipeId);
  await photoWriteHandler({ op: "upload", key: recipeId, blob: file }).catch(() => enqueue("photo", recipeId, { op: "upload", key: recipeId, blob: file }));
}

export async function saveStepPhoto(recipeId, index, file){
  const key = stepPhotoKey(recipeId, index);
  await cachePhotoLocally(key, file);
  confirmedMissing.delete(key);
  await photoWriteHandler({ op: "upload", key, blob: file }).catch(() => enqueue("photo", key, { op: "upload", key, blob: file }));
}

export async function getStepPhoto(recipeId, index){
  return getPhotoWithFallback(stepPhotoKey(recipeId, index));
}
```

par :

```js
export async function savePhoto(recipeId, file){
  await cachePhotoLocally(recipeId, file);
  confirmedMissing.delete(recipeId);
  await photoWriteHandler({ op: "upload", key: recipeId, blob: file }).catch(() => enqueue("photo", recipeId, { op: "upload", key: recipeId, blob: file }));
}

export async function getMainPhoto(recipeId){
  return getPhotoWithFallback(recipeId);
}

export async function removePhoto(recipeId){
  await deletePhoto(recipeId);
  confirmedMissing.add(recipeId);
  await photoWriteHandler({ op: "delete", key: recipeId }).catch(() => enqueue("photo", recipeId, { op: "delete", key: recipeId }));
}

export async function saveStepPhoto(recipeId, index, file){
  const key = stepPhotoKey(recipeId, index);
  await cachePhotoLocally(key, file);
  confirmedMissing.delete(key);
  await photoWriteHandler({ op: "upload", key, blob: file }).catch(() => enqueue("photo", key, { op: "upload", key, blob: file }));
}

export async function removeStepPhoto(recipeId, index){
  const key = stepPhotoKey(recipeId, index);
  await deletePhoto(key);
  confirmedMissing.add(key);
  await photoWriteHandler({ op: "delete", key }).catch(() => enqueue("photo", key, { op: "delete", key }));
}

export async function getStepPhoto(recipeId, index){
  return getPhotoWithFallback(stepPhotoKey(recipeId, index));
}
```

Notes pour l'implémenteur :
- `deletePhoto(key)` (fonction interne non exportée, définie plus haut dans le fichier) supprime déjà l'entrée du cache IndexedDB local pour n'importe quelle clé (recette ou étape) — c'est celle utilisée par `deleteAllPhotosForRecipe`. On la réutilise ici telle quelle.
- Ajouter la clé à `confirmedMissing` évite qu'un appel ultérieur à `getPhotoWithFallback` (via `applyDetailPhoto`, `applyCardPhoto`, `getStepPhoto`, `getMainPhoto`) ne retente inutilement un fetch réseau vers Supabase Storage pour une photo qu'on vient de supprimer.
- `photoWriteHandler({ op: "delete", key })` supprime côté Supabase Storage ; en cas d'échec réseau, `enqueue` place l'opération en file d'attente hors-ligne — identique au mécanisme déjà utilisé par `deleteAllPhotosForRecipe`.

- [x] **Step 2: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, se connecter, recharger deux fois — aucune erreur console au chargement (le fichier n'a pas encore de nouvel appelant, ce step vérifie juste que le module s'importe et s'exécute sans erreur).

Ouvrir la console et repérer une recette qui affiche déjà une photo (bandeau visible sur sa fiche) :

```js
const store = await import('/js/recipes-store.js');
console.log(store.ALL_RECIPES.map(r => [r.id, r.title]));
```

Choisir l'id d'une recette avec photo dans la liste affichée, puis :

```js
const photos = await import('/js/photos.js');
const blob = await photos.getMainPhoto('<id choisi>');
console.log('photo trouvée :', blob instanceof Blob, blob?.size);

await photos.removePhoto('<id choisi>');
const after = await photos.getMainPhoto('<id choisi>');
console.log('après suppression, doit être null :', after);
```

- `blob instanceof Blob` doit être `true` avant suppression, avec `blob.size > 0`.
- `after` doit être `null` après suppression.
- Recharger la page et vérifier sur la fiche de cette recette que le bandeau photo a disparu (confirme la suppression côté Supabase Storage, pas seulement le cache local).
- Aucune erreur console pendant tout le test.

- [x] **Step 3: Commit**

```bash
git add public/js/photos.js
git commit -m "Ajouter les fonctions de suppression de photo (recette et etape)"
```

---

### Task 2: Suppression de la photo principale dans le formulaire (`public/js/add-form.js`, `public/sw.js`)

**Files:**
- Modify: `public/js/add-form.js` (import, template HTML du champ `#addPhoto`, câblage, handler de soumission)
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `removePhoto(recipeId)`, `getMainPhoto(recipeId)` de `public/js/photos.js` (Task 1).
- Consumes: classes CSS déjà existantes `.scan-photo-thumb`/`.scan-photo-remove` (`public/style.css`, définies pour les miniatures de scan) — pas de nouveau style nécessaire pour cette tâche.

- [x] **Step 1: Importer les nouvelles fonctions**

Dans `public/js/add-form.js`, remplacer :

```js
import { savePhoto, saveStepPhoto } from "./photos.js";
```

par :

```js
import { savePhoto, saveStepPhoto, removePhoto, getMainPhoto } from "./photos.js";
```

- [x] **Step 2: Ajouter la miniature et le bouton de suppression dans le template**

Dans `public/js/add-form.js`, remplacer :

```js
      <div class="field">
        <label for="addPhoto">Photo (optionnel)${editingRecipe ? " — laisse vide pour garder la photo actuelle" : ""}</label>
        <input id="addPhoto" type="file" accept="image/*">
      </div>
```

par :

```js
      <div class="field">
        <label for="addPhoto">Photo (optionnel)${editingRecipe ? " — laisse vide pour garder la photo actuelle" : ""}</label>
        <div class="scan-photo-thumb" id="addPhotoCurrent" hidden>
          <img id="addPhotoCurrentImg" alt="Photo actuelle">
          <button type="button" class="scan-photo-remove" id="addPhotoRemoveBtn" aria-label="Supprimer la photo actuelle">✕</button>
        </div>
        <input id="addPhoto" type="file" accept="image/*">
      </div>
```

- [x] **Step 3: Peupler la miniature et câbler la suppression**

Dans `public/js/add-form.js`, repérer le bloc suivant (juste après la déclaration de `addError`) :

```js
  if (!editingRecipe && prefillData?.photoBlob) {
    const dt = new DataTransfer();
    dt.items.add(new File([prefillData.photoBlob], "scan.jpg", { type: prefillData.photoBlob.type || "image/jpeg" }));
    addForm.querySelector("#addPhoto").files = dt.files;
  }
```

Ajouter juste après :

```js
  const addPhotoCurrent = addForm.querySelector("#addPhotoCurrent");
  const addPhotoCurrentImg = addForm.querySelector("#addPhotoCurrentImg");
  let mainPhotoRemoved = false;

  if (editingRecipe) {
    getMainPhoto(editingRecipe.id).then(blob => {
      if (!blob) return;
      addPhotoCurrentImg.src = URL.createObjectURL(blob);
      addPhotoCurrent.hidden = false;
    }).catch(() => {});
  }

  addForm.querySelector("#addPhotoRemoveBtn").addEventListener("click", () => {
    mainPhotoRemoved = true;
    addPhotoCurrent.hidden = true;
  });
```

- [x] **Step 4: Réinitialiser l'état de suppression quand un nouveau fichier est choisi**

Dans `public/js/add-form.js`, remplacer :

```js
  addForm.querySelector("#addPhoto").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const edited = await openPhotoEditor(file, 16 / 9);
    e.target.value = "";
    if (!edited) return;
    const dt = new DataTransfer();
    dt.items.add(new File([edited], "photo.jpg", { type: "image/jpeg" }));
    e.target.files = dt.files;
  });
```

par :

```js
  addForm.querySelector("#addPhoto").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const edited = await openPhotoEditor(file, 16 / 9);
    e.target.value = "";
    if (!edited) return;
    const dt = new DataTransfer();
    dt.items.add(new File([edited], "photo.jpg", { type: "image/jpeg" }));
    e.target.files = dt.files;
    mainPhotoRemoved = false;
    addPhotoCurrent.hidden = true;
  });
```

- [x] **Step 5: Appliquer la suppression à la soumission**

Dans `public/js/add-form.js`, remplacer :

```js
    if (photoFile) await savePhoto(recipe.id, photoFile);
```

par :

```js
    if (photoFile) await savePhoto(recipe.id, photoFile);
    else if (mainPhotoRemoved) await removePhoto(recipe.id);
```

- [x] **Step 6: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v36";
```

par :

```js
const CACHE_NAME = "carnet-cache-v37";
```

- [x] **Step 7: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v37` (l'ancien `v36` disparu).

Ouvrir l'édition d'une recette qui a déjà une photo principale (bouton "Modifier" depuis sa fiche) :
- La miniature de la photo actuelle s'affiche au-dessus du champ fichier, avec un bouton ✕ en haut à droite.
- Cliquer sur le ✕ → la miniature disparaît.
- Cliquer "Enregistrer les modifications" → revient sur la fiche recette, qui n'affiche plus de photo (bandeau vide).
- Rouvrir l'édition de cette même recette → aucune miniature ne s'affiche (plus de photo à supprimer).

Ouvrir l'édition d'une recette avec photo, cliquer le ✕, puis choisir un nouveau fichier dans le champ (sans enregistrer) :
- La miniature reste masquée (remplacée par le nouveau fichier sélectionné).
- Enregistrer → la fiche recette affiche la nouvelle photo (pas de suppression appliquée par erreur).

Ouvrir l'édition d'une recette **sans** photo principale : aucune miniature/bouton n'apparaît. Créer une nouvelle recette : aucune miniature/bouton n'apparaît jamais.

Aucune erreur console sur l'ensemble de ces parcours.

- [x] **Step 8: Commit**

```bash
git add public/js/add-form.js public/sw.js
git commit -m "Permettre de supprimer la photo principale d'une recette existante"
```

---

### Task 3: Suppression des photos d'étape dans le formulaire (`public/js/add-form.js`, `public/style.css`, `public/sw.js`)

**Files:**
- Modify: `public/js/add-form.js` (import, `createStepRow`, appels de `createStepRow`, handler de soumission)
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `removeStepPhoto(recipeId, index)`, `getStepPhoto(recipeId, index)` (déjà exporté avant ce plan) de `public/js/photos.js` (Task 1).

- [x] **Step 1: Importer les fonctions manquantes**

Dans `public/js/add-form.js`, remplacer :

```js
import { savePhoto, saveStepPhoto, removePhoto, getMainPhoto } from "./photos.js";
```

par :

```js
import { savePhoto, saveStepPhoto, removePhoto, removeStepPhoto, getMainPhoto, getStepPhoto } from "./photos.js";
```

- [x] **Step 2: Ajouter la miniature et le bouton de suppression dans `createStepRow`**

Dans `public/js/add-form.js`, remplacer toute la fonction :

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
  row.querySelector(".step-photo-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const edited = await openPhotoEditor(file, 1);
    e.target.value = "";
    if (!edited) return;
    const dt = new DataTransfer();
    dt.items.add(new File([edited], "step.jpg", { type: "image/jpeg" }));
    e.target.files = dt.files;
  });
  return row;
}
```

par :

```js
function createStepRow(container, text = "", recipeId, originalIndex){
  const row = document.createElement("div");
  row.className = "dyn-row dyn-row-step";
  row.innerHTML = `
    <input type="text" class="step-input" placeholder="Décrivez l'étape…" value="${escapeAttr(text)}">
    <div class="step-photo-thumb" hidden>
      <img alt="Photo actuelle">
      <button type="button" class="step-photo-remove" aria-label="Supprimer la photo actuelle">✕</button>
    </div>
    <input type="file" class="step-photo-input" accept="image/*" title="Photo de l'étape (optionnel)">
    <button type="button" class="dyn-remove" aria-label="Supprimer cette étape">✕</button>
  `;
  row.querySelector(".dyn-remove").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(container);
  });

  const thumb = row.querySelector(".step-photo-thumb");
  if (recipeId !== undefined && originalIndex !== undefined) {
    getStepPhoto(recipeId, originalIndex).then(blob => {
      if (!blob) return;
      thumb.querySelector("img").src = URL.createObjectURL(blob);
      thumb.hidden = false;
    }).catch(() => {});
  }
  thumb.querySelector(".step-photo-remove").addEventListener("click", () => {
    row.dataset.photoRemoved = "1";
    thumb.hidden = true;
  });

  row.querySelector(".step-photo-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const edited = await openPhotoEditor(file, 1);
    e.target.value = "";
    if (!edited) return;
    const dt = new DataTransfer();
    dt.items.add(new File([edited], "step.jpg", { type: "image/jpeg" }));
    e.target.files = dt.files;
    row.dataset.photoRemoved = "";
    thumb.hidden = true;
  });
  return row;
}
```

Notes pour l'implémenteur :
- `recipeId`/`originalIndex` ne sont fournis que pour les lignes pré-existantes en mode édition (Step 3 ci-dessous) — les nouvelles lignes ajoutées via "+ Ajouter une étape" les passent en `undefined`, donc la recherche de photo existante est simplement sautée (`if` false), ce qui est correct : une ligne toute neuve n'a jamais de photo en stockage.
- `row.dataset.photoRemoved` sert d'état par ligne (chaque ligne est un élément DOM distinct, donc pas de variable partagée possible comme pour la photo principale dans la Task 2).

- [x] **Step 3: Passer l'id de la recette et l'index d'origine lors de la création des lignes existantes**

Dans `public/js/add-form.js`, remplacer :

```js
  if (data?.steps?.length) {
    data.steps.forEach(text => stepRowsEl.appendChild(createStepRow(stepRowsEl, text)));
  } else {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
  }
```

par :

```js
  if (data?.steps?.length) {
    data.steps.forEach((text, i) => stepRowsEl.appendChild(createStepRow(stepRowsEl, text, editingRecipe?.id, i)));
  } else {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
  }
```

Note : pour une recette pré-remplie depuis un scan (`prefillData`, `editingRecipe` est `null`), `editingRecipe?.id` vaut `undefined` — aucune recherche de photo existante n'est tentée, ce qui est correct puisqu'une recette en cours de création n'a encore aucune photo en stockage.

- [x] **Step 4: Appliquer la suppression à la soumission**

Dans `public/js/add-form.js`, repérer :

```js
    const stepRowEls = [...stepRowsEl.querySelectorAll(".dyn-row")];
    const filledStepRows = stepRowEls.filter(row => row.querySelector(".step-input").value.trim());
    const steps = filledStepRows.map(row => row.querySelector(".step-input").value.trim());
    const stepPhotoFiles = filledStepRows.map(row => row.querySelector(".step-photo-input").files[0] || null);
```

Ajouter juste après :

```js
    const stepPhotoRemovals = filledStepRows.map(row => row.dataset.photoRemoved === "1");
```

Puis remplacer :

```js
    for (let i = 0; i < stepPhotoFiles.length; i++) {
      if (stepPhotoFiles[i]) await saveStepPhoto(recipe.id, i, stepPhotoFiles[i]);
    }
```

par :

```js
    for (let i = 0; i < stepPhotoFiles.length; i++) {
      if (stepPhotoFiles[i]) await saveStepPhoto(recipe.id, i, stepPhotoFiles[i]);
      else if (stepPhotoRemovals[i]) await removeStepPhoto(recipe.id, i);
    }
```

- [x] **Step 5: Ajouter les styles de la miniature d'étape**

Dans `public/style.css`, repérer :

```css
.dyn-row-step .step-input{ flex:1; min-width:0; }
.dyn-row-step .step-photo-input{ flex:none; width:120px; font-size:.68rem; color: var(--ink-soft); }
```

Ajouter juste après :

```css
.step-photo-thumb{ position:relative; width:40px; height:40px; border-radius:6px; overflow:hidden; border:1px solid var(--line); flex:none; }
.step-photo-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.step-photo-remove{
  position:absolute; top:1px; right:1px; width:16px; height:16px; border-radius:50%; border:none;
  background: rgba(0,0,0,.55); color:#fff; font-size:.55rem; line-height:1; display:flex; align-items:center; justify-content:center; padding:0;
}
.step-photo-remove:hover{ background: var(--terracotta-dark); }
```

- [x] **Step 6: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v37";
```

par :

```js
const CACHE_NAME = "carnet-cache-v38";
```

- [x] **Step 7: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v38`.

Ouvrir l'édition d'une recette dont au moins une étape a déjà une photo :
- La ligne de cette étape affiche une petite miniature avec un ✕ à côté du champ fichier ; les étapes sans photo n'affichent rien.
- Cliquer le ✕ de cette étape → la miniature disparaît, les autres lignes ne sont pas affectées.
- Enregistrer → rouvrir la fiche recette → la photo de cette étape ne s'affiche plus, les autres photos d'étape (s'il y en a) sont inchangées.
- Rouvrir l'édition de cette recette → plus de miniature pour cette étape.

Ouvrir l'édition d'une recette avec une photo d'étape, cliquer le ✕ de cette étape, puis choisir un nouveau fichier dans le champ de la même étape (sans enregistrer) :
- Enregistrer → la fiche recette affiche la nouvelle photo pour cette étape (pas de suppression appliquée par erreur).

Ajouter une nouvelle étape (bouton "+ Ajouter une étape") dans une recette en édition : aucune miniature/✕ n'apparaît pour cette nouvelle ligne.

Aucune erreur console sur l'ensemble de ces parcours.

- [x] **Step 8: Commit**

```bash
git add public/js/add-form.js public/style.css public/sw.js
git commit -m "Permettre de supprimer une photo d'etape existante"
```
