/* =========================================================
   BiblioKemon — logique de l'application
   Source des cartes & cotes : pokemontcg.io (API publique)
     - tcgplayer.prices   -> marché US, en $
     - cardmarket.prices  -> marché européen, en €  (référence principale,
       plus pertinente pour un collectionneur en Belgique)
   Stockage : localStorage du téléphone (collection + historique de prix).
   ========================================================= */

const API_BASE = "https://api.pokemontcg.io/v2/cards";
const STORE_KEY = "bibliokemon_collection_v1";

// ---------- Utilitaires stockage ----------
function loadCollection(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error("Lecture collection impossible", e);
    return [];
  }
}
function saveCollection(list){
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}
function todayStr(){
  return new Date().toISOString().slice(0,10); // YYYY-MM-DD
}
function fmtEUR(n){
  if(n === null || n === undefined || isNaN(n)) return "—";
  return n.toLocaleString("fr-BE", { style:"currency", currency:"EUR", maximumFractionDigits: n < 20 ? 2 : 0 });
}
function fmtDateShort(d){
  const dt = new Date(d);
  return dt.toLocaleDateString("fr-BE", { day:"2-digit", month:"short" });
}

// ---------- Extraction du prix depuis une carte pokemontcg.io ----------
function extractPrices(cardData){
  let eur = null, usd = null;
  const cm = cardData.cardmarket && cardData.cardmarket.prices;
  if(cm){
    eur = cm.averageSellPrice || cm.trendPrice || cm.avg30 || cm.avg7 || null;
  }
  const tp = cardData.tcgplayer && cardData.tcgplayer.prices;
  if(tp){
    const variant = tp.holofoil || tp.reverseHolofoil || tp.normal || tp["1stEditionHolofoil"] || Object.values(tp)[0];
    if(variant) usd = variant.market || variant.mid || null;
  }
  return { eur, usd };
}

// ---------- Appel API : recherche ----------
async function searchCards(query){
  const q = query.trim();
  if(!q) return [];
  // On tente de séparer "nom + numéro" (ex: "Groudon 199")
  const numMatch = q.match(/(\d{1,4})\s*$/);
  let searchQ = `name:"*${q.replace(/\d+\s*$/,'').trim()}*"`;
  if(!q.replace(/\d+\s*$/,'').trim()){
    searchQ = `name:"*${q}*"`;
  }
  const url = `${API_BASE}?q=${encodeURIComponent(searchQ)}&pageSize=20&orderBy=-set.releaseDate`;
  const res = await fetch(url);
  if(!res.ok) throw new Error("Le service de cartes n'a pas répondu (code " + res.status + ")");
  const json = await res.json();
  let results = json.data || [];
  if(numMatch){
    const num = numMatch[1];
    results = results.filter(c => (c.number || "").replace(/^0+/,'') === num.replace(/^0+/,'')).concat(
      results.filter(c => (c.number || "").replace(/^0+/,'') !== num.replace(/^0+/,''))
    );
  }
  return results;
}

async function fetchCardById(id){
  const res = await fetch(`${API_BASE}/${id}`);
  if(!res.ok) throw new Error("Carte introuvable");
  const json = await res.json();
  return json.data;
}

// ---------- Rafraîchissement des cotes + historique ----------
async function refreshCardPrice(item, { force=false } = {}){
  const today = todayStr();
  if(!force && item.history && item.history.length && item.history[item.history.length-1].date === today){
    return item; // déjà rafraîchi aujourd'hui
  }
  try{
    const data = await fetchCardById(item.id);
    const { eur, usd } = extractPrices(data);
    item.lastEUR = eur;
    item.lastUSD = usd;
    item.history = item.history || [];
    const last = item.history[item.history.length-1];
    if(last && last.date === today){
      last.eur = eur; last.usd = usd;
    } else if(eur !== null || usd !== null){
      item.history.push({ date: today, eur, usd });
    }
  }catch(e){
    console.warn("Cote indisponible pour", item.name, e);
  }
  return item;
}

async function refreshAllPrices(collection, { force=false } = {}){
  for(const item of collection){
    await refreshCardPrice(item, { force });
  }
  saveCollection(collection);
  return collection;
}

// ================= UI STATE =================
let collection = loadCollection();
let pendingCard = null;   // carte choisie dans les résultats, en attente de confirmation
let pendingPhoto = null;  // dataURL de la photo

