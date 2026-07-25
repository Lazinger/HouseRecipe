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
- N'invente aucune information absente de la photo.`;

const MAX_GEMINI_ATTEMPTS = 3;
const GEMINI_RETRY_DELAY_MS = 1500;

/* Gemini 3.5 Flash (mode "thinking") tronque parfois sa sortie JSON en plein
   milieu tout en renvoyant finishReason "STOP" (confirmé par diagnostic en
   prod le 2026-07-25, ~1 appel sur 4). Egalement sujet a un 429 (quota) par
   intermittence. Ni l'un ni l'autre n'est evitable cote requete : on reessaie. */
async function callGeminiForJson(requestBody, logPrefix){
  let lastError = "erreur inconnue";
  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
    try {
      const geminiRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!geminiRes.ok) {
        const errBody = await geminiRes.text().catch(() => "");
        lastError = `Gemini a répondu ${geminiRes.status} — ${errBody.slice(0, 500)}`;
        console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): ${lastError}`);
        if (geminiRes.status === 429 && attempt < MAX_GEMINI_ATTEMPTS) {
          await new Promise(r => setTimeout(r, GEMINI_RETRY_DELAY_MS));
        }
        continue;
      }

      const geminiData = await geminiRes.json();
      const parts = geminiData?.candidates?.[0]?.content?.parts || [];
      const textPart = parts.find(p => typeof p.text === "string");
      if (!textPart) {
        lastError = "réponse Gemini sans texte";
        console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): ${lastError} — ${JSON.stringify(geminiData).slice(0, 500)}`);
        continue;
      }

      let extracted;
      try {
        extracted = JSON.parse(textPart.text);
      } catch (e) {
        lastError = `JSON illisible (${e.message})`;
        console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): ${lastError} — texte reçu : ${textPart.text.slice(0, 500)}`);
        continue;
      }
      if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
        lastError = "réponse Gemini invalide (pas un objet)";
        console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): ${lastError}`);
        continue;
      }

      return extracted;
    } catch (err) {
      lastError = String(err);
      console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): exception — ${lastError}`);
    }
  }
  throw new Error(lastError);
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
    } catch {
      return new Response(JSON.stringify({ error: "Échec de l'analyse de la recette" }), {
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
