// MoneyGoWhere v1.5.5-dev.51 — recurring-data onboarding and one-time existing-user notice
// Local-first: this module stores only the recurring rules the user chooses in their browser database.
(()=>{'use strict';
const RELEASE='1.5.5-dev.51',FEATURE='recurring-setup-v1';
const FREQ={monthly:'Monthly',bimonthly:'Every 2 months',quarterly:'Quarterly',halfyearly:'Half-yearly',yearly:'Yearly'};
const num=v=>Math.max(0,Number(v)||0);
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const monthIndex=k=>{const [y,m]=String(k||'').split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)?y*12+m-1:NaN};
let onboardingSession=false,closeQueued=false,promptShown=false;
const draft={salary:true,salaryEnd:'',items:[]};
if(typeof window.MGWStartupRecurringDone!=='boolean')window.MGWStartupRecurringDone=false;

function ensure(){
  if(!window.db)return false;
  db.settings=db.settings||{};
  db.settings.recurringIntro=db.settings.recurringIntro&&typeof db.settings.recurringIntro==='object'?db.settings.recurringIntro:{};
  db.recurringIncome=Array.isArray(db.recurringIncome)?db.recurringIncome:[];
  db.recurringCommitments=Array.isArray(db.recurringCommitments)?db.recurringCommitments:[];
  db.recurringBills=Array.isArray(db.recurringBills)?db.recurringBills:[];
  return true;
}
function persist(){if(ensure())localStorage.setItem(MGW.key,JSON.stringify(db))}
function notify(text){if(typeof toast==='function')toast(text)}
function markDone(){if(window.MGWStartupRecurringDone)return;window.MGWStartupRecurringDone=true;document.dispatchEvent(new CustomEvent('mgw:startup-recurring:done'))}
function introSeen(){ensure();return db.settings.recurringIntro.feature===FEATURE&&db.settings.recurringIntro.seen===true}
function markSeen(source){ensure();db.settings.recurringIntro={feature:FEATURE,seen:true,source,seenAt:new Date().toISOString(),release:RELEASE};persist();markDone()}
function validEnd(end,start=monthKey(new Date())){return !end||monthIndex(end)>=monthIndex(start)}
function latestIncome(){return [...(db.income||[])].filter(x=>num(x.netSalary)>0).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))).at(-1)||null}
function recurringCounts(){ensure();return{salary:db.recurringIncome.length,bills:db.recurringBills.length,commitments:db.recurringCommitments.length}}
function duplicateSalary(x,start){return db.recurringIncome.some(r=>r.active!==false&&num(r.netSalary)===num(x.netSalary)&&String(r.startMonth||'')===start)}
function duplicateItem(item,start){const rows=item.type==='bill'?db.recurringBills:db.recurringCommitments;return rows.some(r=>String(r.name||r.merchant||'').trim().toLowerCase()===item.name.trim().toLowerCase()&&Math.abs(num(r.amount)-item.amount)<.005&&String(r.startMonth||'')===start)}
function applyOnboardingDraft(){
  if(!ensure())return 0;
  const start=monthKey(new Date());let added=0;
  if(draft.salary){
    const income=latestIncome();
    if(income&&!duplicateSalary(income,start)){
      db.recurringIncome.push({id:uid('RINC'),name:'Salary',baseSalary:num(income.baseSalary)||num(income.netSalary),netSalary:num(income.netSalary),frequency:'monthly',payDay:Math.min(31,Math.max(1,Number(db.settings?.payCycle?.day)||25)),startMonth:start,endMonth:validEnd(draft.salaryEnd,start)?draft.salaryEnd:'',active:true,source:'onboarding'});added++;
    }
  }
  for(const item of draft.items){
    if(!item.name||item.amount<=0||duplicateItem(item,start))continue;
    if(item.type==='bill')db.recurringBills.push({id:uid('BILL'),name:item.name,merchant:item.name,amount:item.amount,group:'Other',category:'Other',frequency:item.frequency,dueDay:item.dueDay,startMonth:start,endMonth:item.endMonth,active:true,confidence:'manual',source:'onboarding'});
    else db.recurringCommitments.push({id:uid('RCOM'),name:item.name,merchant:item.name,amount:item.amount,frequency:item.frequency,dueDay:item.dueDay,startMonth:start,endMonth:item.endMonth,active:true,source:'onboarding'});
    added++;
  }
  if(added){persist();if(typeof renderAll==='function')renderAll();notify(`${added} recurring ${added===1?'item':'items'} added`)}
  draft.items=[];return added;
}
function css(){
  if(document.querySelector('#mgwRecurringOnboardingCss'))return;
  const s=document.createElement('style');s.id='mgwRecurringOnboardingCss';s.textContent=`
.mgw-rec-ob{margin:16px 0 4px;padding:14px;border:1px solid #dfe8e5;border-radius:16px;background:#f7fbfa}.mgw-rec-ob h3{margin:0 0 5px}.mgw-rec-ob p{margin:0 0 10px;color:#6b7774;font-size:.86rem}.mgw-rec-ob-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mgw-rec-ob-grid .full{grid-column:1/-1}.mgw-rec-ob-check{display:flex;gap:9px;align-items:flex-start;padding:9px 0}.mgw-rec-ob-check input{width:auto;margin-top:3px}.mgw-rec-ob-list{display:grid;gap:6px;margin-top:9px}.mgw-rec-ob-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;background:#fff;border:1px solid #e4ebe9;border-radius:10px;padding:9px}.mgw-rec-ob-item small{display:block;color:#73807d;margin-top:2px}.mgw-rec-ob-item button{border:0;background:transparent;font-weight:800}.mgw-rec-intro{border:0;border-radius:22px;padding:0;width:min(540px,calc(100% - 30px));box-shadow:0 24px 70px rgba(0,0,0,.24)}.mgw-rec-intro::backdrop{background:rgba(8,25,23,.44);backdrop-filter:blur(3px)}.mgw-rec-intro-shell{padding:22px}.mgw-rec-intro h2{margin:5px 0 8px}.mgw-rec-intro p{color:var(--muted,#6b7774);line-height:1.45}.mgw-rec-intro-actions{display:grid;gap:9px;margin-top:16px}.mgw-rec-intro-actions button{width:100%;text-align:left;padding:13px 15px}.mgw-rec-intro-actions b,.mgw-rec-intro-actions small{display:block}.mgw-rec-intro-actions small{font-weight:400;opacity:.7;margin-top:2px}@media(max-width:520px){.mgw-rec-ob-grid{grid-template-columns:1fr}.mgw-rec-ob-grid .full{grid-column:auto}}
`;document.head.appendChild(s);
}
function frequencyOptions(selected='monthly'){return Object.entries(FREQ).map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('')}
function renderDraftList(panel){
  const host=panel.querySelector('#mgwRecObDraftList');if(!host)return;
  host.innerHTML=draft.items.map((x,i)=>`<div class="mgw-rec-ob-item"><span><b>${esc(x.name)}</b><small>${x.type==='bill'?'Bill / subscription':'Commitment'} · ${esc(FREQ[x.frequency]||'Monthly')} · ${typeof money==='function'?money(x.amount):x.amount.toFixed(2)}${x.endMonth?` · until ${esc(x.endMonth)}`:' · ongoing'}</small></span><button type="button" data-rec-ob-remove="${i}">Remove</button></div>`).join('')||'<small>No recurring bills or commitments added in this setup yet.</small>';
  host.querySelectorAll('[data-rec-ob-remove]').forEach(b=>b.addEventListener('click',()=>{draft.items.splice(Number(b.dataset.recObRemove),1);renderDraftList(panel)}));
}
function injectOnboardingPanel(){
  if(!ensure())return;
  const root=document.querySelector('#mgwOnboarding');
  if(root&&!onboardingSession){onboardingSession=true;closeQueued=false}
  if(!root)return;
  const title=root.querySelector('.mgw-ob-card h2')?.textContent||'';
  if(!/First expense/i.test(title)||root.querySelector('#mgwRecurringOnboardingPanel'))return;
  const actions=root.querySelector('.mgw-ob-actions'),counts=recurringCounts(),panel=document.createElement('section');
  panel.id='mgwRecurringOnboardingPanel';panel.className='mgw-rec-ob';
  panel.innerHTML=`<h3>🔁 Recurring data</h3><p>Set repeating salary, bills and commitments once so future cycles are planned automatically. End Month is optional.</p>${counts.salary+counts.bills+counts.commitments?`<p><b>Already configured:</b> ${counts.salary} salary · ${counts.bills} bills · ${counts.commitments} commitments</p>`:''}<label class="mgw-rec-ob-check"><input type="checkbox" id="mgwRecObSalary" ${draft.salary?'checked':''}><span><b>Repeat my main salary monthly</b><small>Uses the main income entered during Welcome Setup. Actual salary entries still take priority for that month.</small></span></label><div class="field"><label>Salary End Month (optional)</label><input id="mgwRecObSalaryEnd" type="month" value="${esc(draft.salaryEnd)}"></div><hr style="border:0;border-top:1px solid #e2e9e7;margin:14px 0"><b>Add a recurring bill or commitment</b><div class="mgw-rec-ob-grid" style="margin-top:9px"><div class="field"><label>Type</label><select id="mgwRecObType"><option value="bill">Bill / Subscription</option><option value="commitment">Commitment</option></select></div><div class="field"><label>Name</label><input id="mgwRecObName" placeholder="e.g. Mobile bill"></div><div class="field"><label>Amount</label><input id="mgwRecObAmount" type="number" min="0" step="0.01"></div><div class="field"><label>Frequency</label><select id="mgwRecObFreq">${frequencyOptions()}</select></div><div class="field"><label>Expected Day</label><input id="mgwRecObDay" type="number" min="1" max="31"></div><div class="field"><label>End Month (optional)</label><input id="mgwRecObEnd" type="month"></div><div class="field full"><button type="button" class="secondary-btn" id="mgwRecObAdd">＋ Add recurring item</button></div></div><div class="mgw-rec-ob-list" id="mgwRecObDraftList"></div>`;
  actions?.insertAdjacentElement('beforebegin',panel);
  panel.querySelector('#mgwRecObSalary').addEventListener('change',e=>draft.salary=e.target.checked);
  panel.querySelector('#mgwRecObSalaryEnd').addEventListener('change',e=>{if(!validEnd(e.target.value)){notify('Salary end month cannot be before this month');e.target.value='';draft.salaryEnd='';return}draft.salaryEnd=e.target.value});
  panel.querySelector('#mgwRecObAdd').addEventListener('click',()=>{
    const type=panel.querySelector('#mgwRecObType').value,name=panel.querySelector('#mgwRecObName').value.trim(),amount=num(panel.querySelector('#mgwRecObAmount').value),frequency=panel.querySelector('#mgwRecObFreq').value,dueDay=Math.min(31,Math.max(1,Number(panel.querySelector('#mgwRecObDay').value)||1)),endMonth=panel.querySelector('#mgwRecObEnd').value;
    if(!name||amount<=0){notify('Enter a name and amount for the recurring item');return}
    if(!validEnd(endMonth)){notify('End month cannot be before this month');return}
    draft.items.push({type,name,amount,frequency,dueDay,endMonth});panel.querySelector('#mgwRecObName').value='';panel.querySelector('#mgwRecObAmount').value='';panel.querySelector('#mgwRecObEnd').value='';renderDraftList(panel);
  });
  renderDraftList(panel);
}
function handleOnboardingClosed(){
  if(closeQueued)return;closeQueued=true;
  setTimeout(()=>{
    closeQueued=false;if(document.querySelector('#mgwOnboarding'))return;
    onboardingSession=false;ensure();
    if(db.settings.onboarding?.completed){applyOnboardingDraft();markSeen('onboarding')}
    else markSeen('onboarding-skipped');
  },80);
}
function watchOnboarding(){
  const check=()=>{const root=document.querySelector('#mgwOnboarding');if(root)injectOnboardingPanel();else if(onboardingSession)handleOnboardingClosed()};
  check();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;check()})}).observe(document.body,{subtree:true,childList:true});
}
function openRecurring(kind){
  if(typeof nav==='function')nav(kind==='bill'?'settings':'add');
  setTimeout(()=>{
    if(kind==='salary'&&window.MGWRecurring?.openIncome)return window.MGWRecurring.openIncome();
    if(kind==='commitment'&&window.MGWRecurring?.openCommitment)return window.MGWRecurring.openCommitment();
    if(kind==='bill'&&window.MGWRecurringBills?.openEditor)return window.MGWRecurringBills.openEditor();
    notify('Recurring setup is available under Add New and Settings');
  },120);
}
function showExistingPrompt(){
  if(promptShown||introSeen()){markDone();return}promptShown=true;css();
  const d=document.createElement('dialog');d.id='mgwRecurringIntroDialog';d.className='mgw-rec-intro';
  d.innerHTML=`<div class="mgw-rec-intro-shell"><div class="eyebrow">New in MoneyGoWhere</div><h2>🔁 Set recurring data once</h2><p>You can now save repeating salary, bills and commitments instead of entering them every month. Add an optional End Month when a payment or commitment has a known final month.</p><div class="mgw-rec-intro-actions"><button class="secondary-btn" data-rec="salary"><b>💼 Add Recurring Salary</b><small>Use it automatically for future planning when no actual salary has been entered.</small></button><button class="secondary-btn" data-rec="bill"><b>🧾 Add Recurring Bill</b><small>Subscriptions, utilities, telecom, insurance and other repeating bills.</small></button><button class="secondary-btn" data-rec="commitment"><b>📌 Add Recurring Commitment</b><small>Allowances, childcare, loans and other fixed commitments.</small></button><button class="primary-btn" data-rec="later"><b>Continue for now</b><small>You can add recurring data later from Add New or Settings.</small></button></div></div>`;
  document.body.appendChild(d);
  const finish=kind=>{markSeen('existing-startup');try{d.close()}catch{}d.remove();if(kind!=='later')openRecurring(kind)};
  d.querySelectorAll('[data-rec]').forEach(b=>b.addEventListener('click',()=>finish(b.dataset.rec)));
  d.addEventListener('cancel',e=>{e.preventDefault();finish('later')},{once:true});
  try{d.showModal()}catch{d.remove();markSeen('existing-startup')}
}
function startupExistingNotice(){
  const wait=()=>{
    if(!ensure()){setTimeout(wait,250);return}
    if(introSeen()){markDone();return}
    const onboarding=document.querySelector('#mgwOnboarding');
    const pending=window.MGWStartupSyncDone!==true||window.MGWStartupImportDone!==true;
    const tour=document.querySelector('.mgw-walk-bubble,.mgw-walk-mask');
    const blocking=[...document.querySelectorAll('dialog[open]')].some(x=>x.id!=='mgwRecurringIntroDialog');
    if(onboarding||pending||tour||blocking){setTimeout(wait,250);return}
    showExistingPrompt();
  };
  setTimeout(wait,450);
}
function boot(){if(!ensure())return;css();watchOnboarding();startupExistingNotice()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWRecurringOnboarding={version:RELEASE,showExistingPrompt,markDone:()=>markSeen('manual')};
})();