# Le Carnet — site de recettes

Site statique en HTML / CSS / JS pur (aucune dépendance à installer, aucun build).
Accès sécurisé via connexion Supabase (réseau requis pour l'authentification) ;
l'app shell et les polices se mettent en cache après la première visite.

## Structure
Les fichiers du site vivent dans `public/` (c'est ce dossier, et lui seul,
qui doit être publié/déployé — le reste du dépôt est interne au projet) :
```
public/index.html     → structure de la page
public/style.css      → design ("carnet lumineux épuré")
public/js/            → logique en modules ES (recettes, panier, minuteur, photos, vues...) — voir js/main.js pour le point d'entrée
public/manifest.json  → manifeste PWA (nom, icône, couleurs)
public/sw.js          → service worker (mise en cache pour le mode hors-ligne)
public/fonts/         → Fraunces, DM Sans, Caveat en .woff2 (auto-hébergées)
public/icons/         → icône de l'app (icons/icon.svg)
```

## Utilisation
**Un serveur local est requis** (double-cliquer sur `index.html` ne
fonctionne plus) : la logique est découpée en modules JS (`js/`), et les
navigateurs bloquent le chargement des modules ES en ouverture directe de
fichier (`file://`) pour des raisons de sécurité CORS — seuls les scripts
classiques (single-file) fonctionnent en `file://`.

Le plus simple : double-cliquer sur `lancer-le-carnet.bat` (démarre un
serveur local et ouvre le site dans le navigateur ; laissez la fenêtre
ouverte pendant l'utilisation, fermez-la pour arrêter). Sinon, n'importe
quel serveur statique convient (ex. `npx serve public`).

Le site est aussi déployé en continu sur Netlify (HTTPS, requis pour tester
l'installation PWA sur téléphone) — chaque `git push` sur `master` republie
automatiquement `public/`.

Les recettes sont un livre de cuisine **partagé** entre tous les comptes du
foyer, synchronisé via Supabase (Postgres + Row Level Security) — ajouter,
modifier ou supprimer une recette sur un appareil la met à jour sur les
autres après rafraîchissement. Favoris et panier restent **personnels** à
chaque compte, également synchronisés. `localStorage` sert de cache local
(chargement instantané, lecture possible hors-ligne) ; les photos de
recettes sont mises en cache dans IndexedDB (trop volumineuses pour
`localStorage`). Les écritures faites hors-ligne échouent proprement pour
l'instant (pas encore de file d'attente — prévu dans un lot ultérieur).

## Passage en application Android

Le site a été conçu pour être facilement encapsulé dans une WebView, sans
modification majeure :
- authentification via Supabase (réseau requis pour la connexion, session stockée localement après),
- polices auto-hébergées, service worker pour la mise en cache,
- boutons et zones tactiles dimensionnés pour le doigt,
- écoute de l'événement `popstate` déjà en place pour se brancher sur le
  bouton "retour" matériel Android.

Deux approches courantes pour la suite :

1. **Capacitor** (recommandé si vous voulez du code natif Android/iOS à
   partir de ce même projet web) :
   ```
   npm init -y
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "Le Carnet" "com.example.lecarnet"
   npx cap add android
   npx cap copy
   npx cap open android
   ```
   Copiez le contenu de `public/` dans le dossier `www/` généré par
   Capacitor avant `npx cap copy`. Capacitor sert l'app via un schéma local
   propre (pas `file://` brut), donc les modules ES fonctionnent sans
   changement.

2. **WebView Android simple** (si vous préférez un projet Android natif
   minimal) : créez une `WebView` plein écran dans une `Activity` et
   activez JavaScript (`settings.javaScriptEnabled = true`). ⚠️ Chargez les
   fichiers via `WebViewAssetLoader` (sert `assets/` sur
   `https://appassets.androidplatform.net/`) plutôt que
   `loadUrl("file:///android_asset/...")` — le chargement direct en
   `file://` bloque les modules ES pour la même raison qu'en navigateur
   desktop. Pour le bouton retour matériel, interceptez `onBackPressed()`
   et appelez `webView.goBack()` ou injectez un événement `popstate`.
