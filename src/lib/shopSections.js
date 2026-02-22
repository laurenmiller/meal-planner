export const SHOP_SECTIONS = [
  { id: 'produce', label: 'Produce' },
  { id: 'meat',    label: 'Meat & Fish' },
  { id: 'dairy',   label: 'Dairy & Eggs' },
  { id: 'pantry',  label: 'Pantry & Dry Goods' },
  { id: 'bread',   label: 'Bread & Bakery' },
  { id: 'frozen',  label: 'Frozen' },
  { id: 'other',   label: 'Other' },
]

// Default keywords used to seed the database — also used as fallback
// if the DB hasn't been seeded yet.
export const DEFAULT_SECTION_KEYWORDS = {
  produce: [
    'apple', 'apples', 'avocado', 'banana', 'basil', 'bean', 'beans',
    'beet', 'bell pepper', 'broccoli', 'cabbage', 'carrot', 'carrots',
    'cauliflower', 'celery', 'cilantro', 'corn', 'cucumber', 'dill',
    'eggplant', 'fennel', 'garlic', 'ginger', 'grape', 'grapes',
    'green bean', 'herb', 'jalapeño', 'kale', 'leek', 'lemon', 'lemons',
    'lettuce', 'lime', 'limes', 'mango', 'mint', 'mushroom', 'mushrooms',
    'onion', 'onions', 'orange', 'parsley', 'peach', 'pear', 'peas',
    'pepper', 'peppers', 'potato', 'potatoes', 'radish', 'rosemary',
    'sage', 'scallion', 'shallot', 'spinach', 'squash', 'strawberry',
    'sweet potato', 'thyme', 'tomato', 'tomatoes', 'zucchini'
  ],
  meat: [
    'anchovy', 'bacon', 'beef', 'chicken', 'chorizo', 'clam', 'cod',
    'crab', 'duck', 'fish', 'ground beef', 'ground pork', 'ground turkey',
    'ham', 'lamb', 'lobster', 'pancetta', 'pork', 'prosciutto',
    'salmon', 'sausage', 'scallop', 'shrimp', 'steak', 'tilapia',
    'tuna', 'turkey'
  ],
  dairy: [
    'butter', 'cheddar', 'cheese', 'cottage cheese', 'cream',
    'cream cheese', 'egg', 'eggs', 'feta', 'goat cheese', 'gruyere',
    'half and half', 'heavy cream', 'mascarpone', 'milk', 'mozzarella',
    'parmesan', 'pecorino', 'ricotta', 'sour cream', 'whipped cream',
    'yogurt'
  ],
  pantry: [
    'baking powder', 'baking soda', 'bean', 'beans', 'broth', 'brown sugar',
    'buckwheat', 'canned', 'cannellini', 'chickpea', 'chickpeas',
    'chocolate', 'cocoa', 'coconut milk', 'cornstarch', 'couscous',
    'ditalini', 'dried', 'extract', 'fish sauce', 'flour', 'honey',
    'hot sauce', 'jam', 'ketchup', 'lentil', 'lentils', 'maple syrup',
    'mayonnaise', 'mirin', 'miso', 'mustard', 'noodle', 'noodles',
    'nutritional yeast', 'oat', 'oats', 'oil', 'olive oil', 'oregano',
    'panko', 'paprika', 'pasta', 'pepper flakes', 'quinoa', 'rice',
    'rice vinegar', 'salt', 'sesame oil', 'soy sauce', 'spice', 'stock',
    'sugar', 'tahini', 'tomato paste', 'vanilla', 'vinegar', 'worcestershire'
  ],
  bread: [
    'baguette', 'bread', 'brioche', 'bun', 'buns', 'ciabatta', 'crouton',
    'english muffin', 'flatbread', 'naan', 'pita', 'roll', 'rolls',
    'sourdough', 'tortilla', 'tortillas', 'wrap'
  ],
  frozen: [
    'frozen', 'ice cream', 'popsicle'
  ],
}

export function getSectionForIngredient(ingredient, keywordMap) {
  const keywords = keywordMap || DEFAULT_SECTION_KEYWORDS
  const normalized = ingredient.toLowerCase()
  for (const section of SHOP_SECTIONS) {
    if (section.id === 'other') continue
    const kws = keywords[section.id] || []
    if (kws.some(kw => normalized.includes(kw))) {
      return section.id
    }
  }
  return 'other'
}
