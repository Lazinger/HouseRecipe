# Import de recette depuis une URL — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un bouton "Importer depuis une URL" accepte le lien d'une page de recette (Marmiton, CuisineAZ, 750g, HelloFresh en ligne...), l'envoie à une Supabase Edge Function qui essaie d'abord de lire les données structurées `schema.org/Recipe` (JSON-LD) de la page — gratuit, instantané — et ne bascule sur une extraction par IA (Gemini) qu'en secours si ces données sont absentes ou insuffisantes. Le résultat (photo principale comprise si trouvée) pré-remplit le formulaire "Nouvelle recette" existant, exactement comme le scan photo.

**Architecture:** Nouvelle Supabase Edge Function (`import-recipe-url`) qui fetch le HTML côté serveur, cherche un bloc JSON-LD `Recipe` et mappe ses champs directement vers notre schéma interne ; à défaut, nettoie le HTML en texte et le passe à Gemini avec un prompt d'extraction adapté de celui du scan photo. Le client (`public/js/import-url.js`, nouveau) gère la saisie d'URL et l'appel réseau, et réutilise `sanitizeExtractedRecipe` (désormais exportée depuis `public/js/scan-recipe.js`) pour nettoyer le résultat avant de le passer à `openAddForm(null, prefillData)`, sans aucune modification du formulaire lui-même (le pré-remplissage existe déjà depuis le scan photo).

**Tech Stack:** Supabase Edge Function (Deno), API Gemini (`gemini-3.5-flash`, texte → JSON) en secours uniquement, JS vanilla existant, aucune dépendance nouvelle.

## Global Constraints

- Zéro étape de build côté client, pas de framework de test automatisé — vérification manuelle dans le navigateur, comme pour le scan photo.
- Le déploiement de la Edge Function est une étape manuelle réservée à l'utilisateur (voir Task 2) — le secret `GEMINI_API_KEY` est déjà configuré sur ce projet Supabase (partagé avec `scan-recipe`), aucune nouvelle clé à créer.
- Le format exact de requête/réponse de l'API Gemini doit être revérifié sur `https://ai.google.dev/gemini-api/docs` au moment d'écrire le code — cette API a déjà changé plusieurs fois de format courant 2026.
- Le bouton "Importer depuis une URL" est visible pour **tous** les comptes du foyer (pas de restriction admin), à côté de "Scanner une recette" dans le tiroir de navigation — deux entrées séparées.
- Le chemin JSON-LD ne consomme jamais le quota Gemini partagé (~20 requêtes/jour) ; seul le secours IA en consomme.
- Timeout d'environ 10 secondes sur chaque fetch serveur (page et image), pour ne jamais bloquer la Edge Function sur un site qui ne répond pas.
- Aucune sauvegarde automatique : l'extraction pré-remplit le formulaire existant, l'utilisateur relit/corrige/valide comme aujourd'hui.
- Un échec du téléchargement de l'image JSON-LD n'empêche pas le reste de l'extraction — la recette se pré-remplit sans photo dans ce cas, sans message d'erreur bloquant.
- Toute modification d'un fichier déjà mis en cache par le service worker nécessite un bump de `CACHE_NAME` dans `public/sw.js` (dernière valeur : `carnet-cache-v54`).
- Ne pas casser le scan photo existant : `sanitizeExtractedRecipe` doit garder exactement son comportement actuel pour les appelants existants — le rendre exporté est le seul changement autorisé sur cette fonction dans ce plan.

---

### Task 1: Exporter `sanitizeExtractedRecipe`, dans `public/js/scan-recipe.js`

**Files:**
- Modify: `public/js/scan-recipe.js`
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Produces: `export function sanitizeExtractedRecipe(raw, photoBlob)` — même signature et même comportement qu'aujourd'hui (fonction déjà écrite, seul le mot-clé `export` est ajouté). Consommé par `public/js/import-url.js` (Task 4).

- [ ] **Step 1: Ajouter `export` devant la fonction**

Remplacer :

```js
function sanitizeExtractedRecipe(raw, photoBlob){
```

par :

```js
export function sanitizeExtractedRecipe(raw, photoBlob){
```

