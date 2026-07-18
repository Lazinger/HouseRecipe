import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { render } from "./grid.js";

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
