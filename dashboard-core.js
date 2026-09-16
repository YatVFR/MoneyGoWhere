// MoneyGoWhere v1.5.5-dev.57 — consolidated dashboard accounting and mobile layout.
// One source of truth for commitments, planned balance, safe-to-spend and cycle budget.
(()=>{
'use strict';
const RELEASE='1.5.5-dev.57';
const STEPS={monthly:1,bimonthly:2,quarterly:3,halfyearly:6,yearly:12};
const num=v=>Math.max(0,Number(v)||0);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const fx=x=>window.MGWCurrency?.sgdAmount?window.MGWCurrency.sgdAmount(x):num(x?.amount);
const cycleKey=()=>`${MGW.state.month.getFullYear()}-${String(MGW.state.month.getMonth()+1).padStart(2,'0')}`;
const monthIndex=k=>{const [y,m]=String(k||'').split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)?y*12+m-1:NaN};
const inCycle=x=>typeof mgwInCycle==='function'?mgwInCycle(x,MGW.state.month):String(x?.date||'').startsWith(cycleKey());

function ensure(){
  db.settings=db.settings||{};
  db.monthlyCommitments=Array.isArray(db.monthlyCommitments)?db.monthlyCommitments:[];
  db.recurringIncome=Array.isArray(db.recurringIncome)?db.recurringIncome:[];
  db.recurringCommitments=Array.isArray(db.recurringCommitments)?db.recurringCommitments:[];
  db.recurringBills=Array.isArray(db.recurringBills)?db.recurringBills:[];
  db.creditAccounts=Array.isArray(db.creditAccounts)?db.creditAccounts:[];
  db.creditPayments=Array.isArray(db.creditPayments)?db.creditPayments:[];
  db.payLaterAccounts=Array.isArray(db.payLaterAccounts)?db.payLaterAccounts:[];
  db.payLaterPayments=Array.isArray(db.payLaterPayments)?db.payLaterPayments:[];
}
function activeRule(rule,key=cycleKey()){
  if(!rule||rule.active===false)return false;
  const cur=monthIndex(key),start=monthIndex(rule.startMonth||key),end=rule.endMonth?monthIndex(rule.endMonth):Infinity;
  if(!Number.isFinite(cur)||!Number.isFinite(start)||cur<start||cur>end)return false;
  return (cur-start)%(STEPS[rule.frequency]||1)===0;
}
function actualIncome(){return (db.income||[]).filter(inCycle).reduce((t,x)=>t+num(x.netSalary),0)}
function scheduledIncome(){return db.recurringIncome.filter(x=>activeRule(x)).reduce((t,x)=>t+num(x.netSalary),0)}
function cyclePayment(rows,id){return rows.filter(x=>String(x.accountId||'')===String(id||'')&&inCycle(x)).reduce((t,x)=>t+num(x.amount),0)}
function fixedItems(){
  const out=[];
  for(const x of db.monthlyCommitments)if(x.active!==false&&num(x.amount)>0)out.push({kind:'fixed',source:'Fixed monthly',name:x.name||x.type||'Monthly commitment',merchant:x.merchant||'',amount:num(x.amount),term:''});
  for(const x of db.recurringCommitments)if(activeRule(x)&&num(x.amount)>0)out.push({kind:'schedule',source:'Recurring schedule',name:x.name||'Recurring commitment',merchant:x.merchant||'',amount:num(x.amount),term:[x.startMonth,x.endMonth||'ongoing'].filter(Boolean).join(' → ')});
  for(const x of db.recurringBills)if(activeRule(x)&&num(x.amount)>0)out.push({kind:'bill',source:'Recurring bill',name:x.name||x.merchant||'Recurring bill',merchant:x.merchant||x.name||'',amount:num(x.amount),term:[x.startMonth,x.endMonth||'ongoing'].filter(Boolean).join(' → ')});
  return out;
}
function debtItems(){
  return db.creditAccounts.filter(a=>a.role==='debt'||a.role==='emergency-debt').map(a=>{
    const paid=cyclePayment(db.creditPayments,a.id),planned=num(a.plannedPayment);
    return {source:'Debt repayment',name:a.nickname||a.name||a.cardProduct||'Credit card debt',amount:Math.max(planned,paid),planned,paid};
  }).filter(x=>x.amount>0);
}
function payLaterItems(){
  return db.payLaterAccounts.map(a=>{
    const paid=cyclePayment(db.payLaterPayments,a.id),due=num(a.cycleDue||a.monthlyPayment||a.installmentAmount);
    return {source:'Pay-Later',name:a.name||a.provider||'Pay-Later',amount:Math.max(due,paid),due,paid};
  }).filter(x=>x.amount>0);
}
function matchRecurring(items,expenses){
  const used=new Set(),matches=new Map();
  for(let i=0;i<items.length;i++){
    const item=items[i],needle=norm(item.merchant||item.name);if(!needle)continue;
    let best=-1,bestDiff=Infinity;
    for(let j=0;j<expenses.length;j++){
      if(used.has(j))continue;
      const row=expenses[j],hay=norm([row.vendor,row.merchant,row.notes].filter(Boolean).join(' '));
      if(!hay||!(hay===needle||hay.includes(needle)||needle.includes(hay)))continue;
      const diff=Math.abs(fx(row)-item.amount),tol=Math.max(2,item.amount*.35);
      if(diff<=tol&&diff<bestDiff){best=j;bestDiff=diff}
    }
    if(best>=0){used.add(best);matches.set(i,best)}
  }
  return {used,matches};
}
function payLaterNames(){return db.payLaterAccounts.map(a=>norm(a.name||a.provider)).filter(Boolean)}
function model(){
  ensure();
  const actual=actualIncome(),scheduled=scheduledIncome(),income=actual>0?actual:scheduled;
  const fixed=fixedItems(),debt=debtItems(),later=payLaterItems(),reserve=num(db.settings?.safeSpend?.reserve);
  const fixedTotal=fixed.reduce((t,x)=>t+x.amount,0),debtTotal=debt.reduce((t,x)=>t+x.amount,0),laterTotal=later.reduce((t,x)=>t+x.amount,0);
  const commitmentsTotal=fixedTotal+debtTotal+laterTotal+reserve;
  const plannedBalance=Math.max(0,income-commitmentsTotal);
  const expenses=(db.expenses||[]).filter(inCycle),{used:matchedRecurring}=matchRecurring(fixed,expenses),deferred=payLaterNames();
  let dayToDay=0,postedRecurring=0;
  for(let i=0;i<expenses.length;i++){
    const row=expenses[i];
    if(matchedRecurring.has(i)){postedRecurring+=fx(row);continue}
    const payment=norm(row.card||row.paymentSource||row.paymentMethod);
    if(payment&&deferred.some(n=>payment===n||payment.includes(n)||n.includes(payment)))continue;
    dayToDay+=fx(row);
  }
  const liveBalance=Math.max(0,plannedBalance-dayToDay);
  const budget=num(db.budgets?.monthly),budgetUsed=commitmentsTotal+dayToDay,budgetRemaining=budget?Math.max(0,budget-budgetUsed):null;
  const safe=budgetRemaining===null?liveBalance:Math.min(liveBalance,budgetRemaining);
  let days=1;
  if(typeof mgwCycleBounds==='function'){const end=new Date(mgwCycleBounds(MGW.state.month).end),now=new Date();now.setHours(0,0,0,0);end.setHours(0,0,0,0);days=Math.max(1,Math.ceil((end-now)/86400000))}
  return {income,actualIncome:actual,scheduledIncome:scheduled,fixed,debt,later,reserve,fixedTotal,debtTotal,laterTotal,commitmentsTotal,plannedBalance,dayToDay,postedRecurring,liveBalance,budget,budgetUsed,budgetRemaining,safe,days};
}
function moneyText(v){return typeof money==='function'?money(v):`SGD ${num(v).toFixed(2)}`}
function groupLines(items){
  if(!items.length)return'<p class="mgw-muted">None configured for this cycle.</p>';
  return items.map(x=>`<div class="mgw-obligation-line"><span>${esc(x.name)}<small>${esc([x.source,x.term].filter(Boolean).join(' · '))}</small></span><strong>${moneyText(x.amount)}</strong></div>`).join('');
}
function installStyles(){
  if(document.querySelector('#mgwDashboardCoreCss'))return;
  const s=document.createElement('style');s.id='mgwDashboardCoreCss';
  s.textContent=`
.metric-grid.mgw-core-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}
.metric-grid.mgw-core-metrics .metric:nth-child(4){display:none!important}
.metric-grid.mgw-core-metrics .metric small{display:none!important}
.mgw-cycle-focus{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:-3px 0 12px;padding:9px 11px;border:1px solid var(--line,#e4e9e7);border-radius:16px;background:var(--brand-soft,#e8f5f2)}
.mgw-cycle-focus b,.mgw-cycle-focus small{display:block}.mgw-cycle-focus small{color:var(--muted,#6b7774);margin-top:2px}
.mgw-budget-after .mgw-budget-hero{text-align:center;padding:8px 0 14px}.mgw-budget-after .mgw-budget-hero strong{display:block;font-size:1.8rem;margin:4px 0}
.mgw-budget-grid,.mgw-safe-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 14px;font-size:.92rem}.mgw-budget-grid strong,.mgw-safe-grid strong{text-align:right;white-space:nowrap}
.mgw-obligation-details{margin-top:12px;border-top:1px solid var(--line,#e4e9e7);padding-top:8px}.mgw-obligation-details>summary{cursor:pointer;list-style:none;font-weight:800;display:flex;justify-content:space-between;align-items:center;padding:7px 0}.mgw-obligation-details>summary::-webkit-details-marker{display:none}.mgw-obligation-details[open]>summary i{transform:rotate(90deg)}.mgw-obligation-details i{font-style:normal;transition:.15s}
.mgw-obligation-body{display:grid;gap:4px;padding-top:4px}.mgw-obligation-body h4{margin:8px 0 2px}.mgw-obligation-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:6px 0;border-bottom:1px solid var(--line,#eef2f1)}.mgw-obligation-line span,.mgw-obligation-line small{display:block}.mgw-obligation-line small{opacity:.62;margin-top:2px}.mgw-obligation-line strong{white-space:nowrap}
.mgw-budget-reserve-breakdown{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:.78rem;color:var(--muted,#6b7774)}.mgw-budget-reserve-breakdown b{color:var(--text,#18221f)}
.mgw-advice{display:grid;gap:9px}.mgw-advice-item{padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.07)}.mgw-advice-item b{display:block;margin-bottom:3px}
.mgw-commit-list{display:grid;gap:10px;margin-top:12px}.mgw-commit{border:1px solid var(--line,#dbe4e4);border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:12px;align-items:center}.mgw-commit small{display:block;opacity:.7}.mgw-commit-actions{display:flex;gap:6px;flex-wrap:wrap}.mgw-commit-actions button{border:0;border-radius:9px;padding:7px 9px}
@media(max-width:759px){
  .metric-grid.mgw-core-metrics{gap:8px}.metric-grid.mgw-core-metrics .metric{padding:12px 9px}.metric-grid.mgw-core-metrics .metric span{font-size:.72rem}.metric-grid.mgw-core-metrics .metric strong{font-size:1.06rem}
}
`;
  document.head.appendChild(s);
}
function ensureUi(){
  const dashboard=document.querySelector('#view-dashboard'),advisor=document.querySelector('#budgetAlertCard'),month=document.querySelector('.month-row');
  if(month&&!document.querySelector('#mgwCycleFocus')){const el=document.createElement('div');el.id='mgwCycleFocus';el.className='mgw-cycle-focus';month.insertAdjacentElement('afterend',el)}
  if(dashboard&&advisor&&!document.querySelector('#mgwBudgetAfterCommitments')){const card=document.createElement('article');card.className='card mgw-budget-after';card.id='mgwBudgetAfterCommitments';advisor.insertAdjacentElement('afterend',card)}
  const settings=document.querySelector('#view-settings');
  if(settings&&!document.querySelector('#mgwCommitmentSettings')){const card=document.createElement('article');card.className='card';card.id='mgwCommitmentSettings';settings.insertBefore(card,settings.querySelector('.privacy-note')||null)}
}
function renderCycleFocus(){
  const el=document.querySelector('#mgwCycleFocus');if(!el)return;
  const c=typeof mgwCycleSettings==='function'?mgwCycleSettings():{mode:'calendar'};
  el.innerHTML=`<div><b>${c.mode==='payday'?'Current pay cycle':'Current month'}</b><small>${typeof mgwCycleLabel==='function'?mgwCycleLabel(MGW.state.month):''}</small></div><span aria-hidden="true">📅</span>`;
}
function renderMetrics(p){
  const grid=document.querySelector('.metric-grid');if(!grid)return;grid.classList.add('mgw-core-metrics');
  const labels=grid.querySelectorAll('.metric>span'),vals=grid.querySelectorAll('.metric>strong');
  if(labels[0])labels[0].textContent='Net Income';if(vals[0])vals[0].textContent=moneyText(p.income);
  if(labels[1])labels[1].textContent='Commitments';if(vals[1])vals[1].textContent=moneyText(p.commitmentsTotal);
  if(labels[2])labels[2].textContent='Balance to Spend';if(vals[2])vals[2].textContent=moneyText(p.plannedBalance);
}
function renderPlanned(p){
  const card=document.querySelector('#mgwBudgetAfterCommitments');if(!card)return;
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">🧮</span><b>Budget After Commitments</b></div></div><div class="mgw-budget-hero"><small>Available before day-to-day spending</small><strong>${moneyText(p.plannedBalance)}</strong></div><div class="mgw-budget-grid"><span>Net income</span><strong>${moneyText(p.income)}</strong><span>Fixed & recurring commitments</span><strong>−${moneyText(p.fixedTotal)}</strong><span>Debt repayments</span><strong>−${moneyText(p.debtTotal)}</strong><span>Pay-Later commitments</span><strong>−${moneyText(p.laterTotal)}</strong><span>Reserved money</span><strong>−${moneyText(p.reserve)}</strong><span><b>Total commitments</b></span><strong><b>−${moneyText(p.commitmentsTotal)}</b></strong></div><details class="mgw-obligation-details"><summary>See what is included <i>›</i></summary><div class="mgw-obligation-body"><h4>Fixed & recurring</h4>${groupLines(p.fixed)}<h4>Debt repayments</h4>${groupLines(p.debt)}<h4>Pay-Later</h4>${groupLines(p.later)}</div></details><p class="mgw-muted">Net income minus active commitments for this cycle. Recurring items stay reserved until their configured term ends.</p>`;
}
function renderSafe(p){
  const card=document.querySelector('#mgwSafeSpendCard');if(!card)return;
  const head=card.querySelector('.card-head b');if(head)head.textContent='Safe to Spend';
  const hero=card.querySelector('.mgw-safe-hero');
  if(hero){const strong=hero.querySelector('strong'),smalls=hero.querySelectorAll('small');if(smalls[0])smalls[0].textContent='Available now after day-to-day spending';if(strong)strong.textContent=moneyText(p.safe);if(smalls[1])smalls[1].textContent=`${moneyText(p.safe/p.days)}/day · ${p.days} day${p.days===1?'':'s'} remaining`}
  const grid=card.querySelector('.mgw-safe-grid');
  if(grid)grid.innerHTML=`<span>Balance after commitments</span><strong>${moneyText(p.plannedBalance)}</strong><span>Day-to-day spent</span><strong>−${moneyText(p.dayToDay)}</strong>${p.budgetRemaining!==null?`<span>Cycle budget remaining</span><strong>${moneyText(p.budgetRemaining)}</strong>`:''}<span><b>Available now</b></span><strong><b>${moneyText(p.safe)}</b></strong>`;
  const note=card.querySelector('.mgw-muted');if(note)note.textContent='Recurring bills already reserved above are excluded from day-to-day spending to prevent double counting.';
}
function renderBudget(p){
  const card=document.querySelector('.budget-card');if(!card)return;
  const title=card.querySelector('.card-head b');if(title)title.textContent='Cycle Budget';
  const copy=card.querySelector('#budgetCopy'),remaining=card.querySelector('#budgetRemaining'),bar=card.querySelector('#budgetBar');
  let extra=card.querySelector('.mgw-budget-reserve-breakdown');
  if(!extra){extra=document.createElement('div');extra.className='mgw-budget-reserve-breakdown';card.querySelector('.budget-copy')?.insertAdjacentElement('afterend',extra)}
  extra.innerHTML=`<span>Committed <b>${moneyText(p.commitmentsTotal)}</b></span><span>Day-to-day <b>${moneyText(p.dayToDay)}</b></span>`;
  if(p.budget){
    const pct=p.budgetUsed/p.budget*100;
    if(copy)copy.textContent=`${moneyText(p.budgetUsed)} allocated of ${moneyText(p.budget)}`;
    if(remaining)remaining.textContent=p.budgetRemaining>0?`${moneyText(p.budgetRemaining)} available`:`${moneyText(Math.max(0,p.budgetUsed-p.budget))} over budget`;
    if(bar)bar.style.width=`${Math.min(100,pct)}%`;
    const holder=bar?.parentElement;if(holder)holder.className='progress '+(pct>=100?'over':pct>=90?'almost':pct>=80?'watch':'');
  }else{
    if(copy)copy.textContent=`${moneyText(p.commitmentsTotal)} reserved for active commitments this cycle`;
    if(remaining)remaining.textContent='Set a cycle budget to monitor discretionary room';
    if(bar)bar.style.width='0%';
  }
}
function renderAdvisor(p){
  const card=document.querySelector('#budgetAlertCard'),root=document.querySelector('#budgetAlertText');if(!card||!root)return;
  const title=card.querySelector('.card-head b'),icon=card.querySelector('.section-icon');if(title)title.textContent='Smart Spending Advisor';if(icon)icon.textContent='🧠';
  const ratio=p.income?p.commitmentsTotal/p.income:0,level=ratio>=.8?'🔴':ratio>=.6?'🟠':'🟢',label=ratio>=.8?'Commitments are very high':ratio>=.6?'Commitment pressure is elevated':'Commitments are manageable';
  root.innerHTML=`<div class="mgw-advice"><div class="mgw-advice-item"><b>${level} ${label}</b><span>${p.income?`${Math.round(ratio*100)}% of this cycle’s net income is reserved for commitments.`:'Add net income to calculate commitment pressure.'}</span></div><div class="mgw-advice-item"><b>💰 Available now</b><span>${moneyText(p.safe)} remains after commitments and ${moneyText(p.dayToDay)} of day-to-day spending.</span></div></div><p class="mgw-muted">Local rule-based guidance from your MoneyGoWhere data.</p>`;
}
function renderCommitmentSettings(){
  const host=document.querySelector('#mgwCommitmentSettings');if(!host)return;
  const rows=db.monthlyCommitments||[];
  host.innerHTML=`<div class="card-head"><div><span class="section-icon">📌</span><b>Fixed Monthly Commitments</b></div><button class="text-btn" data-core-add-commitment>＋ Add</button></div><p class="mgw-muted">Use this for fixed monthly obligations without a term. Term-based items belong under Recurring Schedules or Recurring Commitments.</p><div class="mgw-commit-list">${rows.length?rows.map(x=>`<div class="mgw-commit"><div><b>${esc(x.name||x.type||'Commitment')}</b><small>${esc(x.type||'Fixed monthly')}${x.dueDay?` · due day ${esc(x.dueDay)}`:''}${x.active===false?' · Paused':''}</small></div><div><strong>${moneyText(x.amount)}</strong><div class="mgw-commit-actions"><button data-core-edit="${esc(x.id)}">Edit</button><button data-core-toggle="${esc(x.id)}">${x.active===false?'Resume':'Pause'}</button></div></div></div>`).join(''):'<p class="mgw-muted">No fixed monthly commitments configured.</p>'}</div>`;
}
function commitmentModal(x={}){
  const m=document.querySelector('#modal'),body=document.querySelector('#modalBody'),title=document.querySelector('#modalTitle');if(!m||!body||!title)return;
  const edit=Boolean(x.id);title.textContent=edit?'Edit Fixed Commitment':'Add Fixed Commitment';
  body.innerHTML=`<form id="mgwCoreCommitForm" class="form-grid"><div class="field full"><label>Name</label><input name="name" required value="${esc(x.name||'')}"></div><div class="field"><label>Monthly amount</label><input name="amount" type="number" min="0" step="0.01" required value="${x.amount??''}"></div><div class="field"><label>Type</label><input name="type" value="${esc(x.type||'Fixed monthly')}"></div><div class="field"><label>Due day (optional)</label><input name="dueDay" type="number" min="1" max="31" value="${x.dueDay??''}"></div><div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Commitment'}</button></div>${edit?'<div class="field full"><button type="button" class="danger-btn" id="mgwCoreDeleteCommit">Delete Commitment</button></div>':''}</form>`;
  m.showModal();
  const f=body.querySelector('form');
  f.addEventListener('submit',e=>{
    e.preventDefault();const o=Object.fromEntries(new FormData(f));o.amount=num(o.amount);o.dueDay=o.dueDay===''?'':Math.min(31,Math.max(1,Number(o.dueDay)||1));o.id=x.id||`COMMIT-${Date.now()}`;o.active=x.active!==false;
    if(edit)Object.assign(x,o);else db.monthlyCommitments.push(o);
    localStorage.setItem(MGW.key,JSON.stringify(db));m.close();if(typeof renderAll==='function')renderAll();if(typeof toast==='function')toast(edit?'Commitment updated':'Commitment added');
  },{once:true});
  body.querySelector('#mgwCoreDeleteCommit')?.addEventListener('click',()=>{if(!confirm('Delete this fixed commitment?'))return;db.monthlyCommitments=db.monthlyCommitments.filter(a=>a.id!==x.id);localStorage.setItem(MGW.key,JSON.stringify(db));m.close();if(typeof renderAll==='function')renderAll();if(typeof toast==='function')toast('Commitment deleted')},{once:true});
}
function bind(){
  const host=document.querySelector('#mgwCommitmentSettings');if(!host||host.dataset.mgwCoreBound==='1')return;host.dataset.mgwCoreBound='1';
  host.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-core-add-commitment'))return commitmentModal();
    if(b.dataset.coreEdit){const x=db.monthlyCommitments.find(v=>String(v.id)===String(b.dataset.coreEdit));if(x)return commitmentModal(x)}
    if(b.dataset.coreToggle){const x=db.monthlyCommitments.find(v=>String(v.id)===String(b.dataset.coreToggle));if(x){x.active=x.active===false;localStorage.setItem(MGW.key,JSON.stringify(db));if(typeof renderAll==='function')renderAll()}}
  });
}
let applying=false;
function apply(){
  if(applying)return;applying=true;
  try{
    ensure();installStyles();ensureUi();const p=model();
    renderCycleFocus();renderMetrics(p);renderPlanned(p);renderSafe(p);renderBudget(p);renderAdvisor(p);renderCommitmentSettings();bind();
    window.MGWDashboardCore.last=p;
  }finally{applying=false}
}
function boot(){
  apply();
  if(typeof renderAll==='function'&&!renderAll.__mgwDashboardCore){
    const base=renderAll;
    renderAll=function(){base();queueMicrotask(apply)};
    renderAll.__mgwDashboardCore=true;
  }
}
window.MGWDashboardCore={version:RELEASE,model,refresh:apply,last:null};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
