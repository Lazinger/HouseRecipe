import { escapeAttr } from "./utils.js";
import { CATEGORY_ICON } from "./recipes-data.js";
import { openPhotoEditor } from "./photo-editor.js";
import { addScroll, addView, chips, state, searchInput } from "./dom.js";
import { saveRecipe, generateRecipeId } from "./recipes-store.js";
import { savePhoto, saveStepPhoto, removePhoto, getMainPhoto } from "./photos.js";
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
import { openDetail } from "./detail.js";
import { render } from "./grid.js";

/* ---- vue ajout (formulaire plein écran) ---- */
function createIngredientRow(container, name = "", qty = ""){
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

function createStepRow(container, text = ""){
  const row = document.createElement("div");
  row.className = "dyn-row dyn-row-step";
  row.innerHTML = `
    <input type="text" class="step-input" placeholder="Décrivez l'étape…" value="${escapeAttr(text)}">
    <input type="file" class="step-photo-input" accept="image/*" title="Photo de l'étape (optionnel)">
    <button type="button" class="dyn-remove" aria-label="Supprimer cette étape">✕</button>
  `;
  row.querySelector(".dyn-remove").addEventListener("click", () => {
    row.remove();
    updateRemoveButtons(container);
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
  });
  return row;
}

function createUstensileRow(container, text = ""){
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

function updateRemoveButtons(container){
  const rows = container.querySelectorAll(".dyn-row");
  rows.forEach(row => {
    row.querySelector(".dyn-remove").disabled = rows.length <= 1;
  });
}

function validateNewRecipe({ title, category, ingredients, steps }){
  if (!title) return "Merci d'indiquer un titre.";
  if (!category) return "Merci de choisir une catégorie.";
  if (!ingredients.length) return "Ajoutez au moins un ingrédient.";
  if (!steps.length) return "Ajoutez au moins une étape.";
  return null;
}

function renderAddForm(editingRecipe, prefillData){
  const data = editingRecipe || prefillData || null;
  addScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="addMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>${editingRecipe ? "Modifier la recette" : "Nouvelle recette"}</h2>
    </div>
    <form id="addForm" class="add-form" novalidate>
      <div class="field">
        <label for="addTitle">Titre *</label>
        <input id="addTitle" type="text" placeholder="Ex. Tarte aux pommes" value="${escapeAttr(data?.title || "")}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addCategory">Catégorie *</label>
          <select id="addCategory">
            <option value="">Choisir…</option>
            <option value="entrée">Entrée</option>
            <option value="plat">Plat</option>
            <option value="dessert">Dessert</option>
          </select>
        </div>
        <div class="field">
          <label for="addDifficulty">Difficulté</label>
          <select id="addDifficulty">
            <option value="Facile">Facile</option>
            <option value="Intermédiaire">Intermédiaire</option>
            <option value="Difficile">Difficile</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="addDesc">Description courte</label>
        <input id="addDesc" type="text" placeholder="Une phrase pour donner envie" value="${escapeAttr(data?.desc || "")}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addTime">Temps (min)</label>
          <input id="addTime" type="number" min="0" placeholder="30" value="${data?.time || ""}">
        </div>
        <div class="field">
          <label for="addServings">Personnes</label>
          <input id="addServings" type="number" min="1" placeholder="4" value="${data?.servings || ""}">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addCalories">Calories (optionnel)</label>
          <input id="addCalories" type="number" min="0" placeholder="Ex. 650" value="${data?.nutrition?.calories ?? ""}">
        </div>
        <div class="field">
          <label for="addProtein">Protéines en g (optionnel)</label>
          <input id="addProtein" type="number" min="0" step="0.1" placeholder="Ex. 20" value="${data?.nutrition?.protein ?? ""}">
        </div>
      </div>
      <div class="field">
        <label for="addAllergens">Allergènes (optionnel)</label>
        <input id="addAllergens" type="text" placeholder="Ex. Gluten, blé, lait" value="${escapeAttr(data?.allergens || "")}">
      </div>
      <div class="field">
        <label for="addPhoto">Photo (optionnel)${editingRecipe ? " — laisse vide pour garder la photo actuelle" : ""}</label>
        <div class="scan-photo-thumb" id="addPhotoCurrent" hidden>
          <img id="addPhotoCurrentImg" alt="Photo actuelle">
          <button type="button" class="scan-photo-remove" id="addPhotoRemoveBtn" aria-label="Supprimer la photo actuelle">✕</button>
        </div>
        <input id="addPhoto" type="file" accept="image/*">
      </div>
      <div class="field">
        <label>Ingrédients *</label>
        <div id="ingredientRows" class="dyn-rows"></div>
        <button type="button" class="dyn-add" id="addIngredientRow">+ Ajouter un ingrédient</button>
      </div>
      <div class="field">
        <label>Ustensiles (optionnel)</label>
        <div id="ustensilRows" class="dyn-rows"></div>
        <button type="button" class="dyn-add" id="addUstensilRow">+ Ajouter un ustensile</button>
      </div>
      <div class="field">
        <label>Étapes * ${editingRecipe ? "(photo : laisse vide pour garder la photo actuelle de l'étape)" : ""}</label>
        <div id="stepRows" class="dyn-rows"></div>
        <button type="button" class="dyn-add" id="addStepRow">+ Ajouter une étape</button>
      </div>
      <div class="field">
        <label for="addNote">Astuce (optionnel)</label>
        <textarea id="addNote" rows="2" placeholder="Un conseil, une variante…">${editingRecipe?.note || ""}</textarea>
      </div>
      <p id="addError" class="add-error" hidden></p>
      <div class="add-actions">
        <button type="button" class="btn-secondary" id="addCancelBtn">Annuler</button>
        <button type="submit" class="btn-primary">${editingRecipe ? "Enregistrer les modifications" : "Enregistrer"}</button>
      </div>
    </form>
  `;

  const addForm = addScroll.querySelector("#addForm");
  const ingredientRowsEl = addScroll.querySelector("#ingredientRows");
  const ustensilRowsEl = addScroll.querySelector("#ustensilRows");
  const stepRowsEl = addScroll.querySelector("#stepRows");
  const addError = addScroll.querySelector("#addError");

  if (!editingRecipe && prefillData?.photoBlob) {
    const dt = new DataTransfer();
    dt.items.add(new File([prefillData.photoBlob], "scan.jpg", { type: prefillData.photoBlob.type || "image/jpeg" }));
    addForm.querySelector("#addPhoto").files = dt.files;
  }

  const addPhotoCurrent = addForm.querySelector("#addPhotoCurrent");
  const addPhotoCurrentImg = addForm.querySelector("#addPhotoCurrentImg");
  let mainPhotoRemoved = false;

  if (editingRecipe) {
    getMainPhoto(editingRecipe.id).then(blob => {
      if (!blob) return;
      addPhotoCurrentImg.src = URL.createObjectURL(blob);
      addPhotoCurrent.hidden = false;
    }).catch(() => {});
  }

  addForm.querySelector("#addPhotoRemoveBtn").addEventListener("click", () => {
    mainPhotoRemoved = true;
    addPhotoCurrent.hidden = true;
  });

  addForm.querySelector("#addCategory").value = data?.category || "";
  addForm.querySelector("#addDifficulty").value = data?.difficulty || "Facile";

  if (data?.ingredients?.length) {
    data.ingredients.forEach(([name, qty]) => ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl, name, qty)));
  } else {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
  }
  if (data?.utensils?.length) {
    data.utensils.forEach(text => ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl, text)));
  } else {
    ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl));
  }
  if (data?.steps?.length) {
    data.steps.forEach(text => stepRowsEl.appendChild(createStepRow(stepRowsEl, text)));
  } else {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
  }
  updateRemoveButtons(ingredientRowsEl);
  updateRemoveButtons(ustensilRowsEl);
  updateRemoveButtons(stepRowsEl);

  addScroll.querySelector("#addIngredientRow").addEventListener("click", () => {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
    updateRemoveButtons(ingredientRowsEl);
  });
  addScroll.querySelector("#addUstensilRow").addEventListener("click", () => {
    ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl));
    updateRemoveButtons(ustensilRowsEl);
  });
  addScroll.querySelector("#addStepRow").addEventListener("click", () => {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
    updateRemoveButtons(stepRowsEl);
  });
  addScroll.querySelector("#addMenuBtn").addEventListener("click", openDrawer);
  addScroll.querySelector("#addCancelBtn").addEventListener("click", closeAddForm);

  addForm.querySelector("#addPhoto").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const edited = await openPhotoEditor(file, 16 / 9);
    e.target.value = "";
    if (!edited) return;
    const dt = new DataTransfer();
    dt.items.add(new File([edited], "photo.jpg", { type: "image/jpeg" }));
    e.target.files = dt.files;
    mainPhotoRemoved = false;
    addPhotoCurrent.hidden = true;
  });

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = addForm.querySelector("#addTitle").value.trim();
    const category = addForm.querySelector("#addCategory").value;
    const desc = addForm.querySelector("#addDesc").value.trim();
    const time = parseInt(addForm.querySelector("#addTime").value, 10) || 0;
    const servings = parseInt(addForm.querySelector("#addServings").value, 10) || 0;
    const difficulty = addForm.querySelector("#addDifficulty").value;
    const note = addForm.querySelector("#addNote").value.trim();

    const caloriesVal = addForm.querySelector("#addCalories").value.trim();
    const proteinVal = addForm.querySelector("#addProtein").value.trim();
    const nutrition = (caloriesVal && proteinVal)
      ? { calories: parseFloat(caloriesVal), protein: parseFloat(proteinVal) }
      : undefined;
    const allergens = addForm.querySelector("#addAllergens").value.trim() || undefined;

    const ingredients = [...ingredientRowsEl.querySelectorAll(".dyn-row")]
      .map(row => [row.querySelector(".ing-name-input").value.trim(), row.querySelector(".ing-qty-input").value.trim()])
      .filter(([name]) => name);

    const utensilsList = [...ustensilRowsEl.querySelectorAll(".dyn-row")]
      .map(row => row.querySelector(".tool-input").value.trim())
      .filter(Boolean);
    const utensils = utensilsList.length ? utensilsList : undefined;

    const stepRowEls = [...stepRowsEl.querySelectorAll(".dyn-row")];
    const filledStepRows = stepRowEls.filter(row => row.querySelector(".step-input").value.trim());
    const steps = filledStepRows.map(row => row.querySelector(".step-input").value.trim());
    const stepPhotoFiles = filledStepRows.map(row => row.querySelector(".step-photo-input").files[0] || null);

    const errorMsg = validateNewRecipe({ title, category, ingredients, steps });
    if (errorMsg) {
      addError.textContent = errorMsg;
      addError.hidden = false;
      return;
    }
    addError.hidden = true;

    const photoFile = addForm.querySelector("#addPhoto").files[0];
    const submitBtn = addForm.querySelector(".btn-primary");
    submitBtn.disabled = true;

    const recipe = {
      id: editingRecipe ? editingRecipe.id : generateRecipeId(title),
      title, category,
      icon: CATEGORY_ICON[category],
      desc, time, servings, difficulty, note,
      ingredients, steps, nutrition, allergens, utensils
    };

    await saveRecipe(recipe);

    if (photoFile) await savePhoto(recipe.id, photoFile);
    else if (mainPhotoRemoved) await removePhoto(recipe.id);
    for (let i = 0; i < stepPhotoFiles.length; i++) {
      if (stepPhotoFiles[i]) await saveStepPhoto(recipe.id, i, stepPhotoFiles[i]);
    }

    closeAddForm();

    if (editingRecipe) {
      showToast("Recette modifiée");
      render();
      openDetail(recipe.id);
      return;
    }

    requestCloseSheet();

    showToast("Recette ajoutée");
    chips.forEach(c => c.classList.remove("is-active"));
    document.querySelector('.chip[data-filter="tout"]').classList.add("is-active");
    state.filter = "tout";
    state.query = "";
    searchInput.value = "";
    render();
  });
}

export function openAddForm(editingRecipe, prefillData){
  renderAddForm(editingRecipe, prefillData);
  addView.classList.add("is-open");
  addView.setAttribute("aria-hidden", "false");
  addScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeAddForm(){
  if (!addView.classList.contains("is-open")) return;
  addView.classList.remove("is-open");
  addView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