- [ ] **Step 2: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v54";
```

par :

```js
const CACHE_NAME = "carnet-cache-v55";
```

- [ ] **Step 3: Vérifier dans le navigateur**

Lancer un serveur local sur `public/`, recharger deux fois, se connecter.
- Menu → "Scanner une recette" → capturer une photo → "Extraire" → aucun changement de comportement par rapport à avant (le formulaire se pré-remplit comme précédemment si la fonction est déployée, ou échoue avec le même message d'erreur sinon).
- Aucune erreur console au chargement de l'app (l'export ne casse pas l'import existant dans le même fichier).

- [ ] **Step 4: Commit**

```bash
git add public/js/scan-recipe.js public/sw.js
git commit -m "Exporter sanitizeExtractedRecipe pour la reutiliser depuis l'import URL"
```

---

### Task 2: Supabase Edge Function `import-recipe-url`

**Files:**
- Create: `supabase/functions/import-recipe-url/index.ts`
- Create: `supabase/functions/import-recipe-url/README.md`

**Interfaces:**
- Produces: un endpoint HTTP `POST {SUPABASE_URL}/functions/v1/import-recipe-url` qui accepte `{ url: string }` en JSON, exige un header `Authorization: Bearer <jwt>` valide (n'importe quel compte du foyer), et renvoie soit `{ title, category, difficulty, desc, time, servings, calories, protein, allergens, ingredients, utensils, steps, photo: { mimeType: string, data: string } | null, source: "jsonld" | "ai" }` (statut 200), soit `{ error: string }` (statut 4xx/5xx).

- [ ] **Step 1: Écrire la fonction, dans `supabase/functions/import-recipe-url/index.ts`**

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeCarnetBot/1.0; +https://lecarnet.app)" }
    });
  } finally {
    clearTimeout(timer);
  }
}

/* ---- recherche et mapping du JSON-LD schema.org/Recipe ---- */
function findRecipeInJsonLd(node){
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
    return null;
  }
  const type = node["@type"];
  const isRecipe = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
  if (isRecipe) return node;
  if (Array.isArray(node["@graph"])) return findRecipeInJsonLd(node["@graph"]);
  return null;
}

function extractJsonLdRecipe(html){
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const recipe = findRecipeInJsonLd(parsed);
      if (recipe) return recipe;
    } catch {
      // bloc JSON-LD illisible sur cette page, on continue avec le suivant
    }
  }
  return null;
}

function parseIsoDurationToMinutes(duration){
  if (typeof duration !== "string") return undefined;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return undefined;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  if (!hours && !minutes) return undefined;
  return hours * 60 + minutes;
}

function firstNumber(value){
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const match = value.match(/[\d.,]+/);
  if (!match) return undefined;
  const num = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(num) ? num : undefined;
}

function guessCategory(...texts){
  const text = texts.filter(Boolean).join(" ").toLowerCase();
  if (/dessert|gâteau|gateau|pâtisserie|patisserie/.test(text)) return "dessert";
  if (/entrée|entree|apéritif|aperitif|amuse-bouche/.test(text)) return "entrée";
  if (/plat|main course|dinner/.test(text)) return "plat";
  return "";
}

function toStringArray(value){
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(item => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && typeof item.text === "string") return item.text;
    if (item && typeof item === "object" && Array.isArray(item.itemListElement)) {
      return toStringArray(item.itemListElement).join(" ");
    }
    return "";
  }).filter(Boolean);
}

function extractImageUrl(image){
  if (!image) return undefined;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return extractImageUrl(image[0]);
  if (typeof image === "object" && typeof image.url === "string") return image.url;
  return undefined;
}

function sumIsoDurations(...durations){
  const total = durations.reduce((sum, d) => sum + (parseIsoDurationToMinutes(d) || 0), 0);
  return total > 0 ? total : undefined;
}

function mapJsonLdToRecipe(node){
  const totalMinutes = parseIsoDurationToMinutes(node.totalTime) ?? sumIsoDurations(node.prepTime, node.cookTime);

  return {
    title: typeof node.name === "string" ? node.name : "",
    category: guessCategory(node.recipeCategory, node.name),
    difficulty: undefined,
    desc: typeof node.description === "string" ? node.description : "",
    time: totalMinutes,
    servings: firstNumber(node.recipeYield),
    calories: firstNumber(node.nutrition?.calories),
    protein: firstNumber(node.nutrition?.proteinContent),
    allergens: null,
    ingredients: toStringArray(node.recipeIngredient).map(text => [text, ""]),
    utensils: toStringArray(node.tool || node.recipeEquipment),
    steps: toStringArray(node.recipeInstructions),
    imageUrl: extractImageUrl(node.image)
  };
}

function isSufficient(recipe){
  return Boolean(recipe.title) && (recipe.ingredients.length > 0 || recipe.steps.length > 0);
}

/* ---- secours IA (texte de la page) ---- */
function stripHtmlToText(html){
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  const text = withoutNoise.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, 15000);
}

const TEXT_EXTRACTION_PROMPT = `Tu regardes le texte extrait d'une page web de recette de cuisine. Extrais son contenu et réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour, avec exactement ces champs :

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
- "category" doit être la plus proche possible parmi "entrée", "plat", "dessert".
- Si une info n'est pas présente dans le texte (ex. calories), utilise null pour les champs numériques/texte optionnels, ou un tableau vide pour les listes.
- N'invente aucune information absente du texte. Si le texte ne décrit pas une recette de cuisine, renvoie des champs vides/null.`;

