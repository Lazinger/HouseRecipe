# Scan de recette par photo (Gemini) — Design

**Date :** 2026-07-20
**Statut :** approuvé, prêt pour le plan d'implémentation

## Contexte

Les recettes du foyer viennent en grande partie de cartes HelloFresh (imprimées, mise en page standardisée : photo du plat, ingrédients avec quantités par nombre de personnes, ustensiles, étapes numérotées, souvent un panneau nutrition + allergènes). Aujourd'hui, ajouter une recette au Carnet demande de tout retaper à la main dans le formulaire. L'objectif est un bouton "Scanner une recette" qui prend une ou plusieurs photos de la carte, envoie ça à une IA de vision, et pré-remplit le formulaire "Nouvelle recette" avec le résultat.

Précédent direct : une fonctionnalité de génération d'image de recette par IA (Gemini) a été construite, déployée, puis entièrement annulée le 2026-07-20 — le quota gratuit de tous les modèles Gemini de génération d'image s'est révélé nul pour ce compte (confirmé sur le tableau de bord officiel). Cette fois, le modèle visé (**Gemini 3.5 Flash**, multimodal texte+image en entrée, texte en sortie) a un quota gratuit réel et déjà utilisé sur ce même compte (~20 requêtes/jour) — vérifié avant de se lancer, contrairement à la dernière fois.

## Portée

- Un nouveau point d'entrée dédié "Scanner une recette" (menu/tiroir de nav), visible pour **tous les comptes du foyer** (pas de restriction admin — c'est un outil de saisie, pas une action privilégiée).
- Capture de **1 à 4 photos** par scan (recto plat + verso ingrédients/étapes typiquement).
- Extraction envoyée à une nouvelle Supabase Edge Function (`scan-recipe`) qui appelle Gemini 3.5 Flash côté serveur (clé API jamais exposée au client, même principe que la fonction précédente).
- Le résultat pré-remplit le formulaire "Nouvelle recette" existant — **aucune sauvegarde automatique**, l'utilisateur relit/corrige puis valide comme aujourd'hui.
- La première photo capturée devient automatiquement la photo principale de la recette (attachée au champ Photo du formulaire).
- **Hors périmètre pour cette version :** découpage automatique des petites photos par étape depuis la carte scannée (demanderait des coordonnées de recadrage, plus incertain) — les photos d'étape restent à ajouter à la main comme aujourd'hui, si souhaité.

## Architecture

Même schéma que la fonctionnalité IA précédente (avant son annulation) : une Supabase Edge Function garde la clé Gemini côté serveur, le client ne parle jamais directement à l'API Gemini.

**`supabase/functions/scan-recipe/index.ts`** (nouveau) :
- Exige un header `Authorization: Bearer <jwt>` valide (n'importe quel compte du foyer, vérifié via `supabase.auth.getUser()` — pas de restriction par email comme pour l'ancien bouton admin).
- Reçoit `{ images: string[] }` (1 à 4 images en base64, avec leur type MIME) en JSON.
- Construit un prompt décrivant précisément le schéma JSON attendu (titre, catégorie, difficulté, description courte, temps en minutes, nombre de personnes, calories, protéines en g, allergènes, ingrédients `[nom, quantité]`, ustensiles, étapes) et l'envoie à `gemini-3.5-flash` via `generateContent` (`/v1beta/`), chaque image en `inlineData`.
- Utilise la sortie JSON contrainte de l'API (`generationConfig.responseMimeType: "application/json"`, et un `responseSchema` si le modèle le supporte encore au moment d'implémenter — **à revérifier sur `https://ai.google.dev/gemini-api/docs` au moment de coder**, l'API a déjà changé de format plusieurs fois en 2026) pour fiabiliser le parsing.
- Valide le JSON reçu de Gemini avant de le renvoyer au client (structure minimale attendue : au moins un objet, pas un texte libre) ; renvoie une erreur claire si le parsing échoue.
- Répond soit le JSON structuré (200), soit `{ error: string }` (4xx/5xx) — même contrat d'erreur que l'ancienne fonction.

## Composants côté client

