// MoneyGoWhere compatibility + detailed drill-down.
// Release metadata is intentionally separate from DB schema version.
const MGW_RELEASE = Object.freeze({ appVersion: '1.3.1', schemaVersion: 1, dataVersion: 4, cacheVersion: '1.3.1' });

// Category extensions are additive and keep the existing local DB schema compatible.
MGW.cats['Installments'] = '🧾';
MGW.cats['Healthcare'] = '🏥';
MGW.cats['Savings'] = '💰';

function mgwNormalizedVendor(x={}){return String(x.vendor||'').trim().toLowerCase()}
function mgwEffectiveCategory(x={}){
  const vendor=mgwNormalizedVendor(x);
  if(vendor.includes('installment') || vendor.includes('instalment')) return 'Installments';
  if(vendor.includes('singtel') || vendor.includes('sp services') || vendor.includes('town council')) return 'Utilities';
  return x.category || 'Other';
}

// Legacy netSalary already represents total take-home pay for the month.
// This compatibility override prevents bonus/one-off amounts from being counted twice.
if (typeof totals === 'function') {
  totals = function(d) {
    const ex = sum(monthExpenses(d));
    const inc = monthIncome(d);
    const net = inc.reduce((t, x) => t + (Number(x.netSalary) || 0), 0);
    return { ex, net };
  };
}

// Keep historic installment/Singtel records in the correct reporting buckets without mutating stored data.
if (typeof catTotals === 'function') {
  catTotals = function(list) {
    const o={};
    list.forEach(x=>{
      const category=mgwEffectiveCategory(x);
      o[category]=(o[category]||0)+(Number(x.amount)||0);
    });
    return Object.entries(o).sort((a,b)=>b[1]-a[1]);
  };
}

// Reuse currency formatters instead of constructing Intl.NumberFormat for every value rendered.
if (typeof money === 'function') {
  const mgwFormatters = new Map();
  money = function(v) {
    const currency = db?.settings?.currency || 'SGD';
    if (!mgwFormatters.has(currency)) {
      mgwFormatters.set(currency, new Intl.NumberFormat('en-SG', { style: 'currency', currency }));
    }
    return mgwFormatters.get(currency).format(Number(v) || 0);
  };
}

function mgwEsc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

const MGW_PLATFORM_NAMES=['Shopee','TikTok Shop','Lazada','Amazon','Qoo10','Carousell'];
const MGW_UTILITY_PROVIDERS=['Singtel','SP Services','Town Council'];
function mgwDetectPlatform(vendor=''){
  const v=String(vendor).toLowerCase();
  if(v.includes('shopee'))return 'Shopee';
  if(v.includes('tiktok'))return 'TikTok Shop';
  if(v.includes('lazada'))return 'Lazada';
  if(v.includes('amazon'))return 'Amazon';
  if(v.includes('qoo10'))return 'Qoo10';
  if(v.includes('carousell'))return 'Carousell';
  return '';
}

// Local, explainable categorisation. Unknown merchants are deliberately left for user review.
function mgwSuggestCategory(vendor='',hint=''){
  const text=`${vendor} ${hint}`.toLowerCase();
  const rules=[
    {category:'Healthcare',confidence:96,reason:'medical/health merchant',words:['parkway shenton','raffles medical','polyclinic','clinic','hospital','pharmacy','medical','dental','doctor','healthier sg']},
    {category:'Utilities',confidence:98,reason:'known utility provider',words:['singtel','sp services','town council','starhub','m1 limited']},
    {category:'Groceries',confidence:94,reason:'known grocery merchant',words:['fairprice','ntuc','sheng siong','cold storage','giant supermarket','prime supermarket']},
    {category:'Transport',confidence:90,reason:'transport merchant',words:['comfortdelgro','cdg zig','grab ride','gojek','shell','esso','caltex','petrol']},
    {category:'Lifestyle',confidence:82,reason:'food/dining merchant',words:['restaurant','cafe','coffee','food','mcdonald','kfc','starbucks','kopitiam','toast box']},
    {category:'Installments',confidence:98,reason:'installment payment',words:['installment','instalment']}
  ];
  for(const rule of rules){if(rule.words.some(w=>text.includes(w)))return rule;}
  return {category:'',confidence:0,reason:'needs review'};
}

