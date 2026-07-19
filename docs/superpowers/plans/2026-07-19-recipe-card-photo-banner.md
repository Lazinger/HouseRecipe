# Photo pleine largeur sur les cartes recette — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les cartes de la grille et la carte "recette du jour" affichent la photo de la recette dans un grand bandeau/panneau (au lieu d'une petite icône 42×42), avec un repli propre (fond teinté + icône agrandie) pour les recettes sans photo.

**Architecture:** `applyCardPhoto(recipeId, iconEl)` (déjà générique, dans `photos.js`) est réutilisée telle quelle pour les deux emplacements — seule la structure HTML/CSS autour de l'élément qu'on lui passe change. Sur la grille, l'icône et le bouton favori deviennent deux enfants distincts d'un nouveau conteneur `.card-photo` (le favori ne doit pas être écrasé quand `applyCardPhoto` remplace le contenu de l'icône par une `<img>`). Le texte de la carte passe dans un nouveau conteneur `.card-body` qui porte désormais le padding (le bandeau photo doit toucher les bords de la carte).

**Tech Stack:** HTML/CSS/JS existants, aucune dépendance nouvelle.

## Global Constraints

- Zéro étape de build, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Les fichiers du site sont dans `public/`.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v21`).
- Concerne uniquement `.recipe-card` (grille) et `.hero-card`/`.hero-art` (recette du jour) — aucun autre emplacement (fiche détail, panier) n'est concerné.
- Sans photo : même hauteur de bandeau que les cartes avec photo (alignement cohérent de la grille), fond teinté par catégorie existant (`--accent-tint`) + icône agrandie et centrée.
- Le bouton favori doit rester cliquable indépendamment de l'ouverture de la fiche recette (pas de régression sur `e.stopPropagation()`).

---

### Task 1: Bandeau photo sur les cartes de la grille et la carte du jour

**Files:**
- Modify: `public/js/grid.js` (markup de `renderHero()` et `renderGrid()`)
- Modify: `public/style.css` (`.recipe-card`, `.card-top` → supprimé, `.card-icon`, `.card-fav`, nouveau `.card-photo`/`.card-body`, `.hero-art`)
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Consumes: `applyCardPhoto(recipeId, iconEl)` (inchangée, depuis `./photos.js`, déjà importée dans `grid.js`).
- Produces: aucune nouvelle fonction exportée — `renderGrid()`/`renderHero()` gardent leur signature et leur déclenchement (`render()`) inchangés ; seul le HTML produit et le CSS changent.

- [ ] **Step 1: Restructurer le markup d'une carte de la grille, dans `public/js/grid.js`**

Remplacer :

```js
    card.innerHTML = `
      <div class="card-top">
        <span class="card-icon">${ICONS[r.icon]}</span>
        <button class="card-fav" type="button" aria-pressed="${isFav}" aria-label="Ajouter aux favoris" data-favid="${r.id}">
          <svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-10-9.4C.4 7.6 2 4 5.6 3.4 8 3 10.2 4.2 12 6.6 13.8 4.2 16 3 18.4 3.4 22 4 23.6 7.6 22 11.1c-2.5 4.8-10 9.4-10 9.4Z" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <span class="card-cat">${r.category}</span>
      <h3 class="card-title">${r.title}</h3>
      <p class="card-desc">${r.desc}</p>
      <div class="card-meta">
        <span>⏱ ${r.time} min</span>
        <span>${r.servings} pers.</span>
        <span>${r.difficulty}</span>
      </div>
    `;
```

par :

```js
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
```

Note : la ligne juste après ce bloc, `applyCardPhoto(r.id, card.querySelector(".card-icon"));`, ne change pas — `.card-icon` reste le nom de la classe visée, seule sa position/taille CSS change (voir Step 3).

- [ ] **Step 2: Appeler `applyCardPhoto` pour la carte du jour, dans `public/js/grid.js`**

Remplacer :

```js
  heroSlot.querySelector(".hero-card").addEventListener("click", () => openDetail(featured.id));
}
```

par :

```js
  heroSlot.querySelector(".hero-card").addEventListener("click", () => openDetail(featured.id));
  applyCardPhoto(featured.id, heroSlot.querySelector(".hero-art"));
}
```

- [ ] **Step 3: Réécrire le CSS des cartes de la grille, dans `public/style.css`**

Remplacer :

```css
.recipe-card{
  position:relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 18px 18px 16px;
  cursor:pointer;
  transition: border-color .2s ease, box-shadow .2s ease;
  text-align:left;
  width:100%;
  display:flex; flex-direction:column; gap:12px;
}
.recipe-card:hover{ border-color: var(--emerald); box-shadow: var(--shadow-raised); }
.recipe-card:active{ transform: translateY(1px); }

