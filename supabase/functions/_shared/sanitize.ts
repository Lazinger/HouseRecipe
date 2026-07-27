const HTML_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  agrave: "à", acirc: "â", ccedil: "ç",
  ocirc: "ô", oelig: "œ", ucirc: "û", ugrave: "ù",
  icirc: "î", iuml: "ï",
  deg: "°", hellip: "…", mdash: "—", ndash: "–",
  rsquo: "'", lsquo: "'", rdquo: "\"", ldquo: "\"",
  frac12: "½", frac14: "¼", frac34: "¾", times: "×"
};

function decodeHtmlEntities(str){
  return str.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const code = parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITIES[entity] ?? match;
  });
}

/* ---- nettoyage des champs texte issus d'une source non fiable (JSON-LD d'un
   site tiers, ou extraction Gemini sur une page/photo externe) : retire toute
   balise HTML et décode les entités, pour éviter qu'un fragment <script>/<img
   onerror> capturé dans le texte d'une page piégée ne finisse stocké tel quel
   dans une recette (elle serait ensuite affichée à tout le foyer).
   Partagé entre import-recipe-url et scan-recipe — ne pas dupliquer. ---- */
export function stripHtmlTags(str){
  if (typeof str !== "string") return str;
  const noTags = str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return decodeHtmlEntities(noTags);
}
