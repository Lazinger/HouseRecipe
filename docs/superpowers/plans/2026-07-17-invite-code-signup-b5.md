# Inscription par code d'invitation (Plan B5) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un nouveau membre du foyer peut créer son propre compte depuis l'app, protégé par un code d'invitation à usage unique généré uniquement par le compte principal — plus besoin de créer les comptes manuellement dans le tableau de bord Supabase.

**Architecture:** La table `invite_codes` (déjà créée, RLS activé, zéro policy) reste verrouillée ; deux fonctions Postgres `SECURITY DEFINER` (`generate_invite_code`, `redeem_invite_code`) contournent RLS de façon contrôlée. Le code d'invitation est transporté dans les métadonnées du compte Supabase dès l'inscription (`pending_invite_code`), pour survivre à l'attente de confirmation email même si celle-ci se termine sur un autre appareil ; il est validé (échangé contre `used_by`/`used_at`) à la première connexion réussie après confirmation.

**Tech Stack:** Fonctions RPC Supabase (`supabase.rpc(...)`), `supabase.auth.signUp()`.

**Ce que ce plan NE fait PAS** : envoi automatique du code par email/SMS, expiration des codes, mot de passe oublié, blindage serveur empêchant totalement l'inscription sans code (Auth Hooks) — le gate reste côté application, décision déjà validée dans le design.

## Global Constraints

- Zéro étape de build, texte en français, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Email du compte autorisé à générer des codes, codé en dur : `jerem.r30@gmail.com`.
- Un compte créé avec un code invalide/déjà utilisé reste utilisable — le gate est une UX, pas un verrou technique (décision validée).
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v12`).
- Les fichiers du site sont dans `public/`.

---

### Task 1: Fonctions RPC Supabase (`supabase/schema.sql`)

**Files:**
- Modify: `supabase/schema.sql` (ajout en fin de fichier)

**Interfaces:**
- Produces: fonctions RPC `generate_invite_code()` et `redeem_invite_code(input_code text)`, nécessaires aux Tasks 2-4 (l'utilisateur doit exécuter ce SQL manuellement avant que ces tâches puissent être testées en direct — voir Step 2).

- [ ] **Step 1: Ajouter les deux fonctions**

À la fin de `supabase/schema.sql`, ajouter :

```sql

-- ===== Fonctions RPC pour l'inscription par code d'invitation =====
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.email() is distinct from 'jerem.r30@gmail.com' then
    raise exception 'not authorized';
  end if;
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into public.invite_codes (code) values (new_code);
  return new_code;
end;
$$;

create or replace function public.redeem_invite_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.invite_codes
    set used_by = auth.uid(), used_at = now()
    where code = input_code and used_by is null;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
```

- [ ] **Step 2: Note pour l'utilisateur (étape manuelle, hors de portée d'un subagent)**

Ce SQL doit être exécuté dans le tableau de bord Supabase du projet : **SQL Editor** → **New query** → coller uniquement le nouveau bloc ci-dessus → **Run**. Résultat attendu : `Success. No rows returned`.

Un subagent implémenteur ne peut pas effectuer cette étape (accès au tableau de bord Supabase requis) — il doit simplement committer le fichier modifié et signaler dans son rapport que cette étape manuelle reste à faire par l'utilisateur avant toute vérification live des tâches suivantes.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add RPC functions for invite-code generation and redemption"
```

---

### Task 2: Formulaire d'inscription (`js/auth.js`)

**Files:**
- Modify: `public/js/auth.js` (réécriture complète du fichier)

**Interfaces:**
- Consumes: `supabase` from `./supabase-client.js` (déjà en place).
- Produces: aucune nouvelle fonction exportée — `initAuth`, `logout` gardent leurs signatures exactes. Le comportement observable change : l'écran de connexion affiche désormais un lien vers un formulaire d'inscription.

- [ ] **Step 1: Remplacer tout le contenu du fichier**

Remplacer l'intégralité de `public/js/auth.js` par :

