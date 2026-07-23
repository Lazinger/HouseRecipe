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
          generationConfig: { response_mime_type: "application/json" }
        })
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text().catch(() => "");
      console.error(`scan-recipe: Gemini a répondu ${geminiRes.status} — ${errBody.slice(0, 500)}`);
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
    console.error("scan-recipe:", err);
    return new Response(JSON.stringify({ error: "Erreur inattendue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
