# Fondation Supabase + écran de connexion — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place le projet Supabase (tables, RLS, données de départ) et ajouter un écran de connexion qui verrouille l'app — une fois connecté, l'app fonctionne exactement comme aujourd'hui (recettes/panier/favoris toujours en `localStorage`/IndexedDB pour l'instant, rien d'autre ne change).

**Architecture:** Un nouveau module `js/supabase-client.js` expose un client Supabase unique (chargé en module ES via CDN, zéro build). Un nouveau module `js/auth.js` affiche un écran de connexion plein écran (même gabarit que les vues existantes) et bloque l'accès au reste de l'app tant que personne n'est connecté. `js/main.js` attend la confirmation de connexion avant de lancer le rendu de l'app.

**Tech Stack:** Supabase (Postgres + Auth), client JS `@supabase/supabase-js` v2 chargé depuis `https://esm.sh`, HTML/CSS/JS existants du projet (aucune dépendance npm ajoutée).

**Ce que ce plan NE fait PAS** (prévu dans un plan ultérieur, une fois cette fondation vérifiée) : synchronisation réelle des recettes/panier/favoris avec Supabase, file d'attente hors-ligne, stockage des photos sur Supabase, écran d'inscription par code d'invitation. Ce plan pose uniquement les fondations : base de données prête, et un mur de connexion devant l'app actuelle inchangée.

## Global Constraints

- Zéro étape de build : tout script reste `<script type="module">`, aucune dépendance à installer via npm.
- Le client Supabase se charge via CDN ESM : `https://esm.sh/@supabase/supabase-js@2`.
- URL du projet Supabase : `https://bmotbwubruvsrflaufis.supabase.co`
- Clé publique (publishable/anon) : `sb_publishable_6tJ6DS20TgSxEgWqKKpXJA_G1pkybFs` — non secrète, sans risque à committer dans le code du site.
- Texte de l'interface en français, cohérent avec le reste de l'app.
- Pas de framework de test automatisé dans ce projet — vérification manuelle dans le navigateur à chaque étape, comme pour tout le reste du code existant.

---

### Task 1: Schéma Supabase (tables, RLS, données de départ)

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces: 4 tables Postgres (`recipes`, `favorites`, `cart_state`, `invite_codes`) avec RLS activé, utilisées par les tâches suivantes et par le plan de synchronisation à venir.

- [ ] **Step 1: Écrire le fichier de schéma**

Créer `supabase/schema.sql` avec ce contenu exact :

