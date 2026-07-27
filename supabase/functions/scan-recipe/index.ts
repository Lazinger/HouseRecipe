import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.8";
import { callGeminiForJson, geminiFailureMessage, geminiFailureStatus } from "../_shared/gemini.ts";
import { stripHtmlTags } from "../_shared/sanitize.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

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
  "allergens": string[],
  "ingredients": [string, string][],
  "utensils": string[],
  "steps": string[]
}

Règles :
- "ingredients" est une liste de paires [nom, quantité], ex. ["Oignon jaune", "1"].
- "steps" est la liste des étapes dans l'ordre, texte intégral de chaque étape.
- "category" doit être la plus proche possible parmi "entrée", "plat", "dessert" (la grande majorité des cartes HelloFresh sont des "plat").
- "allergens" est un tableau ne contenant QUE des clés parmi cette liste fixe : "gluten", "crustaces", "oeufs", "poisson", "arachides", "soja", "lait", "fruits-a-coque", "celeri", "moutarde", "sesame", "sulfites", "lupin", "mollusques". N'inclue une clé que si un ingrédient de la recette la contient clairement (ex. farine/pâte → "gluten" ; beurre/crème/lait → "lait" ; œufs → "oeufs" ; amandes/noisettes/noix → "fruits-a-coque"). Tableau vide si aucun allergène identifié ou en cas de doute — ne jamais deviner.
- Si une info n'est pas présente sur la carte (ex. calories), utilise null pour les champs numériques/texte optionnels, ou un tableau vide pour les listes.
- N'invente aucune information absente de la photo.
- Dans "steps", quand une phrase mentionne la quantité d'un ingrédient qui figure dans "ingredients", remplace cette quantité dans le texte par {{qty:NomExactDeLIngredient}} en reprenant le nom exactement comme il apparaît dans "ingredients" (ex. si ingredients contient ["Farine", "400 g"], écris "Ajoutez {{qty:Farine}} de farine" au lieu de "Ajoutez 400 g de farine"). Ne fais JAMAIS ça pour un temps de cuisson, une température, une taille de plat/moule, ou toute quantité qui ne correspond à aucun ingrédient de la liste — ces nombres restent en texte normal.`;

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

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

    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY n'est pas configurée sur ce projet Supabase");
      return new Response(JSON.stringify({ error: "Clé Gemini non configurée" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const imageParts = images.map(img => ({
      inline_data: { mime_type: img.mimeType, data: img.data }
    }));

    // IMPORTANT : vérifier le format exact de requête/réponse actuel sur
    // https://ai.google.dev/gemini-api/docs avant de figer ce code — l'API Gemini
    // a changé plusieurs fois de format courant 2026. Le code ci-dessous cible
    // generateContent sur gemini-3.5-flash (entrée multimodale, sortie texte),
    // avec generationConfig.response_mime_type pour forcer une sortie JSON.
    // Champs en snake_case (inline_data/mime_type/response_mime_type) : c'est le
    // format actuel de l'API REST Gemini, confirmé le 2026-07-23 après un 502 en
    // production causé par l'ancien camelCase (inlineData/mimeType/responseMimeType).
    let extracted;
    try {
      extracted = await callGeminiForJson({
        contents: [{ parts: [{ text: EXTRACTION_PROMPT }, ...imageParts] }],
        generationConfig: { response_mime_type: "application/json" }
      }, "scan-recipe");
    } catch (err) {
      return new Response(JSON.stringify({ error: geminiFailureMessage(err) }), {
        status: geminiFailureStatus(err),
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const sanitized = {
      ...extracted,
      title: stripHtmlTags(extracted.title),
      desc: stripHtmlTags(extracted.desc),
      ingredients: Array.isArray(extracted.ingredients)
        ? extracted.ingredients.map(pair => Array.isArray(pair) ? pair.map(stripHtmlTags) : pair)
        : extracted.ingredients,
      utensils: Array.isArray(extracted.utensils) ? extracted.utensils.map(stripHtmlTags) : extracted.utensils,
      steps: Array.isArray(extracted.steps) ? extracted.steps.map(stripHtmlTags) : extracted.steps
    };

    return new Response(JSON.stringify(sanitized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("scan-recipe:", err);
    return new Response(JSON.stringify({ error: "Erreur inattendue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
