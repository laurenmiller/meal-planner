# Supabase Integration — Instructions for Claude Code

## Context

This is a React meal planning PWA (Vite). All components live in `src/App.jsx`.
Styles are in `src/styles.css`. The Supabase schema and all db functions are
already written. Your job is to wire them into the React app.

## Files to reference

- `src/lib/supabase.js` — Supabase client (copy from meal-planner-supabase/supabase.js)
- `src/lib/db.js` — all read/write functions (copy from meal-planner-supabase/db.js)

## Step 0 — Setup

```bash
npm install @supabase/supabase-js
mkdir -p src/lib
cp ../meal-planner-supabase/supabase.js src/lib/supabase.js
cp ../meal-planner-supabase/db.js src/lib/db.js
```

## Step 1 — Replace App state with Supabase fetches

In `src/App.jsx`, replace the hardcoded `useState` initialisers with async loads.

Add a `useEffect` that runs once on mount and loads all data. Use a `loading`
state to show a spinner while data loads. Pattern:

```jsx
const [loading, setLoading] = useState(true)
const [recipes, setRecipes] = useState([])
const [week, setWeek] = useState([])
// ... etc

useEffect(() => {
  async function loadAll() {
    const [recipes, week, batch, radar, fridge, freezer, staples, regulars,
           prefs, customTags, customCategories, shopChecked, regChecked,
           freeShop, prepTasks, prepChecked] = await Promise.all([
      fetchRecipes(),
      fetchWeekPlan(),
      fetchBatchPrep(),
      fetchRadar(),
      fetchFridge(),
      fetchFreezer(),
      fetchStaples(),
      fetchRegulars(),
      fetchPrefs(),
      fetchCustomTags(),
      fetchCustomCategories(),
      fetchShopChecked(),
      fetchRegChecked(),
      fetchFreeShop(),
      fetchPrepTasks(),
      fetchPrepChecked(),
    ])
    setRecipes(recipes.map(toAppRecipe))
    setWeek(week)
    setBatch(batch)
    setRadar(radar)
    setFridge(fridge)
    setFreezer(freezer)
    setStaples(staples)
    setRegulars(regulars)
    setGoals(prefs)
    setCustomTags(customTags)
    setCustomCategories(customCategories)
    setShopChecked(shopChecked)
    setRegChecked(regChecked)
    setFreeShop(freeShop)
    setLoading(false)
  }
  loadAll()
}, [])
```

Add a loading screen before the main return:
```jsx
if (loading) return (
  <div style={{display:'flex',alignItems:'center',justifyContent:'center',
    height:'100vh',fontFamily:'Playfair Display,serif',fontSize:18,color:'var(--ink3)'}}>
    Loading…
  </div>
)
```

## Step 2 — Wire up writes

Every state setter that currently uses `setState` directly needs a matching
db write. The pattern is: optimistic update first, then db write in background.

### Recipes
```js
// ADD
const handleAddRecipe = async (recipe) => {
  const saved = await addRecipe(recipe)
  setRecipes(rs => [...rs, toAppRecipe(saved)])
}

// UPDATE  
const handleUpdateRecipe = async (recipe) => {
  await updateRecipe(recipe.id, recipe)
  setRecipes(rs => rs.map(r => r.id === recipe.id ? recipe : r))
}

// DELETE
const handleDeleteRecipe = async (id) => {
  await deleteRecipe(id)
  setRecipes(rs => rs.filter(r => r.id !== id))
}
```

