# MoneyGoWhere Compatibility Patch — 2.0.0-dev.3

This patch hardens the current Schema v2 database model against historical MoneyGoWhere backups and imported finance records.

## Release

- App: 2.0.0-dev.3
- Schema: 2
- Data Version: 20
- Rollback checkpoint: `checkpoint/pre-compatfix-v2.0.0-dev.2`

## Historical recurring inference

MoneyGoWhere can now infer a canonical recurring commitment from imported historical transactions when the pattern is strong:

- at least six distinct monthly occurrences;
- at least 70% of month-to-month gaps are consecutive;
- the record is clearly import/migration sourced;
- an equivalent configured recurring item does not already exist.

The inferred item uses the latest observed amount, keeps the historical start month, and is automatically ended when the source pattern is stale.

No vendor names or personal finance records are embedded in application source.

## Recurring reconciliation

Recurring matching keeps merchant/name matching but permits a wider amount tolerance for naturally variable categories such as utilities, telecom, insurance and subscriptions.

When an actual recurring charge is greater than the reserved recurring amount, only the over-plan difference is added back to day-to-day spending. This keeps Safe to Spend from ignoring an unexpectedly high recurring bill.

## Imported provenance

Historical file-based finance records and records explicitly described as imported, migrated or reconciled are normalized to `migration` provenance instead of being reported as manual entry.

Original source fields remain intact.

## Observed wallet/payment sources

Specific transaction payment-source labels can now become stable inferred wallet accounts when no configured account matches them.

Generic methods such as Cash, Card, Apple Pay, PayNow, Visa or Mastercard are not auto-created as accounts.

Detected wallets are stored in `walletAccounts[]`, receive deterministic IDs, participate in the canonical `accounts[]` registry and are labelled as detected from transaction history in Settings.

## Category rendering

The app now provides first-class UI categories for:

- Healthcare
- Installments
- Subscription
- Insurance
- Telecom

Existing category data is preserved.

## Quarantine health state

Quarantined import rows remain isolated from live calculations. When quarantine is the only outstanding health condition, Database Health now reports `REVIEW QUARANTINE` rather than the generic `REVIEW DATABASE`.

## Validation

Release smoke checks now verify:

- Data Version 20;
- observed-wallet support;
- historical recurring inference support;
- recurring-overage accounting;
- the extended category UI.
