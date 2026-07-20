# Scan de recette par photo (Gemini) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un bouton "Scanner une recette" prend 1 à 4 photos d'une carte de recette (HelloFresh), les envoie à une Supabase Edge Function qui appelle Gemini 3.5 Flash pour en extraire titre/catégorie/ingrédients/étapes/etc. en JSON, puis ouvre le formulaire "Nouvelle recette" déjà pré-rempli (photo principale comprise) pour relecture avant sauvegarde.

**Architecture:** Une Supabase Edge Function (`scan-recipe`) reçoit les photos + un token d'auth, garde la clé Gemini côté serveur, renvoie un JSON structuré. Le client (`public/js/scan-recipe.js`, nouveau) gère la capture multi-photos et l'appel réseau ; `public/js/add-form.js` gagne un mode "pré-remplissage" distinct du mode édition pour afficher ce JSON dans le formulaire existant sans dupliquer sa logique de sauvegarde.

**Tech Stack:** Supabase Edge Function (Deno), API Gemini (`gemini-3.5-flash`, multimodal texte+image → JSON), JS vanilla existant, aucune dépendance nouvelle.

## Global Constraints

- Zéro étape de build côté client, pas de framework de test automatisé — vérification manuelle dans le navigateur.
- Le déploiement de la Edge Function et la (re-)configuration du secret `GEMINI_API_KEY` sont des étapes manuelles réservées à l'utilisateur (hors de portée d'un agent) — voir Task 1.
- Le format exact de requête/réponse de l'API Gemini doit être revérifié sur `https://ai.google.dev/gemini-api/docs` au moment d'écrire le code — cette API a déjà changé plusieurs fois de format courant 2026.
- Le bouton "Scanner une recette" est visible pour **tous** les comptes du foyer (pas de restriction admin).
- Jusqu'à **4 photos** par scan, pas plus.
- Aucune sauvegarde automatique : l'extraction pré-remplit le formulaire existant, l'utilisateur relit/corrige/valide comme aujourd'hui.
- Pas de découpage automatique des photos d'étape depuis la carte scannée dans cette version — seule la première photo capturée devient la photo principale de la recette.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v22`).
- Ne pas casser le mode édition existant de `openAddForm`/`renderAddForm` (utilisé par `detail.js` pour "Modifier la recette") — le nouveau paramètre de pré-remplissage doit être strictement additif.

---

### Task 1: Supabase Edge Function `scan-recipe`

**Files:**
- Create: `supabase/functions/scan-recipe/index.ts`
- Create: `supabase/functions/scan-recipe/README.md`