```js
import { supabase } from "./supabase-client.js";

const authView = document.getElementById("authView");
const authScroll = document.getElementById("authScroll");

function unlock(onReady){
  authView.classList.remove("is-open");
  authView.setAttribute("aria-hidden", "true");
  document.body.classList.remove("auth-locked");
  onReady();
}

function lock(){
  renderLoginForm();
  authView.classList.add("is-open");
  authView.setAttribute("aria-hidden", "false");
  document.body.classList.add("auth-locked");
}

function hasStoredSession(){
  return Object.keys(localStorage).some(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
}

export function initAuth(onReady){
  let unlocked = false;

  /* Hors-ligne, Supabase peut échouer à revalider/rafraîchir le jeton via
     le réseau et ne jamais confirmer la session — sans ce court-circuit,
     l'app resterait bloquée sur l'écran de connexion alors qu'une session
     valide est déjà en localStorage. On fait confiance au jeton stocké. */
  if (!navigator.onLine && hasStoredSession()) {
    unlocked = true;
    unlock(onReady);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      if (!unlocked) { unlocked = true; unlock(onReady); }
    } else if (navigator.onLine) {
      unlocked = false;
      lock();
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
      <p class="auth-switch">Pas encore de compte ? <button type="button" id="showSignupBtn">Créer un compte</button></p>
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

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        errorEl.textContent = "Email ou mot de passe incorrect.";
        errorEl.hidden = false;
      }
    } catch {
      errorEl.textContent = "Connexion impossible. Réessaie.";
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  authScroll.querySelector("#showSignupBtn").addEventListener("click", renderSignupForm);
}

function renderSignupForm(){
  authScroll.innerHTML = `
    <div class="auth-card">
      <h2>Le Carnet</h2>
      <p class="auth-sub">Crée ton compte pour rejoindre le foyer.</p>
      <form id="signupForm" class="add-form" novalidate>
        <div class="field-row">
          <div class="field">
            <label for="signupFirstName">Prénom</label>
            <input id="signupFirstName" type="text" placeholder="Prénom" required>
          </div>
          <div class="field">
            <label for="signupLastName">Nom</label>
            <input id="signupLastName" type="text" placeholder="Nom" required>
          </div>
        </div>
        <div class="field">
          <label for="signupEmail">Email</label>
          <input id="signupEmail" type="email" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="signupPassword">Mot de passe</label>
          <input id="signupPassword" type="password" autocomplete="new-password" required>
        </div>
        <div class="field">
          <label for="signupCode">Code d'invitation</label>
          <input id="signupCode" type="text" autocomplete="off" required>
        </div>
        <p id="signupError" class="add-error" hidden></p>
        <div class="add-actions">
          <button type="submit" class="btn-primary">Créer mon compte</button>
        </div>
      </form>
      <p class="auth-switch">Déjà un compte ? <button type="button" id="showLoginBtn">Se connecter</button></p>
    </div>
  `;

  const form = authScroll.querySelector("#signupForm");
  const errorEl = authScroll.querySelector("#signupError");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const first_name = form.querySelector("#signupFirstName").value.trim();
    const last_name = form.querySelector("#signupLastName").value.trim();
    const email = form.querySelector("#signupEmail").value.trim();
    const password = form.querySelector("#signupPassword").value;
    const pending_invite_code = form.querySelector("#signupCode").value.trim();
    const submitBtn = form.querySelector(".btn-primary");
    submitBtn.disabled = true;

    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { first_name, last_name, pending_invite_code } }
      });
      if (error) {
        errorEl.textContent = "Inscription impossible. Vérifie tes informations.";
        errorEl.hidden = false;
      } else {
        renderSignupConfirmation();
      }
    } catch {
      errorEl.textContent = "Inscription impossible. Réessaie.";
      errorEl.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  authScroll.querySelector("#showLoginBtn").addEventListener("click", renderLoginForm);
}

function renderSignupConfirmation(){
  authScroll.innerHTML = `
    <div class="auth-card">
      <h2>Le Carnet</h2>
      <p class="auth-sub">Compte créé ! Vérifie tes emails pour confirmer ton adresse, puis reviens te connecter.</p>
      <div class="add-actions">
        <button type="button" id="backToLoginBtn" class="btn-primary">Retour à la connexion</button>
      </div>
    </div>
  `;
  authScroll.querySelector("#backToLoginBtn").addEventListener("click", renderLoginForm);
}
```

