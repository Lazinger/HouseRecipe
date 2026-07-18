# Dialogue centré (PC) / plein écran (mobile) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur PC (≥768px), fiche recette / ajout / panier / compte s'affichent en dialogue centré (verticalement et horizontalement) avec coins arrondis et bouton ✕, comme la référence HelloFresh. Sur mobile (<768px), elles s'affichent en plein écran classique (glissement depuis la droite), fermable via le geste de retour natif du téléphone. Le titre "Le Carnet" devient un raccourci cliquable vers l'accueil.

**Architecture:** `.detail-view` devient mobile-first (plein écran, glissement en X) avec une media query `@media (min-width:768px)` qui bascule vers un dialogue centré (transform + scale/opacity, largeur/hauteur limitées). `#authView` garde le plein écran à toute largeur via une exception dans la media query. La fermeture (✕, tap sur le fond, geste natif) passe désormais par l'historique de navigation (`history.pushState`/`back`/`popstate`) pour que le geste système fonctionne, avec une seule entrée d'historique par groupe de vues empilées (cohérent avec la décision existante : fermer referme tout d'un coup, retour direct à l'accueil).

**Tech Stack:** CSS (media query, transform), `history.pushState`/`history.back`/`popstate` (API navigateur standard), JS vanilla existant.

## Global Constraints

- Zéro étape de build, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Les fichiers du site sont dans `public/`.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v16`).
- Seuil responsive : 768px (validé). En dessous : mobile. À partir de : PC.
- `#authView` reste plein écran à **toute** largeur d'écran, non fermable en tapant à côté, glissement depuis la droite.
- Sur PC : fermeture par le ✕ **et** par tap sur le fond assombri (les deux coexistent).
- Sur mobile : aucun bouton ✕ ni "Retour" visible — fermeture exclusivement via le geste natif (et le pont retour matériel Android déjà géré par `popstate`).
- Une seule entrée d'historique par groupe de vues empilées (ouvrir une seconde vue par-dessus une vue déjà ouverte n'ajoute pas de nouvelle entrée) — un seul retour ramène toujours directement à l'accueil.
- Le titre "Le Carnet" cliquable doit se comporter exactement comme `goToAllRecipes()`.

---

### Task 1: CSS responsive + HTML (dialogue PC / plein écran mobile, bouton ✕, titre cliquable)

