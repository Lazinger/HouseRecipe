/* ---- mise à l'échelle des quantités selon le nombre de personnes ---- */
export function parseQuantity(qty){
  const m = String(qty).trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { value: parseFloat(m[1].replace(",", ".")), unit: m[2].trim() };
}

/* ---- extraction d'une quantité collée en tête du nom d'un ingrédient.
   Trois formes reelles rencontrees a l'import, essayees de la plus specifique
   a la plus generale :
   1. "150 g de pistaches" / "120 g d'eau" -> unite + connecteur a retirer.
   2. "1 pièce(s) Poireau" -> unite directement suivie du nom, sans connecteur.
   3. "3 oeufs" -> pas d'unite separee, le mot final EST le nom. ---- */
export function splitLeadingQuantity(name){
  const text = String(name).trim();

  const withConnector = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)\s+(?:de\s+|d')(.+)$/);
  if (withConnector) return { qty: `${withConnector[1]} ${withConnector[2]}`, name: withConnector[3].trim() };

  const unitAndName = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)\s+(.+)$/);
  if (unitAndName) return { qty: `${unitAndName[1]} ${unitAndName[2]}`, name: unitAndName[3].trim() };

  const countOnly = text.match(/^([\d½¼¾⅓⅔]+(?:[.,]\d+)?)\s+(\S+)$/);
  if (countOnly) return { qty: countOnly[1], name: countOnly[2].trim() };

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

/* ---- resolution des reperes de quantite dynamique dans une etape
   (ex. "Ajoutez {{qty:Farine}} de farine") : remplace chaque repere par la
   quantite de l'ingredient correspondant (deja mise a l'echelle par
   l'appelant). Si aucun ingredient ne correspond, le repere reste affiche
   tel quel plutot que de disparaitre silencieusement. ---- */
export function resolveStepQuantities(step, ingredients){
  return String(step ?? "").replace(/\{\{qty:([^}]+)\}\}/g, (match, rawName) => {
    const target = rawName.trim().toLowerCase();
    const found = ingredients.find(([name]) => String(name).trim().toLowerCase() === target);
    return found ? found[1] : match;
  });
}

/* ---- soustraction d'un stock (frigo) au besoin d'une recette : utilisee
   par le panier pour n'afficher dans "a acheter" que ce qui manque
   reellement. Si l'une des deux quantites ne se parse pas, ou si les
   unites different, retourne le besoin inchange (repli sur : pas de
   deduction plutot qu'un calcul faux). ---- */
export function subtractQuantity(need, stock){
  const parsedNeed = parseQuantity(need);
  const parsedStock = parseQuantity(stock);
  if (!parsedNeed || !parsedStock) return need;
  if (parsedNeed.unit.toLowerCase() !== parsedStock.unit.toLowerCase()) return need;
  const remaining = Math.max(0, parsedNeed.value - parsedStock.value);
  const formatted = formatScaledNumber(remaining);
  return parsedNeed.unit ? `${formatted} ${parsedNeed.unit}` : formatted;
}

/* ---- fusion de plusieurs quantites du meme ingredient (ex. la meme
   recette ajoutee deux fois, ou plusieurs recettes demandant le meme
   ingredient) : additionne si toutes les unites correspondent, sinon
   concatene les valeurs distinctes. Partagee entre le panier (fusion des
   ingredients a acheter) et le frigo (reapprovisionnement au clic sur
   "Valide"). ---- */
export function mergeQuantityParts(parts){
  const parsed = parts.map(parseQuantity);
  if (parsed.every(Boolean)) {
    const unit = parsed[0].unit.toLowerCase();
    if (parsed.every(p => p.unit.toLowerCase() === unit)) {
      const sum = parsed.reduce((acc, p) => acc + p.value, 0);
      const formatted = formatScaledNumber(sum);
      return parsed[0].unit ? `${formatted} ${parsed[0].unit}` : formatted;
    }
  }
  return [...new Set(parts.map(p => p.trim()))].join(" + ");
}

/* ---- deduit le stock du frigo du besoin fusionne du panier : un
   ingredient dont le besoin tombe a zero est retire de la liste "a
   acheter". Correspondance par nom normalise (meme regle que la fusion
   du panier), pas de correspondance -> besoin brut inchange (repli sur). ---- */
export function applyFridgeStock(merged, fridgeItems){
  const fridgeMap = new Map(fridgeItems.map(([name, qty]) => [name.trim().toLowerCase(), qty]));
  return merged
    .map(item => {
      const stock = fridgeMap.get(item.key);
      if (!stock) return item;
      return { ...item, qty: subtractQuantity(item.qty, stock) };
    })
    .filter(item => {
      const parsed = parseQuantity(item.qty);
      return !(parsed && parsed.value === 0);
    });
}
