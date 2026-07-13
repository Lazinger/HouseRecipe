/* ---- données des recettes intégrées ---- */
export const RECIPES = [
  {
    id: "ratatouille",
    title: "Ratatouille provençale",
    category: "plat",
    icon: "pot",
    desc: "Légumes d'été mijotés doucement, à l'huile d'olive et au thym.",
    time: 55, servings: 4, difficulty: "Facile",
    ingredients: [
      ["Aubergine", "2 pièces"], ["Courgette", "3 pièces"], ["Poivron rouge", "2 pièces"],
      ["Tomate", "4 pièces"], ["Oignon", "2 pièces"], ["Ail", "3 gousses"],
      ["Huile d'olive", "6 c. à soupe"], ["Thym frais", "4 branches"], ["Sel, poivre", "au goût"]
    ],
    steps: [
      "Coupez tous les légumes en dés réguliers d'environ 1,5 cm.",
      "Faites revenir l'oignon et l'ail dans l'huile d'olive à feu moyen, 5 minutes.",
      "Ajoutez le poivron, faites cuire 5 minutes, puis l'aubergine et la courgette.",
      "Incorporez les tomates et le thym, salez, poivrez.",
      "Laissez mijoter à couvert 35 minutes en remuant de temps en temps.",
      "Retirez le couvercle 10 minutes en fin de cuisson pour réduire le jus."
    ],
    note: "Encore meilleure réchauffée le lendemain : les saveurs ont le temps de se mêler."
  },
  {
    id: "quiche-lorraine",
    title: "Quiche lorraine",
    category: "plat",
    icon: "tart",
    desc: "Pâte brisée, lardons fumés et appareil crémeux, sans fromage à l'origine.",
    time: 50, servings: 6, difficulty: "Facile",
    ingredients: [
      ["Pâte brisée", "1 rouleau"], ["Lardons fumés", "200 g"], ["Œufs", "3 pièces"],
      ["Crème fraîche épaisse", "20 cl"], ["Lait", "10 cl"], ["Noix de muscade", "1 pincée"],
      ["Sel, poivre", "au goût"]
    ],
    steps: [
      "Préchauffez le four à 200 °C. Étalez la pâte dans un moule à tarte.",
      "Faites revenir les lardons à sec 3 minutes, puis répartissez-les sur la pâte.",
      "Fouettez les œufs, la crème, le lait, la muscade, le sel et le poivre.",
      "Versez l'appareil sur les lardons.",
      "Enfournez 30 à 35 minutes, jusqu'à ce que la surface soit dorée."
    ],
    note: "La vraie recette lorraine ne contient pas de gruyère — mais personne ne vous en voudra d'en ajouter."
  },
  {
    id: "tarte-tatin",
    title: "Tarte Tatin",
    category: "dessert",
    icon: "tart",
    desc: "Pommes caramélisées renversées sur une pâte feuilletée croustillante.",
    time: 65, servings: 6, difficulty: "Intermédiaire",
    ingredients: [
      ["Pommes (Reinette)", "8 pièces"], ["Sucre", "150 g"], ["Beurre demi-sel", "80 g"],
      ["Pâte feuilletée", "1 rouleau"]
    ],
    steps: [
      "Épluchez et coupez les pommes en quartiers épais.",
      "Dans un moule allant au four, faites un caramel à sec avec le sucre.",
      "Ajoutez le beurre hors du feu, puis disposez les pommes serrées, côté bombé vers le bas.",
      "Faites cuire 15 minutes à feu doux sur la plaque de cuisson.",
      "Recouvrez de pâte feuilletée en rentrant les bords, puis enfournez 25 minutes à 200 °C.",
      "Laissez tiédir 10 minutes avant de démouler d'un geste sûr sur un plat."
    ],
    note: "Démoulez tant que c'est encore chaud : le caramel fige vite et colle au moule en refroidissant."
  },
  {
    id: "coq-au-vin",
    title: "Coq au vin",
    category: "plat",
    icon: "pot",
    desc: "Poulet mijoté au vin rouge, lardons, champignons et petits oignons.",
    time: 100, servings: 4, difficulty: "Intermédiaire",
    ingredients: [
      ["Cuisses de poulet", "6 pièces"], ["Vin rouge corsé", "75 cl"], ["Lardons", "150 g"],
      ["Champignons de Paris", "250 g"], ["Petits oignons grelots", "12 pièces"],
      ["Carotte", "2 pièces"], ["Ail", "3 gousses"], ["Bouquet garni", "1"], ["Farine", "2 c. à soupe"]
    ],
    steps: [
      "Faites dorer les morceaux de poulet dans une cocotte, puis réservez.",
      "Faites revenir les lardons, les oignons et les carottes dans la même cocotte.",
      "Saupoudrez de farine, mélangez 1 minute, puis remettez le poulet.",
      "Versez le vin, ajoutez l'ail et le bouquet garni, salez, poivrez.",
      "Laissez mijoter à couvert 1 h 15 à feu doux.",
      "Ajoutez les champignons 15 minutes avant la fin de cuisson."
    ],
    note: "Un vin qu'on accepterait de boire fera toujours une meilleure sauce."
  },
  {
    id: "crepes",
    title: "Crêpes fines",
    category: "dessert",
    icon: "crepe",
    desc: "La pâte de base à garder sous la main, sucrée ou salée.",
    time: 30, servings: 4, difficulty: "Facile",
    ingredients: [
      ["Farine", "250 g"], ["Œufs", "3 pièces"], ["Lait", "50 cl"],
      ["Beurre fondu", "50 g"], ["Sucre", "2 c. à soupe"], ["Sel", "1 pincée"]
    ],
    steps: [
      "Mélangez la farine, le sucre et le sel dans un saladier.",
      "Creusez un puits, ajoutez les œufs et fouettez en incorporant peu à peu le lait.",
      "Ajoutez le beurre fondu, puis laissez reposer la pâte 30 minutes.",
      "Faites cuire chaque crêpe 1 à 2 minutes par face dans une poêle chaude et légèrement beurrée."
    ],
    note: "Une pâte reposée donne des crêpes plus souples : ne sautez pas cette étape si vous avez le temps."
  },
  {
    id: "soupe-oignon",
    title: "Soupe à l'oignon gratinée",
    category: "entrée",
    icon: "bowl",
    desc: "Oignons longuement caramélisés, croûtons et gruyère fondu.",
    time: 75, servings: 4, difficulty: "Facile",
    ingredients: [
      ["Oignons jaunes", "6 pièces"], ["Beurre", "40 g"], ["Bouillon de bœuf", "1,2 l"],
      ["Vin blanc sec", "10 cl"], ["Pain de campagne", "8 tranches"], ["Gruyère râpé", "150 g"]
    ],
    steps: [
      "Émincez finement les oignons.",
      "Faites-les fondre dans le beurre à feu doux 35 à 40 minutes, jusqu'à belle coloration.",
      "Déglacez au vin blanc, puis ajoutez le bouillon et laissez mijoter 20 minutes.",
      "Répartissez la soupe dans des bols, couvrez de pain et de gruyère.",
      "Passez sous le grill quelques minutes jusqu'à ce que le fromage gratine."
    ],
    note: "La patience sur les oignons fait toute la différence : ne pressez pas la caramélisation."
  },
  {
    id: "tarte-citron",
    title: "Tarte au citron meringuée",
    category: "dessert",
    icon: "tart",
    desc: "Crème citron acidulée sur pâte sablée, meringue légèrement dorée.",
    time: 80, servings: 8, difficulty: "Intermédiaire",
    ingredients: [
      ["Pâte sablée", "1 fond de tarte"], ["Citrons", "4 pièces"], ["Œufs", "4 pièces"],
      ["Sucre", "180 g"], ["Beurre", "100 g"], ["Blancs d'œufs (meringue)", "3 pièces"],
      ["Sucre (meringue)", "90 g"]
    ],
    steps: [
      "Faites cuire le fond de tarte à blanc 15 minutes à 180 °C.",
      "Fouettez les œufs et le sucre, ajoutez le jus et le zeste de citron.",
      "Faites épaissir au bain-marie en remuant, puis incorporez le beurre hors du feu.",
      "Versez la crème sur le fond de tarte cuit et laissez refroidir.",
      "Montez les blancs en neige avec le sucre pour une meringue brillante.",
      "Recouvrez la tarte de meringue et dorez au chalumeau ou sous le grill."
    ],
    note: "Zestez les citrons avant de les presser — l'inverse est nettement plus périlleux."
  },
  {
    id: "confit-oignons",
    title: "Confit d'oignons maison",
    category: "entrée",
    icon: "jar",
    desc: "Un condiment sucré-salé qui accompagne charcuteries et fromages.",
    time: 60, servings: 1, difficulty: "Facile",
    ingredients: [
      ["Oignons rouges", "1 kg"], ["Sucre roux", "100 g"], ["Vinaigre balsamique", "8 cl"],
      ["Beurre", "30 g"], ["Sel", "1 pincée"]
    ],
    steps: [
      "Émincez finement les oignons.",
      "Faites-les suer dans le beurre à feu doux 10 minutes.",
      "Ajoutez le sucre et laissez caraméliser légèrement 10 minutes.",
      "Versez le vinaigre, salez, et laissez mijoter à découvert 30 minutes en remuant régulièrement.",
      "Mettez en pot une fois la texture bien confite et laissez refroidir avant de fermer."
    ],
    note: "Se conserve environ deux semaines au réfrigérateur dans un bocal propre."
  }
];

export const CATEGORY_ICON = { "entrée": "bowl", plat: "pot", dessert: "tart" };
export const CATEGORY_LABELS = { tout: "Toutes les recettes", "entrée": "Entrées", plat: "Plats", dessert: "Desserts", favoris: "Mes favoris" };
