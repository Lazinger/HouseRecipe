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
   positifs connus ("noix de coco"/"noix de muscade"/"noix de Saint-Jacques"
   ne sont pas des fruits a coque). ---- */
const ALLERGEN_KEYWORDS = {
  "gluten": ["farine", "ble", "froment", "pain", "pate", "chapelure", "semoule", "orge", "seigle", "boulgour", "couscous", "biscuit", "panure", "vermicelle", "spaghetti", "penne", "tagliatelle", "epeautre"],
  "crustaces": ["crevette", "crabe", "homard", "langouste", "ecrevisse", "gambas", "langoustine"],
  "oeufs": ["oeuf", "œuf"],
  "poisson": ["poisson", "saumon", "thon", "cabillaud", "morue", "sardine", "anchois", "merlan", "colin", "truite", "maquereau", "dorade", "hareng", "lieu"],
  "arachides": ["arachide", "cacahuete", "cacahouete"],
  "soja": ["soja", "tofu", "edamame", "tempeh", "tamari", "miso"],
  "lait": ["lait", "creme", "beurre", "fromage", "yaourt", "yogourt", "mascarpone", "gruyere", "mozzarella", "parmesan", "chantilly", "comte", "cheddar", "emmental", "chevre", "ricotta", "lactose", "babeurre"],
  "fruits-a-coque": ["amande", "noisette", "pistache", "cajou", "macadamia", "pecan", "noix du bresil"],
  "celeri": ["celeri"],
  "moutarde": ["moutarde"],
  "sesame": ["sesame", "tahini", "tahin"],
  "sulfites": ["sulfite"],
  "lupin": ["lupin"],
  "mollusques": ["moule", "huitre", "palourde", "saint-jacques", "st-jacques", "escargot", "calamar", "poulpe", "seiche", "bulot", "bigorneau"]
};

/* ---- "noix" seul designe un fruit a coque (noix commune), mais colle a
   "de coco"/"de muscade"/"de saint-jacques"/"de st-jacques" il designe autre
   chose (noix de coco = fruit exotique, noix de muscade = epice, noix de
   Saint-Jacques = mollusque, deja couvert par son propre mot-cle). ---- */
const NOIX_RE = /\bnoix\b(?!\s*d[eu]\s*(coco|muscade|saint[\s-]?jacques|st[\s.-]?jacques))/;

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
    if (keywords.some(kw => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`).test(text))) {
      found.add(key);
    }
  }
  if (NOIX_RE.test(text)) found.add("fruits-a-coque");
  return [...found];
}
