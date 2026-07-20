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
