// MoneyGoWhere DEV — Phase 1 database health summary.
// Read-only diagnostics for the local finance database. No finance values leave the browser.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const ARRAY_KEYS=['expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments','monthlyCommitments','recurringIncome','recurringCommitments','recurringBills','walletAccounts','bankAccounts','importQueue','importHistory','receiptImportQueue','receiptImportHistory'];
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const validDate=v=>{if(!v)return true;const s=String(v).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s};
function duplicateIds(rows){const seen=new Set(),dupes=new Set();for(const row of rows||[]){const id=String(row?.id||'').trim();if(!id)continue;if(seen.has(id))dupes.add(id);else seen.add(id)}return dupes.size}
function quarantineCount(database){const q=isObj(database?.importQuarantine)?database.importQuarantine:{};return Object.values(q).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0)}
function report(database=window.db||{}){
  let total=0,duplicates=0,invalid=0;
  const collections={};
  for(const key of ARRAY_KEYS){
    const rows=Array.isArray(database[key])?database[key]:[];
    collections[key]=rows.length;total+=rows.length;duplicates+=duplicateIds(rows);
    for(const row of rows){
      if(!isObj(row)){invalid++;continue}
      if((key==='expenses'||key==='income')&&!validDate(row.date))invalid++;
      if(key==='expenses'&&(!Number.isFinite(Number(row.amount))||Number(row.amount)<0))invalid++;
    }
  }
  const quarantined=quarantineCount(database);
  const backup=database?.backupMeta?.lastExportedAt||database?.backupMeta?.exportedAt||null;
  const schema=Number(database?.schemaVersion)||Number(database?.version)||1;
  const dataVersion=Number(database?.dataVersion)||null;
  const migratedFrom=database?.schemaMeta?.migratedFrom??null;
  const migratedAt=database?.schemaMeta?.lastMigratedAt||null;
  const rollback=Boolean(window.MGWDatabaseSchema?.rollbackAvailable?.());
  const accountInfo=window.MGWAccountRegistry?.describe?window.MGWAccountRegistry.describe(database):{total:Array.isArray(database.accounts)?database.accounts.length:0,orphans:0,byType:{}};
  const recurringInfo=window.MGWRecurringEngine?.describe?window.MGWRecurringEngine.describe(database):{total:Array.isArray(database.recurringItems)?database.recurringItems.length:0,active:0,byType:{}};
  const transactionInfo=window.MGWTransactionEngine?.describe?window.MGWTransactionEngine.describe(database):{expenses:Array.isArray(database.expenses)?database.expenses.length:0,income:Array.isArray(database.income)?database.income.length:0,recurringLinked:0,duplicates:Number(database.transactionModelMeta?.duplicateFingerprintCount)||0};
  return {release:RELEASE,total,duplicates,invalid,quarantined,backup,schema,dataVersion,migratedFrom,migratedAt,rollback,accountInfo,recurringInfo,transactionInfo,healthy:duplicates===0&&invalid===0&&quarantined===0&&accountInfo.orphans===0&&transactionInfo.duplicates===0,collections};
}
function fmtDate(v){if(!v)return 'Never';const d=new Date(v);return Number.isNaN(d.getTime())?'Unknown':d.toLocaleString('en-SG',{dateStyle:'medium',timeStyle:'short'})}
function installStyles(){
  if(document.getElementById('mgwDbHealthStyles'))return;
  const s=document.createElement('style');s.id='mgwDbHealthStyles';
  s.textContent='.mgw-db-health{padding:16px}.mgw-db-health-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.mgw-db-health-grid>div{padding:10px;border:1px solid var(--border,#dbe4e4);border-radius:12px;background:rgba(127,127,127,.05)}.mgw-db-health-grid small,.mgw-db-health-grid strong{display:block}.mgw-db-health-grid small{opacity:.65;margin-bottom:3px}.mgw-db-health-state{font-weight:800}.mgw-db-health-state.good{color:#15803d}.mgw-db-health-state.warn{color:#b45309}.mgw-db-health-actions{display:flex;gap:8px;flex-wrap:wrap}.mgw-db-health-actions button{flex:1;min-width:130px}@media(min-width:720px){.mgw-db-health-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}';
  document.head.appendChild(s);
}
function ensureCard(){
  const settings=document.querySelector('#view-settings');if(!settings)return null;
  let card=document.getElementById('mgwDbHealthCard');if(card)return card;
  card=document.createElement('article');card.className='card mgw-db-health';card.id='mgwDbHealthCard';
  settings.insertBefore(card,settings.querySelector('.privacy-note')||null);
  return card;
}
function render(){
  installStyles();const card=ensureCard();if(!card)return;
  const r=report(),state=r.healthy?'DATABASE HEALTHY':'REVIEW DATABASE';
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">🩺</span><b>Database Health</b></div><span class="mgw-db-health-state ${r.healthy?'good':'warn'}">${state}</span></div>
  <div class="mgw-db-health-grid">
    <div><small>Stored records</small><strong>${r.total}</strong></div>
    <div><small>Duplicate IDs</small><strong>${r.duplicates}</strong></div>
    <div><small>Invalid records</small><strong>${r.invalid}</strong></div>
    <div><small>Quarantined</small><strong>${r.quarantined}</strong></div>
    <div><small>Accounts</small><strong>${r.accountInfo.total}</strong></div>
    <div><small>Orphan payment links</small><strong>${r.accountInfo.orphans}</strong></div>
    <div><small>Recurring items</small><strong>${r.recurringInfo.total}</strong></div>
    <div><small>Active recurring</small><strong>${r.recurringInfo.active}</strong></div>
    <div><small>Recurring links</small><strong>${r.transactionInfo.recurringLinkedTotal??r.transactionInfo.recurringLinked??0}</strong></div>
    <div><small>Potential duplicates</small><strong>${r.transactionInfo.duplicates}</strong></div>
  </div>
  <p class="mgw-muted">App v${RELEASE} · Schema ${r.schema} · Data ${r.dataVersion??'—'}<br>Last backup: ${fmtDate(r.backup)}${r.migratedFrom!==null?'<br>Migrated from schema '+r.migratedFrom+': '+fmtDate(r.migratedAt):''}${r.rollback?'<br>Pre-schema-v2 rollback snapshot: Available':''}</p>
  <div class="mgw-db-health-actions"><button type="button" class="secondary-btn" id="mgwDbHealthRun">RUN CHECK</button><button type="button" class="primary-btn" id="mgwDbHealthBackup">MASTERDB BACKUP</button>${window.MGWMasterDB?.rollbackAvailable?.()?'<button type="button" class="secondary-btn" id="mgwRestoreRollback">ROLLBACK LAST RESTORE</button>':''}</div>`;
  card.querySelector('#mgwDbHealthRun')?.addEventListener('click',()=>{render();window.toast?.(report().healthy?'Database health check passed':'Database health check found items to review')});
  card.querySelector('#mgwDbHealthBackup')?.addEventListener('click',()=>document.querySelector('#exportBtn')?.click());
  card.querySelector('#mgwRestoreRollback')?.addEventListener('click',()=>{if(!confirm('Restore the database that existed immediately before the last restore?'))return;const r=window.MGWMasterDB?.rollbackRestore?.();window.toast?.(r?.ok?'Previous database restored':'No valid restore rollback snapshot found');render()});
}
document.addEventListener('mgw:settings-features-ready',()=>setTimeout(render,20));
document.addEventListener('mgw:accounts-changed',()=>setTimeout(render,40));
document.addEventListener('mgw:recurring-changed',()=>setTimeout(render,40));
document.addEventListener('mgw:recurring-registry-ready',()=>setTimeout(render,40));
document.addEventListener('mgw:transaction-model-ready',()=>setTimeout(render,40));
document.addEventListener('mgw:schema-migrated',()=>setTimeout(render,40));
document.addEventListener('mgw:data-restored',()=>setTimeout(render,40));
document.addEventListener('mgw:backup-exported',()=>setTimeout(render,40));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,180),{once:true});else setTimeout(render,180);
window.MGWDatabaseHealth=Object.freeze({version:RELEASE,report,render});
})();