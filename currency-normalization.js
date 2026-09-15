// MoneyGoWhere DEV — normalize foreign-currency expenses to SGD for dashboards while preserving original currency labels.
(()=>{'use strict';
const RELEASE='1.5.5-dev.42';
const BASE='SGD';
const API='https://api.frankfurter.dev/v1';
const COMMON=['SGD','MYR','USD','EUR','GBP','AUD','JPY','THB','IDR','CNY','HKD','KRW','PHP','INR','NZD','CAD','CHF'];
const n=v=>Number(v)||0;
const code=x=>String(x?.currency||BASE).trim().toUpperCase()||BASE;
const date=x=>String(x?.date||'').slice(0,10);
const key=(c,d)=>`${c}|${d}`;
const finite=v=>Number.isFinite(Number(v));
const persist=()=>localStorage.setItem(MGW.key,JSON.stringify(db));
const currencyFormatters=new Map();
function ensure(){db.settings=db.settings||{};db.settings.currency='SGD';db.settings.fxRatesToSGD=db.settings.fxRatesToSGD&&typeof db.settings.fxRatesToSGD==='object'?db.settings.fxRatesToSGD:{}}
function rateFor(x){const c=code(x);if(c===BASE)return 1;if(finite(x?.fxRateToSGD)&&Number(x.fxRateToSGD)>0)return Number(x.fxRateToSGD);const e=db?.settings?.fxRatesToSGD?.[key(c,date(x))];if(e&&finite(e.rate)&&Number(e.rate)>0)return Number(e.rate);return null}
function sgdAmount(x){const amount=n(x?.amount),c=code(x);if(c===BASE)return amount;if(finite(x?.sgdAmount)&&Number(x.sgdAmount)>=0)return Number(x.sgdAmount);const r=rateFor(x);return r?amount*r:0}
function view(x){if(code(x)===BASE)return x;return {...x,_mgwOriginalAmount:n(x.amount),_mgwOriginalCurrency:code(x),amount:sgdAmount(x)}}
function formatOriginal(x){const c=code(x),amount=n(x?.amount);try{let fmt=currencyFormatters.get(c);if(!fmt){fmt=new Intl.NumberFormat('en-SG',{style:'currency',currency:c,currencyDisplay:'code'});currencyFormatters.set(c,fmt)}return fmt.format(amount)}catch{return `${c} ${amount.toFixed(2)}`}}
function formatSgd(x){return money(sgdAmount(x))}
function amountHtml(x){if(code(x)===BASE)return `<span class="mgw-base-amount">${money(n(x?.amount))}</span>`;const converted=sgdAmount(x),rate=rateFor(x);return `<span class="mgw-foreign-amount">${formatOriginal(x)}</span>${rate?`<small class="mgw-sgd-equivalent">≈ ${money(converted)}</small>`:'<small class="mgw-sgd-equivalent mgw-fx-pending">SGD rate pending</small>'}`}
function amountText(x){if(code(x)===BASE)return money(n(x?.amount));const rate=rateFor(x);return rate?`${formatOriginal(x)} · ≈ ${money(sgdAmount(x))}`:`${formatOriginal(x)} · SGD rate pending`}
function currencyOptions(selected='SGD'){const sel=String(selected||BASE).toUpperCase();const xs=[...new Set([sel,...COMMON])];return xs.map(c=>`<option value="${c}" ${c===sel?'selected':''}>${c}</option>`).join('')}
function nearestRate(rates,target){const ds=Object.keys(rates||{}).sort();if(!ds.length)return null;let chosen=ds[0];for(const d of ds){if(d<=target)chosen=d;else break}const rate=Number(rates[chosen]?.SGD);return rate>0?{rate,date:chosen}:null}
async function fetchSeries(currency,dates){const ds=[...dates].filter(Boolean).sort();if(!ds.length)return null;const start=ds[0],end=ds[ds.length-1],url=`${API}/${start}..${end}?base=${encodeURIComponent(currency)}&symbols=SGD`;const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`FX ${r.status}`);const data=await r.json();return data?.rates||{}}
let syncing=false,lastSync=0;
async function syncRates({force=false}={}){
  ensure();if(syncing)return false;if(!force&&Date.now()-lastSync<60000)return false;lastSync=Date.now();
  const all=[...(db.expenses||[]),...(db.importQueue||[])].filter(x=>code(x)!==BASE&&n(x.amount)>0&&date(x));
  if(!all.length)return false;
  let changed=false;
  for(const x of all){
    const r=rateFor(x);if(!r)continue;
    const converted=Number((n(x.amount)*r).toFixed(2));
    if(!finite(x.sgdAmount)||Number(x.sgdAmount)!==converted){x.sgdAmount=converted;changed=true}
  }
  const rows=all.filter(x=>!rateFor(x));
  if(rows.length){
    const groups=new Map();
    for(const x of rows){const c=code(x);let g=groups.get(c);if(!g){g={dates:new Set(),rows:[]};groups.set(c,g)}g.dates.add(date(x));g.rows.push(x)}
    syncing=true;
    try{
      for(const [currency,g] of groups){
        let rates;try{rates=await fetchSeries(currency,g.dates)}catch{continue}
        for(const x of g.rows){
          const m=nearestRate(rates,date(x));if(!m)continue;
          const storeKey=key(currency,date(x)),existing=db.settings.fxRatesToSGD[storeKey];
          if(!existing||Number(existing.rate)!==m.rate||existing.sourceDate!==m.date){db.settings.fxRatesToSGD[storeKey]={rate:m.rate,sourceDate:m.date,source:'Frankfurter',updatedAt:new Date().toISOString()};changed=true}
          const converted=Number((n(x.amount)*m.rate).toFixed(2));
          if(Number(x.fxRateToSGD)!==m.rate||x.fxRateDate!==m.date||x.fxRateSource!=='Frankfurter'||!finite(x.sgdAmount)||Number(x.sgdAmount)!==converted){x.fxRateToSGD=m.rate;x.fxRateDate=m.date;x.fxRateSource='Frankfurter';x.sgdAmount=converted;changed=true}
        }
      }
    }finally{syncing=false}
  }
  if(changed){persist();if(typeof renderAll==='function')renderAll()}
  return changed;
}
function installStyles(){if(document.querySelector('#mgwCurrencyStyles'))return;const s=document.createElement('style');s.id='mgwCurrencyStyles';s.textContent='.mgw-foreign-amount,.mgw-sgd-equivalent{display:block;text-align:right}.mgw-foreign-amount{font-weight:800}.mgw-sgd-equivalent{margin-top:2px;color:var(--muted,#6b7774);font-size:.72rem;font-weight:500}.mgw-fx-pending{color:#b45309}';document.head.appendChild(s)}
function patchMonthExpenses(){if(typeof monthExpenses!=='function'||monthExpenses.__mgwCurrency)return;const base=monthExpenses;const wrapped=function(d){return base(d).map(view)};wrapped.__mgwCurrency=true;monthExpenses=wrapped}
function patchRecent(){if(typeof renderRecent!=='function'||renderRecent.__mgwCurrency)return;const wrapped=function(){const a=[...(db.expenses||[])].sort((x,y)=>String((y.date||'')+(y.time||'')).localeCompare(String((x.date||'')+(x.time||'')))).slice(0,12),el=document.querySelector('#recentTransactions');if(!el)return;if(!a.length){el.className='transaction-list empty-state';el.textContent='Nothing recorded yet.';return}el.className='transaction-list';el.innerHTML=a.map(x=>`<div class="tx"><span class="cat-icon">${MGW.cats[x.category]||'📦'}</span><div><b>${String(x.vendor||x.category||'Expense')}</b><small>${String(x.date||'')}${x.location?' · '+String(x.location):''}</small></div><span class="amount">${amountHtml(x)}</span></div>`).join('')};wrapped.__mgwCurrency=true;renderRecent=wrapped}
function enhanceCurrencySelects(){document.querySelectorAll('#expenseForm select[name="currency"]').forEach(sel=>{if(sel.dataset.mgwFx)return;const current=sel.value||BASE;sel.innerHTML=currencyOptions(current);sel.value=current;sel.dataset.mgwFx='1'})}
let enhancePending=false;
function scheduleEnhance(){if(enhancePending)return;enhancePending=true;queueMicrotask(()=>{enhancePending=false;enhanceCurrencySelects()})}
function boot(){
  ensure();installStyles();patchMonthExpenses();patchRecent();enhanceCurrencySelects();setTimeout(()=>syncRates(),150);
  window.addEventListener('online',()=>syncRates({force:true}));window.addEventListener('focus',()=>syncRates());
  const modalRoot=document.querySelector('#modalBody')||document.querySelector('#modal');if(modalRoot)new MutationObserver(scheduleEnhance).observe(modalRoot,{subtree:true,childList:true});
  if(typeof renderAll==='function')renderAll();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWCurrency={version:RELEASE,base:BASE,code,rateFor,sgdAmount,view,formatOriginal,formatSgd,amountHtml,amountText,currencyOptions,syncRates};
})();
