# Import de recette depuis une URL — Design

**Date :** 2026-07-21
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Le Carnet dispose déjà d'un import de recette par photo (scan d'une carte HelloFresh via l'IA Gemini, cf. `docs/superpowers/specs/2026-07-20-recipe-scan-design.md`). Beaucoup de recettes viennent aussi de sites web (Marmiton, CuisineAZ, 750g, HelloFresh en ligne...). Aujourd'hui, importer une recette depuis un lien demande de tout retaper à la main. L'objectif est un second point d'entrée d'import, "Importer depuis une URL", qui colle une adresse de page recette et pré-remplit le formulaire "Nouvelle recette".

## Portée

- Nouveau point d'entrée "Importer depuis une URL" dans le tiroir de navigation, à côté de "Scanner une recette" (deux entrées séparées, chacune ouvre sa propre vue). Visible pour tous les comptes du foyer, comme le scan.
- Sites visés en priorité : sites grand public français (Marmiton, CuisineAZ, 750g, etc.) et HelloFresh en ligne. Ces sites publient quasi systématiquement leurs recettes en données structurées `schema.org/Recipe` (JSON-LD) pour leur référencement — c'est le cas nominal à optimiser.
- Extraction envoyée à une nouvelle Supabase Edge Function (`import-recipe-url`) qui :
  1. Récupère le HTML de la page côté serveur.
  2. Cherche et mappe un bloc JSON-LD `Recipe` s'il existe (pas d'appel IA, gratuit et instantané).
  3. À défaut (JSON-LD absent ou insuffisant), bascule en secours sur une extraction par IA (Gemini, même modèle et même principe que le scan photo), à partir du texte de la page.
- Si le JSON-LD contient une image de la recette, elle est téléchargée côté serveur et devient automatiquement la photo principale pré-remplie (même mécanisme que la première photo du scan). Un échec de téléchargement de l'image n'empêche pas le reste de l'extraction.
- Le résultat pré-remplit le formulaire "Nouvelle recette" existant — **aucune sauvegarde automatique**, l'utilisateur relit/corrige puis valide comme aujourd'hui.
- **Hors périmètre pour cette version :** parsing fin des quantités d'ingrédients (schema.org les donne en une seule chaîne "200 g de farine", pas séparée nom/quantité — on laisse la chaîne entière dans le champ nom, l'utilisateur sépare à la main s'il le souhaite) ; contournement des sites qui bloquent activement le scraping (Cloudflare, pages qui ne rendent leur contenu qu'en JS côté client) — ces cas tombent dans le chemin d'erreur générique.

## Architecture

Même schéma que `scan-recipe` : une Supabase Edge Function garde la clé Gemini côté serveur, le client ne parle jamais directement à l'API Gemini.

