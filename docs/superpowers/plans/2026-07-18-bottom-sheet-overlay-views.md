# Feuilles remontantes pour les vues secondaires — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fiche recette, ajout/édition, panier et compte se présentent comme une feuille remontant du bas par-dessus la page d'accueil assombrie (au lieu d'un plein écran glissant depuis la droite) ; taper sur le fond assombri ferme la feuille et revient à l'accueil.

**Architecture:** La classe partagée `.detail-view` change de comportement visuel (sheet ancrée en bas au lieu de plein écran) ; un unique élément `#sheetBackdrop` (nouveau, sur le modèle de `#drawerOverlay` déjà existant) sert de fond assombri et de zone de fermeture pour les 4 vues concernées. `#authView` récupère une classe `.auth-view` déjà présente pour restaurer explicitement l'ancien comportement plein écran, non affecté par le fond assombri partagé.

**Tech Stack:** CSS (transitions `transform`), JS vanilla (modules ES existants), aucune dépendance nouvelle.

## Global Constraints

- Zéro étape de build, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Les fichiers du site sont dans `public/`.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v15`).
- `#authView` (écran de connexion) ne doit **pas** être fermable en tapant à côté et reste en plein écran — avant authentification, aucune recette ne charge (RLS Supabase), il n'y a rien à voir "derrière".
- Le tiroir de navigation (`drawer`/`drawerOverlay`) n'est pas concerné par ce plan.
- Pas de geste de balayage (swipe) à implémenter dans ce plan — le tap sur le fond assombri est le seul mécanisme de fermeture ajouté.

---

### Task 1: Restructurer le CSS et le HTML — la feuille remonte du bas