function mgwLocalDateParts(date=new Date()){
  return {date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,time:`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`};
}

function mgwIsDuplicateCandidate(x,candidate){
  const sameAmount=Math.abs((Number(x.amount)||0)-(Number(candidate.amount)||0))<0.005;
  const sameDate=String(x.date||'')===String(candidate.date||'');
  const a=mgwNormalizedVendor(x),b=String(candidate.vendor||'').trim().toLowerCase();
  const sameVendor=a&&b&&(a.includes(b)||b.includes(a));
  return sameAmount&&sameDate&&sameVendor;
}

// Extend expense forms with album-friendly receipt upload, platform/payment-source fields and category suggestion.
if (typeof expenseForm === 'function') {
  const mgwBaseExpenseForm=expenseForm;
  expenseForm=function(type,d={}){
    let html=mgwBaseExpenseForm(type,d);
    if(type==='receipt'){
      html=html.replace('<b>Receipt photo</b>','<b>Receipt / invoice image</b>')
        .replace('accept="image/*" capture="environment"','accept="image/*"')
        .replace('Choose or take a receipt photo. OCR runs locally in your browser.','Choose from Photos/album or take a new picture. OCR runs locally in your browser.');
    }
    const platform=`<div class="field full"><label>Online Platform / Channel</label><input name="platform" list="mgwPlatformSuggestions" value="${mgwEsc(d.platform||'')}" placeholder="Optional — e.g. Shopee"><datalist id="mgwPlatformSuggestions">${MGW_PLATFORM_NAMES.map(x=>`<option value="${x}">`).join('')}</datalist><small>Keep the spending type as what you bought; this records where you bought it.</small></div>`;
    const payment=`<div class="field"><label>Payment Method</label><input name="paymentMethod" value="${mgwEsc(d.paymentMethod||'')}" placeholder="e.g. Apple Pay"></div><div class="field"><label>Card / Payment Source</label><input name="card" value="${mgwEsc(d.card||'')}" placeholder="e.g. OCBC 365 Credit Card"></div>`;
    const suggestion=d.categorySuggestion?`<div class="field full"><div class="status"><b>Suggested category:</b> ${mgwEsc(d.categorySuggestion)}${d.categoryConfidence?` · ${Number(d.categoryConfidence)}% confidence`:''}<br><small>${mgwEsc(d.categoryReason||'Please review before saving.')}</small></div></div>`:'';
    html=html.replace('<div class="field full"><label>Spending Type</label>',platform+payment+suggestion+'<div class="field full"><label>Spending Type</label>');
    if(d.category){html=html.replace(`${catsOptions()}</select>`,`${catsOptions(d.category)}</select>`);}
    if(d.notes){html=html.replace('<textarea name="notes"></textarea>',`<textarea name="notes">${mgwEsc(d.notes)}</textarea>`);}
    return html;
  };
}

function mgwDetailRows(list){return list.map(x=>`<div class="mgw-detail-row"><div><b>${mgwEsc(x.vendor||mgwEffectiveCategory(x)||'Expense')}</b><small>${mgwEsc(mgwEffectiveCategory(x))}${x.platform?' · 🛍️ '+mgwEsc(x.platform):''}${x.paymentMethod?' · '+mgwEsc(x.paymentMethod):''}${x.card?' · '+mgwEsc(x.card):''}${x.notes?' · '+mgwEsc(x.notes):''}</small></div><strong>${money(x.amount)}</strong></div>`).join('')}
function mgwIncomeRows(list){return list.map(x=>`<div class="mgw-income-detail"><div><span>Base Salary</span><strong>${money(x.baseSalary)}</strong></div><div><span>Net Salary</span><strong>${money(x.netSalary)}</strong></div>${Number(x.bonus)?`<div><span>Bonus</span><strong>${money(x.bonus)}</strong></div>`:''}${Number(x.oneOff)?`<div><span>One-Off Payment</span><strong>${money(x.oneOff)}</strong></div>`:''}</div>`).join('')}
function mgwPlatformGroups(list){
  const groups={};
  list.filter(x=>String(x.platform||'').trim()).forEach(x=>{
    const platform=String(x.platform).trim();
    (groups[platform]||(groups[platform]=[])).push(x);
  });
  return Object.entries(groups).sort((a,b)=>sum(b[1])-sum(a[1]));
}
function mgwPaymentGroups(list){
  const groups={};
  list.filter(x=>String(x.card||x.paymentMethod||'').trim()).forEach(x=>{
    const key=String(x.card||x.paymentMethod).trim();
    (groups[key]||(groups[key]=[])).push(x);
  });
  return Object.entries(groups).sort((a,b)=>sum(b[1])-sum(a[1]));
}
function mgwUtilityRows(list){
  const matched=new Set();
  const rows=MGW_UTILITY_PROVIDERS.map(provider=>{
    const providerList=list.filter((x,i)=>{
      const hit=mgwNormalizedVendor(x).includes(provider.toLowerCase());
      if(hit)matched.add(i);
      return hit;
    });
    return `<div class="mgw-detail-row"><div><b>${mgwEsc(provider)}</b><small>Utilities</small></div><strong>${money(sum(providerList))}</strong></div>`;
  });
  list.forEach((x,i)=>{if(!matched.has(i))rows.push(mgwDetailRows([x]));});
  return rows.join('');
}

