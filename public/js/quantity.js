/* ---- mise à l'échelle des quantités selon le nombre de personnes ---- */
export function parseQuantity(qty){
  const m = String(qty).trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { value: parseFloat(m[1].replace(",", ".")), unit: m[2].trim() };
}

/* ---- extraction d'une quantité collée en tête du nom d'un ingrédient
   (ex. "1 pièce(s) Poireau" au lieu de ["Poireau", "1 pièce(s)"]) ---- */
export function splitLeadingQuantity(name){
  const text = String(name).trim();
  const numeric = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)\s+(.+)$/);
  if (numeric) return { qty: `${numeric[1]} ${numeric[2]}`, name: numeric[3].trim() };
  const toTaste = text.match(/^(selon (?:le|votre|vos) goûts?)\s+(.+)$/i);
  if (toTaste) return { qty: toTaste[1], name: toTaste[2].trim() };
  return null;
}
export function formatScaledNumber(n){
  const rounded = Math.round(n * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}
export function scaleQuantity(qty, ratio){
  const parsed = parseQuantity(qty);
  if (!parsed) return qty;
  const scaled = formatScaledNumber(parsed.value * ratio);
  return parsed.unit ? `${scaled} ${parsed.unit}` : scaled;
}

/* ---- normalisation des ingredients extraits par IA (scan photo / import URL) :
   majuscule initiale sur le nom, unites courantes abregees (CS/CC/pinc.).
   Source unique des motifs d'unite : reutilise a la fois pour la
   correspondance exacte (UNIT_ABBREVIATIONS) et pour l'extraction d'une
   quantite collee en tete du nom (LEADING_QUANTITY_UNIT_RE), pour eviter
   que les deux divergent silencieusement (deja arrive une fois). ---- */
const UNIT_PATTERNS = [
  { source: "(?:cuill[eè]res?|c\\.?)\\s*à\\s*(?:soupe|s\\.?)|cs", replacement: "CS" },
  { source: "(?:cuill[eè]res?|c\\.?)\\s*à\\s*(?:café|c\\.?)|cc", replacement: "CC" },
  { source: "pincée(?:s|\\(s\\))?", replacement: "pinc." },
  { source: "gousses?", replacement: null }
];

const UNIT_ABBREVIATIONS = UNIT_PATTERNS.map(({ source, replacement }) => ({
  pattern: new RegExp(`^(?:${source})$`, "i"),
  replacement
}));

const LEADING_QUANTITY_UNIT_RE = new RegExp(
  `^([\\d½¼¾⅓⅔]+(?:[.,]\\d+)?)\\s+(${UNIT_PATTERNS.map(p => p.source).join("|")})\\s+(?:de\\s+|d')(.+)$`,
  "i"
);

function abbreviateUnit(unit, value){
  const trimmedUnit = unit.trim();
  for (const { pattern, replacement } of UNIT_ABBREVIATIONS) {
    if (pattern.test(trimmedUnit)) {
      if (replacement) return replacement;
      const numeric = parseFloat(String(value).replace(",", "."));
      return numeric > 1 ? "gousses" : "gousse";
    }
  }
  return trimmedUnit;
}

function capitalizeFirst(str){
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeIngredientPair(name, qty){
  const trimmedName = String(name ?? "").trim();
  const trimmedQty = String(qty ?? "").trim();

  if (!trimmedQty) {
    const leadingMatch = trimmedName.match(LEADING_QUANTITY_UNIT_RE);
    if (leadingMatch) {
      const [, value, unit, rest] = leadingMatch;
      return [capitalizeFirst(rest.trim()), `${value} ${abbreviateUnit(unit, value)}`];
    }
    const split = splitLeadingQuantity(trimmedName);
    if (split) return [capitalizeFirst(split.name), split.qty];
    return [capitalizeFirst(trimmedName), trimmedQty];
  }

  const qtyMatch = trimmedQty.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(.+)$/);
  if (qtyMatch) {
    const [, value, unit] = qtyMatch;
    return [capitalizeFirst(trimmedName), `${value} ${abbreviateUnit(unit, value)}`];
  }

  return [capitalizeFirst(trimmedName), trimmedQty];
}
