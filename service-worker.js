const params=new URL(self.location.href).searchParams;
const APP_VERSION=params.get('v')||'dev';
const SCOPE_URL=new URL(self.registration.scope);
const SCOPE_PATH=SCOPE_URL.pathname;
const ENV=SCOPE_PATH.includes('/dev/')?'dev':SCOPE_PATH.includes('/uat/')?'uat':'prod';
const CACHE_PREFIX=`moneygowhere-${ENV}-`;
const safeVersion=APP_VERSION.replace(/[^A-Za-z0-9._-]+/g,'-');
const CACHE=`${CACHE_PREFIX}${safeVersion}`;
const SHELL_URL=new URL('index.html',self.registration.scope).href;

const SHELL=[
  './','./index.html','./style.css','./data-stability.js','./boot-phases.js','./app.js',
  './import-normalizer.js','./interaction-recovery.js','./version-badge-authority.js','./finance-fix.js',
  './payment-form-core.js','./historical-data.js','./cards-wallets.js','./wallet-visibility-fix.js',
  './apple-pay-queue-bridge.js','./manifest.json','./assets/icons/icon.svg','./assets/icons/apple-touch-icon.jpg','./assets/branding/loading-logo.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    // Rebuild this build's cache from source so stale JavaScript cannot survive a code-only patch.
    await caches.delete(CACHE);
    const cache=await caches.open(CACHE);
    for(const url of SHELL){
      try{
        const response=await fetch(url,{cache:'reload'});
        if(response&&response.ok)await cache.put(url,response.clone());
      }catch(err){console.warn('MoneyGoWhere shell cache skipped:',url,err)}
    }
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='CLEAR_MGW_CACHES'){
    event.waitUntil((async()=>{
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)).map(key=>caches.delete(key)));
    })());
  }
});

async function navigationNetworkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){cache.put(request,response.clone()).catch(()=>{});cache.put(SHELL_URL,response.clone()).catch(()=>{})}
    return response;
  }catch(err){
    return (await cache.match(request))||(await cache.match(SHELL_URL))||new Response('MoneyGoWhere is offline and no cached app shell is available.',{status:503,headers:{'Content-Type':'text/plain'}});
  }
}

async function versionedCacheFirst(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch(err){
    return new Response('',{status:504,statusText:'MoneyGoWhere asset unavailable'});
  }
}

async function assetNetworkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }catch(err){
    return (await cache.match(request))||new Response('',{status:504,statusText:'MoneyGoWhere asset unavailable'});
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(ENV==='prod'&&(url.pathname.startsWith(`${SCOPE_PATH}dev/`)||url.pathname.startsWith(`${SCOPE_PATH}uat/`)))return;
  if(event.request.mode==='navigate'){event.respondWith(navigationNetworkFirst(event.request));return}
  if(url.searchParams.get('v')===APP_VERSION){event.respondWith(versionedCacheFirst(event.request));return}
  event.respondWith(assetNetworkFirst(event.request));
});
