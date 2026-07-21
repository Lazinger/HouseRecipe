import { importUrlView, importUrlScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
import { supabase, SUPABASE_URL } from "./supabase-client.js";
import { openAddForm } from "./add-form.js";
import { sanitizeExtractedRecipe } from "./scan-recipe.js";

function base64ToBlob(base64, mimeType){
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

async function importRecipeFromUrl(url){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Non authentifié");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-recipe-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ url })
  });

  if (!res.ok) {
    let detail = "";
    try { const body = await res.json(); detail = body?.error || ""; } catch {}
    throw new Error(detail || `Échec (${res.status})`);
  }
  return res.json();
}

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

  submitBtn.addEventListener("click", async () => {
    const url = input.value.trim();
    const errorEl = importUrlScroll.querySelector("#importUrlError");
    errorEl.hidden = true;

    let isValidUrl = false;
    try {
      const parsed = new URL(url);
      isValidUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {}
    if (!isValidUrl) {
      errorEl.textContent = "Cette adresse ne ressemble pas à une URL valide (doit commencer par http:// ou https://).";
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    input.disabled = true;
    submitBtn.textContent = "Analyse en cours…";
    try {
      const raw = await importRecipeFromUrl(url);
      const photoBlob = raw.photo ? base64ToBlob(raw.photo.data, raw.photo.mimeType) : undefined;
      const prefillData = sanitizeExtractedRecipe(raw, photoBlob);
      closeImportUrl();
      openAddForm(null, prefillData);
    } catch (err) {
      console.error("import-url:", err);
      errorEl.textContent = "Impossible d'importer cette page : " + (err.message || "erreur inconnue") + " (réessaie)";
      errorEl.hidden = false;
      submitBtn.textContent = "Importer";
      submitBtn.disabled = false;
      input.disabled = false;
    }
  });
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
