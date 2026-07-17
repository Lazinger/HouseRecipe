# B5 — Inscription par code d'invitation

Date : 2026-07-17
Statut : approuvé, prêt pour plan d'implémentation

## Contexte

Aujourd'hui, seuls deux comptes existent, créés manuellement par l'utilisateur via le tableau de bord Supabase (Authentication → Users → Add user, avec "Auto Confirm User" coché). L'app n'a aucun formulaire d'inscription — `js/auth.js` n'affiche qu'un formulaire de connexion. Pour agrandir le foyer à 3-4 comptes, il faut aujourd'hui répéter cette manipulation manuelle à chaque fois.

B5 ajoute une inscription en libre-service dans l'app, protégée par un code d'invitation à usage unique. La table `invite_codes` existe déjà depuis le Plan A (schéma : `code text primary key, created_at, used_by uuid, used_at`), RLS activé, **zéro policy** — elle a été délibérément laissée verrouillée en attendant ce plan.

## Décisions validées

- **Génération des codes** : un bouton dans l'écran "Mon compte", visible et utilisable uniquement par le compte de l'utilisateur principal (email `jerem.r30@gmail.com`, vérifié côté serveur).
- **Niveau de rigueur du gate** : côté application uniquement. Le code protège l'écran d'inscription normal de l'app ; il n'empêche pas techniquement un utilisateur très déterminé d'appeler l'API Supabase directement pour créer un compte sans code (nécessiterait les Auth Hooks Supabase, jugé disproportionné pour ce contexte : foyer privé, dépôt GitHub privé, cible de faible valeur). Un compte créé avec un code invalide reste utilisable — la validation est un gate UX, pas un verrou technique bloquant l'accès aux données.
- **Confirmation email** : activée sur ce projet Supabase. Le flux d'inscription doit donc gérer le délai entre la création du compte et sa confirmation par email, avant de pouvoir valider le code (voir Flux ci-dessous).

## Architecture Supabase (fonctions `SECURITY DEFINER`)

`invite_codes` reste sans policy RLS. Deux fonctions Postgres, ajoutées à `supabase/schema.sql` dans le même style que le reste du fichier, contournent RLS de façon contrôlée :

```sql
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if auth.email() is distinct from 'jerem.r30@gmail.com' then
    raise exception 'not authorized';
  end if;
  new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into public.invite_codes (code) values (new_code);
  return new_code;
end;
$$;

create or replace function public.redeem_invite_code(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.invite_codes
    set used_by = auth.uid(), used_at = now()
    where code = input_code and used_by is null;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;
```

- `generate_invite_code()` : vérifie l'email exact de l'appelant (comparaison codée en dur — acceptable pour un foyer à une seule personne administratrice ; à ajuster manuellement si l'email change un jour), génère un code aléatoire de 8 caractères, l'insère, le retourne.
- `redeem_invite_code(code)` : nécessite une session authentifiée (`auth.uid()`), marque le code utilisé de façon atomique via la clause `where ... and used_by is null` (empêche toute double-utilisation, y compris en cas d'appel simultané), retourne `true`/`false` selon que le code était valide et disponible.

Comme pour B4, ce SQL doit être exécuté manuellement par l'utilisateur dans le SQL Editor Supabase.

## Flux d'inscription

1. Sur l'écran de connexion (`authScroll`), un lien "Pas encore de compte ? Créer un compte" bascule l'affichage vers un formulaire d'inscription : prénom, nom, email, mot de passe, code d'invitation. Un lien symétrique "Déjà un compte ? Se connecter" permet de revenir en arrière.
2. À la soumission : `supabase.auth.signUp({ email, password, options: { data: { first_name, last_name, pending_invite_code: code } } })`. Le code est stocké dans les métadonnées du compte Supabase (`user_metadata`), pas en `localStorage` — il survit donc même si la confirmation se termine sur un autre appareil (ex. lien de confirmation ouvert depuis le téléphone alors que l'inscription a été faite sur l'ordinateur).
3. Message affiché après soumission réussie : "Compte créé ! Vérifie tes emails pour confirmer ton adresse, puis reviens te connecter." Le formulaire d'inscription se referme, retour à l'écran de connexion.
4. L'utilisateur clique le lien de confirmation reçu par email → Supabase établit une session automatiquement (comportement standard du client Supabase, qui détecte les tokens dans l'URL de retour).
5. Dans `initAuth` (`js/auth.js`), au moment où une session devient valide pour la première fois (`unlock()`), vérifier `session.user.user_metadata.pending_invite_code` :
   - Si présent : appeler `redeem_invite_code(code)`, puis dans tous les cas (succès ou échec) appeler `supabase.auth.updateUser({ data: { pending_invite_code: null } })` pour effacer la métadonnée et ne jamais retenter. Afficher un toast de confirmation ou d'erreur selon le résultat.
   - Si absent (connexion normale d'un compte déjà validé, ou un des deux comptes fondateurs) : ne rien faire, comportement actuel inchangé.

## Génération de code

Dans `js/profile.js`, la vue "Mon compte" affiche une section supplémentaire uniquement si `user.email === "jerem.r30@gmail.com"` (vérification client, purement pour l'affichage — l'application réelle du contrôle d'accès est côté serveur dans `generate_invite_code()`) : un bouton "Générer un code d'invitation" qui appelle la fonction RPC et affiche le code résultant à l'écran pour que l'utilisateur le transmette lui-même (SMS, WhatsApp, de vive voix...). Aucun envoi automatique.

## Hors scope

- Envoi automatique du code par email ou SMS.
- Expiration des codes (l'usage unique suffit comme protection).
- Mot de passe oublié / renvoi d'email de confirmation.
- Blindage serveur empêchant totalement l'inscription sans code valide (Auth Hooks Supabase) — accepté comme hors de portée, cf. décision validée ci-dessus.
- Liste/gestion des codes déjà générés dans l'app (consultable uniquement via le tableau de bord Supabase si besoin).

## Tests / vérification

- Générer un code depuis le compte principal → apparaît à l'écran, présent dans `invite_codes` côté Supabase.
- Tenter de générer un code depuis un compte secondaire (une fois qu'il existe) → doit échouer (erreur "not authorized" côté fonction).
- S'inscrire avec un code valide → email de confirmation reçu, compte utilisable après clic sur le lien, code marqué comme utilisé (`used_by`/`used_at` renseignés) dans Supabase après la première connexion post-confirmation.
- Tenter de réutiliser un code déjà utilisé → l'inscription elle-même réussit (comportement accepté), mais `redeem_invite_code` doit retourner `false` et le toast doit signaler un code invalide.
- S'inscrire avec un code inexistant → même comportement (compte créé, mais code jamais marqué valide, toast d'erreur).
- Vérifier qu'une connexion normale d'un compte déjà existant (les deux comptes fondateurs, ou un compte ayant déjà validé son code) ne déclenche aucun appel à `redeem_invite_code`.
