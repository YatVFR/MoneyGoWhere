// MoneyGoWhere v1.5.4 — local recurring schedules + resilient collapsible dashboard
(()=>{
'use strict';
const RELEASE='1.5.4';
const STEPS=Object.freeze({monthly:1,bimonthly:2,quarterly:3,halfyearly:6,yearly:12});
const num=v=>Math.max(0,Number(v)||0);
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const raf=window.requestAnimationFrame?fn=>requestAnimationFrame(fn):fn=>setTimeout(fn,0);
let summarySignature='',collapseQueued=false,observer,badgeObserver;

function ensure(){
  if(!window.db)return false;
  db.recurringIncome=Array.isArray(db.recurringIncome)?db.recurringIncome:[];
  db.recurringCommitments=Array.isArray(db.recurringCommitments)?db.recurringCommitments:[];
  db.settings=db.settings||{};
  db.settings.collapsedDashboard=db.settings.collapsedDashboard||{};
  return true;
}
function save(render=true){if(!ensure())return;localStorage.setItem(MGW.key,JSON.stringify(db));if(render&&typeof renderAll==='function')renderAll()}
function monthIndex(key){const [y,m]=String(key||'').split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)?y*12+m-1:NaN}
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function active(rule,key){if(!rule||rule.active===false)return false;const cur=monthIndex(key),start=monthIndex(rule.startMonth||key),end=rule.endMonth?monthIndex(rule.endMonth):Infinity;if(!Number.isFinite(cur)||!Number.isFinite(start)||cur<start||cur>end)return false;return (cur-start)%(STEPS[rule.frequency]||1)===0}
function matches(rows,key){return (rows||[]).filter(r=>active(r,key))}
function total(rows,key,getter){let out=0;for(const r of rows||[])if(active(r,key))out+=num(getter(r));return out}
function collection(kind){return kind==='income'?db.recurringIncome:db.recurringCommitments}

window.MGWRecurring={version:RELEASE,ensure,monthKey,incomeForMonth:key=>(ensure(),matches(db.recurringIncome,key)),commitmentsForMonth:key=>(ensure(),matches(db.recurringCommitments,key)),incomeTotal:key=>(ensure(),total(db.recurringIncome,key,x=>x.netSalary)),commitmentTotal:key=>(ensure(),total(db.recurringCommitments,key,x=>x.amount)),addIncome:r=>{ensure();db.recurringIncome.push({id:uid('INC'),active:true,frequency:'monthly',...r});summarySignature='';save()},addCommitment:r=>{ensure();db.recurringCommitments.push({id:uid('REC'),active:true,frequency:'monthly',...r});summarySignature='';save()},update:(kind,id,patch)=>{ensure();const x=collection(kind).find(v=>v.id===id);if(!x)return false;Object.assign(x,patch);summarySignature='';save();return true},remove:(kind,id)=>{ensure();const key=kind==='income'?'recurringIncome':'recurringCommitments',before=db[key].length;db[key]=db[key].filter(x=>x.id!==id);if(db[key].length===before)return false;summarySignature='';save();return true}};

function installStyles(){
  if(document.querySelector('#mgwV154Styles'))return;
  const s=document.createElement('style');s.id='mgwV154Styles';
  s.textContent='.mgw-collapse-btn{margin-left:auto;border:0;background:rgba(15,118,110,.08);color:inherit;width:34px;height:34px;border-radius:999px;font:700 1.15rem/1 system-ui;display:inline-grid;place-items:center;cursor:pointer;flex:0 0 auto}.mgw-collapse-btn:active{transform:scale(.96)}.mgw-collapse-head{display:flex;align-items:center;gap:8px}.mgw-recurring-badge{display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(19,122,111,.1);color:#137a6f;font-size:.72rem;font-weight:700}.mgw-rec-grid{display:grid;gap:8px;margin-top:10px}.mgw-rec-row{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border,#e4e9ea)}';
  document.head.appendChild(s);
}
function appVersion(){return typeof MGW_RUNTIME_RELEASE!=='undefined'&&MGW_RUNTIME_RELEASE?.appVersion?MGW_RUNTIME_RELEASE.appVersion:RELEASE}
function syncAppVersionBadge(){
  const badge=document.querySelector('#appVersionBadge');if(!badge)return;
  const version=appVersion();
  const preview=/preview\s*\/\s*uat/i.test(badge.title||'')||/preview\s*\/\s*uat/i.test(badge.textContent||'');
  const text=preview?`v${version} · PREVIEW/UAT`:`v${version}`;
  if(badge.textContent!==text)badge.textContent=text;
  if(preview)badge.title=`Preview/UAT · App ${version} · Schema ${MGW_RUNTIME_RELEASE?.schemaVersion??1} · Data ${MGW_RUNTIME_RELEASE?.dataVersion??9}`;
}
function installBadgeGuard(){
  const badge=document.querySelector('#appVersionBadge');if(!badge)return;
  syncAppVersionBadge();
  if(badgeObserver)badgeObserver.disconnect();
  if(window.MutationObserver){badgeObserver=new MutationObserver(()=>syncAppVersionBadge());badgeObserver.observe(badge,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['title']})}
  setTimeout(syncAppVersionBadge,0);
  setTimeout(syncAppVersionBadge,250);
  setTimeout(syncAppVersionBadge,1000);
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
function dashboardCards(root){
  const selectors=['article.card','.card'];const seen=new Set(),out=[];
  for(const selector of selectors)for(const el of root.querySelectorAll(selector)){if(seen.has(el))continue;seen.add(el);if(el.closest('#view-dashboard')===root)out.push(el)}
  return out;
}
function installCollapse(){
  if(collapseQueued)return;collapseQueued=true;
  raf(()=>{collapseQueued=false;if(!ensure())return;const root=document.querySelector('#view-dashboard');if(!root)return;dashboardCards(root).forEach((el,i)=>makeCollapsible(el,i))});
}
function installRecurringSettings(){const settings=document.querySelector('#view-settings');if(!settings||document.querySelector('#mgwRecurringSettings'))return;const card=document.createElement('article');card.className='card';card.id='mgwRecurringSettings';card.innerHTML='<div class="card-head"><div><span class="section-icon">🔁</span><b>Recurring Schedules</b></div></div><p class="mgw-muted">Create one schedule for salary or repeating commitments instead of entering every month. Supports monthly, every 2 months, quarterly, half-yearly and yearly recurrence, with an optional end month.</p><div class="mgw-rec-grid" id="mgwRecurringSummary"></div>';settings.insertBefore(card,settings.querySelector('.privacy-note')||null)}
function renderSummary(){const host=document.querySelector('#mgwRecurringSummary');if(!host||!ensure())return;const sig=JSON.stringify([db.recurringIncome,db.recurringCommitments]);if(sig===summarySignature)return;summarySignature=sig;const rows=[];for(const x of db.recurringIncome)rows.push({name:x.name||'Salary',amount:num(x.netSalary),kind:'Income',x});for(const x of db.recurringCommitments)rows.push({name:x.name||'Commitment',amount:num(x.amount),kind:'Commitment',x});host.innerHTML=rows.length?rows.map(r=>`<div class="mgw-rec-row"><div><b>${esc(r.name)}</b><br><small>${r.kind} · ${esc(r.x.frequency||'monthly')} · ${esc(r.x.startMonth||'now')} → ${esc(r.x.endMonth||'no end date')}</small></div><div><strong>${money(r.amount)}</strong><br><span class="mgw-recurring-badge">🔁 Recurring</span></div></div>`).join(''):'<p class="mgw-muted">No recurring schedules configured yet.</p>'}
function render(){if(!ensure())return;installRecurringSettings();renderSummary();installCollapse();syncAppVersionBadge()}
function boot(){
  if(!ensure())return;installStyles();render();installBadgeGuard();
  const root=document.querySelector('#view-dashboard');if(root&&window.MutationObserver){observer=new MutationObserver(installCollapse);observer.observe(root,{childList:true,subtree:true})}
  if(typeof renderAll==='function'&&!renderAll.__mgwV154){const base=renderAll;const wrapped=function(){base();render();syncAppVersionBadge()};wrapped.__mgwV154=true;renderAll=wrapped}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();