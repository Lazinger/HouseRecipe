/* ---- calendrier de saisonnalité (France, pleine saison) et matching avec
   les ingrédients des recettes. Donnée statique, jamais modifiée par
   l'utilisateur — pas de table Supabase, comme ALLERGENS. ---- */
export const SEASONAL_PRODUCE = [
  { id: "ail", label: "Ail", months: [6,7,8,9], aliases: ["ail"] },
  { id: "artichaut", label: "Artichaut", months: [5,6,7,8,9,10], aliases: ["artichaut","artichauts"] },
  { id: "asperge", label: "Asperge", months: [4,5,6], aliases: ["asperge","asperges"] },
  { id: "aubergine", label: "Aubergine", months: [6,7,8,9,10], aliases: ["aubergine","aubergines"] },
  { id: "betterave", label: "Betterave", months: [6,7,8,9,10,11], aliases: ["betterave","betteraves"] },
  { id: "brocoli", label: "Brocoli", months: [1,2,3,9,10,11,12], aliases: ["brocoli","brocolis"] },
  { id: "carotte", label: "Carotte", months: [1,2,3,4,5,6,7,8,9,10,11,12], aliases: ["carotte","carottes"] },
  { id: "celeri-branche", label: "Céleri branche", months: [6,7,8,9,10,11], aliases: ["celeri branche","celeri"] },
  { id: "champignon", label: "Champignon", months: [9,10,11], aliases: ["champignon","champignons"] },
  { id: "chou-blanc", label: "Chou blanc", months: [1,2,3,9,10,11,12], aliases: ["chou blanc","choux blancs","chou vert","choux verts"] },
  { id: "chou-fleur", label: "Chou-fleur", months: [1,2,3,4,9,10,11,12], aliases: ["chou-fleur","choux-fleurs"] },
  { id: "chou-de-bruxelles", label: "Chou de Bruxelles", months: [10,11,12,1,2], aliases: ["chou de bruxelles","choux de bruxelles"] },
  { id: "concombre", label: "Concombre", months: [5,6,7,8,9], aliases: ["concombre","concombres"] },
  { id: "courgette", label: "Courgette", months: [5,6,7,8,9,10], aliases: ["courgette","courgettes"] },
  { id: "endive", label: "Endive", months: [10,11,12,1,2,3,4], aliases: ["endive","endives"] },
  { id: "epinard", label: "Épinard", months: [3,4,5,9,10,11], aliases: ["epinard","epinards"] },
  { id: "fenouil", label: "Fenouil", months: [6,7,8,9,10,11], aliases: ["fenouil"] },
  { id: "haricot-vert", label: "Haricot vert", months: [6,7,8,9], aliases: ["haricot vert","haricots verts"] },
  { id: "laitue", label: "Laitue / Salade verte", months: [4,5,6,7,8,9,10], aliases: ["laitue","laitues","salade verte","salades vertes"] },
  { id: "mais", label: "Maïs doux", months: [7,8,9], aliases: ["mais"] },
  { id: "navet", label: "Navet", months: [6,7,8,9,10,11,12,1,2,3], aliases: ["navet","navets"] },
  { id: "oignon", label: "Oignon", months: [1,2,3,4,5,6,7,8,9,10,11,12], aliases: ["oignon","oignons"] },
  { id: "petit-pois", label: "Petit pois", months: [5,6,7], aliases: ["petit pois","petits pois"] },
  { id: "poireau", label: "Poireau", months: [9,10,11,12,1,2,3,4], aliases: ["poireau","poireaux"] },
  { id: "poivron", label: "Poivron", months: [6,7,8,9,10], aliases: ["poivron","poivrons"] },
  { id: "pomme-de-terre", label: "Pomme de terre", months: [1,2,3,4,5,6,7,8,9,10,11,12], aliases: ["pomme de terre","pommes de terre","patate","patates"] },
  { id: "potiron", label: "Potiron / Courge", months: [9,10,11,12], aliases: ["potiron","potirons","courge","courges","citrouille","citrouilles"] },
  { id: "radis", label: "Radis", months: [4,5,6,7,8,9], aliases: ["radis"] },
  { id: "salsifis", label: "Salsifis", months: [10,11,12,1,2,3], aliases: ["salsifis"] },
  { id: "tomate", label: "Tomate", months: [6,7,8,9,10], aliases: ["tomate","tomates"] },
  { id: "abricot", label: "Abricot", months: [6,7,8], aliases: ["abricot","abricots"] },
  { id: "cerise", label: "Cerise", months: [5,6,7], aliases: ["cerise","cerises"] },
  { id: "citron", label: "Citron", months: [11,12,1,2,3,4], aliases: ["citron","citrons"] },
  { id: "clementine", label: "Clémentine", months: [11,12,1], aliases: ["clementine","clementines","mandarine","mandarines"] },
  { id: "fraise", label: "Fraise", months: [4,5,6,7], aliases: ["fraise","fraises"] },
  { id: "framboise", label: "Framboise", months: [6,7,8,9], aliases: ["framboise","framboises"] },
  { id: "kiwi", label: "Kiwi", months: [11,12,1,2,3], aliases: ["kiwi","kiwis"] },
  { id: "melon", label: "Melon", months: [6,7,8,9], aliases: ["melon","melons"] },
  { id: "mirabelle", label: "Mirabelle", months: [8,9], aliases: ["mirabelle","mirabelles"] },
  { id: "mure", label: "Mûre", months: [8,9,10], aliases: ["mure","mures"] },
  { id: "myrtille", label: "Myrtille", months: [7,8,9], aliases: ["myrtille","myrtilles"] },
  { id: "peche", label: "Pêche / Nectarine", months: [6,7,8,9], aliases: ["peche","peches","nectarine","nectarines"] },
  { id: "poire", label: "Poire", months: [9,10,11,12,1], aliases: ["poire","poires"] },
  { id: "pomme", label: "Pomme", months: [9,10,11,12,1,2,3], aliases: ["pomme","pommes"] },
  { id: "prune", label: "Prune / Quetsche", months: [7,8,9], aliases: ["prune","prunes","quetsche","quetsches"] },
  { id: "raisin", label: "Raisin", months: [8,9,10], aliases: ["raisin","raisins"] },
  { id: "rhubarbe", label: "Rhubarbe", months: [4,5,6,7], aliases: ["rhubarbe"] }
];

