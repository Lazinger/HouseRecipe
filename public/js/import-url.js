import { importUrlView, importUrlScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";

function renderImportUrl(){
  importUrlScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="importUrlMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Importer depuis une URL</h2>
    </div>
    <div class="add-form">
      <p class="scan-hint">Colle le lien d'une page de recette (Marmiton, CuisineAZ, 750g, HelloFresh...).</p>
      <div class="field">
        <label for="importUrlInput">Adresse de la recette</label>
        <input id="importUrlInput" type="url" placeholder="https://...">
      </div>
      <p id="importUrlError" class="add-error" hidden></p>
      <div class="add-actions">
        <button type="button" class="btn-secondary" id="importUrlCancelBtn">Annuler</button>
        <button type="button" class="btn-primary" id="importUrlSubmitBtn" disabled>Importer</button>
      </div>
    </div>
  `;

  const input = importUrlScroll.querySelector("#importUrlInput");
  const submitBtn = importUrlScroll.querySelector("#importUrlSubmitBtn");

  input.addEventListener("input", () => {
    submitBtn.disabled = !input.value.trim();
  });

  importUrlScroll.querySelector("#importUrlMenuBtn").addEventListener("click", openDrawer);
  importUrlScroll.querySelector("#importUrlCancelBtn").addEventListener("click", requestCloseSheet);
}

export function openImportUrl(){
  renderImportUrl();
  importUrlView.classList.add("is-open");
  importUrlView.setAttribute("aria-hidden", "false");
  importUrlScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeImportUrl(){
  if (!importUrlView.classList.contains("is-open")) return;
  importUrlView.classList.remove("is-open");
  importUrlView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
