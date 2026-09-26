// MoneyGoWhere recurring salary + commitment schedules.
// Local-first: schedules are stored only in the user's MoneyGoWhere browser database.
(()=>{
'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const STEPS=Object.freeze({monthly:1,bimonthly:2,quarterly:3,halfyearly:6,yearly:12});
const num=v=>Math.max(0,Number(v)||0);
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const raf=window.requestAnimationFrame?fn=>requestAnimationFrame(fn):fn=>setTimeout(fn,0);
let summarySignature='',collapseQueued=false,observer;

function ensure(){
  if(!window.db)return false;
  db.recurringIncome=Array.isArray(db.recurringIncome)?db.recurringIncome:[];
  db.recurringCommitments=Array.isArray(db.recurringCommitments)?db.recurringCommitments:[];
  db.settings=db.settings||{};
  db.settings.collapsedDashboard=db.settings.collapsedDashboard||{};
  return true;
}
function save(render=true){if(!ensure())return;try{window.MGWRecurringEngine?.sync?.(db,{persist:false})}catch(err){console.error('MoneyGoWhere recurring sync failed',err)}localStorage.setItem(MGW.key,JSON.stringify(db));document.dispatchEvent(new CustomEvent('mgw:recurring-changed',{detail:{source:'recurring-schedules'}}));summarySignature='';if(render&&typeof renderAll==='function')renderAll()}
function monthIndex(key){const [y,m]=String(key||'').split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)?y*12+m-1:NaN}
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function currentMonth(){return monthKey(new Date())}
function active(rule,key){if(!rule||rule.active===false)return false;const cur=monthIndex(key),start=monthIndex(rule.startMonth||key),end=rule.endMonth?monthIndex(rule.endMonth):Infinity;if(!Number.isFinite(cur)||!Number.isFinite(start)||cur<start||cur>end)return false;return (cur-start)%(STEPS[rule.frequency]||1)===0}
function matches(rows,key){return (rows||[]).filter(r=>active(r,key))}
function total(rows,key,getter){let out=0;for(const r of rows||[])if(active(r,key))out+=num(getter(r));return out}
function collection(kind){return kind==='income'?db.recurringIncome:db.recurringCommitments}
function validRange(start,end){return !end||monthIndex(end)>=monthIndex(start)}
function frequencyLabel(v){return {monthly:'Monthly',bimonthly:'Every 2 months',quarterly:'Quarterly',halfyearly:'Half-yearly',yearly:'Yearly'}[v]||'Monthly'}
function frequencyOptions(selected='monthly'){return Object.entries({monthly:'Monthly',bimonthly:'Every 2 months',quarterly:'Quarterly',halfyearly:'Half-yearly',yearly:'Yearly'}).map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('')}

window.MGWRecurring={
  version:RELEASE,
  ensure,
  monthKey,
  incomeForMonth:key=>(ensure(),matches(db.recurringIncome,key)),
  commitmentsForMonth:key=>(ensure(),matches(db.recurringCommitments,key)),
  incomeTotal:key=>(ensure(),total(db.recurringIncome,key,x=>x.netSalary)),
  commitmentTotal:key=>(ensure(),total(db.recurringCommitments,key,x=>x.amount)),
  addIncome:r=>{ensure();db.recurringIncome.push({id:uid('RINC'),active:true,frequency:'monthly',...r});save();return true},
  addCommitment:r=>{ensure();db.recurringCommitments.push({id:uid('RCOM'),active:true,frequency:'monthly',...r});save();return true},
  update:(kind,id,patch)=>{ensure();const x=collection(kind).find(v=>v.id===id);if(!x)return false;Object.assign(x,patch);save();return true},
  remove:(kind,id)=>{ensure();const key=kind==='income'?'recurringIncome':'recurringCommitments',before=db[key].length;db[key]=db[key].filter(x=>x.id!==id);if(db[key].length===before)return false;save();return true}
};

function installStyles(){
  if(document.querySelector('#mgwV155RecurringStyles'))return;
  const s=document.createElement('style');s.id='mgwV155RecurringStyles';
  s.textContent=`
.mgw-collapse-btn{margin-left:auto;border:0;background:rgba(15,118,110,.08);color:inherit;width:34px;height:34px;border-radius:999px;font:700 1.15rem/1 system-ui;display:inline-grid;place-items:center;cursor:pointer;flex:0 0 auto}.mgw-collapse-btn:active{transform:scale(.96)}.mgw-collapse-head{display:flex;align-items:center;gap:8px}
.mgw-recurring-badge{display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(19,122,111,.1);color:#137a6f;font-size:.72rem;font-weight:700}.mgw-rec-grid{display:grid;gap:8px;margin-top:10px}.mgw-rec-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:10px 0;border-bottom:1px solid var(--border,#e4e9ea)}.mgw-rec-row small{display:block;opacity:.7;margin-top:2px}.mgw-rec-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:5px}.mgw-rec-actions button{border:0;border-radius:9px;padding:6px 8px}.mgw-rec-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.mgw-rec-toolbar button{flex:1;min-width:135px}.mgw-rec-hint{font-size:.78rem;opacity:.7;margin-top:4px}
`;
  document.head.appendChild(s);
}
function slug(v){return String(v||'section').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)||'section'}
function directHeader(el){return Array.from(el.children).find(x=>x.matches?.('.card-head,h1,h2,h3,h4'))||el.querySelector('.card-head,h1,h2,h3,h4')}
function stableKey(el,head,index){
  if(el.dataset.mgwCollapseKey)return el.dataset.mgwCollapseKey;
  const explicit=el.id||el.getAttribute('data-section')||el.getAttribute('aria-label');
  const title=head?.querySelector('b,strong,h1,h2,h3,h4')?.textContent||head?.textContent||'';
  const key=`dashboard-${slug(explicit||title||index)}`;el.dataset.mgwCollapseKey=key;return key;
}
function makeCollapsible(el,index){
  if(!el||el.dataset.mgwCollapse==='1')return;
  const head=directHeader(el);if(!head)return;
  const key=stableKey(el,head,index);el.dataset.mgwCollapse='1';head.classList.add('mgw-collapse-head');
  const b=document.createElement('button');b.type='button';b.className='mgw-collapse-btn';b.setAttribute('aria-label','Collapse section');
  const content=Array.from(el.children).filter(child=>child!==head);
  const apply=closed=>{for(const child of content)child.hidden=closed;b.textContent=closed?'›':'⌄';b.setAttribute('aria-expanded',String(!closed));b.setAttribute('aria-label',closed?'Expand section':'Collapse section')};
  apply(Boolean(db.settings.collapsedDashboard[key]));
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const closed=b.getAttribute('aria-expanded')==='true';apply(closed);db.settings.collapsedDashboard[key]=closed;save(false)});
  head.appendChild(b);
}
function dashboardCards(root){const seen=new Set(),out=[];for(const el of root.querySelectorAll('article.card,.card')){if(seen.has(el))continue;seen.add(el);if(el.closest('#view-dashboard')===root)out.push(el)}return out}
function installCollapse(){if(collapseQueued)return;collapseQueued=true;raf(()=>{collapseQueued=false;if(!ensure())return;const root=document.querySelector('#view-dashboard');if(!root)return;dashboardCards(root).forEach((el,i)=>makeCollapsible(el,i))})}

