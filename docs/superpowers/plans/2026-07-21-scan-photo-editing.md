# Édition photo à la capture (scan) + bouton d'amélioration — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dans "Scanner une recette", ouvrir l'écran d'édition (zoom/pivoter) immédiatement après chaque photo prise (16:9 pour la 1re, ratio naturel pour les suivantes) au lieu d'après le clic sur "Extraire" ; ajouter un bouton "Améliorer" (luminosité/contraste/saturation) dans l'éditeur photo partagé, disponible partout où il est utilisé.

**Architecture:** `public/js/photo-editor.js` (composant partagé utilisé par la photo principale, les photos d'étape et la capture de scan) gagne un ratio d'aspect optionnel (ratio naturel de l'image si omis) et un état d'amélioration bascule appliqué via `ctx.filter` sur le canevas. `public/js/scan-recipe.js` déplace le déclenchement de l'édition du handler "Extraire" vers le handler de capture caméra.

**Tech Stack:** Canvas 2D (`ctx.filter`), aucun framework de build/test.

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v38`).
- Les appels existants à `openPhotoEditor` avec un ratio explicite (photo principale `16/9`, photo d'étape `1`) doivent rester inchangés dans leur comportement.
- L'amélioration est une bascule on/off fixe (`brightness(1.15) contrast(1.1) saturate(1.05)`) — pas de curseur manuel.
- Les fichiers du site sont dans `public/`.

---

### Task 1: Ratio d'aspect optionnel et bouton "Améliorer" (`public/js/photo-editor.js`, `public/style.css`)

**Files:**
- Modify: `public/js/photo-editor.js`
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- `openPhotoEditor(blob, aspectRatio)` : `aspectRatio` devient optionnel — si omis/`undefined`, le ratio effectif est déduit des dimensions naturelles de l'image chargée. Signature de retour inchangée (`Promise<Blob|null>`).
- Consumed par Task 2 (`public/js/scan-recipe.js`, pas encore modifié à ce stade) et par les appelants existants (`public/js/add-form.js`, déjà en place, non modifiés par cette tâche).

- [x] **Step 1: Ajouter le paramètre `enhanced` à `drawFrame`**

Dans `public/js/photo-editor.js`, remplacer :

```js
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
```

par :

```js
function drawFrame(ctx, canvasW, canvasH, img, rotation, zoom, panX, panY, enhanced){
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
  ctx.filter = enhanced ? "brightness(1.15) contrast(1.1) saturate(1.05)" : "none";
  ctx.drawImage(
    img,
    -img.naturalWidth * scale / 2,
    -img.naturalHeight * scale / 2,
    img.naturalWidth * scale,
    img.naturalHeight * scale
  );
  ctx.restore();
}
```

- [x] **Step 2: Ratio d'aspect optionnel, état `enhanced`, bouton "Améliorer"**

Dans `public/js/photo-editor.js`, remplacer toute la fonction `openPhotoEditor` :

```js
export function openPhotoEditor(blob, aspectRatio){
  return new Promise((resolve) => {
    pendingResolve = resolve;
    loadImage(blob).then((img) => {
      if (!pendingResolve) return;
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

      photoEditorCloseBtn.onclick = () => settle(null);
      photoEditorScroll.querySelector("#photoEditorCancelBtn").addEventListener("click", () => settle(null));
      photoEditorScroll.querySelector("#photoEditorConfirmBtn").addEventListener("click", () => {
        const outputW = 1200;
        const outputH = Math.round(outputW / aspectRatio);
        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputW;
        outputCanvas.height = outputH;
        const outputCtx = outputCanvas.getContext("2d");
        const ratio = outputW / previewW;
        drawFrame(outputCtx, outputW, outputH, img, rotation, zoom, panX * ratio, panY * ratio);
        outputCanvas.toBlob((outBlob) => settle(outBlob), "image/jpeg", 0.85);
      });

      photoEditorView.classList.add("is-open");
      photoEditorView.setAttribute("aria-hidden", "false");
      openSheetBackdrop();
      syncBodyScrollLock();
    }).catch((err) => {
      console.error("photo-editor:", err);
      settle(null);
    });
  });
}
```

par :

```js
export function openPhotoEditor(blob, aspectRatio){
  return new Promise((resolve) => {
    pendingResolve = resolve;
    loadImage(blob).then((img) => {
      if (!pendingResolve) return;
      const ratio = aspectRatio || (img.naturalWidth / img.naturalHeight);
      let rotation = 0;
      let zoom = 1;
      let panX = 0;
      let panY = 0;
      let enhanced = false;

      const previewW = Math.min(photoEditorScroll.clientWidth - 40, 400) || 320;
      const previewH = Math.round(previewW / ratio);

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
          <div class="photo-editor-tools">
            <button type="button" class="dyn-add" id="photoEditorRotateBtn">Pivoter</button>
            <button type="button" class="dyn-add" id="photoEditorEnhanceBtn">Améliorer</button>
          </div>
          <div class="add-actions">
            <button type="button" class="btn-secondary" id="photoEditorCancelBtn">Annuler</button>
            <button type="button" class="btn-primary" id="photoEditorConfirmBtn">Valider</button>
          </div>
        </div>
      `;

      const canvas = photoEditorScroll.querySelector("#photoEditorCanvas");
      const ctx = canvas.getContext("2d");
      const zoomInput = photoEditorScroll.querySelector("#photoEditorZoom");
      const enhanceBtn = photoEditorScroll.querySelector("#photoEditorEnhanceBtn");

      function render(){
        drawFrame(ctx, previewW, previewH, img, rotation, zoom, panX, panY, enhanced);
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

      enhanceBtn.addEventListener("click", () => {
        enhanced = !enhanced;
        enhanceBtn.classList.toggle("is-active", enhanced);
        render();
      });

      photoEditorCloseBtn.onclick = () => settle(null);
      photoEditorScroll.querySelector("#photoEditorCancelBtn").addEventListener("click", () => settle(null));
      photoEditorScroll.querySelector("#photoEditorConfirmBtn").addEventListener("click", () => {
        const outputW = 1200;
        const outputH = Math.round(outputW / ratio);
        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputW;
        outputCanvas.height = outputH;
        const outputCtx = outputCanvas.getContext("2d");
        const scaleRatio = outputW / previewW;
        drawFrame(outputCtx, outputW, outputH, img, rotation, zoom, panX * scaleRatio, panY * scaleRatio, enhanced);
        outputCanvas.toBlob((outBlob) => settle(outBlob), "image/jpeg", 0.85);
      });

      photoEditorView.classList.add("is-open");
      photoEditorView.setAttribute("aria-hidden", "false");
      openSheetBackdrop();
      syncBodyScrollLock();
    }).catch((err) => {
      console.error("photo-editor:", err);
      settle(null);
    });
  });
}
```

Notes pour l'implémenteur :
- `ratio` (nouvelle variable) remplace `aspectRatio` dans les deux calculs de dimensions (`previewH`, `outputH`) — `aspectRatio` lui-même reste le paramètre brut (potentiellement `undefined`), inchangé.
- La variable locale `ratio` qui existait déjà dans le handler du bouton Valider (`const ratio = outputW / previewW;`) est renommée `scaleRatio` pour ne pas entrer en conflit de nom avec le nouveau `ratio` du ratio d'aspect déclaré plus haut dans la même fonction englobante — un second `const ratio` dans ce handler aurait techniquement fonctionné (nouvelle portée de fonction fléchée) mais aurait été source de confusion en lecture.
- `enhanceBtn` est récupéré une seule fois (comme `zoomInput`) plutôt que requêté à nouveau dans son propre handler, cohérent avec le style existant du fichier.

- [x] **Step 3: Styles du bouton actif et de la rangée d'outils**

Dans `public/style.css`, remplacer :

```css
.dyn-add{
  border:1px solid var(--line); background: var(--surface); color: var(--ink);
  border-radius: 999px; padding: 9px 16px; font-size:.82rem; font-weight:700;
}
.dyn-add:hover{ border-color: var(--emerald); color: var(--emerald-dark); }
```

par :

```css
.dyn-add{
  border:1px solid var(--line); background: var(--surface); color: var(--ink);
  border-radius: 999px; padding: 9px 16px; font-size:.82rem; font-weight:700;
}
.dyn-add:hover{ border-color: var(--emerald); color: var(--emerald-dark); }
.dyn-add.is-active{ background: var(--emerald); color:#fff; border-color: var(--emerald); }
```

Puis, dans le même fichier, remplacer :

```css
.photo-editor-frame{ display:flex; justify-content:center; }
.photo-editor-frame canvas{ touch-action:none; border-radius:6px; border:1px solid var(--line); cursor:grab; max-width:100%; }
.photo-editor-frame canvas:active{ cursor:grabbing; }
```

par :

```css
.photo-editor-frame{ display:flex; justify-content:center; }
.photo-editor-frame canvas{ touch-action:none; border-radius:6px; border:1px solid var(--line); cursor:grab; max-width:100%; }
.photo-editor-frame canvas:active{ cursor:grabbing; }
.photo-editor-tools{ display:flex; gap:8px; }
```

- [x] **Step 4: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v38";
```

par :

```js
const CACHE_NAME = "carnet-cache-v39";
```

- [x] **Step 5: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois. Aucune erreur console au chargement. DevTools → Application → Cache Storage doit montrer `carnet-cache-v39`.

Dans la console, tester l'éditeur directement (pas besoin d'être connecté — ce module n'a pas de dépendance Supabase) :

```js
const mod = await import('/js/photo-editor.js');
const blob = await (await fetch('/icons/icon.svg')).blob();
mod.openPhotoEditor(blob, 16/9).then(r => console.log('résultat 16:9', r));
```

- L'écran "Ajuster la photo" s'ouvre avec le canevas, le curseur de zoom, les boutons "Pivoter" et "Améliorer" côte à côte, puis Annuler/Valider.
- Cliquer "Améliorer" : l'aperçu devient visiblement plus lumineux/contrasté, le bouton passe à un fond coloré (vert).
- Cliquer "Améliorer" à nouveau : l'aperçu revient à la normale, le bouton reprend son apparence initiale.
- Cliquer "Pivoter" : l'image tourne de 90°, indépendamment de l'état "Améliorer" (qui reste actif s'il l'était).
- Cliquer "Valider" avec "Améliorer" actif : la promesse résout avec un `Blob` (`r.size > 0 && r.type === "image/jpeg"`), la vue se ferme.

Relancer avec un ratio omis, pour vérifier le ratio naturel :

```js
mod.openPhotoEditor(blob).then(r => console.log('résultat ratio naturel', r));
```

- L'écran s'ouvre sans erreur ; la forme du canevas (rapport largeur/hauteur) correspond à l'image chargée plutôt qu'à un 16:9 forcé (vérifiable via `document.querySelector('#photoEditorCanvas').width / document.querySelector('#photoEditorCanvas').height` comparé au ratio connu de l'image de test).
- Annuler (bouton Annuler ou ✕) : la promesse résout avec `null`.

Aucune erreur console sur l'ensemble de ces parcours.

- [x] **Step 6: Commit**

```bash
git add public/js/photo-editor.js public/style.css public/sw.js
git commit -m "Ajouter un ratio d'aspect optionnel et un bouton Ameliorer a l'editeur photo"
```

---

### Task 2: Édition à chaque photo capturée dans le scan (`public/js/scan-recipe.js`)

**Files:**
- Modify: `public/js/scan-recipe.js`
- Modify: `public/sw.js`

**Interfaces:**
- Consumes: `openPhotoEditor(blob, aspectRatio)` avec `aspectRatio` optionnel, de `public/js/photo-editor.js` (Task 1).

- [x] **Step 1: Éditer chaque photo à la capture, avant de l'ajouter**

Dans `public/js/scan-recipe.js`, remplacer :

```js
  scanScroll.querySelector("#scanCameraInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) capturedFiles.push(file);
    e.target.value = "";
    renderPhotoThumbs();
    updateScanButtons();
  });
```

par :

```js
  scanScroll.querySelector("#scanCameraInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const aspectRatio = capturedFiles.length === 0 ? 16 / 9 : undefined;
    const edited = await openPhotoEditor(file, aspectRatio);
    if (!edited) return;
    capturedFiles.push(edited);
    renderPhotoThumbs();
    updateScanButtons();
  });
```

Notes pour l'implémenteur :
- `capturedFiles.length === 0` est évalué **avant** l'ajout de cette photo — c'est donc bien "est-ce que ce sera la première photo capturée" qui détermine le ratio 16:9, exactement le même critère que celui utilisé plus loin par `sanitizeExtractedRecipe(raw, capturedFiles[0])` pour désigner la photo principale.
- Si l'utilisateur annule l'édition (`edited` est `null`), la fonction retourne immédiatement — la photo n'est jamais ajoutée à `capturedFiles`, aucune miniature n'apparaît, cohérent avec le comportement "annuler = photo écartée" du design.
- `e.target.value = ""` est déplacé avant l'`await` (au lieu d'après, comme dans l'ancien code) : il doit être réinitialisé dès que le fichier est lu, indépendamment du résultat de l'édition, pour permettre de reprendre une photo au même index si besoin.

- [x] **Step 2: Retirer l'édition redondante après "Extraire"**

Dans `public/js/scan-recipe.js`, remplacer :

```js
    try {
      const raw = await scanRecipeImages(capturedFiles);
      const editedPhoto = await openPhotoEditor(capturedFiles[0], 16 / 9);
      const prefillData = sanitizeExtractedRecipe(raw, editedPhoto || undefined);
      closeScanRecipe();
      openAddForm(null, prefillData);
    } catch (err) {
```

par :

```js
    try {
      const raw = await scanRecipeImages(capturedFiles);
      const prefillData = sanitizeExtractedRecipe(raw, capturedFiles[0]);
      closeScanRecipe();
      openAddForm(null, prefillData);
    } catch (err) {
```

- [x] **Step 3: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v39";
```

par :

```js
const CACHE_NAME = "carnet-cache-v40";
```

- [x] **Step 4: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v40`.

Ce test nécessite d'être connecté à l'application (le menu et la vue de scan sont derrière l'écran de connexion) — si aucune session authentifiée n'est disponible dans l'environnement de test, effectuer une relecture statique attentive du diff et le signaler dans le rapport (DONE_WITH_CONCERNS), plutôt que de bloquer sur cette étape.

Si une session est disponible, ouvrir "Scanner une recette" puis, dans la console (simule une capture caméra sans matériel photo) :

```js
const input = document.querySelector('#scanCameraInput');
const blob = await (await fetch('/icons/icon.svg')).blob();
const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });
const dt = new DataTransfer();
dt.items.add(file);
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
```

- L'écran "Ajuster la photo" s'ouvre immédiatement avec un cadrage 16:9 (première photo).
- Cliquer "Annuler" : aucune miniature n'apparaît dans `#scanPhotos`, le bouton "Extraire" reste désactivé.
- Relancer le même script : cette fois cliquer "Valider" — une miniature apparaît.
- Relancer le script une 2e fois (toujours avec `capturedFiles.length` maintenant à 1) : l'écran d'édition s'ouvre avec le ratio naturel de l'image de test (pas 16:9) — vérifiable comme au Step 5 de la Task 1.
- Valider : une 2e miniature apparaît.
- Cliquer "Extraire" (nécessite une session authentifiée valide pour l'appel à la fonction Supabase `scan-recipe`) : le bouton passe à "Analyse en cours…" puis le formulaire pré-rempli s'ouvre directement, sans écran d'édition intermédiaire entre l'analyse et le formulaire.

Aucune erreur console sur l'ensemble de ces parcours.

- [x] **Step 5: Commit**

```bash
git add public/js/scan-recipe.js public/sw.js
git commit -m "Editer chaque photo a la capture dans le scan, au lieu d'apres Extraire"
```
