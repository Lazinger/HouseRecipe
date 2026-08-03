import assert from "node:assert/strict";
import { normalizeIngredientPair, resolveStepQuantities, subtractQuantity, applyFridgeStock, normalizeQuantity, mergeQuantityParts, checkFridgeAvailability, formatQuantityValue, scaleQuantity, parseQuantity, reduceQuantityStock, isPantryStaple } from "./quantity.js";

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
  { input: ["3 oeufs", ""], expected: ["Oeufs", "3"] },
  { input: ["12 tomates séchées", ""], expected: ["Tomates séchées", "12"] },
  { input: ["4 sauce soja", ""], expected: ["Sauce soja", "4"] },
  { input: ["1 huile d'olive", ""], expected: ["Huile d'olive", "1"] },
  { input: ["1 noix de coco", ""], expected: ["Noix de coco", "1"] },
  { input: ["1 noix de muscade", ""], expected: ["Noix de muscade", "1"] },
  { input: ["1 noix de beurre", ""], expected: ["Noix de beurre", "1"] }
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
  { input: ["400 g", "selon les goûts"], expected: "400 g" },
  { input: ["1 kg", "500 g"], expected: "500 g" },
  { input: ["500 g", "1 kg"], expected: "0 g" },
  { input: ["2 L", "500 ml"], expected: "1500 ml" },
  { input: ["60 g", "1 CS + 30 g + 60 g"], expected: "0 g" },
  { input: ["100 g", "1 CS + 30 g"], expected: "70 g" }
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

const mergeCases = [
  { input: [["200 g", "300 g"]], expected: "500 g" },
  { input: [["1 CS", "2 CS"]], expected: "3 CS" },
  { input: [["400 g", "1 boîte"]], expected: "400 g + 1 boîte" },
  { input: [["1 kg", "500 g"]], expected: "1500 g" },
  { input: [["1 L", "250 ml", "250 ml"]], expected: "1500 ml" }
];

