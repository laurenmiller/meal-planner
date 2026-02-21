import { supabase } from './supabase.js'

// ── Week helpers ─────────────────────────────────────────────────────────────

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** Current Monday as YYYY-MM-DD */
function getCurrentMonday() {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return mon.toISOString().slice(0, 10)
}

export const THIS_WEEK = getCurrentMonday()

// ── Recipe shape converter ───────────────────────────────────────────────────

/** Convert DB row (snake_case) → app shape (camelCase) */
export function toAppRecipe(row) {
  return {
    id:          row.id,
    title:       row.title,
    source:      row.source || "Added manually",
    url:         row.url || null,
    time:        row.time_mins || 30,
    tags:        row.tags || [],
    category:    row.category || "dinner",
    prepNote:    row.prep_note || undefined,
    pdfUrl:      row.pdf_url || undefined,
    ingredients: row.ingredients || [],
    thumbnailUrl: row.thumbnail_url || null,
  }
}

/** Convert app shape → DB row */
function toDbRecipe(recipe) {
  return {
    title:       recipe.title,
    source:      recipe.source,
    url:         recipe.url || null,
    time_mins:   recipe.time || 30,
    tags:        recipe.tags || [],
    category:    recipe.category || "dinner",
    prep_note:   recipe.prepNote || null,
    pdf_url:     recipe.pdfUrl || null,
    ingredients: recipe.ingredients || [],
    thumbnail_url: recipe.thumbnailUrl || null,
  }
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export async function fetchRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('id')
  if (error) { console.error('fetchRecipes', error); return [] }
  return data
}

export async function addRecipe(recipe) {
  const { data, error } = await supabase
    .from('recipes')
    .insert(toDbRecipe(recipe))
    .select()
    .single()
  if (error) { console.error('addRecipe', error); throw error }
  return data
}

export async function updateRecipe(id, recipe) {
  const { error } = await supabase
    .from('recipes')
    .update(toDbRecipe(recipe))
    .eq('id', id)
  if (error) console.error('updateRecipe', error)
}

export async function deleteRecipe(id) {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id)
  if (error) console.error('deleteRecipe', error)
}

// ── Week Plan ────────────────────────────────────────────────────────────────

export async function fetchWeekPlan() {
  const { data, error } = await supabase
    .from('week_plan')
    .select('*, recipe:recipes(*)')
    .eq('week_start', THIS_WEEK)
    .order('day')
  if (error) { console.error('fetchWeekPlan', error); return DAY_NAMES.map(day => ({ day, recipe: null, note: null })) }

  // Build full 7-day array, filling gaps
  const byIndex = {}
  data.forEach(row => { byIndex[row.day] = row })
  return DAY_NAMES.map((day, i) => {
    const row = byIndex[i]
    return {
      day,
      recipe: row?.recipe ? toAppRecipe(row.recipe) : null,
      note:   row?.note || null,
    }
  })
}

export async function upsertWeekDay(week, dayIndex, fields) {
  const row = { week_start: week, day: dayIndex }
  if ('recipeId' in fields) row.recipe_id = fields.recipeId
  if ('note' in fields) row.note = fields.note

  const { error } = await supabase
    .from('week_plan')
    .upsert(row, { onConflict: 'week_start,day' })
  if (error) console.error('upsertWeekDay', error)
}

export async function clearWeekPlan(week) {
  const { error } = await supabase
    .from('week_plan')
    .delete()
    .eq('week_start', week)
  if (error) console.error('clearWeekPlan', error)
}

// ── Batch Prep ───────────────────────────────────────────────────────────────

export async function fetchBatchPrep() {
  const { data, error } = await supabase
    .from('batch_prep')
    .select('*, recipe:recipes(*)')
    .eq('week_start', THIS_WEEK)
  if (error) { console.error('fetchBatchPrep', error); return [] }
  return data.map(row => row.recipe ? toAppRecipe(row.recipe) : null).filter(Boolean)
}

export async function addBatchItem(week, recipeId) {
  const { error } = await supabase
    .from('batch_prep')
    .insert({ week_start: week, recipe_id: recipeId })
  if (error) console.error('addBatchItem', error)
}

