import { RECIPES } from "./recipes-data.js";
import { state, detailView } from "./dom.js";
import { showToast } from "./ui.js";
import { render } from "./grid.js";
import { syncDetailFavButton } from "./detail.js";

/* ---- recettes ajoutées par l'utilisateur (persistées) ---- */
const CUSTOM_RECIPES_KEY = "carnet-recettes-perso";

function loadCustomRecipes(){
  try { return JSON.parse(localStorage.getItem(CUSTOM_RECIPES_KEY) || "[]"); }
  catch { return []; }
}
export function saveCustomRecipes(){
  localStorage.setItem(CUSTOM_RECIPES_KEY, JSON.stringify(customRecipes));
}

export const customRecipes = loadCustomRecipes();
export const ALL_RECIPES = [...RECIPES, ...customRecipes];

/* ---- export / import : sauvegarde JSON des recettes ajoutées + favoris ---- */
export function exportRecipes(){
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
export function importRecipesFromFile(file){
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
export function generateRecipeId(title){
  const base = slugify(title) || "recette";
  let id = base, n = 2;
  while (ALL_RECIPES.some(r => r.id === id)) { id = `${base}-${n}`; n++; }
  return id;
}

/* ---- persistance des favoris ---- */
export function saveFavorites(){
  localStorage.setItem("carnet-favoris", JSON.stringify([...state.favorites]));
}
export function toggleFavorite(id){
  if (state.favorites.has(id)) { state.favorites.delete(id); showToast("Retiré des favoris"); }
  else { state.favorites.add(id); showToast("Ajouté aux favoris"); }
  saveFavorites();
  render();
  if (!detailView.hidden && detailView.classList.contains("is-open")) {
    syncDetailFavButton(id);
  }
}
