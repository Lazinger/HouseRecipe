/* =========================================================
   LE CARNET — logique de l'application
   Pensé pour tourner tel quel dans une WebView Android
   (aucune dépendance externe, polices incluses — fonctionne hors-ligne).
   ========================================================= */

/* ---- service worker : active le mode hors-ligne ---- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ---- petites icônes SVG façon croquis de carnet, réutilisées par type ---- */
const ICONS = {
  pot: `<svg viewBox="0 0 40 40" fill="none"><path d="M7 16h26l-2 15a3 3 0 0 1-3 2.6H12a3 3 0 0 1-3-2.6L7 16Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 16h32M12 16c0-5 3-9 8-9s8 4 8 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  pan: `<svg viewBox="0 0 40 40" fill="none"><ellipse cx="17" cy="20" rx="12" ry="8" stroke="currentColor" stroke-width="1.8"/><path d="M29 17h9M29 23h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  tart: `<svg viewBox="0 0 40 40" fill="none"><path d="M6 22a14 14 0 0 1 28 0" stroke="currentColor" stroke-width="1.8"/><path d="M4 22h32l-2 3H6l-2-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13 22V13M20 22V10M27 22V13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  bowl: `<svg viewBox="0 0 40 40" fill="none"><path d="M5 18h30a15 10 0 0 1-30 0Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 18V7M14 10l6-3 6 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  crepe: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="14" stroke="currentColor" stroke-width="1.8"/><path d="M20 6v28" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 3"/></svg>`,
  jar: `<svg viewBox="0 0 40 40" fill="none"><rect x="10" y="12" width="20" height="21" rx="4" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="6" width="14" height="6" rx="2" stroke="currentColor" stroke-width="1.8"/></svg>`
};