.card-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
.card-icon{
  color: var(--accent); flex:none;
  width: 42px; height:42px; border-radius: 8px;
  background: var(--accent-tint);
  display:flex; align-items:center; justify-content:center;
}
.card-icon svg{ width:22px; height:22px; }
.card-icon.has-photo{ padding:0; overflow:hidden; }
.card-icon.has-photo img{ width:100%; height:100%; object-fit:cover; display:block; }

.card-fav{
  flex:none; background: transparent; border:none; color: var(--ink-faint); padding:8px;
  display:flex; border-radius: 999px;
  transition: color .15s ease;
}
.card-fav[aria-pressed="true"]{ color: var(--terracotta-dark); }
.card-fav svg{ width:16px; height:16px; }
```

par :

```css
.recipe-card{
  position:relative;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow:hidden;
  cursor:pointer;
  transition: border-color .2s ease, box-shadow .2s ease;
  text-align:left;
  width:100%;
  display:flex; flex-direction:column;
}
.recipe-card:hover{ border-color: var(--emerald); box-shadow: var(--shadow-raised); }
.recipe-card:active{ transform: translateY(1px); }

.card-photo{ position:relative; width:100%; height:150px; flex:none; background: var(--accent-tint); }
.card-icon{
  position:absolute; inset:0; color: var(--accent);
  display:flex; align-items:center; justify-content:center;
}
.card-icon svg{ width:52px; height:52px; }
.card-icon.has-photo img{ width:100%; height:100%; object-fit:cover; display:block; }

.card-fav{
  position:absolute; bottom:10px; right:10px; z-index:1;
  background: rgba(255,255,255,.92); border:none; color: var(--ink-faint); padding:8px;
  display:flex; border-radius: 999px;
  box-shadow: var(--shadow-raised);
  transition: color .15s ease;
}
.card-fav[aria-pressed="true"]{ color: var(--terracotta-dark); }
.card-fav svg{ width:16px; height:16px; }

.card-body{ display:flex; flex-direction:column; gap:12px; padding:14px 16px 16px; }
```

- [ ] **Step 4: Ajouter le support photo à la carte du jour, dans `public/style.css`**

Remplacer :

```css
.hero-art{
  position:relative; display:flex; align-items:center; justify-content:center;
  min-height: 190px; background: var(--emerald-tint);
  color: var(--emerald-dark);
}
.hero-art svg{ width: 64px; height:64px; }
```

par :

```css
.hero-art{
  position:relative; display:flex; align-items:center; justify-content:center;
  min-height: 190px; background: var(--emerald-tint);
  color: var(--emerald-dark);
  overflow:hidden;
}
.hero-art svg{ width: 64px; height:64px; }
.hero-art.has-photo img{ width:100%; height:100%; object-fit:cover; display:block; }
```

- [ ] **Step 5: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v21";
```

par :

```js
const CACHE_NAME = "carnet-cache-v22";
```

- [ ] **Step 6: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois, se connecter.
- Sur la grille : chaque carte affiche un bandeau photo pleine largeur en haut (~150px). Pour une recette avec photo déjà uploadée (voir B4), la photo remplit le bandeau. Pour une recette sans photo, le bandeau garde la même hauteur avec le fond teinté par catégorie et l'icône agrandie et centrée.
- Le cœur (favori) apparaît en cercle blanc flottant en bas à droite du bandeau, toujours cliquable indépendamment (cliquer dessus ne doit pas ouvrir la fiche recette ; cliquer ailleurs sur la carte doit l'ouvrir).
- La carte "recette du jour" en haut de page applique le même traitement dans son panneau de droite (photo si disponible, sinon fond teinté + icône).
- Toutes les cartes de la grille ont la même hauteur de bandeau, alignement visuel cohérent que les recettes aient une photo ou non.
- Aucune erreur console.

- [ ] **Step 7: Commit**

```bash
git add public/js/grid.js public/style.css public/sw.js
git commit -m "Afficher la photo des recettes en grand bandeau sur les cartes"
```
