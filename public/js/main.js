/* =========================================================
   LE CARNET — point d'entrée
   Pensé pour tourner tel quel dans une WebView Android
   (aucune dépendance externe, polices incluses — fonctionne hors-ligne).
   ========================================================= */

import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView
} from "./dom.js";
import { render } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe } from "./ui.js";
import { initAuth, logout } from "./auth.js";
import { openProfile, closeProfile, updateAccountBadge, initSyncBadge } from "./profile.js";
import { flush } from "./write-queue.js";
import "./timer.js";

/* ---- service worker : active le mode hors-ligne ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---- file d'attente hors-ligne : réessaie dès que la connexion revient ---- */
window.addEventListener("online", () => { flush(); });

/* ---- gestion du bouton retour matériel Android (WebView) ---- */
window.addEventListener("popstate", () => {
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
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
initAuth(() => {
  initRecipesSync();
  initFavoritesSync();
  initCartSync();
  initSyncBadge();
  updateCartBadge();
  updateAccountBadge();
  flush();
});

navLogoutBtn.addEventListener("click", () => {
  closeDrawer();
  clearFavoritesLocal();
  clearCartLocal();
  logout();
});
