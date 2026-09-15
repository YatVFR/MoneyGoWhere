const APP_VERSION='1.5.5-dev.40';
const CACHE='moneygowhere-v1.5.5-dev-40';
const CORE=[
  './','./index.html','./style.css','./app.js','./finance-fix.js','./historical-data.js',
  './ocr-enhance.js','./credit-manager.js','./credit-collapse.js','./recurring-schedules.js','./ui-navigation-history.js','./recurring-bills.js',
  './paylater-recurrence.js','./paylater-rule-hotfix.js','./cards-wallets.js','./currency-normalization.js',
  './dashboard-breakdown.js','./salary-trends.js','./onboarding-dev.js','./wallet-import-queue.js','./apple-pay-inbox.js',
  './history-collapse.js','./salary-collapse.js','./guided-walkthrough.js','./transaction-editor.js','./currency-ui.js',
  './icloud-folder-scanner.js','./receipt-match-hint.js','./payment-source-linker.js','./ui-db-scan-button.js',
  './dashboard-core.js','./performance-optimizer.js','./startup-import-assistant.js','./version-badge-authority.js','./manifest.json','./assets/icons/icon.svg'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(c=>c||caches.match('./index.html'))))});
