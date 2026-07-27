import { supabase } from "../auth/supabase-client.js";

const DB_NAME = "carnet-sync";
const DB_VERSION = 2;
const RECIPES_STORE = "recipes";
export const QUEUE_STORE = "write-queue";
const LAST_SYNC_KEY = "carnet-recipes-last-sync";

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

/* ---- synchro par delta : ne retransfere que les lignes modifiees depuis le
   dernier sync (via updated_at), plutot que toute la table a chaque demarrage.
   La detection des suppressions a besoin d'un select id/updated_at complet
   (leger, sans les gros champs jsonb ingredients/steps) pour savoir quelles
   recettes ne sont plus cote serveur et doivent etre purgees du cache local. ---- */
export async function pullRecipes(){
  const lastSync = localStorage.getItem(LAST_SYNC_KEY);

  const { data: idRows, error: idsError } = await supabase.from("recipes").select("id, updated_at");
  if (idsError) throw idsError;
  const currentIds = new Set(idRows.map(r => r.id));
  const maxUpdatedAt = idRows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), "");

  let changedQuery = supabase.from("recipes").select("*");
  if (lastSync) changedQuery = changedQuery.gt("updated_at", lastSync);
  const { data: changed, error } = await changedQuery;
  if (error) throw error;

  const db = await openSyncDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(RECIPES_STORE, "readwrite");
    const store = tx.objectStore(RECIPES_STORE);
    changed.forEach(row => store.put(row));
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      if (!currentIds.has(cursor.value.id)) store.delete(cursor.primaryKey);
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  if (maxUpdatedAt) localStorage.setItem(LAST_SYNC_KEY, maxUpdatedAt);

  const recipes = await loadCachedRecipes();
  recipes.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  return recipes;
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