**Files:**
- Modify: `public/style.css:387-395` (bloc `.detail-view` / `.detail-view.is-open` / `.detail-scroll`)
- Modify: `public/style.css:413-418` (supprimer `.back-btn` / `.back-btn:hover`)
- Modify: `public/style.css` (ajouter `.sheet-backdrop`, `.sheet-grabber`, et l'exception `.auth-view` près de la section "vue connexion", ligne ~757)
- Modify: `public/index.html:93-114` (ajouter `#sheetBackdrop` et un `.sheet-grabber` dans les 4 sections concernées)

**Interfaces:**
- Produces: classes CSS `.sheet-backdrop` / `.sheet-backdrop.is-open`, élément `#sheetBackdrop` dans le DOM (nécessaires à la Task 2). Comportement observable : `detailView`, `addView`, `panierView`, `profileView` glissent désormais depuis le bas avec des coins arrondis en haut ; `authView` est visuellement inchangé (glisse toujours depuis la droite, plein écran).

- [ ] **Step 1: Remplacer le bloc `.detail-view` dans `public/style.css`**

Remplacer :

```css
.detail-view{
  position: fixed; inset:0; z-index:50;
  background: var(--bg);
  transform: translateX(100%);
  transition: transform .32s cubic-bezier(.32,.72,0,1);
  overflow:hidden;
}
.detail-view.is-open{ transform: translateX(0); }
.detail-scroll{ height:100%; overflow-y:auto; }
```

par :

```css
.detail-view{
  position: fixed; left:0; right:0; bottom:0; top:18vh; z-index:50;
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

.sheet-backdrop{
  position: fixed; inset:0; z-index:49;
  background: rgba(32,36,29,.45);
  opacity:0; pointer-events:none;
  transition: opacity .32s ease;
}
.sheet-backdrop.is-open{ opacity:1; pointer-events:auto; }
```

- [ ] **Step 2: Supprimer `.back-btn` (devenu inutilisé après la Task 2), dans `public/style.css`**

Supprimer entièrement ce bloc (juste après `.detail-topbar-actions`) :

```css
.back-btn{
  display:flex; align-items:center; gap:6px;
  background: var(--surface); border:1px solid var(--line);
  color: var(--ink); border-radius:6px; padding:8px 15px; font-size:.84rem; font-weight:600;
}
.back-btn:hover{ border-color: var(--emerald); }
```

- [ ] **Step 3: Restaurer le plein écran pour `.auth-view`, dans `public/style.css`**

Juste avant la règle `.auth-view .detail-scroll{...}` (section "vue connexion"), ajouter :

```css
.auth-view{
  top:0; border-radius:0;
  transform: translateX(100%);
}
.auth-view.is-open{ transform: translateX(0); }
```

- [ ] **Step 4: Ajouter le fond assombri et le "grabber" dans `public/index.html`**

Remplacer :

```html
<!-- ===== VUE DÉTAIL (fiche recette plein écran) ===== -->
<section id="detailView" class="detail-view" aria-hidden="true">
  <div class="detail-scroll" id="detailScroll"></div>
</section>

<!-- ===== VUE AJOUT (formulaire plein écran) ===== -->
<section id="addView" class="detail-view add-view hf-theme" aria-hidden="true">
  <div class="detail-scroll" id="addScroll"></div>
</section>

<!-- ===== VUE PANIER (liste de courses plein écran) ===== -->
<section id="panierView" class="detail-view add-view" aria-hidden="true">
  <div class="detail-scroll" id="panierScroll"></div>
</section>

<!-- ===== VUE CONNEXION (plein écran, avant tout accès à l'app) ===== -->
<section id="authView" class="detail-view add-view auth-view" aria-hidden="true">
  <div class="detail-scroll" id="authScroll"></div>
</section>

<!-- ===== VUE PROFIL (prénom/nom du compte, plein écran) ===== -->
<section id="profileView" class="detail-view add-view" aria-hidden="true">
  <div class="detail-scroll" id="profileScroll"></div>
</section>
```

par :

```html
<!-- ===== FOND ASSOMBRI PARTAGÉ (fiche recette / ajout / panier / compte) ===== -->
<div id="sheetBackdrop" class="sheet-backdrop" hidden></div>

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

Note : `authView` ne reçoit pas de `.sheet-grabber` (il reste plein écran, pas de feuille).

- [ ] **Step 5: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois, se connecter. Ouvrir tour à tour une fiche recette, le panier, "Ajouter une recette" et "Mon compte" : chacune doit maintenant apparaître comme une feuille ancrée en bas avec des coins arrondis en haut (le fond assombri n'apparaît pas encore à ce stade — normal, il sera branché à la Task 2). Se déconnecter (si possible) pour vérifier que l'écran de connexion glisse toujours depuis la droite en plein écran, inchangé. Aucune erreur console.

- [ ] **Step 6: Commit**

```bash
git add public/style.css public/index.html
git commit -m "Restructurer les vues secondaires en feuille remontante"
```

---

### Task 2: Brancher le fond assombri, la fermeture au tap, et retirer les boutons Retour

**Files:**
- Modify: `public/js/dom.js` (ajouter l'export `sheetBackdrop`)
- Modify: `public/js/ui.js` (ajouter `openSheetBackdrop`/`closeSheetBackdrop`)
- Modify: `public/js/main.js` (mutualiser la logique de fermeture, brancher le clic sur le fond assombri)
- Modify: `public/js/detail.js` (appeler les helpers, retirer le bouton Retour)
- Modify: `public/js/add-form.js` (appeler les helpers, retirer le bouton Retour)
- Modify: `public/js/cart.js` (appeler les helpers, retirer le bouton Retour)
- Modify: `public/js/profile.js` (appeler les helpers, retirer le bouton Retour)
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Consumes: `.sheet-backdrop`/`#sheetBackdrop` de la Task 1.
- Produces: `openSheetBackdrop()`/`closeSheetBackdrop()` (exportées depuis `ui.js`, consommées par les 4 modules de vue). Aucune signature exportée existante ne change (`openDetail`, `closeDetail`, `openAddForm`, `closeAddForm`, `openPanier`, `closePanier`, `openProfile`, `closeProfile` gardent leur signature et leur comportement observable pour l'appelant — seul un effet de bord visuel s'ajoute).

- [ ] **Step 1: Exporter `sheetBackdrop` dans `public/js/dom.js`**

Juste après cette ligne existante :

```js
export const profileScroll = document.getElementById("profileScroll");
```

ajouter :

```js
export const sheetBackdrop = document.getElementById("sheetBackdrop");
```

- [ ] **Step 2: Ajouter les helpers dans `public/js/ui.js`**

Remplacer la ligne d'import :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, chips, favToggleHeader, state, searchInput } from "./dom.js";
```

par :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput } from "./dom.js";
```

Puis, juste après la fonction `closeDrawer` existante (avant `function closeAllOverlays(){`), ajouter :

```js
/* ---- fond assombri partagé (fiche recette / ajout / panier / compte) ---- */
export function openSheetBackdrop(){
  sheetBackdrop.hidden = false;
  requestAnimationFrame(() => sheetBackdrop.classList.add("is-open"));
}
export function closeSheetBackdrop(){
  sheetBackdrop.classList.remove("is-open");
  setTimeout(() => { sheetBackdrop.hidden = true; }, 320);
}
```

- [ ] **Step 3: Mutualiser la fermeture et brancher le clic, dans `public/js/main.js`**

Remplacer la ligne d'import de `dom.js` :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView
} from "./dom.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, sheetBackdrop
} from "./dom.js";
```

Remplacer :

```js
/* ---- gestion du bouton retour matériel Android (WebView) ---- */
window.addEventListener("popstate", () => {
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
  if (drawer.classList.contains("is-open")) closeDrawer();
});
```

par :

```js
/* ---- fermeture de la feuille ouverte (tap sur le fond assombri, ou retour matériel Android) ---- */
function closeAnyOpenSheet(){
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
}

