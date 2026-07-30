import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView, photoEditorView, importUrlView, mealPlanView, seasonView, fridgeView } from "./dom.js";
import { closeDetail } from "../recipes/detail.js";
import { closeAddForm, openAddForm } from "../recipes/add-form.js";
import { closePanier, openPanier } from "../planning/cart.js";
import { closeProfile } from "../auth/profile.js";
import { closeScanRecipe, openScanRecipe } from "../recipes/scan-recipe.js";
import { closeImportUrl, openImportUrl } from "../recipes/import-url.js";
import { closePhotoEditor } from "../photos/photo-editor.js";
import { closeMealPlan, openMealPlan } from "../planning/meal-plan.js";
import { closeSeason, openSeason } from "../season/season.js";
import { render } from "../recipes/grid.js";
import { openFridge, closeFridge } from "../planning/fridge.js";

/* ---- toast ---- */
let toastTimer = null;
export function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

/* ---- verrouillage du scroll : plusieurs vues plein écran peuvent être empilées ---- */
export function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || scanView.classList.contains("is-open")
    || importUrlView.classList.contains("is-open")
    || mealPlanView.classList.contains("is-open")
    || seasonView.classList.contains("is-open")
    || fridgeView.classList.contains("is-open")
    || photoEditorView.classList.contains("is-open")
    || drawer.classList.contains("is-open");
  document.body.style.overflow = anyOpen ? "hidden" : "";
}

/* ---- tiroir de navigation ---- */
export function openDrawer(){
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawerOverlay.hidden = false;
  requestAnimationFrame(() => drawerOverlay.classList.add("is-open"));
  syncBodyScrollLock();
}
export function closeDrawer(){
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
  drawerOverlay.classList.remove("is-open");
  setTimeout(() => { drawerOverlay.hidden = true; }, 250);
  syncBodyScrollLock();
}

/* ---- fond assombri partagé (fiche recette / ajout / panier / compte) ---- */
let hideBackdropTimer = null;
export function openSheetBackdrop(){
  clearTimeout(hideBackdropTimer);
  sheetBackdrop.hidden = false;
  requestAnimationFrame(() => sheetBackdrop.classList.add("is-open"));
}
export function closeSheetBackdrop(){
  clearTimeout(hideBackdropTimer);
  sheetBackdrop.classList.remove("is-open");
  hideBackdropTimer = setTimeout(() => { sheetBackdrop.hidden = true; }, 320);
}

/* ---- historique de navigation : permet au geste de retour natif (mobile),
   au bouton ✕ et au tap sur le fond de fermer la vue ouverte. Une seule
   entrée est poussée par groupe de vues empilées (ex. recette + panier) —
   un seul retour ramène donc toujours directement à l'accueil. ---- */
let sheetHistoryPushed = false;
export function ensureSheetHistoryEntry(){
  if (sheetHistoryPushed) return;
  history.pushState({ sheet: true }, "");
  sheetHistoryPushed = true;
}
export function resetSheetHistory(){
  sheetHistoryPushed = false;
}
export function requestCloseSheet(){
  if (!sheetHistoryPushed) return;
  history.back();
}

function closeAllOverlays(){
  closeDetail();
  closeAddForm();
  closePanier();
  closeProfile();
  closeScanRecipe();
  closeImportUrl();
  closeMealPlan();
  closeSeason();
  closeFridge();
  closePhotoEditor();
}

export function goToAllRecipes(){
  closeAllOverlays();
  requestCloseSheet();
  closeDrawer();
  chips.forEach(c => c.classList.remove("is-active"));
  document.querySelector('.chip[data-filter="tout"]').classList.add("is-active");
  favToggleHeader.setAttribute("aria-pressed", "false");
  state.filter = "tout";
  state.query = "";
  state.seasonalFilter = null;
  searchInput.value = "";
  render();
}
export function goToFavoris(){
  closeAllOverlays();
  requestCloseSheet();
  closeDrawer();
  chips.forEach(c => c.classList.remove("is-active"));
  document.querySelector('.chip[data-filter="favoris"]').classList.add("is-active");
  favToggleHeader.setAttribute("aria-pressed", "true");
  state.filter = "favoris";
  render();
}
export function goToPanier(){
  closeAllOverlays();
  closeDrawer();
  openPanier();
}
export function goToAddRecipe(){
  closeAllOverlays();
  closeDrawer();
  openAddForm();
}
export function goToScanRecipe(){
  closeAllOverlays();
  closeDrawer();
  openScanRecipe();
}
export function goToImportUrl(){
  closeAllOverlays();
  closeDrawer();
  openImportUrl();
}
export function goToMealPlan(){
  closeAllOverlays();
  closeDrawer();
  openMealPlan();
}
export function goToSeason(){
  closeAllOverlays();
  closeDrawer();
  openSeason();
}
export function goToFridge(){
  closeAllOverlays();
  closeDrawer();
  openFridge();
}
export function goToSeasonalRecipes(produce){
  closeAllOverlays();
  requestCloseSheet();
  closeDrawer();
  chips.forEach(c => c.classList.remove("is-active"));
  document.querySelector('.chip[data-filter="tout"]').classList.add("is-active");
  favToggleHeader.setAttribute("aria-pressed", "false");
  state.filter = "tout";
  state.seasonalFilter = produce;
  render();
}

/* ---- popup de confirmation generique : contrairement a confirm() natif,
   les libelles des boutons sont personnalisables. Creee/detruite
   dynamiquement (pas d'element statique dans index.html), resout
   true (bouton de confirmation) ou false (annulation, Echap, ou clic
   hors de la boite). ---- */
export function confirmModal(message, { confirmLabel = "Oui", cancelLabel = "Non" } = {}){
  return new Promise(resolve => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-modal-backdrop";
    backdrop.innerHTML = `
      <div class="confirm-modal" role="alertdialog" aria-modal="true">
        <p>${message}</p>
        <div class="confirm-modal-actions">
          <button type="button" class="btn-secondary" data-action="cancel">${cancelLabel}</button>
          <button type="button" class="btn-primary" data-action="confirm">${confirmLabel}</button>
        </div>
      </div>
    `;

    function close(result){
      backdrop.remove();
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }
    function onKeydown(e){
      if (e.key === "Escape") close(false);
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close(false);
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener("click", () => close(false));
    backdrop.querySelector('[data-action="confirm"]').addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKeydown);

    document.body.appendChild(backdrop);
  });
}
