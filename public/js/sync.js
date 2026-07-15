import { supabase } from "./supabase-client.js";

const DB_NAME = "carnet-sync";
const DB_VERSION = 2;
const RECIPES_STORE = "recipes";
export const QUEUE_STORE = "write-queue";

export function openSyncDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECIPES_STORE)) {
        db.createObjectStore(RECIPES_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function rowToRecipe(row){
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    icon: row.icon,
    desc: row.description,
    time: row.time,
    servings: row.servings,
    difficulty: row.difficulty,
    note: row.note,
    ingredients: row.ingredients,
    steps: row.steps,
    nutrition: row.nutrition || undefined,
    allergens: row.allergens || undefined,
    utensils: row.utensils || undefined
  };
}

export function recipeToRow(recipe){
  return {
    id: recipe.id,
    title: recipe.title,
    category: recipe.category,
    icon: recipe.icon,
    description: recipe.desc || "",
    time: recipe.time,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    note: recipe.note || "",
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    nutrition: recipe.nutrition ?? null,
    allergens: recipe.allergens ?? null,
    utensils: recipe.utensils ?? null,
    updated_at: new Date().toISOString()
  };
}

export async function loadCachedRecipes(){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readonly");
    const req = tx.objectStore(RECIPES_STORE).getAll();
    req.onsuccess = () => resolve(req.result.map(rowToRecipe));
    req.onerror = () => reject(req.error);
  });
}

export async function pullRecipes(){
  const { data, error } = await supabase.from("recipes").select("*").order("title");
  if (error) throw error;
  const db = await openSyncDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readwrite");
    const store = tx.objectStore(RECIPES_STORE);
    store.clear();
    data.forEach(row => store.put(row));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return data.map(rowToRecipe);
}

export async function cacheRecipe(recipe){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readwrite");
    tx.objectStore(RECIPES_STORE).put(recipeToRow(recipe));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function uncacheRecipe(id){
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readwrite");
    tx.objectStore(RECIPES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
