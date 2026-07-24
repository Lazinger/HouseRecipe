import { scanView, scanScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
import { supabase, SUPABASE_URL } from "./supabase-client.js";
import { CATEGORY_ICON, ALLERGENS } from "./recipes-data.js";
import { openAddForm } from "./add-form.js";
import { openPhotoEditor } from "./photo-editor.js";
import { splitLeadingQuantity } from "./quantity.js";

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_ICON));
const VALID_DIFFICULTIES = new Set(["Facile", "Intermédiaire", "Difficile"]);
const VALID_ALLERGEN_KEYS = new Set(ALLERGENS.map(a => a.key));

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

export function sanitizeExtractedRecipe(raw, photoBlob){
  const category = VALID_CATEGORIES.has(raw?.category) ? raw.category : "";
  const difficulty = VALID_DIFFICULTIES.has(raw?.difficulty) ? raw.difficulty : "Facile";
  const ingredients = Array.isArray(raw?.ingredients)
    ? raw.ingredients.filter(pair => Array.isArray(pair) && pair[0]).map(([name, qty]) => {
        const trimmedQty = String(qty ?? "").trim();
        if (!trimmedQty) {
          const split = splitLeadingQuantity(name);
          if (split) return [split.name, split.qty];
        }
        return [String(name), trimmedQty];
      })
    : [];
  const utensils = Array.isArray(raw?.utensils) ? raw.utensils.filter(Boolean).map(String) : [];
  const steps = Array.isArray(raw?.steps) ? raw.steps.filter(Boolean).map(String) : [];
  const nutrition = (typeof raw?.calories === "number" && typeof raw?.protein === "number")
    ? { calories: raw.calories, protein: raw.protein }
    : undefined;
  const allergens = Array.isArray(raw?.allergens)
    ? raw.allergens.filter(key => VALID_ALLERGEN_KEYS.has(key))
    : undefined;

  return {
    title: typeof raw?.title === "string" ? raw.title : "",
    category, difficulty,
    desc: typeof raw?.desc === "string" ? raw.desc : "",
    time: typeof raw?.time === "number" ? raw.time : undefined,
    servings: typeof raw?.servings === "number" ? raw.servings : undefined,
    nutrition,
    ingredients, utensils, steps,
    allergens: allergens?.length ? allergens : undefined,
    photoBlob
  };
}

/* ---- vue scan (4 lignes de capture : plat, titre, ingrédients, étapes) ---- */
const SCAN_ROWS = [
  { key: "dish", label: "Photo de la recette", required: false, allowSkip: true, aspectRatio: 16 / 9 },
  { key: "title", label: "Photo du titre", required: true },
  { key: "ingredients", label: "Photo des ingrédients", required: true },
  { key: "steps", label: "Photo des étapes", required: true }
];

let scanSlots = {};
let noDishPhoto = false;
let pendingRowKey = null;

function renderScanRows(){
  const container = scanScroll.querySelector("#scanRows");
  container.innerHTML = SCAN_ROWS.map(row => {
    const file = scanSlots[row.key];
    const skipped = row.allowSkip && noDishPhoto;
    const photoHtml = file
      ? `<div class="scan-photo-thumb">
           <img src="${URL.createObjectURL(file)}" alt="${row.label}">
           <button type="button" class="scan-photo-remove" data-row="${row.key}" aria-label="Supprimer cette photo">✕</button>
         </div>`
      : `<button type="button" class="dyn-add scan-row-add" data-row="${row.key}" ${skipped ? "disabled" : ""}>+ Ajouter une photo</button>`;
    return `
      <div class="scan-row${skipped ? " is-skipped" : ""}">
        <div class="scan-row-label">${row.label}${row.required ? "" : " (optionnelle)"}</div>
        <div class="scan-row-photo">${photoHtml}</div>
        ${row.allowSkip ? `
          <label class="scan-row-skip">
            <input type="checkbox" id="scanNoDishPhoto" ${noDishPhoto ? "checked" : ""}>
            Je n'ai pas de photo
          </label>
        ` : ""}
      </div>
    `;
  }).join("");

  container.querySelectorAll(".scan-row-add").forEach(btn => {
    btn.addEventListener("click", () => {
      pendingRowKey = btn.dataset.row;
      scanScroll.querySelector("#scanCameraInput").click();
    });
  });
  container.querySelectorAll(".scan-photo-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      scanSlots[btn.dataset.row] = null;
      renderScanRows();
      updateScanButtons();
    });
  });
  const skipCheckbox = container.querySelector("#scanNoDishPhoto");
  if (skipCheckbox) {
    skipCheckbox.addEventListener("change", () => {
      noDishPhoto = skipCheckbox.checked;
      if (noDishPhoto) scanSlots.dish = null;
      renderScanRows();
      updateScanButtons();
    });
  }
}

function updateScanButtons(){
  const ready = SCAN_ROWS.every(row => !row.required || scanSlots[row.key]);
  scanScroll.querySelector("#scanExtractBtn").disabled = !ready;
}

function renderScanCapture(){
  scanSlots = {};
  noDishPhoto = false;
  pendingRowKey = null;
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
      <div id="scanRows" class="scan-rows"></div>
      <input type="file" accept="image/*" capture="environment" id="scanCameraInput" hidden>
      <p id="scanError" class="add-error" hidden></p>
      <div class="add-actions">
        <button type="button" class="btn-secondary" id="scanCancelBtn">Annuler</button>
        <button type="button" class="btn-primary" id="scanExtractBtn" disabled>Extraire</button>
      </div>
    </div>
  `;

  renderScanRows();
  updateScanButtons();

  scanScroll.querySelector("#scanMenuBtn").addEventListener("click", openDrawer);
  scanScroll.querySelector("#scanCancelBtn").addEventListener("click", requestCloseSheet);
  scanScroll.querySelector("#scanCameraInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    const rowKey = pendingRowKey;
    pendingRowKey = null;
    if (!file || !rowKey) return;
    const rowDef = SCAN_ROWS.find(r => r.key === rowKey);
    const edited = await openPhotoEditor(file, rowDef.aspectRatio);
    if (!edited) return;
    scanSlots[rowKey] = edited;
    if (rowKey === "dish") noDishPhoto = false;
    renderScanRows();
    updateScanButtons();
  });

  scanScroll.querySelector("#scanExtractBtn").addEventListener("click", async () => {
    const extractBtn = scanScroll.querySelector("#scanExtractBtn");
    const scanError = scanScroll.querySelector("#scanError");
    scanError.hidden = true;
    extractBtn.disabled = true;
    scanScroll.querySelectorAll("#scanRows button, #scanRows input").forEach(el => el.disabled = true);
    extractBtn.textContent = "Analyse en cours…";
    try {
      const files = SCAN_ROWS.map(row => scanSlots[row.key]).filter(Boolean);
      const raw = await scanRecipeImages(files);
      const prefillData = sanitizeExtractedRecipe(raw, scanSlots.dish || undefined);
      closeScanRecipe();
      openAddForm(null, prefillData);
    } catch (err) {
      console.error("scan-recipe:", err);
      scanError.textContent = "Impossible d'analyser ces photos : " + (err.message || "erreur inconnue") + " (réessaie)";
      scanError.hidden = false;
      extractBtn.textContent = "Extraire";
      renderScanRows();
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