**`supabase/functions/import-recipe-url/index.ts`** (nouveau) :
- Exige un header `Authorization: Bearer <jwt>` valide (n'importe quel compte du foyer, vérifié via `supabase.auth.getUser()`), même contrôle que `scan-recipe`.
- Reçoit `{ url: string }` en JSON. Valide que c'est une URL `http://` ou `https://` bien formée ; sinon `400`.
- Récupère la page (`fetch(url)`, avec un timeout d'environ 10 secondes pour éviter de bloquer la fonction sur un site qui ne répond pas).
- **Chemin JSON-LD (nominal)** : recherche dans le HTML un ou plusieurs `<script type="application/ld+json">`, parse leur contenu, et cherche un objet dont `@type` vaut (ou contient) `"Recipe"` — éventuellement niché dans un tableau ou sous une clé `@graph`. Si trouvé, mappe les champs schema.org vers notre schéma interne :
  - `name` → `title`
  - `recipeCategory` → tentative de correspondance approximative vers `"entrée" | "plat" | "dessert"` (mots-clés simples) ; à défaut, laissé vide (l'utilisateur choisit dans le formulaire, comme quand le scan photo ne trouve pas la catégorie).
  - `description` → `desc`
  - `prepTime` / `cookTime` / `totalTime` (format ISO 8601, ex. `PT25M`, `PT1H30M`) → converti en minutes pour `time` (utilise `totalTime` si présent, sinon la somme de `prepTime` + `cookTime`).
  - `recipeYield` → premier nombre entier trouvé, pour `servings`.
  - `nutrition.calories` / `nutrition.proteinContent` (chaînes du type "320 kcal", "12 g") → premier nombre trouvé, pour `calories` / `protein`.
  - `recipeIngredient` (liste de chaînes complètes, ex. "200 g de farine") → chaque chaîne devient une paire `[chaîne_complète, ""]` (pas de séparation nom/quantité automatique, cf. Portée).
  - `recipeInstructions` (liste de chaînes, ou d'objets `HowToStep`/`HowToSection` avec un champ `text`, ou parfois une seule chaîne) → normalisé en liste de chaînes.
  - `tool` / `recipeEquipment` si présent → `utensils` ; sinon liste vide.
  - `difficulty`, `allergens` : pas de champ standard schema.org équivalent → laissés vides par défaut (comme le scan photo quand l'info est absente de la carte).
  - `image` (chaîne, liste, ou objet `ImageObject` avec `url`) → si une URL d'image est trouvée, elle est téléchargée par la Edge Function (nouvelle requête `fetch`, avec le même timeout) et encodée en base64 pour être renvoyée au client (`photo: { mimeType, data } | null`). Un échec de ce téléchargement (timeout, 404, format non reconnu) est absorbé silencieusement : `photo` reste `null`, le reste de la réponse n'est pas affecté.
  - Un objet Recipe JSON-LD est considéré **suffisant** s'il fournit au moins un titre et au moins un ingrédient ou une étape ; sinon on bascule au chemin de secours.
- **Chemin de secours (IA)** : si aucun JSON-LD `Recipe` exploitable n'est trouvé, le HTML est réduit à son texte visible (suppression des balises `script`/`style`/`nav`/`footer` et des tags), puis envoyé à Gemini (`gemini-3.5-flash`, `generateContent`, `responseMimeType: "application/json"`) avec un prompt d'extraction adapté de celui du scan photo (mêmes champs de sortie, mais formulé pour du texte de page web plutôt que des photos). Même validation du JSON reçu que dans `scan-recipe` (rejet si pas un objet exploitable). Ce chemin ne télécharge pas d'image (pas d'`image` fiable à extraire du texte brut) — `photo` reste `null`.
- Répond soit le JSON structuré (`{ ...champs recette, photo }`, 200), soit `{ error: string }` (4xx/5xx) — même contrat d'erreur que `scan-recipe`.
- Inclut un champ `source: "jsonld" | "ai"` dans la réponse 200, utile pour vérifier manuellement quel chemin a été pris pendant les tests (ignoré sans risque côté client, `sanitizeExtractedRecipe` ne lit que les champs qu'elle connaît).
- Détail exact du mapping (liste de mots-clés pour `recipeCategory`, profondeur de recherche du JSON-LD dans `@graph`, regex de parsing des durées ISO 8601) laissé au plan d'implémentation.

## Composants côté client

- **`public/js/import-url.js`** (nouveau), sur le pattern de `scan-recipe.js` :
  - Vue plein écran (pattern `.detail-view` déjà utilisé ailleurs) avec un champ texte pour l'URL, un bouton "Importer" (actif dès qu'un texte est saisi), un état de chargement pendant l'appel réseau, un message d'erreur inline.
  - `async function importRecipeFromUrl(url)` — lit la session Supabase, POST `{ url }` vers `import-recipe-url`, renvoie le JSON structuré ou lève une erreur (même structure que `scanRecipeImages` dans `scan-recipe.js`).
  - Si `photo` est présent dans la réponse, décode le base64 en `Blob` et l'attache au champ Photo du formulaire via la même astuce `DataTransfer` que le scan photo.
  - En cas d'échec réseau/API : message d'erreur affiché, le champ URL reste rempli pour corriger et réessayer.
- **`public/js/scan-recipe.js`** : `sanitizeExtractedRecipe` passe de fonction privée à `export function`, pour être réutilisée telle quelle par `import-url.js` (même schéma de sortie entre les deux flux d'import, pas de duplication de logique de validation/nettoyage).
- **Point d'entrée** : nouveau bouton "Importer depuis une URL" ajouté au tiroir de navigation (`ui.js`/`dom.js`), à côté de "Scanner une recette", ouvre la nouvelle vue.
- **`public/sw.js`** : bump `CACHE_NAME` (nouveau fichier à mettre en cache).

## Flux de données

1. Utilisateur tape "Importer depuis une URL" → la vue de saisie s'ouvre.
2. Colle ou tape l'adresse de la page recette, tape "Importer".
3. L'URL part vers `import-recipe-url`, qui tente le chemin JSON-LD puis, à défaut, le secours IA, et renvoie le JSON structuré (+ photo éventuelle) ou une erreur.
4. Le formulaire "Nouvelle recette" s'ouvre, pré-rempli avec ce JSON (même fonction `sanitizeExtractedRecipe` que le scan photo) ; la photo trouvée, si elle existe, est déjà attachée au champ Photo.
5. L'utilisateur relit, corrige si besoin, clique "Enregistrer" — flux de sauvegarde identique à aujourd'hui à partir de là (aucune modification de `saveRecipe`/`savePhoto`).

## Gestion des erreurs

- URL vide ou manifestement mal formée (pas de `http(s)://`) → validation inline côté client, aucune requête envoyée.
- Page inaccessible (404, timeout, site qui bloque le fetch serveur, réponse non-HTML) → toast "Impossible de récupérer cette page, vérifie l'URL", le champ URL reste rempli pour réessayer.
- JSON-LD absent/insuffisant et échec du secours IA (quota Gemini dépassé, panne, timeout) → toast "Impossible d'analyser cette page, réessaie".
- Réponse IA malformée/non-JSON en secours → validée et rejetée côté Edge Function, même toast générique.
- Page récupérée mais aucune recette exploitable trouvée (ni JSON-LD ni IA concluante) → le formulaire s'ouvre quand même, pré-rempli au mieux (ou presque vide) ; la validation existante (`validateNewRecipe`, titre/catégorie/ingrédients/étapes obligatoires) bloque déjà la sauvegarde si l'essentiel manque — aucun cas particulier à coder, même philosophie que le scan photo.
- Échec du téléchargement de l'image JSON-LD → absorbé silencieusement, la recette se pré-remplit sans photo, pas d'erreur affichée à l'utilisateur pour ce point précis.

## Contrainte connue : quota partagé

Le secours IA utilise le même modèle et la même clé (`gemini-3.5-flash`, quota gratuit ~20 requêtes/jour partagé entre tous les comptes du foyer) que le scan photo — les deux fonctionnalités puisent dans le même quota quand l'IA est sollicitée. Le chemin JSON-LD, attendu comme majoritaire pour les sites ciblés, ne consomme pas ce quota. Pas de garde-fou technique prévu (pas de compteur/quota côté app) — à revisiter si l'usage combiné devient un problème réel.

## Déploiement

Même processus manuel que `scan-recipe` : `supabase functions deploy import-recipe-url`. Réutilise le secret `GEMINI_API_KEY` déjà configuré côté projet Supabase (partagé avec `scan-recipe`), aucune nouvelle clé à créer.

## Vérification

Pas de suite de tests automatisée dans ce projet — vérification manuelle dans le navigateur :
- Sans la fonction déployée : la vue de saisie d'URL s'affiche, le bouton "Importer" reste désactivé sans texte saisi, une URL manifestement invalide est bloquée côté client.
- Une fois déployée : tester une URL Marmiton, une CuisineAZ, une 750g et une HelloFresh en ligne — vérifier via les logs de la fonction que `source: "jsonld"` est bien pris (pas d'appel Gemini), que chaque champ est bien mappé (titre, catégorie, temps, personnes, ingrédients, étapes, calories/protéines si présents), et que la photo se retrouve bien attachée au formulaire.
- Tester une page sans JSON-LD exploitable (ex. un blog de recette basique) → vérifier que `source: "ai"` est renvoyé et que le résultat reste exploitable.
- Tester une URL invalide et un site injoignable/qui bloque le fetch → toast d'erreur affiché, champ URL conservé.
- Tester le cas où l'image JSON-LD ne se télécharge pas (URL d'image cassée) → la recette se pré-remplit quand même, sans photo, sans erreur bloquante.
- Aucune régression sur le scan photo existant, ni sur le formulaire "Nouvelle recette" ouvert normalement, ni sur l'édition d'une recette existante.