```sql
-- ===== recipes : livre de recettes partagé par tout le foyer =====
create table public.recipes (
  id text primary key,
  title text not null,
  category text not null,
  icon text not null,
  description text not null default '',
  time integer not null default 0,
  servings integer not null default 1,
  difficulty text not null default 'Facile',
  note text not null default '',
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  nutrition jsonb,
  allergens text,
  utensils jsonb,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "Household members can read recipes"
  on public.recipes for select
  using (auth.uid() is not null);

create policy "Household members can insert recipes"
  on public.recipes for insert
  with check (auth.uid() is not null);

create policy "Household members can update recipes"
  on public.recipes for update
  using (auth.uid() is not null);

create policy "Household members can delete recipes"
  on public.recipes for delete
  using (auth.uid() is not null);

-- ===== favorites : strictement personnels =====
create table public.favorites (
  user_id uuid not null references auth.users(id),
  recipe_id text not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

alter table public.favorites enable row level security;

create policy "Users manage their own favorites"
  on public.favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===== cart_state : panier strictement personnel, une ligne par compte =====
create table public.cart_state (
  user_id uuid primary key references auth.users(id),
  items jsonb not null default '[]',
  checked jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.cart_state enable row level security;

create policy "Users manage their own cart"
  on public.cart_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===== invite_codes : codes d'invitation à usage unique =====
-- Pas de policy publique : seule une Edge Function (clé service_role,
-- ajoutée dans un plan ultérieur) pourra lire/écrire cette table.
create table public.invite_codes (
  code text primary key,
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id),
  used_at timestamptz
);

alter table public.invite_codes enable row level security;

-- ===== Données de départ : les 8 recettes intégrées =====
insert into public.recipes (id, title, category, icon, description, time, servings, difficulty, note, ingredients, steps) values
('ratatouille', 'Ratatouille provençale', 'plat', 'pot', 'Légumes d''été mijotés doucement, à l''huile d''olive et au thym.', 55, 4, 'Facile', 'Encore meilleure réchauffée le lendemain : les saveurs ont le temps de se mêler.',
 '[["Aubergine","2 pièces"],["Courgette","3 pièces"],["Poivron rouge","2 pièces"],["Tomate","4 pièces"],["Oignon","2 pièces"],["Ail","3 gousses"],["Huile d''olive","6 c. à soupe"],["Thym frais","4 branches"],["Sel, poivre","au goût"]]'::jsonb,
 '["Coupez tous les légumes en dés réguliers d''environ 1,5 cm.","Faites revenir l''oignon et l''ail dans l''huile d''olive à feu moyen, 5 minutes.","Ajoutez le poivron, faites cuire 5 minutes, puis l''aubergine et la courgette.","Incorporez les tomates et le thym, salez, poivrez.","Laissez mijoter à couvert 35 minutes en remuant de temps en temps.","Retirez le couvercle 10 minutes en fin de cuisson pour réduire le jus."]'::jsonb
),
('quiche-lorraine', 'Quiche lorraine', 'plat', 'tart', 'Pâte brisée, lardons fumés et appareil crémeux, sans fromage à l''origine.', 50, 6, 'Facile', 'La vraie recette lorraine ne contient pas de gruyère — mais personne ne vous en voudra d''en ajouter.',
 '[["Pâte brisée","1 rouleau"],["Lardons fumés","200 g"],["Œufs","3 pièces"],["Crème fraîche épaisse","20 cl"],["Lait","10 cl"],["Noix de muscade","1 pincée"],["Sel, poivre","au goût"]]'::jsonb,
 '["Préchauffez le four à 200 °C. Étalez la pâte dans un moule à tarte.","Faites revenir les lardons à sec 3 minutes, puis répartissez-les sur la pâte.","Fouettez les œufs, la crème, le lait, la muscade, le sel et le poivre.","Versez l''appareil sur les lardons.","Enfournez 30 à 35 minutes, jusqu''à ce que la surface soit dorée."]'::jsonb
),
('tarte-tatin', 'Tarte Tatin', 'dessert', 'tart', 'Pommes caramélisées renversées sur une pâte feuilletée croustillante.', 65, 6, 'Intermédiaire', 'Démoulez tant que c''est encore chaud : le caramel fige vite et colle au moule en refroidissant.',
 '[["Pommes (Reinette)","8 pièces"],["Sucre","150 g"],["Beurre demi-sel","80 g"],["Pâte feuilletée","1 rouleau"]]'::jsonb,
 '["Épluchez et coupez les pommes en quartiers épais.","Dans un moule allant au four, faites un caramel à sec avec le sucre.","Ajoutez le beurre hors du feu, puis disposez les pommes serrées, côté bombé vers le bas.","Faites cuire 15 minutes à feu doux sur la plaque de cuisson.","Recouvrez de pâte feuilletée en rentrant les bords, puis enfournez 25 minutes à 200 °C.","Laissez tiédir 10 minutes avant de démouler d''un geste sûr sur un plat."]'::jsonb
),
('coq-au-vin', 'Coq au vin', 'plat', 'pot', 'Poulet mijoté au vin rouge, lardons, champignons et petits oignons.', 100, 4, 'Intermédiaire', 'Un vin qu''on accepterait de boire fera toujours une meilleure sauce.',
 '[["Cuisses de poulet","6 pièces"],["Vin rouge corsé","75 cl"],["Lardons","150 g"],["Champignons de Paris","250 g"],["Petits oignons grelots","12 pièces"],["Carotte","2 pièces"],["Ail","3 gousses"],["Bouquet garni","1"],["Farine","2 c. à soupe"]]'::jsonb,
 '["Faites dorer les morceaux de poulet dans une cocotte, puis réservez.","Faites revenir les lardons, les oignons et les carottes dans la même cocotte.","Saupoudrez de farine, mélangez 1 minute, puis remettez le poulet.","Versez le vin, ajoutez l''ail et le bouquet garni, salez, poivrez.","Laissez mijoter à couvert 1 h 15 à feu doux.","Ajoutez les champignons 15 minutes avant la fin de cuisson."]'::jsonb
),
('crepes', 'Crêpes fines', 'dessert', 'crepe', 'La pâte de base à garder sous la main, sucrée ou salée.', 30, 4, 'Facile', 'Une pâte reposée donne des crêpes plus souples : ne sautez pas cette étape si vous avez le temps.',
 '[["Farine","250 g"],["Œufs","3 pièces"],["Lait","50 cl"],["Beurre fondu","50 g"],["Sucre","2 c. à soupe"],["Sel","1 pincée"]]'::jsonb,
 '["Mélangez la farine, le sucre et le sel dans un saladier.","Creusez un puits, ajoutez les œufs et fouettez en incorporant peu à peu le lait.","Ajoutez le beurre fondu, puis laissez reposer la pâte 30 minutes.","Faites cuire chaque crêpe 1 à 2 minutes par face dans une poêle chaude et légèrement beurrée."]'::jsonb
),
('soupe-oignon', 'Soupe à l''oignon gratinée', 'entrée', 'bowl', 'Oignons longuement caramélisés, croûtons et gruyère fondu.', 75, 4, 'Facile', 'La patience sur les oignons fait toute la différence : ne pressez pas la caramélisation.',
 '[["Oignons jaunes","6 pièces"],["Beurre","40 g"],["Bouillon de bœuf","1,2 l"],["Vin blanc sec","10 cl"],["Pain de campagne","8 tranches"],["Gruyère râpé","150 g"]]'::jsonb,
 '["Émincez finement les oignons.","Faites-les fondre dans le beurre à feu doux 35 à 40 minutes, jusqu''à belle coloration.","Déglacez au vin blanc, puis ajoutez le bouillon et laissez mijoter 20 minutes.","Répartissez la soupe dans des bols, couvrez de pain et de gruyère.","Passez sous le grill quelques minutes jusqu''à ce que le fromage gratine."]'::jsonb
),
('tarte-citron', 'Tarte au citron meringuée', 'dessert', 'tart', 'Crème citron acidulée sur pâte sablée, meringue légèrement dorée.', 80, 8, 'Intermédiaire', 'Zestez les citrons avant de les presser — l''inverse est nettement plus périlleux.',
 '[["Pâte sablée","1 fond de tarte"],["Citrons","4 pièces"],["Œufs","4 pièces"],["Sucre","180 g"],["Beurre","100 g"],["Blancs d''œufs (meringue)","3 pièces"],["Sucre (meringue)","90 g"]]'::jsonb,
 '["Faites cuire le fond de tarte à blanc 15 minutes à 180 °C.","Fouettez les œufs et le sucre, ajoutez le jus et le zeste de citron.","Faites épaissir au bain-marie en remuant, puis incorporez le beurre hors du feu.","Versez la crème sur le fond de tarte cuit et laissez refroidir.","Montez les blancs en neige avec le sucre pour une meringue brillante.","Recouvrez la tarte de meringue et dorez au chalumeau ou sous le grill."]'::jsonb
),
('confit-oignons', 'Confit d''oignons maison', 'entrée', 'jar', 'Un condiment sucré-salé qui accompagne charcuteries et fromages.', 60, 1, 'Facile', 'Se conserve environ deux semaines au réfrigérateur dans un bocal propre.',
 '[["Oignons rouges","1 kg"],["Sucre roux","100 g"],["Vinaigre balsamique","8 cl"],["Beurre","30 g"],["Sel","1 pincée"]]'::jsonb,
 '["Émincez finement les oignons.","Faites-les suer dans le beurre à feu doux 10 minutes.","Ajoutez le sucre et laissez caraméliser légèrement 10 minutes.","Versez le vinaigre, salez, et laissez mijoter à découvert 30 minutes en remuant régulièrement.","Mettez en pot une fois la texture bien confite et laissez refroidir avant de fermer."]'::jsonb
);
```

