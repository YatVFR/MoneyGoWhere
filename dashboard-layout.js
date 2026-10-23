// One owner for dashboard presentation. Preferences are UI-only; finance data
// and payment records are never written by this module.
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Math.max(0,Number(v)||0),round=v=>Math.round(v*100)/100;
const KEY='mgw-dashboard-compact-v1:'+document.documentElement.dataset.mgwEnvironment;
let preferences={};try{const parsed=JSON.parse(localStorage.getItem(KEY)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))preferences=parsed}catch{}
const bound=new WeakSet(),markup=new WeakMap();let queued=false;
function remember(node,fallback=false){if(!node?.id||bound.has(node))return;bound.add(node);node.open=typeof preferences[node.id]==='boolean'?preferences[node.id]:fallback;node.addEventListener('toggle',()=>{if(!node.isConnected)return;preferences[node.id]=node.open;try{localStorage.setItem(KEY,JSON.stringify(preferences))}catch{}})}
function section(id,title,parent){let node=document.getElementById(id);if(!node){node=document.createElement('details');node.id=id;node.className='mgw-dashboard-section';node.dataset.mgwDashboardManaged='1';node.innerHTML='<summary><b>'+esc(title)+'</b><span class="mgw-section-chevron" aria-hidden="true">›</span></summary><div class="mgw-dashboard-section-body"></div>';parent.appendChild(node)}remember(node);return node}
function body(node){return node.querySelector(':scope > .mgw-dashboard-section-body')}
function put(node,parent){if(node&&node.parentElement!==parent)parent.appendChild(node)}
const code=a=>/^[A-Z]{3}$/.test(String(a.baseCurrency||a.currency||'SGD').toUpperCase())?String(a.baseCurrency||a.currency||'SGD').toUpperCase():'SGD';
const add=(map,c,n)=>map.set(c,round((map.get(c)||0)+num(n)));
function summaryModel(database=window.db,anchor=(typeof MGW!=='undefined'?MGW.state.month:new Date())){
 const rows=(database.payLaterAccounts||[]).filter(a=>!a.archivedAt&&a.status!=='completed'),groups=window.MGWCreditManager.payLaterGroups(rows),outstanding=new Map(),due=new Map(),today=new Date(),planner=window.MGWPayLaterPlanner;today.setHours(0,0,0,0);const dateKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;let nextDate='',nextUnknown=false;const nextAmounts=new Map();
 for(const a of rows){const c=code(a);add(outstanding,c,a.outstanding);add(due,c,a.active===false?0:planner.due(a,anchor,database));if(a.active===false)continue;
  const next=a.recurrenceEnabled?planner.schedule(a).find(x=>x.date>=dateKey&&x.amount>0):a.nextDueDate&&a.nextDueDate>=dateKey?{date:a.nextDueDate,amount:a.monthlyPayment??a.installmentAmount}:null;
  if(!next)continue;if(!nextDate||next.date<nextDate){nextDate=next.date;nextAmounts.clear();nextUnknown=false}if(next.date===nextDate){if(next.amount==null)nextUnknown=true;else add(nextAmounts,c,next.amount)}
 }
 return{rows,groups,outstanding,due,nextDate,nextAmounts,nextUnknown};
}
function amounts(map){return map.size?[...map].map(([c,n])=>esc(c)+' '+n.toLocaleString('en-SG',{minimumFractionDigits:2,maximumFractionDigits:2})).join(' · '):'SGD 0.00'}
function renderPayLater(root){let card=document.getElementById('mgwPayLaterSummary');if(!card){card=document.createElement('article');card.id='mgwPayLaterSummary';card.className='card mgw-paylater-summary';card.dataset.mgwDashboardManaged='1';root.appendChild(card)}
 const s=summaryModel(),planner=window.MGWPayLaterPlanner;
 const html='<div class="card-head"><b>Pay-Later Summary</b><small>'+s.rows.length+' plans · '+s.groups.length+' platforms / vendors</small></div><dl class="mgw-compact-totals"><div><dt>Total outstanding</dt><dd>'+amounts(s.outstanding)+'</dd></div><div><dt>Due this cycle</dt><dd>'+amounts(s.due)+'</dd></div></dl><p class="mgw-next-payment"><small>Next scheduled payment</small><strong>'+(s.nextDate?esc(s.nextDate)+' · '+(s.nextAmounts.size?amounts(s.nextAmounts):'Amount not recorded')+(s.nextUnknown&&s.nextAmounts.size?' + amount not recorded':''):'None scheduled')+'</strong></p><details id="mgwPayLaterPlans" data-mgw-remember><summary>Platforms and plans</summary><div class="mgw-paylater-platforms">'+(s.groups.map(g=>'<details id="mgwPayLaterProvider-'+esc(encodeURIComponent(g.key))+'" class="mgw-paylater-platform" data-mgw-remember><summary><span>'+esc(g.label)+'</span><span class="mgw-later-count" aria-label="'+g.items.length+' plans">'+g.items.length+'</span></summary><ul>'+g.items.map(a=>'<li><div><b>'+esc(a.name||'Pay-Later plan')+'</b><small>'+(a.active===false?'Paused · ':'')+'Due this cycle: '+amounts(new Map([[code(a),a.active===false?0:planner.due(a,typeof MGW!=='undefined'?MGW.state.month:new Date(),window.db)]]))+'</small></div><strong>'+amounts(new Map([[code(a),num(a.outstanding)]]))+'</strong></li>').join('')+'</ul></details>').join('')||'<p class="mgw-muted">No ongoing Pay-Later plans.</p>')+'</div></details>';
 if(markup.get(card)!==html){card.innerHTML=html;markup.set(card,html)}for(const node of card.querySelectorAll('details[data-mgw-remember]'))remember(node);return card;
}
function apply(){const root=document.getElementById('view-dashboard');if(!root||!window.db||!window.MGWCreditManager||!window.MGWPayLaterPlanner)return;root.dataset.mgwCompact='1';
 const overview=document.getElementById('mgwMonthlyOverview')||root.querySelector('.metric-grid')?.closest('details');if(!overview)return;overview.id='mgwMonthlyOverview';overview.dataset.mgwDashboardManaged='1';remember(overview,true);
 const more=section('mgwDashboardMore','More details',root),moreBody=body(more),safe=document.getElementById('mgwSafeSpendCard');
 if(safe){safe.dataset.mgwDashboardManaged='1';let breakdown=safe.querySelector('#mgwSafeBreakdown');if(!breakdown){breakdown=document.createElement('details');breakdown.id='mgwSafeBreakdown';breakdown.innerHTML='<summary>How this is calculated</summary>';safe.appendChild(breakdown)}put(safe.querySelector('.mgw-safe-grid'),breakdown);for(const p of [...safe.children].filter(n=>n.tagName==='P'))put(p,breakdown);remember(breakdown);}
 const payLater=renderPayLater(root),spending=document.getElementById('mgwSpendingOverview')||document.getElementById('topCategories')?.closest('details.mgw-dashboard-section');if(spending){spending.id='mgwSpendingOverview';spending.dataset.mgwDashboardManaged='1';remember(spending);const title=spending.querySelector(':scope > summary b');if(title)title.textContent='Spending overview';const categories=document.getElementById('topCategories');if(categories&&!categories.querySelector('#mgwAllSpending')){const children=[...categories.children];if(children.length>3){const all=document.createElement('details');all.id='mgwAllSpending';all.innerHTML='<summary>Full category and recurring breakdown</summary>';categories.appendChild(all);for(const child of children.slice(3))all.appendChild(child);remember(all)}}}
 for(const [cardId,sectionId,title] of [['budgetAlertCard','mgwInsightSection','Spending insights'],['mgwBudgetAfterCommitments','mgwCommitmentBreakdown','Commitments and budget'],['mgwCycleActivity','mgwActivitySection','Cycle activity']]){const card=document.getElementById(cardId);if(card){const parent=section(sectionId,title,moreBody);put(card,body(parent));}}
 const accounts=document.getElementById('mgwAccountsDashboardSection');if(accounts){accounts.dataset.mgwDashboardManaged='1';const title=accounts.querySelector(':scope > summary b');if(title)title.textContent='Cards & Wallets';remember(accounts);}
 const keep=new Set([overview,safe,payLater,spending,more,root.querySelector('.month-row'),document.getElementById('mgwCycleFocus')]);for(const node of [...root.children])if(!keep.has(node))put(node,moreBody);
 for(const node of moreBody.querySelectorAll('details.mgw-dashboard-section')){node.dataset.mgwDashboardManaged='1';remember(node)}
 const monthly=document.querySelector('#monthlyDetails > details');if(monthly){monthly.id='mgwMonthlyDetailBreakdown';remember(monthly)}
 const focus=document.getElementById('mgwCycleFocus'),month=root.querySelector('.month-row');const ordered=[month,focus,overview,safe,payLater,spending,more].filter(Boolean);for(let i=0;i<ordered.length;i++)if(root.children[i]!==ordered[i])root.insertBefore(ordered[i],root.children[i]||null);
 // Covers late-rendered drill-downs without adding competing collapse buttons.
 for(const id of ['mgwPlannedIncluded','mgwActivityDrilldown'])remember(document.getElementById(id));
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
window.MGWDashboardLayout=Object.freeze({refresh:apply,schedule,summaryModel});
for(const event of ['mgw:app-ready','mgw:features-ready','mgw:accounts-changed','mgw:data-restored','mgw:recurring-changed'])document.addEventListener(event,schedule);
document.addEventListener('click',e=>{if(e.target.closest?.('[data-nav="dashboard"]'))schedule()});
apply();
})();
