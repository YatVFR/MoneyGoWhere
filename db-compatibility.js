// MoneyGoWhere UAT database compatibility layer.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.51', DATA_VERSION=13;
  const ARRAY_KEYS=['expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments','monthlyCommitments','recurringIncome','recurringCommitments','recurringBills','walletAccounts','importQueue','importHistory','receiptImportQueue','receiptImportHistory','bankAccounts'];
  const OBJECT_KEYS=['settings','migration','merchantRules','paymentSourceMap','importQuarantine','importMeta'];
  const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const validDate=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d};
  const finite=(v,fallback=0)=>{const n=Number(v);return Number.isFinite(n)?n:fallback};
  function normalize(input,{source='runtime'}={}){
    const x=isObj(input)?structuredClone(input):{};
    const report={source,createdArrays:[],createdObjects:[],invalidPendingImportsQuarantined:0,duplicateIdsRepaired:0};
    for(const k of ARRAY_KEYS)if(!Array.isArray(x[k])){x[k]=[];report.createdArrays.push(k)}
    for(const k of OBJECT_KEYS)if(!isObj(x[k])){x[k]={};report.createdObjects.push(k)}
    if(!isObj(x.budgets))x.budgets={};x.budgets.monthly=finite(x.budgets.monthly);if(!isObj(x.budgets.categories))x.budgets.categories={};
    x.settings.currency=String(x.settings.currency||'SGD').toUpperCase();if(!isObj(x.settings.safeSpend))x.settings.safeSpend={reserve:0};if(!isObj(x.settings.payCycle))x.settings.payCycle={mode:'payday',day:25};
    x.settings.payCycle.mode=x.settings.payCycle.mode==='calendar'?'calendar':'payday';x.settings.payCycle.day=Math.min(31,Math.max(1,finite(x.settings.payCycle.day,25)));
    for(const k of ['expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments','walletAccounts']){
      const seen=new Set();x[k]=x[k].filter(v=>isObj(v)).map((v,i)=>{let id=String(v.id||'').trim();if(!id||seen.has(id)){id='MGW-'+k.toUpperCase()+'-'+Date.now()+'-'+i;report.duplicateIdsRepaired++}seen.add(id);return {...v,id}})
    }
    x.expenses=x.expenses.filter(v=>validDate(v.date)).map(v=>({...v,amount:finite(v.amount),currency:String(v.currency||x.settings.currency||'SGD').toUpperCase(),category:String(v.category||'Other')}));
    x.income=x.income.filter(v=>validDate(v.date)).map(v=>({...v,baseSalary:finite(v.baseSalary),netSalary:finite(v.netSalary),bonus:finite(v.bonus),oneOff:finite(v.oneOff)}));
    x.creditAccounts=x.creditAccounts.map(v=>({...v,accountType:'credit',name:String(v.name||v.nickname||v.cardProduct||'Credit Card'),nickname:String(v.nickname||v.name||''),limit:finite(v.limit),outstanding:finite(v.outstanding),statementBalance:v.statementBalance===''?'':finite(v.statementBalance),minimumPayment:v.minimumPayment===''?'':finite(v.minimumPayment)}));
    x.walletAccounts=x.walletAccounts.map(v=>({...v,accountType:'wallet',name:String(v.name||v.nickname||v.issuer||'Wallet'),nickname:String(v.nickname||v.name||''),baseCurrency:String(v.baseCurrency||x.settings.currency||'SGD').toUpperCase()}));
    const q=x.importQuarantine;if(!Array.isArray(q.expenses))q.expenses=[];if(!Array.isArray(q.income))q.income=[];if(!Array.isArray(q.history))q.history=[];if(!Array.isArray(q.receiptHistory))q.receiptHistory=[];
    const good=[];for(const item of x.importQueue){if(item?.date&&!validDate(item.date)){if(!q.history.some(h=>h?.id===item.id))q.history.push({...item,status:'quarantined',quarantineReason:'invalid-date'});report.invalidPendingImportsQuarantined++}else good.push(item)}x.importQueue=good;
    x.version=1;x.importMeta.uatCompatibilityNormalization={appVersion:RELEASE,schemaVersion:1,dataVersion:DATA_VERSION,normalizedAt:new Date().toISOString(),report};
    return {db:x,report};
  }
  function persistNormalized(next){
    const serialized=JSON.stringify(next);localStorage.setItem(MGW.key,serialized);const verify=JSON.parse(localStorage.getItem(MGW.key)||'null');if(!verify||!Array.isArray(verify.expenses)||!Array.isArray(verify.income))throw new Error('Database normalization read-back failed');return verify;
  }
  try{const r=normalize(db,{source:'startup'});db=persistNormalized(r.db);window.MGWDBCompatibility={version:RELEASE,normalize,report:r.report}}catch(err){window.MGWUATDiagnostics?.capture?.(err,'db-compat-startup')}
  importData=function(file){
    const reader=new FileReader();
    reader.onload=()=>{try{
      const parsed=JSON.parse(reader.result);if(!isObj(parsed))throw new Error('Backup root must be an object');
      const r=normalize(parsed,{source:'restore'});db=persistNormalized(r.db);
      try{renderAll()}catch(err){window.MGWUATDiagnostics?.capture?.(err,'db-compat-post-import-render')}
      toast('Backup restored · '+r.report.invalidPendingImportsQuarantined+' invalid import(s) quarantined');
      window.MGWUATDiagnostics?.selfCheck?.('after-db-import');
    }catch(err){window.MGWUATDiagnostics?.capture?.(err,'db-compat-import');toast('Backup incompatible or damaged — existing data kept')}
    };
    reader.onerror=()=>toast('Could not read backup file');
    reader.readAsText(file);
  };
})();