**Interfaces:**
- Produces: un endpoint HTTP `POST {SUPABASE_URL}/functions/v1/scan-recipe` qui accepte `{ images: { mimeType: string, data: string }[] }` (1 à 4 images en base64) en JSON, exige un header `Authorization: Bearer <jwt>` valide (n'importe quel compte du foyer), et renvoie soit le JSON extrait `{ title, category, difficulty, desc, time, servings, calories, protein, allergens, ingredients, utensils, steps }` (statut 200), soit `{ error: string }` en JSON avec un statut 4xx/5xx.

- [ ] **Step 1: Écrire la fonction, dans `supabase/functions/scan-recipe/index.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_PROMPT = `Tu regardes une ou plusieurs photos d'une carte de recette (probablement HelloFresh : recto avec photo du plat, verso avec ingrédients/ustensiles/étapes). Extrais son contenu et réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour, avec exactement ces champs :

{
  "title": string,
  "category": "entrée" | "plat" | "dessert",
  "difficulty": "Facile" | "Intermédiaire" | "Difficile",
  "desc": string,
  "time": number,
  "servings": number,
  "calories": number | null,
  "protein": number | null,
  "allergens": string | null,
  "ingredients": [string, string][],
  "utensils": string[],
  "steps": string[]
}

Règles :
- "ingredients" est une liste de paires [nom, quantité], ex. ["Oignon jaune", "1"].
- "steps" est la liste des étapes dans l'ordre, texte intégral de chaque étape.
- "category" doit être la plus proche possible parmi "entrée", "plat", "dessert" (la grande majorité des cartes HelloFresh sont des "plat").
- Si une info n'est pas présente sur la carte (ex. calories), utilise null pour les champs numériques/texte optionnels, ou un tableau vide pour les listes.
- N'invente aucune information absente de la photo.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0 || images.length > 4) {
      return new Response(JSON.stringify({ error: "Il faut entre 1 et 4 photos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const imageParts = images.map(img => ({
      inlineData: { mimeType: img.mimeType, data: img.data }
    }));

    // IMPORTANT : vérifier le format exact de requête/réponse actuel sur
    // https://ai.google.dev/gemini-api/docs avant de figer ce code — l'API Gemini
    // a changé plusieurs fois de format courant 2026. Le code ci-dessous cible
    // generateContent sur gemini-3.5-flash (entrée multimodale, sortie texte),
    // avec generationConfig.responseMimeType pour forcer une sortie JSON.
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: EXTRACTION_PROMPT }, ...imageParts] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      }
    );

    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: "Échec de l'analyse de la recette" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const geminiData = await geminiRes.json();
    const parts = geminiData?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find(p => typeof p.text === "string");
    if (!textPart) {
      return new Response(JSON.stringify({ error: "Réponse Gemini invalide" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let extracted;
    try {
      extracted = JSON.parse(textPart.text);
    } catch {
      return new Response(JSON.stringify({ error: "Réponse Gemini illisible" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
      return new Response(JSON.stringify({ error: "Réponse Gemini invalide" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(extracted), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

- [ ] **Step 2: Écrire les instructions de déploiement, dans `supabase/functions/scan-recipe/README.md`**

```md
# Déploiement de scan-recipe

Étape manuelle réservée à l'utilisateur (nécessite la CLI Supabase liée au projet) :

1. Déployer la fonction :
   `supabase functions deploy scan-recipe`
2. Configurer le secret Gemini si besoin (peut déjà exister sur ce projet Supabase
   depuis une fonctionnalité précédente — vérifier avec `supabase secrets list`) :
   `supabase secrets set GEMINI_API_KEY=ta_clé_ici`
   (clé récupérable sur https://aistudio.google.com/apikey)
3. Vérifier que la fonction répond (remplacer TOKEN par un vrai token de session,
   récupérable via `supabase.auth.getSession()` dans la console du navigateur une
   fois connecté à l'app, et IMAGE_BASE64 par une vraie image encodée en base64) :
   ```
   curl -X POST https://<project-ref>.supabase.co/functions/v1/scan-recipe \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"images":[{"mimeType":"image/jpeg","data":"IMAGE_BASE64"}]}'
   ```
   La réponse doit être un JSON avec les champs `title`, `category`, `ingredients`, `steps`, etc.

## Note sur la stabilité de l'API Gemini

Voir la note équivalente laissée dans le code (`index.ts`) — l'API de génération
Gemini a changé de format plusieurs fois courant 2026, revérifier la doc actuelle
sur https://ai.google.dev/gemini-api/docs si l'étape 3 échoue de façon inattendue.
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/scan-recipe/index.ts supabase/functions/scan-recipe/README.md
git commit -m "Ajouter la Supabase Edge Function de scan de recette par IA"
```

Note : cette tâche ne peut pas être vérifiée en direct sans que l'utilisateur déploie la fonction (Step 2 du README ci-dessus) — signaler ceci dans le rapport (DONE_WITH_CONCERNS si le déploiement n'a pas pu être vérifié).

---

### Task 2: Mode pré-remplissage dans `public/js/add-form.js`

**Files:**
- Modify: `public/js/add-form.js`
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Produces: `export function openAddForm(editingRecipe, prefillData)` — nouveau second paramètre optionnel. `prefillData` a la forme `{ title?, category?, difficulty?, desc?, time?, servings?, nutrition?: {calories, protein}, allergens?, ingredients?: [string,string][], utensils?: string[], steps?: string[], photoBlob?: Blob }`. Consommé par `public/js/scan-recipe.js` (Task 4) via `openAddForm(null, prefillData)`.
- `openAddForm(editingRecipe)` (appel à un seul argument) garde exactement son comportement actuel — les deux appels existants (`openAddForm()` pour une recette vide, `openAddForm(recipe)` pour éditer, dans `ui.js`/`detail.js`/`grid.js`) ne changent pas de comportement observable.

- [ ] **Step 1: Introduire une variable `data` pour unifier `editingRecipe`/`prefillData` comme source de pré-remplissage des champs**

Remplacer :

```js
function renderAddForm(editingRecipe){
```

par :

```js
function renderAddForm(editingRecipe, prefillData){
  const data = editingRecipe || prefillData || null;
```

- [ ] **Step 2: Utiliser `data` au lieu de `editingRecipe` pour chaque valeur de champ pré-remplie**

Remplacer :

```js
        <input id="addTitle" type="text" placeholder="Ex. Tarte aux pommes" value="${escapeAttr(editingRecipe?.title || "")}">
```

par :

```js
        <input id="addTitle" type="text" placeholder="Ex. Tarte aux pommes" value="${escapeAttr(data?.title || "")}">
```

Remplacer :

```js
        <input id="addDesc" type="text" placeholder="Une phrase pour donner envie" value="${escapeAttr(editingRecipe?.desc || "")}">
```

par :

```js
        <input id="addDesc" type="text" placeholder="Une phrase pour donner envie" value="${escapeAttr(data?.desc || "")}">
```

Remplacer :

```js
          <input id="addTime" type="number" min="0" placeholder="30" value="${editingRecipe?.time || ""}">
```

par :

```js
          <input id="addTime" type="number" min="0" placeholder="30" value="${data?.time || ""}">
```

Remplacer :

```js
          <input id="addServings" type="number" min="1" placeholder="4" value="${editingRecipe?.servings || ""}">
```

par :

```js
          <input id="addServings" type="number" min="1" placeholder="4" value="${data?.servings || ""}">
```

Remplacer :

```js
          <input id="addCalories" type="number" min="0" placeholder="Ex. 650" value="${editingRecipe?.nutrition?.calories ?? ""}">
```

par :

```js
          <input id="addCalories" type="number" min="0" placeholder="Ex. 650" value="${data?.nutrition?.calories ?? ""}">
```

Remplacer :

```js
          <input id="addProtein" type="number" min="0" step="0.1" placeholder="Ex. 20" value="${editingRecipe?.nutrition?.protein ?? ""}">
```

par :

```js
          <input id="addProtein" type="number" min="0" step="0.1" placeholder="Ex. 20" value="${data?.nutrition?.protein ?? ""}">
```

Remplacer :

```js
        <input id="addAllergens" type="text" placeholder="Ex. Gluten, blé, lait" value="${escapeAttr(editingRecipe?.allergens || "")}">
```

par :

```js
        <input id="addAllergens" type="text" placeholder="Ex. Gluten, blé, lait" value="${escapeAttr(data?.allergens || "")}">
```

Note : le titre `<h2>${editingRecipe ? "Modifier la recette" : "Nouvelle recette"}</h2>`, le label photo (`" — laisse vide pour garder la photo actuelle"`), le label étapes (photo d'étape) et le texte du bouton submit restent **inchangés**, testés uniquement sur `editingRecipe` — c'est volontaire : en mode pré-remplissage (`prefillData` sans `editingRecipe`), ce sont bien les textes "nouvelle recette" qui doivent s'afficher.

- [ ] **Step 3: Utiliser `data` pour la catégorie/difficulté et les listes dynamiques (ingrédients/ustensiles/étapes)**

Remplacer :

```js
  addForm.querySelector("#addCategory").value = editingRecipe?.category || "";
  addForm.querySelector("#addDifficulty").value = editingRecipe?.difficulty || "Facile";

  if (editingRecipe && editingRecipe.ingredients.length) {
    editingRecipe.ingredients.forEach(([name, qty]) => ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl, name, qty)));
  } else {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
  }
  if (editingRecipe && editingRecipe.utensils && editingRecipe.utensils.length) {
    editingRecipe.utensils.forEach(text => ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl, text)));
  } else {
    ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl));
  }
  if (editingRecipe && editingRecipe.steps.length) {
    editingRecipe.steps.forEach(text => stepRowsEl.appendChild(createStepRow(stepRowsEl, text)));
  } else {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
  }
```

par :

```js
  addForm.querySelector("#addCategory").value = data?.category || "";
  addForm.querySelector("#addDifficulty").value = data?.difficulty || "Facile";

  if (data?.ingredients?.length) {
    data.ingredients.forEach(([name, qty]) => ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl, name, qty)));
  } else {
    ingredientRowsEl.appendChild(createIngredientRow(ingredientRowsEl));
  }
  if (data?.utensils?.length) {
    data.utensils.forEach(text => ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl, text)));
  } else {
    ustensilRowsEl.appendChild(createUstensileRow(ustensilRowsEl));
  }
  if (data?.steps?.length) {
    data.steps.forEach(text => stepRowsEl.appendChild(createStepRow(stepRowsEl, text)));
  } else {
    stepRowsEl.appendChild(createStepRow(stepRowsEl));
  }
```

- [ ] **Step 4: Attacher automatiquement la photo scannée au champ Photo, juste après la définition de `addError`**

Remplacer :

```js
  const addError = addScroll.querySelector("#addError");

  addForm.querySelector("#addCategory").value = data?.category || "";
```

par :

```js
  const addError = addScroll.querySelector("#addError");

  if (!editingRecipe && prefillData?.photoBlob) {
    const dt = new DataTransfer();
    dt.items.add(new File([prefillData.photoBlob], "scan.jpg", { type: prefillData.photoBlob.type || "image/jpeg" }));
    addForm.querySelector("#addPhoto").files = dt.files;
  }

  addForm.querySelector("#addCategory").value = data?.category || "";
```

- [ ] **Step 5: Propager le second paramètre dans `openAddForm`**

Remplacer :

```js
export function openAddForm(editingRecipe){
  renderAddForm(editingRecipe);
```

par :

```js
export function openAddForm(editingRecipe, prefillData){
  renderAddForm(editingRecipe, prefillData);
```

- [ ] **Step 6: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v22";
```

par :

```js
const CACHE_NAME = "carnet-cache-v23";
```

- [ ] **Step 7: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois, se connecter.
- Ouvrir "Nouvelle recette" normalement (bouton +, ou menu → Ajouter une recette) → formulaire vide comme avant, titre "Nouvelle recette".
- Éditer une recette existante → formulaire pré-rempli comme avant, titre "Modifier la recette", champ photo affiche toujours "— laisse vide pour garder la photo actuelle".
- Dans la console du navigateur, simuler un pré-remplissage : `const mod = await import('/js/add-form.js'); mod.openAddForm(null, { title: "Test scan", category: "plat", ingredients: [["Test", "1"]], steps: ["Étape test"] });` → le formulaire s'ouvre avec titre "Nouvelle recette" (pas "Modifier"), champs Titre/Catégorie/Ingrédients/Étapes pré-remplis, label photo sans mention de "photo actuelle".
- Aucune erreur console sur les trois cas.

- [ ] **Step 8: Commit**

```bash
git add public/js/add-form.js public/sw.js
git commit -m "Ajouter un mode pre-remplissage a openAddForm pour le scan de recette"
```

---

### Task 3: Vue de capture photo, nouveau fichier `public/js/scan-recipe.js`

**Files:**
- Create: `public/js/scan-recipe.js`
- Modify: `public/index.html` (nouvelle section `scanView` + bouton de tiroir `navScanBtn`)
- Modify: `public/js/dom.js` (nouveaux exports)
- Modify: `public/js/ui.js` (intégration dans le verrouillage de scroll, la fermeture globale, nouvelle fonction `goToScanRecipe`)
- Modify: `public/js/main.js` (câblage des écouteurs)
- Modify: `public/style.css` (styles des vignettes photo)
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Produces: `export function openScanRecipe()`, `export function closeScanRecipe()` (depuis `./scan-recipe.js`) — ouvrent/ferment la vue de capture, même pattern que `openPanier`/`closePanier`. Consommés par `ui.js` (Task 3) et `main.js` (Task 3).
- Le bouton "Extraire" de cette vue est fonctionnellement présent (activé dès 1 photo) mais son clic n'est pas encore câblé à cette étape — câblé en Task 4.

- [ ] **Step 1: Ajouter la section HTML, dans `public/index.html`**

Remplacer :

```html
<!-- ===== VUE PROFIL (compte : plein écran mobile / dialogue PC) ===== -->
<section id="profileView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="profileCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="profileScroll"></div>
</section>
```

par :

```html
<!-- ===== VUE PROFIL (compte : plein écran mobile / dialogue PC) ===== -->
<section id="profileView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="profileCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="profileScroll"></div>
</section>

<!-- ===== VUE SCAN (capture photo pour pré-remplir une recette) ===== -->
<section id="scanView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="scanCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="scanScroll"></div>
</section>
```

- [ ] **Step 2: Ajouter le bouton de tiroir de navigation, dans `public/index.html`**

Remplacer :

```html
    <button class="drawer-item" id="navAddBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
      Ajouter une recette
    </button>
    <div class="drawer-divider"></div>
```

par :

```html
    <button class="drawer-item" id="navAddBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
      Ajouter une recette
    </button>
    <button class="drawer-item" id="navScanBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 8.96 4h6.08a1 1 0 0 1 .86.5L16.8 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.8" fill="none"/></svg></span>
      Scanner une recette
    </button>
    <div class="drawer-divider"></div>
```

- [ ] **Step 3: Ajouter les exports DOM, dans `public/js/dom.js`**

Remplacer :

```js
export const panierView = document.getElementById("panierView");
export const panierScroll = document.getElementById("panierScroll");
```

par :

```js
export const panierView = document.getElementById("panierView");
export const panierScroll = document.getElementById("panierScroll");
export const scanView = document.getElementById("scanView");
export const scanScroll = document.getElementById("scanScroll");
export const scanCloseBtn = document.getElementById("scanCloseBtn");
export const navScanBtn = document.getElementById("navScanBtn");
```

- [ ] **Step 4: Créer `public/js/scan-recipe.js` avec la vue de capture complète**

```js
import { scanView, scanScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";

/* ---- vue scan (capture de 1 à 4 photos pour pré-remplir une recette) ---- */
let capturedFiles = [];

function renderPhotoThumbs(){
  const container = scanScroll.querySelector("#scanPhotos");
  container.innerHTML = capturedFiles.map((file, i) => `
    <div class="scan-photo-thumb">
      <img src="${URL.createObjectURL(file)}" alt="Photo ${i + 1}">
      <button type="button" class="scan-photo-remove" data-index="${i}" aria-label="Supprimer cette photo">✕</button>
    </div>
  `).join("");
  container.querySelectorAll(".scan-photo-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      capturedFiles.splice(Number(btn.dataset.index), 1);
      renderPhotoThumbs();
      updateScanButtons();
    });
  });
}

function updateScanButtons(){
  scanScroll.querySelector("#scanAddPhotoBtn").disabled = capturedFiles.length >= 4;
  scanScroll.querySelector("#scanExtractBtn").disabled = capturedFiles.length === 0;
}

function renderScanCapture(){
  capturedFiles = [];
  scanScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="scanMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Scanner une recette</h2>
    </div>
    <div class="add-form">
      <p class="scan-hint">Prends une ou plusieurs photos de la carte (recto, verso…), jusqu'à 4.</p>
      <div id="scanPhotos" class="scan-photos"></div>
      <input type="file" accept="image/*" capture="environment" id="scanCameraInput" hidden>
      <button type="button" class="dyn-add" id="scanAddPhotoBtn">+ Ajouter une photo</button>
      <p id="scanError" class="add-error" hidden></p>
      <div class="add-actions">
        <button type="button" class="btn-secondary" id="scanCancelBtn">Annuler</button>
        <button type="button" class="btn-primary" id="scanExtractBtn" disabled>Extraire</button>
      </div>
    </div>
  `;

  renderPhotoThumbs();
  updateScanButtons();

  scanScroll.querySelector("#scanMenuBtn").addEventListener("click", openDrawer);
  scanScroll.querySelector("#scanCancelBtn").addEventListener("click", requestCloseSheet);
  scanScroll.querySelector("#scanAddPhotoBtn").addEventListener("click", () => {
    scanScroll.querySelector("#scanCameraInput").click();
  });
  scanScroll.querySelector("#scanCameraInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) capturedFiles.push(file);
    e.target.value = "";
    renderPhotoThumbs();
    updateScanButtons();
  });
}

export function openScanRecipe(){
  renderScanCapture();
  scanView.classList.add("is-open");
  scanView.setAttribute("aria-hidden", "false");
  scanScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeScanRecipe(){
  if (!scanView.classList.contains("is-open")) return;
  scanView.classList.remove("is-open");
  scanView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

- [ ] **Step 5: Intégrer la vue au verrouillage de scroll et à la fermeture globale, dans `public/js/ui.js`**

Remplacer :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { render } from "./grid.js";
```

par :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { closeScanRecipe, openScanRecipe } from "./scan-recipe.js";
import { render } from "./grid.js";
```

Remplacer :

```js
export function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || drawer.classList.contains("is-open");
  document.body.style.overflow = anyOpen ? "hidden" : "";
}
```

par :

```js
export function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || scanView.classList.contains("is-open")
    || drawer.classList.contains("is-open");
  document.body.style.overflow = anyOpen ? "hidden" : "";
}
```

Remplacer :

```js
function closeAllOverlays(){
  closeDetail();
  closeAddForm();
  closePanier();
  closeProfile();
}
```

par :

```js
function closeAllOverlays(){
  closeDetail();
  closeAddForm();
  closePanier();
  closeProfile();
  closeScanRecipe();
}
```

Remplacer :

```js
export function goToAddRecipe(){
  closeAllOverlays();
  closeDrawer();
  openAddForm();
}
```

par :

```js
export function goToAddRecipe(){
  closeAllOverlays();
  closeDrawer();
  openAddForm();
}
export function goToScanRecipe(){
  closeAllOverlays();
  closeDrawer();
  openScanRecipe();
}
```

- [ ] **Step 6: Câbler les écouteurs, dans `public/js/main.js`**

Remplacer :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, brandHomeBtn
} from "./dom.js";
import { render } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
import { initAuth, logout } from "./auth.js";
import { openProfile, closeProfile, updateAccountBadge, initSyncBadge } from "./profile.js";
import { flush, onPermanentFailure } from "./write-queue.js";
import "./timer.js";
```

par :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, brandHomeBtn
} from "./dom.js";
import { render } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { closeScanRecipe } from "./scan-recipe.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
import { initAuth, logout } from "./auth.js";
import { openProfile, closeProfile, updateAccountBadge, initSyncBadge } from "./profile.js";
import { flush, onPermanentFailure } from "./write-queue.js";
import "./timer.js";
```

Remplacer :

```js
function closeAnyOpenSheet(){
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
}
```

par :

```js
function closeAnyOpenSheet(){
  if (detailView.classList.contains("is-open")) closeDetail();
  if (addView.classList.contains("is-open")) closeAddForm();
  if (panierView.classList.contains("is-open")) closePanier();
  if (profileView.classList.contains("is-open")) closeProfile();
  if (scanView.classList.contains("is-open")) closeScanRecipe();
}
```

Remplacer :

```js
sheetBackdrop.addEventListener("click", requestCloseSheet);
detailCloseBtn.addEventListener("click", requestCloseSheet);
addCloseBtn.addEventListener("click", requestCloseSheet);
panierCloseBtn.addEventListener("click", requestCloseSheet);
profileCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);
```

par :

```js
sheetBackdrop.addEventListener("click", requestCloseSheet);
detailCloseBtn.addEventListener("click", requestCloseSheet);
addCloseBtn.addEventListener("click", requestCloseSheet);
panierCloseBtn.addEventListener("click", requestCloseSheet);
profileCloseBtn.addEventListener("click", requestCloseSheet);
scanCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);
```

Remplacer :

```js
navAllBtn.addEventListener("click", goToAllRecipes);
navFavBtn.addEventListener("click", goToFavoris);
navPanierBtn.addEventListener("click", goToPanier);
navAddBtn.addEventListener("click", goToAddRecipe);
```

par :

```js
navAllBtn.addEventListener("click", goToAllRecipes);
navFavBtn.addEventListener("click", goToFavoris);
navPanierBtn.addEventListener("click", goToPanier);
navAddBtn.addEventListener("click", goToAddRecipe);
navScanBtn.addEventListener("click", goToScanRecipe);
```

- [ ] **Step 7: Ajouter les styles des vignettes photo, dans `public/style.css`**

Remplacer :

```css
.dyn-add:hover{ border-color: var(--emerald); color: var(--emerald-dark); }

.add-error{
```

par :

```css
.dyn-add:hover{ border-color: var(--emerald); color: var(--emerald-dark); }

.scan-hint{ font-size:.86rem; color: var(--ink-soft); margin:0; }
.scan-photos{ display:flex; flex-wrap:wrap; gap:10px; }
.scan-photo-thumb{ position:relative; width:84px; height:84px; border-radius:8px; overflow:hidden; border:1px solid var(--line); }
.scan-photo-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
.scan-photo-remove{
  position:absolute; top:3px; right:3px; width:22px; height:22px; border-radius:50%; border:none;
  background: rgba(0,0,0,.55); color:#fff; font-size:.7rem; line-height:1; display:flex; align-items:center; justify-content:center;
}
.scan-photo-remove:hover{ background: var(--terracotta-dark); }

.add-error{
```

- [ ] **Step 8: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v23";
```

par :

```js
const CACHE_NAME = "carnet-cache-v24";
```

- [ ] **Step 9: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter.
- Menu → "Scanner une recette" → la vue s'ouvre en plein écran (mobile) / dialogue (PC), titre "Scanner une recette", bouton "Extraire" désactivé.
- Cliquer "+ Ajouter une photo" → la caméra/sélecteur de fichier s'ouvre (sur PC, sélecteur de fichier classique) ; choisir une image → une vignette apparaît, "Extraire" devient cliquable.
- Répéter jusqu'à 4 photos → "+ Ajouter une photo" se désactive à la 4ᵉ.
- Cliquer le ✕ d'une vignette → elle disparaît, les boutons se réactivent/désactivent correctement selon le nombre restant.
- Fermer via le ✕ en haut, via "Annuler", et via le bouton retour du navigateur → la vue se ferme proprement dans les trois cas.
- Aucune erreur console. Le clic sur "Extraire" ne fait encore rien de visible à ce stade (normal, câblé en Task 4).

- [ ] **Step 10: Commit**

```bash
git add public/index.html public/js/dom.js public/js/scan-recipe.js public/js/ui.js public/js/main.js public/style.css public/sw.js
git commit -m "Ajouter la vue de capture photo pour le scan de recette"
```

---

### Task 4: Extraction et pré-remplissage, dans `public/js/scan-recipe.js`

**Files:**
- Modify: `public/js/scan-recipe.js`
- Modify: `public/js/supabase-client.js` (exporter `SUPABASE_URL`)
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Consumes: `supabase`, `SUPABASE_URL` (depuis `./supabase-client.js`) ; `CATEGORY_ICON` (depuis `./recipes-data.js`) ; `openAddForm` (depuis `./add-form.js`, signature étendue en Task 2).
- Le bouton "Extraire" de la vue de capture (Task 3) devient fonctionnel : il appelle la Edge Function `scan-recipe`, transforme sa réponse en `prefillData` (forme définie en Task 2), ferme la vue de capture et ouvre le formulaire pré-rempli.

- [ ] **Step 1: Exporter `SUPABASE_URL`, dans `public/js/supabase-client.js`**

Remplacer :

```js
const SUPABASE_URL = "https://bmotbwubruvsrflaufis.supabase.co";
```

par :

```js
export const SUPABASE_URL = "https://bmotbwubruvsrflaufis.supabase.co";
```

- [ ] **Step 2: Ajouter les imports, la conversion des photos, l'appel réseau et la validation du résultat, dans `public/js/scan-recipe.js`**

Remplacer :

```js
import { scanView, scanScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
```

par :

```js
import { scanView, scanScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
import { supabase, SUPABASE_URL } from "./supabase-client.js";
import { CATEGORY_ICON } from "./recipes-data.js";
import { openAddForm } from "./add-form.js";

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_ICON));
const VALID_DIFFICULTIES = new Set(["Facile", "Intermédiaire", "Difficile"]);

function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function scanRecipeImages(files){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Non authentifié");

  const images = await Promise.all(files.map(async file => ({
    mimeType: file.type || "image/jpeg",
    data: await blobToBase64(file)
  })));

  const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-recipe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ images })
  });

  if (!res.ok) throw new Error("Échec de l'analyse de la recette");
  return res.json();
}

function sanitizeExtractedRecipe(raw, photoBlob){
  const category = VALID_CATEGORIES.has(raw?.category) ? raw.category : "";
  const difficulty = VALID_DIFFICULTIES.has(raw?.difficulty) ? raw.difficulty : "Facile";
  const ingredients = Array.isArray(raw?.ingredients)
    ? raw.ingredients.filter(pair => Array.isArray(pair) && pair[0]).map(([name, qty]) => [String(name), String(qty ?? "")])
    : [];
  const utensils = Array.isArray(raw?.utensils) ? raw.utensils.filter(Boolean).map(String) : [];
  const steps = Array.isArray(raw?.steps) ? raw.steps.filter(Boolean).map(String) : [];
  const nutrition = (typeof raw?.calories === "number" && typeof raw?.protein === "number")
    ? { calories: raw.calories, protein: raw.protein }
    : undefined;

  return {
    title: typeof raw?.title === "string" ? raw.title : "",
    category, difficulty,
    desc: typeof raw?.desc === "string" ? raw.desc : "",
    time: typeof raw?.time === "number" ? raw.time : undefined,
    servings: typeof raw?.servings === "number" ? raw.servings : undefined,
    nutrition,
    allergens: typeof raw?.allergens === "string" ? raw.allergens : undefined,
    ingredients, utensils, steps,
    photoBlob
  };
}
```

- [ ] **Step 3: Câbler le clic du bouton "Extraire", dans `renderScanCapture`**

Remplacer :

```js
  scanScroll.querySelector("#scanCameraInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) capturedFiles.push(file);
    e.target.value = "";
    renderPhotoThumbs();
    updateScanButtons();
  });
}
```

par :

```js
  scanScroll.querySelector("#scanCameraInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) capturedFiles.push(file);
    e.target.value = "";
    renderPhotoThumbs();
    updateScanButtons();
  });

  scanScroll.querySelector("#scanExtractBtn").addEventListener("click", async () => {
    const extractBtn = scanScroll.querySelector("#scanExtractBtn");
    const scanError = scanScroll.querySelector("#scanError");
    scanError.hidden = true;
    extractBtn.disabled = true;
    scanScroll.querySelector("#scanAddPhotoBtn").disabled = true;
    extractBtn.textContent = "Analyse en cours…";
    try {
      const raw = await scanRecipeImages(capturedFiles);
      const prefillData = sanitizeExtractedRecipe(raw, capturedFiles[0]);
      closeScanRecipe();
      openAddForm(null, prefillData);
    } catch {
      scanError.textContent = "Impossible d'analyser ces photos, réessaie.";
      scanError.hidden = false;
      extractBtn.textContent = "Extraire";
      updateScanButtons();
    }
  });
}
```

- [ ] **Step 4: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v24";
```

par :

```js
const CACHE_NAME = "carnet-cache-v25";
```

- [ ] **Step 5: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter (nécessite un compte réel — signaler en DONE_WITH_CONCERNS si aucun compte de test n'est disponible, et vérifier ce qui peut l'être statiquement : pas d'erreur de syntaxe, le clic sur "Extraire" déclenche bien un appel réseau visible dans l'onglet Réseau même s'il échoue faute de fonction déployée).
- Si la Edge Function de la Task 1 est déjà déployée et sa clé configurée : scanner une vraie carte HelloFresh (1 à 2 photos), cliquer "Extraire" → indicateur "Analyse en cours…", puis le formulaire "Nouvelle recette" s'ouvre pré-rempli (titre, catégorie, ingrédients, étapes correspondant à la carte), photo déjà attachée au champ Photo.
- Couper le réseau (ou renommer temporairement l'URL de la fonction) avant de cliquer "Extraire" → message d'erreur affiché dans la vue de scan, les photos déjà prises restent présentes, "Extraire" redevient cliquable pour réessayer.
- Sauvegarder la recette pré-remplie → flux de sauvegarde identique à une recette créée manuellement (toast "Recette ajoutée", recette visible dans la grille avec sa photo).
- Aucune erreur console sur tout le parcours.

- [ ] **Step 6: Commit**

```bash
git add public/js/scan-recipe.js public/js/supabase-client.js public/sw.js
git commit -m "Brancher l'extraction Gemini et le pre-remplissage du formulaire"
```
