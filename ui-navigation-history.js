// MoneyGoWhere v1.5.5-dev.10 — navigation, grouped card dashboard and purchase history
(()=>{
'use strict';
const RELEASE='1.5.5-dev.10';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v)||0;
const norm=v=>String(v||'').replace(/^[^A-Za-z0-9]+/,'').trim().replace(/\s+/g,' ').toUpperCase();
const monthLabel=key=>{const [y,m]=String(key).split('-').map(Number);const d=new Date(y,m-1,1);return Number.isNaN(d.getTime())?key:d.toLocaleDateString('en-SG',{month:'long',year:'numeric'})};

function installStyles(){
  if(document.querySelector('#mgwUiHistoryStyles'))return;
  const s=document.createElement('style');s.id='mgwUiHistoryStyles';s.textContent=`
    .mgw-duplicate-card-group,.mgw-history-month,.mgw-history-merchant{border:1px solid var(--border,#dbe4e4);border-radius:14px;overflow:hidden;background:var(--card,#fff)}
    .mgw-duplicate-card-group>summary,.mgw-history-month>summary,.mgw-history-merchant>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center}
    .mgw-duplicate-card-group>summary::-webkit-details-marker,.mgw-history-month>summary::-webkit-details-marker,.mgw-history-merchant>summary::-webkit-details-marker{display:none}
    .mgw-duplicate-card-group>summary{padding:12px 14px;background:rgba(18,130,119,.045)}
    .mgw-duplicate-card-body{display:grid;gap:8px;padding:8px}
    .mgw-duplicate-card-body>.mgw-account{margin:0}
    .mgw-parent-copy b,.mgw-parent-copy small,.mgw-history-copy b,.mgw-history-copy small{display:block;min-width:0}.mgw-parent-copy small,.mgw-history-copy small{opacity:.65;margin-top:2px}
    .mgw-parent-right,.mgw-history-right{display:flex;align-items:center;gap:9px;white-space:nowrap;text-align:right}.mgw-parent-right strong,.mgw-history-right strong{display:block}
    .mgw-ui-chevron{display:inline-block;font-size:1.15rem;line-height:1;transition:transform .18s ease;opacity:.65}
    details[open]>summary .mgw-ui-chevron{transform:rotate(90deg)}
    #mgwPurchaseHistory{margin-top:14px}.mgw-history-list{display:grid;gap:10px}.mgw-history-month>summary{padding:12px 14px;background:rgba(18,130,119,.035)}
    .mgw-history-month-body{display:grid;gap:8px;padding:8px 10px 10px;border-top:1px solid var(--border,#eef1f1)}
    .mgw-history-merchant>summary{padding:10px 12px}.mgw-history-merchant-body{padding:0 12px 5px;border-top:1px solid var(--border,#eef1f1)}
    .mgw-history-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:9px 2px;border-bottom:1px solid var(--border,#eef1f1);align-items:start}.mgw-history-line:last-child{border-bottom:0}.mgw-history-line b,.mgw-history-line small{display:block}.mgw-history-line small{opacity:.65;margin-top:2px}.mgw-history-line strong{white-space:nowrap}
    @media(max-width:520px){.mgw-parent-right strong,.mgw-history-right strong{font-size:.92rem}.mgw-duplicate-card-group>summary,.mgw-history-month>summary{padding:11px 12px}}
  `;document.head.appendChild(s)
}

function installNavigation(){
  const bar=document.querySelector('.bottom-nav');if(!bar)return;
  const desired=['add','dashboard','insights','settings'];
  const labels={add:['＋','Add New'],dashboard:['⌂','Dashboards'],insights:['▥','Insights'],settings:['⚙','Settings']};
  desired.forEach(name=>{const b=bar.querySelector(`[data-nav="${name}"]`);if(!b)return;const [icon,label]=labels[name];const span=b.querySelector('span'),small=b.querySelector('small');if(span)span.textContent=icon;if(small)small.textContent=label;bar.appendChild(b)});
  if(typeof nav==='function'&&!nav.__mgwUiNav){const base=nav;const wrapped=function(name){base(name);const t=document.querySelector('#pageTitle');if(t)t.textContent={add:'Add New',dashboard:'Dashboards',insights:'Insights',settings:'Settings'}[name]||t.textContent};wrapped.__mgwUiNav=true;nav=wrapped}
}

function cardAccountName(node){
  const b=node.querySelector('.mgw-account-summary b,.mgw-account-head b');return norm(b?.textContent||'')
}
function groupDuplicateCards(){
  const host=document.querySelector('#mgwAccountsDashboard .mgw-account-grid');if(!host)return;
  host.querySelectorAll(':scope > .mgw-duplicate-card-group').forEach(g=>{const body=g.querySelector('.mgw-duplicate-card-body');if(body)while(body.firstChild)host.insertBefore(body.firstChild,g);g.remove()});
  const modelGroups=new Map();(db?.creditAccounts||[]).forEach(a=>{const k=norm(a.name);if(!k)return;if(!modelGroups.has(k))modelGroups.set(k,[]);modelGroups.get(k).push(a)});
  for(const [key,models] of modelGroups){
    if(models.length<2)continue;
    const nodes=[...host.querySelectorAll(':scope > .mgw-account')].filter(n=>cardAccountName(n)===key);if(nodes.length<2)continue;
    const name=models[0].name||key,total=models.reduce((t,a)=>t+num(a.outstanding),0);
    const details=document.createElement('details');details.className='mgw-duplicate-card-group';
    details.innerHTML=`<summary><div class="mgw-parent-copy"><b>💳 ${esc(name)}</b><small>${nodes.length} card entries grouped</small></div><div class="mgw-parent-right"><strong>${money(total)}</strong><i class="mgw-ui-chevron">›</i></div></summary><div class="mgw-duplicate-card-body"></div>`;
    host.insertBefore(details,nodes[0]);const body=details.querySelector('.mgw-duplicate-card-body');nodes.forEach(n=>body.appendChild(n));
  }
}

function expenseMerchant(x){return String(x.vendor||x.merchant||x.notes||x.category||'Other').trim()||'Other'}
function expenseLine(x){const meta=[String(x.date||'').slice(0,10),x.location,x.notes].filter(Boolean).join(' · ');return `<div class="mgw-history-line"><div><b>${esc(expenseMerchant(x))}</b><small>${esc(meta)}</small></div><strong>${money(num(x.amount))}</strong></div>`}
function groupedHistoryRows(rows){
  const map=new Map();for(const x of rows){const name=expenseMerchant(x),k=norm(name);if(!map.has(k))map.set(k,{name,rows:[]});map.get(k).rows.push(x)}
  return [...map.values()].sort((a,b)=>Math.max(...b.rows.map(x=>String(x.date||'').replace(/\D/g,'')||0))-Math.max(...a.rows.map(x=>String(x.date||'').replace(/\D/g,'')||0))).map(g=>{
    g.rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||num(b.amount)-num(a.amount));
    if(g.rows.length===1)return expenseLine(g.rows[0]);
    const total=g.rows.reduce((t,x)=>t+num(x.amount),0);
    return `<details class="mgw-history-merchant"><summary><div class="mgw-history-copy"><b>${esc(g.name)}</b><small>${g.rows.length} purchases</small></div><div class="mgw-history-right"><strong>${money(total)}</strong><i class="mgw-ui-chevron">›</i></div></summary><div class="mgw-history-merchant-body">${g.rows.map(expenseLine).join('')}</div></details>`
  }).join('')
}
function installPurchaseHistory(){
  const view=document.querySelector('#view-insights');if(!view)return;
  let card=document.querySelector('#mgwPurchaseHistory');if(!card){card=document.createElement('article');card.className='card';card.id='mgwPurchaseHistory';view.appendChild(card)}
  const rows=[...(db?.expenses||[])].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.time||'').localeCompare(String(a.time||'')));
  const months=new Map();for(const x of rows){const k=String(x.date||'').slice(0,7)||'Unknown';if(!months.has(k))months.set(k,[]);months.get(k).push(x)}
  const body=[...months.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([k,list])=>{const total=list.reduce((t,x)=>t+num(x.amount),0);return `<details class="mgw-history-month"><summary><div class="mgw-history-copy"><b>${esc(monthLabel(k))}</b><small>${list.length} ${list.length===1?'purchase':'purchases'}</small></div><div class="mgw-history-right"><strong>${money(total)}</strong><i class="mgw-ui-chevron">›</i></div></summary><div class="mgw-history-month-body">${groupedHistoryRows(list)}</div></details>`}).join('');
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">🧾</span><b>Purchase History</b></div></div><p class="mgw-muted">Browse historical purchases by month. Repeated merchants are grouped automatically.</p><div class="mgw-history-list">${body||'<p class="empty-state">No purchase history yet.</p>'}</div>`
}
function refreshUi(){installNavigation();installPurchaseHistory();queueMicrotask(groupDuplicateCards);setTimeout(groupDuplicateCards,80);setTimeout(groupDuplicateCards,350)}
function boot(){installStyles();installNavigation();if(typeof renderAll==='function'&&!renderAll.__mgwUiHistory){const base=renderAll;const wrapped=function(){base();queueMicrotask(refreshUi)};wrapped.__mgwUiHistory=true;renderAll=wrapped}refreshUi();const badge=document.querySelector('#mgwRuntimeVersionBadge');if(badge){badge.textContent=`v${RELEASE} · DEV`;badge.title=`Development build ${RELEASE}`}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWUiHistory={version:RELEASE,refresh:refreshUi};
})();