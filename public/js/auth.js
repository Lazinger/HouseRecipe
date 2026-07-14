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
}
