import { supabase } from "./supabase-client.js";
import { enqueue, registerHandler } from "./write-queue.js";

/* ---- semaine : calculs de dates (fonctions pures, aucune dépendance à Supabase) ---- */
export const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function getWeekStart(date){
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, ..., 6 = samedi
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function weekDates(weekStart){
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function formatDateKey(date){
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatWeekLabel(weekStart){
  return `Semaine du ${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}`;
}

/* ---- chargement/sauvegarde d'une semaine (Supabase + file d'attente hors ligne) ---- */
let weekPlan = new Map(); // clé `${dateKey}:${slot}` -> recipeId

async function currentUserId(){
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

async function mealPlanWriteHandler(payload){
  if (payload.action === "clear") {
    const { error } = await supabase.from("meal_plan").delete()
      .eq("user_id", payload.userId).eq("date", payload.date).eq("slot", payload.slot);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("meal_plan").upsert({
      user_id: payload.userId, date: payload.date, slot: payload.slot,
      recipe_id: payload.recipeId, updated_at: new Date().toISOString()
    }, { onConflict: "user_id,date,slot" });
    if (error) throw error;
  }
}
registerHandler("meal_plan", mealPlanWriteHandler);

export async function loadWeekPlan(weekStart){
  weekPlan = new Map();
  const userId = await currentUserId();
  if (!userId) return;
  const dates = weekDates(weekStart).map(formatDateKey);
  try {
    const { data, error } = await supabase.from("meal_plan")
      .select("date, slot, recipe_id")
      .eq("user_id", userId)
      .gte("date", dates[0])
      .lte("date", dates[6]);
    if (error) throw error;
    (data || []).forEach(row => weekPlan.set(`${row.date}:${row.slot}`, row.recipe_id));
  } catch {
    /* hors ligne ou erreur réseau : la semaine s'affiche vide plutôt que de bloquer l'ouverture de la vue */
  }
}

export function getSlotRecipeId(dateKey, slot){
  return weekPlan.get(`${dateKey}:${slot}`) || null;
}

export async function setSlot(dateKey, slot, recipeId){
  weekPlan.set(`${dateKey}:${slot}`, recipeId);
  const userId = await currentUserId();
  if (!userId) return;
  const payload = { action: "set", userId, date: dateKey, slot, recipeId };
  mealPlanWriteHandler(payload).catch(() => enqueue("meal_plan", `${dateKey}:${slot}`, payload));
}

export async function clearSlot(dateKey, slot){
  weekPlan.delete(`${dateKey}:${slot}`);
  const userId = await currentUserId();
  if (!userId) return;
  const payload = { action: "clear", userId, date: dateKey, slot };
  mealPlanWriteHandler(payload).catch(() => enqueue("meal_plan", `${dateKey}:${slot}`, payload));
}
