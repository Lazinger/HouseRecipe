import { supabase, currentUserId } from "../auth/supabase-client.js";
import { enqueue, registerHandler } from "../core/write-queue.js";
import { mergeQuantityParts, normalizeQuantity, formatQuantityValue, parseQuantity } from "../recipes/quantity.js";
import { fridgeView, fridgeScroll } from "../core/dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry } from "../core/ui.js";
import { escapeAttr } from "../core/utils.js";
import { ALL_RECIPES } from "../recipes/recipes-store.js";
import { updateRemoveButtons } from "../recipes/dyn-rows.js";

/* ---- frigo personnel (persisté, une ligne par ingrédient et par compte) ---- */
const FRIDGE_KEY = "carnet-frigo";

function loadFridgeLocal(){
  try { return JSON.parse(localStorage.getItem(FRIDGE_KEY) || "[]"); }
  catch { return []; }
}
function saveFridgeLocal(){
  localStorage.setItem(FRIDGE_KEY, JSON.stringify(fridgeItems));
}

export const fridgeItems = loadFridgeLocal(); // Array<[name, qty]>

async function fridgeWriteHandler(payload){
  const userId = await currentUserId();
  if (!userId) return;
  if (payload.op === "delete") {
    const { error } = await supabase.from("fridge_items").delete().eq("user_id", userId).eq("name", payload.name);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("fridge_items").upsert({
      user_id: userId, name: payload.name, qty: payload.qty, updated_at: new Date().toISOString()
    }, { onConflict: "user_id,name" });
    if (error) throw error;
  }
}
registerHandler("fridge", fridgeWriteHandler);

export async function initFridgeSync(){
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const { data, error } = await supabase.from("fridge_items").select("name, qty").eq("user_id", userId);
    if (error) throw error;
    if ((data || []).length > 0) {
      fridgeItems.splice(0, fridgeItems.length, ...data.map(row => [row.name, row.qty]));
      saveFridgeLocal();
    } else if (fridgeItems.length > 0) {
      fridgeItems.forEach(([name, qty]) => {
        const payload = { op: "upsert", name, qty };
        fridgeWriteHandler(payload).catch(() => enqueue("fridge", name.trim().toLowerCase(), payload));
      });
    }
  } catch {
    /* hors-ligne ou erreur réseau : on garde le frigo déjà en cache localStorage */
  }
}

function findFridgeIndex(name){
  const key = name.trim().toLowerCase();
  return fridgeItems.findIndex(([n]) => n.trim().toLowerCase() === key);
}

export function saveFridgeItem(name, qty){
  const idx = findFridgeIndex(name);
  if (idx >= 0) fridgeItems[idx] = [name, qty]; else fridgeItems.push([name, qty]);
  saveFridgeLocal();
  const payload = { op: "upsert", name, qty };
  fridgeWriteHandler(payload).catch(() => enqueue("fridge", name.trim().toLowerCase(), payload));
}

export function removeFridgeItem(name){
  const idx = findFridgeIndex(name);
  if (idx >= 0) fridgeItems.splice(idx, 1);
  saveFridgeLocal();
  const payload = { op: "delete", name };
  fridgeWriteHandler(payload).catch(() => enqueue("fridge", name.trim().toLowerCase(), payload));
}

/* ---- reapprovisionnement au clic sur "Valide" dans le panier : items est
   la liste "a acheter" telle qu'affichee ([{name, qty}]), s'additionne a
   ce qui existe deja pour chaque ingredient (meme regle de fusion que le
   panier). ---- */
export function incrementFridgeItems(items){
  items.forEach(({ name, qty }) => {
    const idx = findFridgeIndex(name);
    if (idx >= 0) {
      const [existingName, existingQty] = fridgeItems[idx];
      saveFridgeItem(existingName, mergeQuantityParts([existingQty, qty]));
    } else {
      saveFridgeItem(name, qty);
    }
  });
}

/* ---- decrement au clic sur "J'ai fait la recette" (fiche recette) :
   ingredients est la liste de la recette, quantites deja mises a
   l'echelle par l'appelant selon le nombre de personnes. Un ingredient
   absent du frigo, ou dans une unite non comparable, n'est pas touche —
   repli sur : pas de modification plutot qu'un calcul faux, meme regle
   que subtractQuantity/checkFridgeAvailability. ---- */
