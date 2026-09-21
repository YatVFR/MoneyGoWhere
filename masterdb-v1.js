// MoneyGoWhere DEV — Phase 5 MasterDB, full backup and validated restore.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const FORMAT_VERSION=1;
const DB_KEY='moneygowhere-db-v1';
const RESTORE_ROLLBACK_KEY='moneygowhere-restore-rollback-v1';
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const clone=v=>JSON.parse(JSON.stringify(v));
const now=()=>new Date().toISOString();
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function sync(database){
  try{window.MGWAccountRegistry?.sync?.(database,{persist:false})}catch(err){console.warn('MoneyGoWhere account sync before backup failed',err)}
  try{window.MGWRecurringEngine?.sync?.(database,{persist:false})}catch(err){console.warn('MoneyGoWhere recurring sync before backup failed',err)}
  return database;
}
function shaped(database){
  let out=isObj(database)?clone(database):{};
  const migration=window.MGWDatabaseSchema?.migrate?window.MGWDatabaseSchema.migrate(out,{persist:false,createSnapshot:false}):{database:out,migrated:false,fromSchema:out.schemaVersion||out.version||1,toSchema:2};
  out=migration.database;
  if(window.MGWStability?.sanitize)out=window.MGWStability.sanitize(out);
  if(window.MGWDatabaseSchema?.shape)out=window.MGWDatabaseSchema.shape(out);
  sync(out);
  return {database:out,migration};
}
function summary(database){
  const d=isObj(database)?database:{};
  const count=k=>Array.isArray(d[k])?d[k].length:0;
  const quarantined=isObj(d.importQuarantine)?Object.values(d.importQuarantine).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0):0;
  return {
    expenses:count('expenses'),
    income:count('income'),
    accounts:Array.isArray(d.accounts)?d.accounts.length:count('creditAccounts')+count('walletAccounts')+count('payLaterAccounts')+count('bankAccounts'),
    creditAccounts:count('creditAccounts'),
    payLaterAccounts:count('payLaterAccounts'),
    recurringItems:Array.isArray(d.recurringItems)?d.recurringItems.length:count('recurringIncome')+count('recurringCommitments')+count('recurringBills')+count('monthlyCommitments'),
    budgets:Object.keys(d.budgets?.categories||{}).length+(Number(d.budgets?.monthly)>0?1:0),
    importHistory:count('importHistory')+count('receiptImportHistory'),
    quarantined
  };
}
function captureUiPreferences(){
  const ui={};
  try{
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith('mgw-ui-'))ui[key]=localStorage.getItem(key);
    }
  }catch{}
  return {
    selectedMonth:window.MGW?.state?.month instanceof Date?window.MGW.state.month.toISOString():null,
    insightRange:Number(window.MGW?.state?.range)||1,
    ui
  };
}
function applyUiPreferences(prefs){
  if(!isObj(prefs))return;
  try{for(const [key,value] of Object.entries(isObj(prefs.ui)?prefs.ui:{}))if(key.startsWith('mgw-ui-')&&typeof value==='string')localStorage.setItem(key,value)}catch{}
  if(window.MGW?.state){
    if(prefs.selectedMonth){const d=new Date(prefs.selectedMonth);if(!Number.isNaN(d.getTime()))window.MGW.state.month=d}
    if(Number.isFinite(Number(prefs.insightRange)))window.MGW.state.range=Number(prefs.insightRange);
  }
}
function stampBackup(database,kind,exportedAt){
  database.backupMeta={...(database.backupMeta||{}),lastExportedAt:exportedAt,lastExportKind:kind,appVersion:RELEASE,schemaVersion:window.MGW_RELEASE?.schemaVersion||database.schemaVersion||2,dataVersion:window.MGW_RELEASE?.dataVersion||database.dataVersion||18};
  try{localStorage.setItem(DB_KEY,JSON.stringify(database))}catch(err){console.warn('MoneyGoWhere backup metadata could not be persisted',err)}
}
function masterPayload(database=window.db||{}){
  const exportedAt=now(),d=sync(database);
  stampBackup(d,'masterdb',exportedAt);
  return {
    app:'MoneyGoWhere',
    kind:'moneygowhere-masterdb',
    formatVersion:FORMAT_VERSION,
    appVersion:RELEASE,
    schemaVersion:Number(d.schemaVersion)||2,
    dataVersion:Number(d.dataVersion)||18,
    exportedAt,
    summary:summary(d),
    database:clone(d)
  };
}
function fullBackupPayload(database=window.db||{}){
  const exportedAt=now(),d=sync(database);
  stampBackup(d,'full-backup',exportedAt);
  return {
    app:'MoneyGoWhere',
    kind:'moneygowhere-full-backup',
    formatVersion:FORMAT_VERSION,
    appVersion:RELEASE,
    schemaVersion:Number(d.schemaVersion)||2,
    dataVersion:Number(d.dataVersion)||18,
    exportedAt,
    capabilities:{financeData:true,accounts:true,recurring:true,imports:true,settings:true,uiPreferences:true},
    summary:summary(d),
    state:clone(d),
    localPreferences:captureUiPreferences()
  };
}
function download(payload,name){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);
  document.dispatchEvent(new CustomEvent('mgw:backup-exported',{detail:{exportedAt:payload.exportedAt,kind:payload.kind}}));
}
function exportMasterDB(){
  const p=masterPayload();download(p,`MoneyGoWhere-MasterDB-v${RELEASE}-${p.exportedAt.slice(0,10)}.json`);
  window.toast?.('MasterDB exported');
  return p;
}
function exportFullBackup(){
  const p=fullBackupPayload();download(p,`MoneyGoWhere-FullBackup-v${RELEASE}-${p.exportedAt.slice(0,10)}.json`);
  window.toast?.('Full app backup exported');
  return p;
}
function classify(raw){
  if(!isObj(raw))throw new Error('Backup is not an object');
  if(raw.app==='MoneyGoWhere'&&raw.kind==='moneygowhere-masterdb'&&isObj(raw.database))return {kind:'masterdb',database:raw.database,preferences:null,meta:raw};
  if(raw.app==='MoneyGoWhere'&&raw.kind==='moneygowhere-full-backup'&&isObj(raw.state))return {kind:'full-backup',database:raw.state,preferences:raw.localPreferences||null,meta:raw};
  if(Array.isArray(raw.expenses)&&Array.isArray(raw.income))return {kind:'legacy',database:raw,preferences:null,meta:{app:'MoneyGoWhere',kind:'legacy-backup',appVersion:raw.backupMeta?.appVersion||'',schemaVersion:raw.schemaVersion||raw.version||1,dataVersion:raw.dataVersion||raw.backupMeta?.dataVersion||null,exportedAt:raw.backupMeta?.exportedAt||raw.backupMeta?.lastExportedAt||null}};
  throw new Error('Unsupported MoneyGoWhere backup');
}
function validate(raw){
  const parsed=classify(raw),prepared=shaped(parsed.database),s=summary(prepared.database);
  if(!Array.isArray(prepared.database.expenses)||!Array.isArray(prepared.database.income))throw new Error('Required transaction collections are missing');
  return {...parsed,prepared:prepared.database,migration:prepared.migration,summary:s};
}
function createRestoreSnapshot(){
  try{
    const current=localStorage.getItem(DB_KEY);
    if(!current)return false;
    const payload={app:'MoneyGoWhere',kind:'pre-restore-snapshot',createdAt:now(),appVersion:RELEASE,database:JSON.parse(current),localPreferences:captureUiPreferences()};
    localStorage.setItem(RESTORE_ROLLBACK_KEY,JSON.stringify(payload));
    return true;
  }catch(err){console.warn('MoneyGoWhere pre-restore snapshot failed',err);return false}
}
function restoreValidated(preview){
  if(!preview?.prepared)throw new Error('Restore preview is missing');
  const snapshotCreated=createRestoreSnapshot(),restored=clone(preview.prepared);
  restored.updatedAt=now();
  restored.backupMeta={...(restored.backupMeta||{}),lastRestoredAt:restored.updatedAt,lastRestoreKind:preview.kind,restoredByVersion:RELEASE};
  sync(restored);
  localStorage.setItem(DB_KEY,JSON.stringify(restored));
  if(preview.kind==='full-backup')applyUiPreferences(preview.preferences);
  window.db=restored;
  if(typeof db!=='undefined')db=restored;
  document.dispatchEvent(new CustomEvent('mgw:data-restored',{detail:{kind:preview.kind,fromSchema:preview.migration?.fromSchema,toSchema:preview.migration?.toSchema,migrated:Boolean(preview.migration?.migrated),snapshotCreated,backupMeta:preview.meta}}));
  try{window.MGWAccountRegistry?.sync?.(restored,{persist:true});window.MGWRecurringEngine?.sync?.(restored,{persist:true})}catch{}
  if(typeof renderAll==='function')renderAll();
  return {snapshotCreated,database:restored};
}
function rollbackRestore(){
  try{
    const raw=localStorage.getItem(RESTORE_ROLLBACK_KEY);if(!raw)return {ok:false,reason:'missing'};
    const snap=JSON.parse(raw);if(!isObj(snap.database))return {ok:false,reason:'invalid'};
    localStorage.setItem(DB_KEY,JSON.stringify(snap.database));applyUiPreferences(snap.localPreferences);
    window.db=snap.database;if(typeof db!=='undefined')db=snap.database;
    if(typeof renderAll==='function')renderAll();
    document.dispatchEvent(new CustomEvent('mgw:data-restored',{detail:{kind:'rollback'}}));
    return {ok:true};
  }catch(err){console.error('MoneyGoWhere restore rollback failed',err);return {ok:false,reason:'error'}}
}
function fmt(v){if(!v)return 'Unknown';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('en-SG',{dateStyle:'medium',timeStyle:'short'})}
function previewHtml(v){
  const s=v.summary,m=v.meta||{};
  return `<div class="mgw-restore-preview"><p><b>${v.kind==='full-backup'?'Full App Backup':v.kind==='masterdb'?'MoneyGoWhere MasterDB':'Legacy MoneyGoWhere Backup'}</b><br><small>Exported: ${esc(fmt(m.exportedAt))} · App ${esc(m.appVersion||'legacy')} · Schema ${esc(m.schemaVersion??v.migration?.fromSchema??'—')} → ${esc(v.prepared.schemaVersion??2)}</small></p><div class="mgw-restore-grid"><div><small>Expenses</small><strong>${s.expenses}</strong></div><div><small>Income</small><strong>${s.income}</strong></div><div><small>Accounts</small><strong>${s.accounts}</strong></div><div><small>Recurring</small><strong>${s.recurringItems}</strong></div><div><small>Budgets</small><strong>${s.budgets}</strong></div><div><small>Import history</small><strong>${s.importHistory}</strong></div><div><small>Quarantined</small><strong>${s.quarantined}</strong></div></div><p class="mgw-muted">A local rollback snapshot of your current database will be created before restore. Nothing is replaced until you confirm.</p><div class="mgw-restore-actions"><button type="button" class="secondary-btn" id="mgwCancelRestore">Cancel</button><button type="button" class="primary-btn" id="mgwConfirmRestore">Restore Backup</button></div></div>`;
}
function showPreview(v){
  const modal=document.querySelector('#modal'),body=document.querySelector('#modalBody'),title=document.querySelector('#modalTitle');
  if(!modal||!body||!title){if(confirm(`Restore this MoneyGoWhere backup with ${v.summary.expenses} expenses and ${v.summary.accounts} accounts?`)){restoreValidated(v);window.toast?.('Backup restored')}return}
  title.textContent='Restore Preview';body.innerHTML=previewHtml(v);try{if(!modal.open)modal.showModal()}catch{modal.setAttribute('open','')}
  body.querySelector('#mgwCancelRestore')?.addEventListener('click',()=>{try{modal.close()}catch{modal.removeAttribute('open')}},{once:true});
  body.querySelector('#mgwConfirmRestore')?.addEventListener('click',()=>{try{restoreValidated(v);try{modal.close()}catch{modal.removeAttribute('open')}window.toast?.(v.migration?.migrated?'Backup restored and upgraded':'Backup restored')}catch(err){console.error('MoneyGoWhere restore failed',err);window.toast?.('Restore failed — current data was kept')}},{once:true});
}
function restoreFile(file){
  const r=new FileReader();
  r.onload=()=>{try{showPreview(validate(JSON.parse(r.result)))}catch(err){console.error('MoneyGoWhere backup validation failed',err);window.toast?.('Invalid or unsupported MoneyGoWhere backup')}};
  r.onerror=()=>window.toast?.('Could not read backup file');
  r.readAsText(file);
}
function rollbackAvailable(){try{return localStorage.getItem(RESTORE_ROLLBACK_KEY)!==null}catch{return false}}