- [ ] **Step 2: Exécuter le script dans Supabase**

Dans le tableau de bord Supabase du projet, ouvrir **SQL Editor** → **New query**, coller tout le contenu de `supabase/schema.sql`, cliquer **Run**.

Résultat attendu : message `Success. No rows returned` (les `create table`/`create policy` ne renvoient rien), sans erreur.

- [ ] **Step 3: Vérifier dans le Table Editor**

Aller dans **Table Editor** : les 4 tables `recipes`, `favorites`, `cart_state`, `invite_codes` doivent apparaître dans la liste de gauche. Ouvrir `recipes` : 8 lignes doivent être présentes (`ratatouille`, `quiche-lorraine`, `tarte-tatin`, `coq-au-vin`, `crepes`, `soupe-oignon`, `tarte-citron`, `confit-oignons`).

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add Supabase schema: recipes/favorites/cart_state/invite_codes with RLS"
```

---

### Task 2: Créer les deux comptes fondateurs

**Files:** aucun (étape manuelle dans le tableau de bord Supabase, rien à committer)

**Interfaces:**
- Produces: deux comptes email/mot de passe dans Supabase Auth, utilisés pour vérifier l'écran de connexion à la Task 6.

- [ ] **Step 1: Créer le premier compte**

Dans le tableau de bord Supabase → **Authentication** → **Users** → **Add user** → **Create new user**. Renseigner l'email et un mot de passe. Cocher **Auto Confirm User** (pour ne pas avoir besoin de cliquer un lien de confirmation par email).

- [ ] **Step 2: Créer le second compte**

Répéter l'étape 1 avec l'email de la seconde personne.

- [ ] **Step 3: Vérifier**

La liste **Authentication → Users** doit afficher exactement 2 comptes, tous deux avec la colonne "Email Confirmed" cochée/verte.

---

### Task 3: Client Supabase (`js/supabase-client.js`)

**Files:**
- Create: `js/supabase-client.js`

**Interfaces:**
- Produces: `supabase` (export nommé) — instance du client `@supabase/supabase-js`, importée par `js/auth.js` (Task 5) et par tous les modules de synchronisation d'un plan ultérieur.

- [ ] **Step 1: Écrire le module**

```js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://bmotbwubruvsrflaufis.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6tJ6DS20TgSxEgWqKKpXJA_G1pkybFs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
```

- [ ] **Step 2: Vérifier que le module se charge sans erreur**

Ajouter temporairement `import "./supabase-client.js";` en première ligne de `js/main.js`, lancer `lancer-le-carnet.bat` (ou `npx serve .`), ouvrir `http://localhost:3000`, ouvrir la console du navigateur (F12).

