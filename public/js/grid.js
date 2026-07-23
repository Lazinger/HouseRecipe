import { CATEGORY_LABELS, ALLERGENS } from "./recipes-data.js";
import { ICONS } from "./icons.js";
import { heroSlot, grid, emptyState, resultTitle, resultCount, state, allergenFilterBadge, allergenFilterList } from "./dom.js";
import { ALL_RECIPES, toggleFavorite } from "./recipes-store.js";
import { applyCardPhoto } from "./photos.js";
import { openDetail } from "./detail.js";

/* ---- rendu du héros (recette mise en avant, tirage stable sur la journée) ---- */
function pickDailyFeatured(){
  if (!ALL_RECIPES.length) return null;
  const dayIndex = Math.floor(Date.now() / 86400000);
  return ALL_RECIPES[dayIndex % ALL_RECIPES.length];
}

export function renderHero(){
  const featured = pickDailyFeatured();
  if (!featured) { heroSlot.innerHTML = ""; return; }
  heroSlot.innerHTML = `
    <button class="hero-card cat-${featured.category}" data-id="${featured.id}" type="button">
      <div class="hero-copy">
        <span class="hero-eyebrow">La recette du jour</span>
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
  applyCardPhoto(featured.id, heroSlot.querySelector(".hero-art"));
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
    if (state.excludedAllergens.size && r.allergens?.some(a => state.excludedAllergens.has(a))) return false;
    if (!q) return true;
    const haystack = (r.title + " " + r.desc + " " + r.ingredients.map(i => i[0]).join(" ")).toLowerCase();
    return haystack.includes(q);
  });
}

/* ---- panneau de filtre par allergène ---- */
function updateAllergenFilterBadge(){
  const count = state.excludedAllergens.size;
  allergenFilterBadge.textContent = count;
  allergenFilterBadge.hidden = count === 0;
}

export function renderAllergenFilterPanel(){
  allergenFilterList.innerHTML = ALLERGENS.map(a => `
    <label class="allergen-filter-item">
      <input type="checkbox" value="${a.key}" ${state.excludedAllergens.has(a.key) ? "checked" : ""}>
      ${a.label}
    </label>
  `).join("");
  allergenFilterList.querySelectorAll("input").forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) state.excludedAllergens.add(cb.value);
      else state.excludedAllergens.delete(cb.value);
      localStorage.setItem("carnet-allergenes-exclus", JSON.stringify([...state.excludedAllergens]));
      updateAllergenFilterBadge();
      render();
    });
  });
  updateAllergenFilterBadge();
}

/* ---- rendu de la grille ---- */
function renderGrid(){
  const list = getFilteredRecipes();
  heroSlot.hidden = state.query.trim() !== "";
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
      <div class="card-photo">
        <span class="card-icon">${ICONS[r.icon]}</span>
        <button class="card-fav" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris" data-favid="${r.id}">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="card-body">
        <span class="card-cat">${r.category}</span>
        <h3 class="card-title">${r.title}</h3>
        <p class="card-desc">${r.desc}</p>
        <div class="card-meta">
          <span>⏱ ${r.time} min</span>
          <span>${r.servings} pers.</span>
          <span>${r.difficulty}</span>
        </div>
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

export function render(){
  renderGrid();
}
