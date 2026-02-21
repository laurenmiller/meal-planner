import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ thumbnailUrl: null }), {
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

    return new Response(JSON.stringify({ thumbnailUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch {
    return new Response(JSON.stringify({ thumbnailUrl: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
