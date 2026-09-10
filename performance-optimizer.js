// MoneyGoWhere v1.5.2 — lightweight performance optimizer
// Keeps behavior unchanged while reducing repeated work during UI renders.
(() => {
  // Cache currency formatters instead of creating Intl.NumberFormat for every value.
  if(typeof money==='function'&&!money.__mgwOptimized){
    const formatters=new Map();
    const optimizedMoney=function(v){
      const currency=db?.settings?.currency||'SGD';
      let fmt=formatters.get(currency);
      if(!fmt){fmt=new Intl.NumberFormat('en-SG',{style:'currency',currency});formatters.set(currency,fmt)}
      return fmt.format(Number(v)||0);
    };
    optimizedMoney.__mgwOptimized=true;
    money=optimizedMoney;
  }

  // Avoid recomputing category totals for every rendered category row.
  if(typeof renderCats==='function'&&!renderCats.__mgwOptimized){
    const optimizedRenderCats=function(el,cats){
      if(!el)return;
      if(!cats.length){el.className='category-list empty-state';if(el.textContent!=='No spending data yet.')el.textContent='No spending data yet.';return}
      el.className='category-list';
      const total=cats.reduce((t,x)=>t+(Number(x[1])||0),0)||1,max=cats[0][1]||1;
      const html=cats.map(([n,v])=>`<div class="category-row"><div class="category-main"><span class="cat-icon">${MGW.cats[n]||'📦'}</span><div><strong>${n}</strong><small>${((v/total)*100).toFixed(0)}% of spending</small></div></div><strong>${money(v)}</strong><div class="mini-bar"><i style="width:${v/max*100}%"></i></div></div>`).join('');
      if(el.innerHTML!==html)el.innerHTML=html;
    };
    optimizedRenderCats.__mgwOptimized=true;
    renderCats=optimizedRenderCats;
  }

  // Collapse multiple synchronous render requests into one animation frame.
  // This is especially useful because several compatibility layers can request renderAll.
  if(typeof renderAll==='function'&&!renderAll.__mgwFrameScheduled){
    const fullRender=renderAll;
    let queued=false;
    const scheduled=function(){
      if(queued)return;
      queued=true;
      const run=()=>{queued=false;fullRender()};
      if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0);
    };
    scheduled.__mgwFrameScheduled=true;
    renderAll=scheduled;
  }
})();