### Week plan
```js
const handleSlot = async (dayIndex, recipe) => {
  await upsertWeekDay(THIS_WEEK, dayIndex, { recipeId: recipe.id })
  setWeek(w => w.map((d,i) => i === dayIndex ? {...d, recipe} : d))
}

const handleRemove = async (dayIndex) => {
  await upsertWeekDay(THIS_WEEK, dayIndex, { recipeId: null })
  setWeek(w => w.map((d,i) => i === dayIndex ? {...d, recipe: null} : d))
}

const handleSlotNote = async (dayIndex, note) => {
  await upsertWeekDay(THIS_WEEK, dayIndex, { note })
  setWeek(w => w.map((d,i) => i === dayIndex ? {...d, note} : d))
}

const handleWeekReset = async () => {
  await clearWeekPlan(THIS_WEEK)
  await clearBatchPrep(THIS_WEEK)
  setWeek(DAY_NAMES.map(day => ({ day, recipe: null, note: null })))
  setBatch([])
}
```

### Batch prep
```js
const handleAddBatch = async (recipe) => {
  await addBatchItem(THIS_WEEK, recipe.id)
  setBatch(b => [...b, recipe])
}

const handleRemoveBatch = async (recipeId) => {
  await removeBatchItem(THIS_WEEK, recipeId)
  setBatch(b => b.filter(r => r.id !== recipeId))
}
```

### Radar
```js
const handleAddRadar = async (item) => {
  const saved = await addRadarItem(item)
  setRadar(r => [saved, ...r])
}

const handleRemoveRadar = async (id) => {
  await removeRadarItem(id)
  setRadar(r => r.filter(x => x.id !== id))
}
```

### Prefs
```js
const updateGoal = async (key, delta) => {
  setGoals(g => {
    const next = computeNextGoal(g, key, delta) // same logic as before
    updatePrefs(next) // fire and forget
    return next
  })
}
```

### Shopping checked state
```js
const handleShopChecked = async (key, checked) => {
  await toggleShopChecked(THIS_WEEK, key, checked)
  setShopChecked(c => checked ? {...c, [key]: true} : Object.fromEntries(Object.entries(c).filter(([k]) => k !== key)))
}
```

### Fridge / Freezer / Staples / Regulars
Follow the same pattern — call the db function, then update local state.
All the functions are in `src/lib/db.js`.

### Custom tags/categories
```js
const handleAddCustomTag = async (name) => {
  await addCustomTag(name)
  setCustomTags(t => [...t, name])
}
const handleRemoveCustomTag = async (name) => {
  await removeCustomTag(name)
  setCustomTags(t => t.filter(x => x !== name))
}
// same pattern for categories
```

## Step 3 — Realtime subscriptions

Add this inside the `useEffect` after the initial load:

```js
// Realtime — sync week plan and batch across devices
const weekSub = supabase
  .channel('week_plan')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'week_plan' }, () => {
    fetchWeekPlan().then(setWeek)
  })
  .subscribe()

const batchSub = supabase
  .channel('batch_prep')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'batch_prep' }, () => {
    fetchBatchPrep().then(setBatch)
  })
  .subscribe()

const shopSub = supabase
  .channel('shop_checked')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_checked' }, () => {
    fetchShopChecked().then(setShopChecked)
  })
  .subscribe()

// Return cleanup
return () => {
  supabase.removeChannel(weekSub)
  supabase.removeChannel(batchSub)
  supabase.removeChannel(shopSub)
}
```

## Step 4 — Pass db handlers down

The app currently passes `setRecipes`, `setWeek` etc. directly to child
components. Replace these with the handler functions above:
- `setRecipes` → `handleAddRecipe` / `handleUpdateRecipe` / `handleDeleteRecipe`
- `setWeek` (in slot context) → `handleSlot` / `handleRemove` / `handleSlotNote`
- etc.

## Notes

- The `batch` state was previously called `batchPrep` in some places — normalise to `batch`
- `THIS_WEEK` from `db.js` is the current Monday's date string — use it everywhere
  instead of computing week dates locally
- `toAppRecipe()` converts DB column names (snake_case) to app shape (camelCase)
  — always call it when receiving recipe data from Supabase
- Keep optimistic updates (update state first, write to db second) for snappy UX
- Wrap db calls in try/catch and console.error for now — proper error UI can come later
