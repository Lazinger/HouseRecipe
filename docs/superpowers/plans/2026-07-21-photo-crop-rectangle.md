# Cadre de recadrage à poignées — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le mécanisme de recadrage par zoom + déplacement de l'éditeur photo par un cadre de recadrage à poignées, déplaçable et redimensionnable, qui peut dépasser les bords de la photo (marges en fond neutre).

**Architecture:** `public/js/photo-editor.js` garde la même signature publique (`openPhotoEditor(blob, aspectRatio)` → `Promise<Blob|null>`) mais réécrit entièrement son mécanisme interne : la rotation est "cuite" dans un canevas intermédiaire (`rotatedCanvas`) dès qu'elle change, ce qui réduit tout le reste (aperçu, redimensionnement du cadre, export) à de la géométrie simple non tournée. Le cadre de recadrage est un état `{cropX, cropY, cropW, cropH}` en coordonnées du canevas d'aperçu, manipulé via les événements pointer existants.

**Tech Stack:** Canvas 2D, événements Pointer, aucun framework de build/test.

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v40`).
- La signature de `openPhotoEditor(blob, aspectRatio)` ne change pas — les 3 appelants existants (`public/js/add-form.js` ×2, `public/js/scan-recipe.js`) ne sont pas modifiés par ce plan.
- Le cadre reste bloqué sur `aspectRatio` quand il est fourni (photo principale `16/9`, photo d'étape `1`) ; libre quand il est omis (photo de scan autre que la 1re).
- Le cadre peut dépasser les bords de la photo affichée (jusqu'aux limites du canevas de travail) ; la zone hors photo reste en fond neutre `#FBFAF6`, dans l'aperçu comme dans l'export.
- Le bouton "Améliorer" (`brightness(1.15) contrast(1.1) saturate(1.05)`) reste inchangé dans son comportement.
- Les fichiers du site sont dans `public/`.

---

### Task 1: Cadre de recadrage à poignées (`public/js/photo-editor.js`, `public/style.css`)

**Files:**
- Modify: `public/js/photo-editor.js` (réécriture quasi complète)
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- `openPhotoEditor(blob, aspectRatio)` : signature et type de retour (`Promise<Blob|null>`) inchangés — comportement observable pour les appelants existants inchangé pour ce qui est de la forme finale de l'image (toujours `aspectRatio` si fourni), seul le mécanisme d'interaction utilisateur change.
- `closePhotoEditor()` : inchangé.

- [ ] **Step 1: Remplacer tout le contenu du fichier**

Remplacer l'intégralité de `public/js/photo-editor.js` par :

