import { ING_ICON } from "./icons.js";
import { state, detailView, detailScroll } from "./dom.js";
import { ALL_RECIPES, toggleFavorite, saveFavorites, deleteRecipeRemote } from "./recipes-store.js";
import { cart, addRecipeToCart, removeRecipeFromCart, openPanier } from "./cart.js";
import { scaleQuantity } from "./quantity.js";
import { applyDetailPhoto, getStepPhoto, deleteAllPhotosForRecipe } from "./photos.js";
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
import { renderTimerPanel } from "./timer.js";
import { render } from "./grid.js";
import { openAddForm } from "./add-form.js";

/* ---- vue détail ---- */
function ingredientRowHtml(name, qty){
  return `<li><span class="ing-icon">${ING_ICON}</span><span class="ing-text"><span class="ing-name">${name}</span><span class="ing-qty">${qty}</span></span></li>`;
}

export let currentOpenRecipe = null;

export function openDetail(id){
  const r = ALL_RECIPES.find(x => x.id === id);
  if (!r) return;
  const isFav = state.favorites.has(r.id);

  detailView.className = `detail-view hf-theme cat-${r.category}`;

  detailScroll.innerHTML = `
    <div class="detail-hero" id="detailHero">
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          <button class="detail-fav is-menu" id="detailMenuBtn" type="button" aria-label="Ouvrir le menu">
            <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="detail-topbar-actions">
          <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
          <button class="detail-fav" id="detailDeleteBtn" type="button" aria-label="Supprimer la recette">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
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

  detailScroll.querySelector("#detailFavBtn").addEventListener("click", () => toggleFavorite(r.id));
  detailScroll.querySelector("#detailCartBtn").addEventListener("click", openPanier);
  detailScroll.querySelector("#detailMenuBtn").addEventListener("click", openDrawer);
  detailScroll.querySelector("#detailEditBtn").addEventListener("click", () => goToEditRecipe(r));
  detailScroll.querySelector("#detailDeleteBtn").addEventListener("click", () => deleteRecipe(r.id));

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
  openSheetBackdrop();
}

export function syncDetailFavButton(id){
  const btn = detailScroll.querySelector("#detailFavBtn");
  if (!btn) return;
  const isFav = state.favorites.has(id);
  btn.setAttribute("aria-pressed", isFav);
  btn.querySelector("path").setAttribute("fill", isFav ? "currentColor" : "none");
}

export function closeDetail(){
  if (!detailView.classList.contains("is-open")) return;
  detailView.classList.remove("is-open");
  detailView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}

function goToEditRecipe(recipe){
  closeDetail();
  openAddForm(recipe);
}

async function deleteRecipe(id){
  if (!confirm("Supprimer définitivement cette recette ?")) return;
  await deleteRecipeRemote(id);
  state.favorites.delete(id);
  saveFavorites();
  removeRecipeFromCart(id);
  deleteAllPhotosForRecipe(id).catch(() => {});
  closeDetail();
  render();
  showToast("Recette supprimée");
}
