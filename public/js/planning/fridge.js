import { supabase, currentUserId } from "../auth/supabase-client.js";
import { enqueue, registerHandler } from "../core/write-queue.js";
import { mergeQuantityParts } from "../recipes/quantity.js";

/* ---- frigo personnel (persisté, une ligne par ingrédient et par compte) ---- */
const FRIDGE_KEY = "carnet-frigo";

function loadFridgeLocal(){
  try { return JSON.parse(localStorage.getItem(FRIDGE_KEY) || "[]"); }
  catch { return []; }
}
function saveFridgeLocal(){
  localStorage.setItem(FRIDGE_KEY, JSON.stringify(fridgeItems));
}

export const fridgeItems = loadFridgeLocal(); // Array<[name, qty]>

async function fridgeWriteHandler(payload){
  const userId = await currentUserId();
  if (!userId) return;
  if (payload.op === "delete") {
    const { error } = await supabase.from("fridge_items").delete().eq("user_id", userId).eq("name", payload.name);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("fridge_items").upsert({
      user_id: userId, name: payload.name, qty: payload.qty, updated_at: new Date().toISOString()
    }, { onConflict: "user_id,name" });
    if (error) throw error;
  }
}
registerHandler("fridge", fridgeWriteHandler);

export async function initFridgeSync(){
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const { data, error } = await supabase.from("fridge_items").select("name, qty").eq("user_id", userId);
    if (error) throw error;
    if ((data || []).length > 0) {
      fridgeItems.splice(0, fridgeItems.length, ...data.map(row => [row.name, row.qty]));
      saveFridgeLocal();
    } else if (fridgeItems.length > 0) {
      fridgeItems.forEach(([name, qty]) => {
        const payload = { op: "upsert", name, qty };
        fridgeWriteHandler(payload).catch(() => enqueue("fridge", name.trim().toLowerCase(), payload));
      });
    }
  } catch {
    /* hors-ligne ou erreur réseau : on garde le frigo déjà en cache localStorage */
  }
}

function findFridgeIndex(name){
  const key = name.trim().toLowerCase();
  return fridgeItems.findIndex(([n]) => n.trim().toLowerCase() === key);
}

export function saveFridgeItem(name, qty){
  const idx = findFridgeIndex(name);
  if (idx >= 0) fridgeItems[idx] = [name, qty]; else fridgeItems.push([name, qty]);
  saveFridgeLocal();
  const payload = { op: "upsert", name, qty };
  fridgeWriteHandler(payload).catch(() => enqueue("fridge", name.trim().toLowerCase(), payload));
}

export function removeFridgeItem(name){
  const idx = findFridgeIndex(name);
  if (idx >= 0) fridgeItems.splice(idx, 1);
  saveFridgeLocal();
  const payload = { op: "delete", name };
  fridgeWriteHandler(payload).catch(() => enqueue("fridge", name.trim().toLowerCase(), payload));
}

/* ---- reapprovisionnement au clic sur "Valide" dans le panier : items est
   la liste "a acheter" telle qu'affichee ([{name, qty}]), s'additionne a
   ce qui existe deja pour chaque ingredient (meme regle de fusion que le
   panier). ---- */
export function incrementFridgeItems(items){
  items.forEach(({ name, qty }) => {
    const idx = findFridgeIndex(name);
    if (idx >= 0) {
      const [existingName, existingQty] = fridgeItems[idx];
      saveFridgeItem(existingName, mergeQuantityParts([existingQty, qty]));
    } else {
      saveFridgeItem(name, qty);
    }
  });
}