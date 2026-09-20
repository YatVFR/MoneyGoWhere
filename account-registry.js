// MoneyGoWhere DEV — Phase 3 unified account registry.
// Adds stable account IDs and payment-source relationships while preserving legacy feature arrays.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const MODEL_VERSION=1;
const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toUpperCase();
const clone=v=>JSON.parse(JSON.stringify(v));
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);

function ensure(database=window.db||{}){
  database.accounts=Array.isArray(database.accounts)?database.accounts:[];
  database.creditAccounts=Array.isArray(database.creditAccounts)?database.creditAccounts:[];
  database.walletAccounts=Array.isArray(database.walletAccounts)?database.walletAccounts:[];
  database.payLaterAccounts=Array.isArray(database.payLaterAccounts)?database.payLaterAccounts:[];
  database.bankAccounts=Array.isArray(database.bankAccounts)?database.bankAccounts:[];
  database.paymentSourceMap=isObj(database.paymentSourceMap)?database.paymentSourceMap:{};
  database.accountModelMeta=isObj(database.accountModelMeta)?database.accountModelMeta:{version:MODEL_VERSION};
  return database;
}
function accountType(source,a){
  if(source==='credit')return 'credit';
  if(source==='paylater')return 'paylater';
  if(source==='bank')return 'bank';
  const t=String(a?.accountType||'').toLowerCase();
  return ['debit','wallet','prepaid','other'].includes(t)?t:'wallet';
}
function label(a){
  return a?.nickname||a?.name||a?.cardProduct||a?.issuer||a?.provider||'Account';
}
function aliases(a){
  const xs=[a?.nickname,a?.name,a?.cardProduct,a?.issuer,a?.paymentIdentifier,a?.provider,a?.bankName,a?.accountName];
  return [...new Set(xs.map(norm).filter(Boolean))];
}
function canonical(source,a){
  if(!a.id)a.id=uid(source==='paylater'?'LATER':source==='credit'?'CARD':source==='bank'?'BANK':'WALLET');
  return {
    id:a.id,
    type:accountType(source,a),
    name:label(a),
    nickname:a.nickname||'',
    issuer:a.issuer||a.provider||a.bankName||'',
    product:a.cardProduct||a.accountName||'',
    currency:String(a.baseCurrency||a.currency||'SGD').toUpperCase(),
    active:a.active!==false,
    sourceCollection:source,
    legacyId:a.id,
    paymentIdentifier:a.paymentIdentifier||'',
    aliases:aliases(a)
  };
}
function sourceRows(database){
  return [
    ...database.creditAccounts.map(a=>['credit',a]),
    ...database.walletAccounts.map(a=>['wallet',a]),
    ...database.payLaterAccounts.map(a=>['paylater',a]),
    ...database.bankAccounts.map(a=>['bank',a])
  ];
}
function sync(database=window.db||{},options={}){
  ensure(database);
  const previous=new Map(database.accounts.map(a=>[a.id,a]));
  const next=[];
  for(const [source,row] of sourceRows(database)){
    const item=canonical(source,row),old=previous.get(item.id);
    next.push(old?{...old,...item,aliases:item.aliases}:item);
  }
  database.accounts=next;
  database.accountModelMeta={
    ...(database.accountModelMeta||{}),
    version:MODEL_VERSION,
    lastSyncedAt:new Date().toISOString(),
    accountCount:next.length
  };
  const linked=linkTransactions(database);
  if(options.persist!==false){
    try{localStorage.setItem(window.MGW?.key||'moneygowhere-db-v1',JSON.stringify(database))}catch(err){console.warn('MoneyGoWhere account registry persistence failed',err)}
  }
  return {accounts:next.length,linked};
}
function byId(id,database=window.db||{}){
  ensure(database);return database.accounts.find(a=>a.id===id)||null;
}
function matchToken(token,database=window.db||{}){
  const t=norm(token);if(!t)return'';
  ensure(database);
  if(database.paymentSourceMap[t]&&byId(database.paymentSourceMap[t],database))return database.paymentSourceMap[t];
  const exact=database.accounts.filter(a=>Array.isArray(a.aliases)&&a.aliases.includes(t));
  if(exact.length===1)return exact[0].id;
  const fuzzy=database.accounts.filter(a=>(a.aliases||[]).some(x=>x&&t.length>=4&&(x.includes(t)||t.includes(x))));
  return fuzzy.length===1?fuzzy[0].id:'';
}
function transactionToken(x){return x?.card||x?.cardIdentity||x?.paymentSource||x?.paymentMethod||''}
function linkTransactions(database=window.db||{}){
  ensure(database);
  let linked=0;
  for(const x of Array.isArray(database.expenses)?database.expenses:[]){
    const existing=x.paymentSourceId||x.paymentAccountId||'';
    if(existing&&byId(existing,database)){
      if(!x.paymentSourceId){x.paymentSourceId=existing;linked++}
      if(!x.paymentAccountId)x.paymentAccountId=existing;
      continue;
    }
    const token=transactionToken(x),id=matchToken(token,database);
    if(id){
      x.paymentSourceId=id;
      x.paymentAccountId=id; // compatibility alias for existing modules
      if(token)database.paymentSourceMap[norm(token)]=id;
      linked++;
    }
  }
  return linked;
}
function resolveTransactionAccount(x,database=window.db||{}){
  const id=x?.paymentSourceId||x?.paymentAccountId||'';
  return id?byId(id,database):null;
}
function orphanCount(database=window.db||{}){
  ensure(database);let n=0;
  for(const x of Array.isArray(database.expenses)?database.expenses:[]){
    const id=x?.paymentSourceId||x?.paymentAccountId||'';
    if(id&&!byId(id,database))n++;
  }
  return n;
}
function describe(database=window.db||{}){
  ensure(database);
  const byType={};for(const a of database.accounts)byType[a.type]=(byType[a.type]||0)+1;
  return {version:MODEL_VERSION,total:database.accounts.length,byType,orphans:orphanCount(database)};
}

function onDataReady(){
  try{const r=sync(window.db||{}, {persist:true});document.dispatchEvent(new CustomEvent('mgw:account-registry-ready',{detail:r}))}
  catch(err){console.error('MoneyGoWhere account registry sync failed',err)}
}
document.addEventListener('mgw:data-ready',onDataReady);
document.addEventListener('mgw:accounts-changed',()=>{try{sync(window.db||{},{persist:true})}catch(err){console.error('MoneyGoWhere account registry refresh failed',err)}});
document.addEventListener('mgw:data-restored',()=>setTimeout(onDataReady,0));
window.MGWAccountRegistry=Object.freeze({version:RELEASE,modelVersion:MODEL_VERSION,ensure,sync,byId,matchToken,linkTransactions,resolveTransactionAccount,orphanCount,describe});
})();