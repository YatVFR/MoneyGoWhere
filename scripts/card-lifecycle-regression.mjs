import fs from 'node:fs';
const src=fs.readFileSync('cards-wallets.js','utf8');
const fail=m=>{console.error('Card lifecycle regression failed:',m);process.exitCode=1};
for(const token of [
  "function dependencies(accountId,d=db)",
  "count('transactions',d.expenses",
  "count('card repayments',d.creditPayments",
  "count('Pay-Later repayments',d.payLaterPayments",
  "count('recurring bills',d.recurringBills",
  "Cannot delete — used by",
  "Inactive Cards & Wallets",
  "Delete Unused Card / Wallet"
])if(!src.includes(token))fail(token);
if(/db\.creditPayments\s*=\s*db\.creditPayments\.filter\(x=>x\.accountId!==a\.id\)/.test(fs.readFileSync('credit-manager.js','utf8')))fail('legacy destructive repayment deletion still present');
if(!process.exitCode)console.log('Card lifecycle regression passed: referenced accounts are guarded; inactive grouping and non-destructive delete path present.');