function normalizeForMatch(str){
  return String(str).toLowerCase().normalize("NFD")
    .split("").filter(ch => ch.codePointAt(0) < 0x300 || ch.codePointAt(0) > 0x36f).join("");
}

function tokenize(str){
  return normalizeForMatch(str).split(/[^a-z]+/).filter(Boolean);
}

// Un alias (un ou plusieurs mots) doit apparaitre comme une sequence de mots
// EXACTS et contigus dans l'ingredient - jamais un simple sous-texte - pour
// eviter qu'un mot ne soit reconnu a tort parce qu'il est prefixe d'un autre
// (ex. "poireau" ne doit jamais matcher l'alias "poire", "courgette" ne doit
// jamais matcher "courge"). C'est pour ca que chaque forme singulier/pluriel
// figure explicitement dans les alias de SEASONAL_PRODUCE plutot que d'etre
// devinee par une regle de pluriel ici.
function ingredientContainsAliasWords(ingredientTokens, aliasTokens){
  for (let i = 0; i <= ingredientTokens.length - aliasTokens.length; i++) {
    if (aliasTokens.every((word, j) => ingredientTokens[i + j] === word)) return true;
  }
  return false;
}

// "Pomme de terre"/"Patate" contiennent le mot "pomme" en tete : meme avec un
// matching par mot entier, "pomme" (fruit) matcherait aussi ces ingredients
// puisque "pommes" y est un mot valide a part entiere - seule collision qui
// necessite une exclusion explicite en plus du matching par mot (le mot de
// tete d'un nom compose reste un mot valide isole, la tokenisation seule ne
// peut pas distinguer ce cas).
const POMME_DE_TERRE_PATTERN = /pommes?\s+de\s+terre/;

export function produceMatchesRecipe(produce, recipe){
  return recipe.ingredients.some(([name]) => {
    const normName = normalizeForMatch(name);
    if (produce.id === "pomme" && POMME_DE_TERRE_PATTERN.test(normName)) return false;
    const ingredientTokens = tokenize(name);
    return produce.aliases.some(alias => ingredientContainsAliasWords(ingredientTokens, tokenize(alias)));
  });
}

export function seasonalProduceForMonth(month){
  return SEASONAL_PRODUCE.filter(p => p.months.includes(month))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}
