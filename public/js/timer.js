import { timerBadge, timerBadgeValue, detailView, detailScroll } from "./dom.js";
import { showToast } from "./ui.js";
import { currentOpenRecipe, openDetail } from "./detail.js";

/* ---- minuteur de cuisine (compte à rebours, un seul actif, persiste en arrière-plan) ---- */
const TIMER_KEY = "carnet-minuteur";
let timerTickId = null;

function loadTimerState(){
  try { return JSON.parse(localStorage.getItem(TIMER_KEY) || "null"); }
  catch { return null; }
}
function saveTimerState(t){
  if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t));
  else localStorage.removeItem(TIMER_KEY);
}

let timerState = loadTimerState();

function formatTimer(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function timerRemainingSeconds(){
  if (!timerState) return 0;
  if (!timerState.running) return timerState.remainingAtPause;
  return (timerState.endAt - Date.now()) / 1000;
}

function playTimerBeep(){
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.18);
    });
  } catch {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function addTimerMinutes(recipe, minutes){
  const addSeconds = Math.max(1, Math.round(minutes)) * 60;
  const belongsHere = timerState && timerState.recipeId === recipe.id;

  if (!belongsHere) {
    timerState = {
      recipeId: recipe.id, recipeTitle: recipe.title,
      durationSeconds: addSeconds,
      endAt: Date.now() + addSeconds * 1000,
      running: false, remainingAtPause: addSeconds, done: false
    };
  } else if (timerState.running) {
    timerState.endAt += addSeconds * 1000;
    timerState.durationSeconds += addSeconds;
    timerState.done = false;
  } else {
    timerState.remainingAtPause += addSeconds;
    timerState.durationSeconds += addSeconds;
    timerState.done = false;
  }

  saveTimerState(timerState);
  updateTimerBadge();
  renderTimerPanelIfOpen();
  if (timerState.running) ensureTimerTicking();
}
function pauseTimer(){
  if (!timerState || !timerState.running) return;
  timerState.remainingAtPause = Math.max(0, timerRemainingSeconds());
  timerState.running = false;
  saveTimerState(timerState);
  updateTimerBadge();
  renderTimerPanelIfOpen();
}
function resumeTimer(){
  if (!timerState || timerState.running) return;
  timerState.endAt = Date.now() + timerState.remainingAtPause * 1000;
  timerState.running = true;
  saveTimerState(timerState);
  updateTimerBadge();
  renderTimerPanelIfOpen();
  ensureTimerTicking();
}
function resetTimer(){
  timerState = null;
  saveTimerState(null);
  if (timerTickId) { clearInterval(timerTickId); timerTickId = null; }
  updateTimerBadge();
  renderTimerPanelIfOpen();
}

function ensureTimerTicking(){
  if (timerTickId) return;
  timerTickId = setInterval(() => {
    if (!timerState || !timerState.running) return;
    const remaining = timerRemainingSeconds();
    if (remaining <= 0 && !timerState.done) {
      timerState.done = true;
      timerState.running = false;
      timerState.remainingAtPause = 0;
      saveTimerState(timerState);
      showToast(`Minuteur terminé — ${timerState.recipeTitle}`);
      playTimerBeep();
    }
    updateTimerBadge();
    renderTimerPanelIfOpen();
  }, 1000);
}

function updateTimerBadge(){
  if (!timerState) { timerBadge.hidden = true; return; }
  timerBadge.hidden = false;
  timerBadgeValue.textContent = formatTimer(timerRemainingSeconds());
}

function renderTimerPanelIfOpen(){
  if (!detailView.classList.contains("is-open") || !currentOpenRecipe) return;
  const panel = detailScroll.querySelector("#timerPanel");
  if (panel) renderTimerPanel(panel, currentOpenRecipe);
}

export function renderTimerPanel(panel, recipe){
  const belongsHere = timerState && timerState.recipeId === recipe.id;
  const remaining = belongsHere ? timerRemainingSeconds() : 0;
  const isDone = belongsHere && timerState.done;
  const isRunning = belongsHere && timerState.running;
  const hasTime = belongsHere && remaining > 0;

  panel.innerHTML = `
    <div class="timer-panel-head"><h4>⏱ Minuteur</h4></div>
    <div class="${isDone ? "timer-display is-done" : "timer-display"}">${belongsHere ? (isDone ? "Terminé" : formatTimer(remaining)) : "00:00"}</div>
    <div class="timer-quick">
      <button type="button" data-mins="1">+1 min</button>
      <button type="button" data-mins="5">+5 min</button>
      <button type="button" data-mins="10">+10 min</button>
    </div>
    <div class="timer-actions">
      <button type="button" class="timer-start" id="timerPlayBtn" ${isRunning || !hasTime ? "disabled" : ""}>Lecture</button>
      <button type="button" class="timer-start" id="timerPauseBtn" ${!isRunning ? "disabled" : ""}>Pause</button>
      <button type="button" class="timer-reset" id="timerResetBtn" ${!belongsHere ? "disabled" : ""}>Réinitialiser</button>
    </div>
  `;

  panel.querySelectorAll("[data-mins]").forEach(btn => {
    btn.addEventListener("click", () => addTimerMinutes(recipe, parseInt(btn.dataset.mins, 10)));
  });
  panel.querySelector("#timerPlayBtn").addEventListener("click", resumeTimer);
  panel.querySelector("#timerPauseBtn").addEventListener("click", pauseTimer);
  panel.querySelector("#timerResetBtn").addEventListener("click", resetTimer);
}

timerBadge.addEventListener("click", () => {
  if (timerState) openDetail(timerState.recipeId);
});

if (timerState) {
  updateTimerBadge();
  if (timerState.running) ensureTimerTicking();
}
