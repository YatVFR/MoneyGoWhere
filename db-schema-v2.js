// MoneyGoWhere DEV — Phase 2 database schema v2 and migration engine.
// Backward-compatible: keeps current feature arrays while adding explicit schema metadata.
(()=>{'use strict';
const CURRENT_SCHEMA=2;
const CURRENT_DATA=17;
const DB_KEY='moneygowhere-db-v1';
const SNAPSHOT_KEY='moneygowhere-rollback-pre-schema2-v1';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const now=()=>new Date().toISOString();
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const clone=v=>JSON.parse(JSON.stringify(v));
const arrays=[
  'expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments',
  'monthlyCommitments','recurringIncome','recurringCommitments','recurringBills',
  'walletAccounts','bankAccounts','importQueue','importHistory','receiptImportQueue','receiptImportHistory'
];
function empty(){
  const t=now();
  const db={
    app:'MoneyGoWhere',
    version:2,
    schemaVersion:CURRENT_SCHEMA,
    dataVersion:CURRENT_DATA,
    createdAt:t,
    updatedAt:t,
    expenses:[],
    income:[],
    budgets:{monthly:0,categories:{}},
    settings:{currency:'SGD'},
    creditAccounts:[],
    creditPayments:[],
    payLaterAccounts:[],
    payLaterPayments:[],
    monthlyCommitments:[],
    recurringIncome:[],
    recurringCommitments:[],
    recurringBills:[],
    recurringItems:[],
    recurringModelMeta:{version:1,lastSyncedAt:null,itemCount:0},
    walletAccounts:[],
    bankAccounts:[],
    accounts:[],
    paymentSourceMap:{},
    accountModelMeta:{version:1,lastSyncedAt:null,accountCount:0},
    importQueue:[],
    importHistory:[],
    receiptImportQueue:[],
    receiptImportHistory:[],
    importQuarantine:{expenses:[],income:[],history:[],receiptHistory:[]},
    backupMeta:{},
    schemaMeta:{migratedFrom:null,lastMigratedAt:null}
  };
  return db;
}
function shape(input){
  const base=empty(),db=isObj(input)?clone(input):{};
  const out={...base,...db};
  arrays.forEach(k=>out[k]=Array.isArray(db[k])?db[k]:[]);
  out.budgets=isObj(db.budgets)?db.budgets:base.budgets;
  out.budgets.categories=isObj(out.budgets.categories)?out.budgets.categories:{};
  out.settings=isObj(db.settings)?db.settings:base.settings;
  if(!out.settings.currency)out.settings.currency='SGD';
  out.importQuarantine=isObj(db.importQuarantine)?db.importQuarantine:base.importQuarantine;
  ['expenses','income','history','receiptHistory'].forEach(k=>out.importQuarantine[k]=Array.isArray(out.importQuarantine[k])?out.importQuarantine[k]:[]);
  out.backupMeta=isObj(db.backupMeta)?db.backupMeta:{};
  out.recurringItems=Array.isArray(db.recurringItems)?db.recurringItems:[];
  out.recurringModelMeta=isObj(db.recurringModelMeta)?db.recurringModelMeta:{version:1,lastSyncedAt:null,itemCount:0};
  out.accounts=Array.isArray(db.accounts)?db.accounts:[];
  out.paymentSourceMap=isObj(db.paymentSourceMap)?db.paymentSourceMap:{};
  out.accountModelMeta=isObj(db.accountModelMeta)?db.accountModelMeta:{version:1,lastSyncedAt:null,accountCount:0};
  out.schemaMeta=isObj(db.schemaMeta)?db.schemaMeta:{migratedFrom:null,lastMigratedAt:null};
  out.app='MoneyGoWhere';
  out.version=2;
  out.schemaVersion=CURRENT_SCHEMA;
  out.dataVersion=CURRENT_DATA;
  out.createdAt=db.createdAt||db.backupMeta?.createdAt||base.createdAt;
  out.updatedAt=db.updatedAt||base.updatedAt;
  return out;
}
function sourceSchema(input){
  const n=Number(input?.schemaVersion);
  if(Number.isFinite(n)&&n>0)return n;
  const legacy=Number(input?.version);
  return Number.isFinite(legacy)&&legacy>0?legacy:1;
}
function snapshot(raw,fromSchema){
  try{
    if(localStorage.getItem(SNAPSHOT_KEY)!==null)return false;
    const payload={app:'MoneyGoWhere',kind:'pre-schema-migration-snapshot',fromSchema,toSchema:CURRENT_SCHEMA,createdAt:now(),database:raw};
    localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(payload));
    return true;
  }catch(err){
    console.warn('MoneyGoWhere could not create schema rollback snapshot',err);
    return false;
  }
}
function migrate(input,{persist=false,createSnapshot=true}={}){
  const raw=isObj(input)?clone(input):{};
  const from=sourceSchema(raw);
  let migrated=false,snapshotCreated=false;
  if(from<CURRENT_SCHEMA){
    if(createSnapshot)snapshotCreated=snapshot(raw,from);
    migrated=true;
  }
  const out=shape(raw);
  if(migrated){
    out.schemaMeta={...(out.schemaMeta||{}),migratedFrom:from,lastMigratedAt:now(),migrationRelease:RELEASE};
    out.updatedAt=now();
  }
  if(persist){
    try{localStorage.setItem(DB_KEY,JSON.stringify(out))}catch(err){console.error('MoneyGoWhere schema v2 persistence failed',err)}
  }
  return {database:out,fromSchema:from,toSchema:CURRENT_SCHEMA,migrated,snapshotCreated};
}
function touch(database){
  const out=shape(database);
  out.updatedAt=now();
  return out;
}
function rollbackAvailable(){try{return localStorage.getItem(SNAPSHOT_KEY)!==null}catch{return false}}
function rollback(){
  try{
    const raw=localStorage.getItem(SNAPSHOT_KEY);if(!raw)return {ok:false,reason:'missing'};
    const snap=JSON.parse(raw),db=snap?.database;if(!isObj(db))return {ok:false,reason:'invalid'};
    localStorage.setItem(DB_KEY,JSON.stringify(db));
    return {ok:true,fromSchema:snap.fromSchema||1};
  }catch(err){console.error('MoneyGoWhere schema rollback failed',err);return {ok:false,reason:'error'}}
}
window.MGWDatabaseSchema=Object.freeze({
  version:RELEASE,
  currentSchema:CURRENT_SCHEMA,
  currentData:CURRENT_DATA,
  dbKey:DB_KEY,
  snapshotKey:SNAPSHOT_KEY,
  empty,
  shape,
  migrate,
  touch,
  rollbackAvailable,
  rollback
});
})();