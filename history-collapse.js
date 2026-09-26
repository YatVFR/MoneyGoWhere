// MoneyGoWhere DEV — collapsible Transaction & Purchase History sections
// UI-only behavior; no personal finance records are bundled here.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.42';
  const state=new Map();
  let installPending=false;

  function addStyles(){
    if(document.querySelector('#mgwHistoryCollapseStyles'))return;
    const s=document.createElement('style');
    s.id='mgwHistoryCollapseStyles';
    s.textContent=`
      .mgw-history-toggle{border:0;background:transparent;padding:6px 4px;display:flex;align-items:center;gap:8px;cursor:pointer;color:inherit;font:inherit}
      .mgw-history-toggle .mgw-history-chevron{display:inline-block;font-size:1.15rem;line-height:1;transition:transform .18s ease;opacity:.65}
      .mgw-history-section.is-expanded .mgw-history-chevron{transform:rotate(90deg)}
      .mgw-history-section-body{display:none}
      .mgw-history-section.is-expanded .mgw-history-section-body{display:block}
      .mgw-history-section .card-head{cursor:pointer}
    `;
    document.head.appendChild(s);
  }

  function wireCard(card,id,label){
    if(!card)return;
    const head=card.querySelector(':scope > .card-head');
    if(!head)return;
    let body=card.querySelector(':scope > .mgw-history-section-body');
    if(!body){
      body=document.createElement('div');
      body.className='mgw-history-section-body';
      [...card.children].filter(x=>x!==head).forEach(x=>body.appendChild(x));
      card.appendChild(body);
    }
    card.classList.add('mgw-history-section');
    card.dataset.mgwHistorySection=id;
    const expanded=state.has(id)?state.get(id):false;
    card.classList.toggle('is-expanded',expanded);
    let btn=head.querySelector('.mgw-history-toggle');
    if(!btn){
      const title=head.firstElementChild;
      btn=document.createElement('button');
      btn.type='button';
      btn.className='mgw-history-toggle';
      btn.setAttribute('aria-label',`Toggle ${label}`);
      btn.innerHTML='<span class="mgw-history-chevron">›</span>';
      head.appendChild(btn);
      if(title)title.setAttribute('role','button');
      const toggle=e=>{
        if(e.target.closest('button:not(.mgw-history-toggle),a,input,select,textarea,label'))return;
        e.preventDefault();
        const next=!card.classList.contains('is-expanded');
        card.classList.toggle('is-expanded',next);
        state.set(id,next);
        btn.setAttribute('aria-expanded',String(next));
      };
      head.addEventListener('click',toggle);
    }
    btn.setAttribute('aria-expanded',String(expanded));
  }

  function install(){
    addStyles();
    const recent=document.querySelector('#recentTransactions')?.closest('article.card');
    wireCard(recent,'transactions','Transaction History');
    wireCard(document.querySelector('#mgwPurchaseHistory'),'purchases','Purchase History');
  }

  function scheduleInstall(){
    if(installPending)return;
    installPending=true;
    queueMicrotask(()=>{installPending=false;install()});
  }

  function boot(){
    install();
    if(window.MGWRenderCoordinator?.register){
      window.MGWRenderCoordinator.register('history-collapse',scheduleInstall,78);
    }
    const roots=[document.querySelector('#view-dashboard'),document.querySelector('#view-insights')].filter(Boolean);
    if(roots.length){
      const observer=new MutationObserver(scheduleInstall);
      roots.forEach(root=>observer.observe(root,{childList:true,subtree:true}));
    }
    window.MGWHistoryCollapse={version:RELEASE,refresh:install};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
