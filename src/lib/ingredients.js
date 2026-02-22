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
