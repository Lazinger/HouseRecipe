# Backend Supabase — recettes partagées, favoris/panier personnels

## Contexte et motivation

Le Carnet est aujourd'hui une app statique 100 % locale (`localStorage` +
IndexedDB), pensée pour un seul appareil. L'objectif à terme est d'avoir
l'app sur le téléphone de l'utilisateur et celui de sa femme (puis
potentiellement 1-2 personnes de plus dans le foyer), avec des
fonctionnalités IA plus tard.

Ce projet se découpe en trois sous-projets indépendants, dans cet ordre :
1. **Backend + synchronisation** (ce document)
2. Empaquetage mobile (installer l'app sur les téléphones — PWA ou Capacitor)
3. Fonctionnalités IA

Ce spec ne couvre que le sous-projet 1. Les sous-projets 2 et 3 auront
leur propre brainstorm/spec le moment venu.

**Décisions issues du brainstorm :**
- Les **recettes** sont partagées entre tous les comptes du foyer (un
  livre de cuisine commun).
- Le **panier** et les **favoris** restent strictement personnels à
  chaque compte.
- Pas de synchronisation temps réel nécessaire — un rafraîchissement à
  l'ouverture de l'app (ou geste "tirer pour actualiser") suffit.
- La consultation hors-ligne des recettes déjà synchronisées doit
  continuer de fonctionner ; les écritures faites hors-ligne sont mises
  en attente et rejouées au retour du réseau.
- Hébergement : Supabase (service géré gratuit à cette échelle), pas
  d'auto-hébergement.
- Aucune donnée existante à migrer (l'utilisateur reparaît avec un jeu de
  données propre côté backend).
- Les 8 recettes intégrées (`RECIPES`) fusionnent avec les recettes
  ajoutées par l'utilisateur en **une seule table partagée et éditable**
  par tous les comptes du foyer — ça simplifie le code (plus de
  distinction `RECIPES`/`customRecipes`/`ALL_RECIPES`) et permet
  d'ajouter photo/nutrition/allergènes aux recettes de base, qui en
  étaient jusqu'ici incapables.
- Comptes fondateurs (utilisateur + femme) créés manuellement dans le
  tableau de bord Supabase. Pour les personnes suivantes, un écran
  d'inscription protégé par **code d'invitation à usage unique**, généré
  à la demande depuis le tableau de bord.

## Architecture générale

- **Supabase** fournit trois briques : base de données Postgres, service
  d'authentification (email + mot de passe), stockage de fichiers
  (photos de recettes).
- **Le site reste zéro build.** Le client JS de Supabase se charge en
  module ES via CDN (`https://esm.sh/@supabase/supabase-js`), au même
  titre que les modules existants du projet — pas de `npm install`.
- **IndexedDB reste** le cache local des données (recettes, panier,
  favoris) et sert aussi de file d'attente pour les écritures faites
  hors-ligne. Sa source de vérité change : avant `localStorage` était la
  vérité, maintenant c'est un cache de ce qui est sur Supabase.
- **Impact minimal sur les modules existants** : `recipes-store.js` et
  `cart.js` gardent leur surface publique actuelle (les fonctions que
  `grid.js`, `detail.js`, `add-form.js`, `ui.js`, `timer.js` appellent
  aujourd'hui) — en interne, elles lisent/écrivent désormais via Supabase
  au lieu de `localStorage`, mais gardent un miroir en mémoire à jour
  (peuplé au démarrage depuis le cache IndexedDB, rafraîchi à la
  synchronisation) pour que les lectures existantes restent synchrones.
  Les autres modules n'ont pas besoin d'être réécrits.
- **Nouveaux modules :**
  - `js/supabase-client.js` — crée et exporte le client Supabase
    (URL + clé publique `anon`, valeurs non secrètes).
  - `js/auth.js` — écran de connexion/inscription, état de session.
  - `js/sync.js` — synchronisation descendante (Supabase → cache
    IndexedDB → miroir mémoire) et file d'attente des écritures
    hors-ligne (voir plus bas).

## Modèle de données (Postgres, avec Row Level Security)

Trois tables de données + une table d'invitation. RLS activé sur toutes.

**`recipes`** (partagée, lecture/écriture par tout compte authentifié du
projet) :
| colonne | type | notes |
|---|---|---|
| id | text (PK) | identifiant existant (slug), ex. `ratatouille` |
| title, category, icon, desc, difficulty, note | text | |
| time, servings | int | |
| ingredients | jsonb | tableau de `[nom, quantité]`, comme aujourd'hui |
| steps | jsonb | tableau de chaînes |
| nutrition | jsonb, nullable | `{calories, protein}` |
| allergens | text, nullable | |
| utensils | jsonb, nullable | tableau de chaînes |
| created_by | uuid, FK auth.users | |
| updated_at | timestamptz | sert à la résolution de conflit (dernière écriture gagne) |

RLS : `USING (auth.uid() IS NOT NULL)` pour SELECT/INSERT/UPDATE/DELETE —
tout compte connecté du projet peut tout lire/écrire, puisque c'est
volontairement un livre de recettes commun sans distinction de rôle.

**`favorites`** (strictement personnelle) : `user_id` (FK auth.users),
`recipe_id` (FK recipes), clé primaire composite. RLS :
`USING (user_id = auth.uid())`.

**`cart_state`** (strictement personnelle, une ligne par compte) :
`user_id` (PK, FK auth.users), `items` (jsonb — équivalent de l'actuel
`carnet-panier`), `checked` (jsonb — équivalent de l'actuel
`carnet-panier-coche`), `updated_at`. RLS : `USING (user_id = auth.uid())`.

**`invite_codes`** : `code` (text, PK), `created_at`, `used_by` (uuid,
nullable, FK auth.users), `used_at` (nullable). Un code est valide s'il
existe et que `used_by IS NULL`.

**Photos** : bucket Supabase Storage `recipe-photos`, chemin
`{recipe_id}.jpg` pour la photo principale et
`{recipe_id}/step-{index}.jpg` pour les photos d'étape (adapté du schéma
actuel `recipeId::step::index` d'IndexedDB, avec des `/` au lieu de
`::` puisque Storage organise nativement par chemin).

## Synchronisation & mode hors-ligne

- **Au chargement de l'app** (et sur demande via "tirer pour actualiser"
  ou un bouton) : `sync.js` récupère `recipes`, les `favorites` et le
  `cart_state` du compte connecté depuis Supabase, les écrit dans le
  cache IndexedDB, et met à jour le miroir mémoire que lisent
  `grid.js`/`detail.js`/etc.
