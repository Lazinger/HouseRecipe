import { supabase } from "./supabase-client.js";
import { loadCachedRecipes, pullRecipes, cacheRecipe, uncacheRecipe, recipeToRow } from "./sync.js";
import { state, detailView } from "./dom.js";
import { showToast } from "./ui.js";
import { render, renderHero } from "./grid.js";
import { syncDetailFavButton } from "./detail.js";

/* ---- recettes (partagées, synchronisées avec Supabase) ---- */
export const ALL_RECIPES = [];

export async function initRecipesSync(){
  try {
    const cached = await loadCachedRecipes();
    ALL_RECIPES.splice(0, ALL_RECIPES.length, ...cached);
  } catch {}
  if (ALL_RECIPES.length) { renderHero(); render(); }

  try {
    const fresh = await pullRecipes();
    ALL_RECIPES.splice(0, ALL_RECIPES.length, ...fresh);
  } catch {
    return;
  }
  renderHero();
  render();
}

export async function saveRecipe(recipe){
  const row = recipeToRow(recipe);
  const { error } = await supabase.from("recipes").upsert(row);
  if (error) throw error;
  const idx = ALL_RECIPES.findIndex(r => r.id === recipe.id);
  if (idx >= 0) ALL_RECIPES[idx] = recipe; else ALL_RECIPES.push(recipe);
  await cacheRecipe(recipe);
}

export async function deleteRecipeRemote(id){
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
  const idx = ALL_RECIPES.findIndex(r => r.id === id);
  if (idx >= 0) ALL_RECIPES.splice(idx, 1);
  await uncacheRecipe(id);
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

/* ---- persistance des favoris (Supabase, avec cache localStorage) ---- */
export function saveFavorites(){
  localStorage.setItem("carnet-favoris", JSON.stringify([...state.favorites]));
}

async function currentUserId(){
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

function syncFavoriteRemote(id, isFavorite){
  currentUserId().then(userId => {
    if (!userId) return;
    const query = isFavorite
      ? supabase.from("favorites").insert({ user_id: userId, recipe_id: id })
      : supabase.from("favorites").delete().eq("user_id", userId).eq("recipe_id", id);
    query.then(() => {}).catch(() => {});
  }).catch(() => {});
}

export function toggleFavorite(id){
  let isFavorite;
  if (state.favorites.has(id)) { state.favorites.delete(id); isFavorite = false; showToast("Retiré des favoris"); }
  else { state.favorites.add(id); isFavorite = true; showToast("Ajouté aux favoris"); }
  saveFavorites();
  syncFavoriteRemote(id, isFavorite);
  render();
  if (!detailView.hidden && detailView.classList.contains("is-open")) {
    syncDetailFavButton(id);
  }
}

export async function initFavoritesSync(){
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const { data, error } = await supabase.from("favorites").select("recipe_id").eq("user_id", userId);
    if (error) throw error;
    state.favorites = new Set(data.map(r => r.recipe_id));
    saveFavorites();
    render();
  } catch {
    /* hors-ligne ou erreur réseau : on garde les favoris déjà en cache localStorage */
  }
}
