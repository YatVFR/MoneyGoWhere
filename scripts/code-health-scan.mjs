import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const failures=[];
const warnings=[];
const passes=[];
const check=(name,ok,detail='')=>{(ok?passes:failures).push({name,detail})};
const warn=(name,detail='')=>warnings.push({name,detail});

const index=read('index.html');
const build=(index.match(/const BUILD='([^']+)'/)||[])[1]||'';
const rel=index.match(/MGW_RELEASE=Object\.freeze\(\{appVersion:BUILD,schemaVersion:(\d+),dataVersion:(\d+)/);
const schema=Number(rel?.[1]||0),dataVersion=Number(rel?.[2]||0);
check('release identity present',Boolean(build&&schema&&dataVersion),`build ${build||'—'} · schema ${schema||'—'} · data ${dataVersion||'—'}`);

const direct=[...index.matchAll(/<script src="([^"]+\.js)(?:\?v=([^"]+))?"/g)].map(m=>({file:m[1].replace(/^\.\//,''),version:m[2]||''}));
for(const x of direct)if(x.version)check('static cache version: '+x.file,x.version===build,`${x.version} vs ${build}`);

const historical=read('historical-data.js');
const moduleLists=[...historical.matchAll(/const\s+(MGW_[A-Z_]+_MODULES)=\[([\s\S]*?)\];/g)].map(m=>({
  name:m[1],
  files:[...m[2].matchAll(/'([^']+\.js)'/g)].map(x=>x[1].replace(/^\.\//,''))
}));
const dynamic=moduleLists.flatMap(x=>x.files);
check('dynamic modules unique',new Set(dynamic).size===dynamic.length,dynamic.join(', '));
const directNames=new Set(direct.map(x=>x.file));
const overlap=dynamic.filter(x=>directNames.has(x));
check('direct/dynamic loaders do not overlap',overlap.length===0,overlap.join(', ')||'none');

const sw=read('service-worker.js');
const shell=(sw.match(/const SHELL=\[([\s\S]*?)\];/)||[])[1]||'';
const shellFiles=[...shell.matchAll(/'\.\/([^']+\.js)'/g)].map(m=>m[1]);
const runtime=[...new Set([...direct.map(x=>x.file),...dynamic,'service-worker.js'])];
for(const p of runtime)check('runtime file exists: '+p,exists(p),exists(p)?'present':'missing');
for(const p of runtime.filter(x=>x!=='service-worker.js'))check('offline shell contains: '+p,shellFiles.includes(p),shellFiles.includes(p)?'cached':'missing');
check('versioned offline cache ignores query string',sw.includes('ignoreSearch:true'),'cache-busting URLs can use pre-cached shell files');

let renderWrappers=0,bodyObservers=0,storageWrites=0;
for(const p of runtime){
  if(!exists(p))continue;
  const c=read(p);
  try{new vm.Script(c,{filename:p});passes.push({name:'syntax: '+p,detail:'ok'})}catch(e){failures.push({name:'syntax: '+p,detail:e.message})}
  const hardRelease=[
    ...c.matchAll(/const\s+(?:RELEASE|VERSION)\s*=\s*['"](\d+\.\d+[^'"]*)['"]/g),
    ...c.matchAll(/appVersion\s*:\s*['"](\d+\.\d+[^'"]*)['"]/g)
  ].map(m=>m[1]);
  check('dynamic release identity: '+p,hardRelease.length===0,hardRelease.join(', ')||'runtime-derived');
  for(const m of c.matchAll(/dataVersion\s*:\s*(\d+)/g)){
    const n=Number(m[1]);
    if(n<dataVersion)failures.push({name:'stale data version: '+p,detail:`${n} < current ${dataVersion}`});
  }
  const fallback=[...c.matchAll(/window\.MGW_RELEASE\|\|\{[^}]*schemaVersion:(\d+),dataVersion:(\d+)/g)];
  for(const m of fallback){
    check('release fallback schema/data: '+p,Number(m[1])===schema&&Number(m[2])===dataVersion,`schema ${m[1]} data ${m[2]}`);
  }
  renderWrappers+=(c.match(/renderAll\s*=\s*function/g)||[]).length;
  bodyObservers+=(c.match(/new\s+MutationObserver[\s\S]{0,300}?observe\(document\.body/g)||[]).length;
  storageWrites+=(c.match(/localStorage\.setItem/g)||[]).length;
}

const modelFiles=['account-registry.js','recurring-engine.js','transaction-engine.js'];
const models=modelFiles.map(p=>({p,v:Number((read(p).match(/MODEL_VERSION=(\d+)/)||[])[1]||0)}));
check('canonical model versions aligned',new Set(models.map(x=>x.v)).size===1&&models[0].v>0,models.map(x=>`${x.p}=${x.v}`).join(', '));

const tx=read('transaction-engine.js');
check('transaction totals are currency-normalized',tx.includes('MGWCurrency?.sgdAmount'),'foreign-currency expenses use SGD base values');
const dashboard=read('dashboard-core.js');
check('cycle income includes bonus and one-off',dashboard.includes('num(x.bonus)+num(x.oneOff)'),'actual cycle income composition');
check('salary insights preserve enhanced renderer',historical.includes('MGWSalaryTrends?.render'),'Insights does not overwrite salary module');
check('settings loader yields between modules',historical.includes('await mgwWaitForInteractionIdle();')&&historical.includes('setTimeout(resolve,32)'),'Settings remains responsive while feature modules load');
const currencyUi=read('currency-ui.js'),paymentLinker=read('payment-source-linker.js'),recSchedules=read('recurring-schedules.js');
check('settings modules avoid body observers',!currencyUi.includes("observe(document.body")&&!paymentLinker.includes("observe(document.body"),'currency/payment Settings refresh is event-driven');
check('recurring schedules avoid dashboard observer',!recSchedules.includes("observer.observe(root"),'recurring UI refreshes through deterministic render events');
const masterdb=read('masterdb-v1.js'),appJs=read('app.js'),historyCollapse=read('history-collapse.js');
check('restore event follows canonical sync',masterdb.indexOf("MGWTransactionEngine?.sync?.(restored,{persist:false})")<masterdb.indexOf("new CustomEvent('mgw:data-restored'"),'restored history is canonical before UI notification');
check('core UI refreshes on restore',appJs.includes("document.addEventListener('mgw:data-restored'")&&appJs.includes("MGWHistoryCollapse?.refresh?.()"),'history and active insights refresh without reload');
check('history shell rebinds on restore',historyCollapse.includes("document.addEventListener('mgw:data-restored'"),'collapsible transaction history follows restored DOM');
check('core runtime can adopt restored database',appJs.includes('function adoptDatabase(next)')&&appJs.includes('window.MGWAdoptDatabase=adoptDatabase'),'analytics closures switch to restored DB object');
check('restore passes database object to UI',masterdb.includes('database:restored')&&masterdb.includes('MGWAdoptDatabase?.(restored)'),'restore event and core state share the same database');

if(renderWrappers>8)warn('renderAll wrapper depth',`${renderWrappers} runtime wrappers; prefer events for future modules`);
if(bodyObservers>4)warn('document.body MutationObservers',`${bodyObservers} observers; watch Safari redraw cost`);
if(storageWrites>20)warn('direct localStorage writes',`${storageWrites} writes across runtime modules; central persistence remains a future refactor target`);

console.log(`MoneyGoWhere code health: ${passes.length} passed, ${failures.length} failed, ${warnings.length} warning(s)`);
for(const x of warnings)console.warn('WARN',x.name,x.detail?'- '+x.detail:'');
for(const x of failures)console.error('FAIL',x.name,x.detail?'- '+x.detail:'');
if(failures.length)process.exit(1);

check('Food & Beverages category available',appJs.includes("'Food & Beverages':'🍴'"),'expense and budget forms expose the new category');
const indexHtml=read('index.html');
check('manual refresh reloads latest app',indexHtml.includes("3,'Refreshing','Reloading current data'")&&indexHtml.includes("setTimeout(()=>location.reload(),180)"),'refresh works even when no service-worker update is waiting');