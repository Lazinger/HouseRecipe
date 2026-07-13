/* =========================================================
   LE CARNET — point d'entrée
   Pensé pour tourner tel quel dans une WebView Android
   (aucune dépendance externe, polices incluses — fonctionne hors-ligne).
   ========================================================= */

import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navExportBtn, navImportBtn, importFileInput,
  navLogoutBtn,
  detailView, addView, panierView
} from "./dom.js";
import { render, renderHero } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge } from "./cart.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe } from "./ui.js";
import { exportRecipes, importRecipesFromFile } from "./recipes-store.js";
import { initAuth, logout } from "./auth.js";
import "./timer.js";

/* ---- service worker : active le mode hors-ligne ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---- gestion du bouton retour matériel Android (WebView) ---- */
window.addEventListener("popstate", () => {
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (drawer.classList.contains("is-open")) closeDrawer();
});

/* ---- écouteurs ---- */
searchInput.addEventListener("input", (e) => {
  state.query = e.target.value;
  render();
});

chips.forEach(chip => {
  chip.addEventListener("click", () => {
    chips.forEach(c => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    state.filter = chip.dataset.filter;
    render();
  });
});

addFab.addEventListener("click", () => openAddForm());
cartToggle.addEventListener("click", openPanier);

menuToggle.addEventListener("click", openDrawer);
drawerCloseBtn.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);
navAllBtn.addEventListener("click", goToAllRecipes);
navFavBtn.addEventListener("click", goToFavoris);
navPanierBtn.addEventListener("click", goToPanier);
navAddBtn.addEventListener("click", goToAddRecipe);
navExportBtn.addEventListener("click", () => { exportRecipes(); closeDrawer(); });
navImportBtn.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) importRecipesFromFile(file);
  e.target.value = "";
  closeDrawer();
});

favToggleHeader.addEventListener("click", () => {
  const chipFav = document.querySelector('.chip[data-filter="favoris"]');
  const nowActive = state.filter !== "favoris";
  favToggleHeader.setAttribute("aria-pressed", nowActive);
  chips.forEach(c => c.classList.remove("is-active"));
  if (nowActive) {
    chipFav.classList.add("is-active");
    state.filter = "favoris";
  } else {
    document.querySelector('.chip[data-filter="tout"]').classList.add("is-active");
    state.filter = "tout";
  }
  render();
});

/* ---- démarrage (attend une session valide) ---- */
initAuth(() => {
  renderHero();
  render();
  updateCartBadge();
});

navLogoutBtn.addEventListener("click", () => {
  closeDrawer();
  logout();
});
