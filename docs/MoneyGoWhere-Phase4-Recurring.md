# MoneyGoWhere Phase 4 — Unified Recurring Engine

Phase 4 introduces a canonical recurring model while preserving the existing recurring feature collections for backward compatibility.

## Canonical recurring collection

The live database now includes:

- `recurringItems[]`
- `recurringModelMeta{}`

Canonical recurring item types currently include:

- `income`
- `commitment`
- `bill`
- `loan`
- `savings`
- `installment`

Each canonical item carries a stable ID, source collection, source record ID, amount, frequency, start/end period, expected day, active state, optional account ID, merchant/category metadata and compatibility metadata.

## Compatibility mirrors

The following existing collections are retained during Phase 4:

- `recurringIncome[]`
- `recurringCommitments[]`
- `recurringBills[]`
- `monthlyCommitments[]`
- recurring-enabled `payLaterAccounts[]`

The recurring engine synchronizes these collections into `recurringItems[]`. Existing UI modules can continue writing their legacy structures while dashboard calculations consume the canonical recurring model.

## Dashboard behavior

The consolidated dashboard now uses the recurring engine for:

- scheduled income
- fixed monthly commitments
- recurring commitments
- recurring bills
- loan/savings classifications

Pay-Later installment plans also appear in the canonical recurring registry, but remain calculated in the dedicated Pay-Later section so they are not double-counted.

## No premature transaction creation

Recurring schedules remain planning records. Phase 4 does not create permanent expense or income transactions merely because a schedule becomes due.

Actual posted transactions remain separate records and are reconciled against planned recurring items by the existing dashboard matching logic.

## Synchronization

The recurring registry is refreshed:

- during DB hydration
- after recurring schedule changes
- after recurring bill changes
- after Pay-Later recurrence changes
- before backup export
- after data restore

## Data version

- Schema version: 2
- Data version: 17
- Phase 4 DEV release: 1.8.0-dev.1

## Rollback

Pre-Phase-4 code state is preserved in:

`checkpoint/pre-phase4-recurring-v1.7.0-dev.1`

Phase 4 is additive. It does not remove or rename existing recurring collections.