export async function removeBatchItem(week, recipeId) {
  const { error } = await supabase
    .from('batch_prep')
    .delete()
    .eq('week_start', week)
    .eq('recipe_id', recipeId)
  if (error) console.error('removeBatchItem', error)
}

export async function clearBatchPrep(week) {
  const { error } = await supabase
    .from('batch_prep')
    .delete()
    .eq('week_start', week)
  if (error) console.error('clearBatchPrep', error)
}

// ── Radar (watchlist) ────────────────────────────────────────────────────────

export async function fetchRadar() {
  const { data, error } = await supabase
    .from('radar')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('fetchRadar', error); return [] }
  return data.map(row => ({
    id:     row.id,
    title:  row.title,
    url:    row.url || null,
    source: row.source || "",
  }))
}

export async function addRadarItem(item) {
  const { data, error } = await supabase
    .from('radar')
    .insert({ title: item.title, url: item.url || null, source: item.source || "" })
    .select()
    .single()
  if (error) { console.error('addRadarItem', error); throw error }
  return { id: data.id, title: data.title, url: data.url, source: data.source }
}

export async function removeRadarItem(id) {
  const { error } = await supabase
    .from('radar')
    .delete()
    .eq('id', id)
  if (error) console.error('removeRadarItem', error)
}

// ── Fridge ───────────────────────────────────────────────────────────────────

export async function fetchFridge() {
  const { data, error } = await supabase
    .from('fridge')
    .select('*')
    .order('id')
  if (error) { console.error('fetchFridge', error); return [] }
  return data.map(row => ({ id: row.id, item: row.item, s: row.status }))
}

export async function addFridgeItem(item, status) {
  const { data, error } = await supabase
    .from('fridge')
    .insert({ item, status: status || 'ok' })
    .select()
    .single()
  if (error) { console.error('addFridgeItem', error); throw error }
  return { id: data.id, item: data.item, s: data.status }
}

export async function updateFridgeItem(id, fields) {
  const row = {}
  if ('item' in fields) row.item = fields.item
  if ('s' in fields) row.status = fields.s
  const { error } = await supabase
    .from('fridge')
    .update(row)
    .eq('id', id)
  if (error) console.error('updateFridgeItem', error)
}

export async function removeFridgeItem(id) {
  const { error } = await supabase
    .from('fridge')
    .delete()
    .eq('id', id)
  if (error) console.error('removeFridgeItem', error)
}

// ── Freezer ──────────────────────────────────────────────────────────────────

export async function fetchFreezer() {
  const { data, error } = await supabase
    .from('freezer')
    .select('*')
    .order('id')
  if (error) { console.error('fetchFreezer', error); return [] }
  return data.map(row => ({ id: row.id, item: row.item, qty: row.qty ?? 1 }))
}

export async function addFreezerItem(item, qty) {
  const { data, error } = await supabase
    .from('freezer')
    .insert({ item, qty: qty ?? 1 })
    .select()
    .single()
  if (error) { console.error('addFreezerItem', error); throw error }
  return { id: data.id, item: data.item, qty: data.qty }
}

export async function updateFreezerItem(id, fields) {
  const row = {}
  if ('item' in fields) row.item = fields.item
  if ('qty' in fields) row.qty = fields.qty
  const { error } = await supabase
    .from('freezer')
    .update(row)
    .eq('id', id)
  if (error) console.error('updateFreezerItem', error)
}

export async function removeFreezerItem(id) {
  const { error } = await supabase
    .from('freezer')
    .delete()
    .eq('id', id)
  if (error) console.error('removeFreezerItem', error)
}

// ── Staples ──────────────────────────────────────────────────────────────────

export async function fetchStaples() {
  const { data, error } = await supabase
    .from('staples')
    .select('*')
    .order('name')
  if (error) { console.error('fetchStaples', error); return [] }
  return data.map(row => ({ name: row.name, status: row.status || 'ok' }))
}

export async function addStaple(name) {
  const { error } = await supabase
    .from('staples')
    .insert({ name, status: 'ok' })
  if (error) console.error('addStaple', error)
}

