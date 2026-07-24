# Planning : grille horizontale sur PC — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire passer la vue Planning (`meal-plan.js`) d'une liste verticale de 7 jours (quelle que soit la taille d'écran) à une grille calendrier horizontale sur PC (≥641px), en gardant la liste verticale actuelle sur mobile (≤640px).

**Architecture:** Changement CSS uniquement dans `public/style.css` — la disposition PC (colonnes côte à côte) devient la règle de base sans media query, et le bloc `@media (max-width: 640px)` déjà existant reçoit les règles qui ramènent la disposition en vertical pour mobile. Aucune modification de `public/js/meal-plan.js` ni du HTML généré : la structure DOM actuelle fonctionne telle quelle dans les deux dispositions.

**Tech Stack:** CSS pur (flexbox), aucun framework de build/test.

## Global Constraints

- Zéro étape de build, aucun framework de test automatisé — vérification manuelle dans le navigateur (comme tout le reste du projet).
- Seuil de bascule PC/mobile : **640px**, identique au reste du site (`public/style.css:331`).
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v78`).
- Aucun changement de `public/js/meal-plan.js` — uniquement `public/style.css`.
- Le comportement fonctionnel (assigner/retirer une recette d'un créneau, navigation semaine, ajout au panier) ne doit pas changer, seulement la mise en page.

---

### Task 1: Grille horizontale sur PC, liste verticale sur mobile

**Files:**
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:**
- Aucune — changement CSS pur, ne produit ni ne consomme d'interface JS.

- [ ] **Step 1: Réécrire les règles de base du Planning (disposition PC par défaut)**

Dans `public/style.css`, remplacer :

```css
.meal-plan-body{ max-width:760px; margin:0 auto; padding:12px 20px 100px; }
.week-nav{ display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:12px; }
.week-nav button{ background:none; border:none; font-size:1.4rem; color: var(--ink); cursor:pointer; padding:4px 10px; }
#weekLabel{ font-weight:700; font-size:1rem; min-width:170px; text-align:center; }
#weekTodayBtn{ display:block; margin:0 auto 20px; }

.meal-plan-days{ display:flex; flex-direction:column; gap:14px; margin-bottom:20px; }
.meal-plan-day{ background: var(--surface); border:1px solid var(--line); border-radius:6px; padding:12px 16px; }
.meal-plan-day-title{ font-size:.82rem; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color: var(--accent-dark); margin-bottom:10px; }
.meal-plan-slots{ display:flex; flex-direction:column; gap:8px; }
.meal-plan-slot{ display:flex; align-items:center; gap:10px; }
.meal-plan-slot-label{ flex:none; width:44px; font-size:.78rem; color: var(--ink-soft); font-weight:600; }
```

par :

```css
.meal-plan-body{ max-width:1080px; margin:0 auto; padding:12px 20px 100px; }
.week-nav{ display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:12px; }
.week-nav button{ background:none; border:none; font-size:1.4rem; color: var(--ink); cursor:pointer; padding:4px 10px; }
#weekLabel{ font-weight:700; font-size:1rem; min-width:170px; text-align:center; }
#weekTodayBtn{ display:block; margin:0 auto 20px; }

