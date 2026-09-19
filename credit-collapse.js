// MoneyGoWhere v1.5.4 — collapsible Cards & Pay-Later UI
// Visual-only enhancement. No finance records or schema changes.
(() => {
  const SECTION_KEY='mgw-ui-cards-paylater-open';
  const ACCOUNT_KEY='mgw-ui-credit-account-open:';
  const getBool=(key,fallback=false)=>{try{const v=localStorage.getItem(key);return v===null?fallback:v==='1'}catch{return fallback}};
  const setBool=(key,value)=>{try{localStorage.setItem(key,value?'1':'0')}catch{}};

  function installStyles(){
    if(document.querySelector('#mgwCreditCollapseStyles'))return;
    const style=document.createElement('style');
    style.id='mgwCreditCollapseStyles';
    style.textContent=`
      #mgwAccountsDashboard .mgw-collapse-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #mgwAccountsDashboard .mgw-collapse-title{display:flex;align-items:center;gap:8px;min-width:0}
      #mgwAccountsDashboard .mgw-collapse-toggle{appearance:none;border:0;background:transparent;padding:6px 4px;display:flex;align-items:center;gap:8px;color:inherit;font:inherit;font-weight:700;cursor:pointer;min-width:0;text-align:left}
      #mgwAccountsDashboard .mgw-collapse-toggle .mgw-chevron{display:inline-block;font-size:1rem;transition:transform .18s ease;transform:rotate(0deg)}
      #mgwAccountsDashboard .mgw-collapse-toggle[aria-expanded="true"] .mgw-chevron{transform:rotate(90deg)}
      #mgwAccountsDashboard .mgw-collapse-body[hidden],#mgwAccountsDashboard .mgw-account-body[hidden]{display:none!important}
      #mgwAccountsDashboard .mgw-account{padding:0;overflow:hidden}
      #mgwAccountsDashboard .mgw-account-summary{width:100%;border:0;background:transparent;color:inherit;padding:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;text-align:left;cursor:pointer;font:inherit}
      #mgwAccountsDashboard .mgw-account-summary>span:first-child{min-width:0}
      #mgwAccountsDashboard .mgw-account-summary b,#mgwAccountsDashboard .mgw-account-summary small{display:block}
      #mgwAccountsDashboard .mgw-account-summary small{opacity:.7;margin-top:2px}
      #mgwAccountsDashboard .mgw-account-summary .mgw-account-total{display:flex;align-items:center;gap:8px;white-space:nowrap}
      #mgwAccountsDashboard .mgw-account-summary .mgw-chevron{display:inline-block;transition:transform .18s ease}
      #mgwAccountsDashboard .mgw-account-summary[aria-expanded="true"] .mgw-chevron{transform:rotate(90deg)}
      #mgwAccountsDashboard .mgw-account-body{padding:0 14px 14px}
      #mgwAccountsDashboard .mgw-collapse-body{padding-top:12px}
    `;
    document.head.appendChild(style);
  }

  function accountId(account,index){
    const label=account.querySelector('.mgw-account-head b')?.textContent?.trim()||`account-${index}`;
    return encodeURIComponent(label.toLowerCase());
  }

  function makeAccountCollapsible(account,index){
    if(account.dataset.mgwCollapsible==='1')return;
    const head=account.querySelector('.mgw-account-head');
    if(!head)return;
    account.dataset.mgwCollapsible='1';
    const key=ACCOUNT_KEY+accountId(account,index);
    const body=document.createElement('div');
    body.className='mgw-account-body';
    while(head.nextSibling)body.appendChild(head.nextSibling);
    const summary=document.createElement('button');
    summary.type='button';
    summary.className='mgw-account-summary';
    const left=head.firstElementChild?.outerHTML||'<span>Account</span>';
    const total=head.lastElementChild?.outerHTML||'';
    const open=getBool(key,false);
    summary.setAttribute('aria-expanded',open?'true':'false');
    summary.innerHTML=`<span>${left}</span><span class="mgw-account-total">${total}<i class="mgw-chevron">›</i></span>`;
    body.hidden=!open;
    summary.addEventListener('click',()=>{
      const next=summary.getAttribute('aria-expanded')!=='true';
      summary.setAttribute('aria-expanded',next?'true':'false');
      body.hidden=!next;
      setBool(key,next);
    });
    head.replaceWith(summary);
    account.appendChild(body);
  }

  function enhance(){
    installStyles();
    const host=document.querySelector('#mgwAccountsDashboard');
    if(!host)return;
    const originalHead=host.querySelector(':scope > .card-head');
    const grid=host.querySelector(':scope > .mgw-account-grid');
    if(!originalHead||!grid)return;

    if(!host.querySelector(':scope > .mgw-collapse-head')){
      const manage=originalHead.querySelector('#mgwManageAccounts');
      const title=originalHead.querySelector('div');
      const wrap=document.createElement('div');
      wrap.className='mgw-collapse-head';
      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='mgw-collapse-toggle';
      const open=getBool(SECTION_KEY,true);
      toggle.setAttribute('aria-expanded',open?'true':'false');
      toggle.innerHTML=`<span class="mgw-collapse-title">${title?.innerHTML||'<b>Cards & Pay-Later</b>'}</span><i class="mgw-chevron">›</i>`;
      const body=document.createElement('div');
      body.className='mgw-collapse-body';
      body.hidden=!open;
      grid.replaceWith(body);
      body.appendChild(grid);
      wrap.appendChild(toggle);
      if(manage)wrap.appendChild(manage);
      originalHead.replaceWith(wrap);
      toggle.addEventListener('click',()=>{
        const next=toggle.getAttribute('aria-expanded')!=='true';
        toggle.setAttribute('aria-expanded',next?'true':'false');
        body.hidden=!next;
        setBool(SECTION_KEY,next);
      });
    }

    host.querySelectorAll('.mgw-account-grid > .mgw-account').forEach(makeAccountCollapsible);
  }

  const wrapRender=()=>{
    if(typeof renderAll!=='function'||renderAll.__mgwCreditCollapseWrapped)return;
    const base=renderAll;
    const wrapped=function(){base();queueMicrotask(enhance)};
    wrapped.__mgwCreditCollapseWrapped=true;
    renderAll=wrapped;
  };

  function boot(){wrapRender();enhance();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();