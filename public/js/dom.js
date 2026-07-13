/* ---- éléments du DOM ---- */
export const heroSlot = document.getElementById("heroSlot");
export const grid = document.getElementById("recipeGrid");
export const emptyState = document.getElementById("emptyState");
export const resultTitle = document.getElementById("resultTitle");
export const resultCount = document.getElementById("resultCount");
export const searchInput = document.getElementById("searchInput");
export const chips = document.querySelectorAll(".chip");
export const favToggleHeader = document.getElementById("favToggle");
export const detailView = document.getElementById("detailView");
export const detailScroll = document.getElementById("detailScroll");
export const addFab = document.getElementById("addFab");
export const addView = document.getElementById("addView");
export const addScroll = document.getElementById("addScroll");
export const cartToggle = document.getElementById("cartToggle");
export const cartBadge = document.getElementById("cartBadge");
export const panierView = document.getElementById("panierView");
export const panierScroll = document.getElementById("panierScroll");
export const menuToggle = document.getElementById("menuToggle");
export const drawer = document.getElementById("drawer");
export const drawerOverlay = document.getElementById("drawerOverlay");
export const drawerCloseBtn = document.getElementById("drawerCloseBtn");
export const navAllBtn = document.getElementById("navAllBtn");
export const navFavBtn = document.getElementById("navFavBtn");
export const navPanierBtn = document.getElementById("navPanierBtn");
export const navAddBtn = document.getElementById("navAddBtn");
export const navExportBtn = document.getElementById("navExportBtn");
export const navImportBtn = document.getElementById("navImportBtn");
export const navLogoutBtn = document.getElementById("navLogoutBtn");
export const importFileInput = document.getElementById("importFileInput");
export const timerBadge = document.getElementById("timerBadge");
export const timerBadgeValue = document.getElementById("timerBadgeValue");
export const toast = document.getElementById("toast");
export const accountToggle = document.getElementById("accountToggle");
export const accountIcon = document.getElementById("accountIcon");
export const profileView = document.getElementById("profileView");
export const profileScroll = document.getElementById("profileScroll");

/* ---- état de l'application ---- */
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]"))
};
