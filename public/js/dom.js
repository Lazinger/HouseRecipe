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
export const scanView = document.getElementById("scanView");
export const scanScroll = document.getElementById("scanScroll");
export const scanCloseBtn = document.getElementById("scanCloseBtn");
export const navScanBtn = document.getElementById("navScanBtn");
export const importUrlView = document.getElementById("importUrlView");
export const importUrlScroll = document.getElementById("importUrlScroll");
export const importUrlCloseBtn = document.getElementById("importUrlCloseBtn");
export const navImportUrlBtn = document.getElementById("navImportUrlBtn");
export const photoEditorView = document.getElementById("photoEditorView");
export const photoEditorScroll = document.getElementById("photoEditorScroll");
export const photoEditorCloseBtn = document.getElementById("photoEditorCloseBtn");
export const menuToggle = document.getElementById("menuToggle");
export const drawer = document.getElementById("drawer");
export const drawerOverlay = document.getElementById("drawerOverlay");
export const drawerCloseBtn = document.getElementById("drawerCloseBtn");
export const navAllBtn = document.getElementById("navAllBtn");
export const navFavBtn = document.getElementById("navFavBtn");
export const navPanierBtn = document.getElementById("navPanierBtn");
export const navAddBtn = document.getElementById("navAddBtn");
export const navLogoutBtn = document.getElementById("navLogoutBtn");
export const timerBadge = document.getElementById("timerBadge");
export const timerBadgeValue = document.getElementById("timerBadgeValue");
export const toast = document.getElementById("toast");
export const accountToggle = document.getElementById("accountToggle");
export const accountIcon = document.getElementById("accountIcon");
export const syncBadge = document.getElementById("syncBadge");
export const profileView = document.getElementById("profileView");
export const profileScroll = document.getElementById("profileScroll");
export const sheetBackdrop = document.getElementById("sheetBackdrop");
export const detailCloseBtn = document.getElementById("detailCloseBtn");
export const addCloseBtn = document.getElementById("addCloseBtn");
export const panierCloseBtn = document.getElementById("panierCloseBtn");
export const profileCloseBtn = document.getElementById("profileCloseBtn");
export const brandHomeBtn = document.getElementById("brandHomeBtn");
export const allergenFilterToggle = document.getElementById("allergenFilterToggle");
export const allergenFilterBadge = document.getElementById("allergenFilterBadge");
export const allergenFilterPanel = document.getElementById("allergenFilterPanel");
export const allergenFilterList = document.getElementById("allergenFilterList");

/* ---- état de l'application ---- */
export const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]")),
  excludedAllergens: new Set(JSON.parse(localStorage.getItem("carnet-allergenes-exclus") || "[]"))
};
