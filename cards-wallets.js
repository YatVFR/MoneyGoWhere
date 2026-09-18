// MoneyGoWhere DEV — Singapore Cards & Wallets catalogue
// Generic app configuration only. No personal card/account data is bundled here.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.54';
  const TYPES={credit:'Credit Card',debit:'Debit Card',wallet:'Multi-Currency / Travel Wallet',prepaid:'Prepaid / Stored Value',other:'Other'};
  const CATALOG={
    credit:{
      'DBS / POSB':['DBS Chromo Card','POSB Everyday Card','DBS Altitude Visa Signature','DBS Altitude American Express','DBS yuu Visa Card','DBS yuu American Express Card','DBS Woman’s Mastercard','DBS Woman’s World Mastercard','DBS Vantage Visa Infinite','SAFRA DBS Card','DBS Takashimaya Visa Card','DBS Takashimaya American Express Card','Other / Custom Card'],
      'OCBC':['OCBC INFINITY Cashback Card','OCBC 365 Credit Card','OCBC Rewards Card','OCBC 90°N Card','OCBC NXT Credit Card','OCBC FRANK Credit Card','OCBC VOYAGE Card','Other / Custom Card'],
      'UOB':['UOB One Card','UOB EVOL Card','UOB Absolute Cashback American Express Card','KrisFlyer UOB Credit Card','UOB Lady’s Card','UOB Lady’s Solitaire Card','UOB PRVI Miles Visa Card','UOB PRVI Miles World Mastercard','UOB PRVI Miles American Express Card','UOB Visa Signature Card','Lazada-UOB Card','Singtel-UOB Card','UOB Preferred Platinum Visa Card','UOB Visa Infinite Card','UOB Visa Infinite Metal Card','UOB Reserve Card','Other / Custom Card'],
      'Citibank':['Citi PremierMiles Card','Citi Prestige Card','Citi Rewards Card','Citi Cash Back+ Card','Citi Cash Back Card','Citi SMRT Card','Citi M1 Card','Citi Clear Card','Other / Custom Card'],
      'HSBC':['HSBC Premier Mastercard','HSBC Revolution Credit Card','HSBC TravelOne Credit Card','HSBC Live+ Credit Card','HSBC Advance Credit Card','Other / Custom Card'],
      'Standard Chartered':['SC Smart Credit Card','SC Simply Cash Credit Card','SC Rewards+ Credit Card','SC Journey Credit Card','SC Visa Infinite Credit Card','SC Priority Banking Visa Infinite Credit Card','SC Prudential Platinum Credit Card','SC Prudential Visa Signature Card','SC NUS Alumni Platinum Card','Other / Custom Card'],
      'CIMB':['CIMB Founders Card','CIMB Visa Signature','CIMB World Mastercard','CIMB Visa Infinite','CIMB AWSM Card','Other / Custom Card'],
      'Maybank':['Maybank XL Cashback Card','Maybank XL Rewards Card','Maybank Family & Friends Card','Maybank Platinum Visa Card','Maybank Horizon Visa Signature','Maybank World Mastercard','Maybank Visa Infinite','Maybank Manchester United Platinum Visa','Maybank FC Barcelona Visa Signature','Maybank eVibes Card','Other / Custom Card'],
      'American Express':['American Express Platinum Credit Card','American Express Platinum Reserve Credit Card','Singapore Airlines KrisFlyer Credit Card','Singapore Airlines KrisFlyer Ascend Credit Card','Singapore Airlines PPS Club Credit Card','Singapore Airlines Solitaire PPS Credit Card','American Express True Cashback Card','Other / Custom Card'],
      'Trust Bank':['Trust Link Credit Card','Trust Freedom Credit Card','Other / Custom Card'],
      'ICBC Singapore':['ICBC Global Travel Mastercard','ICBC Chinese Zodiac Credit Card','Other / Custom Card'],
      'Other / Custom Bank':['Other / Custom Card']
    },
    debit:{
      'DBS / POSB':['DBS Visa Debit Card','Other / Custom Card'],
      'OCBC':['OCBC Debit Card','FRANK Debit Card','Other / Custom Card'],
      'UOB':['UOB Debit Card','Other / Custom Card'],
      'Trust Bank':['Trust Link Debit Card','Other / Custom Card'],
      'GXS Bank':['GXS Debit Card','Other / Custom Card'],
      'MariBank':['Mari Debit Card','Other / Custom Card'],
      'Other / Custom Bank':['Other / Custom Card']
    },
    wallet:{
      'YouTrip':['YouTrip Physical Card','YouTrip Virtual Card','Other / Custom Card'],
      'Revolut':['Revolut Standard','Revolut Premium','Revolut Metal','Revolut Ultra','Other / Custom Card'],
      'Wise':['Wise Debit Card','Wise Digital Card','Other / Custom Card'],
      'Instarem amaze':['amaze Wallet','amaze Link','Other / Custom Card'],
      'Other / Custom Provider':['Other / Custom Card']
    },
    prepaid:{
      'YouTrip':['YouTrip Physical Card','YouTrip Virtual Card','Other / Custom Card'],
      'Other / Custom Provider':['Other / Custom Card']
    },
    other:{'Other / Custom Provider':['Other / Custom Card']}
  };
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Math.max(0,Number(v)||0);
  const id=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const persist=()=>{window.db=db;localStorage.setItem(MGW.key,JSON.stringify(db))};
  const persistedAccount=id=>{try{const x=JSON.parse(localStorage.getItem(MGW.key)||'{}');return [...(Array.isArray(x.creditAccounts)?x.creditAccounts:[]),...(Array.isArray(x.walletAccounts)?x.walletAccounts:[])].some(a=>a?.id===id)}catch{return false}};
  const opts=(xs,sel='')=>xs.map(x=>`<option value="${esc(x)}" ${x===sel?'selected':''}>${esc(x)}</option>`).join('');
  const typeOptions=sel=>Object.entries(TYPES).map(([k,label])=>`<option value="${k}" ${k===sel?'selected':''}>${esc(label)}</option>`).join('');
  const issuerList=type=>Object.keys(CATALOG[type]||CATALOG.other);
  const products=(type,issuer)=>CATALOG[type]?.[issuer]||['Other / Custom Card'];
  const displayName=a=>a.nickname||a.name||a.cardProduct||'Card / Wallet';
  let refreshQueued=false;

  function ensure(){
    db.creditAccounts=Array.isArray(db.creditAccounts)?db.creditAccounts:[];
    db.creditPayments=Array.isArray(db.creditPayments)?db.creditPayments:[];
    db.walletAccounts=Array.isArray(db.walletAccounts)?db.walletAccounts:[];
  }
  function showModal(title,html){const m=document.querySelector('#modal'),body=document.querySelector('#modalBody');if(!m||!body)return null;document.querySelector('#modalTitle').textContent=title;body.innerHTML=html;m.showModal();return body}
  function refreshAccountsUI(){
    if(refreshQueued)return;
    refreshQueued=true;
    const run=()=>{
      refreshQueued=false;
      let handled=false;
      try{
        if(window.MGWCreditManager?.refresh){window.MGWCreditManager.refresh();handled=true}
        if(window.MGWDashboardCore?.refresh)window.MGWDashboardCore.refresh();
        enhance();
        window.MGWCreditCollapse?.refresh?.();
        document.dispatchEvent(new CustomEvent('mgw:accounts-changed',{detail:{source:'cards-wallets'}}));
      }catch(err){console.error('MoneyGoWhere account refresh failed',err)}
      if(!handled&&typeof renderAll==='function'){try{renderAll()}catch(err){console.error('MoneyGoWhere fallback render failed',err)}}
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0);
  }

  function openAccount(a={},source='credit'){
    ensure();const edit=Boolean(a.id);let type=a.accountType||(source==='wallet'?'wallet':'credit');if(!TYPES[type])type='credit';
    const legacy=source==='credit'&&!a.accountType;
    const knownIssuer=issuerList(type).includes(a.issuer);const issuer=knownIssuer?a.issuer:issuerList(type)[0];
    const knownProduct=products(type,issuer).includes(a.cardProduct);
    const body=showModal(edit?'Edit Card / Wallet':'Add Card / Wallet',`<form id="mgwCardWalletForm" class="form-grid">
      <div class="field"><label>Card type</label><select name="accountType">${typeOptions(type)}</select></div>
      <div class="field"><label>Bank / provider</label><select name="issuer"></select></div>
      <div class="field full"><label>Card product</label><select name="cardProduct"></select></div>
      <div class="field full" id="mgwCustomProductWrap"><label>Custom card / product</label><input name="customProduct" value="${esc(a.customProduct||(!knownProduct&&a.cardProduct?a.cardProduct:''))}" placeholder="Card or wallet product"></div>
      <div class="field full"><label>Nickname</label><input name="nickname" value="${esc(a.nickname||a.name||'')}" placeholder="e.g. Daily card, Travel wallet"></div>
      <div id="mgwCreditOnly" class="field full"><div class="form-grid">
        <div class="field"><label>Card role</label><select name="role"><option value="spending">Main spending</option><option value="debt">Debt payoff</option><option value="emergency">Emergency</option><option value="emergency-debt">Debt payoff + Emergency</option></select></div>
        <div class="field"><label>Credit limit</label><input name="limit" type="number" min="0" step="0.01" value="${a.limit??''}"></div>
        <div class="field"><label>Current outstanding</label><input name="outstanding" type="number" min="0" step="0.01" value="${a.outstanding??''}"></div>
        <div class="field"><label>Latest statement balance</label><input name="statementBalance" type="number" min="0" step="0.01" value="${a.statementBalance??''}"></div>
        <div class="field"><label>Minimum payment</label><input name="minimumPayment" type="number" min="0" step="0.01" value="${a.minimumPayment??''}"></div>
        <div class="field"><label>Planned payment this cycle</label><input name="plannedPayment" type="number" min="0" step="0.01" value="${a.plannedPayment??''}"></div>
        <div class="field"><label>Personal spending budget / cycle</label><input name="spendingBudget" type="number" min="0" step="0.01" value="${a.spendingBudget??''}"></div>
        <div class="field"><label>Statement day</label><input name="statementDay" type="number" min="1" max="31" value="${a.statementDay??''}"></div>
        <div class="field"><label>Payment due day</label><input name="dueDay" type="number" min="1" max="31" value="${a.dueDay??''}"></div>
      </div></div>
      <div id="mgwWalletOnly" class="field full"><div class="form-grid"><div class="field"><label>Current balance (optional)</label><input name="walletBalance" type="number" min="0" step="0.01" value="${a.balance??''}"></div><div class="field"><label>Base currency</label><input name="baseCurrency" maxlength="3" value="${esc(a.baseCurrency||'SGD')}"></div></div><div class="mgw-form-note">Wallet/debit balances are not treated as available credit or debt. Top-ups should be recorded as transfers to avoid double-counting spending.</div></div>
      <div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Card / Wallet'}</button></div>
      ${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteCardWallet">Delete Card / Wallet</button></div>':''}
    </form>`);if(!body)return;
    const f=body.querySelector('form'),typeEl=f.elements.accountType,issuerEl=f.elements.issuer,productEl=f.elements.cardProduct,creditOnly=body.querySelector('#mgwCreditOnly'),walletOnly=body.querySelector('#mgwWalletOnly'),customWrap=body.querySelector('#mgwCustomProductWrap');
    f.elements.role.value=a.role||'spending';
    const setCreditVisibility=()=>{const isCredit=typeEl.value==='credit';creditOnly.style.display=isCredit?'':'none';walletOnly.style.display=isCredit?'none':''};
    const refreshProducts=(preferredProduct='')=>{const ps=products(typeEl.value,issuerEl.value),selected=ps.includes(preferredProduct)?preferredProduct:ps[0];productEl.innerHTML=opts(ps,selected);customWrap.style.display=productEl.value==='Other / Custom Card'?'':'none';setCreditVisibility()};
    const refreshIssuers=(preferredIssuer='',preferredProduct='')=>{const issuers=issuerList(typeEl.value),selected=issuers.includes(preferredIssuer)?preferredIssuer:issuers[0];issuerEl.innerHTML=opts(issuers,selected);refreshProducts(preferredProduct)};
    typeEl.addEventListener('change',()=>refreshIssuers());
    issuerEl.addEventListener('change',()=>refreshProducts());
    productEl.addEventListener('change',()=>{customWrap.style.display=productEl.value==='Other / Custom Card'?'':'none'});
    refreshIssuers(issuer,a.cardProduct||'');
    f.addEventListener('submit',e=>{
      e.preventDefault();if(window.MGWBootState&&!window.MGWBootState.dataReady){toast?.('Finance data is still loading. Try again in a moment.');return}if(f.dataset.mgwSaving==='1')return;
      const fd=new FormData(f),accountType=fd.get('accountType'),issuer=String(fd.get('issuer')||''),selected=String(fd.get('cardProduct')||''),custom=String(fd.get('customProduct')||'').trim(),cardProduct=selected==='Other / Custom Card'?(custom||selected):selected,nickname=String(fd.get('nickname')||'').trim();
      let savedAccount=null;
      if(selected==='Other / Custom Card'&&!custom){toast?.('Enter the custom card or wallet product');return}
      f.dataset.mgwSaving='1';const submit=f.querySelector('button[type="submit"]');if(submit)submit.disabled=true;
      try{
        if(accountType==='credit'){
          const o={id:a.id||id('CARD'),accountType:'credit',issuer,cardProduct,customProduct:custom,nickname,name:nickname||cardProduct,role:String(fd.get('role')||'spending')};savedAccount=o;['limit','outstanding','statementBalance','minimumPayment','plannedPayment','spendingBudget','statementDay','dueDay'].forEach(k=>o[k]=fd.get(k)===''?'':Number(fd.get(k)));if(legacy&&a.startingBalance!==undefined)o.startingBalance=a.startingBalance;
          if(source==='wallet'&&edit)db.walletAccounts=db.walletAccounts.filter(x=>x.id!==a.id);if(!edit||source==='wallet')db.creditAccounts.push(o);else Object.assign(a,o);
        }else{
          const o={id:a.id||id('WALLET'),accountType,issuer,cardProduct,customProduct:custom,nickname,name:nickname||cardProduct,balance:fd.get('walletBalance')===''?'':num(fd.get('walletBalance')),baseCurrency:String(fd.get('baseCurrency')||'SGD').trim().toUpperCase().slice(0,3)};savedAccount=o;
          if(source==='credit'&&edit){db.creditAccounts=db.creditAccounts.filter(x=>x.id!==a.id);db.creditPayments=(db.creditPayments||[]).filter(x=>x.accountId!==a.id)}if(!edit||source==='credit')db.walletAccounts.push(o);else Object.assign(a,o);
        }
        persist();if(!savedAccount||!persistedAccount(savedAccount.id))throw new Error('Saved account was not found in local database');document.querySelector('#modal').close();toast?.(edit?'Card / wallet updated':'Card / wallet added · saved locally');refreshAccountsUI();setTimeout(()=>{enhance();window.MGWWalletVisibility?.refresh?.()},80);
      }catch(err){console.error('MoneyGoWhere card save failed',err);f.dataset.mgwSaving='0';if(submit)submit.disabled=false;toast?.('Could not save card / wallet')}
    });
    body.querySelector('#mgwDeleteCardWallet')?.addEventListener('click',()=>{if(!confirm('Delete this card / wallet tracker? Existing expense transactions will not be deleted.'))return;try{if(source==='credit'){db.creditAccounts=db.creditAccounts.filter(x=>x.id!==a.id);db.creditPayments=(db.creditPayments||[]).filter(x=>x.accountId!==a.id)}else db.walletAccounts=db.walletAccounts.filter(x=>x.id!==a.id);persist();document.querySelector('#modal').close();toast?.('Card / wallet tracker deleted');refreshAccountsUI()}catch(err){console.error('MoneyGoWhere card delete failed',err);toast?.('Could not delete card / wallet')}});
  }

  function walletCard(a){return `<div class="mgw-account"><div class="mgw-account-head"><div><b>💼 ${esc(displayName(a))}</b><small>${esc(a.issuer||'')} · ${esc(a.cardProduct||'')}</small></div><strong>${a.balance===''||a.balance==null?'—':money(num(a.balance))}</strong></div><div class="mgw-mini"><div><small>Type</small><strong>${esc(TYPES[a.accountType]||'Wallet')}</strong></div><div><small>Base currency</small><strong>${esc(a.baseCurrency||'SGD')}</strong></div></div><div class="mgw-account-actions"><button data-wallet-edit="${a.id}">Edit</button></div></div>`}
  function syncWalletBlock(host,id,title,extra=''){let block=document.getElementById(id);if(!host||!db.walletAccounts.length){block?.remove();return}if(!block){block=document.createElement('div');block.id=id;host.appendChild(block)}block.innerHTML=`<p class="mgw-muted"><b>${title}</b>${extra}</p>${db.walletAccounts.map(walletCard).join('')}`}
  function enhance(){ensure();const add=document.querySelector('#mgwAddCard');if(add)add.textContent='＋ Card / Wallet';document.querySelectorAll('[data-card-edit]').forEach(b=>{b.textContent='Edit / Reconcile'});
    syncWalletBlock(document.querySelector('#mgwCreditSettings .mgw-account-grid'),'mgwWalletAccountsBlock','Debit Cards & Wallets',' · excluded from credit debt/utilisation');
    syncWalletBlock(document.querySelector('#mgwAccountsDashboard .mgw-account-grid'),'mgwWalletDashboardBlock','Wallets & Debit');
  }
  document.addEventListener('click',e=>{const we=e.target.closest?.('[data-wallet-edit]');if(we){const a=(db.walletAccounts||[]).find(x=>x.id===we.dataset.walletEdit);if(a){e.preventDefault();e.stopImmediatePropagation();openAccount(a,'wallet')}}},true);
  function boot(){ensure();if(typeof renderAll==='function'&&!renderAll.__mgwCardsWallets){const base=renderAll;renderAll=function(){base();queueMicrotask(enhance)};renderAll.__mgwCardsWallets=true}queueMicrotask(enhance);window.MGWCardsWallets={version:RELEASE,types:{...TYPES},catalog:CATALOG,open:openAccount,enhance,refresh:refreshAccountsUI}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();