Résultat attendu : aucune erreur dans la console (le module s'importe, le client se crée). Retirer ensuite cette ligne temporaire de `js/main.js` — elle sera réintroduite proprement à la Task 6.

- [ ] **Step 3: Commit**

```bash
git add js/supabase-client.js
git commit -m "Add Supabase client module"
```

---

### Task 4: Marquage HTML/CSS de l'écran de connexion

**Files:**
- Modify: `index.html`
- Modify: `style.css`

**Interfaces:**
- Produces: structure DOM `#authView`/`#authScroll` (utilisée par `js/auth.js` à la Task 5) et les classes CSS `.auth-view`/`.auth-card`.
- Consumes: les classes existantes `.detail-view`, `.add-view`, `.add-form`, `.field`, `.add-error`, `.btn-primary` (déjà présentes dans `style.css`, réutilisées telles quelles).

- [ ] **Step 1: Ajouter la vue dans `index.html`**

Dans `index.html`, juste après la fermeture de `</section>` de `panierView` (ligne 99) et avant le bouton `addFab` (ligne 101), insérer :

```html
<!-- ===== VUE CONNEXION (plein écran, avant tout accès à l'app) ===== -->
<section id="authView" class="detail-view add-view auth-view" aria-hidden="true">
  <div class="detail-scroll" id="authScroll"></div>
</section>
```

- [ ] **Step 2: Ajouter le bouton de déconnexion dans le tiroir**

Dans `index.html`, dans `<div class="drawer-nav">`, juste avant la fermeture `</div>` (ligne 139, après `<input type="file" id="importFileInput" ...>`), ajouter :

```html
    <div class="drawer-divider"></div>
    <button class="drawer-item" id="navLogoutBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19" fill="none"><path d="M15 17l5-5-5-5M20 12H9M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      Se déconnecter
    </button>
```

- [ ] **Step 3: Ajouter le CSS de centrage dans `style.css`**

À la fin de `style.css`, ajouter :

```css
/* ---- vue connexion ---- */
.auth-view .detail-scroll{
  display:flex; align-items:center; justify-content:center;
  min-height:100%; padding: 24px;
}
.auth-card{ width:100%; max-width:360px; text-align:center; }
.auth-card h2{ font-family: var(--font-display); font-style:italic; font-size:1.7rem; margin-bottom:4px; }
.auth-sub{ color: var(--ink-soft); font-size:.9rem; margin-bottom:22px; }
.auth-card .add-form{ padding:0; text-align:left; }
.auth-switch{ margin-top:16px; font-size:.85rem; color: var(--ink-soft); text-align:center; }
.auth-switch button{ background:none; border:none; color: var(--emerald-dark); font-weight:600; cursor:pointer; padding:0; text-decoration:underline; }
```

- [ ] **Step 4: Vérifier visuellement**

Dans la console du navigateur (F12), exécuter :
```js
document.getElementById("authView").classList.add("is-open")
```
Résultat attendu : un écran plein écran apparaît, vide pour l'instant (le contenu HTML sera injecté par `js/auth.js` à la Task 5) mais l'overlay `.detail-view` doit bien se déclencher sans erreur console.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css
git commit -m "Add auth view markup and centering styles"
```

---

### Task 5: Logique de connexion (`js/auth.js`)

**Files:**
- Create: `js/auth.js`

**Interfaces:**
- Consumes: `supabase` from `./supabase-client.js` (Task 3); DOM element `#authView`/`#authScroll` from `index.html` (Task 4).
- Produces: `initAuth(onReady)` — appelle `onReady()` (sans argument) chaque fois qu'une session valide existe ou vient d'être établie, et affiche l'écran de connexion sinon. `logout()` — déconnecte l'utilisateur courant. Les deux sont importées par `js/main.js` (Task 6).

- [ ] **Step 1: Écrire le module**

```js
import { supabase } from "./supabase-client.js";

const authView = document.getElementById("authView");
const authScroll = document.getElementById("authScroll");

export function initAuth(onReady){
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      authView.classList.remove("is-open");
      authView.setAttribute("aria-hidden", "true");
      document.body.classList.remove("auth-locked");
      onReady();
    } else {
      renderLoginForm();
      authView.classList.add("is-open");
      authView.setAttribute("aria-hidden", "false");
      document.body.classList.add("auth-locked");
    }
  });
}

export function logout(){
  supabase.auth.signOut();
}

function renderLoginForm(){
  authScroll.innerHTML = `
    <div class="auth-card">
      <h2>Le Carnet</h2>
      <p class="auth-sub">Connecte-toi pour accéder à tes recettes.</p>
      <form id="loginForm" class="add-form" novalidate>
        <div class="field">
          <label for="loginEmail">Email</label>
          <input id="loginEmail" type="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="loginPassword">Mot de passe</label>
          <input id="loginPassword" type="password" autocomplete="current-password" required>
        </div>
        <p id="loginError" class="add-error" hidden></p>
        <div class="add-actions">
          <button type="submit" class="btn-primary">Se connecter</button>
        </div>
      </form>
    </div>
  `;

  const form = authScroll.querySelector("#loginForm");
  const errorEl = authScroll.querySelector("#loginError");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const email = form.querySelector("#loginEmail").value.trim();
    const password = form.querySelector("#loginPassword").value;
    const submitBtn = form.querySelector(".btn-primary");
    submitBtn.disabled = true;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    submitBtn.disabled = false;
    if (error) {
      errorEl.textContent = "Email ou mot de passe incorrect.";
      errorEl.hidden = false;
    }
  });
}
```

- [ ] **Step 2: Ajouter le style du verrouillage dans `style.css`**

À la fin de `style.css`, ajouter :

```css
body.auth-locked .site-header,
body.auth-locked #addFab{ display:none; }
```

- [ ] **Step 3: Commit**

```bash
git add js/auth.js style.css
git commit -m "Add login screen logic (js/auth.js)"
```

---

### Task 6: Brancher l'authentification dans `js/main.js`

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `initAuth`, `logout` from `./auth.js` (Task 5); `navLogoutBtn` (nouvel élément DOM ajouté à la Task 4).

- [ ] **Step 1: Ajouter l'import et l'élément DOM**

Dans `js/main.js`, ajouter aux imports en haut du fichier (à la suite des imports existants) :

```js
import { initAuth, logout } from "./auth.js";
```

- [ ] **Step 2: Récupérer le bouton de déconnexion**

`navLogoutBtn` n'existe pas encore dans `js/dom.js` — l'ajouter là-bas d'abord.

Dans `js/dom.js`, juste après la ligne `export const navImportBtn = document.getElementById("navImportBtn");`, ajouter :

```js
export const navLogoutBtn = document.getElementById("navLogoutBtn");
```

Puis dans `js/main.js`, remplacer le bloc d'import existant :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navExportBtn, navImportBtn, importFileInput,
  detailView, addView, panierView
} from "./dom.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navExportBtn, navImportBtn, importFileInput,
  navLogoutBtn,
  detailView, addView, panierView
} from "./dom.js";
```

- [ ] **Step 3: Remplacer le démarrage direct par le démarrage conditionné par l'authentification**

Dans `js/main.js`, repérer les trois dernières lignes du fichier :

```js
/* ---- démarrage ---- */
renderHero();
render();
updateCartBadge();
```

Les remplacer par :

```js
/* ---- démarrage (attend une session valide) ---- */
initAuth(() => {
  renderHero();
  render();
  updateCartBadge();
});