/* ---- données des recettes ---- */
const RECIPES = [
  {
    id: "ratatouille",
    title: "Ratatouille provençale",
    category: "plat",
    icon: "pot",
    desc: "Légumes d'été mijotés doucement, à l'huile d'olive et au thym.",
    time: 55, servings: 4, difficulty: "Facile",
    ingredients: [
      ["Aubergine", "2 pièces"], ["Courgette", "3 pièces"], ["Poivron rouge", "2 pièces"],
      ["Tomate", "4 pièces"], ["Oignon", "2 pièces"], ["Ail", "3 gousses"],
      ["Huile d'olive", "6 c. à soupe"], ["Thym frais", "4 branches"], ["Sel, poivre", "au goût"]
    ],
    steps: [
      "Coupez tous les légumes en dés réguliers d'environ 1,5 cm.",
      "Faites revenir l'oignon et l'ail dans l'huile d'olive à feu moyen, 5 minutes.",
      "Ajoutez le poivron, faites cuire 5 minutes, puis l'aubergine et la courgette.",
      "Incorporez les tomates et le thym, salez, poivrez.",
      "Laissez mijoter à couvert 35 minutes en remuant de temps en temps.",
      "Retirez le couvercle 10 minutes en fin de cuisson pour réduire le jus."
    ],
    note: "Encore meilleure réchauffée le lendemain : les saveurs ont le temps de se mêler."
  },
  {
    id: "quiche-lorraine",
    title: "Quiche lorraine",
    category: "plat",
    icon: "tart",
    desc: "Pâte brisée, lardons fumés et appareil crémeux, sans fromage à l'origine.",
    time: 50, servings: 6, difficulty: "Facile",
    ingredients: [
      ["Pâte brisée", "1 rouleau"], ["Lardons fumés", "200 g"], ["Œufs", "3 pièces"],
      ["Crème fraîche épaisse", "20 cl"], ["Lait", "10 cl"], ["Noix de muscade", "1 pincée"],
      ["Sel, poivre", "au goût"]
    ],
    steps: [
      "Préchauffez le four à 200 °C. Étalez la pâte dans un moule à tarte.",
      "Faites revenir les lardons à sec 3 minutes, puis répartissez-les sur la pâte.",
      "Fouettez les œufs, la crème, le lait, la muscade, le sel et le poivre.",
      "Versez l'appareil sur les lardons.",
      "Enfournez 30 à 35 minutes, jusqu'à ce que la surface soit dorée."
    ],
    note: "La vraie recette lorraine ne contient pas de gruyère — mais personne ne vous en voudra d'en ajouter."
  },
  {
    id: "tarte-tatin",
    title: "Tarte Tatin",
    category: "dessert",
    icon: "tart",
    desc: "Pommes caramélisées renversées sur une pâte feuilletée croustillante.",
    time: 65, servings: 6, difficulty: "Intermédiaire",
    ingredients: [
      ["Pommes (Reinette)", "8 pièces"], ["Sucre", "150 g"], ["Beurre demi-sel", "80 g"],
      ["Pâte feuilletée", "1 rouleau"]
    ],
    steps: [
      "Épluchez et coupez les pommes en quartiers épais.",
      "Dans un moule allant au four, faites un caramel à sec avec le sucre.",
      "Ajoutez le beurre hors du feu, puis disposez les pommes serrées, côté bombé vers le bas.",
      "Faites cuire 15 minutes à feu doux sur la plaque de cuisson.",
      "Recouvrez de pâte feuilletée en rentrant les bords, puis enfournez 25 minutes à 200 °C.",
      "Laissez tiédir 10 minutes avant de démouler d'un geste sûr sur un plat."
    ],
    note: "Démoulez tant que c'est encore chaud : le caramel fige vite et colle au moule en refroidissant."
  },
  {
    id: "coq-au-vin",
    title: "Coq au vin",
    category: "plat",
    icon: "pot",
    desc: "Poulet mijoté au vin rouge, lardons, champignons et petits oignons.",
    time: 100, servings: 4, difficulty: "Intermédiaire",
    ingredients: [
      ["Cuisses de poulet", "6 pièces"], ["Vin rouge corsé", "75 cl"], ["Lardons", "150 g"],
      ["Champignons de Paris", "250 g"], ["Petits oignons grelots", "12 pièces"],
      ["Carotte", "2 pièces"], ["Ail", "3 gousses"], ["Bouquet garni", "1"], ["Farine", "2 c. à soupe"]
    ],
    steps: [
      "Faites dorer les morceaux de poulet dans une cocotte, puis réservez.",
      "Faites revenir les lardons, les oignons et les carottes dans la même cocotte.",
      "Saupoudrez de farine, mélangez 1 minute, puis remettez le poulet.",
      "Versez le vin, ajoutez l'ail et le bouquet garni, salez, poivrez.",
      "Laissez mijoter à couvert 1 h 15 à feu doux.",
      "Ajoutez les champignons 15 minutes avant la fin de cuisson."
    ],
    note: "Un vin qu'on accepterait de boire fera toujours une meilleure sauce."
  },
  {
    id: "crepes",
    title: "Crêpes fines",
    category: "dessert",
    icon: "crepe",
    desc: "La pâte de base à garder sous la main, sucrée ou salée.",
    time: 30, servings: 4, difficulty: "Facile",
    ingredients: [
      ["Farine", "250 g"], ["Œufs", "3 pièces"], ["Lait", "50 cl"],
      ["Beurre fondu", "50 g"], ["Sucre", "2 c. à soupe"], ["Sel", "1 pincée"]
    ],
    steps: [
      "Mélangez la farine, le sucre et le sel dans un saladier.",
      "Creusez un puits, ajoutez les œufs et fouettez en incorporant peu à peu le lait.",
      "Ajoutez le beurre fondu, puis laissez reposer la pâte 30 minutes.",
      "Faites cuire chaque crêpe 1 à 2 minutes par face dans une poêle chaude et légèrement beurrée."
    ],
    note: "Une pâte reposée donne des crêpes plus souples : ne sautez pas cette étape si vous avez le temps."
  },
  {
    id: "soupe-oignon",
    title: "Soupe à l'oignon gratinée",
    category: "entrée",
    icon: "bowl",
    desc: "Oignons longuement caramélisés, croûtons et gruyère fondu.",
    time: 75, servings: 4, difficulty: "Facile",
    ingredients: [
      ["Oignons jaunes", "6 pièces"], ["Beurre", "40 g"], ["Bouillon de bœuf", "1,2 l"],
      ["Vin blanc sec", "10 cl"], ["Pain de campagne", "8 tranches"], ["Gruyère râpé", "150 g"]
    ],
    steps: [
      "Émincez finement les oignons.",
      "Faites-les fondre dans le beurre à feu doux 35 à 40 minutes, jusqu'à belle coloration.",
      "Déglacez au vin blanc, puis ajoutez le bouillon et laissez mijoter 20 minutes.",
      "Répartissez la soupe dans des bols, couvrez de pain et de gruyère.",
      "Passez sous le grill quelques minutes jusqu'à ce que le fromage gratine."
    ],
    note: "La patience sur les oignons fait toute la différence : ne pressez pas la caramélisation."
  },
  {
    id: "tarte-citron",
    title: "Tarte au citron meringuée",
    category: "dessert",
    icon: "tart",
    desc: "Crème citron acidulée sur pâte sablée, meringue légèrement dorée.",
    time: 80, servings: 8, difficulty: "Intermédiaire",
    ingredients: [
      ["Pâte sablée", "1 fond de tarte"], ["Citrons", "4 pièces"], ["Œufs", "4 pièces"],
      ["Sucre", "180 g"], ["Beurre", "100 g"], ["Blancs d'œufs (meringue)", "3 pièces"],
      ["Sucre (meringue)", "90 g"]
    ],
    steps: [
      "Faites cuire le fond de tarte à blanc 15 minutes à 180 °C.",
      "Fouettez les œufs et le sucre, ajoutez le jus et le zeste de citron.",
      "Faites épaissir au bain-marie en remuant, puis incorporez le beurre hors du feu.",
      "Versez la crème sur le fond de tarte cuit et laissez refroidir.",
      "Montez les blancs en neige avec le sucre pour une meringue brillante.",
      "Recouvrez la tarte de meringue et dorez au chalumeau ou sous le grill."
    ],
    note: "Zestez les citrons avant de les presser — l'inverse est nettement plus périlleux."
  },
  {
    id: "confit-oignons",
    title: "Confit d'oignons maison",
    category: "entrée",
    icon: "jar",
    desc: "Un condiment sucré-salé qui accompagne charcuteries et fromages.",
    time: 60, servings: 1, difficulty: "Facile",
    ingredients: [
      ["Oignons rouges", "1 kg"], ["Sucre roux", "100 g"], ["Vinaigre balsamique", "8 cl"],
      ["Beurre", "30 g"], ["Sel", "1 pincée"]
    ],
    steps: [
      "Émincez finement les oignons.",
      "Faites-les suer dans le beurre à feu doux 10 minutes.",
      "Ajoutez le sucre et laissez caraméliser légèrement 10 minutes.",
      "Versez le vinaigre, salez, et laissez mijoter à découvert 30 minutes en remuant régulièrement.",
      "Mettez en pot une fois la texture bien confite et laissez refroidir avant de fermer."
    ],
    note: "Se conserve environ deux semaines au réfrigérateur dans un bocal propre."
  }
];

/* ---- recettes ajoutées par l'utilisateur (persistées) ---- */
const CUSTOM_RECIPES_KEY = "carnet-recettes-perso";
const CATEGORY_ICON = { "entrée": "bowl", plat: "pot", dessert: "tart" };

