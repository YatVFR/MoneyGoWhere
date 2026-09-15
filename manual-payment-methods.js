// MoneyGoWhere DEV — structured payment method/source picker for manual expenses.
// Generic payment providers/banks only; user account choices remain local in the MGW database.
(()=>{'use strict';
const RELEASE='1.5.5-dev.46';
const BANKS=['DBS / POSB','OCBC','UOB','Standard Chartered','Citibank','HSBC','Maybank','CIMB','Trust Bank','GXS Bank','MariBank','Other bank'];
const CARD_PROVIDERS=['DBS / POSB','OCBC','UOB','Standard Chartered','Citibank','HSBC','Maybank','CIMB','American Express','Trust Bank','ICBC Singapore','Other card'];
const APPS=['GrabPay','ShopeePay','Touch ’n Go eWallet','Singtel Dash','DBS PayLah!','YouTrip','Revolut','Wise','Alipay+','WeChat Pay','Other app / wallet'];
const METHODS=[['cash','Cash'],['card','Card'],['apple_pay','Apple Pay'],['paynow','PayNow'],['ewallet','E-Wallet / App'],['bank_transfer','Bank Transfer'],['nets','NETS'],['voucher','Voucher / Gift Card'],['other','Other']];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ensure(){db.creditAccounts=Array.isArray(db.creditAccounts)?db.creditAccounts:[];db.walletAccounts=Array.isArray(db.walletAccounts)?db.walletAccounts:[];db.bankAccounts=Array.isArray(db.bankAccounts)?db.bankAccounts:[];db.settings=db.settings||{};db.settings.paymentMethods=db.settings.paymentMethods||{}}
function accounts(){ensure();return [...db.creditAccounts.map(a=>({...a,_kind:'credit'})),...db.walletAccounts.map(a=>({...a,_kind:'wallet'}))]}
function accountLabel(a){return [a.nickname||a.name||a.cardProduct,a.issuer].filter(Boolean).join(' · ')||'Card / Wallet'}
function bankLabel(a){return [a.nickname||a.name,a.bank].filter(Boolean).join(' · ')||a.bank||'Bank account'}
function orderedMethods(){ensure();const enabled=Array.isArray(db.settings.paymentMethods.enabled)?db.settings.paymentMethods.enabled:[];return enabled.length?[...METHODS.filter(x=>enabled.includes(x[0])),...METHODS.filter(x=>!enabled.includes(x[0]))]:METHODS}
function methodOptions(){return orderedMethods().map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
function option(value,label){return `<option value="${esc(value)}">${esc(label)}</option>`}
function group(label,items){return items?`<optgroup label="${esc(label)}">${items}</optgroup>`:''}
function configuredCardOptions(){return accounts().map(a=>option(`acct:${a.id}`,accountLabel(a))).join('')}
function configuredWalletOptions(){return accounts().filter(a=>a._kind==='wallet'||['wallet','prepaid','debit','other'].includes(a.accountType)).map(a=>option(`acct:${a.id}`,accountLabel(a))).join('')}
function configuredBankOptions(){return db.bankAccounts.map(a=>option(`bankacct:${a.id}`,bankLabel(a))).join('')}
function sourceOptions(method){
  if(method==='card'){
    return option('','Select card')+
      group('My Cards & Wallets',configuredCardOptions())+
      group('Card issuer',CARD_PROVIDERS.map(x=>option(`cardprovider:${x}`,x==='Other card'?'Other / Custom Card':`${x} Card`)).join(''));
  }
  if(method==='apple_pay'){
    return option('','Select Apple Pay source')+
      group('My Cards & Wallets',configuredCardOptions())+
      group('Card issuer',CARD_PROVIDERS.filter(x=>x!=='Other card').map(x=>option(`applecard:${x}`,`${x} via Apple Pay`)).join(''))+
      group('Wallet / App',APPS.filter(x=>x!=='Other app / wallet').map(x=>option(`appleapp:${x}`,`${x} via Apple Pay`)).join(''))+
      group('Other',option('custom:','Other / Custom Apple Pay source'));
  }
  if(method==='paynow'||method==='bank_transfer'||method==='nets'){
    return option('',method==='paynow'?'Select PayNow bank':'Select bank')+
      group('My Bank Accounts',configuredBankOptions())+
      group('Bank',BANKS.map(x=>option(`bank:${x}`,x)).join(''));
  }
  if(method==='ewallet'){
    return option('','Select app / wallet')+
      group('My Wallets',configuredWalletOptions())+
      group('Wallet / App',APPS.map(x=>option(`app:${x}`,x)).join(''));
  }
  if(method==='voucher')return option('','Select voucher source')+option('custom:','Enter voucher / gift card');
  if(method==='other')return option('custom:','Enter payment source');
  return '';
}
function methodLabel(method){return METHODS.find(x=>x[0]===method)?.[1]||'Other'}
function enhance(){
  const form=document.querySelector('#expenseForm');if(!form||form.dataset.mgwPaymentMethods==='1'||document.querySelector('#receiptFile'))return;form.dataset.mgwPaymentMethods='1';ensure();const notes=form.elements.notes?.closest('.field');if(!notes)return;
  const methodField=document.createElement('div');methodField.className='field';methodField.innerHTML=`<label for="mgwPaymentMethodSelect">Payment Method</label><select id="mgwPaymentMethodSelect">${methodOptions()}</select>`;
  const sourceField=document.createElement('div');sourceField.className='field';sourceField.innerHTML='<label for="mgwPaymentSourceSelect">Payment Source</label><select id="mgwPaymentSourceSelect"></select>';
  const customField=document.createElement('div');customField.className='field full';customField.hidden=true;customField.innerHTML='<label for="mgwPaymentCustomInput">Payment Source Details</label><input id="mgwPaymentCustomInput" placeholder="Enter the card, bank, wallet or payment source">';
  const note=document.createElement('div');note.className='field full';note.innerHTML='<small class="mgw-form-note">Choose from your configured accounts or a known bank/card/wallet. Manual typing is only needed for an Other / Custom source.</small>';
  form.insertBefore(methodField,notes);form.insertBefore(sourceField,notes);form.insertBefore(customField,notes);form.insertBefore(note,notes);
  for(const name of ['paymentMethod','paymentSource','paymentAccountId','paymentBankAccountId','paymentSourceType']){const h=document.createElement('input');h.type='hidden';h.name=name;form.appendChild(h)}
  const method=methodField.querySelector('select'),source=sourceField.querySelector('select'),custom=customField.querySelector('input');
  const sync=()=>{const m=method.value,choice=source.value||'',customValue=custom.value.trim();let label='',accountId='',bankAccountId='',sourceType='';
    if(choice.startsWith('acct:')){accountId=choice.slice(5);const a=accounts().find(x=>x.id===accountId);label=a?accountLabel(a):'';sourceType=a?._kind==='credit'?'card':'wallet'}
    else if(choice.startsWith('bankacct:')){bankAccountId=choice.slice(9);const a=db.bankAccounts.find(x=>x.id===bankAccountId);label=a?bankLabel(a):'';sourceType='bank'}
    else if(choice.startsWith('bank:')){label=choice.slice(5);sourceType='bank'}
    else if(choice.startsWith('cardprovider:')){label=`${choice.slice(13)} Card`;sourceType='card'}
    else if(choice.startsWith('applecard:')){label=`${choice.slice(10)} via Apple Pay`;sourceType='card'}
    else if(choice.startsWith('appleapp:')){label=`${choice.slice(9)} via Apple Pay`;sourceType='wallet'}
    else if(choice.startsWith('app:')){label=choice.slice(4);sourceType='wallet'}
    else if(choice.startsWith('custom:')){label=customValue;sourceType=(m==='card'||m==='apple_pay')?'card':m==='ewallet'?'wallet':m==='voucher'?'voucher':'other'}
    if(m==='cash'){label='Cash';sourceType='cash'}
    form.elements.paymentMethod.value=methodLabel(m);form.elements.paymentSource.value=label;form.elements.paymentAccountId.value=accountId;form.elements.paymentBankAccountId.value=bankAccountId;form.elements.paymentSourceType.value=sourceType||m};
  const refresh=()=>{const m=method.value;source.innerHTML=sourceOptions(m);sourceField.hidden=m==='cash';customField.hidden=true;if(m==='cash'){sync();return}const updateCustom=()=>{const customChoice=source.value.startsWith('custom:')||source.value==='cardprovider:Other card'||source.value==='app:Other app / wallet'||source.value==='bank:Other bank';customField.hidden=!customChoice;sync()};source.onchange=updateCustom;updateCustom()};
  const preferred=db.settings.paymentMethods.default;if(preferred&&[...method.options].some(o=>o.value===preferred))method.value=preferred;
  method.addEventListener('change',refresh);custom.addEventListener('input',sync);form.addEventListener('submit',sync,true);refresh();
}
function boot(){enhance();let queued=false;const host=document.querySelector('#modal')||document.body;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance()})}).observe(host,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.MGWManualPaymentMethods={version:RELEASE};})();
