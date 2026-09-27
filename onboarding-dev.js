// MoneyGoWhere v1.5.5-dev.45 — first-run onboarding with payment setup
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev',num=v=>Number(v)||0,uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const PAYMENT_METHODS=[['cash','Cash'],['card','Card'],['apple_pay','Apple Pay'],['paynow','PayNow'],['ewallet','E-Wallet / App'],['bank_transfer','Bank Transfer'],['nets','NETS'],['voucher','Voucher / Gift Card'],['other','Other']];
const BANKS=['DBS / POSB','OCBC','UOB','Standard Chartered','Citibank','HSBC','Maybank','CIMB','Trust Bank','GXS Bank','MariBank','Other bank'];
const WALLETS=['GrabPay','ShopeePay','Touch ’n Go eWallet','Singtel Dash','DBS PayLah!','YouTrip','Revolut','Wise','Alipay+','WeChat Pay','Other app / wallet'];
const PROVIDERS={bank:BANKS,credit:BANKS,debit:BANKS,wallet:WALLETS};
function saveLocal(){localStorage.setItem(MGW.key,JSON.stringify(db))}
function ensure(){
  db.settings=db.settings||{};db.settings.onboarding=db.settings.onboarding||{};db.settings.paymentMethods=db.settings.paymentMethods||{};
  db.budgets=db.budgets||{monthly:0,categories:{}};db.creditAccounts=Array.isArray(db.creditAccounts)?db.creditAccounts:[];db.walletAccounts=Array.isArray(db.walletAccounts)?db.walletAccounts:[];db.bankAccounts=Array.isArray(db.bankAccounts)?db.bankAccounts:[];
}
function css(){if(document.querySelector('#mgwOnboardingCss'))return;const s=document.createElement('style');s.id='mgwOnboardingCss';s.textContent=`
.mgw-ob{position:fixed;inset:0;z-index:90;background:rgba(15,23,22,.62);display:grid;place-items:center;padding:16px}.mgw-ob-card{width:min(620px,100%);background:#fff;border-radius:24px;padding:22px;max-height:92dvh;overflow:auto}.mgw-ob-progress{height:7px;background:#edf2f1;border-radius:99px;overflow:hidden;margin:12px 0 22px}.mgw-ob-progress i{display:block;height:100%;background:#0f766e}.mgw-ob-actions{display:flex;gap:8px;margin-top:18px}.mgw-ob-actions button{flex:1}.mgw-ob-methods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0 16px}.mgw-ob-method{display:flex;gap:8px;align-items:center;border:1px solid #e3e9e7;border-radius:12px;padding:10px;background:#f8fbfa}.mgw-ob-method input{width:auto}.mgw-ob-source-builder{border:1px solid #e4eae8;border-radius:16px;padding:12px;margin-top:10px}.mgw-ob-source-list{display:grid;gap:7px;margin-top:10px}.mgw-ob-source{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 10px;border-radius:11px;background:#f4f8f7}.mgw-ob-source small{display:block;color:#71807c}.mgw-ob-source button{border:0;background:transparent;font-weight:800}.mgw-ob-existing{opacity:.72}.mgw-ob-note{font-size:.82rem;color:#71807c;line-height:1.4;margin-top:8px}@media(max-width:480px){.mgw-ob-methods{grid-template-columns:1fr}}
`;document.head.appendChild(s)}
let state={payday:25,income:'',budget:'',vendor:'',amount:'',category:'Groceries',paymentModes:[],defaultPayment:'',paymentSources:[]};
function initializePaymentState(){
  ensure();
  const saved=Array.isArray(db.settings.paymentMethods.enabled)?db.settings.paymentMethods.enabled:[];
  if(!state.paymentModes.length)state.paymentModes=saved.length?[...saved]:['cash','card','apple_pay','paynow','ewallet'];
  if(!state.defaultPayment)state.defaultPayment=db.settings.paymentMethods.default||state.paymentModes[0]||'cash';
}
function close(){document.querySelector('#mgwOnboarding')?.remove()}
function existingPaymentLabels(){
  ensure();const out=[];
  db.bankAccounts.forEach(a=>out.push({kind:'Bank / PayNow',label:a.nickname||a.name||a.bank||'Bank account',meta:a.bank||''}));
  db.creditAccounts.forEach(a=>out.push({kind:'Credit card',label:a.nickname||a.name||a.cardProduct||'Credit card',meta:a.issuer||''}));
  db.walletAccounts.forEach(a=>out.push({kind:a.accountType==='debit'?'Debit card':'Wallet / app',label:a.nickname||a.name||a.cardProduct||'Wallet',meta:a.issuer||''}));
  return out;
}
function paymentSetupBody(){
  initializePaymentState();const methods=PAYMENT_METHODS.map(([value,label])=>`<label class="mgw-ob-method"><input type="checkbox" data-ob-paymode value="${value}" ${state.paymentModes.includes(value)?'checked':''}><span>${label}</span></label>`).join('');
  const defaultOptions=PAYMENT_METHODS.filter(([v])=>state.paymentModes.includes(v)).map(([v,l])=>`<option value="${v}" ${v===state.defaultPayment?'selected':''}>${l}</option>`).join('');
  const existing=existingPaymentLabels().map(x=>`<div class="mgw-ob-source mgw-ob-existing"><span><b>${x.label}</b><small>${x.kind}${x.meta?` · ${x.meta}`:''}</small></span><small>Already configured</small></div>`).join('');
  const draft=state.paymentSources.map((x,i)=>`<div class="mgw-ob-source"><span><b>${x.nickname||x.product||x.provider}</b><small>${x.kindLabel} · ${x.provider}${x.last4?` · •••• ${x.last4}`:''}</small></span><button type="button" data-ob-remove-source="${i}">Remove</button></div>`).join('');
  return `<h2>Payment setup</h2><p>Choose how you normally pay, then add the banks, cards or wallets you want MGW to recognise. You can manage these again later.</p><label><b>Payment methods you use</b></label><div class="mgw-ob-methods">${methods}</div><div class="field"><label>Default manual payment method</label><select id="obDefaultPayment">${defaultOptions||'<option value="cash">Cash</option>'}</select></div><div class="mgw-ob-source-builder"><b>Add a payment source</b><div class="form-grid" style="margin-top:10px"><div class="field"><label>Source type</label><select id="obSourceType"><option value="bank">Bank / PayNow account</option><option value="credit">Credit card</option><option value="debit">Debit card</option><option value="wallet">E-Wallet / App</option></select></div><div class="field"><label>Bank / provider</label><select id="obSourceProvider"></select></div><div class="field"><label>Nickname / product</label><input id="obSourceName" placeholder="e.g. Daily card, OCBC account"></div><div class="field"><label>Last 4 / Apple Pay ID (optional)</label><input id="obSourceLast4" inputmode="numeric" maxlength="20" placeholder="e.g. 2254"></div><div class="field full"><button type="button" class="secondary-btn" id="obAddSource">＋ Add payment source</button></div></div><p class="mgw-ob-note">Only the details you enter are stored locally. No banking credentials are requested or stored.</p></div><div class="mgw-ob-source-list" id="obSourceList">${existing}${draft}</div>`;
}
function bindPaymentStep(root){
  const type=root.querySelector('#obSourceType'),provider=root.querySelector('#obSourceProvider'),name=root.querySelector('#obSourceName'),last4=root.querySelector('#obSourceLast4');
  const refreshProviders=()=>{provider.innerHTML=(PROVIDERS[type.value]||BANKS).map(x=>`<option>${x}</option>`).join('')};refreshProviders();type.addEventListener('change',refreshProviders);
  root.querySelectorAll('[data-ob-paymode]').forEach(x=>x.addEventListener('change',()=>{state.paymentModes=[...root.querySelectorAll('[data-ob-paymode]:checked')].map(n=>n.value);const d=root.querySelector('#obDefaultPayment');const current=d.value;d.innerHTML=PAYMENT_METHODS.filter(([v])=>state.paymentModes.includes(v)).map(([v,l])=>`<option value="${v}" ${v===current?'selected':''}>${l}</option>`).join('')||'<option value="cash">Cash</option>';state.defaultPayment=d.value}));
  root.querySelector('#obDefaultPayment').addEventListener('change',e=>state.defaultPayment=e.target.value);
  root.querySelector('#obAddSource').addEventListener('click',()=>{const kind=type.value,p=provider.value.trim(),n=name.value.trim(),id=String(last4.value||'').trim();if(!p)return;state.paymentSources.push({kind,kindLabel:{bank:'Bank / PayNow',credit:'Credit card',debit:'Debit card',wallet:'E-Wallet / App'}[kind],provider:p,nickname:n,last4:id});show(5)});
  root.querySelectorAll('[data-ob-remove-source]').forEach(b=>b.addEventListener('click',()=>{state.paymentSources.splice(Number(b.dataset.obRemoveSource),1);show(5)}));
}
function collectStep(root,step){
  if(step===2)state.payday=Math.min(31,Math.max(1,Number(root.querySelector('#obPay').value)||25));
  if(step===3)state.income=root.querySelector('#obIncome').value;
  if(step===4)state.budget=root.querySelector('#obBudget').value;
  if(step===5){state.paymentModes=[...root.querySelectorAll('[data-ob-paymode]:checked')].map(n=>n.value);state.defaultPayment=root.querySelector('#obDefaultPayment')?.value||state.paymentModes[0]||'cash'}
}
function show(step=1){
  ensure();initializePaymentState();let root=document.querySelector('#mgwOnboarding');if(!root){root=document.createElement('div');root.id='mgwOnboarding';root.className='mgw-ob';document.body.appendChild(root)}let body='';
  if(step===1)body='<h2>Welcome to MoneyGoWhere 👋</h2><p>Budget from payday to payday. Your finance data stays in this browser unless you export it yourself.</p>';
  if(step===2)body=`<h2>Payday cycle</h2><div class="field"><label>Payday / cycle start day</label><input id="obPay" type="number" min="1" max="31" value="${state.payday}"></div>`;
  if(step===3)body=`<h2>Main income</h2><div class="field"><label>Typical net income</label><input id="obIncome" type="number" min="0" step="0.01" value="${state.income}"></div>`;
  if(step===4)body=`<h2>Cycle budget</h2><div class="field"><label>Overall cycle budget</label><input id="obBudget" type="number" min="0" step="0.01" value="${state.budget}"></div>`;
  if(step===5)body=paymentSetupBody();
  if(step===6)body=`<h2>First expense</h2><p>Optional — leave blank to finish without adding one.</p><div class="form-grid"><div class="field"><label>Merchant</label><input id="obVendor" value="${state.vendor}"></div><div class="field"><label>Amount</label><input id="obAmount" type="number" min="0" step="0.01" value="${state.amount}"></div><div class="field full"><label>Category</label><select id="obCat">${Object.keys(MGW.cats).map(c=>`<option ${c===state.category?'selected':''}>${c}</option>`).join('')}</select></div></div>`;
  root.innerHTML=`<div class="mgw-ob-card"><div class="eyebrow">Setup · Step ${step}/6</div><div class="mgw-ob-progress"><i style="width:${step/6*100}%"></i></div>${body}<div class="mgw-ob-actions">${step>1?'<button class="secondary-btn" id="obBack">Back</button>':'<button class="secondary-btn" id="obSkip">Skip</button>'}<button class="primary-btn" id="obNext">${step===6?'Finish':'Continue'}</button></div></div>`;
  if(step===5)bindPaymentStep(root);
  root.querySelector('#obBack')?.addEventListener('click',()=>{collectStep(root,step);show(step-1)});
  root.querySelector('#obSkip')?.addEventListener('click',()=>{db.settings.onboarding.skippedAt=new Date().toISOString();saveLocal();close()});
  root.querySelector('#obNext').addEventListener('click',()=>{collectStep(root,step);if(step===6){state.vendor=root.querySelector('#obVendor').value.trim();state.amount=root.querySelector('#obAmount').value;state.category=root.querySelector('#obCat').value;finish();return}show(step+1)});
}
function addPaymentSources(){
  ensure();for(const x of state.paymentSources){const display=x.nickname||x.provider,last4=x.last4||'';
    if(x.kind==='bank'){db.bankAccounts.push({id:uid('BANK'),bank:x.provider,name:display,nickname:x.nickname||'',paymentIdentifier:last4});continue}
    if(x.kind==='credit'){db.creditAccounts.push({id:uid('CARD'),accountType:'credit',issuer:x.provider,cardProduct:x.nickname||`${x.provider} Card`,nickname:x.nickname||'',name:display,role:'spending',paymentIdentifier:last4});continue}
    db.walletAccounts.push({id:uid('WALLET'),accountType:x.kind==='debit'?'debit':'wallet',issuer:x.provider,cardProduct:x.nickname||x.provider,nickname:x.nickname||'',name:display,balance:'',baseCurrency:'SGD',paymentIdentifier:last4});
  }
  state.paymentSources=[];
}
function finish(){
  ensure();db.settings.payCycle={mode:'payday',day:state.payday};db.settings.paydayConfig={dayOfMonth:state.payday,frequency:'monthly',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'local'};
  db.settings.paymentMethods={enabled:state.paymentModes.length?[...state.paymentModes]:['cash','card','paynow'],default:state.defaultPayment||state.paymentModes[0]||'cash',configuredAt:new Date().toISOString()};addPaymentSources();
  if(num(state.income)>0)db.income.push({id:uid('INC'),date:new Date().toISOString().slice(0,10),baseSalary:num(state.income),netSalary:num(state.income),bonus:0,oneOff:0,source:'onboarding'});if(num(state.budget)>0)db.budgets.monthly=num(state.budget);if(state.vendor&&num(state.amount)>0)db.expenses.push({id:uid('EXP'),date:new Date().toISOString().slice(0,10),time:'',vendor:state.vendor,amount:num(state.amount),currency:db.settings.currency||'SGD',category:state.category,paymentMethod:PAYMENT_METHODS.find(x=>x[0]===db.settings.paymentMethods.default)?.[1]||'Cash',source:'onboarding'});
  db.settings.onboarding={completed:true,completedAt:new Date().toISOString()};saveLocal();close();if(typeof renderAll==='function')renderAll();if(typeof toast==='function')toast('Setup complete')
}
function installSettings(){const view=document.querySelector('#view-settings');if(!view||document.querySelector('#mgwOnboardingSettings'))return;const card=document.createElement('article');card.className='card';card.id='mgwOnboardingSettings';card.innerHTML='<div class="card-head"><div><span class="section-icon">👋</span><b>Welcome Setup</b></div></div><p class="privacy-note" style="padding:0 0 10px">Update payday, income, budget and your banks/cards/wallets.</p><button class="secondary-btn" id="mgwRunOnboarding">Run setup again</button>';view.insertBefore(card,view.querySelector('.privacy-note')||null);card.querySelector('#mgwRunOnboarding').addEventListener('click',()=>show(1))}
function refresh(){ensure();installSettings();document.querySelectorAll('.budget-card .card-head b').forEach(b=>{if(/monthly budget/i.test(b.textContent))b.textContent='Cycle Budget'})}
function recoverWallet(){const m=document.querySelector('#modal'),f=document.querySelector('#expenseForm');if(!m?.open||!f||!/apple\s*pay/i.test(f.elements.paymentMethod?.value||''))return;db.importQueue=Array.isArray(db.importQueue)?db.importQueue:[];const merchant=String(f.elements.vendor?.value||'').trim(),amount=num(f.elements.amount?.value),date=String(f.elements.date?.value||'').slice(0,10),time=String(f.elements.time?.value||'').slice(0,5),card=String(f.elements.card?.value||'').trim();if(!merchant||amount<=0)return;const sourceId=`wallet-${date}-${time}-${amount}-${merchant}-${card}`;if(!db.importQueue.some(x=>x.sourceId===sourceId))db.importQueue.push({id:uid('IMP'),source:'apple_wallet',sourceId,merchant,amount,date,time,currency:'SGD',card,paymentMethod:'Apple Pay',category:'',confidence:0,status:'pending'});saveLocal();try{m.close()}catch{}if(typeof renderAll==='function')renderAll();if(typeof nav==='function')nav('add');if(typeof toast==='function')toast('Wallet transaction queued for review')}
function boot(){ensure();css();refresh();if(typeof renderAll==='function'&&!renderAll.__mgwOnboarding){const base=renderAll;renderAll=function(){base();queueMicrotask(refresh)};renderAll.__mgwOnboarding=true}if(!db.settings.onboarding.completed&&!db.expenses.length&&!db.income.length)setTimeout(()=>show(1),200);setTimeout(recoverWallet,50);setTimeout(recoverWallet,350);setTimeout(recoverWallet,900)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.MGWOnboarding={version:RELEASE,run:()=>show(1)};})();
