# Vue impression pour les recettes — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton "Imprimer" sur la fiche recette qui produit une impression propre : uniquement le contenu texte de la recette, en une colonne, sans être coupé par la mise en page en superposition plein écran de l'application.

**Architecture:** Un bouton dans `public/js/detail.js` déclenche `window.print()`. Une nouvelle feuille `@media print` dans `public/style.css` masque tout le document sauf `#detailView` (technique `visibility:hidden` globale + `visibility:visible` ciblée), neutralise le positionnement fixe/les zones de défilement de la fiche recette pour permettre une pagination normale, et masque les éléments non pertinents à l'impression (photo, boutons d'action, minuteur, photos d'étape).

**Tech Stack:** CSS `@media print`, `window.print()`, aucun framework de build/test.

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur (aperçu avant impression).
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v48`).
- Seule la fiche recette individuelle (`#detailView`) a une vue impression — aucun autre écran n'est concerné par ce plan.
- Les quantités imprimées doivent refléter l'état actuel affiché à l'écran (portions ajustées via +/-), pas les valeurs d'origine de la recette — ceci est déjà garanti sans code supplémentaire puisque l'impression capture le DOM déjà rendu.
- Les fichiers du site sont dans `public/`.

---

### Task 1: Bouton Imprimer et feuille de style d'impression

**Files:**
- Modify: `public/js/detail.js`
- Modify: `public/style.css`
- Modify: `public/sw.js`

**Interfaces:** Aucune nouvelle fonction exportée — comportement purement local à l'écran détail (clic bouton → `window.print()`) et à la feuille de style.

- [x] **Step 1: Ajouter le bouton "Imprimer" au template**

Dans `public/js/detail.js`, remplacer :

```js
      <div class="detail-actions-row">
        <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
```

par :

```js
      <div class="detail-actions-row">
        <button class="detail-fav" id="detailPrintBtn" type="button" aria-label="Imprimer la recette">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <button class="detail-fav" id="detailEditBtn" type="button" aria-label="Modifier la recette">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
```

- [x] **Step 2: Câbler le bouton**

Dans `public/js/detail.js`, remplacer :

```js
  detailScroll.querySelector("#detailFavBtn").addEventListener("click", () => toggleFavorite(r.id));
```

par :

```js
  detailScroll.querySelector("#detailPrintBtn").addEventListener("click", () => window.print());
  detailScroll.querySelector("#detailFavBtn").addEventListener("click", () => toggleFavorite(r.id));
```

- [x] **Step 3: Ajouter la feuille de style d'impression**

À la toute fin de `public/style.css`, ajouter :

```css

/* =========================================================
   IMPRESSION — fiche recette uniquement
   ========================================================= */
@media print{
  body *{ visibility:hidden; }
  #detailView, #detailView *{ visibility:visible; }
  #detailView{
    position:static; inset:auto; transform:none; opacity:1;
    overflow:visible; width:auto; max-height:none; border-radius:0; box-shadow:none;
  }
  #detailScroll{ overflow:visible; height:auto; }
  .detail-hero, .detail-actions-row, .timer-panel, .detail-sub-toggle, .step-photo, .add-to-cart-btn, .step-btn{ display:none; }
  .detail-sub{ -webkit-line-clamp:unset; overflow:visible; }
  .detail-body{ grid-template-columns: 1fr; }
}
```

Notes pour l'implémenteur :
- `body *{ visibility:hidden; } #detailView, #detailView *{ visibility:visible; }` est la technique standard d'isolation pour l'impression : elle masque tout le document sauf le sous-arbre de la fiche recette, sans avoir à énumérer chaque écran de l'application par son id.
- `#detailView{ position:static; ... }` utilise un sélecteur d'ID pour garantir une spécificité suffisante face aux règles existantes `.detail-view.is-open{ transform: ...; }` (y compris celle définie dans la media query desktop `@media (min-width:768px)`), sans dépendre de l'ordre des règles dans le fichier.
- `.detail-hero` masque à la fois la photo principale et le bouton menu (`#detailMenuBtn`, imbriqué dedans via `.detail-topbar`) — un seul sélecteur suffit pour les deux.
- `.detail-actions-row` masque les boutons Imprimer/Modifier/Supprimer/Panier/Favoris (tous regroupés dans ce conteneur, distinct de `.detail-hero`).
- `.detail-sub{ -webkit-line-clamp:unset; overflow:visible; }` s'applique que la description ait été développée à l'écran via "Voir plus" ou non — la classe `.is-expanded` fait la même chose, cette règle l'impose systématiquement à l'impression.

- [x] **Step 4: Bump `CACHE_NAME` dans `public/sw.js`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v48";
```

par :

```js
const CACHE_NAME = "carnet-cache-v49";
```

- [x] **Step 5: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois. Aucune erreur console. DevTools → Application → Cache Storage doit montrer `carnet-cache-v49`.

Ce test nécessite d'ouvrir une fiche recette (derrière l'écran de connexion). Si une session authentifiée est disponible :
- Ouvrir une recette, cliquer "Imprimer" (ou faire Ctrl+P/Cmd+P) → l'aperçu avant impression ne montre que le titre, la description complète, les stats (temps/personnes/difficulté, calories/protéines si renseignées), les allergènes, les ustensiles, les ingrédients et les étapes — pas la photo, pas les boutons d'action, pas le minuteur, pas les photos d'étape, pas les boutons +/- à côté du nombre de personnes.
- Ingrédients et étapes s'affichent en une seule colonne dans l'aperçu (pas côte à côte comme à l'écran).
- Si la description était tronquée à l'écran (bouton "Voir plus" visible), l'aperçu d'impression montre le texte complet.
- Ajuster les portions avec +/- avant d'imprimer → les quantités dans l'aperçu reflètent l'ajustement.
- Pour une recette longue (beaucoup d'étapes), l'aperçu doit s'étaler sur plusieurs pages plutôt que de couper le contenu à la première page.

Si aucune session authentifiée n'est disponible dans cet environnement, vérifier au minimum que le module se charge sans erreur, puis faire une relecture statique attentive du diff CSS (en particulier la spécificité du sélecteur `#detailView` face aux règles `.detail-view.is-open` existantes) et le signaler dans le rapport (DONE_WITH_CONCERNS) plutôt que de bloquer sur cette étape.

Aucune erreur console sur l'ensemble de ces parcours.

- [x] **Step 6: Commit**

```bash
git add public/js/detail.js public/style.css public/sw.js
git commit -m "Ajouter un bouton Imprimer et une mise en page d'impression pour la fiche recette"
```
