// MoneyGoWhere v1.5.3 — local recurring schedules + collapsible dashboard
(()=>{
'use strict';
const RELEASE='1.5.3';
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
function save(render=true){
  if(!ensure())return;
  localStorage.setItem(MGW.key,JSON.stringify(db));
  if(render&&typeof renderAll==='function')renderAll();
}
function monthIndex(key){const [y,m]=String(key||'').split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)?y*12+m-1:NaN}
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function active(rule,key){
  if(!rule||rule.active===false)return false;
  const cur=monthIndex(key),start=monthIndex(rule.startMonth||key),end=rule.endMonth?monthIndex(rule.endMonth):Infinity;
  if(!Number.isFinite(cur)||!Number.isFinite(start)||cur<start||cur>end)return false;
  return (cur-start)%(STEPS[rule.frequency]||1)===0;
}
function matches(rows,key){return (rows||[]).filter(r=>active(r,key))}
function total(rows,key,getter){let out=0;for(const r of rows||[])if(active(r,key))out+=num(getter(r));return out}
function collection(kind){return kind==='income'?db.recurringIncome:db.recurringCommitments}

window.MGWRecurring={
  version:RELEASE,ensure,monthKey,
  incomeForMonth:key=>(ensure(),matches(db.recurringIncome,key)),
  commitmentsForMonth:key=>(ensure(),matches(db.recurringCommitments,key)),
  incomeTotal:key=>(ensure(),total(db.recurringIncome,key,x=>x.netSalary)),
  commitmentTotal:key=>(ensure(),total(db.recurringCommitments,key,x=>x.amount)),
  addIncome:r=>{ensure();db.recurringIncome.push({id:uid('INC'),active:true,frequency:'monthly',...r});summarySignature='';save()},
  addCommitment:r=>{ensure();db.recurringCommitments.push({id:uid('REC'),active:true,frequency:'monthly',...r});summarySignature='';save()},
  update:(kind,id,patch)=>{ensure();const x=collection(kind).find(v=>v.id===id);if(!x)return false;Object.assign(x,patch);summarySignature='';save();return true},
  remove:(kind,id)=>{ensure();const key=kind==='income'?'recurringIncome':'recurringCommitments',before=db[key].length;db[key]=db[key].filter(x=>x.id!==id);if(db[key].length===before)return false;summarySignature='';save();return true}
};

function installStyles(){
  if(document.querySelector('#mgwV153Styles'))return;
  const s=document.createElement('style');s.id='mgwV153Styles';
  s.textContent='.mgw-collapse-btn{margin-left:auto;border:0;background:transparent;font:inherit;padding:.25rem .4rem;cursor:pointer}.mgw-recurring-badge{display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(19,122,111,.1);color:#137a6f;font-size:.72rem;font-weight:700}.mgw-rec-grid{display:grid;gap:8px;margin-top:10px}.mgw-rec-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border,#e4e9ea)}';
  document.head.appendChild(s);
}
function makeCollapsible(el,key){
  if(!el||el.dataset.mgwCollapse)return;
  const head=el.querySelector(':scope > .card-head, :scope > h2, :scope > h3');if(!head)return;
  el.dataset.mgwCollapse='1';const b=document.createElement('button');b.type='button';b.className='mgw-collapse-btn';
  const apply=closed=>{for(const child of el.children)if(child!==head)child.hidden=closed;b.textContent=closed?'›':'⌄';b.setAttribute('aria-expanded',String(!closed));};
  apply(Boolean(db.settings.collapsedDashboard[key]));
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const closed=b.getAttribute('aria-expanded')==='true';apply(closed);db.settings.collapsedDashboard[key]=closed;save(false)});
  head.appendChild(b);
}
function installCollapse(){
  if(collapseQueued)return;collapseQueued=true;
  raf(()=>{collapseQueued=false;if(!ensure())return;const root=document.querySelector('#view-dashboard');if(!root)return;let i=0;for(const el of root.children)if(el.matches?.('.card,article.card'))makeCollapsible(el,el.id||`dashboard-${i++}`)});
}
function installRecurringSettings(){
  const settings=document.querySelector('#view-settings');if(!settings||document.querySelector('#mgwRecurringSettings'))return;
  const card=document.createElement('article');card.className='card';card.id='mgwRecurringSettings';
  card.innerHTML='<div class="card-head"><div><span class="section-icon">🔁</span><b>Recurring Schedules</b></div></div><p class="mgw-muted">Create one schedule for salary or repeating commitments instead of entering every month. Supports monthly, every 2 months, quarterly, half-yearly and yearly recurrence, with an optional end month.</p><div class="mgw-rec-grid" id="mgwRecurringSummary"></div>';
  settings.insertBefore(card,settings.querySelector('.privacy-note')||null);
}
function renderSummary(){
  const host=document.querySelector('#mgwRecurringSummary');if(!host||!ensure())return;
  const sig=JSON.stringify([db.recurringIncome,db.recurringCommitments]);if(sig===summarySignature)return;summarySignature=sig;
  const rows=[];for(const x of db.recurringIncome)rows.push({name:x.name||'Salary',amount:num(x.netSalary),kind:'Income',x});for(const x of db.recurringCommitments)rows.push({name:x.name||'Commitment',amount:num(x.amount),kind:'Commitment',x});
  host.innerHTML=rows.length?rows.map(r=>`<div class="mgw-rec-row"><div><b>${esc(r.name)}</b><br><small>${r.kind} · ${esc(r.x.frequency||'monthly')} · ${esc(r.x.startMonth||'now')} → ${esc(r.x.endMonth||'no end date')}</small></div><div><strong>${money(r.amount)}</strong><br><span class="mgw-recurring-badge">🔁 Recurring</span></div></div>`).join(''):'<p class="mgw-muted">No recurring schedules configured yet.</p>';
}
function render(){if(!ensure())return;installRecurringSettings();renderSummary();installCollapse()}
function boot(){
  if(!ensure())return;installStyles();render();
  const root=document.querySelector('#view-dashboard');if(root&&window.MutationObserver){observer=new MutationObserver(installCollapse);observer.observe(root,{childList:true})}
  if(typeof renderAll==='function'&&!renderAll.__mgwV153){const base=renderAll;const wrapped=function(){base();render()};wrapped.__mgwV153=true;renderAll=wrapped}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();