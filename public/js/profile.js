import { supabase } from "./supabase-client.js";
import { accountIcon, syncBadge, profileView, profileScroll } from "./dom.js";
import { escapeAttr } from "./utils.js";
import { showToast, openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
import { onQueueChange, getQueueSize } from "./write-queue.js";

const PERSON_ICON = `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

function updateSyncBadge(size){
  syncBadge.hidden = size === 0;
}
onQueueChange(updateSyncBadge);

export async function initSyncBadge(){
  updateSyncBadge(await getQueueSize());
}

function initials(firstName, lastName){
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  return ((f[0] || "") + (l[0] || "")).toUpperCase();
}

export async function updateAccountBadge(){
  const { data } = await supabase.auth.getUser();
  const meta = data?.user?.user_metadata || {};
  const label = initials(meta.first_name, meta.last_name);
  if (label) {
    accountIcon.textContent = label;
    accountIcon.classList.add("has-initials");
  } else {
    accountIcon.innerHTML = PERSON_ICON;
    accountIcon.classList.remove("has-initials");
  }
}

export async function openProfile(){
  await renderProfile();
  profileView.classList.add("is-open");
  profileView.setAttribute("aria-hidden", "false");
  profileScroll.scrollTop = 0;
  syncBodyScrollLock();
  openSheetBackdrop();
  ensureSheetHistoryEntry();
}

export function closeProfile(){
  if (!profileView.classList.contains("is-open")) return;
  profileView.classList.remove("is-open");
  profileView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}

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
        requestCloseSheet();
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
