import { escapeAttr } from "./utils.js";
import { openPhotoEditor } from "./photo-editor.js";
import { getStepPhoto } from "./photos.js";

/* ---- lignes dynamiques du formulaire d'ajout (ingrédients / ustensiles / étapes) ---- */

export function updateRemoveButtons(container){
  const rows = container.querySelectorAll(".dyn-row");
  rows.forEach(row => {
    row.querySelector(".dyn-remove").disabled = rows.length <= 1;
  });
}

export function createIngredientRow(container, name = "", qty = ""){
  const row = document.createElement("div");
  row.className = "dyn-row";
  row.innerHTML = `
    <input type="text" class="ing-name-input" placeholder="Nom" value="${escapeAttr(name)}">
    <input type="text" class="ing-qty-input" placeholder="Quantité" value="${escapeAttr(qty)}">
    <button type="button" class="dyn-remove" aria-label="Supprimer cet ingrédient">✕</button>
  `;
  row.querySelector(".dyn-remove").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(container);
  });
  return row;
}

export function createStepRow(container, text = "", recipeId, originalIndex){
  const row = document.createElement("div");
  row.className = "dyn-row dyn-row-step";
  row.innerHTML = `
    <input type="text" class="step-input" placeholder="Décrivez l'étape…" value="${escapeAttr(text)}">
    <div class="step-photo-thumb" hidden>
      <img alt="Photo actuelle">
      <button type="button" class="step-photo-remove" aria-label="Supprimer la photo actuelle">✕</button>
    </div>
    <input type="file" class="step-photo-input" accept="image/*" title="Photo de l'étape (optionnel)">
    <button type="button" class="dyn-remove" aria-label="Supprimer cette étape">✕</button>
  `;
  row.querySelector(".dyn-remove").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(container);
  });

  const thumb = row.querySelector(".step-photo-thumb");
  if (recipeId !== undefined && originalIndex !== undefined) {
    getStepPhoto(recipeId, originalIndex).then(blob => {
      if (!blob) return;
      thumb.querySelector("img").src = URL.createObjectURL(blob);
      thumb.hidden = false;
    }).catch(() => {});
  }
  thumb.querySelector(".step-photo-remove").addEventListener("click", () => {
    row.dataset.photoRemoved = "1";
    thumb.hidden = true;
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
    row.dataset.photoRemoved = "";
    thumb.hidden = true;
  });
  return row;
}

export function createUstensileRow(container, text = ""){
  const row = document.createElement("div");
  row.className = "dyn-row dyn-row-step";
  row.innerHTML = `
    <input type="text" class="tool-input" placeholder="Ex. Casserole" value="${escapeAttr(text)}">
    <button type="button" class="dyn-remove" aria-label="Supprimer cet ustensile">✕</button>
  `;
  row.querySelector(".dyn-remove").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(container);
  });
  return row;
}