navLogoutBtn.addEventListener("click", () => {
  closeDrawer();
  logout();
});
```

- [ ] **Step 4: Vérifier dans le navigateur**

Lancer `lancer-le-carnet.bat`. Résultat attendu :
1. L'écran de connexion s'affiche immédiatement, l'app (grille de recettes, en-tête) n'est pas visible/accessible derrière.
2. Se connecter avec l'un des deux comptes créés à la Task 2 → l'écran de connexion disparaît, l'app apparaît normalement (grille de 8 recettes, recherche, favoris, panier, minuteur — tout doit fonctionner exactement comme avant, rien n'a changé côté données).
3. Recharger la page (F5) → reste connecté, pas besoin de se reconnecter (session persistée automatiquement par Supabase).
4. Ouvrir le tiroir de navigation, cliquer "Se déconnecter" → retour à l'écran de connexion.
5. Tester un mauvais mot de passe → message d'erreur "Email ou mot de passe incorrect." affiché sur le formulaire, pas d'exception dans la console.

Vérifier la console du navigateur (F12) à chaque étape : aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add js/main.js js/dom.js
git commit -m "Gate the app behind Supabase authentication"
```

---

### Task 7: Mettre à jour le service worker

**Files:**
- Modify: `sw.js`

**Interfaces:** aucune (fichier de configuration du cache, pas de code applicatif).

