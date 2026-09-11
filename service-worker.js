const APP_VERSION='1.5.4';
const CACHE=`moneygowhere-v${APP_VERSION}`;
const CORE=['./','./index.html','./style.css','./app.js','./finance-fix.js','./historical-data.js','./ocr-enhance.js','./credit-manager.js','./credit-collapse.js','./credit-accounting-fix.js','./smart-budget-insights.js','./performance-optimizer.js','./recurring-schedules.js','./manifest.json','./assets/icons/icon.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));
  // Do not skip waiting automatically: the app UI controls when an update is installed.
});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});return r}).catch(()=>caches.match(e.request).then(c=>c||caches.match('./index.html'))))});
