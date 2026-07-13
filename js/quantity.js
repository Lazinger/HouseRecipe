/* ---- mise à l'échelle des quantités selon le nombre de personnes ---- */
export function parseQuantity(qty){
  const m = String(qty).trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { value: parseFloat(m[1].replace(",", ".")), unit: m[2].trim() };
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