- [ ] **Step 1: Ajouter les nouveaux fichiers à `APP_SHELL` et incrémenter `CACHE_NAME`**

Dans `sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/main.js",
  "./js/dom.js",
  "./js/ui.js",
  "./js/recipes-data.js",
  "./js/recipes-store.js",
  "./js/cart.js",
  "./js/timer.js",
  "./js/grid.js",
  "./js/detail.js",
  "./js/add-form.js",
  "./js/photos.js",
  "./js/quantity.js",
  "./js/icons.js",
  "./js/utils.js",
  "./fonts/caveat.woff2",
  "./fonts/dm-sans.woff2",
  "./fonts/fraunces.woff2",
  "./fonts/fraunces-italic.woff2",
  "./icons/icon.svg"
];
```

par :

```js
const CACHE_NAME = "carnet-cache-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/main.js",
  "./js/dom.js",
  "./js/ui.js",
  "./js/recipes-data.js",
  "./js/recipes-store.js",
  "./js/cart.js",
  "./js/timer.js",
  "./js/grid.js",
  "./js/detail.js",
  "./js/add-form.js",
  "./js/photos.js",
  "./js/quantity.js",
  "./js/icons.js",
  "./js/utils.js",
  "./js/supabase-client.js",
  "./js/auth.js",
  "./fonts/caveat.woff2",
  "./fonts/dm-sans.woff2",
  "./fonts/fraunces.woff2",
  "./fonts/fraunces-italic.woff2",
  "./icons/icon.svg"
];
```