function loadCustomRecipes(){
  try { return JSON.parse(localStorage.getItem(CUSTOM_RECIPES_KEY) || "[]"); }
  catch { return []; }
}
function saveCustomRecipes(){
  localStorage.setItem(CUSTOM_RECIPES_KEY, JSON.stringify(customRecipes));
}

const customRecipes = loadCustomRecipes();
const ALL_RECIPES = [...RECIPES, ...customRecipes];

/* ---- photos de recettes (IndexedDB — trop lourd pour localStorage) ---- */
const PHOTO_DB_NAME = "carnet-photos";
const PHOTO_STORE = "photos";

function openPhotoDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PHOTO_DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(PHOTO_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function savePhoto(recipeId, file){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).put(file, recipeId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getPhoto(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readonly");
    const req = tx.objectStore(PHOTO_STORE).get(recipeId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function deletePhoto(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    tx.objectStore(PHOTO_STORE).delete(recipeId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function stepPhotoKey(recipeId, index){
  return `${recipeId}::step::${index}`;
}
async function saveStepPhoto(recipeId, index, file){
  return savePhoto(stepPhotoKey(recipeId, index), file);
}
async function getStepPhoto(recipeId, index){
  return getPhoto(stepPhotoKey(recipeId, index));
}
async function deleteAllPhotosForRecipe(recipeId){
  const db = await openPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PHOTO_STORE, "readwrite");
    const range = IDBKeyRange.bound(recipeId, recipeId + "￿");
    const req = tx.objectStore(PHOTO_STORE).delete(range);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(req.error);
  });
}
function applyCardPhoto(recipeId, iconEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !iconEl) return;
    iconEl.classList.add("has-photo");
    iconEl.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="">`;
  }).catch(() => {});
}
function applyDetailPhoto(recipeId, heroEl){
  getPhoto(recipeId).then(blob => {
    if (!blob || !heroEl) return;
    heroEl.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
  }).catch(() => {});
}

/* ---- export / import : sauvegarde JSON des recettes ajoutées + favoris ---- */
function exportRecipes(){
  const data = { recipes: customRecipes, favorites: [...state.favorites] };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carnet-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Sauvegarde téléchargée");
}
function importRecipesFromFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch { showToast("Fichier invalide"); return; }
    if (!data || !Array.isArray(data.recipes) || !Array.isArray(data.favorites)) {
      showToast("Fichier invalide");
      return;
    }
    let added = 0;
    data.recipes.forEach(recipe => {
      if (!recipe || !recipe.id || ALL_RECIPES.some(r => r.id === recipe.id)) return;
      customRecipes.push(recipe);
      ALL_RECIPES.push(recipe);
      added++;
    });
    data.favorites.forEach(id => state.favorites.add(id));
    saveCustomRecipes();
    saveFavorites();
    render();
    showToast(added > 0 ? `${added} recette(s) importée(s)` : "Sauvegarde importée");
  };
  reader.readAsText(file);
}

function slugify(str){
  const withoutAccents = str.toLowerCase().normalize("NFD")
    .split("").filter(ch => ch.codePointAt(0) < 0x300 || ch.codePointAt(0) > 0x36f).join("");
  return withoutAccents.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function generateRecipeId(title){
  const base = slugify(title) || "recette";
  let id = base, n = 2;
  while (ALL_RECIPES.some(r => r.id === id)) { id = `${base}-${n}`; n++; }
  return id;
}
function escapeAttr(str){
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/* ---- état de l'application ---- */
const state = {
  query: "",
  filter: "tout",
  favorites: new Set(JSON.parse(localStorage.getItem("carnet-favoris") || "[]"))
};

/* ---- éléments du DOM ---- */
const heroSlot = document.getElementById("heroSlot");
const grid = document.getElementById("recipeGrid");
const emptyState = document.getElementById("emptyState");
const resultTitle = document.getElementById("resultTitle");
const resultCount = document.getElementById("resultCount");
const searchInput = document.getElementById("searchInput");
const chips = document.querySelectorAll(".chip");
const favToggleHeader = document.getElementById("favToggle");
const detailView = document.getElementById("detailView");
const detailScroll = document.getElementById("detailScroll");
const addFab = document.getElementById("addFab");
const addView = document.getElementById("addView");
const addScroll = document.getElementById("addScroll");
const cartToggle = document.getElementById("cartToggle");
const cartBadge = document.getElementById("cartBadge");
const panierView = document.getElementById("panierView");
const panierScroll = document.getElementById("panierScroll");
const menuToggle = document.getElementById("menuToggle");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const drawerCloseBtn = document.getElementById("drawerCloseBtn");
const navAllBtn = document.getElementById("navAllBtn");
const navFavBtn = document.getElementById("navFavBtn");
const navPanierBtn = document.getElementById("navPanierBtn");
const navAddBtn = document.getElementById("navAddBtn");
const navExportBtn = document.getElementById("navExportBtn");
const navImportBtn = document.getElementById("navImportBtn");
const importFileInput = document.getElementById("importFileInput");
const timerBadge = document.getElementById("timerBadge");
const timerBadgeValue = document.getElementById("timerBadgeValue");
const toast = document.getElementById("toast");

const CATEGORY_LABELS = { tout: "Toutes les recettes", "entrée": "Entrées", plat: "Plats", dessert: "Desserts", favoris: "Mes favoris" };

/* ---- persistance des favoris ---- */
function saveFavorites(){
  localStorage.setItem("carnet-favoris", JSON.stringify([...state.favorites]));
}
function toggleFavorite(id){
  if (state.favorites.has(id)) { state.favorites.delete(id); showToast("Retiré des favoris"); }
  else { state.favorites.add(id); showToast("Ajouté aux favoris"); }
  saveFavorites();
  render();
  if (!detailView.hidden && detailView.classList.contains("is-open")) {
    syncDetailFavButton(id);
  }
}

/* ---- mise à l'échelle des quantités selon le nombre de personnes ---- */
function parseQuantity(qty){
  const m = String(qty).trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { value: parseFloat(m[1].replace(",", ".")), unit: m[2].trim() };
}
function formatScaledNumber(n){
  const rounded = Math.round(n * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}
function scaleQuantity(qty, ratio){
  const parsed = parseQuantity(qty);
  if (!parsed) return qty;
  const scaled = formatScaledNumber(parsed.value * ratio);
  return parsed.unit ? `${scaled} ${parsed.unit}` : scaled;
}

/* ---- panier de courses (persisté) ---- */
const CART_KEY = "carnet-panier";
const CART_CHECKED_KEY = "carnet-panier-coche";

function loadCart(){
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}
function saveCart(){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function loadCheckedItems(){
  try { return new Set(JSON.parse(localStorage.getItem(CART_CHECKED_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveCheckedItems(){
  localStorage.setItem(CART_CHECKED_KEY, JSON.stringify([...checkedItems]));
}

const cart = loadCart();
const checkedItems = loadCheckedItems();

function mergeQuantityParts(parts){
  const parsed = parts.map(parseQuantity);
  if (parsed.every(Boolean)) {
    const unit = parsed[0].unit.toLowerCase();
    if (parsed.every(p => p.unit.toLowerCase() === unit)) {
      const sum = parsed.reduce((acc, p) => acc + p.value, 0);
      const formatted = formatScaledNumber(sum);
      return parsed[0].unit ? `${formatted} ${parsed[0].unit}` : formatted;
    }
  }
  return [...new Set(parts.map(p => p.trim()))].join(" + ");
}

function mergeIngredientsForShopping(){
  const groups = new Map();
  cart.forEach(entry => {
    entry.ingredients.forEach(([name, qty]) => {
      const key = name.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, { key, name: name.trim(), parts: [] });
      groups.get(key).parts.push(qty);
    });
  });
  return [...groups.values()].map(g => ({ key: g.key, name: g.name, qty: mergeQuantityParts(g.parts) }));
}

function addRecipeToCart(recipe, servings, ingredients){
  const idx = cart.findIndex(e => e.recipeId === recipe.id);
  const entry = { recipeId: recipe.id, title: recipe.title, category: recipe.category, servings, ingredients };
  if (idx >= 0) cart[idx] = entry; else cart.push(entry);
  saveCart();
  updateCartBadge();
}

function removeRecipeFromCart(recipeId){
  const idx = cart.findIndex(e => e.recipeId === recipeId);
  if (idx >= 0) cart.splice(idx, 1);
  saveCart();
  updateCartBadge();
  renderPanier();
}

function clearCart(){
  cart.length = 0;
  checkedItems.clear();
  saveCart();
  saveCheckedItems();
  updateCartBadge();
  renderPanier();
  showToast("Panier vidé");
}

function updateCartBadge(){
  cartBadge.textContent = cart.length;
  cartBadge.hidden = cart.length === 0;
  const detailCartBadge = document.getElementById("detailCartBadge");
  if (detailCartBadge) {
    detailCartBadge.textContent = cart.length;
    detailCartBadge.hidden = cart.length === 0;
  }
}

/* ---- verrouillage du scroll : plusieurs vues plein écran peuvent être empilées ---- */
function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || drawer.classList.contains("is-open");
  document.body.style.overflow = anyOpen ? "hidden" : "";
}

/* ---- tiroir de navigation ---- */
function openDrawer(){
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  drawerOverlay.hidden = false;
  requestAnimationFrame(() => drawerOverlay.classList.add("is-open"));
  syncBodyScrollLock();
}
function closeDrawer(){
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

function goToAllRecipes(){
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
function goToFavoris(){
  closeAllOverlays();
  closeDrawer();
  chips.forEach(c => c.classList.remove("is-active"));
  document.querySelector('.chip[data-filter="favoris"]').classList.add("is-active");
  favToggleHeader.setAttribute("aria-pressed", "true");
  state.filter = "favoris";
  render();
}
function goToPanier(){
  closeAllOverlays();
  closeDrawer();
  openPanier();
}
function goToAddRecipe(){
  closeAllOverlays();
  closeDrawer();
  openAddForm();
}

/* ---- toast ---- */
let toastTimer = null;
function showToast(msg){
  toast.textContent = msg;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

/* ---- minuteur de cuisine (compte à rebours, un seul actif, persiste en arrière-plan) ---- */
const TIMER_KEY = "carnet-minuteur";
let timerTickId = null;

function loadTimerState(){
  try { return JSON.parse(localStorage.getItem(TIMER_KEY) || "null"); }
  catch { return null; }
}
function saveTimerState(t){
  if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t));
  else localStorage.removeItem(TIMER_KEY);
}

let timerState = loadTimerState();

function formatTimer(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function timerRemainingSeconds(){
  if (!timerState) return 0;
  if (!timerState.running) return timerState.remainingAtPause;
  return (timerState.endAt - Date.now()) / 1000;
}

function playTimerBeep(){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.18);
    });
  } catch {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function addTimerMinutes(recipe, minutes){
  const addSeconds = Math.max(1, Math.round(minutes)) * 60;
  const belongsHere = timerState && timerState.recipeId === recipe.id;

  if (!belongsHere) {
    timerState = {
      recipeId: recipe.id, recipeTitle: recipe.title,
      durationSeconds: addSeconds,
      endAt: Date.now() + addSeconds * 1000,
      running: false, remainingAtPause: addSeconds, done: false
    };
  } else if (timerState.running) {
    timerState.endAt += addSeconds * 1000;
    timerState.durationSeconds += addSeconds;
    timerState.done = false;
  } else {
    timerState.remainingAtPause += addSeconds;
    timerState.durationSeconds += addSeconds;
    timerState.done = false;
  }

  saveTimerState(timerState);
  updateTimerBadge();
  renderTimerPanelIfOpen();
  if (timerState.running) ensureTimerTicking();
}
function pauseTimer(){
  if (!timerState || !timerState.running) return;
  timerState.remainingAtPause = Math.max(0, timerRemainingSeconds());
  timerState.running = false;
  saveTimerState(timerState);
  updateTimerBadge();
  renderTimerPanelIfOpen();
}
function resumeTimer(){
  if (!timerState || timerState.running) return;
  timerState.endAt = Date.now() + timerState.remainingAtPause * 1000;
  timerState.running = true;
  saveTimerState(timerState);
  updateTimerBadge();
  renderTimerPanelIfOpen();
  ensureTimerTicking();
}
function resetTimer(){
  timerState = null;
  saveTimerState(null);
  if (timerTickId) { clearInterval(timerTickId); timerTickId = null; }
  updateTimerBadge();
  renderTimerPanelIfOpen();
}

function ensureTimerTicking(){
  if (timerTickId) return;
  timerTickId = setInterval(() => {
    if (!timerState || !timerState.running) return;
    const remaining = timerRemainingSeconds();
    if (remaining <= 0 && !timerState.done) {
      timerState.done = true;
      timerState.running = false;
      timerState.remainingAtPause = 0;
      saveTimerState(timerState);
      showToast(`Minuteur terminé — ${timerState.recipeTitle}`);
      playTimerBeep();
    }
    updateTimerBadge();
    renderTimerPanelIfOpen();
  }, 1000);
}

function updateTimerBadge(){
  if (!timerState) { timerBadge.hidden = true; return; }
  timerBadge.hidden = false;
  timerBadgeValue.textContent = formatTimer(timerRemainingSeconds());
}

function renderTimerPanelIfOpen(){
  if (!detailView.classList.contains("is-open") || !currentOpenRecipe) return;
  const panel = detailScroll.querySelector("#timerPanel");
  if (panel) renderTimerPanel(panel, currentOpenRecipe);
}

let currentOpenRecipe = null;

function renderTimerPanel(panel, recipe){
  const belongsHere = timerState && timerState.recipeId === recipe.id;
  const remaining = belongsHere ? timerRemainingSeconds() : 0;
  const isDone = belongsHere && timerState.done;
  const isRunning = belongsHere && timerState.running;
  const hasTime = belongsHere && remaining > 0;

  panel.innerHTML = `
    <div class="timer-panel-head"><h4>⏱ Minuteur</h4></div>
    <div class="${isDone ? "timer-display is-done" : "timer-display"}">${belongsHere ? (isDone ? "Terminé" : formatTimer(remaining)) : "00:00"}</div>
    <div class="timer-quick">
      <button type="button" data-mins="1">+1 min</button>
      <button type="button" data-mins="5">+5 min</button>
      <button type="button" data-mins="10">+10 min</button>
    </div>
    <div class="timer-actions">
      <button type="button" class="timer-start" id="timerPlayBtn" ${isRunning || !hasTime ? "disabled" : ""}>Lecture</button>
      <button type="button" class="timer-start" id="timerPauseBtn" ${!isRunning ? "disabled" : ""}>Pause</button>
      <button type="button" class="timer-reset" id="timerResetBtn" ${!belongsHere ? "disabled" : ""}>Réinitialiser</button>
    </div>
  `;

  panel.querySelectorAll("[data-mins]").forEach(btn => {
    btn.addEventListener("click", () => addTimerMinutes(recipe, parseInt(btn.dataset.mins, 10)));
  });
  panel.querySelector("#timerPlayBtn").addEventListener("click", resumeTimer);
  panel.querySelector("#timerPauseBtn").addEventListener("click", pauseTimer);
  panel.querySelector("#timerResetBtn").addEventListener("click", resetTimer);
}

timerBadge.addEventListener("click", () => {
  if (timerState) openDetail(timerState.recipeId);
});

if (timerState) {
  updateTimerBadge();
  if (timerState.running) ensureTimerTicking();
}

/* ---- rendu du héros (recette du jour, fixe pour la démo) ---- */
function renderHero(){
  const featured = RECIPES[0];
  heroSlot.innerHTML = `
    <button class="hero-card cat-${featured.category}" data-id="${featured.id}" type="button">
      <div class="hero-copy">
        <span class="hero-eyebrow">La recette du carnet</span>
        <h2>${featured.title}</h2>
        <p>${featured.desc}</p>
        <div class="hero-meta">
          <span>⏱ ${featured.time} min</span>
          <span>${featured.servings} pers.</span>
          <span>${featured.difficulty}</span>
        </div>
      </div>
      <div class="hero-art">${ICONS[featured.icon]}</div>
    </button>
  `;
  heroSlot.querySelector(".hero-card").addEventListener("click", () => openDetail(featured.id));
}

/* ---- filtrage ---- */
function getFilteredRecipes(){
  const q = state.query.trim().toLowerCase();
  return ALL_RECIPES.filter(r => {
    const matchesFilter =
      state.filter === "tout" ? true :
      state.filter === "favoris" ? state.favorites.has(r.id) :
      r.category === state.filter;
    if (!matchesFilter) return false;
    if (!q) return true;
    const haystack = (r.title + " " + r.desc + " " + r.ingredients.map(i => i[0]).join(" ")).toLowerCase();
    return haystack.includes(q);
  });
}

/* ---- rendu de la grille ---- */
function renderGrid(){
  const list = getFilteredRecipes();
  resultTitle.textContent = CATEGORY_LABELS[state.filter] || "Recettes";
  resultCount.textContent = list.length + (list.length > 1 ? " recettes" : " recette");

  grid.innerHTML = "";
  emptyState.hidden = list.length !== 0;

  list.forEach(r => {
    const card = document.createElement("button");
    card.className = `recipe-card cat-${r.category}`;
    card.type = "button";
    card.dataset.id = r.id;
    const isFav = state.favorites.has(r.id);
    card.innerHTML = `
      <div class="card-top">
        <span class="card-icon">${ICONS[r.icon]}</span>
        <button class="card-fav" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris" data-favid="${r.id}">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <span class="card-cat">${r.category}</span>
      <h3 class="card-title">${r.title}</h3>
      <p class="card-desc">${r.desc}</p>
      <div class="card-meta">
        <span>⏱ ${r.time} min</span>
        <span>${r.servings} pers.</span>
        <span>${r.difficulty}</span>
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-fav")) return;
      openDetail(r.id);
    });
    card.querySelector(".card-fav").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(r.id);
    });
    grid.appendChild(card);
    applyCardPhoto(r.id, card.querySelector(".card-icon"));
  });
}

