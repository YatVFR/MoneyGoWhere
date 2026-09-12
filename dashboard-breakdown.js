// MoneyGoWhere v1.5.5-dev.9 — clean grouped dashboard breakdown
(()=>{
'use strict';
const RELEASE='1.5.5-dev.9';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v)||0;
const sum=rows=>rows.reduce((t,x)=>t+num(x.amount),0);
const key=()=>`${MGW.state.month.getFullYear()}-${String(MGW.state.month.getMonth()+1).padStart(2,'0')}`;
const expenses=()=>typeof monthExpenses==='function'?monthExpenses(MGW.state.month):[];
const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toUpperCase();

function styles(){
  if(document.querySelector('#mgwDashboardBreakdownStyles'))return;
  const s=document.createElement('style');
  s.id='mgwDashboardBreakdownStyles';
  s.textContent=`
    #topCategories.mgw-top-breakdown{display:grid;gap:10px}
    #topCategories details{margin:0}
    .mgw-spend-detail,.mgw-recurring-detail{border:1px solid var(--border,#dbe4e4);border-radius:14px;overflow:hidden;background:var(--card,#fff)}
    .mgw-recurring-group,.mgw-merchant-group{border:1px solid var(--border,#e6eceb);border-radius:11px;overflow:hidden;background:rgba(18,130,119,.018)}
    .mgw-spend-detail>summary,.mgw-recurring-detail>summary,.mgw-recurring-group>summary,.mgw-merchant-group>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;-webkit-tap-highlight-color:transparent}
    .mgw-spend-detail>summary,.mgw-recurring-detail>summary{padding:12px 13px}
    .mgw-recurring-group>summary,.mgw-merchant-group>summary{padding:9px 10px}
    .mgw-spend-detail>summary::-webkit-details-marker,.mgw-recurring-detail>summary::-webkit-details-marker,.mgw-recurring-group>summary::-webkit-details-marker,.mgw-merchant-group>summary::-webkit-details-marker{display:none}
    .mgw-spend-main{display:flex;gap:10px;align-items:center;min-width:0}
    .mgw-spend-copy,.mgw-group-copy,.mgw-merchant-copy{min-width:0}
    .mgw-spend-copy b,.mgw-spend-copy small,.mgw-group-copy b,.mgw-group-copy small,.mgw-merchant-copy b,.mgw-merchant-copy small{display:block}
    .mgw-spend-copy b,.mgw-group-copy b,.mgw-merchant-copy b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .mgw-spend-copy small,.mgw-group-copy small,.mgw-merchant-copy small,.mgw-line small{opacity:.62;margin-top:2px;line-height:1.25}
    .mgw-summary-side{display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0}
    .mgw-amount{text-align:right;white-space:nowrap;font-weight:800}
    .mgw-chevron{width:22px;height:22px;display:inline-grid;place-items:center;border-radius:999px;background:rgba(18,130,119,.08);font-size:20px;line-height:1;transition:transform .16s ease;flex:0 0 22px}
    .mgw-chevron::before{content:'›';transform:translateY(-1px)}
    details[open]>summary .mgw-chevron{transform:rotate(90deg)}
    .mgw-spend-bar{grid-column:1/-1;height:6px;border-radius:999px;background:#edf2f1;overflow:hidden;margin-top:1px}
    .mgw-spend-bar i{display:block;height:100%;background:var(--accent,#128277);border-radius:inherit}
    .mgw-spend-body{border-top:1px solid var(--border,#e8eeee);padding:8px 10px 10px;background:rgba(0,0,0,.006)}
    .mgw-recurring-detail>summary{background:rgba(18,130,119,.045)}
    .mgw-recurring-groups,.mgw-merchant-list{display:grid;gap:7px}
    .mgw-group-body,.mgw-merchant-body{padding:4px 10px 7px;border-top:1px solid #eef2f1;background:rgba(255,255,255,.7)}
    .mgw-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:start;padding:8px 2px;border-bottom:1px solid #eef1f1}
    .mgw-line:last-child{border-bottom:0}
    .mgw-line b,.mgw-line small{display:block}.mgw-line b{overflow-wrap:anywhere}.mgw-line>strong{white-space:nowrap;text-align:right}
    .mgw-review{display:inline-block;font-size:.68rem;margin-left:5px;padding:2px 6px;border-radius:999px;background:rgba(180,120,0,.12);vertical-align:1px}
    @media(max-width:520px){
      #topCategories.mgw-top-breakdown{gap:8px}
      .mgw-spend-detail>summary,.mgw-recurring-detail>summary{padding:11px}
      .mgw-spend-main{gap:8px}.mgw-summary-side{gap:6px}
      .mgw-spend-copy small,.mgw-group-copy small,.mgw-merchant-copy small{font-size:.76rem}
      .mgw-line{font-size:.9rem}.mgw-line small{font-size:.74rem}
      .mgw-chevron{width:20px;height:20px;flex-basis:20px;font-size:18px}
    }
  `;
  document.head.appendChild(s)
}

function line(x){
  const meta=[String(x.date||'').slice(0,10),x.location,x.notes].filter(Boolean).join(' · ');
  return `<div class="mgw-line"><div><b>${esc(x.vendor||x.notes||x.category||'Expense')}</b><small>${esc(meta)}</small></div><strong>${money(num(x.amount))}</strong></div>`
}
function childExpenseLine(x){
  const title=String(x.date||'').slice(0,10)||'Transaction';
  const meta=[x.location,x.notes].filter(Boolean).join(' · ')||'Transaction detail';
  return `<div class="mgw-line"><div><b>${esc(title)}</b><small>${esc(meta)}</small></div><strong>${money(num(x.amount))}</strong></div>`
}
function groupRows(rows,getName){
  const map=new Map();
  for(const x of rows){
    const display=String(getName(x)||'Unknown').trim()||'Unknown';
    const k=norm(display);
    if(!map.has(k))map.set(k,{name:display,rows:[]});
    map.get(k).rows.push(x)
  }
  return [...map.values()]
}
function side(amount){return `<div class="mgw-summary-side"><span class="mgw-amount">${money(amount)}</span><span class="mgw-chevron" aria-hidden="true"></span></div>`}

function merchantExpenseRows(rows){
  return groupRows(rows,x=>x.vendor||x.notes||x.category||'Other').map(g=>{
    if(g.rows.length===1)return line(g.rows[0]);
    return `<details class="mgw-merchant-group"><summary><div class="mgw-merchant-copy"><b>${esc(g.name)}</b><small>${g.rows.length} transactions</small></div>${side(sum(g.rows))}</summary><div class="mgw-merchant-body">${g.rows.map(childExpenseLine).join('')}</div></details>`
  }).join('')
}
function recurringItemLine(x){
  return `<div class="mgw-line"><div><b>${esc(x.name||x.merchant||'Recurring bill')}${x.confidence==='review'?'<span class="mgw-review">Review</span>':''}</b><small>${esc([x.category,x.frequency,x.dueDay?`around day ${x.dueDay}`:'',x.active===false?'Paused':''].filter(Boolean).join(' · '))}</small></div><strong>${money(num(x.amount))}</strong></div>`
}
function recurringMerchantRows(list,activeIds){
  return groupRows(list,x=>x.merchant||x.name||'Recurring bill').map(g=>{
    if(g.rows.length===1)return recurringItemLine(g.rows[0]);
    const activeRows=g.rows.filter(x=>activeIds.has(x.id));
    return `<details class="mgw-merchant-group"><summary><div class="mgw-merchant-copy"><b>${esc(g.name)}</b><small>${g.rows.length} items · ${activeRows.length} active</small></div>${side(sum(activeRows))}</summary><div class="mgw-merchant-body">${g.rows.map(recurringItemLine).join('')}</div></details>`
  }).join('')
}
function recurring(){
  const rows=Array.isArray(db?.recurringBills)?db.recurringBills:[];
  if(!rows.length)return'';
  const groups=new Map();
  for(const x of rows){const g=x.group||x.category||'Other';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(x)}
  const active=window.MGWRecurringBills?.billsForMonth?window.MGWRecurringBills.billsForMonth(key()):rows.filter(x=>x.active!==false);
  const activeIds=new Set(active.map(x=>x.id));
  const body=[...groups].map(([g,list])=>{
    const activeList=list.filter(x=>activeIds.has(x.id));
    return `<details class="mgw-recurring-group"><summary><div class="mgw-group-copy"><b>${esc(g)}</b><small>${list.length} ${list.length===1?'item':'items'} · ${activeList.length} active</small></div>${side(sum(activeList))}</summary><div class="mgw-group-body"><div class="mgw-merchant-list">${recurringMerchantRows(list,activeIds)}</div></div></details>`
  }).join('');
  return `<details class="mgw-recurring-detail"><summary><div class="mgw-spend-main"><span class="cat-icon">🔁</span><div class="mgw-spend-copy"><b>Recurring Bills & Subscriptions</b><small>Planned commitments · separate from actual spending</small></div></div>${side(sum(active))}</summary><div class="mgw-spend-body"><div class="mgw-recurring-groups">${body}</div></div></details>`
}
function renderTop(el,cats){
  if(!el)return;
  if(!cats?.length){el.className='category-list empty-state';el.textContent='No spending data yet.';return}
  const shown=cats.slice(0,5),total=shown.reduce((t,[,v])=>t+num(v),0)||1,max=shown[0][1]||1;
  el.className='mgw-top-breakdown';
  el.innerHTML=shown.map(([cat,val])=>{
    const rows=expenses().filter(x=>(x.category||'Other')===cat).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    return `<details class="mgw-spend-detail"><summary><div class="mgw-spend-main"><span class="cat-icon">${MGW.cats[cat]||'📦'}</span><div class="mgw-spend-copy"><b>${esc(cat)}</b><small>${(val/total*100).toFixed(0)}% · ${rows.length} ${rows.length===1?'entry':'entries'}</small></div></div>${side(val)}<div class="mgw-spend-bar"><i style="width:${Math.min(100,val/max*100)}%"></i></div></summary><div class="mgw-spend-body"><div class="mgw-merchant-list">${merchantExpenseRows(rows)}</div></div></details>`
  }).join('')+recurring()
}
function enforce(){
  styles();if(typeof renderCats!=='function')return;
  const current=renderCats;if(current.__mgwDashboardBreakdown)return;
  const wrapped=function(el,cats){if(el?.id==='topCategories')return renderTop(el,cats);return current(el,cats)};
  wrapped.__mgwDashboardBreakdown=true;renderCats=wrapped;
  if(typeof renderDashboard==='function')renderDashboard();
  const badge=document.querySelector('#mgwRuntimeVersionBadge');
  if(badge){badge.textContent=`v${RELEASE} · DEV`;badge.title=`Development build ${RELEASE}`}
}
function boot(){enforce();setTimeout(enforce,0);setTimeout(enforce,250);setTimeout(enforce,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWDashboardBreakdown={version:RELEASE,render:()=>renderTop(document.querySelector('#topCategories'),catTotals(expenses()).slice(0,5)),enforce};
})();