function showModal(title,html){const m=document.querySelector('#modal'),body=document.querySelector('#modalBody'),head=document.querySelector('#modalTitle');if(!m||!body||!head)return null;head.textContent=title;body.innerHTML=html;m.showModal();return body}
function closeModal(){document.querySelector('#modal')?.close()}
function notify(text){if(typeof toast==='function')toast(text)}

function openIncomeSchedule(x={}){
  if(!ensure())return;
  const edit=Boolean(x.id),start=x.startMonth||currentMonth();
  const body=showModal(edit?'Edit Recurring Salary':'Add Recurring Salary',`<form id="mgwRecurringIncomeForm" class="form-grid">
    <div class="field full"><label>Name</label><input name="name" required value="${esc(x.name||'Salary')}" placeholder="Monthly salary"></div>
    <div class="field"><label>Base Salary</label><input name="baseSalary" type="number" min="0" step="0.01" value="${x.baseSalary??''}"></div>
    <div class="field"><label>Net Salary</label><input name="netSalary" type="number" min="0" step="0.01" required value="${x.netSalary??''}"></div>
    <div class="field"><label>Frequency</label><select name="frequency">${frequencyOptions(x.frequency||'monthly')}</select></div>
    <div class="field"><label>Expected Pay Day</label><input name="payDay" type="number" min="1" max="31" value="${x.payDay??''}" placeholder="25"></div>
    <div class="field"><label>Start Month</label><input name="startMonth" type="month" required value="${start}"></div>
    <div class="field"><label>End Month (optional)</label><input name="endMonth" type="month" value="${x.endMonth||''}"></div>
    <div class="field full"><p class="mgw-rec-hint">MGW uses this salary automatically for planning when no actual income entry exists for that month. An end month stops the schedule automatically.</p></div>
    <div class="field full"><button class="primary-btn">${edit?'Save Recurring Salary':'Add Recurring Salary'}</button></div>
    ${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteRecurringIncome">Delete Recurring Salary</button></div>':''}
  </form>`);
  if(!body)return;
  const f=body.querySelector('form');
  f.addEventListener('submit',e=>{
    e.preventDefault();const o=Object.fromEntries(new FormData(f));
    if(!validRange(o.startMonth,o.endMonth)){notify('End month cannot be before start month');return}
    o.baseSalary=num(o.baseSalary);o.netSalary=num(o.netSalary);o.payDay=o.payDay===''?'':Math.min(31,Math.max(1,Number(o.payDay)||1));o.active=x.active!==false;
    if(edit)window.MGWRecurring.update('income',x.id,o);else window.MGWRecurring.addIncome(o);
    closeModal();notify(edit?'Recurring salary updated':'Recurring salary added');
  },{once:true});
  body.querySelector('#mgwDeleteRecurringIncome')?.addEventListener('click',()=>{if(!confirm('Delete this recurring salary schedule? Existing income records will not be deleted.'))return;window.MGWRecurring.remove('income',x.id);closeModal();notify('Recurring salary deleted')},{once:true});
}