**Files:**
- Modify: `public/style.css` (bloc `.detail-view`/`.sheet-grabber`/`.detail-scroll`, ajout `.detail-close`, ajout media query, suppression de l'ancien override `.auth-view` toujours actif, ajout du reset bouton pour `.brand`)
- Modify: `public/index.html` (suppression des 4 `.sheet-grabber`, ajout des 4 boutons `.detail-close`, transformation de `.brand` en bouton cliquable)

**Interfaces:**
- Produces: classe `.detail-close` (bouton ✕, caché par défaut, visible seulement dans la media query PC) ; élément `#brandHomeBtn` (nécessaire à la Task 2, qui y branchera `goToAllRecipes`) ; 4 éléments `#detailCloseBtn`/`#addCloseBtn`/`#panierCloseBtn`/`#profileCloseBtn` (nécessaires à la Task 2).
- Comportement observable après cette tâche seule : en dessous de 768px, les 4 vues restent en plein écran glissant depuis la droite (sans le ✕, qui reste caché) ; à partir de 768px, elles devraient apparaître en dialogue centré avec le ✕ visible — mais le ✕ et le tap sur le fond ne fermeront rien tant que la Task 2 n'a pas branché la logique JS (normal, à ce stade).

- [ ] **Step 1: Remplacer le bloc `.detail-view` / `.sheet-grabber` / `.detail-scroll` dans `public/style.css`**

Remplacer :

```css
.detail-view{
  position: fixed; left:0; right:0; bottom:0; top:18vh; z-index:50;
  max-width: 1080px; margin-left:auto; margin-right:auto;
  background: var(--bg);
  border-radius: 20px 20px 0 0;
  display:flex; flex-direction:column;
  transform: translateY(100%);
  transition: transform .32s cubic-bezier(.32,.72,0,1);
  overflow:hidden;
}
.detail-view.is-open{ transform: translateY(0); }
.sheet-grabber{
  flex-shrink:0;
  width:36px; height:4px; border-radius:3px;
  background: rgba(0,0,0,.15);
  margin: 10px auto 0;
}
.detail-scroll{ flex:1; min-height:0; overflow-y:auto; }
```

par :

```css
.detail-view{
  position: fixed; inset:0; z-index:50;
  background: var(--bg);
  display:flex; flex-direction:column;
  transform: translateX(100%);
  transition: transform .32s cubic-bezier(.32,.72,0,1);
  overflow:hidden;
}
.detail-view.is-open{ transform: translateX(0); }
.detail-scroll{ flex:1; min-height:0; overflow-y:auto; }

.detail-close{
  display:none; position:absolute; top:14px; right:14px; z-index:3;
  width:36px; height:36px; border-radius:50%;
  background:#fff; color: var(--ink);
  align-items:center; justify-content:center;
  border:none; box-shadow: var(--shadow-raised);
  font-size:1rem; line-height:1; cursor:pointer;
}

@media (min-width: 768px){
  .detail-view{
    inset:auto; left:50%; top:50%;
    width: min(720px, calc(100vw - 48px));
    max-height: calc(100vh - 64px);
    border-radius: 20px;
    transform: translate(-50%,-50%) scale(.96);
    opacity: 0;
    transition: transform .32s cubic-bezier(.32,.72,0,1), opacity .32s ease;
  }
  .detail-view.is-open{ transform: translate(-50%,-50%) scale(1); opacity:1; }
  .detail-close{ display:flex; }

  .auth-view{
    inset:0;
    width:auto; max-height:none;
    border-radius:0;
    transform: translateX(100%);
    opacity:1;
    transition: transform .32s cubic-bezier(.32,.72,0,1);
  }
  .auth-view.is-open{ transform: translateX(0); }
}
```

- [ ] **Step 2: Supprimer l'ancien override `.auth-view` toujours actif, dans `public/style.css`**

Dans la section "vue connexion", supprimer entièrement ce bloc (devenu inutile : le comportement mobile de `.detail-view` correspond déjà à ce plein écran par défaut, et l'exception PC est maintenant dans la media query de la Step 1) :

```css
.auth-view{
  top:0; border-radius:0;
  transform: translateX(100%);
}
.auth-view.is-open{ transform: translateX(0); }
```

Laisser intacte la règle suivante (`.auth-view .detail-scroll{...}`), qui reste nécessaire.

- [ ] **Step 3: Rendre `.brand` cliquable, dans `public/style.css`**

Remplacer :

```css
.brand{ display:flex; align-items:center; gap:12px; }
```

par :

```css
.brand{
  display:flex; align-items:center; gap:12px;
  background:none; border:none; padding:0; margin:0;
  font:inherit; text-align:left; cursor:pointer;
}
```

- [ ] **Step 4: Supprimer les 4 `.sheet-grabber` et ajouter les boutons ✕, dans `public/index.html`**

Remplacer :

```html
<!-- ===== VUE DÉTAIL (fiche recette, feuille remontante) ===== -->
<section id="detailView" class="detail-view" aria-hidden="true">
  <div class="sheet-grabber"></div>
  <div class="detail-scroll" id="detailScroll"></div>
</section>

<!-- ===== VUE AJOUT (formulaire, feuille remontante) ===== -->
<section id="addView" class="detail-view add-view hf-theme" aria-hidden="true">
  <div class="sheet-grabber"></div>
  <div class="detail-scroll" id="addScroll"></div>
</section>

<!-- ===== VUE PANIER (liste de courses, feuille remontante) ===== -->
<section id="panierView" class="detail-view add-view" aria-hidden="true">
  <div class="sheet-grabber"></div>
  <div class="detail-scroll" id="panierScroll"></div>
</section>

<!-- ===== VUE CONNEXION (plein écran, avant tout accès à l'app) ===== -->
<section id="authView" class="detail-view add-view auth-view" aria-hidden="true">
  <div class="detail-scroll" id="authScroll"></div>
</section>

<!-- ===== VUE PROFIL (prénom/nom du compte, feuille remontante) ===== -->
<section id="profileView" class="detail-view add-view" aria-hidden="true">
  <div class="sheet-grabber"></div>
  <div class="detail-scroll" id="profileScroll"></div>
</section>
```

par :

```html
<!-- ===== VUE DÉTAIL (fiche recette : plein écran mobile / dialogue PC) ===== -->
<section id="detailView" class="detail-view" aria-hidden="true">
  <button class="detail-close" id="detailCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="detailScroll"></div>
</section>

<!-- ===== VUE AJOUT (formulaire : plein écran mobile / dialogue PC) ===== -->
<section id="addView" class="detail-view add-view hf-theme" aria-hidden="true">
  <button class="detail-close" id="addCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="addScroll"></div>
</section>

<!-- ===== VUE PANIER (liste de courses : plein écran mobile / dialogue PC) ===== -->
<section id="panierView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="panierCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="panierScroll"></div>
</section>

<!-- ===== VUE CONNEXION (plein écran à toute largeur, avant tout accès à l'app) ===== -->
<section id="authView" class="detail-view add-view auth-view" aria-hidden="true">
  <div class="detail-scroll" id="authScroll"></div>
</section>

<!-- ===== VUE PROFIL (compte : plein écran mobile / dialogue PC) ===== -->
<section id="profileView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="profileCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="profileScroll"></div>
</section>
```

- [ ] **Step 5: Rendre le titre cliquable, dans `public/index.html`**

Remplacer :

```html
      <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 14c0-4 3.5-8 12-8s12 4 12 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M6 14h28l-2.5 18a3 3 0 0 1-3 2.6H11.5a3 3 0 0 1-3-2.6L6 14Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M13 14V9M20 14V6M27 14V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>
      <div class="brand-text">
        <h1>Le Carnet</h1>
        <p>recettes glanées &amp; retenues</p>
      </div>
      </div>
```

par :

```html
      <button class="brand" id="brandHomeBtn" type="button" aria-label="Retour à l'accueil">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 14c0-4 3.5-8 12-8s12 4 12 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M6 14h28l-2.5 18a3 3 0 0 1-3 2.6H11.5a3 3 0 0 1-3-2.6L6 14Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M13 14V9M20 14V6M27 14V9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>
      <div class="brand-text">
        <h1>Le Carnet</h1>
        <p>recettes glanées &amp; retenues</p>
      </div>
      </button>
```

- [ ] **Step 6: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois, se connecter. Redimensionner la fenêtre en dessous de 768px : chaque vue (recette, ajout, panier, compte) doit occuper tout l'écran, glisser depuis la droite, sans ✕ visible. Redimensionner au-dessus de 768px : chaque vue doit apparaître comme une carte centrée (horizontalement et verticalement, marge visible sur les 4 côtés), coins arrondis sur les 4 coins, ✕ visible en haut à droite (il ne ferme rien pour l'instant, normal). Vérifier que l'écran de connexion reste plein écran, glissant depuis la droite, à **toute** largeur (redimensionner en dessous et au-dessus de 768px avec l'écran de connexion affiché). Vérifier que le titre "Le Carnet" ressemble exactement à avant (le passage en `<button>` ne doit rien changer visuellement). Aucune erreur console.