const els = {
  totalValue: document.getElementById("totalValue"),
  totalDelta: document.getElementById("totalDelta"),
  cardGrid: document.getElementById("cardGrid"),
  cardCount: document.getElementById("cardCount"),
  emptyState: document.getElementById("emptyState"),
  searchInput: document.getElementById("searchInput"),
  btnSearch: document.getElementById("btnSearch"),
  searchStatus: document.getElementById("searchStatus"),
  searchResults: document.getElementById("searchResults"),
  addStepSearch: document.getElementById("addStep-search"),
  addStepConfirm: document.getElementById("addStep-confirm"),
  confirmCard: document.getElementById("confirmCard"),
  photoInput: document.getElementById("photoInput"),
  photoPreview: document.getElementById("photoPreview"),
  photoPickerBtn: document.getElementById("photoPickerBtn"),
  btnAddToCollection: document.getElementById("btnAddToCollection"),
  btnBackToSearch: document.getElementById("btnBackToSearch"),
  btnBackToCollection: document.getElementById("btnBackToCollection"),
  detailContent: document.getElementById("detailContent"),
  toast: document.getElementById("toast"),
  btnRefreshAll: document.getElementById("btnRefreshAll"),
};

function showToast(msg, ms=2600){
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>{ els.toast.hidden = true; }, ms);
}

// ---------- Navigation onglets / vues ----------
function switchTab(tab){
  document.querySelectorAll(".tabBtn").forEach(b => b.classList.toggle("tabBtn--active", b.dataset.tab === tab));
  document.getElementById("view-collection").classList.toggle("view--active", tab === "collection");
  document.getElementById("view-add").classList.toggle("view--active", tab === "add");
  document.getElementById("view-detail").classList.remove("view--active");
}
document.querySelectorAll(".tabBtn").forEach(btn=>{
  btn.addEventListener("click", ()=> switchTab(btn.dataset.tab));
});

function openDetail(localId){
  const item = collection.find(c => c.localId === localId);
  if(!item) return;
  renderDetail(item);
  document.querySelectorAll(".view").forEach(v => v.classList.remove("view--active"));
  document.getElementById("view-detail").classList.add("view--active");
}
els.btnBackToCollection.addEventListener("click", ()=> switchTab("collection"));

// ---------- Rendu : total collection ----------
function renderTotal(){
  const total = collection.reduce((sum, c) => sum + (c.lastEUR || 0), 0);
  els.totalValue.textContent = fmtEUR(total);

  // delta = comparaison avec la valeur totale il y a 7 jours (ou la plus ancienne dispo)
  const past = collection.reduce((sum, c)=>{
    if(!c.history || !c.history.length) return sum;
    const ref = c.history.find(h => h.eur !== null) ;
    return sum + (ref ? ref.eur : 0);
  },0);
  if(collection.length === 0){
    els.totalDelta.textContent = "";
  } else if(past > 0 && Math.abs(total-past) > 0.01){
    const diff = total - past;
    const pct = (diff/past*100).toFixed(1);
    els.totalDelta.textContent = `${diff>0?"▲":"▼"} ${fmtEUR(Math.abs(diff))} (${diff>0?"+":""}${pct}%) depuis l'ajout`;
    els.totalDelta.className = "totalSlab__delta " + (diff>0?"up":"down");
  } else {
    els.totalDelta.textContent = "Stable depuis l'ajout";
    els.totalDelta.className = "totalSlab__delta flat";
  }
}

// ---------- Rendu : grille collection ----------
function renderGrid(){
  els.cardCount.textContent = collection.length + (collection.length>1 ? " cartes" : " carte");
  els.emptyState.hidden = collection.length !== 0;
  els.cardGrid.innerHTML = "";
  // tri : plus récentes en premier
  const sorted = [...collection].sort((a,b)=> (b.addedDate||"").localeCompare(a.addedDate||""));
  for(const item of sorted){
    const delta = cardDelta(item);
    const slab = document.createElement("button");
    slab.className = "slab";
    slab.innerHTML = `
      <div class="slab__corner"></div>
      <div class="slab__label"><span>${escapeHTML(item.setName || "")}</span><span>#${escapeHTML(item.number || "")}</span></div>
      <div class="slab__imgWrap"><img src="${item.photo || item.image}" alt=""></div>
      <div class="slab__name">${escapeHTML(item.name)}</div>
      <div class="slab__priceRow">
        <span class="slab__price">${fmtEUR(item.lastEUR)}</span>
        <span class="slab__deltaTag ${delta.cls}">${delta.label}</span>
      </div>
    `;
    slab.addEventListener("click", ()=> openDetail(item.localId));
    els.cardGrid.appendChild(slab);
  }
}

