// MoneyGoWhere DEV — database stability guard.
// Keeps malformed/legacy records from blocking startup and coalesces heavy refreshes.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const arrays=['expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments','monthlyCommitments','recurringIncome','recurringCommitments','recurringBills','walletAccounts','importQueue','importHistory','receiptImportQueue','receiptImportHistory','bankAccounts','accounts','recurringItems'];
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const ymd=s=>{if(typeof s!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s.slice(0,10)))return false;const [y,m,d]=s.slice(0,10).split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d};
const uniqueById=rows=>{const seen=new Set();return rows.filter(x=>{if(!isObj(x))return false;const id=String(x.id||'');if(!id)return true;if(seen.has(id))return false;seen.add(id);return true})};
function sanitize(input){
  const db=isObj(input)?input:{};
  arrays.forEach(k=>db[k]=Array.isArray(db[k])?uniqueById(db[k]):[]);
  db.budgets=isObj(db.budgets)?db.budgets:{monthly:0,categories:{}};db.budgets.categories=isObj(db.budgets.categories)?db.budgets.categories:{};
  db.settings=isObj(db.settings)?db.settings:{currency:'SGD'};if(!db.settings.currency)db.settings.currency='SGD';
  db.importQuarantine=isObj(db.importQuarantine)?db.importQuarantine:{};
  ['expenses','income','history','receiptHistory'].forEach(k=>db.importQuarantine[k]=Array.isArray(db.importQuarantine[k])?db.importQuarantine[k]:[]);
  // Recover records quarantined by the old timezone-sensitive date validator.
  const recover=(key,quarantine)=>{const ids=new Set(db[key].map(x=>String(x?.id||'')).filter(Boolean)),keep=[];for(const x of db.importQuarantine[quarantine]){if(x?.quarantineReason==='invalid-date'&&ymd(String(x?.date||'').slice(0,10))){const restored={...x};delete restored.quarantineReason;const id=String(restored.id||'');if(!id||!ids.has(id)){db[key].push(restored);if(id)ids.add(id)}}else keep.push(x)}db.importQuarantine[quarantine]=keep};
  recover('expenses','expenses');recover('income','income');recover('importHistory','history');recover('receiptImportHistory','receiptHistory');
  const clean=(key,quarantine,dateKey='date')=>{const good=[];for(const x of db[key]){if(x?.[dateKey]&&!ymd(String(x[dateKey]).slice(0,10))){db.importQuarantine[quarantine].push({...x,quarantineReason:'invalid-date'});continue}good.push(x)}db[key]=good};
  clean('expenses','expenses');clean('income','income');clean('importHistory','history');clean('receiptImportHistory','receiptHistory');
  // Keep valid user data even when categories/fields come from older releases.
  db.backupMeta=isObj(db.backupMeta)?db.backupMeta:{};
  db.paymentSourceMap=isObj(db.paymentSourceMap)?db.paymentSourceMap:{};
  db.accountModelMeta=isObj(db.accountModelMeta)?db.accountModelMeta:{version:2};
  db.recurringModelMeta=isObj(db.recurringModelMeta)?db.recurringModelMeta:{version:2};
  db.transactionModelMeta=isObj(db.transactionModelMeta)?db.transactionModelMeta:{version:2};
  return db;
}
let renderPending=false;
function requestRender(){if(renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;try{window.renderAll?.()}catch(err){console.error('MoneyGoWhere scheduled render failed',err)}})}
window.MGWStability=Object.freeze({version:RELEASE,sanitize,requestRender});
})();
