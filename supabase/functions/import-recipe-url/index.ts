import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT_MS = 10000;
const MAX_PAGE_BYTES = 5 * 1024 * 1024; // 5 Mo
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 Mo

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

/* ---- garde anti-SSRF : refuse les hôtes internes/privés ---- */
function isBlockedHost(hostname){
  let host = (hostname || "").toLowerCase().replace(/\.$/, "");
  // une adresse IPv6 littérale issue de URL#hostname est entourée de crochets, ex. "[::1]"
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  if (host === "localhost" || host === "0.0.0.0" || host === "::1") return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some(o => o > 255)) return false;
    const [a, b] = octets;
    if (a === 127) return true; // boucle locale 127.0.0.0/8
    if (a === 10) return true; // privé 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // privé 172.16.0.0/12
    if (a === 192 && b === 168) return true; // privé 192.168.0.0/16
    if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16
    return false;
  }

  if (host.includes(":")) {
    // adresse IPv6 littérale
    if (/^fc/.test(host) || /^fd/.test(host)) return true; // unique-local fc00::/7
    if (/^fe[89ab]/.test(host)) return true; // link-local fe80::/10
  }

  return false;
}

/* ---- lecture bornée d'un corps de réponse, pour éviter un pic mémoire ---- */
async function readWithLimit(res, maxBytes){
  if (!res.body) {
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new Error("Réponse trop volumineuse");
    return new Uint8Array(buffer);
  }

  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // on ignore l'erreur d'annulation, on va throw de toute façon
        }
        throw new Error("Réponse trop volumineuse");
      }
      chunks.push(value);
    }
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
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
    const parsedImageUrl = new URL(imageUrl);
    if (parsedImageUrl.protocol !== "http:" && parsedImageUrl.protocol !== "https:") return null;
    if (isBlockedHost(parsedImageUrl.hostname)) return null;

    const res = await fetchWithTimeout(parsedImageUrl.toString());
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    const bytes = await readWithLimit(res, MAX_IMAGE_BYTES);
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
      if (isBlockedHost(pageUrl.hostname)) throw new Error("hôte interdit");
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
      const pageBytes = await readWithLimit(pageRes, MAX_PAGE_BYTES);
      html = new TextDecoder().decode(pageBytes);
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
