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