function openCommitmentSchedule(x={}){
  if(!ensure())return;
  const edit=Boolean(x.id),start=x.startMonth||currentMonth();
  const body=showModal(edit?'Edit Recurring Commitment':'Add Recurring Commitment',`<form id="mgwRecurringCommitmentForm" class="form-grid">
    <div class="field full"><label>Name</label><input name="name" required value="${esc(x.name||'')}" placeholder="e.g. Childcare, allowance, loan"></div>
    <div class="field full"><label>Merchant / Match Name (optional)</label><input name="merchant" value="${esc(x.merchant||'')}" placeholder="Used to match an actual expense"></div>
    <div class="field"><label>Amount</label><input name="amount" type="number" min="0" step="0.01" required value="${x.amount??''}"></div>
    <div class="field"><label>Frequency</label><select name="frequency">${frequencyOptions(x.frequency||'monthly')}</select></div>
    <div class="field"><label>Expected Day</label><input name="dueDay" type="number" min="1" max="31" value="${x.dueDay??''}"></div>
    <div class="field"><label>Start Month</label><input name="startMonth" type="month" required value="${start}"></div>
    <div class="field"><label>End Month (optional)</label><input name="endMonth" type="month" value="${x.endMonth||''}"></div>
    <div class="field full"><p class="mgw-rec-hint">Leave End Month blank for an ongoing commitment. Set it when the commitment has a known final month.</p></div>
    <div class="field full"><button class="primary-btn">${edit?'Save Recurring Commitment':'Add Recurring Commitment'}</button></div>
    ${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteRecurringCommitment">Delete Recurring Commitment</button></div>':''}
  </form>`);
  if(!body)return;
  const f=body.querySelector('form');
  f.addEventListener('submit',e=>{
    e.preventDefault();const o=Object.fromEntries(new FormData(f));
    if(!validRange(o.startMonth,o.endMonth)){notify('End month cannot be before start month');return}
    o.amount=num(o.amount);o.dueDay=o.dueDay===''?'':Math.min(31,Math.max(1,Number(o.dueDay)||1));o.active=x.active!==false;
    if(edit)window.MGWRecurring.update('commitment',x.id,o);else window.MGWRecurring.addCommitment(o);
    closeModal();notify(edit?'Recurring commitment updated':'Recurring commitment added');
  },{once:true});
  body.querySelector('#mgwDeleteRecurringCommitment')?.addEventListener('click',()=>{if(!confirm('Delete this recurring commitment? Existing expense records will not be deleted.'))return;window.MGWRecurring.remove('commitment',x.id);closeModal();notify('Recurring commitment deleted')},{once:true});
}

window.MGWRecurring.openIncome=openIncomeSchedule;
window.MGWRecurring.openCommitment=openCommitmentSchedule;

function installAddActions(){
  const grid=document.querySelector('#view-add .action-grid');if(!grid)return;
  if(!grid.querySelector('[data-mgw-open-recurring-income]')){
    const b=document.createElement('button');b.className='action-card';b.type='button';b.dataset.mgwOpenRecurringIncome='1';b.innerHTML='<span>💼</span><b>Recurring Salary</b><small>Set once · auto every month</small>';
    const income=grid.querySelector('[data-open="income"]');income?.insertAdjacentElement('afterend',b);
  }
  if(!grid.querySelector('[data-mgw-open-recurring-commitment]')){
    const b=document.createElement('button');b.className='action-card';b.type='button';b.dataset.mgwOpenRecurringCommitment='1';b.innerHTML='<span>🔁</span><b>Recurring Commitment</b><small>Repeat until an optional end month</small>';
    grid.appendChild(b);
  }
  if(!grid.querySelector('[data-mgw-open-recurring-bill]')){
    const b=document.createElement('button');b.className='action-card';b.type='button';b.dataset.mgwOpenRecurringBill='1';b.innerHTML='<span>🧾</span><b>Recurring Bill</b><small>Subscriptions & bills with end month</small>';
    grid.appendChild(b);
  }
  if(grid.dataset.mgwRecurringBound!=='1'){
    grid.dataset.mgwRecurringBound='1';grid.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.mgwOpenRecurringIncome)return openIncomeSchedule();
      if(b.dataset.mgwOpenRecurringCommitment)return openCommitmentSchedule();
      if(b.dataset.mgwOpenRecurringBill){const fn=window.MGWRecurringBills?.openEditor;if(typeof fn==='function')fn();else notify('Recurring bill manager is still loading. Please try again.')}
    });
  }
}

