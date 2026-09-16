const APP_VERSION='1.5.5-dev.58';
const CACHE_PREFIX='moneygowhere-';
const CACHE='moneygowhere-v1.5.5-dev-58';
const versioned=path=>`${path}${path.includes('?')?'&':'?'}v=${encodeURIComponent(APP_VERSION)}`;

// Keep the install cache intentionally small. Feature modules are loaded by the
// runtime coordinator with release-versioned URLs and cached on first use.
const SHELL=[
  './',
  './index.html',
  versioned('./style.css'),
  versioned('./app.js'),
  versioned('./version-badge-authority.js'),
  versioned('./finance-fix.js'),
  versioned('./payment-form-core.js'),
  versioned('./historical-data.js'),
  versioned('./cards-wallets.js'),
  versioned('./manifest.json'),
  './assets/icons/icon.svg'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const url of SHELL){
      try{
        const response=await fetch(url,{cache:'reload'});
        if(response&&response.ok)await cache.put(url,response.clone());
      }catch(err){
        console.warn('MoneyGoWhere shell cache skipped:',url,err);
      }
    }
    // Do not call skipWaiting here. Updates must not replace the active worker
    // while the app is booting. The refresh UI sends SKIP_WAITING explicitly.
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    // CacheStorage is origin-wide on GitHub Pages. Only remove MoneyGoWhere
    // caches; never delete caches that may belong to another app on the origin.
    await Promise.all(keys
      .filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE)
      .map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='CLEAR_MGW_CACHES'){
    event.waitUntil((async()=>{
      const keys=await caches.keys();
      await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key)));
    })());
  }
});

async function navigationNetworkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok){
      cache.put(request,response.clone()).catch(()=>{});
      cache.put('./index.html',response.clone()).catch(()=>{});
    }
    return response;
  }catch(err){
    return (await cache.match(request))||(await cache.match('./index.html'))||new Response('MoneyGoWhere is offline and no cached app shell is available.',{status:503,headers:{'Content-Type':'text/plain'}});
  }
}

async function versionedCacheFirst(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)await cache.put(request,response.clone());
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

  // Do not intercept third-party libraries/CDNs. Their cache lifecycle is not
  // owned by MoneyGoWhere and should not affect app stability.
  if(url.origin!==self.location.origin)return;

  if(event.request.mode==='navigate'){
    event.respondWith(navigationNetworkFirst(event.request));
    return;
  }

  // Release-versioned assets are immutable for that release, so cache-first is
  // safe. Unversioned assets remain network-first to avoid mixed-build code.
  if(url.searchParams.get('v')===APP_VERSION){
    event.respondWith(versionedCacheFirst(event.request));
    return;
  }

  event.respondWith(assetNetworkFirst(event.request));
});
