import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const fail=[];
const pass=[];
const check=(name,ok,detail='')=>{(ok?pass:fail).push({name,detail});};

const required=[
  'index.html','service-worker.js','db-schema-v2.js','account-registry.js',
  'recurring-engine.js','masterdb-v1.js','transaction-engine.js','release-readiness.js',
  'dashboard-core.js','historical-data.js','app.js'
];
for(const p of required)check('required file: '+p,exists(p),exists(p)?'present':'missing');

const index=read('index.html');
const build=(index.match(/const BUILD='([^']+)'/)||[])[1]||'';
const release=index.match(/MGW_RELEASE=Object\.freeze\(\{appVersion:BUILD,schemaVersion:(\d+),dataVersion:(\d+)/);
check('BUILD declared',Boolean(build),build||'not found');
check('schema >= 2',Number(release?.[1])>=2,`schema ${release?.[1]||'—'}`);
check('data version >= 20',Number(release?.[2])>=20,`data ${release?.[2]||'—'}`);

const staticScripts=[...index.matchAll(/<script src="([^"]+\.js)\?v=([^"]+)"/g)];
for(const [,src,v] of staticScripts)check('cache version: '+src,v===build,`${v} vs ${build}`);

const sw=read('service-worker.js');
for(const p of ['db-schema-v2.js','account-registry.js','recurring-engine.js','masterdb-v1.js','transaction-engine.js','release-readiness.js']){
  check('service worker shell: '+p,sw.includes(`./${p}`),sw.includes(`./${p}`)?'cached':'not cached');
}

const hist=read('historical-data.js');
const arrays=['MGW_CORE_MODULES','MGW_DEFERRED_MODULES','MGW_IMPORT_MODULES','MGW_DASHBOARD_MODULES','MGW_SETTINGS_MODULES'];
for(const name of arrays){
  const m=hist.match(new RegExp(`const ${name}=\\[([\\s\\S]*?)\\];`));
  if(!m){check('module list: '+name,false,'not found');continue}
  const mods=[...m[1].matchAll(/'([^']+\.js)'/g)].map(x=>x[1]);
  check('module list duplicates: '+name,new Set(mods).size===mods.length,mods.join(', '));
}

const settings=(hist.match(/const MGW_SETTINGS_MODULES=\[([\s\S]*?)\];/)||[])[1]||'';
check('release readiness loaded',settings.includes('./release-readiness.js'),'settings loader');

const normalizer=read('import-normalizer.js');
check('MasterDB owns restore path',normalizer.includes('window.MGWMasterDB?.restoreFile'),'import-normalizer compatibility');

const dashboard=read('dashboard-core.js');
check('dashboard uses transaction engine',dashboard.includes('MGWTransactionEngine?.cycle'),'derived cycle calculations');

const tx=read('transaction-engine.js');
for(const field of ['provenance','transactionFingerprint','paymentSourceId','recurringItemId','recurringOverage']){
  check('transaction field: '+field,tx.includes(field),'transaction model');
}

const master=read('masterdb-v1.js');
check('MasterDB kind',master.includes("moneygowhere-masterdb"),'portable DB contract');
check('Full backup kind',master.includes("moneygowhere-full-backup"),'full app contract');
check('restore rollback',master.includes("moneygowhere-restore-rollback-v1"),'rollback snapshot');

console.log(`MoneyGoWhere release smoke: ${pass.length} passed, ${fail.length} failed`);
for(const x of pass)console.log('PASS',x.name,x.detail?'- '+x.detail:'');
for(const x of fail)console.error('FAIL',x.name,x.detail?'- '+x.detail:'');
if(fail.length)process.exit(1);

const accounts=read('account-registry.js');
check('observed wallets supported',accounts.includes('discoverObservedWallets'),'transaction payment sources can become stable wallet accounts');
const recurring=read('recurring-engine.js');
check('historical recurring inference supported',recurring.includes('historicalRecurring'),'strong imported monthly patterns can be normalized');
const app=read('app.js');
for(const category of ['Healthcare','Installments','Subscription','Insurance','Telecom'])check('category UI: '+category,app.includes(category),'extended category display');