function renderMonthlyDetails(){
  const host=document.querySelector('#monthlyDetails'); if(!host)return;
  const d=MGW.state.month, ex=monthExpenses(d), inc=monthIncome(d), groups={};
  ex.forEach(x=>{const cat=mgwEffectiveCategory(x);(groups[cat]||(groups[cat]=[])).push(x)});
  const utilityList=groups.Utilities||[];
  const utilityHtml=`<details class="mgw-detail-group"><summary><span>${MGW.cats.Utilities||'💡'} Utilities</span><strong>${money(sum(utilityList))}<i>›</i></strong></summary><div class="mgw-detail-body">${mgwUtilityRows(utilityList)}</div></details>`;
  const groupHtml=utilityHtml+Object.entries(groups).filter(([cat])=>cat!=='Utilities').sort((a,b)=>sum(b[1])-sum(a[1])).map(([cat,list])=>`<details class="mgw-detail-group"><summary><span>${MGW.cats[cat]||'📦'} ${mgwEsc(cat)}</span><strong>${money(sum(list))}<i>›</i></strong></summary><div class="mgw-detail-body">${mgwDetailRows(list)}</div></details>`).join('');
  const platformHtml=mgwPlatformGroups(ex).map(([platform,list])=>`<details class="mgw-detail-group"><summary><span>🛍️ ${mgwEsc(platform)}</span><strong>${money(sum(list))}<i>›</i></strong></summary><div class="mgw-detail-body">${mgwDetailRows(list)}</div></details>`).join('');
  const paymentHtml=mgwPaymentGroups(ex).map(([card,list])=>`<details class="mgw-detail-group"><summary><span>💳 ${mgwEsc(card)}</span><strong>${money(sum(list))}<i>›</i></strong></summary><div class="mgw-detail-body">${mgwDetailRows(list)}</div></details>`).join('');
  host.innerHTML=`<details class="mgw-month-details"><summary><span><b>Monthly Details</b><small>Tap to expand income, bills, shopping channels & payment sources</small></span><strong>${ex.length} records <i>›</i></strong></summary><div class="mgw-month-body"><section><h3>💰 Income</h3>${inc.length?mgwIncomeRows(inc):'<p class="empty-state">No income recorded this month.</p>'}</section><section><h3>🧾 Payments & Allocations</h3>${groupHtml}</section><section><h3>🛍️ Online Platforms</h3>${platformHtml||'<p class="empty-state">No online platform spending tagged this month.</p>'}</section><section><h3>💳 Payment Sources</h3>${paymentHtml||'<p class="empty-state">No payment source information recorded this month.</p>'}</section></div></details>`;
}

// Extend the existing renderer without forcing a second full render during initial load.
if (typeof renderAll === 'function') {
  const mgwBaseRenderAll=renderAll;
  renderAll=function(){mgwBaseRenderAll();renderMonthlyDetails()};
}