function cardDelta(item){
  if(!item.history || item.history.length < 2 || item.lastEUR === null || item.lastEUR === undefined){
    return { cls:"flat", label:"—" };
  }
  const first = item.history.find(h => h.eur !== null);
  if(!first || first.eur === 0) return { cls:"flat", label:"—" };
  const diff = item.lastEUR - first.eur;
  const pct = (diff/first.eur*100);
  if(Math.abs(pct) < 0.5) return { cls:"flat", label:"stable" };
  return { cls: diff>0?"up":"down", label: `${diff>0?"+":""}${pct.toFixed(1)}%` };
}

function escapeHTML(s){
  return String(s||"").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

// ---------- Recherche ----------
els.btnSearch.addEventListener("click", runSearch);
els.searchInput.addEventListener("keydown", e => { if(e.key === "Enter") runSearch(); });

async function runSearch(){
  const q = els.searchInput.value;
  if(!q.trim()){ els.searchStatus.textContent = "Écris au moins le nom du Pokémon."; return; }
  els.searchStatus.textContent = "Recherche en cours…";
  els.searchStatus.className = "searchStatus";
  els.searchResults.innerHTML = "";
  els.btnSearch.disabled = true;
  try{
    const results = await searchCards(q);
    els.btnSearch.disabled = false;
    if(!results.length){
      els.searchStatus.textContent = "Aucune carte trouvée. Essaie un autre nom ou orthographe.";
      return;
    }
    els.searchStatus.textContent = `${results.length} résultat(s)`;
    renderResults(results.slice(0,20));
  }catch(e){
    els.btnSearch.disabled = false;
    els.searchStatus.textContent = "Oups, impossible de contacter le service de cartes. Vérifie ta connexion.";
    els.searchStatus.className = "searchStatus error";
    console.error(e);
  }
}

function renderResults(results){
  els.searchResults.innerHTML = "";
  for(const card of results){
    const { eur } = extractPrices(card);
    const row = document.createElement("button");
    row.className = "resultItem";
    row.innerHTML = `
      <img src="${card.images && card.images.small}" alt="">
      <span>
        <span class="resultItem__name">${escapeHTML(card.name)}</span>
        <span class="resultItem__meta">${escapeHTML(card.set && card.set.name)} · #${escapeHTML(card.number)} · ${fmtEUR(eur)}</span>
      </span>
    `;
    row.addEventListener("click", ()=> selectCard(card));
    els.searchResults.appendChild(row);
  }
}

function selectCard(card){
  pendingCard = card;
  pendingPhoto = null;
  els.photoPreview.hidden = true;
  els.photoInput.value = "";
  const { eur, usd } = extractPrices(card);
  els.confirmCard.innerHTML = `
    <img src="${card.images && card.images.small}" alt="">
    <div>
      <div class="confirmCard__name">${escapeHTML(card.name)}</div>
      <div class="confirmCard__meta">${escapeHTML(card.set && card.set.name)} · #${escapeHTML(card.number)}</div>
      <div class="confirmCard__price">${fmtEUR(eur)}${usd?` · $${usd.toFixed(2)} (US)`:""}</div>
    </div>
  `;
  els.addStepSearch.classList.remove("addStep--active");
  els.addStepConfirm.classList.add("addStep--active");
}
els.btnBackToSearch.addEventListener("click", ()=>{
  els.addStepConfirm.classList.remove("addStep--active");
  els.addStepSearch.classList.add("addStep--active");
});

els.photoInput.addEventListener("change", ()=>{
  const file = els.photoInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    pendingPhoto = reader.result;
    els.photoPreview.src = pendingPhoto;
    els.photoPreview.hidden = false;
  };
  reader.readAsDataURL(file);
});

els.btnAddToCollection.addEventListener("click", async ()=>{
  if(!pendingCard) return;
  const { eur, usd } = extractPrices(pendingCard);
  const today = todayStr();
  const item = {
    localId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())),
    id: pendingCard.id,
    name: pendingCard.name,
    number: pendingCard.number,
    setName: pendingCard.set && pendingCard.set.name,
    image: pendingCard.images && pendingCard.images.small,
    photo: pendingPhoto,
    addedDate: today,
    lastEUR: eur,
    lastUSD: usd,
    history: [{ date: today, eur, usd }],
  };
  collection.push(item);
  saveCollection(collection);
  showToast(`${item.name} ajouté à ta collection ✓`);
  pendingCard = null; pendingPhoto = null;
  els.addStepConfirm.classList.remove("addStep--active");
  els.addStepSearch.classList.add("addStep--active");
  els.searchInput.value = "";
  els.searchResults.innerHTML = "";
  els.searchStatus.textContent = "";
  renderAll();
  switchTab("collection");
});

