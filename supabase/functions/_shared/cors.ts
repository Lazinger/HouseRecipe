const ALLOWED_ORIGINS = [
  "https://lazinger.github.io"
];

const LOCAL_DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/* ---- CORS restreint au domaine GitHub Pages de l'app + hôtes de dev locaux
   (l'ancien "*" laissait n'importe quel site tiers appeler ces fonctions
   depuis le navigateur d'un membre du foyer connecté). Partagé entre
   scan-recipe et import-recipe-url — ne pas dupliquer. ---- */
export function buildCorsHeaders(req){
  const origin = req.headers.get("Origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) || LOCAL_DEV_ORIGIN_RE.test(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin"
  };
}
