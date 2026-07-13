# Le Carnet — site de recettes

Site statique en HTML / CSS / JS pur (aucune dépendance à installer, aucun build).
Fonctionne 100 % hors-ligne : polices auto-hébergées et service worker
(`sw.js`) qui met le site en cache après la première visite.

## Structure
```
index.html     → structure de la page
style.css      → design ("carnet lumineux épuré")
js/            → logique en modules ES (recettes, panier, minuteur, photos, vues...) — voir js/main.js pour le point d'entrée
manifest.json  → manifeste PWA (nom, icône, couleurs)
sw.js          → service worker (mise en cache pour le mode hors-ligne)
fonts/         → Fraunces, DM Sans, Caveat en .woff2 (auto-hébergées)
icons/         → icône de l'app (icons/icon.svg)
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
quel serveur statique convient (ex. `npx serve .`).

Les favoris et les recettes ajoutées sont stockés dans `localStorage` ; les
photos de recettes sont stockées dans IndexedDB (trop volumineuses pour
`localStorage`). Tout reste sur l'appareil — export/import JSON disponible
dans le menu pour sauvegarder/transférer ses recettes.

## Passage en application Android

Le site a été conçu pour être facilement encapsulé dans une WebView, sans
modification majeure :
- aucune dépendance réseau (polices auto-hébergées, service worker),
- pas de données sensibles en stockage local,
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
   Placez tous les fichiers du projet (`index.html`, `style.css`, `js/`,
   `manifest.json`, `sw.js`, `fonts/`, `icons/`) dans le dossier `www/`
   généré par Capacitor avant `npx cap copy`. Capacitor sert l'app via un
   schéma local propre (pas `file://` brut), donc les modules ES
   fonctionnent sans changement.

2. **WebView Android simple** (si vous préférez un projet Android natif
   minimal) : créez une `WebView` plein écran dans une `Activity` et
   activez JavaScript (`settings.javaScriptEnabled = true`). ⚠️ Chargez les
   fichiers via `WebViewAssetLoader` (sert `assets/` sur
   `https://appassets.androidplatform.net/`) plutôt que
   `loadUrl("file:///android_asset/...")` — le chargement direct en
   `file://` bloque les modules ES pour la même raison qu'en navigateur
   desktop. Pour le bouton retour matériel, interceptez `onBackPressed()`
   et appelez `webView.goBack()` ou injectez un événement `popstate`.
