// MoneyGoWhere UAT database compatibility layer.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.56', DATA_VERSION=14, SCHEMA_VERSION=1;
  const ARRAY_KEYS=['expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments','monthlyCommitments','recurringIncome','recurringCommitments','recurringBills','walletAccounts','importQueue','importHistory','receiptImportQueue','receiptImportHistory','bankAccounts'];
  const OBJECT_KEYS=['settings','migration','merchantRules','paymentSourceMap','importQuarantine','importMeta','devImportReview'];
  const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v));
  const validDate=v=>{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d};
  const finite=(v,fallback=0)=>{if(v===''||v==null)return fallback;const n=Number(v);return Number.isFinite(n)?n:fallback};
  const optionalNumber=v=>v===''||v==null?'':finite(v);
  const boundedDay=v=>v===''||v==null?'':Math.min(31,Math.max(1,Math.trunc(finite(v,1))));
  const uniqueRows=(rows,key,report)=>{const seen=new Set();return rows.filter(isObj).map((v,i)=>{let id=String(v.id||'').trim();if(!id||seen.has(id)){id='MGW-'+key.toUpperCase()+'-'+Date.now()+'-'+i;report.duplicateIdsRepaired++}seen.add(id);return {...v,id}})};
  function normalize(input,{source='runtime'}={}){
    const x=isObj(input)?clone(input):{};
    const report={source,createdArrays:[],createdObjects:[],invalidExpensesQuarantined:0,invalidIncomeQuarantined:0,invalidPendingImportsQuarantined:0,duplicateIdsRepaired:0,sourceDataVersion:finite(input?.backupMeta?.dataVersion??input?.importMeta?.sourceBackupMeta?.dataVersion,0)};
    for(const k of ARRAY_KEYS)if(!Array.isArray(x[k])){x[k]=[];report.createdArrays.push(k)}
    for(const k of OBJECT_KEYS)if(!isObj(x[k])){x[k]={};report.createdObjects.push(k)}
    if(!isObj(x.budgets))x.budgets={};x.budgets.monthly=finite(x.budgets.monthly);if(!isObj(x.budgets.categories))x.budgets.categories={};
    x.settings.currency=String(x.settings.currency||'SGD').toUpperCase();if(!isObj(x.settings.safeSpend))x.settings.safeSpend={reserve:0};x.settings.safeSpend.reserve=finite(x.settings.safeSpend.reserve);
    if(!isObj(x.settings.payCycle))x.settings.payCycle={mode:'payday',day:25};x.settings.payCycle.mode=x.settings.payCycle.mode==='calendar'?'calendar':'payday';x.settings.payCycle.day=Math.min(31,Math.max(1,Math.trunc(finite(x.settings.payCycle.day,25))));
    if(!isObj(x.settings.paymentMethods))x.settings.paymentMethods={};
    const q=x.importQuarantine;for(const k of ['expenses','income','history','receiptHistory'])if(!Array.isArray(q[k]))q[k]=[];
    for(const k of ['expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments','walletAccounts','bankAccounts'])x[k]=uniqueRows(x[k],k,report);
    const goodExpenses=[];for(const v of x.expenses){if(!validDate(v.date)){if(!q.expenses.some(h=>h?.id===v.id))q.expenses.push({...v,quarantineReason:'invalid-date'});report.invalidExpensesQuarantined++;continue}goodExpenses.push({...v,date:String(v.date).slice(0,10),amount:finite(v.amount),currency:String(v.currency||x.settings.currency||'SGD').toUpperCase(),category:String(v.category||'Other')})}x.expenses=goodExpenses;
    const goodIncome=[];for(const v of x.income){if(!validDate(v.date)){if(!q.income.some(h=>h?.id===v.id))q.income.push({...v,quarantineReason:'invalid-date'});report.invalidIncomeQuarantined++;continue}goodIncome.push({...v,date:String(v.date).slice(0,10),baseSalary:finite(v.baseSalary),netSalary:finite(v.netSalary),bonus:finite(v.bonus),oneOff:finite(v.oneOff)})}x.income=goodIncome;
    x.creditAccounts=x.creditAccounts.map(v=>({...v,accountType:'credit',name:String(v.name||v.nickname||v.cardProduct||'Credit Card'),nickname:String(v.nickname||v.name||''),limit:finite(v.limit),outstanding:finite(v.outstanding),startingBalance:optionalNumber(v.startingBalance),statementBalance:optionalNumber(v.statementBalance),minimumPayment:optionalNumber(v.minimumPayment),plannedPayment:optionalNumber(v.plannedPayment),spendingBudget:optionalNumber(v.spendingBudget),statementDay:boundedDay(v.statementDay),dueDay:boundedDay(v.dueDay)}));
    x.walletAccounts=x.walletAccounts.map(v=>{const type=['wallet','debit','prepaid','other'].includes(v.accountType)?v.accountType:'wallet';return {...v,accountType:type,name:String(v.name||v.nickname||v.cardProduct||v.issuer||'Wallet'),nickname:String(v.nickname||v.name||''),balance:optionalNumber(v.balance),baseCurrency:String(v.baseCurrency||x.settings.currency||'SGD').toUpperCase()}});
    x.payLaterAccounts=x.payLaterAccounts.map(v=>({...v,name:String(v.name||'Pay-Later'),outstanding:finite(v.outstanding),cycleDue:finite(v.cycleDue),productCost:v.productCost==null?'':optionalNumber(v.productCost),downpayment:v.downpayment==null?'':optionalNumber(v.downpayment),fees:v.fees==null?'':optionalNumber(v.fees),interestAmount:v.interestAmount==null?'':optionalNumber(v.interestAmount),durationMonths:v.durationMonths==null?'':Math.max(1,Math.trunc(finite(v.durationMonths,1))),dueDay:boundedDay(v.dueDay),customMonthlyPayment:v.customMonthlyPayment==null?'':optionalNumber(v.customMonthlyPayment),totalRepayable:v.totalRepayable==null?'':optionalNumber(v.totalRepayable),recurrenceEnabled:Boolean(v.recurrenceEnabled),status:String(v.status||'active')}));
    const good=[];for(const item of x.importQueue){if(item?.date&&!validDate(item.date)){if(!q.history.some(h=>h?.id===item.id))q.history.push({...item,status:'quarantined',quarantineReason:'invalid-date'});report.invalidPendingImportsQuarantined++}else good.push(item)}x.importQueue=good;
    x.version=1;
    const now=new Date().toISOString();
    x.backupMeta={...(isObj(x.backupMeta)?x.backupMeta:{}),appVersion:RELEASE,schemaVersion:SCHEMA_VERSION,dataVersion:DATA_VERSION,cacheVersion:'1-5-5-dev-56',normalizedAt:now};
    x.importMeta.uatCompatibilityNormalization={appVersion:RELEASE,schemaVersion:SCHEMA_VERSION,dataVersion:DATA_VERSION,normalizedAt:now,report};
    return {db:x,report};
  }
  function persistNormalized(next){
    const serialized=JSON.stringify(next),previous=localStorage.getItem(MGW.key);
    try{localStorage.setItem(MGW.key,serialized);const raw=localStorage.getItem(MGW.key);if(raw!==serialized)throw new Error('Database normalization byte verification failed');const verify=JSON.parse(raw||'null');if(!verify||!Array.isArray(verify.expenses)||!Array.isArray(verify.income)||!Array.isArray(verify.creditAccounts)||!Array.isArray(verify.payLaterAccounts)||!Array.isArray(verify.walletAccounts))throw new Error('Database normalization schema verification failed');return verify}
    catch(err){try{if(previous==null)localStorage.removeItem(MGW.key);else localStorage.setItem(MGW.key,previous)}catch(_){}throw err}
  }
  try{const r=normalize(db,{source:'startup'});db=persistNormalized(r.db);window.MGWDBCompatibility={version:RELEASE,dataVersion:DATA_VERSION,normalize,report:r.report}}catch(err){window.MGWUATDiagnostics?.capture?.(err,'db-compat-startup')}
  importData=function(file){
    const reader=new FileReader();
    reader.onload=()=>{const previous=localStorage.getItem(MGW.key);try{
      const parsed=JSON.parse(reader.result);if(!isObj(parsed))throw new Error('Backup root must be an object');
      const r=normalize(parsed,{source:'restore'});db=persistNormalized(r.db);
      try{renderAll()}catch(err){window.MGWUATDiagnostics?.capture?.(err,'db-compat-post-import-render')}
      const q=r.report.invalidExpensesQuarantined+r.report.invalidIncomeQuarantined+r.report.invalidPendingImportsQuarantined;
      toast(q?'Backup restored · '+q+' invalid record(s) quarantined':'Backup restored · database normalized');
      window.MGWUATDiagnostics?.selfCheck?.('after-db-import');
    }catch(err){try{if(previous==null)localStorage.removeItem(MGW.key);else localStorage.setItem(MGW.key,previous);db=load()}catch(_){}window.MGWUATDiagnostics?.capture?.(err,'db-compat-import');toast('Backup incompatible or damaged — existing data kept')}
    };
    reader.onerror=()=>toast('Could not read backup file');
    reader.readAsText(file);
  };
})();