function render(){
  renderGrid();
}

/* ---- vue détail ---- */
const ING_ICON = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21c-4.5 0-8-3.5-8-8 0-6 8-11 8-11s8 5 8 11c0 4.5-3.5 8-8 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 21V10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
function ingredientRowHtml(name, qty){
  return `<li><span class="ing-icon">${ING_ICON}</span><span class="ing-text"><span class="ing-name">${name}</span><span class="ing-qty">${qty}</span></span></li>`;
}

function openDetail(id){
  const r = ALL_RECIPES.find(x => x.id === id);
  if (!r) return;
  const isFav = state.favorites.has(r.id);
  const isCustom = customRecipes.some(cr => cr.id === r.id);

  detailView.className = `detail-view hf-theme cat-${r.category}`;

  detailScroll.innerHTML = `
    <div class="detail-hero" id="detailHero">
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          <button class="detail-fav is-menu" id="detailMenuBtn" type="button" aria-label="Ouvrir le menu">
            <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="back-btn" id="backBtn" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Retour
          </button>
        </div>
        <div class="detail-topbar-actions">
          ${isCustom ? `
          <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
          <button class="detail-fav" id="detailDeleteBtn" type="button" aria-label="Supprimer la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          ` : ""}
          <button class="detail-fav has-cart-badge" id="detailCartBtn" type="button" aria-label="Ouvrir le panier de courses">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            <span id="detailCartBadge" class="cart-badge" ${cart.length === 0 ? "hidden" : ""}>${cart.length}</span>
          </button>
          <button class="detail-fav" id="detailFavBtn" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div class="detail-heading">
        <span class="detail-eyebrow">${r.category}</span>
        <h2>${r.title}</h2>
        <p class="detail-sub">${r.desc}</p>
      </div>
    </div>
    <div class="detail-info">
      <div class="stats-flat" id="statsFlat">
        <div class="cell"><span class="l">Préparation</span><span class="v">${r.time} min</span></div>
        <div class="cell"><span class="l">Personnes</span><span class="v stat-stepper">
          <button class="step-btn" id="serveMinus" type="button" aria-label="Réduire le nombre de personnes">–</button>
          <span id="servingsValue">${r.servings}</span>
          <button class="step-btn" id="servePlus" type="button" aria-label="Augmenter le nombre de personnes">+</button>
        </span></div>
        <div class="cell"><span class="l">Difficulté</span><span class="v">${r.difficulty}</span></div>
        ${r.nutrition ? `
        <div class="cell is-nutri"><span class="l">Calories</span><span class="v">${r.nutrition.calories} kcal</span></div>
        <div class="cell is-nutri"><span class="l">Protéines</span><span class="v">${r.nutrition.protein} g</span></div>
        ` : ""}
      </div>
      ${r.allergens ? `<p class="allergen-line"><b>Allergènes :</b> ${r.allergens}</p>` : ""}
      ${r.utensils && r.utensils.length ? `<p class="tool-line">${r.utensils.map(u => `<span>${u}</span>`).join("")}</p>` : ""}
    </div>
    <div class="detail-body">
      <div>
        <h3 class="panel-title">Ingrédients</h3>
        <ul class="ingredient-list" id="ingredientList">
          ${r.ingredients.map(([name, qty]) => ingredientRowHtml(name, qty)).join("")}
        </ul>
        <button class="add-to-cart-btn" id="addToCartBtn" type="button">
          <svg viewBox="0 0 24 24" fill="none"><path d="M4 8h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8V6a4 4 0 0 1 8 0v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          Ajouter au panier
        </button>
        <div class="timer-panel" id="timerPanel"></div>
        ${r.note ? `<div class="note-box"><b>Astuce.</b> ${r.note}</div>` : ""}
      </div>
      <div>
        <h3 class="panel-title">Préparation</h3>
        <ol class="step-list" id="stepList">
          ${r.steps.map((s, i) => `<li data-step-index="${i}"><span class="step-num">${i + 1}</span><p>${s}</p></li>`).join("")}
        </ol>
      </div>
    </div>
  `;

  detailScroll.querySelector("#backBtn").addEventListener("click", closeDetail);
  detailScroll.querySelector("#detailFavBtn").addEventListener("click", () => toggleFavorite(r.id));
  detailScroll.querySelector("#detailCartBtn").addEventListener("click", openPanier);
  detailScroll.querySelector("#detailMenuBtn").addEventListener("click", openDrawer);
  if (isCustom) {
    detailScroll.querySelector("#detailEditBtn").addEventListener("click", () => goToEditRecipe(r));
    detailScroll.querySelector("#detailDeleteBtn").addEventListener("click", () => deleteRecipe(r.id));
  }

  currentOpenRecipe = r;
  renderTimerPanel(detailScroll.querySelector("#timerPanel"), r);
  applyDetailPhoto(r.id, detailScroll.querySelector("#detailHero"));
  const stepListEl = detailScroll.querySelector("#stepList");
  r.steps.forEach((_, i) => {
    getStepPhoto(r.id, i).then(blob => {
      if (!blob) return;
      const li = stepListEl.querySelector(`li[data-step-index="${i}"]`);
      if (!li) return;
      const img = document.createElement("img");
      img.className = "step-photo";
      img.src = URL.createObjectURL(blob);
      img.alt = "";
      li.querySelector(".step-num").after(img);
    }).catch(() => {});
  });

  let currentServings = r.servings;
  const servingsValueEl = detailScroll.querySelector("#servingsValue");
  const ingredientListEl = detailScroll.querySelector("#ingredientList");
  const minusBtn = detailScroll.querySelector("#serveMinus");
  const plusBtn = detailScroll.querySelector("#servePlus");

  function currentIngredients(){
    const ratio = currentServings / r.servings;
    return r.ingredients.map(([name, qty]) => [name, scaleQuantity(qty, ratio)]);
  }
  function renderScaledIngredients(){
    ingredientListEl.innerHTML = currentIngredients()
      .map(([name, qty]) => ingredientRowHtml(name, qty))
      .join("");
  }
  minusBtn.addEventListener("click", () => {
    if (currentServings <= 1) return;
    currentServings--;
    servingsValueEl.textContent = currentServings;
    minusBtn.disabled = currentServings <= 1;
    renderScaledIngredients();
  });
  plusBtn.addEventListener("click", () => {
    currentServings++;
    servingsValueEl.textContent = currentServings;
    minusBtn.disabled = currentServings <= 1;
    renderScaledIngredients();
  });
  detailScroll.querySelector("#addToCartBtn").addEventListener("click", () => {
    addRecipeToCart(r, currentServings, currentIngredients());
    showToast("Ajouté au panier");
  });

  detailView.classList.add("is-open");
  detailView.setAttribute("aria-hidden", "false");
  detailScroll.scrollTop = 0;
  syncBodyScrollLock();
}

function syncDetailFavButton(id){
  const btn = detailScroll.querySelector("#detailFavBtn");
  if (!btn) return;
  const isFav = state.favorites.has(id);
  btn.setAttribute("aria-pressed", isFav);
  btn.querySelector("path").setAttribute("fill", isFav ? "currentColor" : "none");
}

function closeDetail(){
  detailView.classList.remove("is-open");
  detailView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
}

function goToEditRecipe(recipe){
  closeDetail();
  openAddForm(recipe);
}

function deleteRecipe(id){
  if (!confirm("Supprimer définitivement cette recette ?")) return;
  const ci = customRecipes.findIndex(r => r.id === id);
  if (ci >= 0) customRecipes.splice(ci, 1);
  const ai = ALL_RECIPES.findIndex(r => r.id === id);
  if (ai >= 0) ALL_RECIPES.splice(ai, 1);
  saveCustomRecipes();
  state.favorites.delete(id);
  saveFavorites();
  removeRecipeFromCart(id);
  deletePhoto(id).catch(() => {});
  closeDetail();
  render();
  showToast("Recette supprimée");
}

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

function renderAddForm(editingRecipe){
  addScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="addMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="back-btn" id="addBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
      </div>
      <h2>${editingRecipe ? "Modifier la recette" : "Nouvelle recette"}</h2>
    </div>
    <form id="addForm" class="add-form" novalidate>
      <div class="field">
        <label for="addTitle">Titre *</label>
        <input id="addTitle" type="text" placeholder="Ex. Tarte aux pommes" value="${escapeAttr(editingRecipe?.title || "")}">
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
        <input id="addDesc" type="text" placeholder="Une phrase pour donner envie" value="${escapeAttr(editingRecipe?.desc || "")}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addTime">Temps (min)</label>
          <input id="addTime" type="number" min="0" placeholder="30" value="${editingRecipe?.time || ""}">
        </div>
        <div class="field">
          <label for="addServings">Personnes</label>
          <input id="addServings" type="number" min="1" placeholder="4" value="${editingRecipe?.servings || ""}">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="addCalories">Calories (optionnel)</label>
          <input id="addCalories" type="number" min="0" placeholder="Ex. 650" value="${editingRecipe?.nutrition?.calories ?? ""}">
        </div>
        <div class="field">
          <label for="addProtein">Protéines en g (optionnel)</label>
          <input id="addProtein" type="number" min="0" step="0.1" placeholder="Ex. 20" value="${editingRecipe?.nutrition?.protein ?? ""}">
        </div>
      </div>
      <div class="field">
        <label for="addAllergens">Allergènes (optionnel)</label>
        <input id="addAllergens" type="text" placeholder="Ex. Gluten, blé, lait" value="${escapeAttr(editingRecipe?.allergens || "")}">
      </div>
      <div class="field">
        <label for="addPhoto">Photo (optionnel)${editingRecipe ? " — laisse vide pour garder la photo actuelle" : ""}</label>
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

  addForm.querySelector("#addCategory").value = editingRecipe?.category || "";
  addForm.querySelector("#addDifficulty").value = editingRecipe?.difficulty || "Facile";

  if (editingRecipe && editingRecipe.ingredients.length) {
    editingRecipe.ingredients.forEach(([name, qty]) => ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl, name, qty)));
  } else {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
  }
  if (editingRecipe && editingRecipe.utensils && editingRecipe.utensils.length) {
    editingRecipe.utensils.forEach(text => ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl, text)));
  } else {
    ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl));
  }
  if (editingRecipe && editingRecipe.steps.length) {
    editingRecipe.steps.forEach(text => stepRowsEl.appendChild(createStepRow(stepRowsEl, text)));
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
  addScroll.querySelector("#addBackBtn").addEventListener("click", closeAddForm);
  addScroll.querySelector("#addMenuBtn").addEventListener("click", openDrawer);
  addScroll.querySelector("#addCancelBtn").addEventListener("click", closeAddForm);

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

    if (editingRecipe) {
      const recipe = {
        ...editingRecipe,
        title, category,
        icon: CATEGORY_ICON[category],
        desc, time, servings, difficulty, note,
        ingredients, steps, nutrition, allergens, utensils
      };
      const ci = customRecipes.findIndex(r => r.id === editingRecipe.id);
      if (ci >= 0) customRecipes[ci] = recipe;
      const ai = ALL_RECIPES.findIndex(r => r.id === editingRecipe.id);
      if (ai >= 0) ALL_RECIPES[ai] = recipe;
      saveCustomRecipes();

      if (photoFile) await savePhoto(recipe.id, photoFile);
      for (let i = 0; i < stepPhotoFiles.length; i++) {
        if (stepPhotoFiles[i]) await saveStepPhoto(recipe.id, i, stepPhotoFiles[i]);
      }

      closeAddForm();
      showToast("Recette modifiée");
      openDetail(recipe.id);
      return;
    }

    const recipe = {
      id: generateRecipeId(title),
      title, category,
      icon: CATEGORY_ICON[category],
      desc, time, servings, difficulty, note,
      ingredients, steps, nutrition, allergens, utensils
    };

    customRecipes.push(recipe);
    ALL_RECIPES.push(recipe);
    saveCustomRecipes();

    if (photoFile) await savePhoto(recipe.id, photoFile);
    for (let i = 0; i < stepPhotoFiles.length; i++) {
      if (stepPhotoFiles[i]) await saveStepPhoto(recipe.id, i, stepPhotoFiles[i]);
    }

    closeAddForm();
    showToast("Recette ajoutée");

    chips.forEach(c => c.classList.remove("is-active"));
    document.querySelector('.chip[data-filter="tout"]').classList.add("is-active");
    state.filter = "tout";
    state.query = "";
    searchInput.value = "";
    render();
  });
}

function openAddForm(editingRecipe){
  renderAddForm(editingRecipe);
  addView.classList.add("is-open");
  addView.setAttribute("aria-hidden", "false");
  addScroll.scrollTop = 0;
  syncBodyScrollLock();
}

function closeAddForm(){
  addView.classList.remove("is-open");
  addView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
}

/* ---- vue panier (liste de courses plein écran) ---- */
function renderPanier(){
  const merged = mergeIngredientsForShopping();
  const mergedKeys = new Set(merged.map(m => m.key));
  [...checkedItems].forEach(k => { if (!mergedKeys.has(k)) checkedItems.delete(k); });
  saveCheckedItems();

  const body = cart.length === 0
    ? `<p class="empty-state">Votre panier est vide. Ouvrez une recette et cliquez sur "Ajouter au panier".</p>`
    : `
      ${cart.map(entry => `
        <div class="recipe-section cat-${entry.category}">
          <div class="recipe-section-head">
            <span class="tag">${entry.title} · ${entry.servings} pers.</span>
            <button class="remove-btn" type="button" data-removeid="${escapeAttr(entry.recipeId)}">Retirer</button>
          </div>
          <div class="ing-lines">
            ${entry.ingredients.map(([name, qty]) => `<div class="ing-line"><span>${name}</span><span>${qty}</span></div>`).join("")}
          </div>
        </div>
      `).join("")}
      <h3 class="acheter-title"><span class="dot"></span> À acheter</h3>
      <div class="check-list">
        ${merged.map(m => `
          <label class="check-line ${checkedItems.has(m.key) ? "done" : ""}">
            <span class="checkbox ${checkedItems.has(m.key) ? "checked" : ""}" data-key="${escapeAttr(m.key)}">${checkedItems.has(m.key) ? "✓" : ""}</span>
            ${m.name} — ${m.qty}
          </label>
        `).join("")}
      </div>
      <button class="clear-btn" id="clearCartBtn" type="button">Vider le panier</button>
    `;

  panierScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="panierMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="back-btn" id="panierBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
      </div>
      <h2>Panier de courses</h2>
    </div>
    <div class="panier-body">${body}</div>
  `;

  panierScroll.querySelector("#panierBackBtn").addEventListener("click", closePanier);
  panierScroll.querySelector("#panierMenuBtn").addEventListener("click", openDrawer);
  panierScroll.querySelectorAll("[data-removeid]").forEach(btn => {
    btn.addEventListener("click", () => removeRecipeFromCart(btn.dataset.removeid));
  });
  panierScroll.querySelectorAll(".checkbox[data-key]").forEach(box => {
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const key = box.dataset.key;
      if (checkedItems.has(key)) checkedItems.delete(key); else checkedItems.add(key);
      saveCheckedItems();
      renderPanier();
    });
  });
  const clearBtn = panierScroll.querySelector("#clearCartBtn");
  if (clearBtn) clearBtn.addEventListener("click", clearCart);
}

function openPanier(){
  renderPanier();
  panierView.classList.add("is-open");
  panierView.setAttribute("aria-hidden", "false");
  panierScroll.scrollTop = 0;
  syncBodyScrollLock();
}

function closePanier(){
  panierView.classList.remove("is-open");
  panierView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
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

/* ---- démarrage ---- */
renderHero();
render();
updateCartBadge();
