const APP_VERSION='1.5.5-dev.54';
const CACHE='moneygowhere-uat-dev54-render-coordinator-v16';
const CORE=[
  './','./index.html','./style.css','./uat-runtime-diagnostics.js','./app.js','./db-compatibility.js','./render-coordinator.js','./finance-fix.js','./payment-form-core.js?v=1.5.5-dev.49','./historical-data.js',
  './ocr-enhance.js','./credit-manager.js','./credit-collapse.js','./recurring-schedules.js','./ui-navigation-history.js','./recurring-bills.js',
  './paylater-recurrence.js','./paylater-rule-hotfix.js','./cards-wallets.js','./currency-normalization.js',
  './dashboard-breakdown.js','./salary-trends.js','./onboarding-dev.js','./recurring-onboarding.js','./wallet-import-queue.js','./apple-pay-inbox.js',
  './history-collapse.js','./salary-collapse.js','./guided-walkthrough.js','./transaction-editor.js','./currency-ui.js',
  './icloud-folder-scanner.js','./startup-import-assistant.js','./receipt-match-hint.js','./payment-source-linker.js','./ui-db-scan-button.js',
  './dashboard-core.js','./performance-optimizer.js','./version-badge-authority.js','./manifest.json','./assets/icons/icon.svg','./assets/icons/apple-touch-icon.png','./assets/icons/icon-192.png','./assets/icons/icon-256.png','./assets/icons/icon-384.png','./assets/icons/icon-512.png','./assets/icons/icon-512-maskable.png'
];
const CORE_URLS=new Set(CORE.map(x=>new URL(x,self.location.href).href));
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
async function networkFirst(request){try{const response=await fetch(request),copy=response.clone();caches.open(CACHE).then(c=>c.put(request,copy)).catch(()=>{});return response}catch(_){return caches.match(request).then(c=>c||caches.match('./index.html'))}}
async function coreStaleWhileRevalidate(event){const cache=await caches.open(CACHE),cached=await cache.match(event.request);const update=fetch(event.request).then(response=>{if(response&&response.ok)cache.put(event.request,response.clone()).catch(()=>{});return response});if(cached){event.waitUntil(update.catch(()=>{}));return cached}try{return await update}catch(_){return caches.match('./index.html')}}
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;if(e.request.mode==='navigate'){e.respondWith(networkFirst(e.request));return}if(CORE_URLS.has(e.request.url)){e.respondWith(coreStaleWhileRevalidate(e));return}e.respondWith(networkFirst(e.request))});
