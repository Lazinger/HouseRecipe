# B4 — Photos vers Supabase Storage

Date : 2026-07-15
Statut : approuvé, prêt pour plan d'implémentation

## Contexte

Aujourd'hui (`public/js/photos.js`), les photos de recettes (photo principale + une par étape) sont stockées uniquement en local, dans une base IndexedDB dédiée (`carnet-photos`), sous forme de `Blob` bruts, indexées par `recipeId` (photo principale) ou `${recipeId}::step::${index}` (photos d'étape). Elles ne quittent jamais l'appareil : une photo ajoutée sur un compte/appareil n'apparaît pas sur un autre, et est perdue si le cache du navigateur est vidé.

B4 fait pour les photos ce que B1 a fait pour les recettes : elles deviennent partagées via Supabase (ici, Supabase Storage plutôt que Postgres, vu qu'il s'agit de fichiers binaires), tout en gardant un cache local pour la consultation hors-ligne. Les écritures (ajout, suppression) réussissent toujours instantanément en local et se synchronisent en arrière-plan via la file d'attente construite en B3 (`js/write-queue.js`), sans aucune modification de ce module.

## Décisions validées

- **Photos existantes** : migrées automatiquement vers Supabase au premier démarrage après déploiement de B4, en arrière-plan, sans action de l'utilisateur.
- **Bucket** : public (URL permanente, pas de gestion d'expiration/signature — les photos de plats ne sont pas des données sensibles, une URL devinée sans compte reste un risque négligeable accepté).
- **Cache local** : conservé après upload — une photo déjà vue sur un appareil reste visible hors-ligne sur cet appareil, cohérent avec le reste de l'app (PWA offline-first).
- **Écriture hors-ligne** : passe par la file d'attente de B3 (succès local instantané, sync + retry automatique au retour du réseau), pas de blocage.

## Architecture Supabase Storage

**Bucket** : `recipe-photos`, public, créé par un ajout à `supabase/schema.sql` (appliqué manuellement par l'utilisateur via l'éditeur SQL Supabase, comme le reste du schéma) :

```sql
insert into storage.buckets (id, name, public) values ('recipe-photos', 'recipe-photos', true);

create policy "Household members can read recipe photos"
  on storage.objects for select
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can upload recipe photos"
  on storage.objects for insert
  with check (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can update recipe photos"
  on storage.objects for update
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);

create policy "Household members can delete recipe photos"
  on storage.objects for delete
  using (bucket_id = 'recipe-photos' and auth.uid() is not null);
```

(Le bucket est public en lecture pour n'importe qui possédant l'URL — ces policies gouvernent qui peut lire/écrire *via le client Supabase authentifié*, cohérent avec le reste du schéma où `auth.uid() is not null` suffit, pas de restriction par propriétaire.)

**Chemin des objets** :
- Photo principale : `{recipeId}`
- Photo d'étape : `{recipeId}/step-{index}`

Le `contentType` est fixé explicitement à l'upload depuis `file.type` — pas besoin d'extension dans le chemin, le navigateur affiche l'image correctement via l'en-tête `Content-Type` renvoyé par Storage.

**URL publique** : `{SUPABASE_URL}/storage/v1/object/public/recipe-photos/{key}` (`SUPABASE_URL` déjà connu du client dans `js/supabase-client.js`).

## Intégration avec la file d'attente B3

`write-queue.js` n'est **pas modifié** — les `Blob` sont nativement sérialisables dans un object store IndexedDB (structured clone), donc le mécanisme générique `enqueue(type, key, payload)` / `registerHandler(type, handler)` / `flush()` fonctionne sans changement pour un nouveau type `"photo"`.

`photos.js` ajoute :

```js
async function photoWriteHandler(payload){
  if (payload.op === "delete") {
    const { error } = await supabase.storage.from("recipe-photos").remove([payload.key]);
    if (error) throw error;
  } else {
    const { error } = await supabase.storage.from("recipe-photos").upload(payload.key, payload.blob, {
      upsert: true,
      contentType: payload.blob.type || "application/octet-stream"
    });
    if (error) throw error;
  }
}
registerHandler("photo", photoWriteHandler);
```

`savePhoto`/`saveStepPhoto` : écrivent d'abord dans le cache IndexedDB local (comportement actuel, inchangé), puis tentent `photoWriteHandler({ op: "upload", key, blob: file })` ; en cas d'échec, `enqueue("photo", key, { op: "upload", key, blob: file })`. Marque la clé comme synchronisée dans `localStorage` (voir migration ci-dessous) après un succès (immédiat ou différé via la file).

`deleteAllPhotosForRecipe` : retire d'abord le cache local (comportement actuel), puis tente `photoWriteHandler({ op: "delete", key })` pour la photo principale et chaque photo d'étape connue ; échec → `enqueue("photo", key, { op: "delete", key })` par clé.

## Lecture & synchronisation entre appareils

`applyCardPhoto`/`applyDetailPhoto`/`getStepPhoto` vérifient d'abord le cache IndexedDB local (comportement actuel). Si absent localement :
1. `fetch` sur l'URL publique Supabase Storage pour cette clé.
2. Si succès (200) : afficher la photo **et** la mettre en cache localement (`savePhotoToCache`, sans passer par la file d'attente — c'est une lecture, pas une écriture à synchroniser) pour que la prochaine consultation hors-ligne fonctionne.
3. Si échec (404, hors-ligne) : afficher l'état "sans photo" actuel, silencieusement — pas de message d'erreur pour une photo simplement absente.

## Migration des photos existantes

Nouvelle fonction `initPhotosSync()`, appelée au démarrage dans `main.js` (après l'auth, aux côtés de `initRecipesSync`/`initFavoritesSync`/`initCartSync`, et donc — comme elles — après le `flush()` de démarrage déjà séquencé en B3).

Une clé `localStorage` (`carnet-photos-synced`, format JSON d'un tableau de clés) garde la liste des photos déjà confirmées sur Supabase Storage. `initPhotosSync()` parcourt les clés présentes dans `carnet-photos` (IndexedDB) absentes de cette liste, et pour chacune tente `photoWriteHandler({ op: "upload", key, blob })` ; échec → `enqueue("photo", key, ...)` (rejoue au retour du réseau comme n'importe quelle autre écriture en attente). Un succès (immédiat ou via `flush()` plus tard) ajoute la clé à `carnet-photos-synced`.

## Hors scope

- Compression ou redimensionnement des images avant upload (les fichiers partent tels quels).
- Nettoyage des photos orphelines côté Storage si la suppression d'une recette réussit mais que la suppression de ses photos échoue et n'est jamais rejouée (cas limite très rare, accepté comme risque résiduel mineur — Storage n'a pas d'équivalent au `on delete cascade` de Postgres utilisé pour les favoris).
- Barre de progression d'upload pour les gros fichiers.

## Tests / vérification

- Ajouter une photo (principale et d'étape) à une recette, en ligne → apparaît immédiatement, présente dans le bucket Supabase Storage après quelques secondes.
- Même test hors-ligne (DevTools → Network → Offline) → apparaît immédiatement en local, en file d'attente jusqu'au retour du réseau, puis synchronisée.
- Se connecter avec le même compte sur un second navigateur/profil (sans le cache local) → la photo doit apparaître (chargée depuis l'URL Supabase Storage), et être mise en cache localement pour une future consultation hors-ligne sur cet appareil.
- Supprimer une recette ayant des photos → les objets Storage correspondants disparaissent du bucket.
- Redémarrer l'app avec des photos déjà présentes en local avant B4 (scénario de migration) → elles doivent apparaître dans le bucket Supabase Storage après le démarrage, sans action de l'utilisateur, et `carnet-photos-synced` doit lister leurs clés.
