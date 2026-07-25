const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const MAX_GEMINI_ATTEMPTS = 3;
const GEMINI_RETRY_DELAY_MS = 1500;

/* Gemini 3.5 Flash (mode "thinking") tronque parfois sa sortie JSON en plein
   milieu tout en renvoyant finishReason "STOP" (confirmé par diagnostic en
   prod le 2026-07-25, ~1 appel sur 4). Egalement sujet a un 429 (quota) par
   intermittence. Ni l'un ni l'autre n'est evitable cote requete : on reessaie.
   Partagé entre scan-recipe et import-recipe-url — ne pas dupliquer. */
export async function callGeminiForJson(requestBody, logPrefix){
  let lastError = "erreur inconnue";
  let lastCode = "unknown";
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
        lastCode = geminiRes.status === 429 ? "rate_limited" : "upstream_error";
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
        lastCode = "malformed_response";
        console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): ${lastError} — ${JSON.stringify(geminiData).slice(0, 500)}`);
        continue;
      }

      let extracted;
      try {
        extracted = JSON.parse(textPart.text);
      } catch (e) {
        lastError = `JSON illisible (${e.message})`;
        lastCode = "malformed_response";
        console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): ${lastError} — texte reçu : ${textPart.text.slice(0, 500)}`);
        continue;
      }
      if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
        lastError = "réponse Gemini invalide (pas un objet)";
        lastCode = "malformed_response";
        console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): ${lastError}`);
        continue;
      }

      return extracted;
    } catch (err) {
      lastError = String(err);
      lastCode = "network";
      console.error(`${logPrefix} (tentative ${attempt}/${MAX_GEMINI_ATTEMPTS}): exception — ${lastError}`);
    }
  }
  const error = new Error(lastError);
  error.code = lastCode;
  throw error;
}

export function geminiFailureMessage(err){
  const code = err?.code;
  if (code === "rate_limited") return "Le service d'analyse est très sollicité, réessaie dans une minute.";
  if (code === "malformed_response") return "Le service d'analyse a renvoyé une réponse incomplète, réessaie.";
  return "Échec de l'analyse, réessaie.";
}

export function geminiFailureStatus(err){
  return err?.code === "rate_limited" ? 429 : 502;
}
