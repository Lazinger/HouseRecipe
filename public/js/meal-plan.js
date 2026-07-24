import { supabase } from "./supabase-client.js";
import { enqueue, registerHandler } from "./write-queue.js";
import { mealPlanView, mealPlanScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry } from "./ui.js";
import { ALL_RECIPES } from "./recipes-store.js";
import { openDetail } from "./detail.js";
import { addRecipesToCartBatch } from "./cart.js";

/* ---- semaine : calculs de dates (fonctions pures, aucune dépendance à Supabase) ---- */
export const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

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

/* ---- vue plein écran : rendu du calendrier ---- */
let currentWeekStart = getWeekStart(new Date());
let pickerContext = null; // { dateKey, slot } pendant qu'un sélecteur de recette est ouvert, sinon null

function slotHtml(dateKey, slot, label){
  const recipeId = getSlotRecipeId(dateKey, slot);
  const recipe = recipeId ? ALL_RECIPES.find(r => r.id === recipeId) : null;
  if (!recipe) {
    return `
      <div class="meal-plan-slot">
        <span class="meal-plan-slot-label">${label}</span>
        <button class="slot-add" type="button" data-date="${dateKey}" data-slot="${slot}">+ Ajouter</button>
      </div>
    `;
  }
  return `
    <div class="meal-plan-slot is-filled">
      <span class="meal-plan-slot-label">${label}</span>
      <button class="slot-recipe" type="button" data-date="${dateKey}" data-slot="${slot}" data-recipeid="${recipe.id}">${recipe.title}</button>
      <button class="slot-remove" type="button" data-date="${dateKey}" data-slot="${slot}" aria-label="Retirer">✕</button>
    </div>
  `;
}

function weekHasAnyFilledSlot(dates){
  return dates.some(d => {
    const dateKey = formatDateKey(d);
    return getSlotRecipeId(dateKey, "midi") || getSlotRecipeId(dateKey, "soir");
  });
}

async function loadAndRenderMealPlan(){
  await loadWeekPlan(currentWeekStart);
  renderMealPlan();
}

function renderMealPlan(){
  const dates = weekDates(currentWeekStart);

  mealPlanScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="mealPlanMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Planning</h2>
    </div>
    <div class="meal-plan-body">
      <div class="week-nav">
        <button id="weekPrevBtn" type="button" aria-label="Semaine précédente">‹</button>
        <span id="weekLabel">${formatWeekLabel(currentWeekStart)}</span>
        <button id="weekNextBtn" type="button" aria-label="Semaine suivante">›</button>
      </div>
      <button id="weekTodayBtn" class="btn-secondary" type="button">Aujourd'hui</button>
      <div class="meal-plan-days">
        ${dates.map(d => {
          const dateKey = formatDateKey(d);
          const dayName = DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1];
          return `
            <div class="meal-plan-day">
              <h3 class="meal-plan-day-title">${dayName} ${d.getDate()}</h3>
              <div class="meal-plan-slots">
                ${slotHtml(dateKey, "midi", "Midi")}
                ${slotHtml(dateKey, "soir", "Soir")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
      <button id="addWeekToCartBtn" class="btn-primary" type="button" ${weekHasAnyFilledSlot(dates) ? "" : "disabled"}>Ajouter la semaine au panier</button>
    </div>
  `;

  mealPlanScroll.querySelector("#mealPlanMenuBtn").addEventListener("click", openDrawer);
  mealPlanScroll.querySelector("#weekPrevBtn").addEventListener("click", () => changeWeek(-7));
  mealPlanScroll.querySelector("#weekNextBtn").addEventListener("click", () => changeWeek(7));
  mealPlanScroll.querySelector("#weekTodayBtn").addEventListener("click", () => {
    currentWeekStart = getWeekStart(new Date());
    loadAndRenderMealPlan();
  });

  mealPlanScroll.querySelectorAll(".slot-add").forEach(btn => {
    btn.addEventListener("click", () => openRecipePicker(btn.dataset.date, btn.dataset.slot));
  });
  mealPlanScroll.querySelectorAll(".slot-remove").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await clearSlot(btn.dataset.date, btn.dataset.slot);
      renderMealPlan();
    });
  });
  mealPlanScroll.querySelectorAll(".slot-recipe").forEach(btn => {
    btn.addEventListener("click", () => {
      const recipeId = btn.dataset.recipeid;
      closeMealPlan();
      openDetail(recipeId);
    });
  });

  const addWeekBtn = mealPlanScroll.querySelector("#addWeekToCartBtn");
  addWeekBtn.addEventListener("click", () => {
    const recipeIds = new Set();
    dates.forEach(d => {
      const dateKey = formatDateKey(d);
      ["midi", "soir"].forEach(slot => {
        const recipeId = getSlotRecipeId(dateKey, slot);
        if (recipeId) recipeIds.add(recipeId);
      });
    });
    const recipes = ALL_RECIPES.filter(r => recipeIds.has(r.id));
    if (!recipes.length) return;
    addRecipesToCartBatch(recipes);
  });
}

