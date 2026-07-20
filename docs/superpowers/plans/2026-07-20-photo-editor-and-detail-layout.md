# Recadrage/rotation de photo + fiche recette compacte — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un outil de recadrage/rotation de photo réutilisable (canvas, pan/zoom/rotation, sans librairie) branché à 3 endroits (photo principale, photos d'étape, photo du scan), plus une fiche recette dont le bandeau photo passe à un ratio fixe non-sticky, et une description courte tronquée à 2 lignes avec "Voir plus".

**Architecture:** Un nouveau module `public/js/photo-editor.js` expose `openPhotoEditor(blob, aspectRatio) → Promise<Blob|null>`, une vue plein écran de plus sur le pattern `.detail-view` déjà utilisé partout ailleurs dans l'app. `public/js/detail.js`/`public/style.css` sont retravaillés pour séparer la photo du bloc titre/description sur la fiche recette, et pour tronquer la description.

**Tech Stack:** Canvas 2D natif, Pointer Events, aucune dépendance externe.

## Global Constraints

- Aucune librairie tierce (l'app fonctionne 100% hors-ligne, zéro dépendance externe).
- Zoom via curseur (`<input type="range">`), pas de geste de pincement.
- Rotation par pas de 90°.
- Recadrage = déplacement (pan) + zoom dans un cadre à ratio fixe ; **pas de bornage du pan** dans cette version (l'utilisateur peut dépasser les bords, un fond neutre comble le vide — simplification volontaire).
- Si l'utilisateur annule l'édition (à n'importe lequel des 3 points d'intégration), le résultat est **l'absence de photo**, pas la photo brute non éditée — cohérent avec le principe existant que ce champ n'est jamais obligatoire.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v27`).
- Suivre le pattern `.detail-view` existant (voir `scanView` dans `index.html`/`dom.js`/`ui.js`/`main.js`) pour toute nouvelle vue plein écran.

---

### Task 1: Module `public/js/photo-editor.js` + vue plein écran

**Files:**
- Create: `public/js/photo-editor.js`
- Modify: `public/index.html` (nouvelle section `photoEditorView`)
- Modify: `public/js/dom.js` (nouveaux exports)
- Modify: `public/js/ui.js` (intégration `syncBodyScrollLock`/`closeAllOverlays`)
- Modify: `public/js/main.js` (intégration `closeAnyOpenSheet`)
- Modify: `public/style.css` (styles du cadre de recadrage)
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Produces: `export function openPhotoEditor(blob, aspectRatio)` → `Promise<Blob|null>` (`aspectRatio` = largeur/hauteur, ex. `16/9` ou `1`). Résout avec l'image éditée (Blob JPEG) si validée, `null` si annulée. `export function closePhotoEditor()` — ferme la vue et résout la promesse en cours (s'il y en a une) avec `null` ; consommé par `ui.js`/`main.js` comme les autres vues.
- Consumed par les Tasks 2 et 3 (pas encore câblé nulle part dans cette tâche).

- [ ] **Step 1: Ajouter la section HTML, dans `public/index.html`**

Remplacer :

```html
<!-- ===== VUE SCAN (capture photo pour pré-remplir une recette) ===== -->
<section id="scanView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="scanCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="scanScroll"></div>
</section>
```

par :

```html
<!-- ===== VUE SCAN (capture photo pour pré-remplir une recette) ===== -->
<section id="scanView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="scanCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="scanScroll"></div>
</section>

<!-- ===== VUE ÉDITEUR PHOTO (recadrage/rotation avant sauvegarde) ===== -->
<section id="photoEditorView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="photoEditorCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="photoEditorScroll"></div>
</section>
```

- [ ] **Step 2: Ajouter les exports DOM, dans `public/js/dom.js`**

Remplacer :

```js
export const scanView = document.getElementById("scanView");
export const scanScroll = document.getElementById("scanScroll");
export const scanCloseBtn = document.getElementById("scanCloseBtn");
export const navScanBtn = document.getElementById("navScanBtn");
```

par :

```js
export const scanView = document.getElementById("scanView");
export const scanScroll = document.getElementById("scanScroll");
export const scanCloseBtn = document.getElementById("scanCloseBtn");
export const navScanBtn = document.getElementById("navScanBtn");
export const photoEditorView = document.getElementById("photoEditorView");
export const photoEditorScroll = document.getElementById("photoEditorScroll");
export const photoEditorCloseBtn = document.getElementById("photoEditorCloseBtn");
```

- [ ] **Step 3: Créer `public/js/photo-editor.js`**

```js
import { photoEditorView, photoEditorScroll, photoEditorCloseBtn } from "./dom.js";
import { syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";

/* ---- éditeur de photo : recadrage (pan/zoom) + rotation avant sauvegarde ---- */
let pendingResolve = null;

function loadImage(blob){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function drawFrame(ctx, canvasW, canvasH, img, rotation, zoom, panX, panY){
  ctx.save();
  ctx.fillStyle = "#FBFAF6";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const swapped = rotation === 90 || rotation === 270;
  const imgW = swapped ? img.naturalHeight : img.naturalWidth;
  const imgH = swapped ? img.naturalWidth : img.naturalHeight;
  const baseScale = Math.max(canvasW / imgW, canvasH / imgH);
  const scale = baseScale * zoom;

  ctx.translate(canvasW / 2 + panX, canvasH / 2 + panY);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(
    img,
    -img.naturalWidth * scale / 2,
    -img.naturalHeight * scale / 2,
    img.naturalWidth * scale,
    img.naturalHeight * scale
  );
  ctx.restore();
}

function closePhotoEditorView(){
  photoEditorView.classList.remove("is-open");
  photoEditorView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}

export function openPhotoEditor(blob, aspectRatio){
  return new Promise((resolve) => {
    loadImage(blob).then((img) => {
      pendingResolve = resolve;
      let rotation = 0;
      let zoom = 1;
      let panX = 0;
      let panY = 0;

      const previewW = Math.min(photoEditorScroll.clientWidth - 40, 400) || 320;
      const previewH = Math.round(previewW / aspectRatio);

      photoEditorScroll.innerHTML = `
        <div class="add-topbar">
          <h2>Ajuster la photo</h2>
        </div>
        <div class="add-form">
          <div class="photo-editor-frame">
            <canvas id="photoEditorCanvas" width="${previewW}" height="${previewH}"></canvas>
          </div>
          <div class="field">
            <label for="photoEditorZoom">Zoom</label>
            <input type="range" id="photoEditorZoom" min="1" max="3" step="0.01" value="1">
          </div>
          <button type="button" class="dyn-add" id="photoEditorRotateBtn">Pivoter</button>
          <div class="add-actions">
            <button type="button" class="btn-secondary" id="photoEditorCancelBtn">Annuler</button>
            <button type="button" class="btn-primary" id="photoEditorConfirmBtn">Valider</button>
          </div>
        </div>
      `;

      const canvas = photoEditorScroll.querySelector("#photoEditorCanvas");
      const ctx = canvas.getContext("2d");
      const zoomInput = photoEditorScroll.querySelector("#photoEditorZoom");

      function render(){
        drawFrame(ctx, previewW, previewH, img, rotation, zoom, panX, panY);
      }
      render();

      let dragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let panStartX = 0;
      let panStartY = 0;

      canvas.addEventListener("pointerdown", (e) => {
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panStartX = panX;
        panStartY = panY;
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        panX = panStartX + (e.clientX - dragStartX);
        panY = panStartY + (e.clientY - dragStartY);
        render();
      });
      canvas.addEventListener("pointerup", () => { dragging = false; });
      canvas.addEventListener("pointercancel", () => { dragging = false; });

      zoomInput.addEventListener("input", () => {
        zoom = parseFloat(zoomInput.value);
        render();
      });

      photoEditorScroll.querySelector("#photoEditorRotateBtn").addEventListener("click", () => {
        rotation = (rotation + 90) % 360;
        render();
      });

      function finish(result){
        if (!pendingResolve) return;
        const doResolve = pendingResolve;
        pendingResolve = null;
        closePhotoEditorView();
        doResolve(result);
      }

      photoEditorCloseBtn.onclick = () => finish(null);
      photoEditorScroll.querySelector("#photoEditorCancelBtn").addEventListener("click", () => finish(null));
      photoEditorScroll.querySelector("#photoEditorConfirmBtn").addEventListener("click", () => {
        const outputW = 1200;
        const outputH = Math.round(outputW / aspectRatio);
        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputW;
        outputCanvas.height = outputH;
        const outputCtx = outputCanvas.getContext("2d");
        const ratio = outputW / previewW;
        drawFrame(outputCtx, outputW, outputH, img, rotation, zoom, panX * ratio, panY * ratio);
        outputCanvas.toBlob((outBlob) => finish(outBlob), "image/jpeg", 0.85);
      });

      photoEditorView.classList.add("is-open");
      photoEditorView.setAttribute("aria-hidden", "false");
      openSheetBackdrop();
      syncBodyScrollLock();
    });
  });
}

export function closePhotoEditor(){
  if (!photoEditorView.classList.contains("is-open")) return;
  closePhotoEditorView();
  if (pendingResolve) {
    const doResolve = pendingResolve;
    pendingResolve = null;
    doResolve(null);
  }
}
```

- [ ] **Step 4: Intégrer au verrouillage de scroll et à la fermeture globale, dans `public/js/ui.js`**

Remplacer :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { closeScanRecipe, openScanRecipe } from "./scan-recipe.js";
import { render } from "./grid.js";
```

par :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView, photoEditorView } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { closeScanRecipe, openScanRecipe } from "./scan-recipe.js";
import { closePhotoEditor } from "./photo-editor.js";
import { render } from "./grid.js";
```

Remplacer :

```js
export function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || scanView.classList.contains("is-open")
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
    || photoEditorView.classList.contains("is-open")
    || drawer.classList.contains("is-open");
  document.body.style.overflow = anyOpen ? "hidden" : "";
}
```

Remplacer :

```js
function closeAllOverlays(){
  closeDetail();
  closeAddForm();
  closePanier();
  closeProfile();
  closeScanRecipe();
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
  closePhotoEditor();
}
```

- [ ] **Step 5: Intégrer à `closeAnyOpenSheet`, dans `public/js/main.js`**

Remplacer :

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
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { closeScanRecipe } from "./scan-recipe.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, photoEditorView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, brandHomeBtn
} from "./dom.js";
import { render } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { closeScanRecipe } from "./scan-recipe.js";
import { closePhotoEditor } from "./photo-editor.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
```

Remplacer :

```js
function closeAnyOpenSheet(){
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
  if (scanView.classList.contains("is-open")) closeScanRecipe();
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
  if (photoEditorView.classList.contains("is-open")) closePhotoEditor();
}
```

Note : `photoEditorCloseBtn` n'est **pas** ajouté aux écouteurs `requestCloseSheet` de `main.js` (contrairement aux autres boutons ✕) — son clic doit résoudre la promesse en cours de `openPhotoEditor`, câblé dynamiquement à chaque ouverture dans `photo-editor.js` lui-même (Step 3, `photoEditorCloseBtn.onclick = ...`), pas via le mécanisme d'historique partagé des autres vues.

- [ ] **Step 6: Ajouter les styles du cadre de recadrage, dans `public/style.css`**

Remplacer :

```css
.scan-photo-remove:hover{ background: var(--terracotta-dark); }

.add-error{
```

par :

```css
.scan-photo-remove:hover{ background: var(--terracotta-dark); }

.photo-editor-frame{ display:flex; justify-content:center; }
.photo-editor-frame canvas{ touch-action:none; border-radius:6px; border:1px solid var(--line); cursor:grab; max-width:100%; }
.photo-editor-frame canvas:active{ cursor:grabbing; }

.add-error{
```

- [ ] **Step 7: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v27";
```

par :

```js
const CACHE_NAME = "carnet-cache-v28";
```

- [ ] **Step 8: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. Dans la console : `const mod = await import('/js/photo-editor.js'); const blob = await (await fetch('/icons/icon.svg')).blob(); mod.openPhotoEditor(blob, 16/9).then(r => console.log('résultat', r));` (utiliser n'importe quelle image accessible localement pour le test — le SVG passera par le chargement `Image()` sans problème pour valider le flux, même si le rendu visuel d'un SVG simple est peu représentatif).
- La vue s'ouvre en plein écran avec le canevas, le curseur de zoom, le bouton Pivoter, Annuler/Valider.
- Glisser sur le canevas déplace l'image ; le curseur de zoom l'agrandit ; Pivoter la fait tourner de 90° par clic.
- Cliquer Annuler (ou le ✕) → la promesse résout avec `null`, la vue se ferme.
- Rouvrir puis cliquer Valider → la promesse résout avec un `Blob` (vérifier `r.size > 0 && r.type === "image/jpeg"`), la vue se ferme.
- Aucune erreur console.

- [ ] **Step 9: Commit**

```bash
git add public/index.html public/js/dom.js public/js/photo-editor.js public/js/ui.js public/js/main.js public/style.css public/sw.js
git commit -m "Ajouter l'outil de recadrage et rotation de photo"
```

---

### Task 2: Brancher l'éditeur sur les champs photo du formulaire

**Files:**
- Modify: `public/js/add-form.js`
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Consumes: `openPhotoEditor(blob, aspectRatio)` (Task 1, depuis `./photo-editor.js`).
- `openAddForm`/`renderAddForm` gardent leur signature et comportement existants ; seul un nouveau comportement s'ajoute au changement de fichier sur les champs photo.

- [ ] **Step 1: Importer `openPhotoEditor`, dans `public/js/add-form.js`**

Remplacer :

```js
import { escapeAttr } from "./utils.js";
import { CATEGORY_ICON } from "./recipes-data.js";
```

par :

```js
import { escapeAttr } from "./utils.js";
import { CATEGORY_ICON } from "./recipes-data.js";
import { openPhotoEditor } from "./photo-editor.js";
```

- [ ] **Step 2: Brancher l'éditeur sur les photos d'étape, dans `createStepRow`**

Remplacer :

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

par :

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

- [ ] **Step 3: Brancher l'éditeur sur la photo principale, juste après le câblage de `#addCancelBtn`**

Remplacer :

```js
  addScroll.querySelector("#addMenuBtn").addEventListener("click", openDrawer);
  addScroll.querySelector("#addCancelBtn").addEventListener("click", closeAddForm);

  addForm.addEventListener("submit", async (e) => {
```

par :

```js
  addScroll.querySelector("#addMenuBtn").addEventListener("click", openDrawer);
  addScroll.querySelector("#addCancelBtn").addEventListener("click", closeAddForm);

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

  addForm.addEventListener("submit", async (e) => {
```

Note : ce nouvel écouteur ne se déclenche que sur une sélection **manuelle** de fichier (événement `change`) — l'attachement automatique de la photo scannée via `DataTransfer` (déjà en place, voir juste avant dans `renderAddForm`) ne déclenche jamais d'événement `change`, donc n'entre pas en conflit avec ce nouveau code. L'édition de la photo scannée elle-même se fait en amont, dans la Task 3.

- [ ] **Step 4: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v28";
```

par :

```js
const CACHE_NAME = "carnet-cache-v29";
```

- [ ] **Step 5: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter (nécessite un compte réel — signaler en DONE_WITH_CONCERNS si indisponible, et vérifier ce qui peut l'être statiquement : pas d'erreur de syntaxe, l'écouteur `change` est bien attaché).
- Ouvrir "Nouvelle recette", choisir un fichier dans le champ Photo → l'éditeur s'ouvre en 16:9. Valider → le champ Photo contient bien le fichier édité (vérifiable via `addForm.querySelector("#addPhoto").files[0]` dans la console, taille/type cohérents). Annuler → le champ Photo reste vide.
- Ajouter une étape, choisir un fichier dans son champ photo → l'éditeur s'ouvre en 1:1 (cadre carré, visuellement différent du 16:9 de la photo principale). Valider/Annuler se comportent pareil.
- Enregistrer une recette avec une photo principale éditée → elle apparaît normalement sur la fiche recette et dans la grille.
- Aucune erreur console.

- [ ] **Step 6: Commit**

```bash
git add public/js/add-form.js public/sw.js
git commit -m "Brancher l'editeur photo sur les champs photo du formulaire"
```

---

### Task 3: Brancher l'éditeur sur la photo du scan

**Files:**
- Modify: `public/js/scan-recipe.js`
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Consumes: `openPhotoEditor(blob, aspectRatio)` (Task 1).

- [ ] **Step 1: Importer `openPhotoEditor`, dans `public/js/scan-recipe.js`**

Remplacer :

```js
import { supabase, SUPABASE_URL } from "./supabase-client.js";
import { CATEGORY_ICON } from "./recipes-data.js";
import { openAddForm } from "./add-form.js";
```

par :

```js
import { supabase, SUPABASE_URL } from "./supabase-client.js";
import { CATEGORY_ICON } from "./recipes-data.js";
import { openAddForm } from "./add-form.js";
import { openPhotoEditor } from "./photo-editor.js";
```

- [ ] **Step 2: Éditer la première photo capturée avant d'ouvrir le formulaire**

Remplacer :

```js
    try {
      const raw = await scanRecipeImages(capturedFiles);
      const prefillData = sanitizeExtractedRecipe(raw, capturedFiles[0]);
      closeScanRecipe();
      openAddForm(null, prefillData);
    } catch (err) {
```

par :

```js
    try {
      const raw = await scanRecipeImages(capturedFiles);
      const editedPhoto = await openPhotoEditor(capturedFiles[0], 16 / 9);
      const prefillData = sanitizeExtractedRecipe(raw, editedPhoto || undefined);
      closeScanRecipe();
      openAddForm(null, prefillData);
    } catch (err) {
```

Note : si l'utilisateur annule l'édition (`editedPhoto` vaut `null`), `photoBlob` vaut `undefined` dans `prefillData` — la recette pré-remplie n'a alors aucune photo, plutôt que de retomber sur la photo brute non éditée (cohérent avec la règle des Global Constraints).

- [ ] **Step 3: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v29";
```

par :

```js
const CACHE_NAME = "carnet-cache-v30";
```

- [ ] **Step 4: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter (nécessite un compte réel + la Edge Function `scan-recipe` déployée pour un test bout en bout — signaler en DONE_WITH_CONCERNS si indisponible).
- Scanner une recette, extraire → une fois l'extraction terminée, l'éditeur photo s'ouvre en 16:9 sur la première photo capturée, **avant** l'apparition du formulaire pré-rempli.
- Valider l'édition → le formulaire s'ouvre avec la photo éditée déjà attachée au champ Photo.
- Annuler l'édition → le formulaire s'ouvre quand même (extraction du texte non perdue), mais sans photo attachée.
- Aucune erreur console.

- [ ] **Step 5: Commit**

```bash
git add public/js/scan-recipe.js public/sw.js
git commit -m "Brancher l'editeur photo sur la photo issue du scan"
```

---

### Task 4: Bandeau photo à ratio fixe sur la fiche recette

**Files:**
- Modify: `public/js/detail.js`
- Modify: `public/js/photos.js`
- Modify: `public/style.css`
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- `applyDetailPhoto(recipeId, heroEl)` (déjà exportée depuis `photos.js`, consommée par `detail.js`) change d'implémentation interne (une vraie balise `<img>` au lieu d'un `background-image`) mais garde exactement la même signature et le même appelant.

- [ ] **Step 1: Séparer la photo du bloc titre/description, dans `public/js/detail.js`**

Remplacer :

```js
  detailScroll.innerHTML = `
    <div class="detail-hero" id="detailHero">
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          <button class="detail-fav is-menu" id="detailMenuBtn" type="button" aria-label="Ouvrir le menu">
            <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="detail-heading">
        <div class="detail-heading-text">
          <span class="detail-eyebrow">${r.category}</span>
          <h2>${r.title}</h2>
          <p class="detail-sub">${r.desc}</p>
        </div>
        <div class="detail-actions-row">
          <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
          <button class="detail-fav" id="detailDeleteBtn" type="button" aria-label="Supprimer la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="detail-fav has-cart-badge" id="detailCartBtn" type="button" aria-label="Ouvrir le panier de courses">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span id="detailCartBadge" class="cart-badge" ${cart.length === 0 ? "hidden" : ""}>${cart.length}</span>
          </button>
          <button class="detail-fav" id="detailFavBtn" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="detail-info">
      <div class="stats-flat" id="statsFlat">
```

par :

```js
  detailScroll.innerHTML = `
    <div class="detail-hero" id="detailHero">
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          <button class="detail-fav is-menu" id="detailMenuBtn" type="button" aria-label="Ouvrir le menu">
            <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="detail-heading">
      <div class="detail-heading-text">
        <span class="detail-eyebrow">${r.category}</span>
        <h2>${r.title}</h2>
        <p class="detail-sub">${r.desc}</p>
      </div>
      <div class="detail-actions-row">
        <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <button class="detail-fav" id="detailDeleteBtn" type="button" aria-label="Supprimer la recette">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="detail-fav has-cart-badge" id="detailCartBtn" type="button" aria-label="Ouvrir le panier de courses">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <span id="detailCartBadge" class="cart-badge" ${cart.length === 0 ? "hidden" : ""}>${cart.length}</span>
        </button>
        <button class="detail-fav" id="detailFavBtn" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris">
          <svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
    <div class="detail-info">
      <div class="stats-flat" id="statsFlat">
```

- [ ] **Step 2: Passer `applyDetailPhoto` d'un `background-image` à une balise `<img>`, dans `public/js/photos.js`**

Remplacer :

```js
export function applyDetailPhoto(recipeId, heroEl){
  getPhotoWithFallback(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  }).catch(() => {});
}
```

par :

```js
export function applyDetailPhoto(recipeId, heroEl){
  getPhotoWithFallback(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.classList.add("has-photo");
    const img = document.createElement("img");
    img.src = URL.createObjectURL(blob);
    img.alt = "";
    heroEl.appendChild(img);
  }).catch(() => {});
}
```

- [ ] **Step 3: Réécrire les styles de `.detail-hero`/`.detail-heading`, dans `public/style.css`**

Remplacer :

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
  background: linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.75) 100%);
  pointer-events:none;
}
.detail-topbar{ display:flex; align-items:center; justify-content:space-between; width:100%; max-width:1080px; margin:0 auto 18px; }
```

par :

```css
.detail-hero{
  position: relative;
  aspect-ratio: 16 / 9;
  overflow:hidden;
  background: linear-gradient(135deg, var(--accent-tint), var(--accent) 130%);
  padding: 14px;
}
.detail-hero.has-photo img{
  position:absolute; inset:0; z-index:0;
  width:100%; height:100%; object-fit:cover; display:block;
}
.detail-topbar{ position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; width:100%; max-width:1080px; margin:0 auto; }
```

Remplacer :

```css
.detail-topbar, .detail-heading{ position:relative; z-index:1; }
.detail-heading{
  width:100%; max-width:760px; margin:0 auto;
  display:flex; align-items:flex-end; justify-content:space-between; gap:16px;
}
```

par :

```css
.detail-heading{
  width:100%; max-width:760px; margin:0 auto; padding: 18px 20px 0;
  display:flex; align-items:flex-start; justify-content:space-between; gap:16px;
}
```

Remplacer :

```css
.hf-theme .detail-eyebrow{ color:#fff; opacity:.9; }
.hf-theme .detail-heading h2{ color:#fff; }
.hf-theme .detail-sub{ color: rgba(255,255,255,.9); }
```

par :

```css
```

(supprime entièrement ces trois lignes — le texte ne repose plus sur la photo, il utilise les couleurs de base déjà correctes sur fond clair. Ne pas toucher à la règle `.hf-theme .detail-heading h2{ font-style: normal; font-weight: 800; }` qui existe séparément plus haut dans le fichier, à un autre endroit — c'est une règle typographique indépendante, pas une couleur.)

- [ ] **Step 4: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v30";
```

par :

```js
const CACHE_NAME = "carnet-cache-v31";
```

- [ ] **Step 5: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter.
- Ouvrir une recette **avec** photo : le bandeau photo a un ratio 16:9 fixe (mesurer via `getBoundingClientRect()` sur `#detailHero` : `height` doit être proche de `width * 9/16`), défile normalement avec le reste de la page (n'est plus collé en haut au scroll), titre/description bien lisibles en dessous sur fond clair.
- Ouvrir une recette **sans** photo : bandeau au même ratio 16:9, fond dégradé par catégorie comme avant, pas de régression visuelle.
- Bouton menu (☰) toujours cliquable et visible en haut du bandeau, même avec une photo derrière.
- Boutons favoris/modifier/supprimer/panier toujours fonctionnels, maintenant sous la photo.
- Aucune erreur console.

- [ ] **Step 6: Commit**

```bash
git add public/js/detail.js public/js/photos.js public/style.css public/sw.js
git commit -m "Passer le bandeau photo de la fiche recette a un ratio fixe non-sticky"
```

---

### Task 5: Description courte tronquée avec "Voir plus"

**Files:**
- Modify: `public/js/detail.js`
- Modify: `public/style.css`
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:** aucune nouvelle interface exportée — comportement purement local à `openDetail`.

- [ ] **Step 1: Ajouter l'id et le bouton "Voir plus", dans `public/js/detail.js`**

Remplacer :

```js
      <div class="detail-heading-text">
        <span class="detail-eyebrow">${r.category}</span>
        <h2>${r.title}</h2>
        <p class="detail-sub">${r.desc}</p>
      </div>
```

par :

```js
      <div class="detail-heading-text">
        <span class="detail-eyebrow">${r.category}</span>
        <h2>${r.title}</h2>
        <p class="detail-sub" id="detailSub">${r.desc}</p>
        <button type="button" class="detail-sub-toggle" id="detailSubToggle" hidden>Voir plus</button>
      </div>
```

- [ ] **Step 2: Détecter la troncature et câbler le bouton, juste après le câblage des boutons existants**

Remplacer :

```js
  detailScroll.querySelector("#detailFavBtn").addEventListener("click", () => toggleFavorite(r.id));
  detailScroll.querySelector("#detailCartBtn").addEventListener("click", goToPanierFromDetail);
  detailScroll.querySelector("#detailMenuBtn").addEventListener("click", openDrawer);
  detailScroll.querySelector("#detailEditBtn").addEventListener("click", () => goToEditRecipe(r));
  detailScroll.querySelector("#detailDeleteBtn").addEventListener("click", () => deleteRecipe(r.id));
```

par :

```js
  detailScroll.querySelector("#detailFavBtn").addEventListener("click", () => toggleFavorite(r.id));
  detailScroll.querySelector("#detailCartBtn").addEventListener("click", goToPanierFromDetail);
  detailScroll.querySelector("#detailMenuBtn").addEventListener("click", openDrawer);
  detailScroll.querySelector("#detailEditBtn").addEventListener("click", () => goToEditRecipe(r));
  detailScroll.querySelector("#detailDeleteBtn").addEventListener("click", () => deleteRecipe(r.id));

  const detailSubEl = detailScroll.querySelector("#detailSub");
  const detailSubToggle = detailScroll.querySelector("#detailSubToggle");
  requestAnimationFrame(() => {
    if (detailSubEl.scrollHeight > detailSubEl.clientHeight + 1) {
      detailSubToggle.hidden = false;
    }
  });
  detailSubToggle.addEventListener("click", () => {
    detailSubEl.classList.add("is-expanded");
    detailSubToggle.hidden = true;
  });
```

- [ ] **Step 3: Ajouter le troncage et le style du lien, dans `public/style.css`**

Remplacer :

```css
.detail-sub{ color: var(--ink-soft); font-size:.9rem; margin-top:10px; max-width:60ch; }
```

par :

```css
.detail-sub{
  color: var(--ink-soft); font-size:.9rem; margin-top:10px; max-width:60ch;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
}
.detail-sub.is-expanded{ -webkit-line-clamp:unset; overflow:visible; }
.detail-sub-toggle{
  background:none; border:none; padding:0; margin-top:4px;
  color: var(--emerald-dark); font-weight:700; font-size:.82rem; text-decoration:underline; cursor:pointer;
}
```

- [ ] **Step 4: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v31";
```

par :

```js
const CACHE_NAME = "carnet-cache-v32";
```

- [ ] **Step 5: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter.
- Ouvrir une recette avec une description longue (plus de 2 lignes à la largeur de l'écran) → seules 2 lignes visibles, lien "Voir plus" affiché en dessous. Cliquer dessus → texte complet visible, lien disparu.
- Ouvrir une recette avec une description courte (tient en 1-2 lignes) → aucun lien "Voir plus" n'apparaît.
- Aucune erreur console.

- [ ] **Step 6: Commit**

```bash
git add public/js/detail.js public/style.css public/sw.js
git commit -m "Tronquer la description courte de la fiche recette avec Voir plus"
```
