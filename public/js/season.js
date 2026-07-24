import { seasonView, seasonScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, goToSeasonalRecipes } from "./ui.js";
import { ALL_RECIPES } from "./recipes-store.js";
import { SEASONAL_PRODUCE, seasonalProduceForMonth, produceMatchesRecipe } from "./season-data.js";
import { MONTH_NAMES } from "./meal-plan.js";

/* ---- vue plein écran : liste des fruits/légumes du mois affiché ---- */
let currentMonth = new Date().getMonth() + 1; // 1=janvier..12=décembre

function produceWithCounts(month){
  return seasonalProduceForMonth(month).map(p => ({
    ...p,
    count: ALL_RECIPES.filter(r => produceMatchesRecipe(p, r)).length
  }));
}

function renderSeason(){
  const list = produceWithCounts(currentMonth);

  seasonScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="seasonMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Saison</h2>
    </div>
    <div class="season-body">
      <div class="month-nav">
        <button id="monthPrevBtn" type="button" aria-label="Mois précédent">‹</button>
        <span id="monthLabel">${MONTH_NAMES[currentMonth - 1]}</span>
        <button id="monthNextBtn" type="button" aria-label="Mois suivant">›</button>
      </div>
      <div class="season-list">
        ${list.map(p => `
          <button type="button" class="season-item" data-id="${p.id}">
            <span class="season-item-label">${p.label}</span>
            <span class="season-item-count">${p.count}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  seasonScroll.querySelector("#seasonMenuBtn").addEventListener("click", openDrawer);
  seasonScroll.querySelector("#monthPrevBtn").addEventListener("click", () => changeMonth(-1));
  seasonScroll.querySelector("#monthNextBtn").addEventListener("click", () => changeMonth(1));
  seasonScroll.querySelectorAll(".season-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const produce = SEASONAL_PRODUCE.find(p => p.id === btn.dataset.id);
      goToSeasonalRecipes(produce);
    });
  });
}

function changeMonth(offset){
  currentMonth = ((currentMonth - 1 + offset + 12) % 12) + 1;
  renderSeason();
}

/* ---- ouverture/fermeture de la vue ---- */
export function openSeason(){
  currentMonth = new Date().getMonth() + 1;
  renderSeason();
  seasonView.classList.add("is-open");
  seasonView.setAttribute("aria-hidden", "false");
  seasonScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeSeason(){
  if (!seasonView.classList.contains("is-open")) return;
  seasonView.classList.remove("is-open");
  seasonView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