export async function updateStaple(name, status) {
  const { error } = await supabase
    .from('staples')
    .update({ status })
    .eq('name', name)
  if (error) console.error('updateStaple', error)
}

export async function removeStaple(name) {
  const { error } = await supabase
    .from('staples')
    .delete()
    .eq('name', name)
  if (error) console.error('removeStaple', error)
}

// ── Weekly Regulars ──────────────────────────────────────────────────────────

export async function fetchRegulars() {
  const { data, error } = await supabase
    .from('regulars')
    .select('*')
    .order('name')
  if (error) { console.error('fetchRegulars', error); return [] }
  return data.map(row => ({ id: row.id, name: row.name }))
}

export async function addRegular(name) {
  const { data, error } = await supabase
    .from('regulars')
    .insert({ name })
    .select()
    .single()
  if (error) { console.error('addRegular', error); throw error }
  return { id: data.id, name: data.name }
}

export async function removeRegular(id) {
  const { error } = await supabase
    .from('regulars')
    .delete()
    .eq('id', id)
  if (error) console.error('removeRegular', error)
}

// ── Prefs ────────────────────────────────────────────────────────────────────

export async function fetchPrefs() {
  const { data, error } = await supabase
    .from('prefs')
    .select('*')
    .single()
  if (error) {
    console.error('fetchPrefs', error)
    return { fishMin: 1, vegMin: 2, readyBy: "18:30" }
  }
  return {
    fishMin: data.fish_min ?? 1,
    vegMin:  data.veg_min ?? 2,
    readyBy: data.ready_by || "18:30",
  }
}

export async function updatePrefs(goals) {
  const { error } = await supabase
    .from('prefs')
    .upsert({
      id: 1,
      fish_min: goals.fishMin,
      veg_min:  goals.vegMin,
      ready_by: goals.readyBy,
    })
  if (error) console.error('updatePrefs', error)
}

// ── Custom Tags ──────────────────────────────────────────────────────────────

export async function fetchCustomTags() {
  const { data, error } = await supabase
    .from('custom_tags')
    .select('name')
    .order('name')
  if (error) { console.error('fetchCustomTags', error); return [] }
  return data.map(row => row.name)
}

export async function addCustomTag(name) {
  const { error } = await supabase
    .from('custom_tags')
    .insert({ name })
  if (error) console.error('addCustomTag', error)
}

export async function removeCustomTag(name) {
  const { error } = await supabase
    .from('custom_tags')
    .delete()
    .eq('name', name)
  if (error) console.error('removeCustomTag', error)
}

// ── Custom Categories ────────────────────────────────────────────────────────

export async function fetchCustomCategories() {
  const { data, error } = await supabase
    .from('custom_categories')
    .select('name')
    .order('name')
  if (error) { console.error('fetchCustomCategories', error); return [] }
  return data.map(row => row.name)
}

export async function addCustomCategory(name) {
  const { error } = await supabase
    .from('custom_categories')
    .insert({ name })
  if (error) console.error('addCustomCategory', error)
}

export async function removeCustomCategory(name) {
  const { error } = await supabase
    .from('custom_categories')
    .delete()
    .eq('name', name)
  if (error) console.error('removeCustomCategory', error)
}

// ── Shop Checked (per-week ingredient check state) ───────────────────────────

export async function fetchShopChecked() {
  const { data, error } = await supabase
    .from('shop_checked')
    .select('key')
    .eq('week_start', THIS_WEEK)
  if (error) { console.error('fetchShopChecked', error); return {} }
  const map = {}
  data.forEach(row => { map[row.key] = true })
  return map
}

export async function toggleShopChecked(week, key, checked) {
  if (checked) {
    const { error } = await supabase
      .from('shop_checked')
      .upsert({ week_start: week, key }, { onConflict: 'week_start,key' })
    if (error) console.error('toggleShopChecked', error)
  } else {
    const { error } = await supabase
      .from('shop_checked')
      .delete()
      .eq('week_start', week)
      .eq('key', key)
    if (error) console.error('toggleShopChecked', error)
  }
}

// ── Reg Checked (per-week regular items check state) ─────────────────────────

