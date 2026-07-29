import assert from "node:assert/strict";
import { normalizeIngredientPair, resolveStepQuantities, subtractQuantity, applyFridgeStock } from "./quantity.js";

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
  { input: ["1 cs de miel", ""], expected: ["Miel", "1 CS"] },
  { input: ["150 g de pistaches", ""], expected: ["Pistaches", "150 g"] },
  { input: ["140 g de beurre fondu", ""], expected: ["Beurre fondu", "140 g"] },
  { input: ["120 g d'eau", ""], expected: ["Eau", "120 g"] },
  { input: ["3 oeufs", ""], expected: ["Oeufs", "3"] }
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

const stepCases = [
  {
    step: "Ajoutez {{qty:Farine}} de farine et mélangez.",
    ingredients: [["Farine", "400 g"], ["Sel", "1 pinc."]],
    expected: "Ajoutez 400 g de farine et mélangez."
  },
  {
    step: "Versez {{qty:huile d'olive}} puis {{qty:Sel}}.",
    ingredients: [["Huile d'olive", "2 CS"], ["Sel", "1 pinc."]],
    expected: "Versez 2 CS puis 1 pinc.."
  },
  {
    step: "Cuire 20 minutes à 180°C.",
    ingredients: [["Farine", "400 g"]],
    expected: "Cuire 20 minutes à 180°C."
  },
  {
    step: "Ajoutez {{qty:Beurre}} fondu.",
    ingredients: [["Farine", "400 g"]],
    expected: "Ajoutez {{qty:Beurre}} fondu."
  }
];

let stepFailures = 0;
for (const { step, ingredients, expected } of stepCases) {
  const result = resolveStepQuantities(step, ingredients);
  try {
    assert.equal(result, expected);
  } catch {
    stepFailures++;
    console.error(`FAIL: resolveStepQuantities(${JSON.stringify(step)}, ...) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (stepFailures > 0) {
  console.error(`${stepFailures}/${stepCases.length} cas resolveStepQuantities en echec.`);
  process.exit(1);
}
console.log(`OK: ${stepCases.length} cas resolveStepQuantities passes.`);

const subtractCases = [
  { input: ["400 g", "150 g"], expected: "250 g" },
  { input: ["150 g", "400 g"], expected: "0 g" },
  { input: ["3", "2"], expected: "1" },
  { input: ["400 g", "1 boîte"], expected: "400 g" },
  { input: ["selon les goûts", "1 pinc."], expected: "selon les goûts" },
  { input: ["400 g", "selon les goûts"], expected: "400 g" }
];

let subtractFailures = 0;
for (const { input, expected } of subtractCases) {
  const result = subtractQuantity(...input);
  try {
    assert.equal(result, expected);
  } catch {
    subtractFailures++;
    console.error(`FAIL: subtractQuantity(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (subtractFailures > 0) {
  console.error(`${subtractFailures}/${subtractCases.length} cas subtractQuantity en echec.`);
  process.exit(1);
}
console.log(`OK: ${subtractCases.length} cas subtractQuantity passes.`);

const fridgeCases = [
  {
    merged: [{ key: "farine", name: "Farine", qty: "400 g" }, { key: "sel", name: "Sel", qty: "1 pinc." }],
    fridge: [["Farine", "150 g"]],
    expected: [{ key: "farine", name: "Farine", qty: "250 g" }, { key: "sel", name: "Sel", qty: "1 pinc." }]
  },
  {
    merged: [{ key: "farine", name: "Farine", qty: "400 g" }],
    fridge: [["Farine", "400 g"]],
    expected: []
  },
  {
    merged: [{ key: "farine", name: "Farine", qty: "400 g" }],
    fridge: [["Farine", "1 boîte"]],
    expected: [{ key: "farine", name: "Farine", qty: "400 g" }]
  },
  {
    merged: [{ key: "farine", name: "Farine", qty: "400 g" }],
    fridge: [],
    expected: [{ key: "farine", name: "Farine", qty: "400 g" }]
  }
];

let fridgeFailures = 0;
for (const { merged, fridge, expected } of fridgeCases) {
  const result = applyFridgeStock(merged, fridge);
  try {
    assert.deepStrictEqual(result, expected);
  } catch {
    fridgeFailures++;
    console.error(`FAIL: applyFridgeStock(${JSON.stringify(merged)}, ${JSON.stringify(fridge)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (fridgeFailures > 0) {
  console.error(`${fridgeFailures}/${fridgeCases.length} cas applyFridgeStock en echec.`);
  process.exit(1);
}
console.log(`OK: ${fridgeCases.length} cas applyFridgeStock passes.`);