- [ ] **Step 2: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois. Aucune erreur console au chargement. Sur l'écran de connexion, cliquer "Créer un compte" → le formulaire d'inscription s'affiche. Cliquer "Se connecter" → revient au formulaire de connexion. Si un compte de test est disponible, remplir le formulaire d'inscription avec un code bidon (ex. "test1234") et soumettre → doit afficher l'écran "Compte créé ! Vérifie tes emails...", et un email de confirmation doit être reçu à l'adresse utilisée. Si aucun compte de test n'est disponible pour ce test précis, relecture statique attentive et le signaler dans le rapport (DONE_WITH_CONCERNS).

- [ ] **Step 3: Commit**

```bash
git add public/js/auth.js
git commit -m "Add signup form with invite code field"
```

---

### Task 3: Validation du code à la première connexion (`js/auth.js`)

**Files:**
- Modify: `public/js/auth.js`

**Interfaces:**
- Consumes: `showToast` from `./ui.js` (nouveau) ; RPC `redeem_invite_code` (Task 1).
- `initAuth(onReady)` garde sa signature exacte et son comportement observable pour un compte sans code en attente (les deux comptes fondateurs, ou un compte ayant déjà validé son code) — seul un compte avec `pending_invite_code` dans ses métadonnées déclenche un appel RPC supplémentaire, en arrière-plan, sans bloquer `unlock(onReady)`.

- [ ] **Step 1: Ajouter l'import**

Dans `public/js/auth.js`, remplacer :

```js
import { supabase } from "./supabase-client.js";
```

par :

```js
import { supabase } from "./supabase-client.js";
import { showToast } from "./ui.js";
```

- [ ] **Step 2: Brancher la validation dans `initAuth` et ajouter `redeemPendingInviteCode`**

Remplacer :

```js
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      if (!unlocked) { unlocked = true; unlock(onReady); }
    } else if (navigator.onLine) {
      unlocked = false;
      lock();
    }
  });
}
```

par :

```js
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      if (!unlocked) {
        unlocked = true;
        redeemPendingInviteCode(session);
        unlock(onReady);
      }
    } else if (navigator.onLine) {
      unlocked = false;
      lock();
    }
  });
}

async function redeemPendingInviteCode(session){
  const code = session.user.user_metadata?.pending_invite_code;
  if (!code) return;
  try {
    const { data, error } = await supabase.rpc("redeem_invite_code", { input_code: code });
    if (error || !data) {
      showToast("Code d'invitation invalide.");
    } else {
      showToast("Code d'invitation validé, bienvenue !");
    }
  } catch {
    showToast("Code d'invitation invalide.");
  } finally {
    supabase.auth.updateUser({ data: { pending_invite_code: null } }).catch(() => {});
  }
}
```

Notes pour l'implémenteur :
- `redeemPendingInviteCode` n'est volontairement pas `await`-ée avant `unlock(onReady)` — la validation du code se fait en arrière-plan pendant que le reste de l'app démarre normalement, elle ne doit pas retarder le déverrouillage.
- Le `finally` efface `pending_invite_code` des métadonnées dans tous les cas (succès ou échec), pour qu'une reconnexion ultérieure du même compte ne retente jamais la validation.

- [ ] **Step 3: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, confirmer aucune erreur console (l'import `showToast` depuis `ui.js` ne doit provoquer aucun problème de chargement — `ui.js` n'importe pas `auth.js`, donc pas de risque de cycle). Si un compte de test avec un code en attente est disponible (suite au Step 2 de la Task 2 et une confirmation email effectuée), se connecter pour la première fois après confirmation → un toast doit apparaître ("bienvenue" ou "code invalide" selon le code utilisé), et dans Supabase la ligne `invite_codes` correspondante doit avoir `used_by`/`used_at` renseignés si le code était valide. Si aucun compte de test n'est disponible pour ce test précis, relecture statique + signalement (DONE_WITH_CONCERNS).

- [ ] **Step 4: Commit**

```bash
git add public/js/auth.js
git commit -m "Redeem pending invite code on first successful login"
```

---

### Task 4: Génération de code (`js/profile.js`)

**Files:**
- Modify: `public/js/profile.js`

**Interfaces:**
- Consumes: RPC `generate_invite_code` (Task 1).
- `renderProfile()` (non exportée) garde son comportement observable pour tout compte dont l'email n'est pas `jerem.r30@gmail.com` — aucune section supplémentaire n'apparaît pour eux.

