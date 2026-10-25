# MoneyGoWhere — UAT to DEV implementation handoff

## Purpose
Use the validated UAT work as the implementation reference for further development on `dev`. Do **not** merge UAT branding, UAT storage/cache identity, personal financial data, or UAT release metadata into DEV.

## Source baseline
- Original DEV promotion source: `v2.0.0-dev.38` at `8632925c77053fcd8b149ea104e89328cc4c8e9b`.
- UAT branch: `preview/uat`.
- UAT release after cache correction: `v2.0.0-uat.2`.
- Re-read both branch heads before implementation. Review intervening changes instead of silently replacing them.

## Non-negotiable data rules
1. Preserve `moneygowhere-db-v1`, schema/data versions unless a reviewed migration is genuinely required.
2. Preserve account/card IDs, transaction IDs, repayment history, recurring history and backup compatibility.
3. Never reset, seed, import or copy UAT financial records into DEV.
4. Never create duplicate expense + repayment entries for the same liability payment.
5. Archive referenced accounts; permanently delete only zero-reference unused accounts.

## 1. Pay-Later calculation authority
Use `paylater-planner.js` as the common calculation authority for recurrence-enabled plans.

Required calculation:
- Build scheduled instalments.
- Allocate valid Pay-Later payments oldest-due-first.
- Skip fully paid scheduled dates.
- Outstanding = scheduled amount minus allocated valid payments.
- Due for selected cycle = remaining amount on instalments due in that cycle.
- Next payment = earliest scheduled instalment with remaining amount.
- Payments left / instalments paid derive from that same allocation.

Dashboard and Settings must consume the same planner result. Do not independently calculate counters with stale `cycleDue`, `monthlyPayment` or `Math.max(due, paid)`.

Compatibility: legacy/manual non-recurring Pay-Later plans retain their existing counter behaviour. Do not overwrite their `installmentsPaid` from an empty recurrence schedule.

## 2. Pay-Later and card repayment funding sources
Record Payment must allow active sources already represented by My Wallet:
- Bank accounts
- Wallets / stored-value accounts
- Debit/payment methods
- Credit cards
- Other / already accounted for

Keep `fundingAccountId` as the canonical compatibility field.

Accounting rules:
- Liability repayment reduces the target card/Pay-Later liability once.
- Bank/wallet/debit funding reduces the resolved funding balance once.
- Paying Pay-Later from a credit card increases that credit card's debt/outstanding once.
- Do not create a normal expense for a liability repayment.
- Never allow a Pay-Later plan to fund itself.

Editing/reconciliation must retain or update the actual funding account rather than silently using the first/default bank.

## 3. Recurring bills — payment source per occurrence
Recurring bills may store optional `preferredPaymentAccountId` as a convenience default only.

Each bill provides **Record Payment**. Recording an occurrence opens the standard expense form with bill details prefilled, then uses MoneyGoWhere's existing Payment Method + Payment Source controls.

The user must be able to choose a different source each month. Changing one occurrence must not rewrite historical occurrences or permanently change the recurring template unless the user explicitly edits the template.

Reuse `payment-form-core.js`; do not create a second incompatible payment taxonomy.

## 4. Inactive cards and wallets
Active cards remain in the normal Wallet/Credit sections.

`active === false` entries are consolidated into collapsed sections:
- **Inactive Cards**
- **Inactive Cards & Wallets**

Inactive accounts remain addressable by historical records and can be reactivated.

Do not include inactive cards in active Dashboard card summaries or new-payment source lists unless an existing record is being displayed.

## 5. Safe permanent deletion
Permanent deletion is available only when an account has zero references.

At minimum inspect:
- expense `paymentSourceId` / `paymentAccountId` / `paymentBankAccountId`
- `creditPayments.accountId`
- `creditPayments.fundingAccountId`
- `payLaterPayments.fundingAccountId`
- recurring bill `preferredPaymentAccountId`
- income `depositAccountId`
- linked wallet/debit/payment-method `linkedBankAccountId`
- canonical `paymentSourceMap` mappings

When dependencies exist:
- Disable/block Delete.
- Show a useful explanation such as **Cannot delete — used by 14 transactions, 2 repayments**.
- Offer **Mark Inactive** instead.
- Preserve all history and IDs.

When there are no dependencies:
- Require confirmation.
- Remove only the unused account/canonical account row.
- Do not filter/delete transaction, repayment, income or recurring arrays as a side effect.

Remove/avoid the legacy destructive behaviour that deleted `creditPayments` when deleting a card.

## 6. Cache/build delivery
A functional JavaScript change must not ship under a stale client cache identity.

UAT required a build bump from `2.0.0-uat.1` to `2.0.0-uat.2` because iOS was still showing the previous bank-only Pay-Later form.

For DEV:
- Keep DEV branding and cache namespace.
- Increment the DEV build/version consistently when adopting these changes.
- Align `index.html`, service-worker registration/query version, manifest asset versions and visible DEV badge as required by the DEV release convention.
- Never copy UAT palette, UAT badge, UAT manifest name or `moneygowhere-uat-*` cache identity into DEV.

## 7. Regression requirements
Keep existing release/readiness tests and add/retain coverage for:
- Pay-Later oldest-due-first allocation.
- Fully paid instalments skipped.
- Outstanding / due / next payment / counters agree across Dashboard and Settings.
- Legacy non-recurring Pay-Later counters remain compatible.
- Bank, wallet, debit/payment method and credit-card funded repayments.
- Exactly one liability effect and one funding-source effect.
- Recurring bill occurrence can use a different payment source each month.
- Historical recurring occurrences remain unchanged.
- Referenced card cannot be permanently deleted.
- Unused zero-reference card can be deleted.
- Archive/reactivate preserves history.
- Inactive cards are collapsed and excluded from active summaries.
- Wallet balance and reconciliation regressions continue to pass.
- DEV environment identity/cache tests pass.

## 8. DEV implementation procedure
1. Re-read `dev` and `preview/uat` heads.
2. Create a DEV rollback/checkpoint branch.
3. Review the UAT diffs; port functional changes deliberately rather than merging UAT identity wholesale.
4. Preserve DEV theme, icons, manifest identity, cache namespace and data.
5. Run release smoke, data integrity, wallet balance, Pay-Later, recurring, card-lifecycle, browser and data-boundary tests.
6. Perform isolated dummy-data functional tests.
7. Provide one pre-commit improvement suggestion and a change summary.
8. Commit to DEV only after review/approval if the current DEV workflow requires approval.
9. Deploy DEV and verify the exact head before further improvements.

## Acceptance scenarios
### Pay-Later
Create a $300 / 3 × $100 plan. Pay the first $100. Expect $200 outstanding, first date skipped, and next unpaid instalment shown consistently. Test funding from bank, wallet and credit card.

### Recurring bill
Create a monthly bill with a preferred bank. Record month 1 from that bank, month 2 from a credit card and month 3 from a wallet. Each saved expense retains its own selected source; the template and previous months are not rewritten.

### Card lifecycle
Create an unused card: Delete should be available after confirmation. Create/use another card in an expense or repayment: Delete must be blocked with dependency counts; Mark Inactive must remain available. Reactivation must restore it without changing historical records.
