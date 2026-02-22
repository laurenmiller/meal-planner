import { useState, useEffect, useRef } from 'react';
import './styles.css';
import { supabase } from './lib/supabase.js';
import {
  fetchRecipes, addRecipe as dbAddRecipe, updateRecipe as dbUpdateRecipe, deleteRecipe as dbDeleteRecipe, toAppRecipe,
  fetchWeekPlanItems, addWeekPlanItem, removeWeekPlanItem, moveWeekPlanItem, clearWeekPlanItems, clearDayItems, migrateWeekPlanToItems,
  fetchBatchPrep, addBatchItem, removeBatchItem, clearBatchPrep,
  addRadarItem as dbAddRadarItem, promoteToLibrary as dbPromoteToLibrary,
  fetchFridge, addFridgeItem as dbAddFridgeItem, updateFridgeItem as dbUpdateFridgeItem, removeFridgeItem as dbRemoveFridgeItem,
  fetchFreezer, addFreezerItem as dbAddFreezerItem, updateFreezerItem as dbUpdateFreezerItem, removeFreezerItem as dbRemoveFreezerItem,
  fetchStaples, addStaple as dbAddStaple, updateStaple as dbUpdateStaple, removeStaple as dbRemoveStaple,
  fetchRegulars, addRegular as dbAddRegular, removeRegular as dbRemoveRegular,
  fetchPrefs, updatePrefs as dbUpdatePrefs,
  fetchCustomTags, addCustomTag as dbAddCustomTag, removeCustomTag as dbRemoveCustomTag,
  fetchCustomCategories, addCustomCategory as dbAddCustomCategory, removeCustomCategory as dbRemoveCustomCategory,
  fetchShopFilters, addShopFilter as dbAddShopFilter, removeShopFilter as dbRemoveShopFilter,
  fetchShopChecked, toggleShopChecked as dbToggleShopChecked,
  fetchRegChecked, toggleRegChecked as dbToggleRegChecked,
  fetchFreeShop, addFreeShopItem as dbAddFreeShopItem, updateFreeShopItem as dbUpdateFreeShopItem,
  fetchPrepTasks, addPrepTask as dbAddPrepTask, updatePrepTask as dbUpdatePrepTask,
  fetchPrepChecked, togglePrepChecked as dbTogglePrepChecked,
  fetchRecipeData, uploadRecipeFile, removeRecipeFile,
  THIS_WEEK,
} from './lib/db.js';
import { normalizeIngredient, findDuplicates } from './lib/ingredients.js';

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Data ─────────────────────────────────────────────────────────────────────

const RECIPES_INIT = [
  { id:1, title:"Miso-Glazed Salmon",         source:"NYT Cooking",     tags:["fish"],       time:30, category:"dinner",    prepNote:"Make miso glaze ahead",                   url:"https://cooking.nytimes.com/recipes/1017823-miso-glazed-salmon", ingredients:["salmon fillet","white miso","mirin","rice vinegar"] },
  { id:2, title:"Pasta e Fagioli",             source:"Smitten Kitchen", tags:["vegetarian"], time:45, category:"dinner",    prepNote:"Cook white beans",                        url:"https://smittenkitchen.com/2013/01/pasta-e-fagioli/",            ingredients:["cannellini beans","ditalini pasta","fresh rosemary","parmesan rind"] },
  { id:3, title:"Sheet Pan Chicken Thighs",   source:"Serious Eats",    tags:[],               time:50, category:"dinner",    prepNote:"Marinate chicken — lemon, garlic, thyme", url:"https://www.seriouseats.com/sheet-pan-chicken-thighs",           ingredients:["bone-in chicken thighs","lemon","fresh thyme"] },
  { id:4, title:"Black Bean Tacos",            source:"Budget Bytes",    tags:["vegetarian"], time:20, category:"dinner",    url:"https://www.budgetbytes.com/black-bean-tacos/", ingredients:["canned black beans","corn tortillas","cotija cheese","avocado","lime","fresh cilantro"] },
  { id:5, title:"Pork Tenderloin with Apples", source:"Bon Appétit",     tags:[],               time:40, category:"dinner",    prepNote:"Brine pork tenderloin overnight",          ingredients:["pork tenderloin","honeycrisp apples","hard cider","fresh sage"] },
  { id:6, title:"Lentil Soup",                source:"The Food Lab",    tags:["vegetarian"], time:55, category:"dinner",    ingredients:["french lentils","canned tomatoes","carrot","celery","cumin","smoked paprika"] },
  { id:7, title:"Banana Oat Pancakes",         source:"Added manually",  tags:[],               time:20, category:"breakfast", ingredients:["ripe bananas","rolled oats","eggs","baking powder"] },
  { id:8, title:"Chocolate Chip Cookies",      source:"NYT Cooking",     tags:[],               time:35, category:"sweets",    ingredients:["butter","brown sugar","eggs","vanilla","flour","chocolate chips"] },
];

const WEEK_INIT = DAY_NAMES.map(day => ({ day, items: [] }));

const RADAR_INIT = [
  { id: "r1", title: "Miso Glazed Black Cod", url: "https://nomnompaleo.com/miso-glazed-black-cod", source: "Nom Nom Paleo" },
  { id: "r2", title: "Shakshuka with Feta",   url: "https://cooking.nytimes.com/recipes/1014721-shakshuka-with-feta", source: "NYT Cooking" },
  { id: "r3", title: "Butternut Squash Risotto", url: null, source: "Bon Appétit" },
];

const BATCH_INIT = [
  { id:1, recipeId:7 },
  { id:2, recipeId:8 },
];


const INV_INIT = {
  fridge:  [{ item:"Broccoli", s:"soon" }, { item:"Baby spinach", s:"soon" }, { item:"Carrots", s:"ok" }, { item:"Leftover rotisserie chicken", s:"soon" }],
  freezer: [{ item:"Ground beef", qty:1 }, { item:"Chicken breasts", qty:2 }, { item:"Shrimp", qty:1 }],
};

const STAPLES_INIT = [
  "garlic","olive oil","butter","onion","salt","black pepper",
  "flour","sugar","baking powder","soy sauce","vegetable broth","chicken broth",
  "canned diced tomatoes","red pepper flakes","dried oregano","bay leaves",
  "rice","pasta","heavy cream","parmesan",
].map(name => ({ name, status: "ok" })); // status: "ok" | "restock"

const WEEKLY_REGULARS_INIT = [
  "eggs", "milk", "sandwich bread", "yogurt", "cheddar cheese", "lemons",
].map(name => ({ id: "reg:" + name, name }));


const DEFAULT_STUB_LABEL = "leftovers or takeout";

// Convert "H:MM" string to total minutes
const toMins = t => { const [h,m] = t.split(":").map(Number); return h*60+m; };
// Convert total minutes back to "H:MM" string
const toTime = m => { const h = Math.floor(((m % 1440) + 1440) % 1440 / 60); const min = ((m % 1440) + 1440) % 1440 % 60; return `${h}:${String(min).padStart(2,"0")}`; };
// Calculate start time given readyBy time and cook duration in minutes
const calcStart = (readyBy, cookTime) => toTime(toMins(readyBy) - cookTime);
// Format "18:30" as "6:30 pm"
const formatReadyBy = t => { const [h,m] = t.split(":").map(Number); const ampm = h >= 12 ? "pm" : "am"; const h12 = h > 12 ? h-12 : h; return `${h12}:${String(m).padStart(2,"0")} ${ampm}`; };

// ── Tag helpers ───────────────────────────────────────────────────────────────

function Tags({ tags }) {
  return (<>
    {tags.includes("fish")       && <span className="tag tag-fish">Fish</span>}
    {tags.includes("vegetarian") && <span className="tag tag-veg">Veg</span>}
  </>);
}

// ── Recipe Detail Sheet ───────────────────────────────────────────────────────

