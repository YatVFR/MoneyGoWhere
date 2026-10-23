// Read-only payment scheduling shared by the form and dashboard.
(()=>{'use strict';
const num=v=>Math.max(0,Number(v)||0),round=v=>Math.round(v*100)/100;
const safeDate=(y,m,d)=>new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate()));
const parse=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const add=(d,n)=>safeDate(d.getFullYear(),d.getMonth()+n,d.getDate());
function first(a){const purchase=parse(a.purchaseDate),explicit=parse(a.firstDueDate),rule=a.paymentStartRule||'custom';if(rule==='purchase'&&purchase)return purchase;if(rule==='month_after'&&purchase)return add(purchase,1);if(rule==='next_cycle'&&purchase){const d=add(purchase,1);return a.dueDay?safeDate(d.getFullYear(),d.getMonth(),Math.min(31,Math.max(1,Number(a.dueDay)))):d}return explicit}
function schedule(a){const start=first(a),months=Math.max(1,Math.floor(num(a.durationMonths)||1));if(!start)return[];const total=round(Math.max(0,num(a.productCost)-num(a.downpayment))+num(a.fees)+num(a.interestAmount)),custom=round(num(a.customMonthlyPayment)),regular=a.installmentMode==='custom'&&custom>0?custom:round(total/months),rows=[];let allocated=0;for(let i=0;i<months;i++){let amount=i===months-1?round(total-allocated):regular;if(i<months-1&&allocated+amount>total)amount=round(Math.max(0,total-allocated));allocated=round(allocated+amount);rows.push({index:i+1,date:key(add(start,i)),amount})}return rows}
function due(a,anchor,database){if(!a.recurrenceEnabled)return num(a.cycleDue);const b=typeof mgwCycleBounds==='function'?mgwCycleBounds(anchor):{start:new Date(anchor.getFullYear(),anchor.getMonth(),1),end:new Date(anchor.getFullYear(),anchor.getMonth()+1,1)},inside=x=>{const d=parse(x.date);return d&&d>=b.start&&d<b.end};return round(Math.max(0,schedule(a).filter(inside).reduce((n,x)=>n+x.amount,0)-(database.payLaterPayments||[]).filter(x=>x.accountId===a.id&&!x.voided&&inside(x)).reduce((n,x)=>n+num(x.amount),0)))}
window.MGWPayLaterPlanner=Object.freeze({schedule,due});
})();
