// MoneyGoWhere DEV — Phase 7 release-readiness self tests.
// Uses synthetic in-memory data only. It never uploads or copies the user's finance records.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const clone=v=>JSON.parse(JSON.stringify(v));
const result=(name,ok,detail='')=>({name,ok:Boolean(ok),detail:String(detail||'')});
function syntheticDb(){
  return {
    app:'MoneyGoWhere',version:2,schemaVersion:2,dataVersion:Number(window.MGW_RELEASE?.dataVersion)||20,
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    expenses:[{id:'TEST-EXP-1',date:'2026-01-10',time:'12:00',vendor:'Synthetic Merchant',amount:10,currency:'SGD',source:'manual',paymentSource:'Test Card'}],
    income:[{id:'TEST-INC-1',date:'2026-01-01',netSalary:100,source:'manual'}],
    budgets:{monthly:100,categories:{}},settings:{currency:'SGD'},
    creditAccounts:[{id:'TEST-CARD-1',name:'Test Card',nickname:'Test Card',accountType:'credit'}],creditPayments:[],
    payLaterAccounts:[],payLaterPayments:[],walletAccounts:[],bankAccounts:[],
    monthlyCommitments:[],recurringIncome:[],recurringCommitments:[],recurringBills:[],
    recurringItems:[],recurringModelMeta:{version:1},accounts:[],paymentSourceMap:{},accountModelMeta:{version:1},
    importQueue:[],importHistory:[],receiptImportQueue:[],receiptImportHistory:[],
    importQuarantine:{expenses:[],income:[],history:[],receiptHistory:[]},backupMeta:{},schemaMeta:{},transactionModelMeta:{version:1}
  };
}
function run(){
  const tests=[];
  try{
    const r=window.MGW_RELEASE||{};
    tests.push(result('Runtime release identity',Boolean(r.appVersion)&&Number(r.schemaVersion)>=2&&Number(r.dataVersion)>=20,`v${r.appVersion||'—'} · schema ${r.schemaVersion??'—'} · data ${r.dataVersion??'—'}`));
  }catch(e){tests.push(result('Runtime release identity',false,e.message))}
  try{
    const s=window.MGWDatabaseSchema;const d=s?.shape?.(syntheticDb());
    tests.push(result('Schema v2 normalization',Boolean(s&&d?.schemaVersion===2&&Array.isArray(d.expenses)&&Array.isArray(d.accounts)),d?`schema ${d.schemaVersion} · data ${d.dataVersion}`:'schema engine unavailable'));
  }catch(e){tests.push(result('Schema v2 normalization',false,e.message))}
  try{
    const d=syntheticDb();const r=window.MGWAccountRegistry?.sync?.(d,{persist:false});
    tests.push(result('Unified account registry',Boolean(r&&d.accounts?.some(a=>a.id==='TEST-CARD-1')),r?`${r.accounts} account(s)`:'account registry unavailable'));
  }catch(e){tests.push(result('Unified account registry',false,e.message))}
  try{
    const d=syntheticDb();const r=window.MGWRecurringEngine?.sync?.(d,{persist:false});
    tests.push(result('Recurring engine',Boolean(r&&Array.isArray(d.recurringItems)),r?`${r.total} recurring item(s)`:'recurring engine unavailable'));
  }catch(e){tests.push(result('Recurring engine',false,e.message))}
  try{
    const d=syntheticDb();window.MGWAccountRegistry?.sync?.(d,{persist:false});window.MGWRecurringEngine?.sync?.(d,{persist:false});
    const r=window.MGWTransactionEngine?.sync?.(d,{persist:false}),x=d.expenses[0];
    tests.push(result('Transaction derivation',Boolean(r&&x?.transactionFingerprint&&x?.provenance==='manual'&&x?.paymentSourceId==='TEST-CARD-1'),r?`${r.expenses} expense(s) · ${r.duplicates} duplicate(s)`:'transaction engine unavailable'));
  }catch(e){tests.push(result('Transaction derivation',false,e.message))}
  try{
    const d=syntheticDb(),payload={app:'MoneyGoWhere',kind:'moneygowhere-masterdb',formatVersion:1,appVersion:RELEASE,schemaVersion:2,dataVersion:Number(window.MGW_RELEASE?.dataVersion)||20,exportedAt:new Date().toISOString(),summary:{},database:d};
    const r=window.MGWMasterDB?.validate?.(clone(payload));
    tests.push(result('MasterDB validation',Boolean(r?.prepared&&r?.summary?.expenses===1),r?`${r.kind} · ${r.summary.expenses} expense(s)`:'MasterDB engine unavailable'));
  }catch(e){tests.push(result('MasterDB validation',false,e.message))}
  try{
    const ok=window.MGWPaymentFormCore?.selfTest?.();
    tests.push(result('Payment form integration',ok,ok?'payment-source controls available':'payment-form self test unavailable/failed'));
  }catch(e){tests.push(result('Payment form integration',false,e.message))}
  try{
    const runtime=window.MGWRuntimeHealth;
    const failed=runtime?.failed||[];
    tests.push(result('Runtime module health',Boolean(runtime)&&failed.length===0,failed.length?failed.join(', '):'no module failures reported'));
  }catch(e){tests.push(result('Runtime module health',false,e.message))}
  const passed=tests.filter(x=>x.ok).length;
  return {release:RELEASE,passed,total:tests.length,ready:passed===tests.length,tests,ranAt:new Date().toISOString()};
}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function installStyles(){
  if(document.getElementById('mgwReleaseReadinessStyles'))return;
  const s=document.createElement('style');s.id='mgwReleaseReadinessStyles';
  s.textContent='.mgw-release-tests{display:grid;gap:7px;margin-top:10px}.mgw-release-test{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;padding:9px 10px;border:1px solid var(--line,#dbe4e4);border-radius:11px}.mgw-release-test i{font-style:normal}.mgw-release-test small{display:block;opacity:.68;margin-top:2px}.mgw-release-ready{font-weight:800}.mgw-release-ready.good{color:#15803d}.mgw-release-ready.warn{color:#b45309}';
  document.head.appendChild(s);
}
function render(){
  const settings=document.querySelector('#view-settings');if(!settings)return;
  installStyles();
  let card=document.getElementById('mgwReleaseReadiness');if(!card){card=document.createElement('article');card.className='card';card.id='mgwReleaseReadiness';settings.insertBefore(card,settings.querySelector('.privacy-note')||null)}
  const r=run();
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">🧪</span><b>Release Readiness</b></div><span class="mgw-release-ready ${r.ready?'good':'warn'}">${r.passed}/${r.total} PASS</span></div><p class="mgw-muted">Synthetic local self-tests only. Your finance records are not copied into these tests.</p><div class="mgw-release-tests">${r.tests.map(t=>`<div class="mgw-release-test"><i>${t.ok?'✅':'⚠️'}</i><div><b>${esc(t.name)}</b><small>${esc(t.detail)}</small></div></div>`).join('')}</div><div class="mgw-db-health-actions" style="margin-top:10px"><button type="button" class="secondary-btn" id="mgwRunReleaseTests">RUN TESTS AGAIN</button></div>`;
  card.querySelector('#mgwRunReleaseTests')?.addEventListener('click',()=>{render();window.toast?.(run().ready?'Release readiness checks passed':'Release readiness needs review')});
  window.MGWReleaseReadiness.last=r;
}
window.MGWReleaseReadiness={version:RELEASE,run,render,last:null};
document.addEventListener('mgw:settings-features-ready',()=>setTimeout(render,30));
document.addEventListener('mgw:deferred-features-ready',()=>setTimeout(render,30));
if(document.readyState!=='loading')setTimeout(render,250);
})();