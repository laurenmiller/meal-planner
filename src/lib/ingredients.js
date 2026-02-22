/**
 * Strip quantities and measurements from an ingredient string,
 * returning just the food name for display as a shopping pill.
 *
 * "2 cups all-purpose flour" → "all-purpose flour"
 * "1/2 lb salmon fillet"     → "salmon fillet"
 * "salt and pepper to taste" → "salt and pepper"
 * "3 large eggs"             → "eggs"
 */

const UNITS = new Set([
  // volume
  "cup","cups","c","tablespoon","tablespoons","tbsp","tbs","tb",
  "teaspoon","teaspoons","tsp","ml","milliliter","milliliters",
  "liter","liters","l","fl","oz","fluid",
  // weight
  "pound","pounds","lb","lbs","ounce","ounces","oz","g","gram","grams",
  "kg","kilogram","kilograms",
  // count / size
  "large","small","medium","whole","piece","pieces","bunch","bunches",
  "clove","cloves","can","cans","jar","jars","package","packages","pkg",
  "bag","bags","box","boxes","stick","sticks","head","heads","sprig","sprigs",
  "slice","slices","pinch","dash","handful",
])

const QTY_RE = /^[\d¼½¾⅓⅔⅛⅜⅝⅞/.\s-]+/

const TAIL_RE = /[,;]?\s*(?:to taste|for serving|for garnish|as needed|optional|divided|plus more|or more|or less|about|approximately|roughly|freshly).*$/i

export function normalizeIngredient(raw) {
  let s = raw.trim()

  // Remove leading quantities: "2 1/2", "1/4", "½", "3-4", etc.
  s = s.replace(QTY_RE, "").trim()

  // Remove parenthetical notes: "(about 2 cups)", "(optional)"
  s = s.replace(/\(.*?\)/g, "").trim()

  // Remove leading unit words
  const words = s.split(/\s+/)
  while (words.length > 1 && UNITS.has(words[0].toLowerCase().replace(/[.,]/g, ""))) {
    words.shift()
  }
  s = words.join(" ")

  // Remove "of" prefix: "of butter" → "butter"
  s = s.replace(/^of\s+/i, "")

  // Remove trailing qualifiers
  s = s.replace(TAIL_RE, "").trim()

  // Remove trailing comma/period
  s = s.replace(/[,.\s]+$/, "")

  return s || raw.trim()
}

// ── Baseline staple filter ──────────────────────────────────────────────────

export const BASELINE_STAPLES = [
  "garlic", "olive oil", "butter", "salt", "pepper", "black pepper",
  "sugar", "flour", "vegetable oil", "cooking spray", "water",
  "soy sauce", "vinegar", "lemon juice", "onion", "baking powder",
  "baking soda", "cornstarch", "honey", "mustard",
]

export function isBaselineStaple(ingredientText) {
  const norm = normalizeIngredient(ingredientText).toLowerCase()
  return BASELINE_STAPLES.some(s => norm.includes(s))
}

// ── Duplicate detection ─────────────────────────────────────────────────────

const DESCRIPTORS = new Set([
  "shredded", "chopped", "diced", "minced", "fresh", "dried", "sliced",
  "peeled", "cooked", "frozen", "canned", "ground", "whole", "large",
  "small", "medium",
])

export function extractSignificantWords(ingredientText) {
  const norm = normalizeIngredient(ingredientText).toLowerCase()
  return norm
    .split(/[\s,\-]+/)
    .filter(w => w.length >= 4 && !UNITS.has(w) && !DESCRIPTORS.has(w))
}

export function findDuplicates(items) {
  // Map: significantWord → [indices that contain it as last or only significant word]
  const wordToItems = new Map()
  const itemWords = items.map(item => extractSignificantWords(item.text))

  itemWords.forEach((words, idx) => {
    if (!words.length) return
    // Use the last significant word as the key (or the only one)
    const key = words[words.length - 1]
    if (!wordToItems.has(key)) wordToItems.set(key, [])
    wordToItems.get(key).push(idx)
  })

  // Build result: Map of item.id → array of duplicate partners
  const result = new Map()
  for (const [, indices] of wordToItems) {
    if (indices.length < 2) continue
    for (const idx of indices) {
      const partners = indices
        .filter(i => i !== idx)
        .map(i => ({ text: items[i].text, recipeName: items[i].recipeName }))
      result.set(items[idx].id, partners)
    }
  }
  return result
}