export async function fetchRegChecked() {
  const { data, error } = await supabase
    .from('reg_checked')
    .select('regular_id')
    .eq('week_start', THIS_WEEK)
  if (error) { console.error('fetchRegChecked', error); return {} }
  const map = {}
  data.forEach(row => { map[row.regular_id] = true })
  return map
}

export async function toggleRegChecked(week, regularId, checked) {
  if (checked) {
    const { error } = await supabase
      .from('reg_checked')
      .upsert({ week_start: week, regular_id: regularId }, { onConflict: 'week_start,regular_id' })
    if (error) console.error('toggleRegChecked', error)
  } else {
    const { error } = await supabase
      .from('reg_checked')
      .delete()
      .eq('week_start', week)
      .eq('regular_id', regularId)
    if (error) console.error('toggleRegChecked', error)
  }
}

// ── Free-form Shopping Items ─────────────────────────────────────────────────

export async function fetchFreeShop() {
  const { data, error } = await supabase
    .from('free_shop')
    .select('*')
    .order('id')
  if (error) { console.error('fetchFreeShop', error); return [] }
  return data.map(row => ({ id: row.id, text: row.text, done: row.done }))
}

export async function addFreeShopItem(text) {
  const { data, error } = await supabase
    .from('free_shop')
    .insert({ text, done: false })
    .select()
    .single()
  if (error) { console.error('addFreeShopItem', error); throw error }
  return { id: data.id, text: data.text, done: data.done }
}

export async function updateFreeShopItem(id, fields) {
  const { error } = await supabase
    .from('free_shop')
    .update(fields)
    .eq('id', id)
  if (error) console.error('updateFreeShopItem', error)
}

export async function removeFreeShopItem(id) {
  const { error } = await supabase
    .from('free_shop')
    .delete()
    .eq('id', id)
  if (error) console.error('removeFreeShopItem', error)
}

// ── Prep Tasks (freeform weekend prep) ───────────────────────────────────────

export async function fetchPrepTasks() {
  const { data, error } = await supabase
    .from('prep_tasks')
    .select('*')
    .eq('week_start', THIS_WEEK)
    .order('id')
  if (error) { console.error('fetchPrepTasks', error); return [] }
  return data.map(row => ({ id: row.id, task: row.task, done: row.done }))
}

export async function addPrepTask(week, task) {
  const { data, error } = await supabase
    .from('prep_tasks')
    .insert({ week_start: week, task, done: false })
    .select()
    .single()
  if (error) { console.error('addPrepTask', error); throw error }
  return { id: data.id, task: data.task, done: data.done }
}

export async function updatePrepTask(id, fields) {
  const { error } = await supabase
    .from('prep_tasks')
    .update(fields)
    .eq('id', id)
  if (error) console.error('updatePrepTask', error)
}

export async function removePrepTask(id) {
  const { error } = await supabase
    .from('prep_tasks')
    .delete()
    .eq('id', id)
  if (error) console.error('removePrepTask', error)
}

// ── Prep Checked (recipe prep checkbox state) ────────────────────────────────

export async function fetchPrepChecked() {
  const { data, error } = await supabase
    .from('prep_checked')
    .select('key')
    .eq('week_start', THIS_WEEK)
  if (error) { console.error('fetchPrepChecked', error); return {} }
  const map = {}
  data.forEach(row => { map[row.key] = true })
  return map
}

export async function togglePrepChecked(week, key, checked) {
  if (checked) {
    const { error } = await supabase
      .from('prep_checked')
      .upsert({ week_start: week, key }, { onConflict: 'week_start,key' })
    if (error) console.error('togglePrepChecked', error)
  } else {
    const { error } = await supabase
      .from('prep_checked')
      .delete()
      .eq('week_start', week)
      .eq('key', key)
    if (error) console.error('togglePrepChecked', error)
  }
}

// ── Thumbnail fetch ──────────────────────────────────────────────────────────

export async function fetchThumbnail(url) {
  try {
    const base = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${base}/functions/v1/fetch-thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'apikey': key },
      body: JSON.stringify({ url }),
    })
    const { thumbnailUrl } = await res.json()
    return thumbnailUrl || null
  } catch (e) {
    console.error('fetchThumbnail', e)
    return null
  }
}