Note : `https://esm.sh/@supabase/supabase-js@2` n'est volontairement PAS ajouté à `APP_SHELL` — c'est une ressource cross-origin que le service worker actuel (stratégie cache-first avec mise en cache au premier fetch réussi) mettra en cache automatiquement dès la première visite en ligne, comme il le fait déjà pour les polices. Sans connexion internet lors de la toute première visite, la connexion ne serait de toute façon pas possible.

- [ ] **Step 2: Vérifier**

Relancer `lancer-le-carnet.bat`, ouvrir la console (F12) → onglet Application/Stockage → Cache Storage. Résultat attendu : un cache nommé `carnet-cache-v4` existe, contenant `js/supabase-client.js` et `js/auth.js` en plus des fichiers précédents. L'ancien cache `carnet-cache-v3` doit avoir disparu (nettoyé automatiquement).

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "Cache new auth modules in service worker, bump to v4"
```

---

### Task 8: Vérification complète et push

**Files:** aucun.

- [ ] **Step 1: Parcours complet dans le navigateur**

Avec `lancer-le-carnet.bat` lancé :
1. Ouvrir dans une fenêtre normale : écran de connexion apparaît.
2. Se connecter avec le compte 1 → app accessible, tester recherche/filtre/favoris/panier/minuteur/ajout de recette (doivent tous fonctionner comme avant le début de ce plan).
3. Ouvrir un second onglet en navigation privée, se connecter avec le compte 2 → l'app fonctionne indépendamment (chaque session a ses propres favoris/panier en `localStorage`, comme aujourd'hui — la Task suivante d'un futur plan les fera venir de Supabase).
4. Se déconnecter du compte 1 → écran de connexion revient, le compte 2 (autre onglet) reste connecté séparément.
5. Couper la connexion réseau (mode avion ou DevTools → Network → Offline), recharger la page sur une session déjà connectée → l'app doit continuer à s'afficher (cache du service worker), la connexion Supabase pour une nouvelle tentative de login échouerait proprement si on se déconnectait hors-ligne (attendu, pas un bug — la vraie gestion hors-ligne des données arrive dans le plan suivant).

- [ ] **Step 2: Vérifier qu'aucune régression n'est visible en console**

Aucune erreur JavaScript dans la console du navigateur sur l'ensemble du parcours ci-dessus.

- [ ] **Step 3: Push**

```bash
git push
```
