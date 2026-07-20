import { scanView, scanScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";

/* ---- vue scan (capture de 1 à 4 photos pour pré-remplir une recette) ---- */
let capturedFiles = [];

function renderPhotoThumbs(){
  const container = scanScroll.querySelector("#scanPhotos");
  container.innerHTML = capturedFiles.map((file, i) => `
    <div class="scan-photo-thumb">
      <img src="${URL.createObjectURL(file)}" alt="Photo ${i + 1}">
      <button type="button" class="scan-photo-remove" data-index="${i}" aria-label="Supprimer cette photo">✕</button>
    </div>
  `).join("");
  container.querySelectorAll(".scan-photo-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      capturedFiles.splice(Number(btn.dataset.index), 1);
      renderPhotoThumbs();
      updateScanButtons();
    });
  });
}

function updateScanButtons(){
  scanScroll.querySelector("#scanAddPhotoBtn").disabled = capturedFiles.length >= 4;
  scanScroll.querySelector("#scanExtractBtn").disabled = capturedFiles.length === 0;
}

function renderScanCapture(){
  capturedFiles = [];
  scanScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="scanMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Scanner une recette</h2>
    </div>
    <div class="add-form">
      <p class="scan-hint">Prends une ou plusieurs photos de la carte (recto, verso…), jusqu'à 4.</p>
      <div id="scanPhotos" class="scan-photos"></div>
      <input type="file" accept="image/*" capture="environment" id="scanCameraInput" hidden>
      <button type="button" class="dyn-add" id="scanAddPhotoBtn">+ Ajouter une photo</button>
      <p id="scanError" class="add-error" hidden></p>
      <div class="add-actions">
        <button type="button" class="btn-secondary" id="scanCancelBtn">Annuler</button>
        <button type="button" class="btn-primary" id="scanExtractBtn" disabled>Extraire</button>
      </div>
    </div>
  `;

  renderPhotoThumbs();
  updateScanButtons();

  scanScroll.querySelector("#scanMenuBtn").addEventListener("click", openDrawer);
  scanScroll.querySelector("#scanCancelBtn").addEventListener("click", requestCloseSheet);
  scanScroll.querySelector("#scanAddPhotoBtn").addEventListener("click", () => {
    scanScroll.querySelector("#scanCameraInput").click();
  });
  scanScroll.querySelector("#scanCameraInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) capturedFiles.push(file);
    e.target.value = "";
    renderPhotoThumbs();
    updateScanButtons();
  });
}

export function openScanRecipe(){
  renderScanCapture();
  scanView.classList.add("is-open");
  scanView.setAttribute("aria-hidden", "false");
  scanScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeScanRecipe(){
  if (!scanView.classList.contains("is-open")) return;
  scanView.classList.remove("is-open");
  scanView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
