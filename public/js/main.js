/* =========================================================
   LE CARNET — point d'entrée
   Pensé pour tourner tel quel dans une WebView Android
   (aucune dépendance externe, polices incluses — fonctionne hors-ligne).
   ========================================================= */

import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
import { render, renderAllergenFilterPanel } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { closeScanRecipe } from "./scan-recipe.js";
import { closeImportUrl } from "./import-url.js";
import { closePhotoEditor } from "./photo-editor.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, goToImportUrl, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
import { initAuth, logout } from "./auth.js";
import { openProfile, closeProfile, updateAccountBadge, initSyncBadge } from "./profile.js";
import { flush, onPermanentFailure } from "./write-queue.js";
import "./timer.js";

/* ---- service worker : active le mode hors-ligne ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---- file d'attente hors-ligne : réessaie dès que la connexion revient ---- */
window.addEventListener("online", () => { flush(); });
onPermanentFailure(showToast);

/* ---- fermeture de la feuille ouverte (tap sur le fond assombri, ou retour matériel Android) ---- */
function closeAnyOpenSheet(){
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
  if (scanView.classList.contains("is-open")) closeScanRecipe();
  if (importUrlView.classList.contains("is-open")) closeImportUrl();
  closePhotoEditor();
}

window.addEventListener("popstate", () => {
  closeAnyOpenSheet();
  resetSheetHistory();
  if (drawer.classList.contains("is-open")) closeDrawer();
});

sheetBackdrop.addEventListener("click", requestCloseSheet);
detailCloseBtn.addEventListener("click", requestCloseSheet);
addCloseBtn.addEventListener("click", requestCloseSheet);
panierCloseBtn.addEventListener("click", requestCloseSheet);
profileCloseBtn.addEventListener("click", requestCloseSheet);
scanCloseBtn.addEventListener("click", requestCloseSheet);
importUrlCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);

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

renderAllergenFilterPanel();
allergenFilterToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  allergenFilterPanel.hidden = !allergenFilterPanel.hidden;
});
document.addEventListener("click", (e) => {
  if (allergenFilterPanel.hidden) return;
  if (allergenFilterPanel.contains(e.target) || allergenFilterToggle.contains(e.target)) return;
  allergenFilterPanel.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !allergenFilterPanel.hidden) allergenFilterPanel.hidden = true;
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
navScanBtn.addEventListener("click", goToScanRecipe);
navImportUrlBtn.addEventListener("click", goToImportUrl);

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

accountToggle.addEventListener("click", openProfile);

/* ---- démarrage (attend une session valide) ---- */
initAuth(async () => {
  await flush().catch(() => {});
  initRecipesSync();
  initFavoritesSync();
  initCartSync();
  initPhotosSync();
  initSyncBadge();
  updateCartBadge();
  updateAccountBadge();
});

navLogoutBtn.addEventListener("click", () => {
  closeDrawer();
  clearFavoritesLocal();
  clearCartLocal();
  logout();
});