export function decrementFridgeItems(ingredients){
  ingredients.forEach(([name, qty]) => {
    const idx = findFridgeIndex(name);
    if (idx < 0) return;
    const [existingName, existingQty] = fridgeItems[idx];
    const parsedNeed = normalizeQuantity(qty);
    const parsedStock = normalizeQuantity(existingQty);
    if (!parsedNeed || !parsedStock || parsedNeed.unit.toLowerCase() !== parsedStock.unit.toLowerCase()) return;
    const remaining = Math.max(0, parsedStock.value - parsedNeed.value);
    if (remaining === 0) {
      removeFridgeItem(existingName);
    } else {
      const formatted = formatQuantityValue(remaining, parsedStock.unit);
      saveFridgeItem(existingName, parsedStock.unit ? `${formatted} ${parsedStock.unit}` : formatted);
    }
  });
}

/* ---- autocompletion : tous les noms d'ingredients deja vus dans les recettes ---- */
function populateIngredientDatalist(){
  const names = new Set();
  ALL_RECIPES.forEach(r => r.ingredients.forEach(([name]) => names.add(name.trim())));
  const datalist = document.getElementById("ingredientNamesList");
  if (!datalist) return;
  datalist.innerHTML = [...names].sort().map(n => `<option value="${escapeAttr(n)}"></option>`).join("");
}

const FRIDGE_UNITS = ["g", "kg", "ml", "L", "pièce(s)", "feuille(s)"];

function splitFridgeQty(qty){
  const parsed = parseQuantity(qty);
  if (!parsed || !FRIDGE_UNITS.includes(parsed.unit)) return { value: "", unit: FRIDGE_UNITS[0] };
  return { value: String(parsed.value), unit: parsed.unit };
}

function fridgeUnitOptionsHtml(selected){
  return FRIDGE_UNITS.map(u => `<option value="${u}"${u === selected ? " selected" : ""}>${u}</option>`).join("");
}

function addFridgeRow(container, name, qty){
  const { value, unit } = splitFridgeQty(qty);
  const row = document.createElement("div");
  row.className = "dyn-row fridge-row";
  row.innerHTML = `
    <input type="text" class="ing-name-input" placeholder="Nom" value="${escapeAttr(name)}" list="ingredientNamesList">
    <input type="number" class="fridge-qty-input" placeholder="Quantité" min="0" step="any" value="${escapeAttr(value)}">
    <select class="fridge-unit-select">${fridgeUnitOptionsHtml(unit)}</select>
    <button type="button" class="dyn-remove" aria-label="Supprimer cet ingrédient">✕</button>
  `;
  row.dataset.savedName = name;

  const commit = () => {
    const newName = row.querySelector(".ing-name-input").value.trim();
    const newValue = row.querySelector(".fridge-qty-input").value.trim();
    const newUnit = row.querySelector(".fridge-unit-select").value;
    const oldName = row.dataset.savedName || "";
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) removeFridgeItem(oldName);
    if (newName && newValue) {
      saveFridgeItem(newName, `${newValue} ${newUnit}`);
      row.dataset.savedName = newName;
    } else {
      row.dataset.savedName = "";
    }
  };
  row.querySelector(".ing-name-input").addEventListener("change", commit);
  row.querySelector(".fridge-qty-input").addEventListener("change", commit);
  row.querySelector(".fridge-unit-select").addEventListener("change", commit);

  row.querySelector(".dyn-remove").addEventListener("click", () => {
    if (row.dataset.savedName) removeFridgeItem(row.dataset.savedName);
    row.remove();
    updateRemoveButtons(container);
  });

  container.appendChild(row);
  return row;
}

function renderFridge(){
  fridgeScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="fridgeMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Mon Frigo</h2>
    </div>
    <div class="add-form">
      <div id="fridgeRows" class="dyn-rows"></div>
      <button type="button" class="dyn-add" id="fridgeAddRowBtn">+ Ajouter un ingrédient</button>
    </div>
  `;

  const rowsContainer = fridgeScroll.querySelector("#fridgeRows");
  if (fridgeItems.length) {
    fridgeItems.forEach(([name, qty]) => addFridgeRow(rowsContainer, name, qty));
  } else {
    addFridgeRow(rowsContainer, "", "");
  }
  updateRemoveButtons(rowsContainer);

  fridgeScroll.querySelector("#fridgeMenuBtn").addEventListener("click", openDrawer);
  fridgeScroll.querySelector("#fridgeAddRowBtn").addEventListener("click", () => {
    const row = addFridgeRow(rowsContainer, "", "");
    updateRemoveButtons(rowsContainer);
    row.querySelector(".ing-name-input").focus();
  });
}

export function openFridge(){
  populateIngredientDatalist();
  renderFridge();
  fridgeView.classList.add("is-open");
  fridgeView.setAttribute("aria-hidden", "false");
  fridgeScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeFridge(){
  if (!fridgeView.classList.contains("is-open")) return;
  fridgeView.classList.remove("is-open");
  fridgeView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