function RecipeDetailView({ recipe, onClose, onSave, onDelete, onRemoveFromPlan, source = "library", itemId, customTags = [], customCategories = [] }) {
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveRecipe, setLiveRecipe] = useState(recipe);

  // Edit state — initialised from recipe when editing starts
  const [eTitle,  setETitle]  = useState(recipe.title);
  const [eSource, setESource] = useState(recipe.source);
  const [eUrl,    setEUrl]    = useState(recipe.url    || "");
  const [eTime,   setETime]   = useState(String(recipe.time));
  const [ePrepNote, setEPrepNote] = useState(recipe.prepNote || "");
  const [eTags,   setETags]   = useState(recipe.tags || []);
  const [eCategory, setECategory] = useState(recipe.category || "");
  const [ePdfUrl, setEPdfUrl]   = useState(recipe.pdfUrl || "");
  const [eIngr,   setEIngr]   = useState(recipe.ingredients || []);
  const [eIngrInput, setEIngrInput] = useState("");
  const [eThumbnailUrl, setEThumbnailUrl] = useState(recipe.thumbnailUrl || null);
  const [eDescription, setEDescription] = useState(recipe.description || null);
  const [eServings, setEServings] = useState(recipe.servings || null);
  const [eUploading, setEUploading] = useState(false);

  const toggleETag = t => setETags(tt => tt.includes(t) ? tt.filter(x => x !== t) : [...tt, t]);
  const addEIngr = val => {
    const trimmed = val.trim().toLowerCase();
    if (trimmed && !eIngr.includes(trimmed)) setEIngr(ii => [...ii, trimmed]);
    setEIngrInput("");
  };
  const removeEIngr = i => setEIngr(ii => ii.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!eTitle.trim()) return;
    const updated = {
      ...liveRecipe,
      title:      eTitle.trim(),
      source:     eSource.trim() || "Added manually",
      url:        eUrl.trim()    || null,
      time:       parseInt(eTime) || 30,
      prepNote:   ePrepNote.trim() || undefined,
      category:   eCategory || undefined,
      pdfUrl:     ePdfUrl.trim() || undefined,
      tags:       eTags,
      ingredients: eIngr,
      thumbnailUrl: eThumbnailUrl,
      description: eDescription || null,
      instructions: liveRecipe.instructions || [],
      servings: eServings || null,
      rawIngredients: liveRecipe.rawIngredients || [],
    };
    onSave(updated);
    setLiveRecipe(updated);
    setEditing(false);
  };

  const handleRefresh = async () => {
    if (!liveRecipe.url || refreshing) return;
    setRefreshing(true);
    try {
      const { thumbnailUrl, scrapedData } = await fetchRecipeData(liveRecipe.url);
      const updated = { ...liveRecipe };
      if (thumbnailUrl) updated.thumbnailUrl = thumbnailUrl;
      if (scrapedData) {
        if (scrapedData.title) updated.title = scrapedData.title;
        if (scrapedData.cookTime) updated.time = scrapedData.cookTime;
        if (scrapedData.ingredients?.length) {
          updated.ingredients = scrapedData.ingredients;
          updated.rawIngredients = scrapedData.ingredients;
        }
        if (scrapedData.instructions?.length) updated.instructions = scrapedData.instructions;
        if (scrapedData.description) updated.description = scrapedData.description;
        if (scrapedData.servings) updated.servings = scrapedData.servings;
      }
      onSave(updated);
      setLiveRecipe(updated);
    } catch (e) { console.error('refresh failed', e); }
    setRefreshing(false);
  };

  const startEdit = () => {
    setETitle(liveRecipe.title);
    setESource(liveRecipe.source);
    setEUrl(liveRecipe.url || "");
    setECategory(liveRecipe.category || "");
    setEPdfUrl(liveRecipe.pdfUrl || "");
    setETime(String(liveRecipe.time));
    setEPrepNote(liveRecipe.prepNote || "");
    setETags([...liveRecipe.tags]);
    setEIngr([...(liveRecipe.ingredients || [])]);
    setEIngrInput("");
    setEThumbnailUrl(liveRecipe.thumbnailUrl || null);
    setEDescription(liveRecipe.description || null);
    setEServings(liveRecipe.servings || null);
    setEditing(true);
  };

  const r = liveRecipe;

  return (
    <div className="recipe-detail-view">
      {/* ── Read view ── */}
      {!editing && (<>
        <div className="detail-topbar">
          <button className="detail-back-btn" onClick={onClose}>← Back</button>
        </div>

        <div className="detail-scroll">
          {r.thumbnailUrl && (
            <img className="detail-hero-img" src={r.thumbnailUrl} alt=""/>
          )}

          <div className="detail-hero">
            <div className="detail-title">{r.title}</div>
            <div className="detail-source">{r.source}</div>
            <div className="detail-meta-row">
              <div className="detail-meta-chip">⏱ {r.time} min</div>
              {r.tags.includes("fish")       && <div className="detail-meta-chip" style={{color:"#2a6a8a",background:"#eaf4fb",borderColor:"#a8cfe0"}}>🐟 Fish</div>}
              {r.tags.includes("vegetarian") && <div className="detail-meta-chip" style={{color:"#4a7a46",background:"#f0f8ee",borderColor:"#b8d4b6"}}>🌿 Veg</div>}
              {r.servings && <div className="detail-meta-chip">🍽 {r.servings} servings</div>}
            </div>
          </div>

          <div className="detail-body">
            {r.prepNote && (
              <div>
                <div className="detail-section-label">Prep note</div>
                <div className="detail-prep-note">📋 {r.prepNote}</div>
              </div>
            )}

            {r.url && (
              <div>
                <div className="detail-section-label">Recipe source</div>
                <a className="detail-link" href={r.url} target="_blank" rel="noopener noreferrer">
                  <span className="detail-link-icon">🔗</span>
                  <div className="detail-link-text">
                    <div className="detail-link-label">{r.source}</div>
                    <div className="detail-link-url">{r.url}</div>
                  </div>
                  <span className="detail-link-arrow">›</span>
                </a>
              </div>
            )}

            {r.ingredients && r.ingredients.length > 0 && (
              <div>
                <div className="detail-section-label">Key ingredients</div>
                <div style={{display:"flex", flexWrap:"wrap", gap:6}}>
                  {r.ingredients.map((ing, i) => (
                    <span key={i} className="detail-ingredient-chip">{ing}</span>
                  ))}
                </div>
              </div>
            )}

            {r.rawIngredients?.length > 0 && (
              <div>
                <div className="detail-section-label">Ingredients</div>
                <ul className="detail-ingredients">
                  {r.rawIngredients.map((ing, i) => <li key={i}>{ing}</li>)}
                </ul>
              </div>
            )}

            {r.instructions?.length > 0 && (
              <div>
                <div className="detail-section-label">Instructions</div>
                <ol className="detail-instructions">
                  {r.instructions.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
            )}

            {r.pdfUrl && (
              <div>
                <div className="detail-section-label">Attachment</div>
                {/\.(jpe?g|png|gif|webp)(\?|$)/i.test(r.pdfUrl) ? (
                  <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <img src={r.pdfUrl} alt="Recipe" className="detail-attachment-img"/>
                  </a>
                ) : (
                  <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className="detail-link">
                    <span className="detail-link-icon">📄</span>
                    <div className="detail-link-text">
                      <div className="detail-link-label">View PDF</div>
                      <div className="detail-link-url">{r.pdfUrl}</div>
                    </div>
                    <span className="detail-link-arrow">›</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="detail-footer">
          {source === "plan" && <button className="sheet-btn sheet-btn-cancel" onClick={onClose}>← Back to week</button>}
          <button className="sheet-btn sheet-btn-primary" style={{flex:1}} onClick={startEdit}>Edit</button>
          {r.url && <button className="sheet-btn sheet-btn-cancel" disabled={refreshing} onClick={handleRefresh}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button>}
          {source === "plan"
            ? <button className="detail-delete-btn" onClick={() => onRemoveFromPlan()}>Remove from plan</button>
            : <button className="detail-delete-btn" onClick={() => { onDelete(r.id); onClose(); }}>Delete</button>
          }
        </div>
      </>)}

      {/* ── Edit view ── */}
      {editing && (<>
        <div className="detail-topbar">
          <button className="detail-back-btn" onClick={() => setEditing(false)}>← Cancel</button>
          <div style={{fontFamily:"'Playfair Display',serif", fontSize:16, color:"var(--ink)"}}>Edit <em>{r.title.split(" ").slice(0,3).join(" ")}</em></div>
        </div>

        <div className="detail-scroll">
          <div className="detail-body">
            <div style={{paddingBottom:8}}>
              <div className="form-field">
                <label className="form-label">Recipe name</label>
                <input className="form-input" value={eTitle} onChange={e => setETitle(e.target.value)} autoFocus/>
              </div>
              <div className="form-field">
                <label className="form-label">Source name</label>
                <input className="form-input" value={eSource} onChange={e => setESource(e.target.value)}/>
              </div>
              <div className="form-field">
                <label className="form-label">URL <span style={{fontWeight:400,color:"var(--ink4)"}}>optional</span></label>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <input className="form-input" style={{flex:1}} placeholder="https://…" value={eUrl} onChange={e => setEUrl(e.target.value)}
                    onBlur={async () => { if (eUrl.trim()) { const { thumbnailUrl: t, scrapedData } = await fetchRecipeData(eUrl.trim()); if (t) setEThumbnailUrl(t); if (scrapedData?.servings) setEServings(scrapedData.servings); }}}/>
                  {eThumbnailUrl && <img src={eThumbnailUrl} alt="" style={{width:40, height:40, borderRadius:6, objectFit:"cover", flexShrink:0}}/>}
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Category</label>
                <div className="cat-select">
                  {[["dinner","Dinner"],["breakfast","Breakfast & Snacks"],["sweets","Sweets"],...(customCategories||[]).map(c=>[c,c])].map(([k,l]) => (
                    <button key={k} type="button"
                      className={"cat-btn" + (eCategory === k ? " active" : "")}
                      onClick={() => setECategory(k)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Cook time (min)</label>
                  <input className="form-input" type="number" value={eTime} onChange={e => setETime(e.target.value)}/>
                </div>
                <div className="form-field">
                  <label className="form-label">Servings</label>
                  <input className="form-input" placeholder="e.g. 4" value={eServings || ""} onChange={e => setEServings(e.target.value)}/>
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Prep note <span style={{fontWeight:400,color:"var(--ink4)"}}>optional</span></label>
                <input className="form-input" placeholder="e.g. Marinate overnight" value={ePrepNote} onChange={e => setEPrepNote(e.target.value)}/>
              </div>
              <div className="form-field">
                <label className="form-label">Tags</label>
                <div className="tag-toggle-row">
                  {["fish","vegetarian",...(customTags||[])].map(t => (
                    <button key={t} className={"tag-toggle" + (eTags.includes(t) ? " on" : "")} onClick={() => toggleETag(t)}>
                      {t === "fish" ? "🐟 Fish" : t === "vegetarian" ? "🌿 Veg" : t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Key ingredients <span style={{fontWeight:400,color:"var(--ink4)"}}>things to buy</span></label>
                <div className="ingredient-tags" onClick={e => e.currentTarget.querySelector("input")?.focus()}>
                  {eIngr.map((ing, i) => (
                    <span key={i} className="ingredient-tag">
                      <span style={{cursor:"pointer"}} onClick={e => { e.stopPropagation(); setEIngrInput(ing); removeEIngr(i); }}>{ing}</span>
                      <button className="ingredient-tag-remove" onClick={e => { e.stopPropagation(); removeEIngr(i); }}>×</button>
                    </span>
                  ))}
                  <input
                    className="ingredient-tag-input"
                    placeholder={eIngr.length === 0 ? "e.g. salmon fillet…" : "add more…"}
                    value={eIngrInput}
                    onChange={e => setEIngrInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === "Enter" || e.key === ",") && eIngrInput.trim()) {
                        e.preventDefault(); addEIngr(eIngrInput);
                      } else if (e.key === "Backspace" && !eIngrInput && eIngr.length > 0) {
                        setEIngr(ii => ii.slice(0, -1));
                      }
                    }}
                    onBlur={() => { if (eIngrInput.trim()) addEIngr(eIngrInput); }}
                  />
                </div>
                <div className="ingredient-tag-hint">Enter or comma to add · skip pantry staples</div>
              </div>
              <div className="form-field">
                <label className="form-label">Attachment <span style={{fontWeight:400,color:"var(--ink4)"}}>PDF or image</span></label>
                {ePdfUrl && (
                  <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
                    {/\.(jpe?g|png|gif|webp)(\?|$)/i.test(ePdfUrl)
                      ? <img src={ePdfUrl} alt="" style={{width:48, height:48, borderRadius:6, objectFit:"cover"}}/>
                      : <span style={{fontSize:13, color:"var(--ink3)"}}>📄 PDF attached</span>}
                    <button type="button" style={{fontSize:11, color:"var(--ink4)", background:"none", border:"1px solid var(--border)", borderRadius:6, padding:"3px 8px", cursor:"pointer"}}
                      onClick={async () => { await removeRecipeFile(recipe.id, ePdfUrl); setEPdfUrl(""); }}>Remove</button>
                  </div>
                )}
                <label className="detail-upload-btn">
                  {eUploading ? "Uploading…" : (ePdfUrl ? "Replace file" : "Upload file")}
                  <input type="file" accept="image/*,.pdf" style={{display:"none"}}
                    disabled={eUploading}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEUploading(true);
                      try {
                        const url = await uploadRecipeFile(recipe.id, file);
                        setEPdfUrl(url);
                      } catch (err) { console.error(err); }
                      setEUploading(false);
                      e.target.value = "";
                    }}/>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="detail-footer">
          <button className="sheet-btn sheet-btn-primary" style={{flex:1}} disabled={!eTitle.trim()} onClick={handleSave}>Save changes</button>
          <button className="sheet-btn sheet-btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </>)}
    </div>
  );
}

// ── Shared recipe add/edit form fields ───────────────────────────────────────
// Used by PlanSheet (add new + plan a night) and AddRecipeSheet (library only).

function RecipeFormFields({ title, setTitle, source, setSource, url, setUrl,
  time, setTime, tags, setTags, ingredients, setIngredients, ingrInput, setIngrInput,
  category, setCategory, customTags = [], customCategories = [],
  thumbnailUrl, setThumbnailUrl,
  description, setDescription, servings, setServings,
  instructions, setInstructions,
  rawIngredients, setRawIngredients,
  pdfUrl, setPdfUrl, recipeId,
  setFetchLoading: setFetchLoadingProp }) {

  const [fetchLoading, setFetchLoadingLocal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const setFetchLoading = v => { setFetchLoadingLocal(v); if (setFetchLoadingProp) setFetchLoadingProp(v); };
  const [scraped, setScraped] = useState(false);
  const debounceRef = useRef(null);
  const lastFetchedUrl = useRef("");
  const doScrape = async (urlVal) => {
    const trimmed = urlVal.trim();
    if (!trimmed || trimmed === lastFetchedUrl.current) return;
    lastFetchedUrl.current = trimmed;
    setFetchLoading(true);
    setScraped(false);
    const { thumbnailUrl: thumb, scrapedData } = await fetchRecipeData(trimmed);
    if (thumb && setThumbnailUrl) setThumbnailUrl(thumb);
    if (scrapedData) {
      if (!title.trim() && scrapedData.title) setTitle(scrapedData.title);
      if ((!time || time === "" || time === "30") && scrapedData.cookTime) setTime(String(scrapedData.cookTime));
      if (setRawIngredients && scrapedData.ingredients) setRawIngredients(scrapedData.ingredients);
      if ((!ingredients || ingredients.length === 0) && scrapedData.ingredients) setIngredients(scrapedData.ingredients);
      if (setDescription && scrapedData.description) setDescription(scrapedData.description);
      if (setServings && scrapedData.servings) setServings(scrapedData.servings);
      if (setInstructions && scrapedData.instructions) setInstructions(scrapedData.instructions);
      setScraped(true);
    }
    try { if (setSource && !source.trim()) setSource(new URL(trimmed).hostname.replace(/^www\./, '')); } catch {}
    setFetchLoading(false);
  };
  const handleUrlBlur = () => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    doScrape(url);
  };
  const handleUrlChange = (val) => {
    setUrl(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doScrape(val), 800);
  };
  const toggleTag = t => setTags(tt => tt.includes(t) ? tt.filter(x => x !== t) : [...tt, t]);
  const addIngr = val => {
    const trimmed = val.trim().toLowerCase();
    if (trimmed && !ingredients.includes(trimmed)) setIngredients(ii => [...ii, trimmed]);
    setIngrInput("");
  };
  const removeIngr = i => setIngredients(ii => ii.filter((_, idx) => idx !== i));
  const editIngr = i => { setIngrInput(ingredients[i]); removeIngr(i); };

  return (
    <div style={{paddingBottom:8}}>
      <div className="form-field">
        <label className="form-label">Recipe name</label>
        <input className="form-input" placeholder="e.g. Roast chicken with lemon" value={title}
          onChange={e => setTitle(e.target.value)} autoFocus/>
      </div>
      <div className="form-field">
        <label className="form-label">Source name</label>
        <input className="form-input" placeholder="e.g. NYT Cooking, Smitten Kitchen" value={source}
          onChange={e => setSource(e.target.value)}/>
      </div>
      <div className="form-field">
        <label className="form-label">URL <span style={{fontWeight:400,color:"var(--ink4)"}}>optional</span></label>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <input className="form-input" style={{flex:1}} placeholder="https://…" value={url}
            onChange={e => handleUrlChange(e.target.value)} onBlur={handleUrlBlur}/>
          {fetchLoading && <span style={{fontSize:11, color:"var(--ink4)", flexShrink:0}}>fetching…</span>}
          {!fetchLoading && thumbnailUrl && <img src={thumbnailUrl} alt="" style={{width:40, height:40, borderRadius:6, objectFit:"cover", flexShrink:0}}/>}
        </div>
        {scraped && <div style={{fontSize:10, color:"var(--sage)", marginTop:3, fontStyle:"italic"}}>Filled from recipe page</div>}
      </div>
      <div className="form-field">
        <label className="form-label">Category</label>
        <div className="cat-select">
          {[["dinner","Dinner"],["breakfast","Breakfast & Snacks"],["sweets","Sweets"],...(customCategories||[]).map(c=>[c,c])].map(([k,l]) => (
            <button key={k} type="button"
              className={"cat-btn" + (category === k ? " active" : "")}
              onClick={() => setCategory && setCategory(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Cook time (min)</label>
          <input className="form-input" type="number" placeholder="30" value={time}
            onChange={e => setTime(e.target.value)}/>
        </div>
        {setServings && (
          <div className="form-field">
            <label className="form-label">Servings</label>
            <input className="form-input" placeholder="e.g. 4" value={servings || ""}
              onChange={e => setServings(e.target.value)}/>
          </div>
        )}
      </div>
      <div className="form-field">
        <label className="form-label">Tags</label>
        <div className="tag-toggle-row">
          {["fish","vegetarian",...(customTags||[])].map(t => (
            <button key={t} className={"tag-toggle" + (tags.includes(t) ? " on" : "")} onClick={() => toggleTag(t)}>
              {t === "fish" ? "🐟 Fish" : t === "vegetarian" ? "🌿 Veg" : t}
            </button>
          ))}
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Key ingredients <span style={{fontWeight:400,color:"var(--ink4)"}}>things to buy, not staples</span></label>
        <div className="ingredient-tags" onClick={e => e.currentTarget.querySelector("input")?.focus()}>
          {ingredients.map((ing, i) => (
            <span key={i} className="ingredient-tag">
              <span style={{cursor:"pointer"}} onClick={e => { e.stopPropagation(); editIngr(i); }}>{ing}</span>
              <button className="ingredient-tag-remove" onClick={e => { e.stopPropagation(); removeIngr(i); }}>×</button>
            </span>
          ))}
          <input
            className="ingredient-tag-input"
            placeholder={ingredients.length === 0 ? "e.g. salmon fillet…" : "add more…"}
            value={ingrInput}
            onChange={e => setIngrInput(e.target.value)}
            onKeyDown={e => {
              if ((e.key === "Enter" || e.key === ",") && ingrInput.trim()) {
                e.preventDefault(); addIngr(ingrInput);
              } else if (e.key === "Backspace" && !ingrInput && ingredients.length > 0) {
                setIngredients(ii => ii.slice(0, -1));
              }
            }}
            onBlur={() => { if (ingrInput.trim()) addIngr(ingrInput); }}
          />
        </div>
        <div className="ingredient-tag-hint">Enter or comma to add · skip staples like garlic, olive oil</div>
      </div>
      {setPdfUrl && recipeId && (
        <div className="form-field">
          <label className="form-label">Attachment <span style={{fontWeight:400,color:"var(--ink4)"}}>PDF or image</span></label>
          {pdfUrl && (
            <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
              {/\.(jpe?g|png|gif|webp)(\?|$)/i.test(pdfUrl)
                ? <img src={pdfUrl} alt="" style={{width:48, height:48, borderRadius:6, objectFit:"cover"}}/>
                : <span style={{fontSize:13, color:"var(--ink3)"}}>📄 PDF attached</span>}
              <button type="button" style={{fontSize:11, color:"var(--ink4)", background:"none", border:"1px solid var(--border)", borderRadius:6, padding:"3px 8px", cursor:"pointer"}}
                onClick={async () => { await removeRecipeFile(recipeId, pdfUrl); setPdfUrl(""); }}>Remove</button>
            </div>
          )}
          <label className="detail-upload-btn">
            {uploading ? "Uploading…" : (pdfUrl ? "Replace file" : "Upload file")}
            <input type="file" accept="image/*,.pdf" style={{display:"none"}}
              disabled={uploading}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try { setPdfUrl(await uploadRecipeFile(recipeId, file)); } catch (err) { console.error(err); }
                setUploading(false);
                e.target.value = "";
              }}/>
          </label>
        </div>
      )}
    </div>
  );
}

// ── Add Recipe Sheet (library only — no planning) ─────────────────────────────

function AddRecipeSheet({ onClose, onAdd, prefill = {}, customTags = [], customCategories = [] }) {
  const [title,      setTitle]      = useState(prefill.title  || "");
  const [source,     setSource]     = useState(prefill.source || "");
  const [url,        setUrl]        = useState(prefill.url    || "");
  const [time,       setTime]       = useState(prefill.time ? String(prefill.time) : "");
  const [category,   setCategory]   = useState(prefill.category || "dinner");
  const [tags,       setTags]       = useState(prefill.tags   || []);
  const [ingredients,setIngredients]= useState(prefill.ingredients || []);
  const [ingrInput,  setIngrInput]  = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState(prefill.thumbnailUrl || null);
  const [description, setDescription] = useState(prefill.description || null);
  const [servings, setServings] = useState(prefill.servings || null);
  const [instructions, setInstructions] = useState(prefill.instructions || []);
  const [rawIngredients, setRawIngredients] = useState(prefill.rawIngredients || []);
  const [pdfUrl, setPdfUrl] = useState(prefill.pdfUrl || "");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [recipeId] = useState(() => Date.now());

  const handleSave = () => {
    if (!title.trim() && !url.trim()) return;
    const fallbackTitle = title.trim() || (() => { try { return new URL(url.trim()).hostname.replace(/^www\./, ''); } catch { return url.trim(); } })();
    onAdd({
      id: recipeId,
      title: fallbackTitle,
      source: source.trim() || "Added manually",
      url: url.trim() || null,
      category: category || "dinner",
      time: parseInt(time) || 30,
      tags,
      ingredients,
      thumbnailUrl,
      description: description || null,
      instructions,
      servings: servings || null,
      rawIngredients,
      pdfUrl: pdfUrl || undefined,
    });
    onClose();
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-header">
          <div className="sheet-title">New <em>Recipe</em></div>
          <div className="sheet-subtitle">Saved to your library</div>
        </div>
        <div className="sheet-body">
          <RecipeFormFields
            title={title}        setTitle={setTitle}
            source={source}      setSource={setSource}
            url={url}            setUrl={setUrl}
            time={time}          setTime={setTime}
            category={category}  setCategory={setCategory}
            tags={tags}          setTags={setTags}
            ingredients={ingredients} setIngredients={setIngredients}
            ingrInput={ingrInput}     setIngrInput={setIngrInput}
            customTags={customTags}   customCategories={customCategories}
            thumbnailUrl={thumbnailUrl} setThumbnailUrl={setThumbnailUrl}
            description={description} setDescription={setDescription}
            servings={servings} setServings={setServings}
            instructions={instructions} setInstructions={setInstructions}
            rawIngredients={rawIngredients} setRawIngredients={setRawIngredients}
            pdfUrl={pdfUrl} setPdfUrl={setPdfUrl} recipeId={recipeId}
            setFetchLoading={setFetchLoading}
          />
        </div>
        <div className="sheet-footer">
          <button className="sheet-btn sheet-btn-primary" disabled={(!title.trim() && !url.trim()) || fetchLoading} onClick={handleSave}>
            Save to library
          </button>
          <button className="sheet-btn sheet-btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Shopping Sheet ────────────────────────────────────────────────────────────

function ShoppingSheet({ onClose, week, staples, freezer, fridge, regulars, onAddRegular, onRemoveRegular,
  regChecked, onToggleRegChecked, shopChecked, onToggleShopChecked, freeShop, onAddFreeShop, onToggleFreeShop, shopFilters }) {

  const [freeInput, setFreeInput] = useState("");
  const [regularInput, setRegularInput] = useState("");
  const [unfilteredIds, setUnfilteredIds] = useState(new Set());
  const [popoverId, setPopoverId] = useState(null);

  const toggleReg  = id => onToggleRegChecked(id);
  const removeReg  = id => onRemoveRegular(id);
  const addReg     = val => {
    const t = val.trim().toLowerCase();
    if (t && !regulars.find(r => r.name === t)) onAddRegular(t);
    setRegularInput("");
  };
  const toggleShop    = id => onToggleShopChecked(id);
  const toggleFreeShop = id => onToggleFreeShop(id);
  const addFreeItem   = () => {
    if (freeInput.trim()) { onAddFreeShop(freeInput.trim()); setFreeInput(""); }
  };

  // Derive recipe items — suppress if covered by stocked staple or freezer item
  const okStapleNames = staples.filter(s => s.status === "ok").map(s => s.name.toLowerCase());
  const freezerNames  = (freezer || []).map(i => i.item.toLowerCase());
  const fridgeNames   = (fridge  || []).map(i => i.item.toLowerCase());
  const stapleShopItems = staples
    .filter(s => s.status === "restock")
    .map(s => ({ id: "staple:" + s.name, text: s.name, source: "restock", recipeName: "pantry restock" }));
  const recipeItems = (week || [])
    .flatMap(d => d.items
      .filter(it => it.itemType === 'recipe' && (it.ingredients?.length || it.recipe?.ingredients?.length))
      .flatMap(it => {
        const ings = it.ingredients?.length ? it.ingredients : (it.recipe?.ingredients || []);
        const recipeName = it.recipe?.title || 'Unknown';
        return ings.map(ing => ({ text: ing, source: d.day, id: d.day + ":" + it.id + ":" + ing, recipeName }));
      })
    )
    .filter(item => !okStapleNames.includes(item.text.toLowerCase())
                 && !freezerNames.includes(item.text.toLowerCase())
                 && !fridgeNames.includes(item.text.toLowerCase()));
  const deduped = [];
  const seen = {};
  recipeItems.forEach(item => {
    if (seen[item.text]) { seen[item.text].source += ", " + item.source; seen[item.text].recipeName += ", " + item.recipeName; }
    else { seen[item.text] = { ...item }; deduped.push(seen[item.text]); }
  });
  const allDeduped = [...stapleShopItems, ...deduped, ...freeShop.map(f => ({ ...f, source: null }))];

  // Split staple-filtered vs main — only stocked staple names filter, not restock ones
  const stockedStapleNames = staples.filter(s => s.status === "ok").map(s => s.name.toLowerCase());
  const allFilterNames = [...new Set([...stockedStapleNames, ...shopFilters])];
  const isFiltered = (text) => allFilterNames.some(s => normalizeIngredient(text).toLowerCase().includes(s));
  const mainItems = allDeduped.filter(item => item.source === "restock" || !isFiltered(item.text) || unfilteredIds.has(item.id));
  const filteredItems = allDeduped.filter(item => item.source !== "restock" && isFiltered(item.text) && !unfilteredIds.has(item.id));

  // Duplicate detection among main items
  const dupMap = findDuplicates(mainItems);

  const regsUnchecked = regulars.filter(r => !regChecked[r.id]);
  const regsChecked   = regulars.filter(r =>  regChecked[r.id]);
  const recipeUnchecked = mainItems.filter(i => !shopChecked[i.id] && !i.done);
  const recipeChecked   = mainItems.filter(i =>  shopChecked[i.id] ||  i.done);

  const totalUnchecked = regsUnchecked.length + recipeUnchecked.length;

  const unfilterItem = (item) => {
    setUnfilteredIds(prev => new Set([...prev, item.id]));
  };
  const refilterItem = (item) => {
    setUnfilteredIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
  };

  const renderRecipeRow = (item, checked) => {
    const isDup = dupMap.has(item.id);
    const wasUnfiltered = unfilteredIds.has(item.id);
    return (
      <div key={item.id} className={"shop-col-item" + (checked ? " done-item" : "") + (isDup && !checked ? " duplicate-item" : "")}
           style={checked ? {textDecoration:"line-through", position:"relative"} : {position:"relative"}}
           onClick={() => { if (isDup && !checked) setPopoverId(popoverId === item.id ? null : item.id); }}>
        <input type="checkbox" checked={!!checked} onChange={() => item.done !== undefined ? toggleFreeShop(item.id) : toggleShop(item.id)}/>
        <div style={{flex:1,minWidth:0}}>
          <div className="shop-col-text">{item.text}</div>
          {item.source && <div className="shop-col-source">{item.recipeName || item.source}</div>}
        </div>
        {wasUnfiltered && !checked && (
          <button className="pill-refilter" onClick={e => { e.stopPropagation(); refilterItem(item); }} title="Move back to filtered">↩</button>
        )}
        {popoverId === item.id && dupMap.get(item.id) && (
          <span className="dup-popover" onClick={e => e.stopPropagation()}>
            Also needed: {dupMap.get(item.id).map(d => d.text + " \u00b7 " + d.recipeName).join("; ")}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" style={{maxHeight:"92vh"}} onClick={e => { e.stopPropagation(); setPopoverId(null); }}>
        <div className="sheet-handle"/>
        <div className="sheet-header" style={{paddingBottom:10}}>
          <div className="sheet-title">
            Shopping <em>List</em>
            {totalUnchecked > 0 && <span className="shop-count-badge">{totalUnchecked}</span>}
          </div>
        </div>

        <div className="sheet-body" style={{padding:0}}>

          {/* Weekly regulars */}
          <div className="shop-sheet-group-label">Every week</div>
          <div className="shop-col-grid">
            {regsUnchecked.map(r => (
              <div key={r.id} className="shop-col-item">
                <input type="checkbox" checked={false} onChange={() => toggleReg(r.id)}/>
                <div style={{flex:1,minWidth:0}}>
                  <div className="shop-col-text">{r.name}</div>
                </div>
                <button className="pantry-row-remove" style={{opacity:0.25,fontSize:13}} onClick={e=>{e.stopPropagation();removeReg(r.id);}}>×</button>
              </div>
            ))}
            {regsChecked.map(r => (
              <div key={r.id} className="shop-col-item done-item">
                <input type="checkbox" checked={true} onChange={() => toggleReg(r.id)}/>
                <div style={{flex:1,minWidth:0,textDecoration:"line-through"}}>
                  <div className="shop-col-text">{r.name}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:"6px 12px 10px", borderBottom:"1px solid var(--border2)", display:"flex", gap:8}}>
            <input className="pantry-add-input" placeholder="Add to weekly regulars…" value={regularInput}
              style={{fontSize:11}}
              onChange={e => setRegularInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addReg(regularInput); }}/>
            <button className="pantry-add-btn" disabled={!regularInput.trim()} onClick={() => addReg(regularInput)} style={{fontSize:11,padding:"6px 10px"}}>Add</button>
          </div>

          {/* This week */}
          <div className="shop-sheet-group-label">This week's recipes</div>
          {recipeUnchecked.length === 0 && recipeChecked.length === 0 && freeShop.length === 0 && filteredItems.length === 0 ? (
            <div style={{padding:"10px 20px", color:"var(--ink4)", fontSize:12, fontStyle:"italic"}}>
              Plan dinners to auto-populate ingredients here.
            </div>
          ) : (
            <div className="shop-col-grid">
              {recipeUnchecked.map(item => renderRecipeRow(item, false))}
              {recipeChecked.map(item => renderRecipeRow(item, true))}
            </div>
          )}
          {filteredItems.length > 0 && (
            <details className="filtered-section" style={{padding:"0 12px 6px"}}>
              <summary className="filtered-summary">Filtered out ({filteredItems.length})</summary>
              <div className="filtered-note">These match common staples — check your pantry</div>
              <div className="shop-col-grid">
                {filteredItems.map(item => (
                  <div key={item.id} className="shop-col-item" style={{opacity:0.45, fontStyle:"italic", cursor:"pointer"}}
                    onClick={() => unfilterItem(item)}>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="shop-col-text">{item.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
          <div style={{padding:"6px 12px 10px", display:"flex", gap:8}}>
            <input className="pantry-add-input" placeholder="Add item…" value={freeInput}
              style={{fontSize:11}}
              onChange={e => setFreeInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addFreeItem(); }}/>
            <button className="pantry-add-btn" disabled={!freeInput.trim()} onClick={addFreeItem} style={{fontSize:11,padding:"6px 10px"}}>Add</button>
          </div>

        </div>

        <div className="sheet-footer">
          <button className="sheet-btn sheet-btn-cancel" style={{flex:1}} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Radar Review Sheet ───────────────────────────────────────────────────────
// Opens after a radar item is slotted into a day (after scraping completes).

function RadarReviewSheet({ radarItem, scrapedData, onConfirm, onCancel }) {
  const [title, setTitle] = useState(scrapedData?.title || radarItem.title || "");
  const [cookTime, setCookTime] = useState(String(scrapedData?.cookTime || radarItem.cookTime || "30"));
  const [servings, setServings] = useState(scrapedData?.servings || radarItem.servings || "");
  const thumbnailUrl = scrapedData?.thumbnailUrl || radarItem.thumbnailUrl || null;
  const scrapeFailed = !scrapedData && radarItem.url;

  // Build normalized ingredient list — user can remove items
  const rawIngredients = scrapedData?.ingredients || radarItem.ingredients || [];
  const [ingredients, setIngredients] = useState(() =>
    rawIngredients.map(ing => ({
      raw: ing,
      name: normalizeIngredient(ing),
      removed: false,
    }))
  );

  const toggleIngredient = (idx) => {
    setIngredients(prev => prev.map((ing, i) => i === idx ? { ...ing, removed: !ing.removed } : ing));
  };

  const handleConfirm = () => {
    const confirmed = ingredients.filter(i => !i.removed).map(i => i.name);
    onConfirm({
      title: title.trim(),
      cookTime: parseInt(cookTime) || 30,
      servings: servings.trim() || null,
      thumbnailUrl,
      ingredients: confirmed,
      rawIngredients: rawIngredients,
      instructions: scrapedData?.instructions || radarItem.instructions || [],
    });
  };

  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-header">
          <div className="sheet-title">Review — <em>{radarItem.title}</em></div>
        </div>

        <div className="sheet-body">
          {thumbnailUrl && (
            <img src={thumbnailUrl} alt="" style={{width:"100%", height:120, objectFit:"cover", borderRadius:8, marginBottom:12}}/>
          )}

          <div className="form-field">
            <label className="form-label">Title</label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)}/>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Cook time (min)</label>
              <input className="form-input" type="number" value={cookTime} onChange={e => setCookTime(e.target.value)}/>
            </div>
            <div className="form-field">
              <label className="form-label">Servings</label>
              <input className="form-input" placeholder="e.g. 4" value={servings} onChange={e => setServings(e.target.value)}/>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Ingredients — <span style={{fontWeight:400, color:"var(--ink4)"}}>tap to remove items you always have</span></label>
            {ingredients.length > 0 ? (
              <div style={{display:"flex", flexWrap:"wrap", gap:6, marginTop:4}}>
                {ingredients.map((ing, i) => (
                  <span key={i}
                    className={"radar-review-pill" + (ing.removed ? " removed" : "")}
                    onClick={() => toggleIngredient(i)}>
                    {ing.name}
                    {!ing.removed && <span style={{marginLeft:4, opacity:0.5}}>×</span>}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{fontSize:12, color:"var(--ink4)", fontStyle:"italic", marginTop:4}}>
                {scrapeFailed
                  ? "Couldn't scrape ingredients — add manually after saving"
                  : "No ingredients found"}
              </div>
            )}
          </div>
        </div>

        <div className="sheet-footer">
          <button className="sheet-btn sheet-btn-primary" style={{flex:1}} disabled={!title.trim()} onClick={handleConfirm}>Confirm</button>
          <button className="sheet-btn sheet-btn-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Plan Sheet ────────────────────────────────────────────────────────────────
// Opens when tapping any day card, stub, or the "+ Add dinner" button.
// targetDay: the WEEK entry being edited (or null for "pick any unplanned day")
// onClose, onSlot(dayIndex, recipe), onRemove(dayIndex), onAddRecipe(recipe)

function PlanSheet({ targetDay, dayIndex, week, recipes, radar, onClose, onAddItem, onRemoveItem, onClearDay, onAddNote, onAddRecipe, freezer, onAdjustFreezerQty, customTags = [], customCategories = [] }) {
  const [mode, setMode]       = useState("pick");
  const [search, setSearch]   = useState("");
  const [newTitle, setNewTitle]         = useState("");
  const [newUrl, setNewUrl]             = useState("");
  const [newTime, setNewTime]           = useState("30");
  const [newIngredients, setNewIngr]    = useState([]);
  const [newIngrInput, setNewIngrInput] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const [newSource, setNewSource]       = useState("");
  const [newCategory, setNewCategory]   = useState("dinner");
  const [newTags, setNewTags]           = useState([]);
  const [newPrepNote, setNewPrepNote]   = useState("");
  const [newThumbnailUrl, setNewThumbnailUrl] = useState(null);
  const [newDescription, setNewDescription] = useState(null);
  const [newServings, setNewServings] = useState(null);
  const [newInstructions, setNewInstructions] = useState([]);
  const [newRawIngredients, setNewRawIngredients] = useState([]);

  const [fetchLoading, setFetchLoading] = useState(false);
  const [scraped, setScraped] = useState(false);
  const urlDebounceRef = useRef(null);
  const lastFetchedUrlRef = useRef("");

  const [deductPrompt, setDeductPrompt] = useState(null);
  const [noteText, setNoteText] = useState("");
  // deductPrompt: { recipe, matches: [{freezerItem, qty}] }

  const filtered = recipes.filter(r =>
    (r.category === "dinner" || !r.category) &&
    (search === "" || r.title.toLowerCase().includes(search.toLowerCase()))
  );

  const checkFreezerMatches = (recipe) => {
    if (!freezer?.length || !recipe.ingredients?.length) return [];
    const freezerMap = Object.fromEntries(freezer.map(i => [i.item.toLowerCase(), i]));
    return recipe.ingredients
      .map(ing => freezerMap[ing.toLowerCase()])
      .filter(Boolean)
      .map(fi => ({ freezerItem: fi, deduct: 1 }));
  };

  const handleSlot = (recipe) => {
    const matches = checkFreezerMatches(recipe);
    if (matches.length) {
      setDeductPrompt({ recipe, matches });
    } else {
      onAddItem(dayIndex, recipe);
      onClose();
    }
  };

  const doUrlScrape = async (urlVal) => {
    const trimmed = urlVal.trim();
    if (!trimmed || trimmed === lastFetchedUrlRef.current) return;
    lastFetchedUrlRef.current = trimmed;
    setFetchLoading(true);
    setScraped(false);
    const { thumbnailUrl: t, scrapedData } = await fetchRecipeData(trimmed);
    if (t) setNewThumbnailUrl(t);
    if (scrapedData) {
      if (!newTitle.trim() && scrapedData.title) setNewTitle(scrapedData.title);
      if (newTime === "30" && scrapedData.cookTime) setNewTime(String(scrapedData.cookTime));
      if (!newIngredients.length && scrapedData.ingredients) setNewIngr(scrapedData.ingredients);
      if (scrapedData.description) setNewDescription(scrapedData.description);
      if (scrapedData.servings) setNewServings(scrapedData.servings);
      if (scrapedData.instructions) setNewInstructions(scrapedData.instructions);
      if (scrapedData.ingredients) setNewRawIngredients(scrapedData.ingredients);
      setScraped(true);
    }
    try { if (!newSource.trim()) setNewSource(new URL(trimmed).hostname.replace(/^www\./, '')); } catch {}
    setFetchLoading(false);
  };
  const handleNewUrlBlur = () => {
    if (urlDebounceRef.current) { clearTimeout(urlDebounceRef.current); urlDebounceRef.current = null; }
    doUrlScrape(newUrl);
  };
  const handleNewUrlChange = (val) => {
    setNewUrl(val);
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    urlDebounceRef.current = setTimeout(() => doUrlScrape(val), 800);
  };

  const handleAddNew = () => {
    if (!newTitle.trim() && !newUrl.trim()) return;
    const fallbackTitle = newTitle.trim() || (() => { try { return new URL(newUrl.trim()).hostname.replace(/^www\./, ''); } catch { return newUrl.trim(); } })();
    const recipe = {
      title: fallbackTitle,
      source: newSource.trim() || "Added manually",
      url: newUrl.trim() || null,
      category: saveToLibrary ? (newCategory || "dinner") : "dinner",
      tags: saveToLibrary ? newTags : [],
      time: parseInt(newTime) || 30,
      ingredients: newIngredients,
      prepNote: newPrepNote.trim() || undefined,
      thumbnailUrl: newThumbnailUrl,
      description: newDescription || null,
      instructions: newInstructions,
      servings: newServings || null,
      rawIngredients: newRawIngredients,
      inLibrary: saveToLibrary,
      _needsInsert: true,
    };
    if (saveToLibrary) onAddRecipe(recipe);
    const matches = checkFreezerMatches(recipe);
    if (matches.length) {
      setDeductPrompt({ recipe, matches });
    } else {
      onAddItem(dayIndex, recipe);
      onClose();
    }
  };

  const confirmDeduct = () => {
    deductPrompt.matches.forEach(({ freezerItem, deduct }) => {
      onAdjustFreezerQty(freezerItem.id, -deduct);
    });
    onAddItem(dayIndex, deductPrompt.recipe);
    onClose();
  };

  const skipDeduct = () => {
    onAddItem(dayIndex, deductPrompt.recipe);
    onClose();
  };

  const updateDeduct = (id, delta) => {
    setDeductPrompt(p => ({
      ...p,
      matches: p.matches.map(m => m.freezerItem.id === id
        ? { ...m, deduct: Math.max(0, m.deduct + delta) }
        : m
      )
    }));
  };

  const dayLabel = targetDay
    ? `${targetDay.day}day`
    : "Choose a night";

  if (deductPrompt) return (
    <div className="sheet-overlay" onClick={skipDeduct}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="deduct-prompt">
          <div>
            <div className="deduct-title">Using from freezer</div>
            <div className="deduct-subtitle">How much should we deduct from your freezer stock?</div>
          </div>
          {deductPrompt.matches.map(({ freezerItem, deduct }) => (
            <div key={freezerItem.id} className="deduct-row">
              <div className="deduct-row-name">
                {freezerItem.item}
                <div className="deduct-row-current">{freezerItem.qty} lb in stock</div>
              </div>
              <div className="fz-stepper">
                <button className="fz-stepper-btn" onClick={() => updateDeduct(freezerItem.id, -1)}>−</button>
                <span className="fz-stepper-val">{deduct}</span>
                <button className="fz-stepper-btn" onClick={() => updateDeduct(freezerItem.id, +1)}>+</button>
                <span className="fz-unit">lb</span>
              </div>
            </div>
          ))}
        </div>
        <div className="sheet-footer">
          <button className="sheet-btn sheet-btn-primary" onClick={confirmDeduct}>Confirm & deduct</button>
          <button className="sheet-btn sheet-btn-cancel" onClick={skipDeduct}>Skip</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-header">
          <div className="sheet-title">
            {targetDay?.items?.length > 0 ? <>Add to <em>{targetDay.day}</em>'s dinner</> : <>Plan <em>{targetDay?.day ?? "a night"}</em></>}
          </div>
          <div className="sheet-subtitle">{dayLabel}</div>
        </div>

        <div className="sheet-mode-toggle">
          <button className={"sheet-mode-btn" + (mode==="pick" ? " active" : "")} onClick={() => setMode("pick")}>
            From Library
          </button>
          <button className={"sheet-mode-btn" + (mode==="radar" ? " active" : "")} onClick={() => setMode("radar")}>
            Try Soon
          </button>
          <button className={"sheet-mode-btn" + (mode==="url" ? " active" : "")} onClick={() => setMode("url")}>
            Add URL
          </button>
          <button className={"sheet-mode-btn" + (mode==="note" ? " active" : "")} onClick={() => setMode("note")}>
            Note
          </button>
        </div>

        <div className="sheet-body">
          {mode === "pick" && (<>
            <input
              className="pick-search"
              placeholder="Search recipes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />

            {filtered.map(r => (
              <div key={r.id} className="pick-recipe-item" onClick={() => handleSlot(r)}>
                <div className="pick-thumb">{r.title[0]}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="pick-recipe-title">{r.title}</div>
                  <div className="pick-recipe-meta">{r.source} · {r.time} min</div>
                  <div className="pick-tags"><Tags tags={r.tags}/></div>
                </div>
                <span style={{color:"var(--ink4)", fontSize:20}}>›</span>
              </div>
            ))}

            {filtered.length === 0 && (
              <div style={{padding:"24px 0", textAlign:"center", color:"var(--ink4)", fontSize:13, fontStyle:"italic"}}>
                No recipes match "{search}"
              </div>
            )}
          </>)}

          {mode === "radar" && (<>
            <input
              className="pick-search"
              placeholder="Search try soon…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {(() => {
              const filteredRadar = (radar || []).filter(item =>
                search === "" || item.title.toLowerCase().includes(search.toLowerCase())
              );
              if (!filteredRadar.length) return (
                <div style={{padding:"24px 0", textAlign:"center", color:"var(--ink4)", fontSize:13, fontStyle:"italic"}}>
                  {radar?.length ? `No items match "${search}"` : "Nothing on your Try Soon list yet"}
                </div>
              );
              return filteredRadar.map(item => (
                <div key={"radar-"+item.id} className="pick-recipe-item" onClick={() => handleSlot(item)}>
                  <div className="pick-thumb" style={{background:"var(--accent-pale)", color:"var(--accent)"}}>✦</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div className="pick-recipe-title">{item.title}</div>
                    <div className="pick-recipe-meta">{item.source || "Try Soon"}{item.time ? ` · ${item.time} min` : ""}</div>
                  </div>
                  <span style={{color:"var(--ink4)", fontSize:20}}>›</span>
                </div>
              ));
            })()}
          </>)}

          {mode === "note" && (
            <div style={{padding:"8px 0"}}>
              <div className="form-field">
                <label className="form-label">What's the plan?</label>
                <input
                  className="form-input"
                  placeholder="e.g. cheese omelette and salad"
                  value={noteText}
                  autoFocus
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && noteText.trim()) {
                      onAddNote(dayIndex, noteText);
                      onClose();
                    }
                  }}
                />
              </div>
            </div>
          )}

          {mode === "url" && (
            <div style={{paddingBottom:8}}>
              <div className="form-field">
                <label className="form-label">URL</label>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <input className="form-input" style={{flex:1}} placeholder="https://…" value={newUrl}
                    autoFocus
                    onChange={e => handleNewUrlChange(e.target.value)}
                    onBlur={handleNewUrlBlur}/>
                  {fetchLoading && <span style={{fontSize:11, color:"var(--ink4)", flexShrink:0}}>fetching…</span>}
                  {!fetchLoading && newThumbnailUrl && <img src={newThumbnailUrl} alt="" style={{width:40, height:40, borderRadius:6, objectFit:"cover", flexShrink:0}}/>}
                </div>
                {scraped && <div style={{fontSize:10, color:"var(--sage)", marginTop:3, fontStyle:"italic"}}>Fetched from page</div>}
              </div>
              <div className="form-field">
                <label className="form-label">Title</label>
                <input className="form-input" placeholder="e.g. Roast chicken with lemon" value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}/>
              </div>
              <div className="form-field">
                <label className="form-label">Source</label>
                <input className="form-input" placeholder="e.g. NYT Cooking, Smitten Kitchen" value={newSource}
                  onChange={e => setNewSource(e.target.value)}/>
              </div>
              <div className="form-field">
                <label className="form-label">Cook time (min)</label>
                <input className="form-input" type="number" value={newTime}
                  onChange={e => setNewTime(e.target.value)}/>
              </div>
              <div className="form-field">
                <label className="form-label">Key ingredients <span style={{fontWeight:400,color:"var(--ink4)"}}>optional</span></label>
                <div className="ingredient-tags" onClick={e => e.currentTarget.querySelector("input")?.focus()}>
                  {newIngredients.map((ing, i) => (
                    <span key={i} className="ingredient-tag">
                      <span style={{cursor:"pointer"}} onClick={e => { e.stopPropagation(); setNewIngrInput(ing); setNewIngr(ii => ii.filter((_,idx) => idx !== i)); }}>{ing}</span>
                      <button className="ingredient-tag-remove" onClick={e => { e.stopPropagation(); setNewIngr(ii => ii.filter((_,idx) => idx !== i)); }}>×</button>
                    </span>
                  ))}
                  <input className="ingredient-tag-input"
                    placeholder={newIngredients.length === 0 ? "e.g. salmon fillet…" : "add more…"}
                    value={newIngrInput}
                    onChange={e => setNewIngrInput(e.target.value)}
                    onKeyDown={e => {
                      const v = newIngrInput.trim().toLowerCase();
                      if ((e.key === "Enter" || e.key === ",") && v) {
                        e.preventDefault();
                        if (!newIngredients.includes(v)) setNewIngr(ii => [...ii, v]);
                        setNewIngrInput("");
                      } else if (e.key === "Backspace" && !newIngrInput && newIngredients.length > 0) {
                        setNewIngr(ii => ii.slice(0,-1));
                      }
                    }}
                    onBlur={() => { const v = newIngrInput.trim().toLowerCase(); if (v && !newIngredients.includes(v)) { setNewIngr(ii => [...ii, v]); setNewIngrInput(""); }}}
                  />
                </div>
                <div className="ingredient-tag-hint">Enter or comma to add</div>
              </div>
              <div className="form-field">
                <label className="form-label">Prep note <span style={{fontWeight:400,color:"var(--ink4)"}}>optional</span></label>
                <input className="form-input" placeholder="e.g. Marinate overnight" value={newPrepNote}
                  onChange={e => setNewPrepNote(e.target.value)}/>
              </div>
              <div style={{marginTop:12, borderTop:"1px solid var(--border2)", paddingTop:12}}>
                <label style={{display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--ink3)", cursor:"pointer", marginBottom: saveToLibrary ? 12 : 0}}>
                  <input type="checkbox" checked={saveToLibrary} onChange={e => setSaveToLibrary(e.target.checked)}
                    style={{accentColor:"var(--accent)"}}/>
                  <span>Save to recipe library</span>
                </label>
                {saveToLibrary && (
                  <div>
                    <div className="form-field">
                      <label className="form-label">Category</label>
                      <div className="cat-select">
                        {[["dinner","Dinner"],["breakfast","Breakfast & Snacks"],["sweets","Sweets"],...customCategories.map(c=>[c,c])].map(([k,l]) => (
                          <button key={k} type="button"
                            className={"cat-btn" + (newCategory === k ? " active" : "")}
                            onClick={() => setNewCategory(k)}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Tags</label>
                      <div className="tag-toggle-row">
                        {["fish","vegetarian",...customTags].map(t => (
                          <button key={t} className={"tag-toggle" + (newTags.includes(t) ? " on" : "")}
                            onClick={() => setNewTags(tt => tt.includes(t) ? tt.filter(x => x !== t) : [...tt, t])}>
                            {t === "fish" ? "🐟 Fish" : t === "vegetarian" ? "🌿 Veg" : t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sheet-footer">
          {mode === "note" && (
            <button className="sheet-btn sheet-btn-primary" disabled={!noteText.trim()} onClick={() => { onAddNote(dayIndex, noteText); onClose(); }}>
              Save note
            </button>
          )}
          {mode === "url" && (
            <button className="sheet-btn sheet-btn-primary" disabled={(!newTitle.trim() && !newUrl.trim()) || fetchLoading} onClick={handleAddNew}>
              Plan for {targetDay?.day ?? "this night"}
            </button>
          )}
          <button className="sheet-btn sheet-btn-cancel" onClick={onClose}>
            {mode === "note" || mode === "url" ? "Back" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Day Card & Stub ───────────────────────────────────────────────────────────

function ItemCard({ item, isToday, isPrimary, readyBy, onDetail, onRemove, isDragging, onDragStart, onDragEnd, onTouchDragStart }) {
  const [swiped, setSwiped] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const longPressTimer = useRef(null);
  const isDragMode = useRef(false);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragMode.current = false;
    // Start long-press timer for drag initiation
    longPressTimer.current = setTimeout(() => {
      isDragMode.current = true;
      if (onTouchDragStart) onTouchDragStart(item);
    }, 500);
  };
  const handleTouchMove = (e) => {
    if (isDragMode.current) return; // Already in drag mode, handled by WeekView
    // Cancel long-press if finger moves too much
    if (longPressTimer.current && touchStartX.current !== null) {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };
  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (isDragMode.current) {
      isDragMode.current = false;
      return; // Drop handled by WeekView
    }
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx < -50) setSwiped(true);
    else if (dx > 30) setSwiped(false);
  };

  const cardDragProps = {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move';
      if (onDragStart) onDragStart();
    },
    onDragEnd: () => { if (onDragEnd) onDragEnd(); },
  };

  // Note card
  if (item.itemType === 'note') {
    return (
      <div className={"item-card item-card-note" + (isToday ? " today" : "") + (swiped ? " swiped" : "") + (isDragging ? " dragging" : "")}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="item-card-inner" {...cardDragProps} onClick={() => {}}>
          <div className="item-note-text">{item.note}</div>
        </div>
        <button className="item-card-remove-hover" onClick={e => { e.stopPropagation(); onRemove(); }}>×</button>
        <div className="item-card-remove-swipe" onClick={() => onRemove()}>Remove</div>
      </div>
    );
  }

  // Recipe card (library or Try Soon)
  const r = item.recipe;
  if (!r) return null;
  const time = item.cookTime || r.time || 30;
  const title = r.title || "Untitled";
  const thumb = item.thumbnailUrl || r.thumbnailUrl || null;
  const isRadar = !r.inLibrary;
  const start = isPrimary ? calcStart(readyBy, time) : null;

  return (
    <div className={"item-card" + (isRadar ? " item-card-radar" : "") + (isToday ? " today" : "") + (swiped ? " swiped" : "") + (isDragging ? " dragging" : "")}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="item-card-inner" {...cardDragProps} onClick={() => onDetail(r)}>
        {thumb ? (
          <img className="item-card-thumb" src={thumb} alt="" />
        ) : (
          <div className="item-card-thumb-placeholder">{isRadar ? "✦" : "🍽"}</div>
        )}
        <div className="item-card-title">{title}</div>
        {isRadar && <div className="item-card-radar-label">Try Soon</div>}
        <div className="item-card-meta">
          {isPrimary ? (
            <span>{start} · {time} min</span>
          ) : (
            <span>{time} min</span>
          )}
        </div>
      </div>
      <button className="item-card-remove-hover" onClick={e => { e.stopPropagation(); onRemove(); }}>×</button>
      <div className="item-card-remove-swipe" onClick={() => onRemove()}>Remove</div>
    </div>
  );
}

// ── Batch Detail Sheet ────────────────────────────────────────────────────────
// ── Batch Sheet ───────────────────────────────────────────────────────────────
// Slides up when tapping the "+ Add batch recipe" card.
// Pick from recipe library or add a brand-new recipe.
// Saves to Sunday Batch Prep (with yield + note fields).

function BatchSheet({ recipes, onClose, onAdd, onAddRecipe, customTags = [], customCategories = [] }) {
  const [mode, setMode] = useState("pick");
  const [search, setSearch] = useState("");
  const [noteText, setNoteText] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTime, setNewTime] = useState("30");
  const [newIngredients, setNewIngr] = useState([]);
  const [newIngrInput, setNewIngrInput] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newCategory, setNewCategory] = useState("dinner");
  const [newTags, setNewTags] = useState([]);
  const [newPrepNote, setNewPrepNote] = useState("");
  const [newThumbnailUrl, setNewThumbnailUrl] = useState(null);
  const [newDescription, setNewDescription] = useState(null);
  const [newServings, setNewServings] = useState(null);
  const [newInstructions, setNewInstructions] = useState([]);
  const [newRawIngredients, setNewRawIngredients] = useState([]);
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  const filtered = recipes.filter(r =>
    search === "" || r.title.toLowerCase().includes(search.toLowerCase())
  );

  const handlePick = (r) => {
    onAdd(r);
    onClose();
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const recipe = {
      title: noteText.trim(),
      source: "Added manually",
      url: null,
      category: "dinner",
      tags: [],
      time: 0,
      ingredients: [],
      inLibrary: false,
      _needsInsert: true,
    };
    onAdd(recipe);
    onClose();
  };

  const handleAddNew = () => {
    if (!newTitle.trim()) return;
    const recipe = {
      title: newTitle.trim(),
      source: saveToLibrary ? (newSource.trim() || "Added manually") : "Added manually",
      url: newUrl.trim() || null,
      category: saveToLibrary ? (newCategory || "dinner") : "dinner",
      tags: saveToLibrary ? newTags : [],
      time: parseInt(newTime) || 30,
      ingredients: newIngredients,
      prepNote: newPrepNote.trim() || undefined,
      thumbnailUrl: newThumbnailUrl,
      description: newDescription || null,
      instructions: newInstructions,
      servings: newServings || null,
      rawIngredients: newRawIngredients,
      inLibrary: saveToLibrary,
      _needsInsert: true,
    };
    if (saveToLibrary) onAddRecipe(recipe);
    onAdd(recipe);
    onClose();
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-header">
          <div className="sheet-title">Weekend <em>Batch</em> Prep</div>
          <div className="sheet-subtitle">Add a recipe to make ahead this weekend</div>
        </div>

        <div className="sheet-mode-toggle">
          <button className={"sheet-mode-btn" + (mode==="pick" ? " active" : "")} onClick={() => setMode("pick")}>
            From library
          </button>
          <button className={"sheet-mode-btn" + (mode==="note" ? " active" : "")} onClick={() => setMode("note")}>
            Add note
          </button>
          <button className={"sheet-mode-btn" + (mode==="new" ? " active" : "")} onClick={() => setMode("new")}>
            New recipe
          </button>
        </div>

        <div className="sheet-body">
          {mode === "pick" && (<>
            <input className="pick-search" placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)} autoFocus/>
            {filtered.map(r => (
              <div key={r.id} className="pick-recipe-item" onClick={() => handlePick(r)}>
                <div className="pick-thumb">{r.title[0]}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div className="pick-recipe-title">{r.title}</div>
                  <div className="pick-recipe-meta">{r.source} · {r.time} min</div>
                  <div className="pick-tags"><Tags tags={r.tags}/></div>
                </div>
                <span style={{color:"var(--ink4)", fontSize:20}}>›</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{padding:"24px 0", textAlign:"center", color:"var(--ink4)", fontSize:13, fontStyle:"italic"}}>
                No recipes match "{search}"
              </div>
            )}
          </>)}

          {mode === "note" && (
            <div style={{padding:"8px 0"}}>
              <div className="form-field">
                <label className="form-label">What's the plan?</label>
                <input
                  className="form-input"
                  placeholder="e.g. chicken stock, granola bars"
                  value={noteText}
                  autoFocus
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && noteText.trim()) handleAddNote();
                  }}
                />
              </div>
            </div>
          )}

          {mode === "new" && (
            <div style={{paddingBottom:8}}>
              <div className="form-field">
                <label className="form-label">Recipe name</label>
                <input className="form-input" placeholder="e.g. Roast chicken with lemon" value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}/>
              </div>
              <div className="form-field">
                <label className="form-label">URL <span style={{fontWeight:400,color:"var(--ink4)"}}>optional</span></label>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <input className="form-input" style={{flex:1}} placeholder="https://…" value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    onBlur={async () => {
                      if (!newUrl.trim()) return;
                      const { thumbnailUrl: t, scrapedData } = await fetchRecipeData(newUrl.trim());
                      if (t) setNewThumbnailUrl(t);
                      if (scrapedData) {
                        if (!newTitle.trim() && scrapedData.title) setNewTitle(scrapedData.title);
                        if (newTime === "30" && scrapedData.cookTime) setNewTime(String(scrapedData.cookTime));
                        if (!newIngredients.length && scrapedData.ingredients) setNewIngr(scrapedData.ingredients);
                        if (scrapedData.description) setNewDescription(scrapedData.description);
                        if (scrapedData.servings) setNewServings(scrapedData.servings);
                        if (scrapedData.instructions) setNewInstructions(scrapedData.instructions);
                        if (scrapedData.ingredients) setNewRawIngredients(scrapedData.ingredients);
                      }
                    }}/>
                  {newThumbnailUrl && <img src={newThumbnailUrl} alt="" style={{width:40, height:40, borderRadius:6, objectFit:"cover", flexShrink:0}}/>}
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Cook time (min)</label>
                <input className="form-input" type="number" value={newTime}
                  onChange={e => setNewTime(e.target.value)}/>
              </div>
              <div className="form-field">
                <label className="form-label">Key ingredients <span style={{fontWeight:400,color:"var(--ink4)"}}>optional</span></label>
                <div className="ingredient-tags" onClick={e => e.currentTarget.querySelector("input")?.focus()}>
                  {newIngredients.map((ing, i) => (
                    <span key={i} className="ingredient-tag">
                      <span style={{cursor:"pointer"}} onClick={e => { e.stopPropagation(); setNewIngrInput(ing); setNewIngr(ii => ii.filter((_,idx) => idx !== i)); }}>{ing}</span>
                      <button className="ingredient-tag-remove" onClick={e => { e.stopPropagation(); setNewIngr(ii => ii.filter((_,idx) => idx !== i)); }}>×</button>
                    </span>
                  ))}
                  <input className="ingredient-tag-input"
                    placeholder={newIngredients.length === 0 ? "e.g. salmon fillet…" : "add more…"}
                    value={newIngrInput}
                    onChange={e => setNewIngrInput(e.target.value)}
                    onKeyDown={e => {
                      const v = newIngrInput.trim().toLowerCase();
                      if ((e.key === "Enter" || e.key === ",") && v) {
                        e.preventDefault();
                        if (!newIngredients.includes(v)) setNewIngr(ii => [...ii, v]);
                        setNewIngrInput("");
                      } else if (e.key === "Backspace" && !newIngrInput && newIngredients.length > 0) {
                        setNewIngr(ii => ii.slice(0,-1));
                      }
                    }}
                    onBlur={() => { const v = newIngrInput.trim().toLowerCase(); if (v && !newIngredients.includes(v)) { setNewIngr(ii => [...ii, v]); setNewIngrInput(""); }}}
                  />
                </div>
                <div className="ingredient-tag-hint">Enter or comma to add</div>
              </div>
              <div className="form-field">
                <label className="form-label">Prep note <span style={{fontWeight:400,color:"var(--ink4)"}}>optional</span></label>
                <input className="form-input" placeholder="e.g. Marinate overnight" value={newPrepNote}
                  onChange={e => setNewPrepNote(e.target.value)}/>
              </div>
              <div style={{marginTop:12, borderTop:"1px solid var(--border2)", paddingTop:12}}>
                <label style={{display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--ink3)", cursor:"pointer", marginBottom: saveToLibrary ? 12 : 0}}>
                  <input type="checkbox" checked={saveToLibrary} onChange={e => setSaveToLibrary(e.target.checked)}
                    style={{accentColor:"var(--accent)"}}/>
                  <span>Save to recipe library</span>
                </label>
                {saveToLibrary && (
                  <div>
                    <div className="form-field">
                      <label className="form-label">Source</label>
                      <input className="form-input" placeholder="e.g. NYT Cooking, Smitten Kitchen" value={newSource}
                        onChange={e => setNewSource(e.target.value)}/>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Category</label>
                      <div className="cat-select">
                        {[["dinner","Dinner"],["breakfast","Breakfast & Snacks"],["sweets","Sweets"],...customCategories.map(c=>[c,c])].map(([k,l]) => (
                          <button key={k} type="button"
                            className={"cat-btn" + (newCategory === k ? " active" : "")}
                            onClick={() => setNewCategory(k)}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Tags</label>
                      <div className="tag-toggle-row">
                        {["fish","vegetarian",...customTags].map(t => (
                          <button key={t} className={"tag-toggle" + (newTags.includes(t) ? " on" : "")}
                            onClick={() => setNewTags(tt => tt.includes(t) ? tt.filter(x => x !== t) : [...tt, t])}>
                            {t === "fish" ? "🐟 Fish" : t === "vegetarian" ? "🌿 Veg" : t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="sheet-footer">
          {mode === "note" && <button className="sheet-btn sheet-btn-primary" disabled={!noteText.trim()} onClick={handleAddNote}>Add</button>}
          {mode === "new" && <button className="sheet-btn sheet-btn-primary" disabled={!newTitle.trim()} onClick={handleAddNew}>Add</button>}
          <button className="sheet-btn sheet-btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Inline Shopping List (week tab) ──────────────────────────────────────────
function WeekShoppingList({ week, staples, freezer, fridge, regulars, regChecked, onToggleRegChecked, shopChecked, onToggleShopChecked, freeShop, onAddFreeShop, onToggleFreeShop, shopFilters }) {
  const [freeInput, setFreeInput] = useState("");
  const [unfilteredIds, setUnfilteredIds] = useState(new Set());
  const [popoverId, setPopoverId] = useState(null);

  const okStapleNames = staples.filter(s => s.status === "ok").map(s => s.name.toLowerCase());
  const freezerNames  = (freezer || []).map(i => i.item.toLowerCase());
  const fridgeNames   = (fridge  || []).map(i => i.item.toLowerCase());
  const stapleShopItems = staples.filter(s => s.status === "restock").map(s => ({ id: "staple:" + s.name, text: s.name, source: "restock", recipeName: "pantry restock" }));
  const recipeItems = (week || [])
    .flatMap(d => d.items
      .filter(it => it.itemType === 'recipe' && (it.ingredients?.length || it.recipe?.ingredients?.length))
      .flatMap(it => {
        const ings = it.ingredients?.length ? it.ingredients : (it.recipe?.ingredients || []);
        const recipeName = it.recipe?.title || 'Unknown';
        return ings.map(ing => ({ text: ing, source: d.day, id: d.day + ":" + it.id + ":" + ing, recipeName }));
      })
    )
    .filter(item => !okStapleNames.includes(item.text.toLowerCase()) && !freezerNames.includes(item.text.toLowerCase()) && !fridgeNames.includes(item.text.toLowerCase()));
  const deduped = []; const seen = {};
  recipeItems.forEach(item => {
    if (seen[item.text]) { seen[item.text].source += ", " + item.source; seen[item.text].recipeName += ", " + item.recipeName; }
    else { seen[item.text] = { ...item }; deduped.push(seen[item.text]); }
  });
  const allDeduped = [...stapleShopItems, ...deduped, ...freeShop];

  // Split staple-filtered vs main — only stocked staple names filter, not restock ones
  const stockedStapleNames = staples.filter(s => s.status === "ok").map(s => s.name.toLowerCase());
  const allFilterNames = [...new Set([...stockedStapleNames, ...shopFilters])];
  const isFiltered = (text) => allFilterNames.some(s => normalizeIngredient(text).toLowerCase().includes(s));
  const mainItems = allDeduped.filter(item => item.source === "restock" || !isFiltered(item.text) || unfilteredIds.has(item.id));
  const filteredItems = allDeduped.filter(item => item.source !== "restock" && isFiltered(item.text) && !unfilteredIds.has(item.id));

  // Duplicate detection among main items
  const dupMap = findDuplicates(mainItems);

  const toggleItem = (item) => {
    if (item.done !== undefined) onToggleFreeShop(item.id);
    else onToggleShopChecked(item.id);
  };

  const unfilterItem = (item) => {
    setUnfilteredIds(prev => new Set([...prev, item.id]));
  };
  const refilterItem = (item) => {
    setUnfilteredIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
  };

  return (
    <div className="week-shop-section" onClick={() => popoverId && setPopoverId(null)}>
      {regulars.length > 0 && <>
        <div className="week-shop-group-label">Every week</div>
        <div className="week-shop-pills">
          {regulars.map(r => (
            <span key={r.id} className={"shop-pill" + (regChecked[r.id] ? " done" : "")}
              onClick={() => onToggleRegChecked(r.id)}>
              {r.name}
            </span>
          ))}
        </div>
      </>}
      {mainItems.length > 0 && <>
        <div className="week-shop-group-label">This week</div>
        <div className="week-shop-pills">
          {mainItems.map(item => {
            const isDup = dupMap.has(item.id);
            const isChecked = shopChecked[item.id] || item.done;
            const wasUnfiltered = unfilteredIds.has(item.id);
            return (
              <span key={item.id} style={{position:"relative"}}>
                <span className={"shop-pill" + (isDup ? " duplicate" : "") + (isChecked ? " done" : "")}
                  onClick={(e) => {
                    if (isDup && !isChecked) { e.stopPropagation(); setPopoverId(popoverId === item.id ? null : item.id); }
                    else toggleItem(item);
                  }}>
                  {item.text}
                  {wasUnfiltered && !isChecked && <button className="pill-refilter" onClick={e => { e.stopPropagation(); refilterItem(item); }}>↩</button>}
                </span>
                {popoverId === item.id && dupMap.get(item.id) && (
                  <span className="dup-popover" onClick={e => e.stopPropagation()}>
                    Also needed: {dupMap.get(item.id).map(d => d.text + " \u00b7 " + d.recipeName).join("; ")}
                    <br/><span style={{fontSize:10, color:"var(--ink4)"}}>Tap pill again to check off</span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </>}
      {filteredItems.length > 0 && (
        <details className="filtered-section">
          <summary className="filtered-summary">Filtered out ({filteredItems.length})</summary>
          <div className="filtered-note">These match common staples — check your pantry</div>
          <div className="week-shop-pills">
            {filteredItems.map(item => (
              <span key={item.id} className="shop-pill filtered" onClick={() => unfilterItem(item)}>
                {item.text}
              </span>
            ))}
          </div>
        </details>
      )}
      {regulars.length === 0 && mainItems.length === 0 && filteredItems.length === 0 && (
        <div className="week-shop-empty">Plan dinners to populate your list.</div>
      )}
      <div style={{display:"flex", gap:8, marginBottom:10}}>
        <input className="pantry-add-input" placeholder="Add item…" style={{fontSize:11}} value={freeInput}
          onChange={e => setFreeInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && freeInput.trim()) { onAddFreeShop(freeInput.trim()); setFreeInput(""); }}}/>
        <button className="pantry-add-btn" disabled={!freeInput.trim()} style={{fontSize:11, padding:"6px 10px"}}
          onClick={() => { if (freeInput.trim()) { onAddFreeShop(freeInput.trim()); setFreeInput(""); }}}>Add</button>
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ goals, week, recipes, onOpenShop, shopCount, fridge, freezer, staples, regulars, regChecked, shopChecked, freeShop, radar, customTags, customCategories,
  batch, prepTasks, prepChecked, onAddItem, onRemoveItem, onMoveItem, onClearDay, onAddNote, onAddRecipe, onUpdateRecipe, onDeleteRecipe, onWeekReset, onPromoteRadar,
  onAddBatch, onRemoveBatch, onAddPrepTask, onTogglePrepTask, onTogglePrepChecked,
  onToggleRegChecked, onToggleShopChecked, onAddFreeShop, onToggleFreeShop, onAdjustFreezerQty, shopFilters }) {
  const [shopOpen, setShopOpen]     = useState(true);
  const [prepOpen, setPrepOpen]     = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [promoteSheet, setPromoteSheet] = useState(null);
  const [newPrepText, setNewPrepText] = useState("");
  const [sheet, setSheet]           = useState(null);
  const [weekDetail, setWeekDetail] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);

  // ── Drag-and-drop state ──
  const [dragItem, setDragItem] = useState(null); // { id, fromDayIndex }
  const [dropTarget, setDropTarget] = useState(null); // dayIndex being hovered
  const [touchDrag, setTouchDrag] = useState(null); // { id, fromDayIndex, x, y, title }

  const handleDrop = (toDayIndex) => {
    if (dragItem && dragItem.fromDayIndex !== toDayIndex) {
      onMoveItem(dragItem.id, dragItem.fromDayIndex, toDayIndex);
    }
    setDragItem(null);
    setDropTarget(null);
  };

  // Touch drag: attach window-level listeners when touch drag is active
  useEffect(() => {
    if (!touchDrag) return;
    const handleTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      setTouchDrag(td => td ? { ...td, x: touch.clientX, y: touch.clientY } : null);
      // Detect which day-col is under the finger
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el) {
        const dayCol = el.closest('[data-day-index]');
        if (dayCol) {
          setDropTarget(parseInt(dayCol.dataset.dayIndex));
        } else {
          setDropTarget(null);
        }
      }
    };
    const handleTouchEnd = () => {
      if (touchDrag && dropTarget !== null && touchDrag.fromDayIndex !== dropTarget) {
        onMoveItem(touchDrag.id, touchDrag.fromDayIndex, dropTarget);
      }
      setTouchDrag(null);
      setDragItem(null);
      setDropTarget(null);
    };
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchDrag, dropTarget, onMoveItem]);

  // Derived: one prep item per planned recipe that has a prepNote
  const recipePrepItems = week.flatMap(d =>
    d.items.filter(it => it.recipe?.prepNote)
      .map(it => ({ key: d.day + ":" + it.id + ":" + it.recipe.id, task: it.recipe.prepNote, day: d.day, done: !!prepChecked[d.day + ":" + it.id + ":" + it.recipe.id] }))
  );

  // Derived: thaw tasks — freezer items whose name matches a planned recipe ingredient
  const freezerNames = (freezer || []).map(i => i.item.toLowerCase());
  const thawItems = week.flatMap(d =>
    d.items.filter(it => it.recipe?.ingredients?.length)
      .flatMap(it => it.recipe.ingredients
        .filter(ing => freezerNames.includes(ing.toLowerCase()))
        .map(ing => ({ key: "thaw:" + d.day + ":" + it.id + ":" + ing, ing, day: d.day, done: !!prepChecked["thaw:" + d.day + ":" + it.id + ":" + ing] }))
      )
  );

  const openSheet = (dayIndex) => setSheet({ dayIndex });
  const closeSheet = () => setSheet(null);

  const handleSlot = (dayIndex, recipe) => { onAddItem(dayIndex, recipe); };
  const handleRemoveItem = (itemId) => { onRemoveItem(itemId); };
  const handleAddNote = (dayIndex, note) => { onAddNote(dayIndex, note); };
  const handleAddRecipe = (recipe) => { onAddRecipe(recipe); };

  const handleAddBatch = (recipe) => { onAddBatch(recipe); };

  // Compute today index (0=Mon..6=Sun) and date numbers for each day
  const mondayDate = new Date(THIS_WEEK + 'T00:00:00');
  const todayStr = new Date().toISOString().slice(0, 10);
  const dayDates = DAY_NAMES.map((_, i) => {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + i);
    return d;
  });
  const todayIndex = dayDates.findIndex(d => d.toISOString().slice(0, 10) === todayStr);

  const allRecipeItems = week.flatMap(d => d.items.filter(it => it.itemType === 'recipe' && it.recipe));
  const fishCount  = allRecipeItems.filter(it => it.recipe.tags?.includes("fish")).length;
  const vegCount   = allRecipeItems.filter(it => it.recipe.tags?.includes("vegetarian")).length;
  const fishMet    = fishCount >= goals.fishMin;
  const vegMet     = vegCount  >= goals.vegMin;
  const allMet     = fishMet && vegMet;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">This <em>Week</em></div>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          {!confirmReset ? (
            <button className="shop-fab" style={{color:"var(--ink4)", fontSize:11, padding:"6px 12px"}}
              onClick={() => setConfirmReset(true)}>
              ↺ New week
            </button>
          ) : (
            <div style={{display:"flex", gap:6, alignItems:"center"}}>
              <span style={{fontSize:11, color:"var(--ink3)"}}>Clear everything?</span>
              <button className="shop-fab" style={{background:"var(--accent)", color:"#fff", borderColor:"var(--accent)", fontSize:11, padding:"6px 12px"}}
                onClick={() => {
                  const radarInWeek = [...new Map(
                    week.flatMap(d => d.items.filter(it => it.recipe && !it.recipe.inLibrary))
                        .map(it => [it.recipe.id, it.recipe])
                  ).values()];
                  if (radarInWeek.length > 0) {
                    setPromoteSheet(radarInWeek.map(r => ({ recipe: r, checked: true })));
                  } else {
                    onWeekReset();
                  }
                  setConfirmReset(false);
                }}>Yes</button>
              <button className="shop-fab" style={{fontSize:11, padding:"6px 12px"}}
                onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          )}
          <button className="shop-fab" onClick={onOpenShop}>
            🛒 List{shopCount > 0 && <span className="shop-count-badge">{shopCount}</span>}
          </button>
        </div>
      </div>

      <div className="goal-strip">
        <div className={"goal-item " + (fishMet ? "met" : "unmet")}>
          <div className="goal-dot"/> {fishCount}/{goals.fishMin} fish
        </div>
        <div className="goal-divider"/>
        <div className={"goal-item " + (vegMet ? "met" : "unmet")}>
          <div className="goal-dot"/> {vegCount}/{goals.vegMin} veg
        </div>
        {allMet && (<>
          <div className="goal-divider"/>
          <div className="goal-item met" style={{marginLeft:"auto"}}>
            <div className="goal-dot"/> ✓ goals met
          </div>
        </>)}
      </div>

      {(() => {
        if (!fridge) return null;
        const weekIngredients = week
          .flatMap(d => d.items.filter(it => it.recipe?.ingredients?.length))
          .flatMap(it => it.recipe.ingredients.map(i => i.toLowerCase()));
        const unaccounted = fridge.filter(i =>
          i.s === "soon" &&
          !weekIngredients.includes(i.item.toLowerCase())
        );
        if (!unaccounted.length) return null;
        return (
          <div className="use-soon-alert">
            <div className="use-soon-alert-icon">⚠️</div>
            <div className="use-soon-alert-body">
              <div className="use-soon-alert-title">Use soon — not in this week's recipes</div>
              <div className="use-soon-alert-items">{unaccounted.map(i => i.item).join(" · ")}</div>
            </div>
          </div>
        );
      })()}

      <div className="section-header" style={{cursor:"default", marginTop:4}}>
        <div className="section-header-title">This Week's <em>Dinners</em></div>
      </div>

      <div className="week-scroll-wrapper">
        <div className="week-scroll">
          {week.map((d, i) => {
            const isToday = i === todayIndex;
            return (
              <div key={i} className={"day-col" + (dropTarget === i ? " drop-target" : "")}
                data-day-index={i}
                onDragOver={e => { e.preventDefault(); setDropTarget(i); }}
                onDragLeave={() => { if (dropTarget === i) setDropTarget(null); }}
                onDrop={e => { e.preventDefault(); handleDrop(i); }}>
                <div className={"day-col-header" + (isToday ? " today" : "")}>
                  <span className="day-col-name">{d.day}</span>
                </div>
                {d.items.length === 0 && (
                  <div className="day-empty-card" onClick={() => openSheet(i)}>
                    <span>+ plan dinner</span>
                  </div>
                )}
                {d.items.map((item, idx) => (
                  <ItemCard key={item.id} item={item} isToday={isToday} isPrimary={idx === 0}
                    readyBy={goals.readyBy} onDetail={r => setWeekDetail({ recipe: r, itemId: item.id })}
                    onRemove={() => handleRemoveItem(item.id)}
                    isDragging={dragItem?.id === item.id}
                    onDragStart={() => setDragItem({ id: item.id, fromDayIndex: i })}
                    onDragEnd={() => { setDragItem(null); setDropTarget(null); }}
                    onTouchDragStart={(it) => setTouchDrag({ id: it.id, fromDayIndex: i, x: 0, y: 0, title: it.recipe?.title || it.note || '' })}
                  />
                ))}
                {d.items.length > 0 && (
                  <div className="day-add-card" onClick={() => openSheet(i)}>
                    <span>+</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="week-scroll-fade" />
      </div>

      {touchDrag && (
        <div className="drag-ghost" style={{
          left: touchDrag.x - 30, top: touchDrag.y - 20,
        }}>
          <div className="drag-ghost-inner">{touchDrag.title}</div>
        </div>
      )}

      <div className="section-header" style={{cursor:"default"}}>
        <div className="section-header-title">Weekend <em>Batch Cooking</em></div>
      </div>
      <div className="batch-section">
        <div className="batch-row">
          {batch.map(r => {
            if (!r) return null;
            const recipeLink = r.pdfUrl || r.url || null;
            return (
              <div key={r.id} className="batch-recipe-card" onClick={() => setBatchDetail(r)}>
                <button className="batch-card-remove" onClick={e => { e.stopPropagation(); onRemoveBatch(r.id); }}>×</button>
                <div className="batch-card-body">
                  <div className="batch-card-title">{r.title}</div>
                  {recipeLink ? (
                    <a className="batch-card-source linked" href={recipeLink} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}>
                      {r.source}<span className="source-arrow"> ↗</span>
                    </a>
                  ) : (
                    <div className="batch-card-source">{r.source}</div>
                  )}
                  <div className="batch-card-meta">
                    <span className="batch-card-time">{r.time}m</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="batch-add-card" onClick={() => setSheet({ dayIndex: -1, mode: 'batch' })}>
            <span className="batch-add-card-icon">＋</span>
            <span>Add batch recipe</span>
          </div>
        </div>
      </div>

      <div className="section-header" onClick={() => setPrepOpen(o => !o)}>
        <div className="section-header-title">Weekend <em>Prep</em></div>
        <span className={"section-header-chevron" + (prepOpen ? " open" : "")}>▼</span>
      </div>
      {prepOpen && <div className="prep-section">
        <div className="prep-list">
          {thawItems.map(p => (
            <div key={p.key} className="prep-item" style={{opacity: p.done ? 0.45 : 1}}>
              <input type="checkbox" checked={p.done} onChange={() => onTogglePrepChecked(p.key)}/>
              <span className="prep-item-text" style={{textDecoration: p.done ? "line-through" : "none"}}>
                Thaw {p.ing}
              </span>
              <span className="prep-recipe-tag" style={{background:"#eaf4fb", color:"#2a6a8a", borderColor:"#a8cfe0"}}>❄️ {p.day}</span>
            </div>
          ))}
          {recipePrepItems.map(p => (
            <div key={p.key} className="prep-item" style={{opacity: p.done ? 0.45 : 1}}>
              <input type="checkbox" checked={p.done} onChange={() => onTogglePrepChecked(p.key)}/>
              <span className="prep-item-text" style={{textDecoration: p.done ? "line-through" : "none"}}>{p.task}</span>
              <span className="prep-recipe-tag">For {p.day}</span>
            </div>
          ))}
          {prepTasks.map(p => (
            <div key={p.id} className="prep-item" style={{opacity: p.done ? 0.45 : 1}}>
              <input type="checkbox" checked={p.done} onChange={() => onTogglePrepTask(p.id)}/>
              <span className="prep-item-text" style={{textDecoration: p.done ? "line-through" : "none"}}>{p.task}</span>
              <span className="prep-recipe-tag" style={{opacity:0.4}}>custom</span>
            </div>
          ))}
          {thawItems.length === 0 && recipePrepItems.length === 0 && prepTasks.length === 0 && (
            <div style={{padding:"14px 0", color:"var(--ink4)", fontSize:12, fontStyle:"italic"}}>
              Prep tasks will appear here once dinners are planned.
            </div>
          )}
        </div>
        <div className="prep-add-row">
          <input
            className="prep-add-input"
            placeholder="Add a prep task…"
            value={newPrepText}
            onChange={e => setNewPrepText(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && newPrepText.trim()) {
                onAddPrepTask(newPrepText.trim());
                setNewPrepText("");
              }
            }}
          />
          <button
            className="prep-add-btn"
            disabled={!newPrepText.trim()}
            onClick={() => {
              if (newPrepText.trim()) {
                onAddPrepTask(newPrepText.trim());
                setNewPrepText("");
              }
            }}
          >Add</button>
        </div>
      </div>}

      <div className="section-header" onClick={() => setShopOpen(o => !o)}>
        <div className="section-header-title">Shopping <em>List</em></div>
        <span className={"section-header-chevron" + (shopOpen ? " open" : "")}>▼</span>
      </div>
      {shopOpen && (
        <WeekShoppingList
          week={week} staples={staples} freezer={freezer} fridge={fridge}
          regulars={regulars} regChecked={regChecked} onToggleRegChecked={onToggleRegChecked}
          shopChecked={shopChecked} onToggleShopChecked={onToggleShopChecked}
          freeShop={freeShop} onAddFreeShop={onAddFreeShop} onToggleFreeShop={onToggleFreeShop}
          shopFilters={shopFilters}
        />
      )}

      {promoteSheet && (
        <div className="sheet-overlay" onClick={() => setPromoteSheet(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle"/>
            <div className="sheet-header">
              <div className="sheet-title">Keep these recipes?</div>
            </div>
            <p style={{fontSize:13, color:"var(--ink3)", margin:"0 0 12px"}}>
              These radar items were in this week's plan. Save any to your library?
            </p>
            {promoteSheet.map((item, i) => (
              <label key={item.recipe.id} style={{display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid var(--border)", cursor:"pointer"}}>
                <input type="checkbox" checked={item.checked} onChange={() => {
                  setPromoteSheet(ps => ps.map((x, j) => j === i ? { ...x, checked: !x.checked } : x));
                }} />
                <span style={{flex:1}}>
                  <strong>{item.recipe.title}</strong>
                  {item.recipe.source && <span style={{fontSize:12, color:"var(--ink3)", marginLeft:6}}>{item.recipe.source}</span>}
                </span>
              </label>
            ))}
            <div style={{display:"flex", gap:8, marginTop:16, justifyContent:"flex-end"}}>
              <button className="shop-fab" style={{fontSize:12, padding:"8px 14px"}}
                onClick={() => { onWeekReset(); setPromoteSheet(null); }}>
                Just clear
              </button>
              <button className="shop-fab" style={{background:"var(--accent)", color:"#fff", borderColor:"var(--accent)", fontSize:12, padding:"8px 14px"}}
                onClick={() => {
                  promoteSheet.filter(x => x.checked).forEach(x => onPromoteRadar(x.recipe.id));
                  onWeekReset();
                  setPromoteSheet(null);
                }}>
                Save &amp; clear week
              </button>
            </div>
          </div>
        </div>
      )}
      {weekDetail?.recipe && (
        <div className="detail-fullscreen">
          <RecipeDetailView
            recipe={weekDetail.recipe}
            source="plan"
            itemId={weekDetail.itemId}
            onClose={() => setWeekDetail(null)}
            onSave={updated => {
              onUpdateRecipe(updated);
              setWeekDetail({ ...weekDetail, recipe: updated });
            }}
            onRemoveFromPlan={() => {
              onRemoveItem(weekDetail.itemId);
              setWeekDetail(null);
            }}
            customTags={customTags} customCategories={customCategories}
          />
        </div>
      )}
      {batchDetail && (
        <div className="sheet-overlay">
          <div className="detail-overlay-panel" onClick={e => e.stopPropagation()}>
            <RecipeDetailView
              recipe={batchDetail}
              source="library"
              onClose={() => setBatchDetail(null)}
              onSave={updated => {
                onUpdateRecipe(updated);
                setBatchDetail(updated);
              }}
              onDelete={id => {
                onDeleteRecipe(id);
                setBatchDetail(null);
              }}
              customTags={customTags} customCategories={customCategories}
            />
          </div>
        </div>
      )}
      {sheet !== null && sheet.mode !== 'batch' && (
        <PlanSheet
          targetDay={week[sheet.dayIndex]}
          dayIndex={sheet.dayIndex}
          week={week}
          recipes={recipes}
          radar={radar}
          onClose={closeSheet}
          onAddItem={handleSlot}
          onRemoveItem={handleRemoveItem}
          onClearDay={onClearDay}
          onAddNote={handleAddNote}
          onAddRecipe={handleAddRecipe}
          freezer={freezer}
          onAdjustFreezerQty={onAdjustFreezerQty}
          customTags={customTags}
          customCategories={customCategories}
        />
      )}
      {sheet !== null && sheet.mode === 'batch' && (
        <BatchSheet
          recipes={recipes}
          onClose={closeSheet}
          onAdd={handleAddBatch}
          onAddRecipe={onAddRecipe}
          customTags={customTags}
          customCategories={customCategories}
        />
      )}
    </div>
  );
}

// ── Recipes View ──────────────────────────────────────────────────────────────

function RadarDetailSheet({ item, onClose, onPromote, onPlan }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle"/>
        <div className="sheet-header">
          <div className="sheet-title"><em>{item.title}</em></div>
          {item.source && <div className="sheet-subtitle">{item.source}</div>}
        </div>
        <div className="sheet-body">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="detail-link">
              <span className="detail-link-icon">🔗</span>
              <div className="detail-link-text">
                <div className="detail-link-label">Open recipe</div>
                <div className="detail-link-url">{item.url}</div>
              </div>
              <span className="detail-link-arrow">›</span>
            </a>
          )}
          <div className="radar-sheet-actions" style={{marginTop: item.url ? 16 : 0}}>
            <button className="sheet-btn sheet-btn-primary" onClick={onPromote}>
              Add to recipe library
            </button>
            {onPlan && (
              <button className="sheet-btn" style={{background:"var(--surface2)", border:"1px solid var(--border)", color:"var(--ink2)"}} onClick={onPlan}>
                Plan for this week
              </button>
            )}
          </div>
        </div>
        <div className="sheet-footer">
          <button className="sheet-btn sheet-btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function RecipesView({ recipes, library, onAddRecipe, onUpdateRecipe, onDeleteRecipe, radar, onAddRadar, onRemoveRadar, onPromoteRadar, customTags = [], customCategories = [] }) {
  const [filter, setFilter]     = useState("all");
  const [detail, setDetail]     = useState(null);
  const [adding, setAdding]     = useState(false);
  const [radarDetail, setRadarDetail]     = useState(null);
  const [addingRadar, setAddingRadar]     = useState(false);
  const [radarTitle, setRadarTitle]   = useState("");
  const [radarUrl, setRadarUrl]       = useState("");
  const [radarSource, setRadarSource] = useState("");
  const [radarFetching, setRadarFetching] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [radarCollapsed, setRadarCollapsed] = useState(false);
  const toggleSection = key => setCollapsedSections(s => ({...s, [key]: !s[key]}));
  const filters = [{k:"all",l:"All"},{k:"fish",l:"🐟 Fish"},{k:"vegetarian",l:"🌿 Veg"}];
  const filtered = filter === "all" ? library : library.filter(r => r.tags?.includes(filter));

  const handleRadarUrlBlur = async () => {
    const trimmed = radarUrl.trim();
    if (!trimmed) return;
    setRadarFetching(true);
    const { scrapedData } = await fetchRecipeData(trimmed);
    if (scrapedData) {
      if (!radarTitle.trim() && scrapedData.title) setRadarTitle(scrapedData.title);
    }
    try { if (!radarSource.trim()) setRadarSource(new URL(trimmed).hostname.replace(/^www\./, '')); } catch {}
    setRadarFetching(false);
  };

  const handleAddRadar = () => {
    if (!radarTitle.trim() && !radarUrl.trim()) return;
    const fallbackTitle = radarTitle.trim() || (() => { try { return new URL(radarUrl.trim()).hostname.replace(/^www\./, ''); } catch { return radarUrl.trim(); } })();
    onAddRadar({ title: fallbackTitle, url: radarUrl.trim() || null, source: radarSource.trim() || "" });
    setRadarTitle(""); setRadarUrl(""); setRadarSource(""); setAddingRadar(false);
  };

  if (detail) return (
    <RecipeDetailView
      recipe={detail}
      source="library"
      onClose={() => setDetail(null)}
      onSave={updated => {
        onUpdateRecipe(updated);
        setDetail(updated);
      }}
      onDelete={id => {
        onDeleteRecipe(id);
        setDetail(null);
      }}
      customTags={customTags} customCategories={customCategories}
    />
  );

  return (
    <div className="tab-section">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:16}}>
        <div><div className="page-title">Recipes</div><div className="page-date">{library.length} saved</div></div>
      </div>

      {/* On the radar list */}
      <div className="radar-shelf">
        <div className="recipe-library-header" style={{marginTop:0, paddingTop:0, borderTop:"none", marginBottom: radarCollapsed ? 0 : 6, cursor:"pointer", userSelect:"none"}} onClick={() => setRadarCollapsed(c => !c)}>
          <div className="recipe-library-title">
            Try <em>Soon</em>
            <span style={{fontFamily:"'Lato',sans-serif", fontSize:10, color:"var(--ink4)", fontStyle:"normal", marginLeft:6, transition:"transform 0.2s", display:"inline-block", transform: radarCollapsed ? "rotate(-90deg)" : "rotate(0deg)"}}>▼</span>
          </div>
          {!addingRadar && !radarCollapsed && <button style={{fontSize:11, color:"var(--ink4)", background:"none", border:"none", cursor:"pointer", padding:0, fontFamily:"inherit"}} onClick={e => { e.stopPropagation(); setAddingRadar(true); }}>+ Add</button>}
        </div>
        {!radarCollapsed && radar.length > 0 && (
          <div className="radar-list">
            {radar.map(item => (
              <div key={item.id} className="radar-row">
                {item.url ? (
                  <a className="radar-row-title linked" href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                ) : (
                  <span className="radar-row-title">{item.title}</span>
                )}
                <button className="radar-row-promote" onClick={() => onPromoteRadar(item.id)} title="Add to library">+ library</button>
                <button className="radar-row-remove" onClick={() => onRemoveRadar(item.id)}>×</button>
              </div>
            ))}
          </div>
        )}
        {!radarCollapsed && radar.length === 0 && !addingRadar && (
          <div style={{fontSize:12, color:"var(--ink4)", fontStyle:"italic"}}>Nothing yet — add recipes you want to try.</div>
        )}
        {!radarCollapsed && addingRadar && (
          <div style={{marginTop:8, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap"}}>
            <input className="pantry-add-input" placeholder="Recipe name" value={radarTitle} autoFocus style={{flex:"2 1 140px"}}
              onChange={e => setRadarTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddRadar()}/>
            <input className="pantry-add-input" placeholder="URL (optional)" value={radarUrl} style={{flex:"3 1 180px"}}
              onChange={e => setRadarUrl(e.target.value)}
              onBlur={handleRadarUrlBlur}
              onKeyDown={e => e.key === "Enter" && handleAddRadar()}/>
            {radarFetching && <span style={{fontSize:11, color:"var(--ink4)", flexShrink:0}}>fetching…</span>}
            <button className="pantry-add-btn" disabled={(!radarTitle.trim() && !radarUrl.trim()) || radarFetching} onClick={handleAddRadar}>Add</button>
            <button className="sheet-btn sheet-btn-cancel" style={{padding:"6px 10px", fontSize:12}} onClick={() => { setAddingRadar(false); setRadarTitle(""); setRadarUrl(""); setRadarSource(""); }}>Cancel</button>
          </div>
        )}
      </div>


      <div className="recipe-library-header">
        <div className="recipe-library-title">Recipe <em>Library</em></div>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div className="filter-row" style={{margin:0, flex:"none"}}>
            {filters.map(f => <button key={f.k} className={"fpill"+(filter===f.k?" active":"")} onClick={() => setFilter(f.k)}>{f.l}</button>)}
          </div>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add</button>
        </div>
      </div>
      {(() => {
        const SECTIONS = [
          { key: "dinner",    label: "Dinner" },
          { key: "breakfast", label: "Breakfast & Snacks" },
          { key: "sweets",    label: "Sweets" },
          ...customCategories.map(c => ({ key: c, label: c })),
          { key: "",          label: "Uncategorized" },
        ];
        return SECTIONS.map(({ key, label }) => {
          const sectionKey = key || "uncat";
          const sectionRecipes = filtered.filter(r =>
            key === "" ? (!r.category || !["dinner","breakfast","sweets"].includes(r.category)) : r.category === key
          );
          if (!sectionRecipes.length) return null;
          const collapsed = collapsedSections[sectionKey];
          return (
            <div key={sectionKey}>
              <div className="recipe-section-label" onClick={() => toggleSection(sectionKey)}>
                <span style={{display:"flex", alignItems:"center", gap:8}}>
                  {label}
                  {!collapsed && <span className="recipe-section-count">{sectionRecipes.length}</span>}
                </span>
                <span style={{fontSize:9, color:"var(--ink4)", transition:"transform 0.2s", display:"inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)"}}>▼</span>
              </div>
              {!collapsed && (
                <div className="rlist">
                  {sectionRecipes.map(r => (
                    <div key={r.id} className="rcard" onClick={() => setDetail(r)}>
                      {r.thumbnailUrl
                        ? <img className="rcard-thumb" src={r.thumbnailUrl} alt="" />
                        : <div className="rcard-placeholder">🍽</div>}
                      <div className="rcard-body">
                        <div className="rl-title">{r.title}</div>
                        <div className="rl-meta">{r.source} · {r.time} min</div>
                        {r.tags?.length > 0 && <div className="rl-tags"><Tags tags={r.tags}/></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        });
      })()}
      {radarDetail && (
        <RadarDetailSheet
          item={radarDetail}
          onClose={() => setRadarDetail(null)}
          onPromote={() => { onPromoteRadar(radarDetail.id); setRadarDetail(null); }}
        />
      )}
      {adding && (
        <AddRecipeSheet
          onClose={() => setAdding(false)}
          onAdd={recipe => onAddRecipe(recipe)}
          customTags={customTags} customCategories={customCategories}
        />
      )}
    </div>
  );
}

// ── Inventory & Prefs ─────────────────────────────────────────────────────────

function InventoryView({ week, recipes, staples, onAddStaple, onCycleStaple, onRemoveStaple, regulars, onAddRegular, onRemoveRegular, fridge, onAddFridge, onCycleFridge, onRemoveFridge, freezer, onAddFreezer, onAdjustFreezerQty, onRemoveFreezer }) {
  const [stapleInput, setStapleInput]   = useState("");
  const [regularInput, setRegularInput] = useState("");
  const [fridgeInput,  setFridgeInput]  = useState("");
  const [freezerInput, setFreezerInput] = useState("");

  const removeReg  = id => onRemoveRegular(id);
  const addRegular = val => {
    const t = val.trim().toLowerCase();
    if (t && !regulars.find(r => r.name === t)) onAddRegular(t);
    setRegularInput("");
  };

  const cycleFridge  = id => onCycleFridge(id);
  const removeFridge = id => onRemoveFridge(id);
  const addFridge    = val => { const t=val.trim(); if(t) onAddFridge(t, "ok"); setFridgeInput(""); };

  const adjustFreezerQty = (id, delta) => onAdjustFreezerQty(id, delta);
  const removeFreezer = id => onRemoveFreezer(id);
  const addFreezer    = val => { const t=val.trim(); if(t) onAddFreezer(t, 1); setFreezerInput(""); };

  const cycleStaple = name => onCycleStaple(name);
  const addStaple = val => {
    const t = val.trim().toLowerCase();
    if (t && !staples.find(s => s.name === t)) onAddStaple(t);
    setStapleInput("");
  };
  const removeStaple = name => onRemoveStaple(name);

  return (
    <div className="tab-section">
      <div style={{marginBottom:14}}>
        <div className="page-title">Pantry</div>
        <div className="page-date">Regulars · fridge · freezer · staples</div>
      </div>

      {/* Weekly regulars */}
      <div className="pantry-section-label">Weekly regulars</div>
      <div className="inv-card" style={{marginBottom:10}}>
        <div className="pantry-pill-row">
          {regulars.map(r => (
            <span key={r.id} className="pantry-pill">
              {r.name}
              <button className="pp-remove" onClick={e => { e.stopPropagation(); removeReg(r.id); }}>×</button>
            </span>
          ))}
        </div>
        <div className="pantry-pill-add">
          <input className="pantry-add-input" placeholder="Add a weekly regular…" value={regularInput}
            onChange={e => setRegularInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addRegular(regularInput); }}/>
          <button className="pantry-add-btn" disabled={!regularInput.trim()} onClick={() => addRegular(regularInput)}>Add</button>
        </div>
      </div>

      {/* Fridge */}
      <div className="pantry-section-label">Fridge</div>
      <div className="inv-card" style={{marginBottom:10}}>
        <div className="pantry-pill-row">
          {fridge.map(i => (
            <span key={i.id} className={"pantry-pill fridge-" + i.s} onClick={() => cycleFridge(i.id)}>
              {i.item}
              <button className="pp-remove" onClick={e => { e.stopPropagation(); removeFridge(i.id); }}>×</button>
            </span>
          ))}
        </div>
        <div className="pantry-pill-add">
          <input className="pantry-add-input" placeholder="Add fridge item…" value={fridgeInput}
            onChange={e => setFridgeInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addFridge(fridgeInput); }}/>
          <button className="pantry-add-btn" disabled={!fridgeInput.trim()} onClick={() => addFridge(fridgeInput)}>Add</button>
        </div>
        <div style={{fontSize:10, color:"var(--ink4)", marginTop:6, fontStyle:"italic"}}>Tap to toggle good · use soon</div>
      </div>

      {/* Freezer */}
      <div className="pantry-section-label">Freezer</div>
      <div className="inv-card" style={{marginBottom:10}}>

        {freezer.map(i => (
          <div key={i.id} className="pantry-row">
            <span className="pantry-row-name">{i.item}</span>
            <div className="fz-stepper">
              <button className="fz-stepper-btn" onClick={() => adjustFreezerQty(i.id, -1)}>−</button>
              <span className="fz-stepper-val">{i.qty}</span>
              <button className="fz-stepper-btn" onClick={() => adjustFreezerQty(i.id, +1)}>+</button>
              <span className="fz-unit">lb</span>
            </div>
            <button className="pantry-row-remove" onClick={() => removeFreezer(i.id)}>×</button>
          </div>
        ))}
        <div className="pantry-add-row">
          <input className="pantry-add-input" placeholder="Add freezer item…" value={freezerInput}
            onChange={e => setFreezerInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addFreezer(freezerInput); }}/>
          <button className="pantry-add-btn" disabled={!freezerInput.trim()} onClick={() => addFreezer(freezerInput)}>Add</button>
        </div>
      </div>

      {/* Staples */}
      <div className="pantry-section-label">Staples</div>
      <div className="inv-card">
        <div className="pantry-pill-row">
          {staples.map(s => (
            <span key={s.name} className={"pantry-pill" + (s.status === "restock" ? " fridge-soon" : " fridge-ok")}
              onClick={() => cycleStaple(s.name)}>
              {s.name}
              <button className="pp-remove" onClick={e => { e.stopPropagation(); removeStaple(s.name); }}>×</button>
            </span>
          ))}
        </div>
        <div className="pantry-pill-add">
          <input className="pantry-add-input" placeholder="Add a staple…" value={stapleInput}
            onChange={e => setStapleInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addStaple(stapleInput); }}/>
          <button className="pantry-add-btn" disabled={!stapleInput.trim()} onClick={() => addStaple(stapleInput)}>Add</button>
        </div>
        <div style={{fontSize:10, color:"var(--ink4)", marginTop:6, fontStyle:"italic"}}>Tap to toggle stocked · needs restock</div>
      </div>
    </div>
  );
}

function PrefsView({ goals, updateGoal, customTags, onAddCustomTag, onRemoveCustomTag, customCategories, onAddCustomCategory, onRemoveCustomCategory, shopFilters, onAddShopFilter, onRemoveShopFilter, recipes, setRecipes }) {
  const [newTag, setNewTag]       = useState("");
  const [newCat, setNewCat]       = useState("");
  const [newFilter, setNewFilter] = useState("");
  const [thumbMsg, setThumbMsg]   = useState(null);
  const [thumbBusy, setThumbBusy] = useState(false);

  const handleFetchThumbnails = async () => {
    const missing = recipes.filter(r => r.url && !r.thumbnailUrl);
    if (!missing.length) {
      setThumbMsg("All thumbnails up to date");
      setTimeout(() => setThumbMsg(null), 2000);
      return;
    }
    setThumbBusy(true);
    setThumbMsg(`Fetching ${missing.length} thumbnail${missing.length > 1 ? "s" : ""}…`);
    let remaining = missing.length;
    await Promise.all(missing.map(async (r) => {
      const { thumbnailUrl: thumb } = await fetchRecipeData(r.url);
      if (thumb) {
        const updated = { ...r, thumbnailUrl: thumb };
        setRecipes(prev => prev.map(p => p.id === r.id ? updated : p));
        dbUpdateRecipe(r.id, updated);
      }
      remaining--;
      if (remaining > 0) setThumbMsg(`Fetching ${remaining} thumbnail${remaining > 1 ? "s" : ""}…`);
    }));
    setThumbBusy(false);
    setThumbMsg("Done");
    setTimeout(() => setThumbMsg(null), 2000);
  };

  return (
    <div className="tab-section">
      <div style={{marginBottom:18}}>
        <div className="page-title">Preferences</div>
        <div className="page-date">Weekly goals & reminders</div>
      </div>

      <div style={{fontFamily:"'Playfair Display',serif", fontSize:13, fontStyle:"italic", color:"var(--ink3)", marginBottom:10}}>
        Tracked automatically
      </div>
      <div className="pref-card" style={{marginBottom:16}}>
        <div className="pref-item">
          <span className="pi-icon">🐟</span>
          <span className="pi-text">Fish dinners per week</span>
          <div className="pi-stepper">
            <button className="pi-stepper-btn" disabled={goals.fishMin <= 0} onClick={() => updateGoal("fishMin", -1)}>−</button>
            <div className="pi-stepper-val">{goals.fishMin}</div>
            <button className="pi-stepper-btn" disabled={goals.fishMin >= 7} onClick={() => updateGoal("fishMin", +1)}>+</button>
          </div>
        </div>
        <div className="pref-item">
          <span className="pi-icon">🌿</span>
          <span className="pi-text">Vegetarian dinners per week</span>
          <div className="pi-stepper">
            <button className="pi-stepper-btn" disabled={goals.vegMin <= 0} onClick={() => updateGoal("vegMin", -1)}>−</button>
            <div className="pi-stepper-val">{goals.vegMin}</div>
            <button className="pi-stepper-btn" disabled={goals.vegMin >= 7} onClick={() => updateGoal("vegMin", +1)}>+</button>
          </div>
        </div>
      </div>

      <div style={{fontFamily:"'Playfair Display',serif", fontSize:13, fontStyle:"italic", color:"var(--ink3)", marginBottom:10}}>
        Timing
      </div>
      <div className="pref-card">
        <div className="pref-item">
          <span className="pi-icon">⏱</span>
          <span className="pi-text">Dinner ready by</span>
          <div className="pi-stepper">
            <button className="pi-stepper-btn" onClick={() => updateGoal("readyBy", -15)}>−</button>
            <div className="pi-stepper-val" style={{width:42, fontSize:12}}>{formatReadyBy(goals.readyBy)}</div>
            <button className="pi-stepper-btn" onClick={() => updateGoal("readyBy", +15)}>+</button>
          </div>
        </div>
      </div>

      <div className="pantry-section-label" style={{marginTop:24}}>Tags</div>
      <div className="inv-card" style={{marginBottom:12}}>
        <div className="pantry-pill-row" style={{marginBottom: customTags.length ? 8 : 0}}>
          {["fish","vegetarian"].map(t => (
            <span key={t} className="pantry-pill" style={{opacity:0.5, cursor:"default"}}>
              {t === "fish" ? "🐟 Fish" : "🌿 Veg"}
            </span>
          ))}
          {customTags.map(t => (
            <span key={t} className="pantry-pill">
              {t}
              <button className="pp-remove" onClick={() => onRemoveCustomTag(t)}>×</button>
            </span>
          ))}
        </div>
        <div className="pantry-pill-add">
          <input className="pantry-add-input" placeholder="Add a tag…" value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newTag.trim() && !["fish","vegetarian",...customTags].includes(newTag.trim().toLowerCase())) { onAddCustomTag(newTag.trim().toLowerCase()); setNewTag(""); }}}/>
          <button className="pantry-add-btn" disabled={!newTag.trim()}
            onClick={() => { const t = newTag.trim().toLowerCase(); if (t && !["fish","vegetarian",...customTags].includes(t)) { onAddCustomTag(t); setNewTag(""); }}}>Add</button>
        </div>
      </div>

      <div className="pantry-section-label">Categories</div>
      <div className="inv-card">
        <div className="pantry-pill-row" style={{marginBottom: customCategories.length ? 8 : 0}}>
          {[["dinner","Dinner"],["breakfast","Breakfast & Snacks"],["sweets","Sweets"]].map(([k,l]) => (
            <span key={k} className="pantry-pill" style={{opacity:0.5, cursor:"default"}}>{l}</span>
          ))}
          {customCategories.map(c => (
            <span key={c} className="pantry-pill">
              {c}
              <button className="pp-remove" onClick={() => onRemoveCustomCategory(c)}>×</button>
            </span>
          ))}
        </div>
        <div className="pantry-pill-add">
          <input className="pantry-add-input" placeholder="Add a category…" value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => { const builtins = ["dinner","breakfast","sweets"]; if (e.key === "Enter" && newCat.trim() && !builtins.includes(newCat.trim().toLowerCase()) && !customCategories.includes(newCat.trim())) { onAddCustomCategory(newCat.trim()); setNewCat(""); }}}/>
          <button className="pantry-add-btn" disabled={!newCat.trim()}
            onClick={() => { const builtins = ["dinner","breakfast","sweets"]; const c = newCat.trim(); if (c && !builtins.includes(c.toLowerCase()) && !customCategories.includes(c)) { onAddCustomCategory(c); setNewCat(""); }}}>Add</button>
        </div>
      </div>

      <div className="pantry-section-label" style={{marginTop:24}}>Extra Shopping Filters</div>
      <div style={{fontSize:11, color:"var(--ink4)", fontStyle:"italic", marginBottom:6}}>Pantry staples are always filtered — add more here</div>
      <div className="inv-card" style={{marginBottom:12}}>
        <div className="pantry-pill-row" style={{marginBottom: shopFilters.length ? 8 : 0}}>
          {shopFilters.map(f => (
            <span key={f} className="pantry-pill">
              {f}
              <button className="pp-remove" onClick={() => onRemoveShopFilter(f)}>×</button>
            </span>
          ))}
        </div>
        <div className="pantry-pill-add">
          <input className="pantry-add-input" placeholder="Add a filter…" value={newFilter}
            onChange={e => setNewFilter(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && newFilter.trim() && !shopFilters.includes(newFilter.trim().toLowerCase())) { onAddShopFilter(newFilter.trim()); setNewFilter(""); }}}/>
          <button className="pantry-add-btn" disabled={!newFilter.trim()}
            onClick={() => { const f = newFilter.trim().toLowerCase(); if (f && !shopFilters.includes(f)) { onAddShopFilter(f); setNewFilter(""); }}}>Add</button>
        </div>
      </div>

      <div className="pantry-section-label" style={{marginTop:24}}>Thumbnails</div>
      <div className="inv-card" style={{padding:"12px 14px", display:"flex", alignItems:"center", gap:10}}>
        <button className="btn btn-primary" style={{fontSize:12, padding:"8px 14px"}} disabled={thumbBusy} onClick={handleFetchThumbnails}>
          Fetch missing thumbnails
        </button>
        {thumbMsg && <span style={{fontSize:12, color:"var(--ink3)"}}>{thumbMsg}</span>}
      </div>
    </div>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────

const TABS = [
  {id:"week",    icon:"📅", label:"Week"},
  {id:"recipes", icon:"📖", label:"Recipes"},
  {id:"pantry",  icon:"🥬", label:"Pantry"},
  {id:"prefs",   icon:"⚙️", label:"Prefs"},
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab_]      = useState(() => localStorage.getItem("mp-tab") || "week");
  const setTab = t => { setTab_(t); localStorage.setItem("mp-tab", t); };
  const [goals, setGoals]     = useState({ fishMin: 1, vegMin: 2, readyBy: "18:30" });
  const [week, setWeek]       = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [staples, setStaples] = useState([]);
  const [regulars, setRegulars] = useState([]);
  const [regChecked, setRegChecked]   = useState({});
  const [shopChecked, setShopChecked] = useState({});
  const [freeShop, setFreeShop]       = useState([]);
  const [shopSheetOpen, setShopSheetOpen] = useState(false);
  const [fridge, setFridge] = useState([]);
  const [customTags, setCustomTags]             = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [shopFilters, setShopFilters]           = useState([]);
  const [freezer, setFreezer] = useState([]);
  const [batch, setBatch]     = useState([]);
  const [prepTasks, setPrepTasks]     = useState([]);
  const [prepChecked, setPrepChecked] = useState({});

  // ── Pull-to-refresh ──
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(null);
  const pullActive = useRef(false);
  const contentRef = useRef(null);
  const PULL_THRESHOLD = 60;

  const handlePullStart = (e) => {
    if (refreshing) return;
    const el = contentRef.current;
    if (el && el.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
      pullActive.current = false;
    }
  };
  const refreshingRef = useRef(false);
  refreshingRef.current = refreshing;
  const pullDistanceRef = useRef(0);
  const handlePullMove = (e) => {
    if (refreshingRef.current || pullStartY.current === null) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy > 0) {
      pullActive.current = true;
      const d = Math.min(dy * 0.4, 80);
      pullDistanceRef.current = d;
      setPullDistance(d);
      if (dy > 10) e.preventDefault();
    } else if (!pullActive.current) {
      pullStartY.current = null;
    }
  };
  const handlePullEnd = async () => {
    if (pullStartY.current === null) return;
    pullStartY.current = null;
    if (refreshingRef.current) return;
    if (pullDistanceRef.current >= PULL_THRESHOLD) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.6);
      try { await loadAllData(); } catch (e) { console.error('refresh failed', e); }
      setRefreshing(false);
    }
    setPullDistance(0);
    pullDistanceRef.current = 0;
  };

  // Register touchmove with { passive: false } so preventDefault works on iOS
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.addEventListener('touchmove', handlePullMove, { passive: false });
    return () => el.removeEventListener('touchmove', handlePullMove);
  });

  // ── Load all data from Supabase ──
  const loadAllData = async () => {
    const [recipesData, batchData, fridgeData, freezerData,
           staplesData, regularsData, prefsData, customTagsData, customCatsData,
           shopCheckedData, regCheckedData, freeShopData, prepTasksData, prepCheckedData,
           shopFiltersData] = await Promise.all([
      fetchRecipes(),
      fetchBatchPrep(),
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
      fetchShopFilters(),
    ]);
    setRecipes(recipesData.map(toAppRecipe));
    await migrateWeekPlanToItems(THIS_WEEK);
    const weekData = await fetchWeekPlanItems(THIS_WEEK);
    setWeek(weekData);
    setBatch(batchData);
    setFridge(fridgeData);
    setFreezer(freezerData);
    setStaples(staplesData);
    setRegulars(regularsData);
    setGoals(prefsData);
    setCustomTags(customTagsData);
    setCustomCategories(customCatsData);
    setShopChecked(shopCheckedData);
    setRegChecked(regCheckedData);
    setFreeShop(freeShopData);
    setPrepTasks(prepTasksData);
    setPrepChecked(prepCheckedData);
    setShopFilters(shopFiltersData);
  };

  useEffect(() => {
    async function loadAll() {
      try { await loadAllData(); } catch (e) { console.error('loadAll failed', e); }
      setLoading(false);
    }
    loadAll();

    // Realtime — sync week plan, batch, and shopping across devices
    const weekSub = supabase
      .channel('week_plan_items')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'week_plan_items' }, () => {
        fetchWeekPlanItems(THIS_WEEK).then(setWeek);
      })
      .subscribe();
    const batchSub = supabase
      .channel('batch_prep')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batch_prep' }, () => {
        fetchBatchPrep().then(setBatch);
      })
      .subscribe();
    const shopSub = supabase
      .channel('shop_checked')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_checked' }, () => {
        fetchShopChecked().then(setShopChecked);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(weekSub);
      supabase.removeChannel(batchSub);
      supabase.removeChannel(shopSub);
    };
  }, []);

  // ── Recipe handlers ──
  const handleAddRecipe = async (recipe) => {
    try {
      const saved = await dbAddRecipe(recipe);
      setRecipes(rs => [...rs, toAppRecipe(saved)]);
    } catch (e) { console.error(e); }
  };
  const handleUpdateRecipe = async (recipe) => {
    setRecipes(rs => rs.map(r => r.id === recipe.id ? recipe : r));
    try { await dbUpdateRecipe(recipe.id, recipe); } catch (e) { console.error(e); }
  };
  const handleDeleteRecipe = async (id) => {
    setRecipes(rs => rs.filter(r => r.id !== id));
    try { await dbDeleteRecipe(id); } catch (e) { console.error(e); }
  };

  // ── Derived: split recipes into library and radar ──
  const library = recipes.filter(r => r.inLibrary);
  const radar = recipes.filter(r => !r.inLibrary);

  // ── Week handlers (multi-item) ──
  const handleAddItem = async (dayIndex, recipe) => {
    const currentItems = week[dayIndex]?.items || [];
    const sortOrder = currentItems.length;
    if (recipe._needsInsert) {
      try {
        const saved = await dbAddRecipe(recipe);
        const appRecipe = toAppRecipe(saved);
        setRecipes(rs => [...rs, appRecipe]);
        const savedItem = await addWeekPlanItem(THIS_WEEK, dayIndex, {
          itemType: 'recipe', recipeId: appRecipe.id,
          ingredients: appRecipe.ingredients, cookTime: appRecipe.time,
          thumbnailUrl: appRecipe.thumbnailUrl, sortOrder,
        });
        setWeek(w => w.map((d, i) => i === dayIndex ? { ...d, items: [...d.items, savedItem] } : d));
      } catch (e) { console.error(e); }
    } else {
      const tempId = 'temp-' + Date.now();
      const tempItem = { id: tempId, itemType: 'recipe', recipe, ingredients: recipe.ingredients || [], cookTime: recipe.time, thumbnailUrl: recipe.thumbnailUrl, note: null, sortOrder };
      setWeek(w => w.map((d, i) => i === dayIndex ? { ...d, items: [...d.items, tempItem] } : d));
      try {
        const savedItem = await addWeekPlanItem(THIS_WEEK, dayIndex, {
          itemType: 'recipe', recipeId: recipe.id,
          ingredients: recipe.ingredients, cookTime: recipe.time,
          thumbnailUrl: recipe.thumbnailUrl, sortOrder,
        });
        setWeek(w => w.map((d, i) => i === dayIndex ? { ...d, items: d.items.map(it => it.id === tempId ? savedItem : it) } : d));
      } catch (e) { console.error(e); }
    }
  };
  const handleAddNote = async (dayIndex, text) => {
    const currentItems = week[dayIndex]?.items || [];
    const sortOrder = currentItems.length;
    const tempId = 'temp-' + Date.now();
    const tempItem = { id: tempId, itemType: 'note', recipe: null, ingredients: [], cookTime: null, thumbnailUrl: null, note: text.trim(), sortOrder };
    setWeek(w => w.map((d, i) => i === dayIndex ? { ...d, items: [...d.items, tempItem] } : d));
    try {
      const savedItem = await addWeekPlanItem(THIS_WEEK, dayIndex, { itemType: 'note', note: text.trim(), sortOrder });
      setWeek(w => w.map((d, i) => i === dayIndex ? { ...d, items: d.items.map(it => it.id === tempId ? savedItem : it) } : d));
    } catch (e) { console.error(e); }
  };
  // Keep week in sync when recipes state updates (e.g. after background scrape)
  useEffect(() => {
    setWeek(w => w.map(d => ({
      ...d,
      items: d.items.map(item => {
        if (!item.recipe) return item;
        const latest = recipes.find(r => r.id === item.recipe.id);
        return (latest && latest !== item.recipe) ? { ...item, recipe: latest } : item;
      })
    })));
  }, [recipes]);
  const handleRemoveItem = async (itemId) => {
    setWeek(w => w.map(d => ({ ...d, items: d.items.filter(it => it.id !== itemId) })));
    try { await removeWeekPlanItem(itemId); } catch (e) { console.error(e); }
  };
  const handleMoveItem = async (itemId, fromDayIndex, toDayIndex) => {
    if (fromDayIndex === toDayIndex) return;
    const fromDay = week[fromDayIndex];
    const item = fromDay?.items.find(it => it.id === itemId);
    if (!item) return;
    const newSortOrder = week[toDayIndex].items.length;
    setWeek(w => w.map((d, i) => {
      if (i === fromDayIndex) return { ...d, items: d.items.filter(it => it.id !== itemId) };
      if (i === toDayIndex) return { ...d, items: [...d.items, { ...item, sortOrder: newSortOrder }] };
      return d;
    }));
    try { await moveWeekPlanItem(itemId, toDayIndex, newSortOrder); } catch (e) { console.error(e); }
  };
  const handleClearDay = async (dayIndex) => {
    setWeek(w => w.map((d, i) => i === dayIndex ? { ...d, items: [] } : d));
    try { await clearDayItems(THIS_WEEK, dayIndex); } catch (e) { console.error(e); }
  };
  const handleWeekReset = async () => {
    setWeek(DAY_NAMES.map(day => ({ day, items: [] })));
    setBatch([]);
    setRegChecked({});
    try { await clearWeekPlanItems(THIS_WEEK); await clearBatchPrep(THIS_WEEK); } catch (e) { console.error(e); }
  };

  // ── Batch handlers ──
  const handleAddBatch = async (recipe) => {
    if (recipe._needsInsert) {
      try {
        const saved = await dbAddRecipe(recipe);
        const appRecipe = toAppRecipe(saved);
        setRecipes(rs => [...rs, appRecipe]);
        setBatch(b => [...b, appRecipe]);
        await addBatchItem(THIS_WEEK, appRecipe.id);
      } catch (e) { console.error(e); }
    } else {
      setBatch(b => [...b, recipe]);
      try { await addBatchItem(THIS_WEEK, recipe.id); } catch (e) { console.error(e); }
    }
  };
  const handleRemoveBatch = async (recipeId) => {
    setBatch(b => b.filter(r => r.id !== recipeId));
    try { await removeBatchItem(THIS_WEEK, recipeId); } catch (e) { console.error(e); }
  };

  // ── Radar handlers (backed by recipes table with inLibrary=false) ──
  const handleAddRadar = async (item) => {
    try {
      const saved = await dbAddRadarItem(item);
      setRecipes(rs => [saved, ...rs]);
      // Background scrape if URL provided
      if (saved.url) {
        fetchRecipeData(saved.url).then(({ thumbnailUrl, scrapedData }) => {
          if (!thumbnailUrl && !scrapedData) return;
          const updates = { ...saved };
          if (thumbnailUrl) updates.thumbnailUrl = thumbnailUrl;
          if (scrapedData) {
            if (scrapedData.title) updates.title = scrapedData.title;
            if (scrapedData.cookTime) updates.time = scrapedData.cookTime;
            if (scrapedData.ingredients?.length) {
              updates.ingredients = scrapedData.ingredients;
              updates.rawIngredients = scrapedData.ingredients;
            }
            if (scrapedData.instructions?.length) updates.instructions = scrapedData.instructions;
            if (scrapedData.description) updates.description = scrapedData.description;
            if (scrapedData.servings) updates.servings = scrapedData.servings;
          }
          setRecipes(rs => rs.map(r => r.id === saved.id ? updates : r));
          // Also update any week items referencing this recipe
          setWeek(w => w.map(d => ({
            ...d,
            items: d.items.map(it => it.recipe?.id === saved.id ? { ...it, recipe: updates } : it)
          })));
          dbUpdateRecipe(saved.id, updates);
        }).catch(e => console.error('radar scrape failed', e));
      }
    } catch (e) { console.error(e); }
  };
  const handleRemoveRadar = async (id) => {
    setRecipes(rs => rs.filter(r => r.id !== id));
    try { await dbDeleteRecipe(id); } catch (e) { console.error(e); }
  };
  const handlePromoteRadar = async (id) => {
    setRecipes(rs => rs.map(r => r.id === id ? { ...r, inLibrary: true } : r));
    try { await dbPromoteToLibrary(id); } catch (e) { console.error(e); }
  };

  // ── Prefs handler ──
  const updateGoal = (key, delta) => setGoals(g => {
    let next;
    if (key === "readyBy") {
      const mins = toMins(g.readyBy) + delta;
      const clamped = Math.max(16*60, Math.min(21*60, mins));
      next = { ...g, readyBy: toTime(clamped) };
    } else {
      next = { ...g, [key]: Math.max(0, Math.min(7, g[key] + delta)) };
    }
    dbUpdatePrefs(next);
    return next;
  });

  // ── Fridge handlers ──
  const handleAddFridge = async (itemName, status) => {
    try {
      const saved = await dbAddFridgeItem(itemName, status);
      setFridge(ff => [...ff, saved]);
    } catch (e) { console.error(e); }
  };
  const handleCycleFridge = async (id) => {
    let newStatus;
    setFridge(ff => ff.map(i => {
      if (i.id === id) { newStatus = i.s === "ok" ? "soon" : "ok"; return {...i, s: newStatus}; }
      return i;
    }));
    try { await dbUpdateFridgeItem(id, { s: newStatus }); } catch (e) { console.error(e); }
  };
  const handleRemoveFridge = async (id) => {
    setFridge(ff => ff.filter(i => i.id !== id));
    try { await dbRemoveFridgeItem(id); } catch (e) { console.error(e); }
  };

  // ── Freezer handlers ──
  const handleAddFreezer = async (itemName, qty) => {
    try {
      const saved = await dbAddFreezerItem(itemName, qty);
      setFreezer(ff => [...ff, saved]);
    } catch (e) { console.error(e); }
  };
  const handleAdjustFreezerQty = async (id, delta) => {
    let newQty;
    setFreezer(ff => ff
      .map(i => { if (i.id === id) { newQty = Math.max(0, (i.qty ?? 1) + delta); return {...i, qty: newQty}; } return i; })
      .filter(i => i.qty > 0)
    );
    try {
      if (newQty === 0) await dbRemoveFreezerItem(id);
      else await dbUpdateFreezerItem(id, { qty: newQty });
    } catch (e) { console.error(e); }
  };
  const handleRemoveFreezer = async (id) => {
    setFreezer(ff => ff.filter(i => i.id !== id));
    try { await dbRemoveFreezerItem(id); } catch (e) { console.error(e); }
  };

  // ── Staples handlers ──
  const handleAddStaple = async (name) => {
    setStaples(ss => [...ss, { name, status: "ok" }]);
    try { await dbAddStaple(name); } catch (e) { console.error(e); }
  };
  const handleCycleStaple = async (name) => {
    let newStatus;
    setStaples(ss => ss.map(s => {
      if (s.name === name) { newStatus = s.status === "ok" ? "restock" : "ok"; return {...s, status: newStatus}; }
      return s;
    }));
    try { await dbUpdateStaple(name, newStatus); } catch (e) { console.error(e); }
  };
  const handleRemoveStaple = async (name) => {
    setStaples(ss => ss.filter(s => s.name !== name));
    try { await dbRemoveStaple(name); } catch (e) { console.error(e); }
  };

  // ── Regulars handlers ──
  const handleAddRegular = async (name) => {
    try {
      const saved = await dbAddRegular(name);
      setRegulars(rr => [...rr, saved]);
    } catch (e) { console.error(e); }
  };
  const handleRemoveRegular = async (id) => {
    setRegulars(rr => rr.filter(r => r.id !== id));
    try { await dbRemoveRegular(id); } catch (e) { console.error(e); }
  };

  // ── Custom tags/categories handlers ──
  const handleAddCustomTag = async (name) => {
    setCustomTags(t => [...t, name]);
    try { await dbAddCustomTag(name); } catch (e) { console.error(e); }
  };
  const handleRemoveCustomTag = async (name) => {
    setCustomTags(t => t.filter(x => x !== name));
    try { await dbRemoveCustomTag(name); } catch (e) { console.error(e); }
  };
  const handleAddCustomCategory = async (name) => {
    setCustomCategories(c => [...c, name]);
    try { await dbAddCustomCategory(name); } catch (e) { console.error(e); }
  };
  const handleRemoveCustomCategory = async (name) => {
    setCustomCategories(c => c.filter(x => x !== name));
    try { await dbRemoveCustomCategory(name); } catch (e) { console.error(e); }
  };

  // ── Shop filter handlers ──
  const handleAddShopFilter = async (name) => {
    const n = name.toLowerCase().trim();
    if (!n || shopFilters.includes(n)) return;
    setShopFilters(f => [...f, n]);
    try { await dbAddShopFilter(n); } catch (e) { console.error(e); }
  };
  const handleRemoveShopFilter = async (name) => {
    setShopFilters(f => f.filter(x => x !== name));
    try { await dbRemoveShopFilter(name); } catch (e) { console.error(e); }
  };

  // ── Shopping checked handlers ──
  const handleToggleShopChecked = async (key) => {
    const wasChecked = shopChecked[key];
    setShopChecked(c => wasChecked
      ? Object.fromEntries(Object.entries(c).filter(([k]) => k !== key))
      : {...c, [key]: true});
    try { await dbToggleShopChecked(THIS_WEEK, key, !wasChecked); } catch (e) { console.error(e); }
  };
  const handleToggleRegChecked = async (key) => {
    const wasChecked = regChecked[key];
    setRegChecked(c => wasChecked
      ? Object.fromEntries(Object.entries(c).filter(([k]) => k !== key))
      : {...c, [key]: true});
    try { await dbToggleRegChecked(THIS_WEEK, key, !wasChecked); } catch (e) { console.error(e); }
  };

  // ── Free shop handlers ──
  const handleAddFreeShop = async (text) => {
    try {
      const saved = await dbAddFreeShopItem(text);
      setFreeShop(f => [...f, saved]);
    } catch (e) { console.error(e); }
  };
  const handleToggleFreeShop = async (id) => {
    let newDone;
    setFreeShop(f => f.map(i => { if (i.id === id) { newDone = !i.done; return {...i, done: newDone}; } return i; }));
    try { await dbUpdateFreeShopItem(id, { done: newDone }); } catch (e) { console.error(e); }
  };

  // ── Prep tasks handlers ──
  const handleAddPrepTask = async (task) => {
    try {
      const saved = await dbAddPrepTask(THIS_WEEK, task);
      setPrepTasks(p => [...p, saved]);
    } catch (e) { console.error(e); }
  };
  const handleTogglePrepTask = async (id) => {
    let newDone;
    setPrepTasks(p => p.map(i => { if (i.id === id) { newDone = !i.done; return {...i, done: newDone}; } return i; }));
    try { await dbUpdatePrepTask(id, { done: newDone }); } catch (e) { console.error(e); }
  };

  // ── Prep checked handlers ──
  const handleTogglePrepChecked = async (key) => {
    const wasChecked = prepChecked[key];
    setPrepChecked(c => wasChecked
      ? Object.fromEntries(Object.entries(c).filter(([k]) => k !== key))
      : {...c, [key]: true});
    try { await dbTogglePrepChecked(THIS_WEEK, key, !wasChecked); } catch (e) { console.error(e); }
  };

  // ── Loading screen ──
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',
      height:'100vh',fontFamily:'Playfair Display,serif',fontSize:18,color:'var(--ink3)'}}>
      Loading…
    </div>
  );

  // Compute total unchecked for badge — exclude stapled and freezer-covered items
  const okStapleNames    = staples.filter(s => s.status === "ok").map(s => s.name.toLowerCase());
  const freezerItemNames = freezer.map(i => i.item.toLowerCase());
  const fridgeItemNames  = fridge.map(i => i.item.toLowerCase());
  const recipeIngCount = week.flatMap(d => d.items.filter(it => it.recipe?.ingredients?.length))
    .flatMap(it => it.recipe.ingredients)
    .filter(ing => !okStapleNames.includes(ing.toLowerCase())
                && !freezerItemNames.includes(ing.toLowerCase())
                && !fridgeItemNames.includes(ing.toLowerCase()));
  const stapleNeedCount = staples.filter(s => s.status === "restock").length;
  const regsLeft = regulars.filter(r => !regChecked[r.id]).length;
  const totalUnchecked = regsLeft + [...new Set(recipeIngCount)].filter(i => !shopChecked["Mon:"+i] && !shopChecked["Tue:"+i]).length + stapleNeedCount + freeShop.filter(f => !f.done).length;

  const views = {
    week:    <WeekView goals={goals} week={week} recipes={library} onOpenShop={() => setShopSheetOpen(true)} shopCount={regsLeft + stapleNeedCount} fridge={fridge} freezer={freezer} staples={staples} regulars={regulars} regChecked={regChecked} shopChecked={shopChecked} freeShop={freeShop} radar={radar} customTags={customTags} customCategories={customCategories}
      batch={batch} prepTasks={prepTasks} prepChecked={prepChecked}
      onAddItem={handleAddItem} onRemoveItem={handleRemoveItem} onMoveItem={handleMoveItem} onClearDay={handleClearDay} onAddNote={handleAddNote} onAddRecipe={handleAddRecipe} onUpdateRecipe={handleUpdateRecipe} onDeleteRecipe={handleDeleteRecipe} onWeekReset={handleWeekReset} onPromoteRadar={handlePromoteRadar}
      onAddBatch={handleAddBatch} onRemoveBatch={handleRemoveBatch}
      onAddPrepTask={handleAddPrepTask} onTogglePrepTask={handleTogglePrepTask} onTogglePrepChecked={handleTogglePrepChecked}
      onToggleRegChecked={handleToggleRegChecked} onToggleShopChecked={handleToggleShopChecked} onAddFreeShop={handleAddFreeShop} onToggleFreeShop={handleToggleFreeShop} shopFilters={shopFilters}
      onAdjustFreezerQty={handleAdjustFreezerQty} />,
    recipes: <RecipesView recipes={recipes} library={library} onAddRecipe={handleAddRecipe} onUpdateRecipe={handleUpdateRecipe} onDeleteRecipe={handleDeleteRecipe} radar={radar} onAddRadar={handleAddRadar} onRemoveRadar={handleRemoveRadar} onPromoteRadar={handlePromoteRadar} customTags={customTags} customCategories={customCategories} />,
    pantry:  <InventoryView week={week} recipes={recipes} staples={staples} onAddStaple={handleAddStaple} onCycleStaple={handleCycleStaple} onRemoveStaple={handleRemoveStaple} regulars={regulars} onAddRegular={handleAddRegular} onRemoveRegular={handleRemoveRegular} fridge={fridge} onAddFridge={handleAddFridge} onCycleFridge={handleCycleFridge} onRemoveFridge={handleRemoveFridge} freezer={freezer} onAddFreezer={handleAddFreezer} onAdjustFreezerQty={handleAdjustFreezerQty} onRemoveFreezer={handleRemoveFreezer} />,
    prefs:   <PrefsView goals={goals} updateGoal={updateGoal} customTags={customTags} onAddCustomTag={handleAddCustomTag} onRemoveCustomTag={handleRemoveCustomTag} customCategories={customCategories} onAddCustomCategory={handleAddCustomCategory} onRemoveCustomCategory={handleRemoveCustomCategory} shopFilters={shopFilters} onAddShopFilter={handleAddShopFilter} onRemoveShopFilter={handleRemoveShopFilter} recipes={recipes} setRecipes={setRecipes} />,
  };
  return (
    <>
      <div className="app">
        <div className="content" ref={contentRef}
          onTouchStart={handlePullStart} onTouchEnd={handlePullEnd}>
          {(pullDistance > 0 || refreshing) && (
            <div className="pull-indicator" style={{ transform: `translateY(${pullDistance - 36}px)` }}>
              <span className={"pull-spinner" + (refreshing ? " spinning" : "")}
                style={!refreshing ? { transform: `rotate(${pullDistance * 4}deg)` } : undefined}>↻</span>
            </div>
          )}
          {views[tab]}
        </div>
        {shopSheetOpen && (
          <ShoppingSheet
            onClose={() => setShopSheetOpen(false)}
            week={week}
            staples={staples}
            freezer={freezer}
            fridge={fridge}
            regulars={regulars} onAddRegular={handleAddRegular} onRemoveRegular={handleRemoveRegular}
            regChecked={regChecked} onToggleRegChecked={handleToggleRegChecked}
            shopChecked={shopChecked} onToggleShopChecked={handleToggleShopChecked}
            freeShop={freeShop} onAddFreeShop={handleAddFreeShop} onToggleFreeShop={handleToggleFreeShop}
            shopFilters={shopFilters}
          />
        )}
        <nav className="tabs">
          {TABS.map(t => (
            <div key={t.id} className={"tab"+(tab===t.id?" active":"")} onClick={() => setTab(t.id)}>
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