- [ ] **Step 1: Ajouter la section admin conditionnelle**

Dans `public/js/profile.js`, remplacer :

```js
async function renderProfile(){
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const meta = user?.user_metadata || {};

  profileScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="profileMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="back-btn" id="profileBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
      </div>
      <h2>Mon compte</h2>
    </div>
    <form id="profileForm" class="add-form" novalidate>
      <div class="field">
        <label for="profileEmail">Email</label>
        <input id="profileEmail" type="email" value="${escapeAttr(user?.email || "")}" disabled>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="profileFirstName">Prénom</label>
          <input id="profileFirstName" type="text" placeholder="Prénom" value="${escapeAttr(meta.first_name || "")}">
        </div>
        <div class="field">
          <label for="profileLastName">Nom</label>
          <input id="profileLastName" type="text" placeholder="Nom" value="${escapeAttr(meta.last_name || "")}">
        </div>
      </div>
      <div class="add-actions">
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
  `;

  profileScroll.querySelector("#profileMenuBtn").addEventListener("click", openDrawer);
  profileScroll.querySelector("#profileBackBtn").addEventListener("click", closeProfile);

  profileScroll.querySelector("#profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const first_name = profileScroll.querySelector("#profileFirstName").value.trim();
    const last_name = profileScroll.querySelector("#profileLastName").value.trim();
    const submitBtn = profileScroll.querySelector(".btn-primary");
    submitBtn.disabled = true;

    try {
      const { error } = await supabase.auth.updateUser({ data: { first_name, last_name } });
      if (error) {
        showToast("Impossible d'enregistrer le profil");
      } else {
        await updateAccountBadge();
        showToast("Profil enregistré");
        closeProfile();
      }
    } catch {
      showToast("Impossible d'enregistrer le profil");
    } finally {
      submitBtn.disabled = false;
    }
  });
}
```

par :

```js
async function renderProfile(){
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const meta = user?.user_metadata || {};
  const isAdmin = user?.email === "jerem.r30@gmail.com";

  profileScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="profileMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <button class="back-btn" id="profileBackBtn" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Retour
        </button>
      </div>
      <h2>Mon compte</h2>
    </div>
    <form id="profileForm" class="add-form" novalidate>
      <div class="field">
        <label for="profileEmail">Email</label>
        <input id="profileEmail" type="email" value="${escapeAttr(user?.email || "")}" disabled>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="profileFirstName">Prénom</label>
          <input id="profileFirstName" type="text" placeholder="Prénom" value="${escapeAttr(meta.first_name || "")}">
        </div>
        <div class="field">
          <label for="profileLastName">Nom</label>
          <input id="profileLastName" type="text" placeholder="Nom" value="${escapeAttr(meta.last_name || "")}">
        </div>
      </div>
      <div class="add-actions">
        <button type="submit" class="btn-primary">Enregistrer</button>
      </div>
    </form>
    ${isAdmin ? `
      <div class="add-form">
        <div class="field">
          <label>Ajouter un membre du foyer</label>
          <button type="button" id="generateInviteBtn" class="btn-primary">Générer un code d'invitation</button>
          <p id="inviteCodeResult" class="auth-sub" hidden></p>
        </div>
      </div>
    ` : ""}
  `;

  profileScroll.querySelector("#profileMenuBtn").addEventListener("click", openDrawer);
  profileScroll.querySelector("#profileBackBtn").addEventListener("click", closeProfile);

  profileScroll.querySelector("#profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const first_name = profileScroll.querySelector("#profileFirstName").value.trim();
    const last_name = profileScroll.querySelector("#profileLastName").value.trim();
    const submitBtn = profileScroll.querySelector(".btn-primary");
    submitBtn.disabled = true;

    try {
      const { error } = await supabase.auth.updateUser({ data: { first_name, last_name } });
      if (error) {
        showToast("Impossible d'enregistrer le profil");
      } else {
        await updateAccountBadge();
        showToast("Profil enregistré");
        closeProfile();
      }
    } catch {
      showToast("Impossible d'enregistrer le profil");
    } finally {
      submitBtn.disabled = false;
    }
  });

  if (isAdmin) {
    profileScroll.querySelector("#generateInviteBtn").addEventListener("click", async () => {
      const btn = profileScroll.querySelector("#generateInviteBtn");
      const resultEl = profileScroll.querySelector("#inviteCodeResult");
      btn.disabled = true;
      try {
        const { data: code, error } = await supabase.rpc("generate_invite_code");
        resultEl.textContent = (error || !code) ? "Impossible de générer un code." : `Code généré : ${code}`;
        resultEl.hidden = false;
      } catch {
        resultEl.textContent = "Impossible de générer un code.";
        resultEl.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
  }
}
```

- [ ] **Step 2: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, confirmer aucune erreur console. Si un compte de test est disponible : connecté avec un compte dont l'email n'est pas `jerem.r30@gmail.com`, ouvrir "Mon compte" → la section "Ajouter un membre du foyer" ne doit PAS apparaître. Connecté avec le compte `jerem.r30@gmail.com` (si accessible) → la section apparaît, cliquer "Générer un code d'invitation" → un code s'affiche, et une nouvelle ligne apparaît dans `invite_codes` côté Supabase. Si aucun compte de test n'est disponible, relecture statique + signalement (DONE_WITH_CONCERNS).

- [ ] **Step 3: Commit**

```bash
git add public/js/profile.js
git commit -m "Add invite code generation for the primary account"
```

---

### Task 5: Mettre à jour le service worker

**Files:**
- Modify: `public/sw.js`

Aucun nouveau fichier n'est ajouté à `APP_SHELL` (`js/auth.js` et `js/profile.js` y sont déjà listés) — seul leur contenu a changé, donc le cache doit être invalidé.

- [ ] **Step 1: Incrémenter `CACHE_NAME`**

Dans `public/sw.js`, remplacer :

```js
const CACHE_NAME = "carnet-cache-v12";
```

par :

```js
const CACHE_NAME = "carnet-cache-v13";
```

- [ ] **Step 2: Vérifier**

Recharger deux fois. DevTools → Application → Cache Storage doit montrer `carnet-cache-v13` (l'ancien `v12` disparu).

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "Bump cache version for invite-code signup"
```

---

### Task 6: Vérification complète et push

**Files:** aucun.

- [ ] **Step 1: Confirmer que la Task 1 a été appliquée**

Vérifier dans le tableau de bord Supabase → **Database** → **Functions** que `generate_invite_code` et `redeem_invite_code` existent. Si ce n'est pas le cas, exécuter le SQL de la Task 1 maintenant (voir Task 1, Step 2).

- [ ] **Step 2: Générer un code**

Connecté avec le compte `jerem.r30@gmail.com`, ouvrir "Mon compte" → générer un code d'invitation → noter le code affiché.

- [ ] **Step 3: Inscription avec un code valide**

Depuis l'écran de connexion (déconnecté, ou navigation privée), cliquer "Créer un compte", remplir prénom/nom/email/mot de passe avec le code noté à l'étape précédente → soumettre → écran "Compte créé, vérifie tes emails" affiché. Ouvrir l'email de confirmation reçu, cliquer le lien → l'app doit établir une session automatiquement et afficher un toast de bienvenue. Vérifier dans Supabase → table `invite_codes` que la ligne du code utilisé a bien `used_by`/`used_at` renseignés.

- [ ] **Step 4: Accès aux données partagées**

Le nouveau compte doit voir les mêmes recettes que les comptes existants (RLS déjà partagé, aucun changement attendu ici — juste une confirmation que le nouveau compte fonctionne normalement).

- [ ] **Step 5: Code invalide**

Se déconnecter, créer un second compte de test avec un code inventé (jamais généré) → l'inscription doit tout de même réussir (comportement accepté), mais après confirmation email et première connexion, un toast "Code d'invitation invalide" doit apparaître, et aucune ligne `invite_codes` ne doit référencer ce compte.

- [ ] **Step 6: Génération restreinte**

Connecté avec le nouveau compte créé à la Task 6 Step 3 (pas `jerem.r30@gmail.com`), ouvrir "Mon compte" → la section de génération de code ne doit pas apparaître.

- [ ] **Step 7: Vérifier l'absence d'erreurs console** sur tout le parcours ci-dessus.

- [ ] **Step 8: Push**

```bash
git push
```
