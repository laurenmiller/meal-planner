# Meal Planner — Mac Setup Guide

## Prerequisites (one-time)

### 1. Install Homebrew (if not already installed)
Open Terminal and run:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Node.js
```bash
brew install node
```
Verify: `node --version` should show v18 or higher.

### 3. Install Git (if not already)
```bash
brew install git
```

---

## Project Setup

### 1. Copy the project files
Move the `meal-planner/` folder to wherever you keep projects, e.g.:
```bash
mv meal-planner ~/projects/meal-planner
cd ~/projects/meal-planner
```

### 2. Install dependencies
```bash
npm install
```
This creates a `node_modules/` folder — takes ~30 seconds.

### 3. Start the dev server
```bash
npm run dev
```
Open your browser to **http://localhost:5173**

You should see the meal planner running. Changes to any `.jsx` or `.css` file will hot-reload instantly.

---

## Project Structure

```
meal-planner/
  src/
    components/
      App.jsx              ← Root component, all state lives here
      WeekView.jsx         ← Week tab
      RecipesView.jsx      ← Recipes tab
      InventoryView.jsx    ← Pantry tab
      PrefsView.jsx        ← Prefs tab
      PlanSheet.jsx        ← Plan a dinner sheet
      RecipeDetailSheet.jsx
      RecipeFormFields.jsx
      AddRecipeSheet.jsx
      ShoppingSheet.jsx
      BatchSheet.jsx
      WeekShoppingList.jsx
      WeekView.jsx
      DayCard.jsx
      DayStub.jsx
      DayNote.jsx
      RadarDetailSheet.jsx
      Tags.jsx
    data.js                ← Sample data + helper functions
    styles.css             ← All styles + CSS variables (theme lives here)
    main.jsx               ← React entry point
  index.html
  package.json
  vite.config.js
```

---

## Changing the Theme

All colours live in `src/styles.css` at the top in `:root { ... }`.
Font imports are the `@import` line at the very top of the file.

```css
:root {
  --bg: #faf7f2;       /* page background */
  --accent: #b85c38;   /* terracotta — change this for a whole new feel */
  /* ... */
}
```

---

## GitHub Setup (optional but recommended)

### Create a repo
1. Go to github.com → New repository → name it `meal-planner`
2. Don't initialise with README

### Push your code
```bash
cd ~/projects/meal-planner
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/meal-planner.git
git push -u origin main
```

---

## Next Steps

### Phase 2 — Supabase (data persistence + sync)
1. Create a free account at supabase.com
2. Create a new project
3. Run the schema SQL (provided separately)
4. Add your Supabase URL + anon key to a `.env` file:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Install the client: `npm install @supabase/supabase-js`
6. Replace `useState` initialisers with Supabase reads

### Phase 3 — iPad layout
- CSS breakpoint at 768px for two-column layout
- Sidebar for shopping list / recipe detail

### Phase 4 — PWA (install on iPad home screen)
```bash
npm install vite-plugin-pwa
```
Add to `vite.config.js`, creates a manifest + service worker automatically.

### Deploy to Vercel (easiest)
```bash
npm install -g vercel
vercel
```
Follow the prompts — it detects Vite automatically. Free tier is fine.

---

## Troubleshooting

**`npm install` fails** → Make sure Node is v18+: `node --version`

**Port 5173 already in use** → `npm run dev -- --port 3000`

**Styles not loading** → Check `src/styles.css` exists and is imported in `main.jsx`

**Component not found error** → Check the import path in the component file matches the filename exactly (case-sensitive)