// IMPORTANT : vérifier le format exact de requête/réponse actuel sur
// https://ai.google.dev/gemini-api/docs avant de figer ce code — l'API Gemini
// a déjà changé plusieurs fois de format courant 2026.
async function extractRecipeWithAi(pageText){
  const geminiRes = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: TEXT_EXTRACTION_PROMPT }, { text: pageText }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    }
  );

  if (!geminiRes.ok) throw new Error("Échec de l'analyse de la page");

  const geminiData = await geminiRes.json();
  const parts = geminiData?.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find(p => typeof p.text === "string");
  if (!textPart) throw new Error("Réponse Gemini invalide");

  const extracted = JSON.parse(textPart.text);
  if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
    throw new Error("Réponse Gemini invalide");
  }
  return {
    title: typeof extracted.title === "string" ? extracted.title : "",
    category: extracted.category,
    difficulty: extracted.difficulty,
    desc: typeof extracted.desc === "string" ? extracted.desc : "",
    time: typeof extracted.time === "number" ? extracted.time : undefined,
    servings: typeof extracted.servings === "number" ? extracted.servings : undefined,
    calories: typeof extracted.calories === "number" ? extracted.calories : undefined,
    protein: typeof extracted.protein === "number" ? extracted.protein : undefined,
    allergens: typeof extracted.allergens === "string" ? extracted.allergens : null,
    ingredients: Array.isArray(extracted.ingredients) ? extracted.ingredients : [],
    utensils: Array.isArray(extracted.utensils) ? extracted.utensils : [],
    steps: Array.isArray(extracted.steps) ? extracted.steps : [],
    imageUrl: undefined
  };
}

