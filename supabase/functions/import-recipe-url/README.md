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