function changeWeek(offsetDays){
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() + offsetDays);
  currentWeekStart = getWeekStart(d);
  loadAndRenderMealPlan();
}

/* ---- sélecteur de recette (assignation d'un créneau vide) ---- */
function renderRecipePickerList(query){
  const q = query.trim().toLowerCase();
  const list = ALL_RECIPES.filter(r => !q || r.title.toLowerCase().includes(q));
  const listEl = mealPlanScroll.querySelector("#recipePickerList");
  listEl.innerHTML = list.length
    ? list.map(r => `<button class="recipe-picker-item" type="button" data-recipeid="${r.id}">${r.title}</button>`).join("")
    : `<p class="empty-state">Aucune recette trouvée.</p>`;
  listEl.querySelectorAll(".recipe-picker-item").forEach(btn => {
    btn.addEventListener("click", async () => {
      await setSlot(pickerContext.dateKey, pickerContext.slot, btn.dataset.recipeid);
      closeRecipePicker();
      renderMealPlan();
    });
  });
}

function openRecipePicker(dateKey, slot){
  pickerContext = { dateKey, slot };
  mealPlanScroll.insertAdjacentHTML("beforeend", `
    <div class="recipe-picker-backdrop" id="recipePickerBackdrop"></div>
    <div class="recipe-picker" id="recipePicker">
      <div class="recipe-picker-head">
        <input type="text" id="recipePickerSearch" placeholder="Chercher une recette…" autocomplete="off">
        <button class="detail-close" id="recipePickerCloseBtn" type="button" aria-label="Fermer">✕</button>
      </div>
      <div class="recipe-picker-list" id="recipePickerList"></div>
    </div>
  `);
  renderRecipePickerList("");
  mealPlanScroll.querySelector("#recipePickerSearch").addEventListener("input", (e) => renderRecipePickerList(e.target.value));
  mealPlanScroll.querySelector("#recipePickerCloseBtn").addEventListener("click", closeRecipePicker);
  mealPlanScroll.querySelector("#recipePickerBackdrop").addEventListener("click", closeRecipePicker);
  mealPlanScroll.querySelector("#recipePickerSearch").focus();
}

function closeRecipePicker(){
  pickerContext = null;
  mealPlanScroll.querySelector("#recipePicker")?.remove();
  mealPlanScroll.querySelector("#recipePickerBackdrop")?.remove();
}

/* ---- ouverture/fermeture de la vue ---- */
export async function openMealPlan(){
  currentWeekStart = getWeekStart(new Date());
  await loadAndRenderMealPlan();
  mealPlanView.classList.add("is-open");
  mealPlanView.setAttribute("aria-hidden", "false");
  mealPlanScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeMealPlan(){
  if (!mealPlanView.classList.contains("is-open")) return;
  mealPlanView.classList.remove("is-open");
  mealPlanView.setAttribute("aria-hidden", "true");
  closeRecipePicker();
  syncBodyScrollLock();
  closeSheetBackdrop();
}