function installStyles(){
  if(document.getElementById('mgwMasterDbStyles'))return;
  const s=document.createElement('style');s.id='mgwMasterDbStyles';
  s.textContent='.mgw-restore-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.mgw-restore-grid>div{padding:10px;border:1px solid var(--border,#dbe4e4);border-radius:12px}.mgw-restore-grid small,.mgw-restore-grid strong{display:block}.mgw-restore-actions{display:flex;gap:8px;margin-top:14px}.mgw-restore-actions button{flex:1}.mgw-backup-note{font-size:.82rem;opacity:.72;margin:8px 0 0}@media(min-width:720px){.mgw-restore-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}';
  document.head.appendChild(s);
}
function installSettings(){
  installStyles();
  const list=document.querySelector('#view-settings .settings-list');if(!list)return;
  const exportBtn=document.querySelector('#exportBtn'),importInput=document.querySelector('#importInput');
  if(exportBtn){exportBtn.querySelector('b').textContent='Export MasterDB';exportBtn.querySelector('small').textContent='Portable versioned finance database';exportBtn.onclick=null}
  if(!document.getElementById('mgwFullBackupBtn')&&exportBtn){
    const b=document.createElement('button');b.id='mgwFullBackupBtn';b.innerHTML='<span>🛡️</span><div><b>Full App Backup</b><small>Finance data + local app preferences</small></div><i>›</i>';exportBtn.insertAdjacentElement('afterend',b);
  }
  const full=document.getElementById('mgwFullBackupBtn');
  if(exportBtn&&!exportBtn.dataset.mgwMasterBound){exportBtn.dataset.mgwMasterBound='1';exportBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();exportMasterDB()},{capture:true})}
  if(full&&!full.dataset.mgwMasterBound){full.dataset.mgwMasterBound='1';full.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();exportFullBackup()},{capture:true})}
  if(importInput&&!importInput.dataset.mgwMasterBound){importInput.dataset.mgwMasterBound='1';importInput.onchange=null;importInput.addEventListener('change',e=>{const file=e.target.files?.[0];if(file)restoreFile(file);e.target.value=''},{capture:true})}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSettings,{once:true});else installSettings();
document.addEventListener('mgw:app-ready',installSettings);
window.MGWMasterDB=Object.freeze({version:RELEASE,formatVersion:FORMAT_VERSION,summary,masterPayload,fullBackupPayload,exportMasterDB,exportFullBackup,validate,restoreFile,restoreValidated,rollbackRestore,rollbackAvailable,restoreRollbackKey:RESTORE_ROLLBACK_KEY});
})();