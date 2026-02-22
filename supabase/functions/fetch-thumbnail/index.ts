import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

/** Parse ISO 8601 duration to minutes: PT45M → 45, PT1H30M → 90, P0DT1H → 60 */
function parseDuration(iso: string | undefined | null): number | null {
  if (!iso || typeof iso !== "string") return null
  const h = iso.match(/(\d+)H/)
  const m = iso.match(/(\d+)M/)
  const hours = h ? parseInt(h[1]) : 0
  const mins = m ? parseInt(m[1]) : 0
  const total = hours * 60 + mins
  return total > 0 ? total : null
}

/** Find a Recipe object inside JSON-LD data (handles @graph, arrays, nested) */
function findRecipe(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipe(item)
      if (found) return found
    }
    return null
  }
  const obj = data as Record<string, unknown>
  if (obj["@type"] === "Recipe") return obj
  if (Array.isArray(obj["@type"]) && (obj["@type"] as string[]).includes("Recipe")) return obj
  if (Array.isArray(obj["@graph"])) return findRecipe(obj["@graph"])
  return null
}

/** Normalize recipeInstructions to string[] */
function parseInstructions(raw: unknown): string[] | null {
  if (!raw) return null
  if (!Array.isArray(raw)) return null
  const steps: string[] = []
  for (const item of raw) {
    if (typeof item === "string") {
      steps.push(item)
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>
      // HowToStep or HowToSection
      if (typeof obj.text === "string") {
        steps.push(obj.text)
      } else if (Array.isArray(obj.itemListElement)) {
        const sub = parseInstructions(obj.itemListElement)
        if (sub) steps.push(...sub)
      }
    }
  }
  return steps.length > 0 ? steps : null
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ thumbnailUrl: null, scrapedData: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MealPlanner/1.0)" },
    })
    clearTimeout(timeout)

    const html = await res.text()

    // Extract og:image from HTML
    const ogMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ) || html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )
    const thumbnailUrl = ogMatch?.[1] || null

    // Extract JSON-LD Recipe data
    let scrapedData = null
    try {
      const ldMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
      for (const m of ldMatches) {
        try {
          const parsed = JSON.parse(m[1])
          const recipe = findRecipe(parsed)
          if (recipe) {
            const ingredients = Array.isArray(recipe.recipeIngredient)
              ? (recipe.recipeIngredient as string[]).filter(s => typeof s === "string")
              : null

            const servingsRaw = recipe.recipeYield
            let servings: string | null = null
            if (Array.isArray(servingsRaw)) servings = String(servingsRaw[0])
            else if (servingsRaw) servings = String(servingsRaw)

            scrapedData = {
              title: (typeof recipe.name === "string" ? recipe.name : null),
              description: (typeof recipe.description === "string" ? recipe.description : null),
              ingredients: ingredients && ingredients.length > 0 ? ingredients : null,
              instructions: parseInstructions(recipe.recipeInstructions),
              cookTime: parseDuration(recipe.totalTime as string) || parseDuration(recipe.cookTime as string),
              servings,
            }
            break
          }
        } catch { /* skip malformed JSON-LD block */ }
      }
    } catch { /* JSON-LD extraction failed, continue with thumbnail only */ }

    return new Response(JSON.stringify({ thumbnailUrl, scrapedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch {
    return new Response(JSON.stringify({ thumbnailUrl: null, scrapedData: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