let mergeFailures = 0;
for (const { input, expected } of mergeCases) {
  const result = mergeQuantityParts(...input);
  try {
    assert.equal(result, expected);
  } catch {
    mergeFailures++;
    console.error(`FAIL: mergeQuantityParts(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (mergeFailures > 0) {
  console.error(`${mergeFailures}/${mergeCases.length} cas mergeQuantityParts en echec.`);
  process.exit(1);
}
console.log(`OK: ${mergeCases.length} cas mergeQuantityParts passes.`);

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
  },
  {
    merged: [{ key: "lait", name: "Lait", qty: "1 L" }],
    fridge: [["Lait", "500 ml"]],
    expected: [{ key: "lait", name: "Lait", qty: "500 ml" }]
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

const normalizeCases = [
  { input: "1 kg", expected: { value: 1000, unit: "g" } },
  { input: "2.5 L", expected: { value: 2500, unit: "ml" } },
  { input: "1 l", expected: { value: 1000, unit: "ml" } },
  { input: "500 g", expected: { value: 500, unit: "g" } },
  { input: "1 CS", expected: { value: 1, unit: "CS" } },
  { input: "1 pièce(s)", expected: { value: 1, unit: "pièce(s)" } },
  { input: "selon le goût", expected: null }
];

let normalizeFailures = 0;
for (const { input, expected } of normalizeCases) {
  const result = normalizeQuantity(input);
  try {
    assert.deepStrictEqual(result, expected);
  } catch {
    normalizeFailures++;
    console.error(`FAIL: normalizeQuantity(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (normalizeFailures > 0) {
  console.error(`${normalizeFailures}/${normalizeCases.length} cas normalizeQuantity en echec.`);
  process.exit(1);
}
console.log(`OK: ${normalizeCases.length} cas normalizeQuantity passes.`);

const checkCases = [
  {
    ingredients: [["Farine", "200 g"]],
    fridge: [["Farine", "500 g"]],
    expected: [{ name: "Farine", qty: "200 g", status: "ok" }]
  },
  {
    ingredients: [["Farine", "400 g"]],
    fridge: [["Farine", "150 g"]],
    expected: [{ name: "Farine", qty: "400 g", status: "manque", missing: "250 g" }]
  },
  {
    ingredients: [["Farine", "400 g"]],
    fridge: [],
    expected: [{ name: "Farine", qty: "400 g", status: "manque", missing: "400 g" }]
  },
  {
    ingredients: [["Farine", "400 g"]],
    fridge: [["Farine", "1 boîte"]],
    expected: [{ name: "Farine", qty: "400 g", status: "a-verifier" }]
  },
  {
    ingredients: [["Beurre", "1 CS"]],
    fridge: [["Beurre", "30 g"]],
    expected: [{ name: "Beurre", qty: "1 CS", status: "a-verifier" }]
  },
  {
    ingredients: [["Farine", "500 g"]],
    fridge: [["Farine", "1 kg"]],
    expected: [{ name: "Farine", qty: "500 g", status: "ok" }]
  },
  {
    ingredients: [["Beurre", "60 g"]],
    fridge: [["Beurre", "1 CS + 30 g + 60 g"]],
    expected: [{ name: "Beurre", qty: "60 g", status: "ok" }]
  },
  {
    ingredients: [["Poivre et sel", "selon le goût"]],
    fridge: [],
    expected: [{ name: "Poivre et sel", qty: "selon le goût", status: "ok" }]
  },
  {
    ingredients: [["Sel", "1 pinc."]],
    fridge: [],
    expected: [{ name: "Sel", qty: "1 pinc.", status: "ok" }]
  }
];

let checkFailures = 0;
for (const { ingredients, fridge, expected } of checkCases) {
  const result = checkFridgeAvailability(ingredients, fridge);
  try {
    assert.deepStrictEqual(result, expected);
  } catch {
    checkFailures++;
    console.error(`FAIL: checkFridgeAvailability(${JSON.stringify(ingredients)}, ${JSON.stringify(fridge)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (checkFailures > 0) {
  console.error(`${checkFailures}/${checkCases.length} cas checkFridgeAvailability en echec.`);
  process.exit(1);
}
console.log(`OK: ${checkCases.length} cas checkFridgeAvailability passes.`);

const reduceStockCases = [
  { input: ["400 g", "150 g"], expected: "250 g" },
  { input: ["150 g", "400 g"], expected: null },
  { input: ["1 CS + 30 g + 60 g", "60 g"], expected: "1 CS + 30 g" },
  { input: ["1 CS", "30 g"], expected: "1 CS" },
  { input: ["1 kg", "500 g"], expected: "500 g" }
];

let reduceStockFailures = 0;
for (const { input, expected } of reduceStockCases) {
  const result = reduceQuantityStock(...input);
  try {
    assert.equal(result, expected);
  } catch {
    reduceStockFailures++;
    console.error(`FAIL: reduceQuantityStock(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (reduceStockFailures > 0) {
  console.error(`${reduceStockFailures}/${reduceStockCases.length} cas reduceQuantityStock en echec.`);
  process.exit(1);
}
console.log(`OK: ${reduceStockCases.length} cas reduceQuantityStock passes.`);

const pantryStapleCases = [
  { input: "Sel", expected: true },
  { input: "Poivre", expected: true },
  { input: "Sel et poivre", expected: true },
  { input: "Poivre et sel", expected: true },
  { input: "Sel, poivre", expected: true },
  { input: "Poivre noir", expected: true },
  { input: "Fleur de sel", expected: true },
  { input: "Farine", expected: false },
  { input: "morceau de sel", expected: true },
  { input: "poivre du Pérou", expected: true },
  { input: "pincée de poivre", expected: true },
  { input: "Poivron", expected: false },
  { input: "Céleri", expected: false },
  { input: "Beurre demi-sel", expected: false },
  { input: "Sauce au poivre", expected: false },
  { input: "Cornichons au poivre vert", expected: false },
  { input: "Steak au poivre", expected: false }
];

let pantryStapleFailures = 0;
for (const { input, expected } of pantryStapleCases) {
  const result = isPantryStaple(input);
  try {
    assert.equal(result, expected);
  } catch {
    pantryStapleFailures++;
    console.error(`FAIL: isPantryStaple(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (pantryStapleFailures > 0) {
  console.error(`${pantryStapleFailures}/${pantryStapleCases.length} cas isPantryStaple en echec.`);
  process.exit(1);
}
console.log(`OK: ${pantryStapleCases.length} cas isPantryStaple passes.`);

const formatQuantityCases = [
  { input: [0.5, "pièce(s)"], expected: "1" },
  { input: [0.8, "pièce(s)"], expected: "1" },
  { input: [2, "pièce(s)"], expected: "2" },
  { input: [2.1, "pièce(s)"], expected: "3" },
  { input: [0, "pièce(s)"], expected: "0" },
  { input: [2.3, "g"], expected: "2,5" },
  { input: [3, "CS"], expected: "3" }
];

let formatQuantityFailures = 0;
for (const { input, expected } of formatQuantityCases) {
  const result = formatQuantityValue(...input);
  try {
    assert.equal(result, expected);
  } catch {
    formatQuantityFailures++;
    console.error(`FAIL: formatQuantityValue(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (formatQuantityFailures > 0) {
  console.error(`${formatQuantityFailures}/${formatQuantityCases.length} cas formatQuantityValue en echec.`);
  process.exit(1);
}
console.log(`OK: ${formatQuantityCases.length} cas formatQuantityValue passes.`);

const scaleCeilCases = [
  { input: ["0,5 pièce(s)", 1], expected: "1 pièce(s)" },
  { input: ["1 pièce(s)", 1.5], expected: "2 pièce(s)" },
  { input: ["1 pièce(s)", 2], expected: "2 pièce(s)" },
  { input: ["100 g", 1.5], expected: "150 g" }
];

let scaleCeilFailures = 0;
for (const { input, expected } of scaleCeilCases) {
  const result = scaleQuantity(...input);
  try {
    assert.equal(result, expected);
  } catch {
    scaleCeilFailures++;
    console.error(`FAIL: scaleQuantity(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (scaleCeilFailures > 0) {
  console.error(`${scaleCeilFailures}/${scaleCeilCases.length} cas scaleQuantity (arrondi piece(s)) en echec.`);
  process.exit(1);
}
console.log(`OK: ${scaleCeilCases.length} cas scaleQuantity (arrondi piece(s)) passes.`);

const fractionCases = [
  { input: "½ pièce(s)", expected: { value: 0.5, unit: "pièce(s)" } },
  { input: "⅓ sachet(s)", expected: { value: 1 / 3, unit: "sachet(s)" } },
  { input: "⅔ pot(s)", expected: { value: 2 / 3, unit: "pot(s)" } },
  { input: "1½ CS", expected: { value: 1.5, unit: "CS" } },
  { input: "¾ L", expected: { value: 0.75, unit: "L" } },
  { input: "400 g", expected: { value: 400, unit: "g" } },
  { input: "0,5 pièce(s)", expected: { value: 0.5, unit: "pièce(s)" } }
];

let fractionFailures = 0;
for (const { input, expected } of fractionCases) {
  const result = parseQuantity(input);
  try {
    assert.deepStrictEqual(result, expected);
  } catch {
    fractionFailures++;
    console.error(`FAIL: parseQuantity(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (fractionFailures > 0) {
  console.error(`${fractionFailures}/${fractionCases.length} cas parseQuantity (fractions unicode) en echec.`);
  process.exit(1);
}
console.log(`OK: ${fractionCases.length} cas parseQuantity (fractions unicode) passes.`);

const fractionCeilCases = [
  { input: ["½ pièce(s)", 1], expected: "1 pièce(s)" },
  { input: ["⅓ sachet(s)", 1], expected: "0,5 sachet(s)" }
];

let fractionCeilFailures = 0;
for (const { input, expected } of fractionCeilCases) {
  const result = scaleQuantity(...input);
  try {
    assert.equal(result, expected);
  } catch {
    fractionCeilFailures++;
    console.error(`FAIL: scaleQuantity(${JSON.stringify(input)}) => ${JSON.stringify(result)}, attendu ${JSON.stringify(expected)}`);
  }
}

if (fractionCeilFailures > 0) {
  console.error(`${fractionCeilFailures}/${fractionCeilCases.length} cas scaleQuantity (fractions -> affichage) en echec.`);
  process.exit(1);
}
console.log(`OK: ${fractionCeilCases.length} cas scaleQuantity (fractions -> affichage) passes.`);