/* ---- téléchargement au mieux de l'image principale ---- */
async function downloadImageAsBase64(imageUrl){
  if (!imageUrl) return null;
  try {
    const res = await fetchWithTimeout(imageUrl);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return { mimeType, data: btoa(binary) };
  } catch {
    return null;
  }
}

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

    const { url } = await req.json();
    let pageUrl;
    try {
      pageUrl = new URL(url);
      if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") throw new Error("protocole invalide");
    } catch {
      return new Response(JSON.stringify({ error: "URL invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let html;
    try {
      const pageRes = await fetchWithTimeout(pageUrl.toString());
      if (!pageRes.ok) throw new Error(`statut ${pageRes.status}`);
      html = await pageRes.text();
    } catch {
      return new Response(JSON.stringify({ error: "Impossible de récupérer cette page" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const jsonLdRecipe = extractJsonLdRecipe(html);
    let extracted = null;
    let source = null;

    if (jsonLdRecipe) {
      const mapped = mapJsonLdToRecipe(jsonLdRecipe);
      if (isSufficient(mapped)) {
        extracted = mapped;
        source = "jsonld";
      }
    }

    if (!extracted) {
      if (!GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY n'est pas configurée sur ce projet Supabase");
        return new Response(JSON.stringify({ error: "Clé Gemini non configurée" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      try {
        extracted = await extractRecipeWithAi(stripHtmlToText(html));
        source = "ai";
      } catch (err) {
        console.error("import-recipe-url (secours IA):", err);
        return new Response(JSON.stringify({ error: "Impossible d'analyser cette page" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const photo = await downloadImageAsBase64(extracted.imageUrl);

    return new Response(JSON.stringify({ ...extracted, imageUrl: undefined, photo, source }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("import-recipe-url:", err);
    return new Response(JSON.stringify({ error: "Erreur inattendue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

- [ ] **Step 2: Écrire les instructions de déploiement, dans `supabase/functions/import-recipe-url/README.md`**

```md
# Déploiement de import-recipe-url

Étape manuelle réservée à l'utilisateur (nécessite la CLI Supabase liée au projet) :

1. Déployer la fonction :
   `supabase functions deploy import-recipe-url`
2. Le secret `GEMINI_API_KEY` est déjà configuré sur ce projet Supabase (partagé
   avec la fonction `scan-recipe`) — rien à reconfigurer, sauf si ce secret a
   été retiré entre-temps (`supabase secrets list` pour vérifier).
3. Vérifier que la fonction répond (remplacer TOKEN par un vrai token de session,
   récupérable via `supabase.auth.getSession()` dans la console du navigateur une
   fois connecté à l'app, et l'URL par une vraie page de recette) :
   ```
   curl -X POST https://<project-ref>.supabase.co/functions/v1/import-recipe-url \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://www.marmiton.org/recettes/recette_exemple.aspx"}'
   ```
   La réponse doit être un JSON avec les champs `title`, `ingredients`, `steps`,
   `source` (`"jsonld"` ou `"ai"`), etc.

## Note sur la stabilité de l'API Gemini

Voir la note équivalente laissée dans le code (`index.ts`) — l'API de génération
Gemini a changé de format plusieurs fois courant 2026, revérifier la doc actuelle
sur https://ai.google.dev/gemini-api/docs si le secours IA échoue de façon
inattendue à l'étape 3.

## Note sur le chemin JSON-LD

La grande majorité des sites de recettes grand public (Marmiton, CuisineAZ, 750g,
HelloFresh en ligne) publient un bloc `<script type="application/ld+json">` avec
un objet `schema.org/Recipe` pour leur référencement — c'est le chemin attendu en
premier (`source: "jsonld"` dans la réponse), gratuit et sans appel Gemini. Le
secours IA (`source: "ai"`) ne devrait se déclencher que sur des pages qui n'ont
pas ces données structurées (blogs perso, etc.).
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/import-recipe-url/index.ts supabase/functions/import-recipe-url/README.md
git commit -m "Ajouter la Supabase Edge Function d'import de recette par URL"
```

Note : cette tâche ne peut pas être vérifiée en direct sans que l'utilisateur déploie la fonction (Step 2 du README ci-dessus) — signaler ceci dans le rapport (DONE_WITH_CONCERNS si le déploiement n'a pas pu être vérifié).

---

### Task 3: Vue de saisie d'URL, nouveau fichier `public/js/import-url.js`

**Files:**
- Create: `public/js/import-url.js`
- Modify: `public/index.html` (nouvelle section `importUrlView` + bouton de tiroir `navImportUrlBtn`)
- Modify: `public/js/dom.js` (nouveaux exports)
- Modify: `public/js/ui.js` (intégration au verrouillage de scroll, à la fermeture globale, nouvelle fonction `goToImportUrl`)
- Modify: `public/js/main.js` (câblage des écouteurs)
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Produces: `export function openImportUrl()`, `export function closeImportUrl()` (depuis `./import-url.js`) — ouvrent/ferment la vue de saisie, même pattern que `openScanRecipe`/`closeScanRecipe`. Consommés par `ui.js` et `main.js` dans cette tâche.
- Le bouton "Importer" de cette vue est présent (activé dès qu'un texte est saisi dans le champ URL) mais son clic n'est pas encore câblé au réseau à cette étape — câblé en Task 4.

- [ ] **Step 1: Ajouter la section HTML, dans `public/index.html`**

Remplacer :

```html
<!-- ===== VUE SCAN (capture photo pour pré-remplir une recette) ===== -->
<section id="scanView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="scanCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="scanScroll"></div>
</section>
```

par :

```html
<!-- ===== VUE SCAN (capture photo pour pré-remplir une recette) ===== -->
<section id="scanView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="scanCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="scanScroll"></div>
</section>

<!-- ===== VUE IMPORT URL (saisie d'un lien pour pré-remplir une recette) ===== -->
<section id="importUrlView" class="detail-view add-view" aria-hidden="true">
  <button class="detail-close" id="importUrlCloseBtn" type="button" aria-label="Fermer">✕</button>
  <div class="detail-scroll" id="importUrlScroll"></div>
</section>
```

- [ ] **Step 2: Ajouter le bouton de tiroir de navigation, dans `public/index.html`**

Remplacer :

```html
    <button class="drawer-item" id="navScanBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 8.96 4h6.08a1 1 0 0 1 .86.5L16.8 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.8" fill="none"/></svg></span>
      Scanner une recette
    </button>
    <div class="drawer-divider"></div>
```

par :

```html
    <button class="drawer-item" id="navScanBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 8.96 4h6.08a1 1 0 0 1 .86.5L16.8 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/><circle cx="12" cy="13" r="3.5" stroke="currentColor" stroke-width="1.8" fill="none"/></svg></span>
      Scanner une recette
    </button>
    <button class="drawer-item" id="navImportUrlBtn" type="button">
      <span class="drawer-item-icon"><svg viewBox="0 0 24 24" width="19" height="19"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg></span>
      Importer depuis une URL
    </button>
    <div class="drawer-divider"></div>
```

- [ ] **Step 3: Ajouter les exports DOM, dans `public/js/dom.js`**

Remplacer :

```js
export const scanView = document.getElementById("scanView");
export const scanScroll = document.getElementById("scanScroll");
export const scanCloseBtn = document.getElementById("scanCloseBtn");
export const navScanBtn = document.getElementById("navScanBtn");
```

par :

```js
export const scanView = document.getElementById("scanView");
export const scanScroll = document.getElementById("scanScroll");
export const scanCloseBtn = document.getElementById("scanCloseBtn");
export const navScanBtn = document.getElementById("navScanBtn");
export const importUrlView = document.getElementById("importUrlView");
export const importUrlScroll = document.getElementById("importUrlScroll");
export const importUrlCloseBtn = document.getElementById("importUrlCloseBtn");
export const navImportUrlBtn = document.getElementById("navImportUrlBtn");
```

- [ ] **Step 4: Créer `public/js/import-url.js` avec la vue de saisie (sans l'appel réseau)**

```js
import { importUrlView, importUrlScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";

function renderImportUrl(){
  importUrlScroll.innerHTML = `
    <div class="add-topbar">
      <div class="add-topbar-left">
        <button class="menu-btn" id="importUrlMenuBtn" type="button" aria-label="Ouvrir le menu">
          <svg viewBox="0 0 24 24" width="19" height="19"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <h2>Importer depuis une URL</h2>
    </div>
    <div class="add-form">
      <p class="scan-hint">Colle le lien d'une page de recette (Marmiton, CuisineAZ, 750g, HelloFresh...).</p>
      <div class="field">
        <label for="importUrlInput">Adresse de la recette</label>
        <input id="importUrlInput" type="url" placeholder="https://...">
      </div>
      <p id="importUrlError" class="add-error" hidden></p>
      <div class="add-actions">
        <button type="button" class="btn-secondary" id="importUrlCancelBtn">Annuler</button>
        <button type="button" class="btn-primary" id="importUrlSubmitBtn" disabled>Importer</button>
      </div>
    </div>
  `;

  const input = importUrlScroll.querySelector("#importUrlInput");
  const submitBtn = importUrlScroll.querySelector("#importUrlSubmitBtn");

  input.addEventListener("input", () => {
    submitBtn.disabled = !input.value.trim();
  });

  importUrlScroll.querySelector("#importUrlMenuBtn").addEventListener("click", openDrawer);
  importUrlScroll.querySelector("#importUrlCancelBtn").addEventListener("click", requestCloseSheet);
}

export function openImportUrl(){
  renderImportUrl();
  importUrlView.classList.add("is-open");
  importUrlView.setAttribute("aria-hidden", "false");
  importUrlScroll.scrollTop = 0;
  openSheetBackdrop();
  ensureSheetHistoryEntry();
  syncBodyScrollLock();
}

export function closeImportUrl(){
  if (!importUrlView.classList.contains("is-open")) return;
  importUrlView.classList.remove("is-open");
  importUrlView.setAttribute("aria-hidden", "true");
  syncBodyScrollLock();
  closeSheetBackdrop();
}
```

- [ ] **Step 5: Intégrer la vue au verrouillage de scroll et à la fermeture globale, dans `public/js/ui.js`**

Remplacer :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView, photoEditorView } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { closeScanRecipe, openScanRecipe } from "./scan-recipe.js";
import { closePhotoEditor } from "./photo-editor.js";
import { render } from "./grid.js";
```

par :

```js
import { toast, detailView, addView, panierView, drawer, drawerOverlay, sheetBackdrop, chips, favToggleHeader, state, searchInput, scanView, photoEditorView, importUrlView } from "./dom.js";
import { closeDetail } from "./detail.js";
import { closeAddForm, openAddForm } from "./add-form.js";
import { closePanier, openPanier } from "./cart.js";
import { closeProfile } from "./profile.js";
import { closeScanRecipe, openScanRecipe } from "./scan-recipe.js";
import { closeImportUrl, openImportUrl } from "./import-url.js";
import { closePhotoEditor } from "./photo-editor.js";
import { render } from "./grid.js";
```

Remplacer :

```js
export function syncBodyScrollLock(){
  const anyOpen = detailView.classList.contains("is-open")
    || addView.classList.contains("is-open")
    || panierView.classList.contains("is-open")
    || scanView.classList.contains("is-open")
    || photoEditorView.classList.contains("is-open")
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
    || importUrlView.classList.contains("is-open")
    || photoEditorView.classList.contains("is-open")
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
  closeScanRecipe();
  closePhotoEditor();
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
  closeImportUrl();
  closePhotoEditor();
}
```

Remplacer :

```js
export function goToScanRecipe(){
  closeAllOverlays();
  closeDrawer();
  openScanRecipe();
}
```

par :

```js
export function goToScanRecipe(){
  closeAllOverlays();
  closeDrawer();
  openScanRecipe();
}
export function goToImportUrl(){
  closeAllOverlays();
  closeDrawer();
  openImportUrl();
}
```

- [ ] **Step 6: Câbler les écouteurs, dans `public/js/main.js`**

Remplacer :

```js
import {
  state, searchInput, chips, favToggleHeader, addFab, cartToggle,
  menuToggle, drawer, drawerOverlay, drawerCloseBtn,
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
import { render, renderAllergenFilterPanel } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { closeScanRecipe } from "./scan-recipe.js";
import { closePhotoEditor } from "./photo-editor.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
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
  navAllBtn, navFavBtn, navPanierBtn, navAddBtn, navScanBtn, navImportUrlBtn,
  navLogoutBtn, accountToggle,
  detailView, addView, panierView, profileView, scanView, importUrlView, sheetBackdrop,
  detailCloseBtn, addCloseBtn, panierCloseBtn, profileCloseBtn, scanCloseBtn, importUrlCloseBtn, brandHomeBtn,
  allergenFilterToggle, allergenFilterPanel
} from "./dom.js";
import { render, renderAllergenFilterPanel } from "./grid.js";
import { closeDetail } from "./detail.js";
import { openAddForm, closeAddForm } from "./add-form.js";
import { openPanier, closePanier, updateCartBadge, initCartSync, clearCartLocal } from "./cart.js";
import { initRecipesSync, initFavoritesSync, clearFavoritesLocal } from "./recipes-store.js";
import { initPhotosSync } from "./photos.js";
import { closeScanRecipe } from "./scan-recipe.js";
import { closeImportUrl } from "./import-url.js";
import { closePhotoEditor } from "./photo-editor.js";
import { openDrawer, closeDrawer, goToAllRecipes, goToFavoris, goToPanier, goToAddRecipe, goToScanRecipe, goToImportUrl, showToast, requestCloseSheet, resetSheetHistory } from "./ui.js";
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
  if (scanView.classList.contains("is-open")) closeScanRecipe();
  closePhotoEditor();
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
  if (importUrlView.classList.contains("is-open")) closeImportUrl();
  closePhotoEditor();
}
```

Remplacer :

```js
sheetBackdrop.addEventListener("click", requestCloseSheet);
detailCloseBtn.addEventListener("click", requestCloseSheet);
addCloseBtn.addEventListener("click", requestCloseSheet);
panierCloseBtn.addEventListener("click", requestCloseSheet);
profileCloseBtn.addEventListener("click", requestCloseSheet);
scanCloseBtn.addEventListener("click", requestCloseSheet);
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
importUrlCloseBtn.addEventListener("click", requestCloseSheet);
brandHomeBtn.addEventListener("click", goToAllRecipes);
```

Remplacer :

```js
navScanBtn.addEventListener("click", goToScanRecipe);
```

par :

```js
navScanBtn.addEventListener("click", goToScanRecipe);
navImportUrlBtn.addEventListener("click", goToImportUrl);
```

- [ ] **Step 7: Bump `CACHE_NAME` dans `public/sw.js`, et ajouter le nouveau fichier à la liste mise en cache**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v55";
```

par :

```js
const CACHE_NAME = "carnet-cache-v56";
```

Remplacer :

```js
  "./js/scan-recipe.js",
```

par :

```js
  "./js/scan-recipe.js",
  "./js/import-url.js",
```

- [ ] **Step 8: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter.
- Menu → "Importer depuis une URL" → la vue s'ouvre en plein écran (mobile) / dialogue (PC), titre "Importer depuis une URL", bouton "Importer" désactivé tant que le champ est vide.
- Saisir un texte dans le champ → "Importer" devient cliquable ; vider le champ → redevient désactivé.
- Fermer via le ✕ en haut, via "Annuler", et via le bouton retour du navigateur → la vue se ferme proprement dans les trois cas.
- Le bouton "Scanner une recette" reste inchangé et fonctionne toujours (aucune régression du scan photo).
- Aucune erreur console. Le clic sur "Importer" ne fait encore rien de visible à ce stade (normal, câblé en Task 4).

- [ ] **Step 9: Commit**

```bash
git add public/index.html public/js/dom.js public/js/import-url.js public/js/ui.js public/js/main.js public/sw.js
git commit -m "Ajouter la vue de saisie d'URL pour l'import de recette"
```

---

### Task 4: Appel réseau et pré-remplissage, dans `public/js/import-url.js`

**Files:**
- Modify: `public/js/import-url.js`
- Modify: `public/sw.js` (bump `CACHE_NAME`)

**Interfaces:**
- Consumes: `supabase`, `SUPABASE_URL` (depuis `./supabase-client.js`) ; `openAddForm` (depuis `./add-form.js`) ; `sanitizeExtractedRecipe(raw, photoBlob)` (depuis `./scan-recipe.js`, exportée en Task 1).
- Le bouton "Importer" de la vue (Task 3) devient fonctionnel : il appelle la Edge Function `import-recipe-url` (Task 2), transforme sa réponse en `prefillData` via `sanitizeExtractedRecipe`, ferme la vue de saisie et ouvre le formulaire pré-rempli.

- [ ] **Step 1: Ajouter les imports, la conversion de la photo et l'appel réseau, dans `public/js/import-url.js`**

Remplacer :

```js
import { importUrlView, importUrlScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
```

par :

```js
import { importUrlView, importUrlScroll } from "./dom.js";
import { openDrawer, syncBodyScrollLock, openSheetBackdrop, closeSheetBackdrop, ensureSheetHistoryEntry, requestCloseSheet } from "./ui.js";
import { supabase, SUPABASE_URL } from "./supabase-client.js";
import { openAddForm } from "./add-form.js";
import { sanitizeExtractedRecipe } from "./scan-recipe.js";

function base64ToBlob(base64, mimeType){
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

async function importRecipeFromUrl(url){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Non authentifié");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-recipe-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ url })
  });

  if (!res.ok) {
    let detail = "";
    try { const body = await res.json(); detail = body?.error || ""; } catch {}
    throw new Error(detail || `Échec (${res.status})`);
  }
  return res.json();
}
```

- [ ] **Step 2: Câbler le clic du bouton "Importer", dans `renderImportUrl`**

Remplacer :

```js
  importUrlScroll.querySelector("#importUrlMenuBtn").addEventListener("click", openDrawer);
  importUrlScroll.querySelector("#importUrlCancelBtn").addEventListener("click", requestCloseSheet);
}
```

par :

```js
  importUrlScroll.querySelector("#importUrlMenuBtn").addEventListener("click", openDrawer);
  importUrlScroll.querySelector("#importUrlCancelBtn").addEventListener("click", requestCloseSheet);

  submitBtn.addEventListener("click", async () => {
    const url = input.value.trim();
    const errorEl = importUrlScroll.querySelector("#importUrlError");
    errorEl.hidden = true;

    let isValidUrl = false;
    try {
      const parsed = new URL(url);
      isValidUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {}
    if (!isValidUrl) {
      errorEl.textContent = "Cette adresse ne ressemble pas à une URL valide (doit commencer par http:// ou https://).";
      errorEl.hidden = false;
      return;
    }

    submitBtn.disabled = true;
    input.disabled = true;
    submitBtn.textContent = "Analyse en cours…";
    try {
      const raw = await importRecipeFromUrl(url);
      const photoBlob = raw.photo ? base64ToBlob(raw.photo.data, raw.photo.mimeType) : undefined;
      const prefillData = sanitizeExtractedRecipe(raw, photoBlob);
      closeImportUrl();
      openAddForm(null, prefillData);
    } catch (err) {
      console.error("import-url:", err);
      errorEl.textContent = "Impossible d'importer cette page : " + (err.message || "erreur inconnue") + " (réessaie)";
      errorEl.hidden = false;
      submitBtn.textContent = "Importer";
      submitBtn.disabled = false;
      input.disabled = false;
    }
  });
}
```

- [ ] **Step 3: Bump `CACHE_NAME` dans `public/sw.js`**

Remplacer :

```js
const CACHE_NAME = "carnet-cache-v56";
```

par :

```js
const CACHE_NAME = "carnet-cache-v57";
```

- [ ] **Step 4: Vérifier dans le navigateur**

Lancer un serveur local, recharger deux fois, se connecter (nécessite un compte réel — signaler en DONE_WITH_CONCERNS si aucun compte de test n'est disponible, et vérifier ce qui peut l'être statiquement : pas d'erreur de syntaxe, le clic sur "Importer" déclenche bien un appel réseau visible dans l'onglet Réseau même s'il échoue faute de fonction déployée).
- Si la Edge Function de la Task 2 est déjà déployée : coller une URL Marmiton, CuisineAZ, 750g ou HelloFresh réelle, cliquer "Importer" → indicateur "Analyse en cours…", puis le formulaire "Nouvelle recette" s'ouvre pré-rempli (titre, ingrédients, étapes correspondant à la page), photo déjà attachée au champ Photo si la page en avait une.
- Coller une URL vers une page sans JSON-LD (ex. un blog de recette basique) → vérifier que le secours IA prend le relais et que le formulaire se pré-remplit quand même.
- Coller une URL invalide ou un site injoignable → message d'erreur affiché dans la vue, le champ URL reste rempli, "Importer" redevient cliquable pour réessayer.
- Sauvegarder une recette importée → flux de sauvegarde identique à une recette créée manuellement (toast "Recette ajoutée", recette visible dans la grille avec sa photo si trouvée).
- Aucune régression sur le scan photo existant ni sur le formulaire "Nouvelle recette" ouvert normalement.
- Aucune erreur console sur tout le parcours.

- [ ] **Step 5: Commit**

```bash
git add public/js/import-url.js public/sw.js
git commit -m "Brancher l'appel reseau et le pre-remplissage pour l'import de recette par URL"
```
