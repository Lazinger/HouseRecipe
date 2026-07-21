import { scanView, scanScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
import { supabase, SUPABASE_URL } from "./supabase-client.js";
import { CATEGORY_ICON } from "./recipes-data.js";
import { openAddForm } from "./add-form.js";
import { openPhotoEditor } from "./photo-editor.js";

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_ICON));
const VALID_DIFFICULTIES = new Set(["Facile", "Intermédiaire", "Difficile"]);

function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function scanRecipeImages(files){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Non authentifié");

  const images = await Promise.all(files.map(async file => ({
    mimeType: file.type || "image/jpeg",
    data: await blobToBase64(file)
  })));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-recipe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ images })
  });

  if (!res.ok) {
    let detail = "";
    try { const body = await res.json(); detail = body?.error || ""; } catch {}
    throw new Error(`Échec (${res.status})${detail ? " : " + detail : ""}`);
  }
  return res.json();
}

function sanitizeExtractedRecipe(raw, photoBlob){
  const category = VALID_CATEGORIES.has(raw?.category) ? raw.category : "";
  const difficulty = VALID_DIFFICULTIES.has(raw?.difficulty) ? raw.difficulty : "Facile";
  const ingredients = Array.isArray(raw?.ingredients)
    ? raw.ingredients.filter(pair => Array.isArray(pair) && pair[0]).map(([name, qty]) => [String(name), String(qty ?? "")])
    : [];
  const utensils = Array.isArray(raw?.utensils) ? raw.utensils.filter(Boolean).map(String) : [];
  const steps = Array.isArray(raw?.steps) ? raw.steps.filter(Boolean).map(String) : [];
  const nutrition = (typeof raw?.calories === "number" && typeof raw?.protein === "number")
    ? { calories: raw.calories, protein: raw.protein }
    : undefined;

  return {
    title: typeof raw?.title === "string" ? raw.title : "",
    category, difficulty,
    desc: typeof raw?.desc === "string" ? raw.desc : "",
    time: typeof raw?.time === "number" ? raw.time : undefined,
    servings: typeof raw?.servings === "number" ? raw.servings : undefined,
    nutrition,
    allergens: typeof raw?.allergens === "string" ? raw.allergens : undefined,
    ingredients, utensils, steps,
    photoBlob
  };
}

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

  scanScroll.querySelector("#scanExtractBtn").addEventListener("click", async () => {
    const extractBtn = scanScroll.querySelector("#scanExtractBtn");
    const scanError = scanScroll.querySelector("#scanError");
    scanError.hidden = true;
    extractBtn.disabled = true;
    scanScroll.querySelector("#scanAddPhotoBtn").disabled = true;
    extractBtn.textContent = "Analyse en cours…";
    try {
      const raw = await scanRecipeImages(capturedFiles);
      const prefillData = sanitizeExtractedRecipe(raw, capturedFiles[0]);
      closeScanRecipe();
      openAddForm(null, prefillData);
    } catch (err) {
      console.error("scan-recipe:", err);
      scanError.textContent = "Impossible d'analyser ces photos : " + (err.message || "erreur inconnue") + " (réessaie)";
      scanError.hidden = false;
      extractBtn.textContent = "Extraire";
      updateScanButtons();
    }
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