```js
import { photoEditorView, photoEditorScroll, photoEditorCloseBtn } from "./dom.js";
import { syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";

/* ---- éditeur de photo : cadre de recadrage à poignées + rotation + amélioration avant sauvegarde ---- */
let pendingResolve = null;

const HANDLE_SIZE = 14;
const HANDLE_HIT = 22;
const MIN_CROP = 40;
const ENHANCE_FILTER = "brightness(1.15) contrast(1.1) saturate(1.05)";

function clamp(v, min, max){
  return Math.min(Math.max(v, min), max);
}

function loadImage(blob){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function buildRotatedCanvas(img, rotation){
  const swapped = rotation === 90 || rotation === 270;
  const w = swapped ? img.naturalHeight : img.naturalWidth;
  const h = swapped ? img.naturalWidth : img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas;
}

function closePhotoEditorView(){
  photoEditorView.classList.remove("is-open");
  photoEditorView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}

function settle(result){
  if (!pendingResolve) return;
  const doResolve = pendingResolve;
  pendingResolve = null;
  closePhotoEditorView();
  doResolve(result);
}

export function openPhotoEditor(blob, aspectRatio){
  return new Promise((resolve) => {
    pendingResolve = resolve;
    loadImage(blob).then((img) => {
      if (!pendingResolve) return;

      let rotation = 0;
      let enhanced = false;
      let rotatedCanvas = buildRotatedCanvas(img, rotation);
      let cropX, cropY, cropW, cropH;

      const previewSize = Math.min(photoEditorScroll.clientWidth - 40, 400) || 320;

      function photoLayout(){
        const scale = Math.min(previewSize / rotatedCanvas.width, previewSize / rotatedCanvas.height);
        const w = rotatedCanvas.width * scale;
        const h = rotatedCanvas.height * scale;
        return { x: (previewSize - w) / 2, y: (previewSize - h) / 2, w, h, scale };
      }

      function resetCrop(){
        const { x, y, w, h } = photoLayout();
        const targetRatio = aspectRatio !== undefined ? aspectRatio : (w / h);
        let cw, ch;
        if (w / h > targetRatio) { ch = h; cw = ch * targetRatio; }
        else { cw = w; ch = cw / targetRatio; }
        cropW = cw;
        cropH = ch;
        cropX = x + (w - cw) / 2;
        cropY = y + (h - ch) / 2;
      }
      resetCrop();

      photoEditorScroll.innerHTML = `
        <div class="add-topbar">
          <h2>Ajuster la photo</h2>
        </div>
        <div class="add-form">
          <div class="photo-editor-frame">
            <canvas id="photoEditorCanvas" width="${previewSize}" height="${previewSize}"></canvas>
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
      const enhanceBtn = photoEditorScroll.querySelector("#photoEditorEnhanceBtn");

      function render(){
        const { x, y, w, h } = photoLayout();
        ctx.save();
        ctx.fillStyle = "#FBFAF6";
        ctx.fillRect(0, 0, previewSize, previewSize);
        ctx.filter = enhanced ? ENHANCE_FILTER : "none";
        ctx.drawImage(rotatedCanvas, x, y, w, h);
        ctx.filter = "none";

        ctx.beginPath();
        ctx.rect(0, 0, previewSize, previewSize);
        ctx.rect(cropX, cropY, cropW, cropH);
        ctx.clip("evenodd");
        ctx.fillStyle = "rgba(0,0,0,.45)";
        ctx.fillRect(0, 0, previewSize, previewSize);
        ctx.restore();

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(cropX, cropY, cropW, cropH);

        ctx.fillStyle = "#fff";
        [[cropX, cropY], [cropX + cropW, cropY], [cropX, cropY + cropH], [cropX + cropW, cropY + cropH]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - HANDLE_SIZE / 2, hy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        });
      }
      render();

      let dragMode = null;
      let dragCorner = null;
      let dragStartX = 0;
      let dragStartY = 0;
      let dragCropX = 0, dragCropY = 0, dragCropW = 0, dragCropH = 0;

      function canvasPoint(e){
        const rect = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left) * (previewSize / rect.width),
          y: (e.clientY - rect.top) * (previewSize / rect.height)
        };
      }

      function hitCorner(px, py){
        const corners = {
          tl: [cropX, cropY],
          tr: [cropX + cropW, cropY],
          bl: [cropX, cropY + cropH],
          br: [cropX + cropW, cropY + cropH]
        };
        for (const key of Object.keys(corners)) {
          const [hx, hy] = corners[key];
          if (Math.abs(px - hx) <= HANDLE_HIT && Math.abs(py - hy) <= HANDLE_HIT) return key;
        }
        return null;
      }

      canvas.addEventListener("pointerdown", (e) => {
        const p = canvasPoint(e);
        const corner = hitCorner(p.x, p.y);
        if (corner) {
          dragMode = "resize";
          dragCorner = corner;
        } else if (p.x >= cropX && p.x <= cropX + cropW && p.y >= cropY && p.y <= cropY + cropH) {
          dragMode = "move";
        } else {
          return;
        }
        dragStartX = p.x;
        dragStartY = p.y;
        dragCropX = cropX;
        dragCropY = cropY;
        dragCropW = cropW;
        dragCropH = cropH;
        canvas.setPointerCapture(e.pointerId);
      });

      canvas.addEventListener("pointermove", (e) => {
        if (!dragMode) return;
        const p = canvasPoint(e);
        const dx = p.x - dragStartX;
        const dy = p.y - dragStartY;
        if (dragMode === "move") {
          cropX = clamp(dragCropX + dx, 0, previewSize - dragCropW);
          cropY = clamp(dragCropY + dy, 0, previewSize - dragCropH);
        } else {
          const anchor = {
            tl: { x: dragCropX + dragCropW, y: dragCropY + dragCropH },
            tr: { x: dragCropX, y: dragCropY + dragCropH },
            bl: { x: dragCropX + dragCropW, y: dragCropY },
            br: { x: dragCropX, y: dragCropY }
          }[dragCorner];
          const movingX = (dragCorner === "tl" || dragCorner === "bl") ? dragCropX + dx : dragCropX + dragCropW + dx;
          const movingY = (dragCorner === "tl" || dragCorner === "tr") ? dragCropY + dy : dragCropY + dragCropH + dy;
          let w = Math.abs(movingX - anchor.x);
          let h = Math.abs(movingY - anchor.y);
          if (aspectRatio !== undefined) {
            if (w / aspectRatio >= h) h = w / aspectRatio;
            else w = h * aspectRatio;
            const hMin = Math.max(MIN_CROP, MIN_CROP / aspectRatio);
            const hMax = Math.min(previewSize, previewSize / aspectRatio);
            h = clamp(h, hMin, hMax);
            w = h * aspectRatio;
          } else {
            w = clamp(w, MIN_CROP, previewSize);
            h = clamp(h, MIN_CROP, previewSize);
          }
          cropX = movingX < anchor.x ? anchor.x - w : anchor.x;
          cropY = movingY < anchor.y ? anchor.y - h : anchor.y;
          cropW = w;
          cropH = h;
        }
        render();
      });
      canvas.addEventListener("pointerup", () => { dragMode = null; dragCorner = null; });
      canvas.addEventListener("pointercancel", () => { dragMode = null; dragCorner = null; });

      photoEditorScroll.querySelector("#photoEditorRotateBtn").addEventListener("click", () => {
        rotation = (rotation + 90) % 360;
        rotatedCanvas = buildRotatedCanvas(img, rotation);
        resetCrop();
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
        const { x, y, scale } = photoLayout();
        const srcX = (cropX - x) / scale;
        const srcY = (cropY - y) / scale;
        const srcW = cropW / scale;
        const srcH = cropH / scale;

        const outputW = 1200;
        const outputH = Math.round(outputW * (cropH / cropW));
        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputW;
        outputCanvas.height = outputH;
        const outputCtx = outputCanvas.getContext("2d");
        outputCtx.fillStyle = "#FBFAF6";
        outputCtx.fillRect(0, 0, outputW, outputH);

        const clippedX = Math.max(srcX, 0);
        const clippedY = Math.max(srcY, 0);
        const clippedRight = Math.min(srcX + srcW, rotatedCanvas.width);
        const clippedBottom = Math.min(srcY + srcH, rotatedCanvas.height);
        const clippedW = clippedRight - clippedX;
        const clippedH = clippedBottom - clippedY;

        if (clippedW > 0 && clippedH > 0) {
          const outScale = outputW / srcW;
          outputCtx.filter = enhanced ? ENHANCE_FILTER : "none";
          outputCtx.drawImage(
            rotatedCanvas,
            clippedX, clippedY, clippedW, clippedH,
            (clippedX - srcX) * outScale, (clippedY - srcY) * outScale, clippedW * outScale, clippedH * outScale
          );
          outputCtx.filter = "none";
        }

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

export function closePhotoEditor(){
  settle(null);
}
```

Notes pour l'implémenteur :
- `rotatedCanvas` "cuit" la rotation dans un canevas intermédiaire à chaque changement — tout le reste (`photoLayout`, `render`, le calcul d'export) travaille ensuite sur une image non tournée, ce qui évite toute trigonométrie ailleurs dans le fichier.
- `resetCrop()` calcule le plus grand rectangle du ratio cible (`aspectRatio` si fourni, sinon le ratio propre de la photo affichée — ce qui sélectionne la photo entière par défaut) qui tient dans la photo affichée, centré. Appelée à l'ouverture et à chaque clic sur "Pivoter".
- Le cadre peut dépasser les bords de la photo (jusqu'aux limites du canevas `previewSize × previewSize`) : rien dans `resetCrop`/le redimensionnement ne le limite aux dimensions `w × h` de la photo elle-même, seulement au canevas.
- Dans le handler `pointermove` (branche redimensionnement), `anchor` est le coin opposé à celui qu'on fait glisser (il reste fixe) ; `movingX`/`movingY` sont les nouvelles coordonnées du coin déplacé ; le signe de `movingX < anchor.x` (resp. Y) détermine de quel côté de l'ancre se retrouve `cropX`/`cropY` une fois la taille recalculée — cette formulation fonctionne pour les 4 coins sans branche séparée par coin.
- Le clamp de `h` (quand `aspectRatio` est fourni) utilise `hMin`/`hMax` dérivés de l'intersection des contraintes sur `w` ET `h` (pas juste `clamp(h, MIN_CROP, previewSize)` indépendamment de `w`) : dans un canevas carré `previewSize × previewSize`, un cadre 16:9 par exemple a une hauteur maximale réelle de `previewSize / (16/9)` (environ 225 pour `previewSize=400`), pas `previewSize` (400) — un clamp naïf de `w` et `h` séparément après le calcul du ratio casserait le ratio imposé dans les cas de glissé extrême (pointeur déplacé loin hors du canevas). Après ce clamp, `w = h * aspectRatio` est recalculé pour garantir que le ratio reste exact.
- L'export calcule d'abord le rectangle source correspondant au cadre en pixels de `rotatedCanvas` (`srcX/srcY/srcW/srcH`, pouvant déborder de `[0, rotatedCanvas.width]`/`[0, rotatedCanvas.height]`), puis n'affiche que l'intersection avec les pixels réels de la photo (`clippedX/Y/W/H`) à la position correspondante dans le canevas de sortie — le reste du canevas de sortie garde son remplissage de fond neutre initial, ce qui reproduit exactement les marges vues dans l'aperçu.
- La fonction `drawFrame` de l'ancienne version, ainsi que tout l'état `zoom/panX/panY`, disparaissent entièrement — ne pas les conserver.

- [ ] **Step 2: Retirer le curseur cursor grab/grabbing devenu inexact**

Dans `public/style.css`, remplacer :

```css
.photo-editor-frame{ display:flex; justify-content:center; }
.photo-editor-frame canvas{ touch-action:none; border-radius:6px; border:1px solid var(--line); cursor:grab; max-width:100%; }
.photo-editor-frame canvas:active{ cursor:grabbing; }
.photo-editor-tools{ display:flex; gap:8px; }
```

par :

```css
.photo-editor-frame{ display:flex; justify-content:center; }
.photo-editor-frame canvas{ touch-action:none; border-radius:6px; border:1px solid var(--line); max-width:100%; }
.photo-editor-tools{ display:flex; gap:8px; }
```

Note : le curseur "main" (`grab`/`grabbing`) suggérait un déplacement global de la photo, ce qui ne correspond plus au nouveau mécanisme (déplacer le cadre ou redimensionner une poignée, pas déplacer la photo elle-même). On retire ces règles plutôt que d'en ajouter de nouvelles par zone (coin vs intérieur du cadre) — non demandé par le design, curseur par défaut du navigateur suffisant.

- [ ] **Step 3: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v40";
```

par :

```js
const CACHE_NAME = "carnet-cache-v41";
```

- [ ] **Step 4: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois. Aucune erreur console au chargement. DevTools → Application → Cache Storage doit montrer `carnet-cache-v41`.

Ce module n'a pas de dépendance Supabase — testable entièrement dans la console, sans être connecté :

```js
const mod = await import('/js/photo-editor.js');

// image de test 300x150 (ratio 2:1), rouge uni
const testCanvas = document.createElement('canvas');
testCanvas.width = 300; testCanvas.height = 150;
const tctx = testCanvas.getContext('2d');
tctx.fillStyle = 'red'; tctx.fillRect(0, 0, 300, 150);
const blob = await new Promise(r => testCanvas.toBlob(r, 'image/png'));

const resultP = mod.openPhotoEditor(blob, 16 / 9);
await new Promise(r => setTimeout(r, 200));
```

- L'écran "Ajuster la photo" s'ouvre avec un canevas carré (mêmes largeur/hauteur), la photo rouge visible entièrement dedans (pas rognée à l'affichage), un cadre blanc de forme 16:9 centré dessus avec 4 petits carrés blancs (poignées) à ses coins, zone hors cadre légèrement assombrie. Les boutons "Pivoter" et "Améliorer" sont présents.
- Valider sans rien toucher : la promesse résout avec un `Blob` (vérifier via `const r = await resultP; r.type === "image/jpeg" && r.size > 0`) ; décoder ce blob dans une `<img>` et vérifier que son ratio (`naturalWidth/naturalHeight`) est bien proche de `16/9 ≈ 1.778`.

Rouvrir l'éditeur (relancer les 2 premières commandes ci-dessus) puis simuler un glissé de poignée pour vérifier le redimensionnement :

```js
function firePointer(el, type, x, y){
  const rect = el.getBoundingClientRect();
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: rect.left + x, clientY: rect.top + y, pointerId: 1 }));
}
const canvas = document.querySelector('#photoEditorCanvas');
const before = { ...document.querySelector('#photoEditorCanvas').dataset }; // (pas d'état exposé, juste pour repère)
firePointer(canvas, 'pointerdown', canvas.width, canvas.height); // coin bas-droit du canevas, doit être proche de la poignée br par défaut
firePointer(canvas, 'pointermove', canvas.width * 0.65, canvas.height * 0.65); // rétrécit le cadre
firePointer(canvas, 'pointerup', canvas.width * 0.65, canvas.height * 0.65);
document.querySelector('#photoEditorConfirmBtn').click();
const r2 = await resultP2; // (utiliser la Promise renvoyée par le 2e openPhotoEditor de cette relance)
```

- Le cadre doit visiblement rétrécir vers le centre en gardant sa forme 16:9 pendant le glissé (observable en rappelant `render()` implicitement via les événements — vérifier via capture d'écran ou simplement noter qu'aucune erreur console n'apparaît et que la promesse résout bien avec un `Blob` valide, plus petit en dimensions que le précédent si comparé via une `<img>` de test).

Tester ensuite le ratio libre et le débordement du cadre :

```js
const resultP3 = mod.openPhotoEditor(blob); // pas de aspectRatio -> ratio libre, cadre par défaut = photo entière
await new Promise(r => setTimeout(r, 200));
document.querySelector('#photoEditorConfirmBtn').click();
const r3 = await resultP3;
```

- Sans toucher au cadre, valider en ratio libre doit produire une image dont le ratio correspond à celui de la photo de test (2:1) — puisque le cadre par défaut couvre la photo entière.

Tester le débordement (cadre plus grand que la photo) et la rotation :
- Rouvrir l'éditeur, faire glisser un coin du cadre vers l'extérieur du rectangle occupé par la photo (au-delà de ses bords affichés, dans la zone de fond neutre du canevas carré) : le cadre doit pouvoir s'agrandir dans cette zone. Valider : l'image obtenue doit avoir une bande de fond neutre `#FBFAF6` visible à l'endroit correspondant (vérifiable en dessinant le blob résultant dans un `<canvas>` de test et en lisant la couleur d'un pixel dans cette zone via `getImageData`).
- Cliquer "Pivoter" : la photo tourne de 90°, le cadre revient à sa position/taille par défaut (recentré, toujours 16:9 ou ratio libre selon le contexte).
- Cliquer "Améliorer" : le bouton passe à un fond coloré, l'aperçu devient plus lumineux ; valider produit un blob dont le rendu est visiblement plus lumineux qu'une validation sans "Améliorer" activé.

Aucune erreur console sur l'ensemble de ces parcours.

- [ ] **Step 5: Commit**

```bash
git add public/js/photo-editor.js public/style.css public/sw.js
git commit -m "Remplacer le zoom par un cadre de recadrage a poignees dans l'editeur photo"
```
