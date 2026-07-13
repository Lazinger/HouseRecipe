@echo off
REM Démarre un serveur local et ouvre Le Carnet dans le navigateur.
REM Nécessaire depuis le découpage en modules JS (les modules ES sont
REM bloqués par le navigateur en ouverture directe du fichier index.html).
REM Laisse cette fenêtre ouverte pendant l'utilisation ; ferme-la pour arrêter le serveur.

cd /d "%~dp0"
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"
npx serve . -l 3000
