// MoneyGoWhere DEV — structured payment method/source picker for manual expenses.
// Generic payment providers/banks only; user account choices remain local in the MGW database.
(()=>{'use strict';
const RELEASE='1.5.5-dev.44';
const BANKS=['DBS / POSB','OCBC','UOB','Standard Chartered','Citibank','HSBC','Maybank','CIMB','Trust Bank','GXS Bank','MariBank','Other bank'];
const APPS=['GrabPay','ShopeePay','Touch ’n Go eWallet','Singtel Dash','YouTrip','Revolut','Wise','Alipay+','WeChat Pay','Other app / wallet'];
const METHODS=[
 ['cash','Cash'],['card','Card'],['paynow','PayNow'],['ewallet','E-Wallet / App'],['bank_transfer','Bank Transfer'],['nets','NETS'],['voucher','Voucher / Gift Card'],['other','Other']
];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function ensure(){db.creditAccounts=Array.isArray(db.creditAccounts)?db.creditAccounts:[];db.walletAccounts=Array.isArray(db.walletAccounts)?db.walletAccounts:[]}
function accounts(){ensure();return [...db.creditAccounts.map(a=>({...a,_kind:'credit'})),...db.walletAccounts.map(a=>({...a,_kind:'wallet'}))]}
function accountLabel(a){return [a.nickname||a.name||a.cardProduct,a.issuer].filter(Boolean).join(' · ')||'Card / Wallet'}
function methodOptions(){return METHODS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
function option(value,label){return `<option value="${esc(value)}">${esc(label)}</option>`}
function sourceOptions(method){
  if(method==='card'){
    const rows=accounts();
    return option('','Select card / wallet')+rows.map(a=>option(`acct:${a.id}`,accountLabel(a))).join('')+option('custom:','Other / unlinked card');
  }
  if(method==='paynow'||method==='bank_transfer'||method==='nets')return option('','Select bank')+BANKS.map(x=>option(`bank:${x}`,x)).join('');
  if(method==='ewallet'){
    const wallets=accounts().filter(a=>a._kind==='wallet'||['wallet','prepaid','debit','other'].includes(a.accountType));
    return option('','Select app / wallet')+wallets.map(a=>option(`acct:${a.id}`,accountLabel(a))).join('')+APPS.map(x=>option(`app:${x}`,x)).join('');
  }
  if(method==='voucher')return option('','Select voucher source')+option('custom:','Enter voucher / gift card');
  if(method==='other')return option('custom:','Enter payment source');
  return '';
}
function methodLabel(method){return METHODS.find(x=>x[0]===method)?.[1]||'Other'}
function enhance(){
  const form=document.querySelector('#expenseForm');
  if(!form||form.dataset.mgwPaymentMethods==='1'||document.querySelector('#receiptFile'))return;
  form.dataset.mgwPaymentMethods='1';ensure();
  const notes=form.elements.notes?.closest('.field');if(!notes)return;
  const methodField=document.createElement('div');methodField.className='field';methodField.innerHTML=`<label>Payment Method</label><select name="mgwPaymentMethod">${methodOptions()}</select>`;
  const sourceField=document.createElement('div');sourceField.className='field';sourceField.innerHTML='<label>Payment Source</label><select name="mgwPaymentSource"></select>';
  const customField=document.createElement('div');customField.className='field full';customField.hidden=true;customField.innerHTML='<label>Payment Source Details</label><input name="mgwPaymentCustom" placeholder="Bank, card, wallet or other payment source">';
  const note=document.createElement('div');note.className='field full';note.innerHTML='<small class="mgw-form-note">Configured cards and wallets can be linked directly so MGW can attribute the spending to the correct payment source.</small>';
  form.insertBefore(methodField,notes);form.insertBefore(sourceField,notes);form.insertBefore(customField,notes);form.insertBefore(note,notes);
  for(const name of ['paymentMethod','paymentSource','paymentAccountId','paymentSourceType']){const h=document.createElement('input');h.type='hidden';h.name=name;form.appendChild(h)}
  const method=form.elements.mgwPaymentMethod,source=form.elements.mgwPaymentSource,custom=form.elements.mgwPaymentCustom;
  const sync=()=>{
    const m=method.value,choice=source.value||'',customValue=custom.value.trim();let label='',accountId='',sourceType='';
    if(choice.startsWith('acct:')){accountId=choice.slice(5);const a=accounts().find(x=>x.id===accountId);label=a?accountLabel(a):'';sourceType=a?._kind==='credit'?'card':'wallet'}
    else if(choice.startsWith('bank:')){label=choice.slice(5);sourceType='bank'}
    else if(choice.startsWith('app:')){label=choice.slice(4);sourceType='wallet'}
    else if(choice.startsWith('custom:')){label=customValue;sourceType=m==='card'?'card':m==='ewallet'?'wallet':m==='voucher'?'voucher':'other'}
    if(m==='cash'){label='Cash';sourceType='cash'}
    form.elements.paymentMethod.value=methodLabel(m);
    form.elements.paymentSource.value=label;
    form.elements.paymentAccountId.value=accountId;
    form.elements.paymentSourceType.value=sourceType||m;
  };
  const refresh=()=>{
    const m=method.value;source.innerHTML=sourceOptions(m);sourceField.hidden=m==='cash';customField.hidden=true;
    if(m==='cash'){sync();return}
    const updateCustom=()=>{customField.hidden=!source.value.startsWith('custom:');sync()};
    source.onchange=updateCustom;updateCustom();
  };
  method.addEventListener('change',refresh);custom.addEventListener('input',sync);form.addEventListener('submit',sync,true);refresh();
}
function boot(){enhance();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;enhance()})}).observe(document.body,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWManualPaymentMethods={version:RELEASE};
})();
