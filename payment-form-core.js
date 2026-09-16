// MoneyGoWhere DEV — static manual-expense payment picker.
// Loaded directly by index.html so the payment choices exist before optional feature modules run.
(()=>{'use strict';
const RELEASE='1.5.5-dev.49';
const METHODS=[
  {code:'cash',label:'Cash'},
  {code:'card',label:'Card'},
  {code:'apple_pay',label:'Apple Pay'},
  {code:'paynow',label:'PayNow'},
  {code:'ewallet',label:'E-Wallet / App'},
  {code:'bank_transfer',label:'Bank Transfer'},
  {code:'nets',label:'NETS'},
  {code:'voucher',label:'Voucher / Gift Card'},
  {code:'other',label:'Other'}
];
const BANKS=['DBS / POSB','OCBC','UOB','Standard Chartered','Citibank','HSBC','Maybank','CIMB','Trust Bank','GXS Bank','MariBank'];
const CARD_PROVIDERS=['DBS / POSB','OCBC','UOB','Standard Chartered','Citibank','HSBC','Maybank','CIMB','American Express','Trust Bank','ICBC Singapore'];
const APPS=['GrabPay','ShopeePay','Touch ’n Go eWallet','Singtel Dash','DBS PayLah!','YouTrip','Revolut','Wise','Alipay+','WeChat Pay'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const methodByCode=code=>METHODS.find(x=>x.code===code)||METHODS[0];
const normalizeMethod=v=>{
  const raw=String(v||'').trim();
  const byCode=METHODS.find(x=>x.code===raw);
  if(byCode)return byCode.code;
  const byLabel=METHODS.find(x=>x.label.toLowerCase()===raw.toLowerCase());
  return byLabel?.code||'cash';
};
function ensure(){
  db.settings=db.settings||{};
  db.settings.paymentMethods=db.settings.paymentMethods||{};
  db.creditAccounts=Array.isArray(db.creditAccounts)?db.creditAccounts:[];
  db.walletAccounts=Array.isArray(db.walletAccounts)?db.walletAccounts:[];
  db.bankAccounts=Array.isArray(db.bankAccounts)?db.bankAccounts:[];
}
function allAccounts(){ensure();return [
  ...db.creditAccounts.map(a=>({...a,_kind:'credit'})),
  ...db.walletAccounts.map(a=>({...a,_kind:'wallet'}))
]}
function accountLabel(a){return [a.nickname||a.name||a.cardProduct,a.issuer].filter(Boolean).join(' · ')||'Card / Wallet'}
function bankLabel(a){return [a.nickname||a.name,a.bank].filter(Boolean).join(' · ')||a.bank||'Bank account'}
function option(value,label,selected=false){return `<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`}
function group(label,items){return items?`<optgroup label="${esc(label)}">${items}</optgroup>`:''}
function orderedMethods(){
  ensure();
  const enabled=Array.isArray(db.settings.paymentMethods.enabled)?db.settings.paymentMethods.enabled:[];
  if(!enabled.length)return METHODS;
  return [...METHODS.filter(x=>enabled.includes(x.code)),...METHODS.filter(x=>!enabled.includes(x.code))];
}
function methodOptions(selected){return orderedMethods().map(x=>option(x.code,x.label,x.code===selected)).join('')}
function configuredCardOptions(){return allAccounts().map(a=>option(`acct:${a.id}`,accountLabel(a))).join('')}
function configuredWalletOptions(){return allAccounts().filter(a=>a._kind==='wallet'||['wallet','prepaid','debit','other'].includes(a.accountType)).map(a=>option(`acct:${a.id}`,accountLabel(a))).join('')}
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
function paymentFields(d={}){
  ensure();
  const selected=normalizeMethod(d.paymentMethod||db.settings.paymentMethods.default||'cash');
  const source=String(d.paymentSource||d.card||'');
  return `<div class="field" data-mgw-payment-core-field><label for="mgwPaymentMethodSelect">Payment Method</label><select id="mgwPaymentMethodSelect" name="paymentMethodPicker">${methodOptions(selected)}</select></div>
  <div class="field" id="mgwPaymentSourceField" data-mgw-payment-core-field><label for="mgwPaymentSourceSelect">Payment Source</label><select id="mgwPaymentSourceSelect" name="paymentSourcePicker"></select></div>
  <div class="field full" id="mgwPaymentCustomField" data-mgw-payment-core-field hidden><label for="mgwPaymentCustomInput">Payment Source Details</label><input id="mgwPaymentCustomInput" name="paymentSourceCustom" placeholder="Enter the card, bank, wallet or payment source"></div>
  <input type="hidden" name="paymentMethod" value="${esc(methodByCode(selected).label)}"><input type="hidden" name="paymentSource" value="${esc(source)}"><input type="hidden" name="card" value="${esc(source)}"><input type="hidden" name="paymentAccountId"><input type="hidden" name="paymentBankAccountId"><input type="hidden" name="paymentSourceType">
  <div class="field full" data-mgw-payment-core-field><small class="mgw-form-note">Choose a payment method, then select your configured account or a known bank/card/wallet. Manual typing is only needed for Other / Custom.</small></div>`;
}
function stripLegacyPaymentFields(html){
  return String(html)
    .replace(/<div class="field(?: full)?">\s*<label>Payment Method<\/label>\s*<input[^>]*name="paymentMethod"[^>]*>\s*<\/div>/gi,'')
    .replace(/<div class="field(?: full)?">\s*<label>(?:Card \/ Payment Source|Payment Source)<\/label>\s*<input[^>]*(?:name="card"|name="paymentSource")[^>]*>\s*<\/div>/gi,'');
}
function injectFields(html,d={}){
  html=stripLegacyPaymentFields(html);
  if(html.includes('mgwPaymentMethodSelect'))return html;
  const marker='<div class="field full"><label>Spending Type</label>';
  return html.includes(marker)?html.replace(marker,paymentFields(d)+marker):html.replace('</form>',paymentFields(d)+'</form>');
}
function patchExpenseForm(){
  if(typeof expenseForm!=='function'||expenseForm.__mgwPaymentCore)return;
  const base=expenseForm;
  const patched=function(type,d={}){const html=base(type,d);return type==='expense'?injectFields(html,d):html};
  patched.__mgwPaymentCore=true;patched.__mgwBase=base;expenseForm=patched;window.expenseForm=patched;
}
function removeLegacyDomFields(form){
  [...form.querySelectorAll('input[name="paymentMethod"],input[name="card"],input[name="paymentSource"]')].forEach(input=>{
    if(input.type==='hidden')return;
    const field=input.closest('.field');if(field)field.remove();else input.remove();
  });
}
function ensureDomFields(form){
  if(!form||document.querySelector('#receiptFile'))return;
  removeLegacyDomFields(form);
  if(form.querySelector('#mgwPaymentMethodSelect'))return;
  const spending=[...form.querySelectorAll('.field')].find(x=>x.querySelector('select[name="category"]'));
  const t=document.createElement('template');t.innerHTML=paymentFields({});
  const nodes=[...t.content.childNodes];
  if(spending)nodes.forEach(n=>form.insertBefore(n,spending));else nodes.forEach(n=>form.appendChild(n));
}
function decodeSource(choice){
  let label='',accountId='',bankAccountId='',sourceType='';
  if(choice.startsWith('acct:')){accountId=choice.slice(5);const a=allAccounts().find(x=>String(x.id)===accountId);label=a?accountLabel(a):'';sourceType=a?._kind==='credit'?'card':'wallet'}
  else if(choice.startsWith('bankacct:')){bankAccountId=choice.slice(9);const a=db.bankAccounts.find(x=>String(x.id)===bankAccountId);label=a?bankLabel(a):'';sourceType='bank'}
  else if(choice.startsWith('bank:')){label=choice.slice(5);sourceType='bank'}
  else if(choice.startsWith('cardprovider:')){label=`${choice.slice(13)} Card`;sourceType='card'}
  else if(choice.startsWith('applecard:')){label=`${choice.slice(10)} via Apple Pay`;sourceType='card'}
  else if(choice.startsWith('appleapp:')){label=`${choice.slice(9)} via Apple Pay`;sourceType='wallet'}
  else if(choice.startsWith('app:')){label=choice.slice(4);sourceType='wallet'}
  return {label,accountId,bankAccountId,sourceType};
}
function bindPaymentForm(form){
  if(!form)return false;ensureDomFields(form);
  const method=form.querySelector('#mgwPaymentMethodSelect'),source=form.querySelector('#mgwPaymentSourceSelect'),sourceField=form.querySelector('#mgwPaymentSourceField'),customField=form.querySelector('#mgwPaymentCustomField'),custom=form.querySelector('#mgwPaymentCustomInput');
  if(!method||!source)return false;
  const hidden=name=>form.querySelector(`input[type="hidden"][name="${name}"]`);
  const oldSource=hidden('paymentSource')?.value||hidden('card')?.value||'';
  const sync=()=>{
    const code=method.value,label=methodByCode(code).label,choice=source.value||'';
    let {label:sourceLabel,accountId,bankAccountId,sourceType}=decodeSource(choice);
    if(choice.startsWith('custom:')){sourceLabel=(custom?.value||'').trim();sourceType=choice.slice(7)||'other'}
    if(code==='cash'){sourceLabel='Cash';sourceType='cash';accountId='';bankAccountId=''}
    if(hidden('paymentMethod'))hidden('paymentMethod').value=label;
    if(hidden('paymentSource'))hidden('paymentSource').value=sourceLabel;
    if(hidden('card'))hidden('card').value=sourceLabel;
    if(hidden('paymentAccountId'))hidden('paymentAccountId').value=accountId;
    if(hidden('paymentBankAccountId'))hidden('paymentBankAccountId').value=bankAccountId;
    if(hidden('paymentSourceType'))hidden('paymentSourceType').value=sourceType||code;
  };
  const tryPrefillSource=()=>{
    if(!oldSource)return;
    const opt=[...source.options].find(o=>o.textContent.trim()===oldSource||o.textContent.trim().replace(/ Card$/,'')===oldSource);
    if(opt)source.value=opt.value;
  };
  const refresh=()=>{
    const code=method.value;source.innerHTML=sourceOptions(code);sourceField.hidden=code==='cash';customField.hidden=true;tryPrefillSource();
    const update=()=>{customField.hidden=!source.value.startsWith('custom:');sync()};
    source.onchange=update;update();
  };
  if(form.dataset.mgwPaymentCoreBound!=='1'){
    form.dataset.mgwPaymentCoreBound='1';
    method.addEventListener('change',refresh);
    custom?.addEventListener('input',sync);
    form.addEventListener('submit',sync,true);
  }
  refresh();return true;
}
function normalizeOpenManualForm(){
  const form=document.querySelector('#expenseForm');
  if(!form||document.querySelector('#receiptFile'))return false;
  ensureDomFields(form);return bindPaymentForm(form);
}
function patchOpenModal(){
  if(typeof openModal!=='function'||openModal.__mgwPaymentCore)return;
  const base=openModal;
  const patched=function(type,data={}){const r=base(type,data);if(type==='expense')queueMicrotask(normalizeOpenManualForm);return r};
  patched.__mgwPaymentCore=true;patched.__mgwBase=base;openModal=patched;window.openModal=patched;
}
function patchBindModal(){
  if(typeof bindModal!=='function'||bindModal.__mgwPaymentCore)return;
  const base=bindModal;
  const patched=function(type){const r=base(type);if(type==='expense')queueMicrotask(normalizeOpenManualForm);return r};
  patched.__mgwPaymentCore=true;patched.__mgwBase=base;bindModal=patched;window.bindModal=patched;
}
function install(){ensure();patchExpenseForm();patchOpenModal();patchBindModal();normalizeOpenManualForm()}
install();
document.addEventListener('click',e=>{if(e.target.closest?.('[data-open="expense"]'))setTimeout(normalizeOpenManualForm,0)});
const modalBody=document.querySelector('#modalBody');if(modalBody)new MutationObserver(()=>queueMicrotask(normalizeOpenManualForm)).observe(modalBody,{childList:true,subtree:false});
const selfTest=()=>{try{const html=expenseForm('expense',{});return html.includes('mgwPaymentMethodSelect')&&html.includes('mgwPaymentSourceSelect')}catch{return false}};
window.MGWPaymentFormCore={version:RELEASE,install,refresh:normalizeOpenManualForm,selfTest};
window.MGWManualPaymentMethods={version:RELEASE,coreIntegrated:true,refresh:normalizeOpenManualForm};
})();