window.addEventListener("popstate", () => {
  closeAnyOpenSheet();
  if (drawer.classList.contains("is-open")) closeDrawer();
});

sheetBackdrop.addEventListener("click", closeAnyOpenSheet);
```

- [ ] **Step 4: Brancher le fond assombri et retirer le bouton Retour, dans `public/js/detail.js`**

Remplacer la ligne d'import :

```js
import { showToast, openDrawer, syncBodyScrollLock } from "./ui.js";
```

par :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
```

Remplacer :

```js
          <button class="detail-fav is-menu" id="detailMenuBtn" type="button" aria-label="Ouvrir le menu">
            <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button class="back-btn" id="backBtn" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Retour
          </button>
        </div>
```

par :

```js
          <button class="detail-fav is-menu" id="detailMenuBtn" type="button" aria-label="Ouvrir le menu">
            <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
```

Remplacer :

```js
  detailScroll.querySelector("#backBtn").addEventListener("click", closeDetail);
  detailScroll.querySelector("#detailFavBtn").addEventListener("click", () => toggleFavorite(r.id));
```

par :

```js
  detailScroll.querySelector("#detailFavBtn").addEventListener("click", () => toggleFavorite(r.id));
```

Remplacer :

```js
  detailView.classList.add("is-open");
  detailView.setAttribute("aria-hidden", "false");
  detailScroll.scrollTop = 0;
  syncBodyScrollLock();
}
```

par :

```js
  detailView.classList.add("is-open");
  detailView.setAttribute("aria-hidden", "false");
  detailScroll.scrollTop = 0;
  syncBodyScrollLock();
  openSheetBackdrop();
}
```

Remplacer :

```js
export function closeDetail(){
  detailView.classList.remove("is-open");
  detailView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
}
```

par :

```js
export function closeDetail(){
  detailView.classList.remove("is-open");
  detailView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

- [ ] **Step 5: Brancher le fond assombri et retirer le bouton Retour, dans `public/js/add-form.js`**

Remplacer la ligne d'import :

```js
import { showToast, openDrawer, syncBodyScrollLock } from "./ui.js";
```

par :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
```

Remplacer :

```js
        <button class="menu-btn" id="addMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="back-btn" id="addBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
      </div>
```

par :

```js
        <button class="menu-btn" id="addMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
```

Remplacer :

```js
  addScroll.querySelector("#addBackBtn").addEventListener("click", closeAddForm);
  addScroll.querySelector("#addMenuBtn").addEventListener("click", openDrawer);
```

par :

```js
  addScroll.querySelector("#addMenuBtn").addEventListener("click", openDrawer);
```

Remplacer :

```js
export function openAddForm(editingRecipe){
  renderAddForm(editingRecipe);
  addView.classList.add("is-open");
  addView.setAttribute("aria-hidden", "false");
  addScroll.scrollTop = 0;
```

par :

```js
export function openAddForm(editingRecipe){
  renderAddForm(editingRecipe);
  addView.classList.add("is-open");
  addView.setAttribute("aria-hidden", "false");
  addScroll.scrollTop = 0;
  openSheetBackdrop();
```

Remplacer :

```js
export function closeAddForm(){
  addView.classList.remove("is-open");
  addView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
```

par :

```js
export function closeAddForm(){
  addView.classList.remove("is-open");
  addView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
```

