import assert from "node:assert/strict";
import { normalizeIngredientPair } from "./quantity.js";

const cases = [
  { input: ["1 cuillère à soupe d'huile d'olive", ""], expected: ["Huile d'olive", "1 CS"] },
  { input: ["Huile d'olive", "1 cuillère à soupe"], expected: ["Huile d'olive", "1 CS"] },
  { input: ["farine", "200 g"], expected: ["Farine", "200 g"] },
  { input: ["2 gousses d'ail", ""], expected: ["Ail", "2 gousses"] },
  { input: ["ail", "1 gousse"], expected: ["Ail", "1 gousse"] },
  { input: ["sel", "1 pincée"], expected: ["Sel", "1 pinc."] },
  { input: ["1 càc de vanille", ""], expected: ["Vanille", "1 CC"] },
  { input: ["1 c. à s. de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["poivre", ""], expected: ["Poivre", ""] },
  { input: ["1 pièce(s) Poireau", ""], expected: ["Poireau", "1 pièce(s)"] },
  { input: ["1 c. à soupe de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["Vanille", "1 c. à café"], expected: ["Vanille", "1 CC"] },
  { input: ["Huile d'olive", "1 cs"], expected: ["Huile d'olive", "1 CS"] },
  { input: ["Beurre", "2 cc"], expected: ["Beurre", "2 CC"] },
  { input: ["Noix de muscade", "1 pincée(s)"], expected: ["Noix de muscade", "1 pinc."] },
  { input: ["1 pincée(s) de sel", ""], expected: ["Sel", "1 pinc."] },
  { input: ["1 cs de miel", ""], expected: ["Miel", "1 CS"] }
];

let failures = 0;
for (const { input, expected } of cases) {
  const result = normalizeIngredientPair(...input);
  try {
    assert.deepStrictEqual(result, expected);
  } catch {
    failures++;
    console.error(`FAIL: normalizeIngredientPair(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (failures > 0) {
  console.error(`${failures}/${cases.length} cas en echec.`);
  process.exit(1);
}
console.log(`OK: ${cases.length} cas passes.`);
