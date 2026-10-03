import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function setup(){
 const events=new Map(),microtasks=[],frames=[],stored=new Map(),scrollCalls=[];
 const detail=(id,open)=>({id,tagName:'DETAILS',dataset:{},open});
 const root={id:'view-dashboard',details:[detail('mgwPlannedIncluded',true),detail('another',false)],scrollers:[{id:'inner-scroll',tagName:'DIV',dataset:{},scrollTop:120,scrollLeft:0}],querySelectorAll(s){return s==='details'?this.details:this.scrollers}};
 let active=root;
 const document={readyState:'loading',querySelector:s=>s==='.view.active'?active:null,addEventListener(name,fn,options){if(!events.has(name))events.set(name,[]);events.get(name).push({fn,capture:options===true||options?.capture})},dispatchEvent(event){for(const {fn} of [...(events.get(event.type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture)))fn(event)}};
 const c={console,Date,document,setTimeout:()=>{},CustomEvent:class{constructor(type){this.type=type}},db:{expenses:[],income:[],recurringBills:[{id:'b',name:'Bill',amount:20,active:true,dueDay:25}],recurringCommitments:[],monthlyCommitments:[],recurringIncome:[],payLaterAccounts:[]},localStorage:{setItem:(k,v)=>stored.set(k,v)},queueMicrotask:fn=>microtasks.push(fn),requestAnimationFrame:fn=>frames.push(fn),scrollX:0,scrollY:640,scrollTo({left,top}){c.scrollX=left;c.scrollY=top;scrollCalls.push(top)},renderAll(){root.details=[detail('mgwPlannedIncluded',false),detail('another',true)];root.scrollers=[{id:'inner-scroll',tagName:'DIV',dataset:{},scrollTop:0,scrollLeft:0}];c.scrollY=0}};
 c.window=c;c.MGWAdoptDatabase=x=>c.db=x;vm.createContext(c);for(const p of ['recurring-engine.js','recurring-swipe.js','editing-position.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);events.get('DOMContentLoaded').at(-1).fn();
 return {c,root,events,frames,scrollCalls,microtasks,setActive:x=>active=x,flushMicro(){while(microtasks.length)microtasks.shift()()},flush(){while(microtasks.length||frames.length){while(microtasks.length)microtasks.shift()();const batch=frames.splice(0);for(const fn of batch)fn()}}};
}
test('Pause and Active retain open and closed menu states plus page and nested scroll',()=>{
 const f=setup();for(const active of [false,true,false]){f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:20,active});f.flush();assert.equal(f.root.details[0].open,true);assert.equal(f.root.details[1].open,false);assert.equal(f.c.scrollY,640);assert.equal(f.root.scrollers[0].scrollTop,120);assert.equal(f.c.db.recurringBills[0].active,active)}
});
test('Edit saves and Undo-like updates use the same preservation path',()=>{const f=setup();f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:35,name:'Updated Bill'});f.flush();assert.equal(f.root.details[0].open,true);assert.equal(f.c.scrollY,640);f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:35,active:false});f.flush();f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:35,active:true});f.flush();assert.equal(f.c.scrollY,640);assert.equal(f.c.db.recurringBills[0].name,'Updated Bill')});
test('late render frame cannot leave the menu collapsed',()=>{const f=setup();f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:20,active:false});f.flushMicro();f.frames.push(()=>{f.root.details[0].open=false;f.c.scrollY=0});f.flush();assert.equal(f.root.details[0].open,true);assert.equal(f.c.scrollY,640)});
test('navigation cancels restoration into another view',()=>{const f=setup();f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:20,active:false});f.setActive({id:'view-settings',querySelectorAll:()=>[]});f.c.scrollY=50;f.flush();assert.equal(f.c.scrollY,50);assert.equal(f.scrollCalls.length,0)});
test('new user interaction cancels a pending scroll restoration',()=>{const f=setup();f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:20,active:false});f.c.document.dispatchEvent({type:'touchstart'});f.c.scrollY=90;f.flush();assert.equal(f.c.scrollY,90);assert.equal(f.scrollCalls.length,0)});
test('only the most recent queued refresh restores its scroll snapshot',()=>{const f=setup();f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:20,active:false});f.c.scrollY=300;f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:20,active:true});f.flush();assert.equal(f.c.scrollY,300);assert.ok(f.scrollCalls.every(x=>x===300))});
test('database restoration cancels pending editing snapshots',()=>{const f=setup();f.c.MGWRecurringSwipe.update('REC-bill-b',{amount:20,active:false});f.c.document.dispatchEvent({type:'mgw:data-restored'});f.c.scrollY=80;f.flush();assert.equal(f.c.scrollY,80);assert.equal(f.scrollCalls.length,0)});
test('Settings outer sections retain expansion state',()=>{const f=setup();f.root.id='view-settings';f.root.details=[{tagName:'DETAILS',dataset:{settingsSection:'mgwPausedRecurring'},open:true},{id:'mgwCompletedLater',dataset:{},tagName:'DETAILS',open:false}];const snapshot=f.c.MGWEditingPosition.capture();f.root.details=[{tagName:'DETAILS',dataset:{settingsSection:'mgwPausedRecurring'},open:false},{id:'mgwCompletedLater',dataset:{},tagName:'DETAILS',open:true}];assert.equal(f.c.MGWEditingPosition.restore(snapshot),true);assert.equal(f.root.details[0].open,true);assert.equal(f.root.details[1].open,false)});
console.log(`Editing position regression: ${passed} passed`);
test('dashboard section controls are recreated after refresh without duplicating buttons',()=>{
 const source=fs.readFileSync('recurring-schedules.js','utf8');const start=source.indexOf('function makeCollapsible('),end=source.indexOf('function dashboardCards(',start);
 const head=()=>({buttons:[],classList:{add(){}},querySelector(s){return s==='.mgw-collapse-btn'?this.buttons[0]||null:null},appendChild(b){this.buttons.push(b)}});
 const h=head(),content={hidden:false},el={dataset:{mgwCollapse:'1'},children:[h,content],head:h};
 const c={db:{settings:{collapsedDashboard:{section:false}}},directHeader:x=>x.head,stableKey:()=> 'section',document:{createElement(){return {attributes:{},setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]},addEventListener(){}}}},console};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 c.makeCollapsible(el,0);assert.equal(h.buttons.length,1);assert.equal(content.hidden,false);c.makeCollapsible(el,0);assert.equal(h.buttons.length,1);
 const fresh=head(),newContent={hidden:false};el.head=fresh;el.children=[fresh,newContent];c.db.settings.collapsedDashboard.section=true;c.makeCollapsible(el,0);assert.equal(fresh.buttons.length,1);assert.equal(newContent.hidden,true);assert.equal(fresh.buttons[0].getAttribute('aria-expanded'),'false');
});
console.log(`All editing position regressions: ${passed} passed`);