- **Écritures** (ajouter/modifier/supprimer une recette, cocher un
  article, ajouter un favori) :
  - En ligne : écrit directement sur Supabase, puis répercute sur le
    cache local et le miroir mémoire.
  - Hors-ligne : l'action s'applique immédiatement en local (l'app ne
    bloque jamais l'utilisateur) et l'opération est ajoutée à une **file
    d'attente** dans IndexedDB (`{type, payload, horodatage}`) ; la file
    se vide automatiquement à la reconnexion (écoute de l'événement
    `online` + tentative à chaque ouverture de l'app).
- **Résolution de conflit** : la modification la plus récente gagne
  (comparaison de `updated_at`), sans fusion ni interface de résolution
  — un choix volontairement simple, suffisant pour un foyer de 2 à 4
  personnes où les modifications simultanées de la même recette sont
  rares.
- **Photos** : à l'upload, envoyées à Supabase Storage *et* mises en
  cache localement dans IndexedDB (comme aujourd'hui) pour un affichage
  instantané même hors-ligne. À la synchronisation descendante, toute
  photo référencée par une recette mais absente du cache local est
  téléchargée et mise en cache.

## Authentification

- Écran de connexion plein écran (même gabarit que les vues actuelles
  panier/ajout) : email + mot de passe, via
  `supabase.auth.signInWithPassword`.
- **Écran d'inscription** (accessible depuis l'écran de connexion) :
  email, mot de passe, code d'invitation. Le code est vérifié
  **côté serveur** via une Edge Function Supabase (une fonction hébergée
  par Supabase, pas un serveur à maintenir) qui :
  1. vérifie que le code existe et n'a pas déjà servi,
  2. si valide, crée le compte via l'API d'administration (clé
     `service_role`, gardée secrète côté Edge Function uniquement — le
     mot de passe n'est jamais visible du site) avec l'email
     pré-confirmé (pas d'email de confirmation à cliquer),
  3. marque le code comme utilisé.
  Une vérification faite uniquement côté site pourrait être contournée
  (n'importe qui avec les outils de développement pourrait appeler
  Supabase directement) — d'où la nécessité de cette étape serveur.
- Les deux comptes fondateurs (l'utilisateur et sa femme) sont créés
  directement dans le tableau de bord Supabase, sans passer par l'écran
  d'inscription.
- Génération d'un code d'invitation pour une 3e/4e personne : une ligne
  ajoutée dans `invite_codes` depuis le tableau de bord Supabase (Table
  Editor), à partager ensuite par SMS/message.
- La session reste ouverte automatiquement (gérée nativement par le
  client Supabase, comme n'importe quelle app) — pas de reconnexion à
  chaque visite.

## Gestion des erreurs

- Échec réseau pendant une synchronisation ou un envoi : non bloquant,
  l'opération part dans la file d'attente hors-ligne, aucune alerte
  intrusive (cohérent avec le style actuel de l'app — ex. les fonctions
  photo échouent déjà silencieusement en arrière-plan).
- Échec de connexion (mauvais mot de passe, code d'invitation invalide) :
  message d'erreur affiché directement sur le formulaire concerné.
- Conflit d'écriture : résolu silencieusement par "dernière modification
  gagne", sans notification à l'utilisateur (choix assumé, voir section
  Synchronisation).

## Vérification

Comme pour le découpage en modules ES, vérification manuelle dans le
navigateur contre un vrai projet Supabase (celui que l'utilisateur vient
de créer) plutôt que des tests automatisés : parcours complet
connexion/déconnexion, ajout/modif/suppression de recette visible sur
"les deux comptes" (deux sessions de navigateur distinctes simulant les
deux téléphones), panier/favoris bien cloisonnés par compte,
comportement hors-ligne (couper le réseau, vérifier la consultation et
la mise en file d'attente, reconnecter, vérifier la synchronisation),
inscription par code d'invitation (valide, invalide, déjà utilisé).

## Hors périmètre de ce spec

- Empaquetage mobile (Capacitor/PWA) — sous-projet suivant.
- Fonctionnalités IA — sous-projet ultérieur.
- Synchronisation temps réel (techniquement disponible nativement chez
  Supabase si le besoin apparaît plus tard, mais pas nécessaire
  aujourd'hui).
- Migration de données existantes (aucune donnée à conserver).
