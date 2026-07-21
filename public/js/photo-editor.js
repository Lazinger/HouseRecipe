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
