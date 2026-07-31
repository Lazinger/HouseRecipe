const COMBINING_DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function normalize(str){
  return String(str ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_RE, "");
}

/* ---- mots-cles par allergene (liste fixe des 14 allergenes UE, memes cles
   que ALLERGENS cote client). Volontairement conservateur : un mot-cle
   present dans le nom d'un ingredient suffit, mais on evite les faux
   positifs connus (voir EXCLUSIONS ci-dessous). ---- */
const ALLERGEN_KEYWORDS = {
  "gluten": ["farine", "ble", "froment", "pain", "pate", "chapelure", "semoule", "orge", "seigle", "boulgour", "couscous", "biscuit", "panure", "vermicelle", "spaghetti", "penne", "tagliatelle", "epeautre", "orzo"],
  "crustaces": ["crevette", "crabe", "homard", "langouste", "ecrevisse", "gambas", "langoustine"],
  "oeufs": ["oeuf", "œuf"],
  "poisson": ["poisson", "saumon", "thon", "cabillaud", "morue", "sardine", "anchois", "merlan", "colin", "truite", "maquereau", "dorade", "hareng", "lieu"],
  "arachides": ["arachide", "cacahuete", "cacahouete"],
  "soja": ["soja", "tofu", "edamame", "tempeh", "tamari", "miso"],
  "lait": ["lait", "creme", "beurre", "fromage", "yaourt", "yogourt", "mascarpone", "gruyere", "mozzarella", "parmesan", "chantilly", "comte", "cantal", "cheddar", "emmental", "chevre", "ricotta", "lactose", "babeurre", "cream", "cheese"],
  "fruits-a-coque": ["amande", "noisette", "pistache", "cajou", "macadamia", "pecan", "noix du bresil"],
  "celeri": ["celeri"],
  "moutarde": ["moutarde"],
  "sesame": ["sesame", "tahini", "tahin"],
  "sulfites": ["sulfite"],
  "lupin": ["lupin"],
  "mollusques": ["moule", "huitre", "palourde", "saint-jacques", "st-jacques", "escargot", "calamar", "poulpe", "seiche", "bulot", "bigorneau"]
};

/* ---- exclusions : un mot-cle colle a certains qualificatifs designe autre
   chose que l'allergene attendu. Deux formes rencontrees en pratique sur de
   vraies recettes :
   - adjectif direct : "lait VEGETAL", "creme VEGETALE" (substitut sans
     lactose, pas l'allergene "lait").
   - "de/d' + nom" : "farine DE RIZ" (recette explicitement sans gluten),
     "lait DE COCO", "noix DE MUSCADE" (une epice, pas un fruit a coque).
   Sans ces exclusions, une recette "sans gluten" a base de farine de riz
   se retrouverait cochee "gluten" a tort. ---- */
const EXCLUSION_ADJECTIVES = {
  "lait": ["vegetal", "vegetale", "vegetaux"],
  "creme": ["vegetal", "vegetale", "vegetaux"],
  "beurre": ["vegetal", "vegetale", "vegetaux"]
};
const EXCLUSION_DE_NOUNS = {
  "farine": ["riz", "mais", "lentilles", "sarrasin", "pois chiche", "coco", "chataigne", "quinoa", "manioc", "tapioca", "soja", "amande", "amandes"],
  "lait": ["soja", "coco", "riz", "avoine", "amande", "amandes"],
  "creme": ["soja", "coco", "riz", "avoine", "amande", "amandes"],
  "beurre": ["soja", "coco", "amande", "amandes", "cacahuete", "cacahouete", "arachide"],
  "noix": ["coco", "muscade", "saint[\\s-]?jacques", "st[\\s.-]?jacques"]
};

function escapeRegex(str){
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ---- construit le motif d'un mot-cle, avec repli negatif sur ses
   exclusions connues (adjectif direct et/ou "de/d' + nom").
   \b est base sur \w ASCII : sur du texte deja normalise (accents retires),
   un "œ" en ligature (ex. "bœuf") n'est PAS un caractere \w pour \b, ce qui
   cree une fausse limite de mot juste avant et fait matcher "œuf" a
   l'interieur de "bœuf" (confirme par test : /\bœuf\b/.test("bœuf") vaut
   true). On utilise donc des lookaround \p{L}/\p{N} (avec le flag "u"),
   conscients des lettres Unicode, plutot que \b. ---- */
function buildKeywordRegex(kw){
  const escaped = escapeRegex(kw);
  const adjectives = EXCLUSION_ADJECTIVES[kw] || [];
  const nouns = EXCLUSION_DE_NOUNS[kw] || [];
  const alternatives = [
    ...adjectives,
    ...(nouns.length ? [`(?:de\\s+|d['’])(?:${nouns.join("|")})`] : [])
  ];
  const exclusionLookahead = alternatives.length ? `(?!\\s*(?:${alternatives.join("|")}))` : "";
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}s?(?![\\p{L}\\p{N}_])${exclusionLookahead}`, "u");
}

function normalizedIngredientText(ingredients){
  return normalize(
    (Array.isArray(ingredients) ? ingredients : [])
      .map(pair => Array.isArray(pair) ? pair[0] : pair)
      .join(" | ")
  );
}

/* ---- detection deterministe des allergenes a partir du nom des
   ingredients (pas de la quantite). Utilisee pour les recettes importees
   via JSON-LD (pas d'appel IA sur ce chemin, donc pas de detection sinon)
   et en complement de l'IA sur les autres chemins d'import. ---- */
export function detectAllergens(ingredients){
  const text = normalizedIngredientText(ingredients);
  const found = new Set();
  for (const [key, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (keywords.some(kw => buildKeywordRegex(kw).test(text))) {
      found.add(key);
    }
  }
  if (buildKeywordRegex("noix").test(text)) found.add("fruits-a-coque");
  return [...found];
}
