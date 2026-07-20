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
