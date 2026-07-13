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
