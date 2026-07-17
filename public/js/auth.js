import { supabase } from "./supabase-client.js";
import { showToast } from "./ui.js";

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
      const { data: codeValid, error: codeError } = await supabase.rpc("check_invite_code", { input_code: pending_invite_code });
      if (codeError || !codeValid) {
        errorEl.textContent = "Code d'invitation invalide.";
        errorEl.hidden = false;
        return;
      }

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