// ---------- Détail carte ----------
function renderDetail(item){
  const delta = cardDelta(item);
  const history = (item.history||[]).filter(h => h.eur !== null && h.eur !== undefined);
  els.detailContent.innerHTML = `
    <div class="detailHero">
      <img src="${item.photo || item.image}" alt="">
      <div>
        <div class="detailHero__name">${escapeHTML(item.name)}</div>
        <div class="detailHero__meta">${escapeHTML(item.setName||"")} · #${escapeHTML(item.number||"")}</div>
        <div class="detailHero__added">Ajoutée le ${fmtDateShort(item.addedDate)}</div>
      </div>
    </div>

    <div class="statRow">
      <div class="statCard">
        <div class="statCard__label">Valeur actuelle</div>
        <div class="statCard__value">${fmtEUR(item.lastEUR)}</div>
      </div>
      <div class="statCard">
        <div class="statCard__label">Évolution</div>
        <div class="statCard__value ${delta.cls}">${delta.label}</div>
      </div>
    </div>

    <div class="chartCard">
      <div class="chartCard__title">Évolution de la valeur</div>
      ${renderSparkline(history)}
    </div>

    <div class="priceSourceRow">
      <div class="sourceCard">
        <div class="sourceCard__name">Cardmarket (EU)</div>
        <div class="sourceCard__value">${fmtEUR(item.lastEUR)}</div>
      </div>
      <div class="sourceCard">
        <div class="sourceCard__name">TCGplayer (US)</div>
        <div class="sourceCard__value">${item.lastUSD ? "$"+item.lastUSD.toFixed(2) : "—"}</div>
      </div>
    </div>

    <button class="btnDanger" id="btnDeleteCard">Retirer cette carte de la collection</button>
  `;
  document.getElementById("btnDeleteCard").addEventListener("click", ()=>{
    if(confirm(`Retirer "${item.name}" de la collection ?`)){
      collection = collection.filter(c => c.localId !== item.localId);
      saveCollection(collection);
      renderAll();
      switchTab("collection");
    }
  });
}

function renderSparkline(history){
  if(history.length < 2){
    return `<p style="font-size:13px;color:var(--ink-45);margin:6px 0 2px;">Reviens demain (ou rafraîchis les cotes) pour voir la courbe se dessiner : il faut au moins deux relevés.</p>`;
  }
  const w = 500, h = 140, pad = 10;
  const values = history.map(h=>h.eur);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = (w - pad*2) / (history.length - 1);
  const pts = history.map((pt,i)=>{
    const x = pad + i*stepX;
    const y = pad + (1 - (pt.eur - min)/range) * (h - pad*2);
    return {x, y, v:pt.eur, date:pt.date};
  });
  const path = pts.map((p,i)=> (i===0?"M":"L") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
  const areaPath = path + ` L${pts[pts.length-1].x.toFixed(1)},${h-pad} L${pts[0].x.toFixed(1)},${h-pad} Z`;
  const last = pts[pts.length-1];
  const up = last.v >= pts[0].v;
  const color = up ? "var(--up)" : "var(--down)";
  return `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${up?"#2FD990":"#FF5C72"}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${up?"#2FD990":"#FF5C72"}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#fade)" stroke="none"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last.x}" cy="${last.y}" r="4" fill="${color}"/>
    </svg>
    <div style="display:flex;justify-content:space-between;font-family:var(--mono);font-size:10.5px;color:var(--ink-45);margin-top:4px;">
      <span>${fmtDateShort(pts[0].date)}</span>
      <span>${fmtDateShort(last.date)}</span>
    </div>
  `;
}

// ---------- Rafraîchir toutes les cotes (bouton header) ----------
els.btnRefreshAll.addEventListener("click", async ()=>{
  if(!collection.length){ showToast("Ajoute d'abord une carte !"); return; }
  els.btnRefreshAll.classList.add("spinning");
  try{
    await refreshAllPrices(collection, { force:true });
    renderAll();
    showToast("Cotes mises à jour ✓");
  }catch(e){
    showToast("Impossible de rafraîchir les cotes pour le moment.");
  }
  els.btnRefreshAll.classList.remove("spinning");
});

// ---------- Rendu global ----------
function renderAll(){
  renderTotal();
  renderGrid();
}

// ---------- Démarrage ----------
async function init(){
  renderAll();
  if(collection.length){
    // Relevé automatique du jour (une fois par jour, silencieux)
    await refreshAllPrices(collection, { force:false });
    renderAll();
  }
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
}
init();