- [ ] **Step 6: Brancher le fond assombri et retirer le bouton Retour, dans `public/js/cart.js`**

Remplacer la ligne d'import :

```js
import { showToast, openDrawer, syncBodyScrollLock } from "./ui.js";
```

par :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
```

Remplacer (repérer le bloc identique dans le template de `renderPanier`, autour de la ligne 177) :

```js
        <button class="back-btn" id="panierBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
```

par : (rien — supprimer ces 4 lignes entièrement)

Remplacer :

```js
  panierScroll.querySelector("#panierBackBtn").addEventListener("click", closePanier);
  panierScroll.querySelector("#panierMenuBtn").addEventListener("click", openDrawer);
```

par :

```js
  panierScroll.querySelector("#panierMenuBtn").addEventListener("click", openDrawer);
```

Remplacer :

```js
export function openPanier(){
  renderPanier();
  panierView.classList.add("is-open");
  panierView.setAttribute("aria-hidden", "false");
  panierScroll.scrollTop = 0;
```

par :

```js
export function openPanier(){
  renderPanier();
  panierView.classList.add("is-open");
  panierView.setAttribute("aria-hidden", "false");
  panierScroll.scrollTop = 0;
  openSheetBackdrop();
```

Remplacer :

```js
export function closePanier(){
  panierView.classList.remove("is-open");
  panierView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
```

par :

```js
export function closePanier(){
  panierView.classList.remove("is-open");
  panierView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
```

- [ ] **Step 7: Brancher le fond assombri et retirer le bouton Retour, dans `public/js/profile.js`**

Remplacer la ligne d'import :

```js
import { showToast, openDrawer, syncBodyScrollLock } from "./ui.js";
```

par :

```js
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop } from "./ui.js";
```

Remplacer (dans le template de `renderProfile`) :

```js
        <button class="back-btn" id="profileBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
```

par : (rien — supprimer ces 4 lignes entièrement)

Remplacer :

```js
  profileScroll.querySelector("#profileBackBtn").addEventListener("click", closeProfile);
  profileScroll.querySelector("#profileMenuBtn").addEventListener("click", openDrawer);
```

par :

```js
  profileScroll.querySelector("#profileMenuBtn").addEventListener("click", openDrawer);
```

Note : dans `profile.js`, le bouton menu et le bouton retour ne sont pas dans le même ordre que dans les autres fichiers (le menu est parfois listé après) — repérer les deux lignes exactes par leur `id` (`profileBackBtn`, `profileMenuBtn`) plutôt que par leur position si l'ordre diffère légèrement à la lecture du fichier réel.

Remplacer :

```js
export async function openProfile(){
  await renderProfile();
  profileView.classList.add("is-open");
  profileView.setAttribute("aria-hidden", "false");
  profileScroll.scrollTop = 0;
  syncBodyScrollLock();
}
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
}
```

Remplacer :

```js
export function closeProfile(){
  profileView.classList.remove("is-open");
  profileView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
}
```

par :

```js
export function closeProfile(){
  profileView.classList.remove("is-open");
  profileView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

- [ ] **Step 8: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v15";
```

par :

```js
const CACHE_NAME = "carnet-cache-v16";
```

- [ ] **Step 9: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter. Pour chacune des 4 vues (fiche recette, ajout, panier, compte) :
- L'ouvrir → la feuille remonte du bas, le fond derrière s'assombrit visiblement, l'accueil reste visible en transparence.
- Taper sur la zone assombrie (en dehors de la feuille) → la feuille se ferme, retour à l'accueil.
- Confirmer qu'aucun bouton "Retour" n'apparaît plus dans l'en-tête de la vue.

Se déconnecter (si possible) : l'écran de connexion doit rester en plein écran, sans fond assombri cliquable, glissement depuis la droite inchangé.

Pour le retour matériel Android : sans appareil Android sous la main, simuler dans la console du navigateur avec une vue ouverte : `window.dispatchEvent(new PopStateEvent("popstate"))` → la vue ouverte doit se fermer.

Vérifier l'absence d'erreur console sur tout le parcours.

- [ ] **Step 10: Commit**

```bash
git add public/js/dom.js public/js/ui.js public/js/main.js public/js/detail.js public/js/add-form.js public/js/cart.js public/js/profile.js public/sw.js
git commit -m "Brancher le fond assombri partage et retirer les boutons Retour"
```
