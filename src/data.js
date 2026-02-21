export const RECIPES_INIT = [
  { id:1, title:"Miso-Glazed Salmon",         source:"NYT Cooking",     tags:["fish"],       time:30, category:"dinner",    prepNote:"Make miso glaze ahead",                   url:"https://cooking.nytimes.com/recipes/1017823-miso-glazed-salmon", ingredients:["salmon fillet","white miso","mirin","rice vinegar"] },
  { id:2, title:"Pasta e Fagioli",             source:"Smitten Kitchen", tags:["vegetarian"], time:45, category:"dinner",    prepNote:"Cook white beans",                        url:"https://smittenkitchen.com/2013/01/pasta-e-fagioli/",            ingredients:["cannellini beans","ditalini pasta","fresh rosemary","parmesan rind"] },
  { id:3, title:"Sheet Pan Chicken Thighs",   source:"Serious Eats",    tags:[],               time:50, category:"dinner",    prepNote:"Marinate chicken — lemon, garlic, thyme", url:"https://www.seriouseats.com/sheet-pan-chicken-thighs",           ingredients:["bone-in chicken thighs","lemon","fresh thyme"] },
  { id:4, title:"Black Bean Tacos",            source:"Budget Bytes",    tags:["vegetarian"], time:20, category:"dinner",    url:"https://www.budgetbytes.com/black-bean-tacos/", ingredients:["canned black beans","corn tortillas","cotija cheese","avocado","lime","fresh cilantro"] },
  { id:5, title:"Pork Tenderloin with Apples", source:"Bon Appétit",     tags:[],               time:40, category:"dinner",    prepNote:"Brine pork tenderloin overnight",          ingredients:["pork tenderloin","honeycrisp apples","hard cider","fresh sage"] },
  { id:6, title:"Lentil Soup",                source:"The Food Lab",    tags:["vegetarian"], time:55, category:"dinner",    ingredients:["french lentils","canned tomatoes","carrot","celery","cumin","smoked paprika"] },
  { id:7, title:"Banana Oat Pancakes",         source:"Added manually",  tags:[],               time:20, category:"breakfast", ingredients:["ripe bananas","rolled oats","eggs","baking powder"] },
  { id:8, title:"Chocolate Chip Cookies",      source:"NYT Cooking",     tags:[],               time:35, category:"sweets",    ingredients:["butter","brown sugar","eggs","vanilla","flour","chocolate chips"] },
];

export const WEEK_INIT = [
  { day:"Mon", recipe:RECIPES_INIT[2] },
  { day:"Tue", recipe:RECIPES_INIT[0] },
  { day:"Wed", recipe:null },
  { day:"Thu", recipe:RECIPES_INIT[1] },
  { day:"Fri", recipe:RECIPES_INIT[4] },
  { day:"Sat", recipe:null },
  { day:"Sun", recipe:RECIPES_INIT[3] },
];

export const RADAR_INIT = [
  { id: "r1", title: "Miso Glazed Black Cod", url: "https://nomnompaleo.com/miso-glazed-black-cod", source: "Nom Nom Paleo" },
  { id: "r2", title: "Shakshuka with Feta",   url: "https://cooking.nytimes.com/recipes/1014721-shakshuka-with-feta", source: "NYT Cooking" },
  { id: "r3", title: "Butternut Squash Risotto", url: null, source: "Bon Appétit" },
];

export const BATCH_INIT = [
  { id:1, recipeId:7 },
  { id:2, recipeId:8 },
];


export const INV_INIT = {
  fridge:  [{ item:"Broccoli", s:"soon" }, { item:"Baby spinach", s:"soon" }, { item:"Carrots", s:"ok" }, { item:"Leftover rotisserie chicken", s:"soon" }],
  freezer: [{ item:"Ground beef", qty:1 }, { item:"Chicken breasts", qty:2 }, { item:"Shrimp", qty:1 }],
};

export const STAPLES_INIT = [
  "garlic","olive oil","butter","onion","salt","black pepper",
  "flour","sugar","baking powder","soy sauce","vegetable broth","chicken broth",
  "canned diced tomatoes","red pepper flakes","dried oregano","bay leaves",
  "rice","pasta","heavy cream","parmesan",
].map(name => ({ name, status: "ok" })); // status: "ok" | "restock"

export const WEEKLY_REGULARS_INIT = [
  "eggs", "milk", "sandwich bread", "yogurt", "cheddar cheese", "lemons",
].map(name => ({ id: "reg:" + name, name }));


export const DEFAULT_STUB_LABEL = "leftovers or takeout";

// Convert "H:MM" string to total minutes
export const toMins = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
// Convert total minutes back to "H:MM" string
export const toTime = m => { const h = Math.floor(((m % 1440) + 1440) % 1440 / 60); const min = ((m % 1440) + 1440) % 1440 % 60; return `${h}:${String(min).padStart(2,"0")}`; };
// Calculate start time given readyBy time and cook duration in minutes
export const calcStart = (readyBy, cookTime) => toTime(toMins(readyBy) - cookTime);
// Format "18:30" as "6:30 pm"
export const formatReadyBy = t => { const [h,m] = t.split(":").map(Number); const ampm = h >= 12 ? "pm" : "am"; const h12 = h > 12 ? h-12 : h; return `${h12}:${String(m).padStart(2,"0")} ${ampm}`; };

// ── Tag helpers ───────────────────────────────────────────────────────────────
