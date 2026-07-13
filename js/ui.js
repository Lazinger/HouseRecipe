import { toast, detailView, addView, panierView, drawer, drawerOverlay, chips, favToggleHeader, state, searchInput } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
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

function closeAllOverlays(){
  closeDetail();
  closeAddForm();
  closePanier();
}

export function goToAllRecipes(){
  closeAllOverlays();
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