function mgwInstallVersionBadge(){
  const header=document.querySelector('.topbar > div:first-child');
  if(!header || document.querySelector('#appVersionBadge')) return;
  const badge=document.createElement('span');
  badge.id='appVersionBadge';
  badge.className='app-version-badge';
  badge.textContent=`v${MGW_RELEASE.appVersion}`;
  badge.title=`App ${MGW_RELEASE.appVersion} · Schema ${MGW_RELEASE.schemaVersion} · Data ${MGW_RELEASE.dataVersion}`;
  header.appendChild(badge);
}

function mgwExportCompleteBackup(){
  const payload={...db,backupMeta:{appVersion:MGW_RELEASE.appVersion,schemaVersion:MGW_RELEASE.schemaVersion,dataVersion:MGW_RELEASE.dataVersion,cacheVersion:MGW_RELEASE.cacheVersion,exportedAt:new Date().toISOString()}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`MoneyGoWhere-backup-v${MGW_RELEASE.appVersion}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  if(typeof toast==='function') toast('Complete backup exported');
}

// Apple Shortcuts bridge: open MoneyGoWhere with ?mgw=applepay&merchant=...&amount=...&card=...
function mgwHandleApplePayURL(){
  const params=new URLSearchParams(location.search);
  if(params.get('mgw')!=='applepay')return;
  const merchant=String(params.get('merchant')||'').trim();
  const amount=Number(String(params.get('amount')||'').replace(/[^0-9.-]/g,''));
  const card=String(params.get('card')||'').trim();
  const hint=String(params.get('hint')||'').trim();
  const now=mgwLocalDateParts();
  const date=String(params.get('date')||now.date).slice(0,10);
  const time=String(params.get('time')||now.time).slice(0,5);
  if(!merchant || !Number.isFinite(amount) || amount<=0){
    if(typeof toast==='function')toast('Apple Pay transaction needs merchant and amount');
    history.replaceState({},'',location.pathname+location.hash);
    return;
  }
  const suggestion=mgwSuggestCategory(merchant,hint);
  const platform=mgwDetectPlatform(merchant);
  const candidate={merchant,vendor:merchant,amount,date,time,card};
  if(db.expenses.some(x=>mgwIsDuplicateCandidate(x,candidate))){
    if(typeof toast==='function')toast('Possible duplicate Apple Pay transaction already recorded');
    history.replaceState({},'',location.pathname+location.hash);
    return;
  }
  const prefill={
    date,time,vendor:merchant,amount:amount.toFixed(2),currency:'SGD',platform,
    paymentMethod:'Apple Pay',card,
    category:suggestion.category,
    categorySuggestion:suggestion.category||'Needs review',
    categoryConfidence:suggestion.confidence,
    categoryReason:suggestion.reason,
    notes:'Captured from Apple Wallet automation — review category before saving.'
  };
  history.replaceState({},'',location.pathname+location.hash);
  if(typeof openModal==='function')openModal('expense',prefill);
}

document.addEventListener('DOMContentLoaded',()=>{
  mgwInstallVersionBadge();
  const trend=document.querySelector('#trendBars')?.closest('.card');
  if(trend && !document.querySelector('#monthlyDetails')){
    const wrap=document.createElement('article');wrap.className='card';wrap.id='monthlyDetails';trend.insertAdjacentElement('beforebegin',wrap);
  }
  // Re-render once after category extensions so current dashboard/insights use the new reporting buckets.
  if(typeof renderAll==='function') renderAll(); else renderMonthlyDetails();

  // Replace the basic backup action with a versioned backup while preserving restore compatibility.
  const exportBtn=document.querySelector('#exportBtn');
  exportBtn?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();mgwExportCompleteBackup()},{capture:true});

  // When an update is ready to install, remind the user to back up before allowing activation.
  const refreshBtn=document.querySelector('#refreshBtn');
  refreshBtn?.addEventListener('click',e=>{
    if(!refreshBtn.classList.contains('update-available')) return;
    const proceed=window.confirm('Backup recommended before updating MoneyGoWhere. Export your database and preferences first if you have not done so. Continue installing the update?');
    if(!proceed){e.preventDefault();e.stopImmediatePropagation();if(typeof toast==='function')toast('Update paused — create a backup first');}
  },{capture:true});

  // Process Apple Pay transaction parameters only after the app UI is ready.
  mgwHandleApplePayURL();
});