- [ ] **Step 7: Commit**

```bash
git add public/style.css public/index.html
git commit -m "Basculer entre dialogue centre (PC) et plein ecran (mobile) selon la largeur"
```

---

### Task 2: Fermeture par historique de navigation (geste natif mobile, bouton ✕, tap fond) + titre cliquable

**Files:**
- Modify: `public/js/dom.js` (exports des nouveaux éléments)
- Modify: `public/js/ui.js` (mécanisme d'historique partagé)
- Modify: `public/js/main.js` (branchement des nouveaux boutons ✕, du titre, et changement de l'écouteur du fond assombri)
- Modify: `public/js/detail.js` (appeler les nouveaux helpers dans `openDetail`/`closeDetail`)
- Modify: `public/js/add-form.js` (appeler les nouveaux helpers dans `openAddForm`/`closeAddForm`)
- Modify: `public/js/cart.js` (appeler les nouveaux helpers dans `openPanier`/`closePanier`)
- Modify: `public/js/profile.js` (appeler les nouveaux helpers dans `openProfile`/`closeProfile`)
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Produces (depuis `ui.js`) : `ensureSheetHistoryEntry()` (pousse une entrée d'historique si aucune n'est déjà active pour le groupe de vues empilées — idempotent, à appeler dans chaque fonction `openX`) ; `resetSheetHistory()` (marque le groupe comme fermé — à appeler dans chaque fonction `closeX`, idempotent) ; `requestCloseSheet()` (déclenche `history.back()` si une entrée est active — à appeler par le ✕ et le tap sur le fond ; ne fait rien si rien n'est ouvert).
- Comportement observable : `openDetail`, `closeDetail`, `openAddForm`, `closeAddForm`, `openPanier`, `closePanier`, `openProfile`, `closeProfile` gardent leur signature exacte — un effet de bord (historique) s'ajoute simplement. Le geste retour (natif ou simulé via `popstate`), le ✕, et le tap sur le fond doivent tous les trois produire le même résultat : fermeture de la vue (ou du groupe de vues empilées) et retour direct à l'accueil.

- [ ] **Step 1: Exporter les nouveaux éléments dans `public/js/dom.js`**

Juste après cette ligne existante :

```js
export const sheetBackdrop = document.getElementById("sheetBackdrop");
```

ajouter :

```js
export const detailCloseBtn = document.getElementById("detailCloseBtn");
export const addCloseBtn = document.getElementById("addCloseBtn");
export const panierCloseBtn = document.getElementById("panierCloseBtn");
export const profileCloseBtn = document.getElementById("profileCloseBtn");
export const brandHomeBtn = document.getElementById("brandHomeBtn");
```

- [ ] **Step 2: Ajouter le mécanisme d'historique dans `public/js/ui.js`**

Juste après ce bloc existant :

```js
/* ---- fond assombri partagé (fiche recette / ajout / panier / compte) ---- */
let hideBackdropTimer = null;
export function openSheetBackdrop(){
  clearTimeout(hideBackdropTimer);
  sheetBackdrop.hidden = false;
  requestAnimationFrame(() => sheetBackdrop.classList.add("is-open"));
}
export function closeSheetBackdrop(){
  clearTimeout(hideBackdropTimer);
  sheetBackdrop.classList.remove("is-open");
  hideBackdropTimer = setTimeout(() => { sheetBackdrop.hidden = true; }, 320);
}
```

ajouter :

```js

/* ---- historique de navigation : permet au geste de retour natif (mobile),
   au bouton ✕ et au tap sur le fond de fermer la vue ouverte. Une seule
   entrée est poussée par groupe de vues empilées (ex. recette + panier) —
   un seul retour ramène donc toujours directement à l'accueil. ---- */
let sheetHistoryPushed = false;
export function ensureSheetHistoryEntry(){
  if (sheetHistoryPushed) return;
  history.pushState({ sheet: true }, "");
  sheetHistoryPushed = true;
}
export function resetSheetHistory(){
  sheetHistoryPushed = false;
}
export function requestCloseSheet(){
  if (!sheetHistoryPushed) return;
  history.back();
}
```

- [ ] **Step 3: Brancher les nouveaux boutons et changer l'écouteur du fond, dans `public/js/main.js`**

Remplacer la ligne d'import de `dom.js` :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, sheetBackdrop
} from "./dom.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, brandHomeBtn
} from "./dom.js";
```

Remplacer la ligne d'import de `ui.js` :

```js
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, showToast } from "./ui.js";
```

par :

```js
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, showToast, requestCloseSheet } from "./ui.js";
```

Remplacer :

```js
sheetBackdrop.addEventListener("click", closeAnyOpenSheet);
```

par :

```js
sheetBackdrop.addEventListener("click", requestCloseSheet);
detailCloseBtn.addEventListener("click", requestCloseSheet);
addCloseBtn.addEventListener("click", requestCloseSheet);
panierCloseBtn.addEventListener("click", requestCloseSheet);
profileCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);
```

Note : `closeAnyOpenSheet` reste utilisée par l'écouteur `popstate` juste au-dessus (ne pas la supprimer) — seul son usage direct par le clic sur le fond change, remplacé par `requestCloseSheet`.

- [ ] **Step 4: Brancher l'historique dans `public/js/detail.js`**

Remplacer la ligne d'import :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
```

