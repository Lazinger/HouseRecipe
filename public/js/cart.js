import { supabase } from "./supabase-client.js";
import { parseQuantity, formatScaledNumber } from "./quantity.js";
import { cartBadge, panierView, panierScroll } from "./dom.js";
import { escapeAttr } from "./utils.js";
import { showToast, openDrawer, syncBodyScrollLock } from "./ui.js";
import { enqueue, registerHandler } from "./write-queue.js";

/* ---- panier de courses (persisté) ---- */
const CART_KEY = "carnet-panier";
const CART_CHECKED_KEY = "carnet-panier-coche";

function loadCart(){
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}
function saveCart(){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
function loadCheckedItems(){
  try { return new Set(JSON.parse(localStorage.getItem(CART_CHECKED_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveCheckedItems(){
  localStorage.setItem(CART_CHECKED_KEY, JSON.stringify([...checkedItems]));
}

export const cart = loadCart();
const checkedItems = loadCheckedItems();

async function currentUserId(){
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

async function cartWriteHandler({ items, checked }){
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from("cart_state").upsert({
    user_id: userId,
    items,
    checked,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });
  if (error) throw error;
}
registerHandler("cart", cartWriteHandler);

function syncCartRemote(){
  const payload = { items: [...cart], checked: [...checkedItems] };
  cartWriteHandler(payload).catch(() => enqueue("cart", "main", payload));
}

export async function initCartSync(){
  try {
    const userId = await currentUserId();
    if (!userId) return;
    const { data, error } = await supabase.from("cart_state").select("items, checked").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (data) {
      cart.splice(0, cart.length, ...(data.items || []));
      checkedItems.clear();
      (data.checked || []).forEach(k => checkedItems.add(k));
      saveCart();
      saveCheckedItems();
      updateCartBadge();
    } else if (cart.length > 0) {
      syncCartRemote();
    }
  } catch {
    /* hors-ligne ou erreur réseau : on garde le panier déjà en cache localStorage */
  }
}

function mergeQuantityParts(parts){
  const parsed = parts.map(parseQuantity);
  if (parsed.every(Boolean)) {
    const unit = parsed[0].unit.toLowerCase();
    if (parsed.every(p => p.unit.toLowerCase() === unit)) {
      const sum = parsed.reduce((acc, p) => acc + p.value, 0);
      const formatted = formatScaledNumber(sum);
      return parsed[0].unit ? `${formatted} ${parsed[0].unit}` : formatted;
    }
  }
  return [...new Set(parts.map(p => p.trim()))].join(" + ");
}

function mergeIngredientsForShopping(){
  const groups = new Map();
  cart.forEach(entry => {
    entry.ingredients.forEach(([name, qty]) => {
      const key = name.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, { key, name: name.trim(), parts: [] });
      groups.get(key).parts.push(qty);
    });
  });
  return [...groups.values()].map(g => ({ key: g.key, name: g.name, qty: mergeQuantityParts(g.parts) }));
}

export function addRecipeToCart(recipe, servings, ingredients){
  const idx = cart.findIndex(e => e.recipeId === recipe.id);
  const entry = { recipeId: recipe.id, title: recipe.title, category: recipe.category, servings, ingredients };
  if (idx >= 0) cart[idx] = entry; else cart.push(entry);
  saveCart();
  updateCartBadge();
  syncCartRemote();
}

export function removeRecipeFromCart(recipeId){
  const idx = cart.findIndex(e => e.recipeId === recipeId);
  if (idx >= 0) cart.splice(idx, 1);
  saveCart();
  updateCartBadge();
  syncCartRemote();
  renderPanier();
}

function clearCart(){
  cart.length = 0;
  checkedItems.clear();
  saveCart();
  saveCheckedItems();
  updateCartBadge();
  syncCartRemote();
  renderPanier();
  showToast("Panier vidé");
}

export function updateCartBadge(){
  cartBadge.textContent = cart.length;
  cartBadge.hidden = cart.length === 0;
  const detailCartBadge = document.getElementById("detailCartBadge");
  if (detailCartBadge) {
    detailCartBadge.textContent = cart.length;
    detailCartBadge.hidden = cart.length === 0;
  }
}

/* ---- vue panier (liste de courses plein écran) ---- */
function renderPanier(){
  const merged = mergeIngredientsForShopping();
  const mergedKeys = new Set(merged.map(m => m.key));
  [...checkedItems].forEach(k => { if (!mergedKeys.has(k)) checkedItems.delete(k); });
  saveCheckedItems();

  const body = cart.length === 0
    ? `<p class="empty-state">Votre panier est vide. Ouvrez une recette et cliquez sur "Ajouter au panier".</p>`
    : `
      ${cart.map(entry => `
        <div class="recipe-section cat-${entry.category}">
          <div class="recipe-section-head">
            <span class="tag">${entry.title} · ${entry.servings} pers.</span>
            <button class="remove-btn" type="button" data-removeid="${escapeAttr(entry.recipeId)}">Retirer</button>
          </div>
          <div class="ing-lines">
            ${entry.ingredients.map(([name, qty]) => `<div class="ing-line"><span>${name}</span><span>${qty}</span></div>`).join("")}
          </div>
        </div>
      `).join("")}
      <h3 class="acheter-title"><span class="dot"></span> À acheter</h3>
      <div class="check-list">
        ${merged.map(m => `
          <label class="check-line ${checkedItems.has(m.key) ? "done" : ""}">
            <span class="checkbox ${checkedItems.has(m.key) ? "checked" : ""}" data-key="${escapeAttr(m.key)}">${checkedItems.has(m.key) ? "✓" : ""}</span>
            ${m.name} — ${m.qty}
          </label>
        `).join("")}
      </div>
      <button class="clear-btn" id="clearCartBtn" type="button">Vider le panier</button>
    `;

  panierScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="panierMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="back-btn" id="panierBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
      </div>
      <h2>Panier de courses</h2>
    </div>
    <div class="panier-body">${body}</div>
  `;

  panierScroll.querySelector("#panierBackBtn").addEventListener("click", closePanier);
  panierScroll.querySelector("#panierMenuBtn").addEventListener("click", openDrawer);
  panierScroll.querySelectorAll("[data-removeid]").forEach(btn => {
    btn.addEventListener("click", () => removeRecipeFromCart(btn.dataset.removeid));
  });
  panierScroll.querySelectorAll(".checkbox[data-key]").forEach(box => {
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const key = box.dataset.key;
      if (checkedItems.has(key)) checkedItems.delete(key); else checkedItems.add(key);
      saveCheckedItems();
      syncCartRemote();
      renderPanier();
    });
  });
  const clearBtn = panierScroll.querySelector("#clearCartBtn");
  if (clearBtn) clearBtn.addEventListener("click", clearCart);
}

export function openPanier(){
  renderPanier();
  panierView.classList.add("is-open");
  panierView.setAttribute("aria-hidden", "false");
  panierScroll.scrollTop = 0;
  syncBodyScrollLock();
}

export function closePanier(){
  panierView.classList.remove("is-open");
  panierView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
}

export function clearCartLocal(){
  cart.length = 0;
  checkedItems.clear();
  localStorage.removeItem(CART_KEY);
  localStorage.removeItem(CART_CHECKED_KEY);
  updateCartBadge();
}
