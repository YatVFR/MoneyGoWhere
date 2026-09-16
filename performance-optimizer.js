// MoneyGoWhere v1.5.5-dev.50 — lightweight formatter and render optimization.
// Module loading and render scheduling are owned by historical-data.js to avoid duplicate loaders and render races.
(()=>{
  'use strict';
  const DEV_RELEASE='1.5.5-dev.50';
  if(typeof money==='function'&&!money.__mgwOptimized){
    const formatters=new Map();
    const optimized=function(v){
      const currency=db?.settings?.currency||'SGD';
      let fmt=formatters.get(currency);
      if(!fmt){fmt=new Intl.NumberFormat('en-SG',{style:'currency',currency});formatters.set(currency,fmt)}
      return fmt.format(Number(v)||0);
    };
    optimized.__mgwOptimized=true;
    money=optimized;
  }
  if(typeof renderCats==='function'&&!renderCats.__mgwOptimized){
    const prior=renderCats;
    const optimized=function(el,cats){
      if(!el)return;
      if(el.id==='topCategories'&&prior.__mgwDashboardBreakdown)return prior(el,cats);
      if(!cats.length){el.className='category-list empty-state';if(el.textContent!=='No spending data yet.')el.textContent='No spending data yet.';return}
      el.className='category-list';
      const total=cats.reduce((t,x)=>t+(Number(x[1])||0),0)||1,max=cats[0][1]||1;
      const html=cats.map(([n,v])=>`<div class="category-row"><div class="category-main"><span class="cat-icon">${MGW.cats[n]||'📦'}</span><div><strong>${n}</strong><small>${((v/total)*100).toFixed(0)}% of spending</small></div></div><strong>${money(v)}</strong><div class="mini-bar"><i style="width:${v/max*100}%"></i></div></div>`).join('');
      if(el.innerHTML!==html)el.innerHTML=html;
    };
    optimized.__mgwOptimized=true;
    optimized.__mgwDashboardBreakdown=Boolean(prior.__mgwDashboardBreakdown);
    renderCats=optimized;
  }
  window.MGWPerformance={version:DEV_RELEASE};
})();