.meal-plan-days{ display:flex; flex-direction:row; gap:10px; margin-bottom:20px; align-items:flex-start; }
.meal-plan-day{ background: var(--surface); border:1px solid var(--line); border-radius:6px; padding:12px 10px; flex:1; min-width:0; }
.meal-plan-day-title{ font-size:.82rem; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color: var(--accent-dark); margin-bottom:10px; }
.meal-plan-slots{ display:flex; flex-direction:column; gap:8px; }
.meal-plan-slot{ display:flex; flex-direction:column; align-items:stretch; gap:4px; }
.meal-plan-slot-label{ width:auto; font-size:.78rem; color: var(--ink-soft); font-weight:600; }
```

Note pour l'implémenteur : `.meal-plan-body` passe de `max-width:760px` à `1080px` (comme `.grid-section`, la grille de recettes principale) pour laisser assez de place à 7 colonnes lisibles — cette valeur plus large ne change rien sur mobile puisque l'écran y est de toute façon plus étroit que les deux valeurs. `.meal-plan-days` passe de `column` à `row` avec chaque `.meal-plan-day` en `flex:1; min-width:0` pour des colonnes de largeur égale. `.meal-plan-slot` passe de `row` (étiquette et contenu côte à côte) à `column` (étiquette au-dessus) pour rester lisible dans une colonne étroite ; `.meal-plan-slot-label` perd sa largeur fixe de 44px (plus nécessaire en disposition colonne).

- [ ] **Step 2: Ajouter les règles mobile qui restaurent la disposition actuelle**

Dans `public/style.css`, repérer le bloc media query mobile existant et remplacer :

```css
@media (max-width: 640px){
  .hero-card{ grid-template-columns: 1fr; }
  .hero-art{ order:-1; min-height:140px; }
  .detail-actions-row{ float:none; justify-content:flex-end; margin-left:0; margin-top:12px; }
}
```

par :

```css
@media (max-width: 640px){
  .hero-card{ grid-template-columns: 1fr; }
  .hero-art{ order:-1; min-height:140px; }
  .detail-actions-row{ float:none; justify-content:flex-end; margin-left:0; margin-top:12px; }
  .meal-plan-days{ flex-direction:column; gap:14px; }
  .meal-plan-day{ padding:12px 16px; }
  .meal-plan-slot{ flex-direction:row; align-items:center; gap:10px; }
  .meal-plan-slot-label{ flex:none; width:44px; }
}
```

Note pour l'implémenteur : ces 4 règles ramènent exactement le rendu mobile à l'identique d'avant ce changement (jours empilés verticalement, étiquette de créneau côte à côte avec son contenu, padding d'origine) — rien d'autre ne doit changer sur mobile.

- [ ] **Step 3: Bump `CACHE_NAME`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v78";
```

par :

```js
const CACHE_NAME = "carnet-cache-v79";
```

- [ ] **Step 4: Vérifier dans le navigateur**

Lancer un serveur local sur `public/` (ex. `npx serve public` ou `python -m http.server` depuis `public/`), recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v79`. Aucune erreur console.

Ce changement est entièrement visuel/CSS et vérifiable **sans session authentifiée**, en injectant une recette de test et en ouvrant Planning directement :

```js
const domMod = await import('/js/dom.js');
const mealPlanMod = await import('/js/meal-plan.js');
const storeMod = await import('/js/recipes-store.js');

storeMod.ALL_RECIPES.push(
  { id: 'test-recette', title: 'Recette de test', category:'plat', desc:'', time:10, servings:2, difficulty:'Facile', icon:'plat', ingredients:[], steps:[] }
);

mealPlanMod.openMealPlan();
await new Promise(r => setTimeout(r, 200)); // laisse le temps au chargement async de la semaine

const daysCount = domMod.mealPlanScroll.querySelectorAll('.meal-plan-day').length;
const daysFlexDirection = getComputedStyle(domMod.mealPlanScroll.querySelector('.meal-plan-days')).flexDirection;

console.log({ daysCount, daysFlexDirection });
```

- `daysCount === 7` (les 7 jours de la semaine).
- `daysFlexDirection` doit valoir `"row"` si la fenêtre du navigateur fait plus de 640px de large au moment du test, ou `"column"` si elle fait 640px ou moins — vérifier les deux en redimensionnant la fenêtre (ou via `resize_window` si l'outil de navigateur le permet) avant de relire `getComputedStyle`.

Vérifier aussi visuellement (capture d'écran) à une largeur ≥641px que les 7 jours apparaissent bien côte à côte en colonnes lisibles, et à une largeur ≤640px qu'ils sont empilés verticalement comme avant.

Si aucune session authentifiée n'est disponible pour ce test (le planning dépend de `ALL_RECIPES` mais aussi d'un compte pour charger/sauvegarder — le rendu de la grille elle-même ne dépend que du DOM et de `ALL_RECIPES`, donc testable sans session comme montré ci-dessus), relecture statique attentive du CSS et le signaler dans le rapport (DONE_WITH_CONCERNS) plutôt que de bloquer sur cette étape.

- [ ] **Step 5: Commit**

```bash
git add public/style.css public/sw.js
git commit -m "Passer le planning en grille horizontale sur PC, vertical sur mobile"
```
