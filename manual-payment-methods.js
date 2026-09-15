// MoneyGoWhere DEV — authoritative manual expense payment picker.
// Payment choices are rendered synchronously with the Manual Expense form so they cannot be missed by modal timing.
(()=>{'use strict';
if(window.MGWManualPaymentMethods?.coreIntegrated)return;
const RELEASE='1.5.5-dev.48';
const BANKS=['DBS / POSB','OCBC','UOB','Standard Chartered','Citibank','HSBC','Maybank','CIMB','Trust Bank','GXS Bank','MariBank'];
const CARD_PROVIDERS=['DBS / POSB','OCBC','UOB','Standard Chartered','Citibank','HSBC','Maybank','CIMB','American Express','Trust Bank','ICBC Singapore'];
const APPS=['GrabPay','ShopeePay','Touch ’n Go eWallet','Singtel Dash','DBS PayLah!','YouTrip','Revolut','Wise','Alipay+','WeChat Pay'];
const METHODS=[['cash','Cash'],['card','Card'],['apple_pay','Apple Pay'],['paynow','PayNow'],['ewallet','E-Wallet / App'],['bank_transfer','Bank Transfer'],['nets','NETS'],['voucher','Voucher / Gift Card'],['other','Other']];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ensure(){db.creditAccounts=Array.isArray(db.creditAccounts)?db.creditAccounts:[];db.walletAccounts=Array.isArray(db.walletAccounts)?db.walletAccounts:[];db.bankAccounts=Array.isArray(db.bankAccounts)?db.bankAccounts:[];db.settings=db.settings||{};db.settings.paymentMethods=db.settings.paymentMethods||{}}
function accounts(){ensure();return [...db.creditAccounts.map(a=>({...a,_kind:'credit'})),...db.walletAccounts.map(a=>({...a,_kind:'wallet'}))]}
function accountLabel(a){return [a.nickname||a.name||a.cardProduct,a.issuer].filter(Boolean).join(' · ')||'Card / Wallet'}
function bankLabel(a){return [a.nickname||a.name,a.bank].filter(Boolean).join(' · ')||a.bank||'Bank account'}
function orderedMethods(){ensure();const enabled=Array.isArray(db.settings.paymentMethods.enabled)?db.settings.paymentMethods.enabled:[];return enabled.length?[...METHODS.filter(x=>enabled.includes(x[0])),...METHODS.filter(x=>!enabled.includes(x[0]))]:METHODS}
function option(value,label,selected=false){return `<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`}
function group(label,items){return items?`<optgroup label="${esc(label)}">${items}</optgroup>`:''}
function methodOptions(){const preferred=db.settings?.paymentMethods?.default||'cash';return orderedMethods().map(([v,l])=>option(v,l,v===preferred)).join('')}
function configuredCardOptions(){return accounts().map(a=>option(`acct:${a.id}`,accountLabel(a))).join('')}
function configuredWalletOptions(){return accounts().filter(a=>a._kind==='wallet'||['wallet','prepaid','debit','other'].includes(a.accountType)).map(a=>option(`acct:${a.id}`,accountLabel(a))).join('')}
function configuredBankOptions(){return db.bankAccounts.map(a=>option(`bankacct:${a.id}`,bankLabel(a))).join('')}
function sourceOptions(method){
  ensure();
  if(method==='card')return option('','Select card')+group('My Cards & Wallets',configuredCardOptions())+group('Card issuer',CARD_PROVIDERS.map(x=>option(`cardprovider:${x}`,`${x} Card`)).join(''))+group('Other',option('custom:card','Other / Custom Card'));
  if(method==='apple_pay')return option('','Select Apple Pay source')+group('My Cards & Wallets',configuredCardOptions())+group('Card issuer',CARD_PROVIDERS.map(x=>option(`applecard:${x}`,`${x} via Apple Pay`)).join(''))+group('Wallet / App',APPS.map(x=>option(`appleapp:${x}`,`${x} via Apple Pay`)).join(''))+group('Other',option('custom:card','Other / Custom Apple Pay source'));
  if(method==='paynow'||method==='bank_transfer'||method==='nets')return option('',method==='paynow'?'Select PayNow bank':'Select bank')+group('My Bank Accounts',configuredBankOptions())+group('Bank',BANKS.map(x=>option(`bank:${x}`,x)).join(''))+group('Other',option('custom:bank','Other / Custom Bank'));
  if(method==='ewallet')return option('','Select app / wallet')+group('My Wallets',configuredWalletOptions())+group('Wallet / App',APPS.map(x=>option(`app:${x}`,x)).join(''))+group('Other',option('custom:wallet','Other / Custom App or Wallet'));
  if(method==='voucher')return option('','Select voucher source')+option('custom:voucher','Other / Custom Voucher');
  if(method==='other')return option('custom:other','Other / Custom Payment Source');
  return '';
}
function paymentFields(){return `<div class="field"><label>Payment Method</label><select id="mgwPaymentMethodSelect" name="paymentMethod">${methodOptions()}</select></div><div class="field" id="mgwPaymentSourceField"><label>Payment Source</label><select id="mgwPaymentSourceSelect" name="paymentSourcePicker"></select></div><div class="field full" id="mgwPaymentCustomField" hidden><label>Payment Source Details</label><input id="mgwPaymentCustomInput" name="paymentSourceCustom" placeholder="Enter the card, bank, wallet or payment source"></div><input type="hidden" name="paymentSource"><input type="hidden" name="paymentAccountId"><input type="hidden" name="paymentBankAccountId"><input type="hidden" name="paymentSourceType"><div class="field full"><small class="mgw-form-note">Choose your configured account or a known bank/card/wallet. Manual typing is only used for Other / Custom.</small></div>`}
function stripLegacyManualPaymentFields(html){
  return html
    .replace(/<div class="field"><label>Payment Method<\/label><input name="paymentMethod"[^>]*><\/div>/g,'')
    .replace(/<div class="field"><label>Card \/ Payment Source<\/label><input name="card"[^>]*><\/div>/g,'');
}
function patchExpenseForm(){
  if(typeof expenseForm!=='function'||expenseForm.__mgwPaymentPatched)return;
  const base=expenseForm;
  const patched=function(type,d={}){
    let html=base(type,d);
    if(type!=='expense'||html.includes('mgwPaymentMethodSelect'))return html;
    html=stripLegacyManualPaymentFields(html);
    const marker='<div class="field full"><label>Spending Type</label>';
    return html.includes(marker)?html.replace(marker,paymentFields()+marker):html.replace('</form>',paymentFields()+'</form>');
  };
  patched.__mgwPaymentPatched=true;patched.__mgwBase=base;expenseForm=patched;window.expenseForm=patched;
}
function bindPaymentForm(){
  const form=document.querySelector('#expenseForm'),method=document.querySelector('#mgwPaymentMethodSelect'),source=document.querySelector('#mgwPaymentSourceSelect'),sourceField=document.querySelector('#mgwPaymentSourceField'),customField=document.querySelector('#mgwPaymentCustomField'),custom=document.querySelector('#mgwPaymentCustomInput');
  if(!form||!method||!source||form.dataset.mgwPaymentBound==='1')return;form.dataset.mgwPaymentBound='1';ensure();
  const sync=()=>{const m=method.value,choice=source.value||'',customValue=custom?.value.trim()||'';let label='',accountId='',bankAccountId='',sourceType='';
    if(choice.startsWith('acct:')){accountId=choice.slice(5);const a=accounts().find(x=>String(x.id)===accountId);label=a?accountLabel(a):'';sourceType=a?._kind==='credit'?'card':'wallet'}
    else if(choice.startsWith('bankacct:')){bankAccountId=choice.slice(9);const a=db.bankAccounts.find(x=>String(x.id)===bankAccountId);label=a?bankLabel(a):'';sourceType='bank'}
    else if(choice.startsWith('bank:')){label=choice.slice(5);sourceType='bank'}
    else if(choice.startsWith('cardprovider:')){label=`${choice.slice(13)} Card`;sourceType='card'}
    else if(choice.startsWith('applecard:')){label=`${choice.slice(10)} via Apple Pay`;sourceType='card'}
    else if(choice.startsWith('appleapp:')){label=`${choice.slice(9)} via Apple Pay`;sourceType='wallet'}
    else if(choice.startsWith('app:')){label=choice.slice(4);sourceType='wallet'}
    else if(choice.startsWith('custom:')){label=customValue;sourceType=choice.slice(7)||'other'}
    if(m==='cash'){label='Cash';sourceType='cash'}
    form.elements.paymentSource.value=label;form.elements.paymentAccountId.value=accountId;form.elements.paymentBankAccountId.value=bankAccountId;form.elements.paymentSourceType.value=sourceType||m;
  };
  const refresh=()=>{const m=method.value;source.innerHTML=sourceOptions(m);sourceField.hidden=m==='cash';customField.hidden=true;if(m==='cash'){sync();return}const update=()=>{customField.hidden=!source.value.startsWith('custom:');sync()};source.onchange=update;update()};
  method.addEventListener('change',refresh);custom?.addEventListener('input',sync);form.addEventListener('submit',sync,true);refresh();
}
function patchBindModal(){
  if(typeof bindModal!=='function'||bindModal.__mgwPaymentPatched)return;
  const base=bindModal;
  const patched=function(type){const result=base(type);if(type==='expense')bindPaymentForm();return result};
  patched.__mgwPaymentPatched=true;patched.__mgwBase=base;bindModal=patched;window.bindModal=patched;
}
function install(){ensure();patchExpenseForm();patchBindModal();if(document.querySelector('#modal')?.open&&document.querySelector('#modalTitle')?.textContent==='Add Expense')bindPaymentForm()}
install();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
window.MGWManualPaymentMethods={version:RELEASE,coreIntegrated:true,refresh:install};
})();