- **`public/js/scan-recipe.js`** (nouveau) :
  - Vue de capture plein écran, sur le pattern `.detail-view` déjà utilisé par les autres vues (fiche recette, formulaire, panier, profil).
  - Miniatures des photos déjà prises, bouton "+ Ajouter une photo" (déclenche `<input type="file" accept="image/*" capture="environment">` à chaque tap, désactivé au-delà de 4 photos), bouton "Extraire" (actif dès qu'il y a au moins 1 photo), état de chargement pendant l'appel réseau.
  - `async function scanRecipeImages(imageFiles)` — lit la session Supabase, encode les images en base64, POST vers `scan-recipe`, renvoie le JSON structuré ou lève une erreur.
  - En cas d'échec réseau/API : toast d'erreur, **les photos déjà prises restent affichées** pour relancer l'extraction sans tout reprendre en photo.
- **Point d'entrée** : bouton "Scanner une recette" ajouté au tiroir de navigation (`ui.js`/`dom.js`), ouvre la vue de capture.
- **`public/js/add-form.js`** : ajustement pour distinguer deux usages de pré-remplissage jusqu'ici confondus dans le seul paramètre `editingRecipe` — le mode "édition d'une recette existante" (titre "Modifier la recette", logique de photo existante/suppression, `id` réel) et ce nouveau mode "nouvelle recette pré-remplie" (titre "Nouvelle recette", pas d'`id`, pas de logique "garder la photo actuelle"). Détail exact laissé au plan d'implémentation.
- **`public/sw.js`** : bump `CACHE_NAME` (nouveaux fichiers à mettre en cache).

## Flux de données

1. Utilisateur tape "Scanner une recette" → vue de capture s'ouvre.
2. Prend 1 à 4 photos de la carte.
3. Tape "Extraire" → les photos partent vers `scan-recipe`, qui renvoie le JSON structuré (ou une erreur).
4. Le formulaire "Nouvelle recette" s'ouvre, pré-rempli avec ce JSON ; la première photo capturée est déjà attachée au champ Photo (via l'astuce `DataTransfer` pour peupler l'`<input type="file">` sans toucher au code de sauvegarde existant : `const dt = new DataTransfer(); dt.items.add(new File([blob], "scan.jpg", { type: blob.type })); input.files = dt.files;`).
5. L'utilisateur relit, corrige si besoin, clique "Enregistrer" — flux de sauvegarde identique à aujourd'hui à partir de là (aucune modification de `saveRecipe`/`savePhoto`).

## Gestion des erreurs

- Permission caméra refusée / capture annulée → rien ne se passe, aucune photo ajoutée, l'utilisateur reste sur l'écran de capture.
- Échec réseau ou API (quota Gemini dépassé, panne, timeout) → toast "Impossible d'analyser ces photos, réessaie", photos déjà prises conservées.
- Réponse Gemini malformée/non-JSON → validée et rejetée côté Edge Function, même toast générique côté client.
- Photos qui ne représentent pas vraiment une recette → l'extraction peut renvoyer un JSON quasi vide ; le formulaire s'ouvre quand même pré-rempli (ou presque vide), la validation existante (titre/catégorie/ingrédients/étapes obligatoires dans `validateNewRecipe`) bloque déjà la sauvegarde si l'essentiel manque — aucun cas particulier à coder.

## Contrainte connue : quota partagé

Le quota gratuit de `gemini-3.5-flash` observé sur le compte du projet est de l'ordre de **20 requêtes/jour**, partagé entre tous les comptes du foyer (une seule clé API pour tout le projet Supabase). Largement suffisant pour scanner quelques recettes de temps en temps, insuffisant pour numériser tout un classeur de cartes en une soirée. Pas de garde-fou technique prévu pour cette version (pas de compteur/quota côté app) — si ça devient un problème d'usage réel, à revisiter.

## Déploiement

Même processus manuel que la fonction précédente, réservé à l'utilisateur (documenté dans `supabase/functions/scan-recipe/README.md`, écrit en même temps que la fonction) :
1. `supabase functions deploy scan-recipe`
2. Le secret `GEMINI_API_KEY` est déjà configuré côté projet Supabase (créé pour la fonctionnalité précédente puis retiré lors de son annulation) — à reconfigurer si besoin, la clé Gemini de l'utilisateur restant la même.

## Vérification

Pas de suite de tests automatisée dans ce projet — vérification manuelle dans le navigateur :
- Sans la fonction déployée : l'écran de capture s'affiche, les vignettes s'accumulent correctement jusqu'à 4, le bouton "Extraire" reste désactivé sans photo.
- Le formulaire pré-rempli s'ouvre bien en mode "Nouvelle recette" (pas "Modifier la recette"), sans dépendre du serveur pour ce test.
- Une fois déployée avec la clé Gemini : scan d'une vraie carte HelloFresh (recto + verso), vérifier le mapping de chaque champ (titre, catégorie, temps, personnes, ingrédients avec quantités, ustensiles, étapes, et si présents calories/protéines/allergènes), vérifier que la première photo est bien attachée au champ Photo.
- Tester le chemin d'échec (couper le réseau pendant l'extraction, ou dépasser le quota) : toast d'erreur affiché, photos toujours présentes, possibilité de réessayer.
- Aucune régression sur le formulaire "Nouvelle recette" ouvert normalement (sans passer par le scan) ni sur l'édition d'une recette existante.