par :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, resetSheetHistory } from "./ui.js";
```

Repérer la fin de `openDetail` (la ligne juste avant la fermeture de la fonction, où `openSheetBackdrop()`/`syncBodyScrollLock()` sont déjà appelées — l'ordre exact de ces deux lignes peut différer légèrement de celui montré ici, se fier aux noms de fonctions plutôt qu'à l'ordre) et ajouter l'appel à `ensureSheetHistoryEntry()` juste après `openSheetBackdrop()` (ou l'équivalent trouvé dans le fichier réel) :

```js
  detailView.classList.add("is-open");
  detailView.setAttribute("aria-hidden", "false");
  detailScroll.scrollTop = 0;
  syncBodyScrollLock();
  openSheetBackdrop();
  ensureSheetHistoryEntry();
}
```

Remplacer :

```js
export function closeDetail(){
  if (!detailView.classList.contains("is-open")) return;
  detailView.classList.remove("is-open");
  detailView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

par :

```js
export function closeDetail(){
  if (!detailView.classList.contains("is-open")) return;
  detailView.classList.remove("is-open");
  detailView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
  resetSheetHistory();
}
```

- [ ] **Step 5: Brancher l'historique dans `public/js/add-form.js`**

Remplacer la ligne d'import :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
```

par :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, resetSheetHistory } from "./ui.js";
```

Remplacer :

```js
export function openAddForm(editingRecipe){
  renderAddForm(editingRecipe);
  addView.classList.add("is-open");
  addView.setAttribute("aria-hidden", "false");
  addScroll.scrollTop = 0;
  openSheetBackdrop();
  syncBodyScrollLock();
```

par :

```js
export function openAddForm(editingRecipe){
  renderAddForm(editingRecipe);
  addView.classList.add("is-open");
  addView.setAttribute("aria-hidden", "false");
  addScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
```

Remplacer :

```js
export function closeAddForm(){
  if (!addView.classList.contains("is-open")) return;
  addView.classList.remove("is-open");
  addView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

par :

```js
export function closeAddForm(){
  if (!addView.classList.contains("is-open")) return;
  addView.classList.remove("is-open");
  addView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
  resetSheetHistory();
}
```

- [ ] **Step 6: Brancher l'historique dans `public/js/cart.js`**

Remplacer la ligne d'import :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
```

par :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, resetSheetHistory } from "./ui.js";
```

Remplacer :

```js
export function openPanier(){
  renderPanier();
  panierView.classList.add("is-open");
  panierView.setAttribute("aria-hidden", "false");
  panierScroll.scrollTop = 0;
  openSheetBackdrop();
  syncBodyScrollLock();
```

par :

```js
export function openPanier(){
  renderPanier();
  panierView.classList.add("is-open");
  panierView.setAttribute("aria-hidden", "false");
  panierScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
```

Remplacer :

```js
export function closePanier(){
  if (!panierView.classList.contains("is-open")) return;
  panierView.classList.remove("is-open");
  panierView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

par :

```js
export function closePanier(){
  if (!panierView.classList.contains("is-open")) return;
  panierView.classList.remove("is-open");
  panierView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
  resetSheetHistory();
}
```

- [ ] **Step 7: Brancher l'historique dans `public/js/profile.js`**

Remplacer la ligne d'import :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
```

par :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, resetSheetHistory } from "./ui.js";
```

Remplacer :

```js
export async function openProfile(){
  await renderProfile();
  profileView.classList.add("is-open");
  profileView.setAttribute("aria-hidden", "false");
  profileScroll.scrollTop = 0;
  syncBodyScrollLock();
  openSheetBackdrop();
```

par :

```js
export async function openProfile(){
  await renderProfile();
  profileView.classList.add("is-open");
  profileView.setAttribute("aria-hidden", "false");
  profileScroll.scrollTop = 0;
  syncBodyScrollLock();
  openSheetBackdrop();
  ensureSheetHistoryEntry();
```

Remplacer :

```js
export function closeProfile(){
  if (!profileView.classList.contains("is-open")) return;
  profileView.classList.remove("is-open");
  profileView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

par :

```js
export function closeProfile(){
  if (!profileView.classList.contains("is-open")) return;
  profileView.classList.remove("is-open");
  profileView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
  resetSheetHistory();
}
```

- [ ] **Step 8: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v16";
```

par :

```js
const CACHE_NAME = "carnet-cache-v17";
```

- [ ] **Step 9: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter.

**Sur un viewport large (≥768px) :**
- Ouvrir une fiche recette → dialogue centré, ✕ visible.
- Cliquer le ✕ → se ferme, retour à l'accueil.
- Rouvrir, taper sur le fond assombri → se ferme aussi.
- Ouvrir une fiche recette, puis le panier depuis son bouton panier interne (les deux empilés) → un seul clic sur le ✕ **ou** un seul tap sur le fond doit tout refermer d'un coup et ramener à l'accueil (pas d'étape intermédiaire affichant la fiche recette seule).
- Depuis une fiche recette, cliquer "Modifier" → passe au formulaire d'édition ; cliquer le ✕ de ce formulaire → retour direct à l'accueil.
- Avec une recherche/un filtre de catégorie actif, cliquer le titre "Le Carnet" → tout se réinitialise, retour à l'accueil (identique à "Toutes les recettes" du menu).

**Sur un viewport étroit (<768px) :**
- Ouvrir chacune des 4 vues → plein écran, glissement depuis la droite, aucun ✕ visible.
- Dans la console du navigateur, avec une vue ouverte, exécuter `window.dispatchEvent(new PopStateEvent("popstate"))` pour simuler le retour natif → la vue se ferme, retour à l'accueil.
- Simuler l'empilement (fiche recette puis panier) puis un seul `popstate` simulé → retour direct à l'accueil (pas d'étape intermédiaire).

**Dans les deux cas :** vérifier l'écran de connexion (plein écran, non fermable) à toute largeur. Aucune erreur console sur tout le parcours.

- [ ] **Step 10: Commit**

```bash
git add public/js/dom.js public/js/ui.js public/js/main.js public/js/detail.js public/js/add-form.js public/js/cart.js public/js/profile.js public/sw.js
git commit -m "Fermeture par historique de navigation (geste natif mobile, ferme X, tap fond)"
```