function installRecurringSettings(){
  const settings=document.querySelector('#view-settings');if(!settings)return;
  let card=document.querySelector('#mgwRecurringSettings');
  if(!card){card=document.createElement('article');card.className='card';card.id='mgwRecurringSettings';settings.insertBefore(card,settings.querySelector('.privacy-note')||null)}
  if(card.dataset.mgwBound!=='1'){
    card.dataset.mgwBound='1';card.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.recAdd==='income')return openIncomeSchedule();
      if(b.dataset.recAdd==='commitment')return openCommitmentSchedule();
      if(b.dataset.recAdd==='bill'){const fn=window.MGWRecurringBills?.openEditor;if(typeof fn==='function')fn();return}
      const id=b.dataset.recEdit,kind=b.dataset.recKind;if(id&&kind){const row=collection(kind).find(x=>x.id===id);if(row)return kind==='income'?openIncomeSchedule(row):openCommitmentSchedule(row)}
      if(b.dataset.recToggle&&kind){const row=collection(kind).find(x=>x.id===b.dataset.recToggle);if(row){row.active=row.active===false;save();notify(row.active===false?'Recurring schedule paused':'Recurring schedule resumed')}}
    })
  }
}
function renderSummary(){
  const card=document.querySelector('#mgwRecurringSettings');if(!card||!ensure())return;
  const sig=JSON.stringify([db.recurringIncome,db.recurringCommitments]);if(sig===summarySignature&&card.querySelector('#mgwRecurringSummary'))return;summarySignature=sig;
  const rows=[];
  for(const x of db.recurringIncome)rows.push({name:x.name||'Salary',amount:num(x.netSalary),kind:'income',label:'Salary',x});
  for(const x of db.recurringCommitments)rows.push({name:x.name||'Commitment',amount:num(x.amount),kind:'commitment',label:'Commitment',x});
  const content=rows.length?rows.map(r=>`<div class="mgw-rec-row"><div><b>${esc(r.name)}</b><small>${r.label} · ${esc(frequencyLabel(r.x.frequency))}${r.x.payDay?` · pay day ${r.x.payDay}`:r.x.dueDay?` · around day ${r.x.dueDay}`:''}</small><small>${esc(r.x.startMonth||'now')} → ${esc(r.x.endMonth||'ongoing')}${r.x.active===false?' · Paused':''}</small></div><div><strong>${money(r.amount)}</strong><span class="mgw-recurring-badge">🔁 Recurring</span><div class="mgw-rec-actions"><button data-rec-edit="${r.x.id}" data-rec-kind="${r.kind}">Edit</button><button data-rec-toggle="${r.x.id}" data-rec-kind="${r.kind}">${r.x.active===false?'Resume':'Pause'}</button></div></div></div>`).join(''):'<p class="mgw-muted">No recurring salary or general commitment schedules configured yet.</p>';
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">🔁</span><b>Recurring Schedules</b></div></div><p class="mgw-muted">Set salary and commitments once instead of re-entering them every month. Every schedule can have an optional end month.</p><div class="mgw-rec-toolbar"><button class="primary-btn" data-rec-add="income">＋ Recurring Salary</button><button data-rec-add="commitment">＋ Commitment</button><button data-rec-add="bill">＋ Bill / Subscription</button></div><div class="mgw-rec-grid" id="mgwRecurringSummary">${content}</div>`;
}
function render(){if(!ensure())return;installRecurringSettings();renderSummary();installAddActions();installCollapse()}
function boot(){
  if(!ensure())return;installStyles();render();
  // Avoid a subtree observer on the dashboard: renderAll already gives this
  // feature a deterministic refresh point and the observer caused redundant
  // work while Settings modules were being installed.
  if(typeof renderAll==='function'&&!renderAll.__mgwRecurringSchedules){const base=renderAll;const wrapped=function(){base();render()};wrapped.__mgwRecurringSchedules=true;renderAll=wrapped}
  document.addEventListener('mgw:data-restored',()=>requestAnimationFrame(render));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
