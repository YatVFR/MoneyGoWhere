# MoneyGoWhere Phase 6 — Derived Dashboard & Transaction Model

Phase 6 makes the dashboard derive its figures from normalized transaction records, stable account IDs and recurring links.

## Canonical transaction metadata

The live database now includes:

- `transactionModelMeta{}`

Expenses may now carry:

- `provenance`
- `transactionFingerprint`
- `paymentSourceId`
- `recurringItemId`

Existing fields remain intact for compatibility.

## Provenance

MoneyGoWhere normalizes transaction origin into values such as:

- `manual`
- `receipt`
- `apple-pay`
- `import`
- `recurring`
- `migration`

New manual and receipt records are stamped when created. Older records are normalized in place without removing their original source fields.

## Payment-source relationships

New manual transactions now write the canonical `paymentSourceId` in addition to compatibility fields.

The transaction engine resolves account relationships through the Phase 3 account registry.

## Recurring reconciliation

Transactions can be linked to a canonical recurring item using `recurringItemId`.

Automatic historical linking is conservative:

1. merchant/name must match;
2. amount must be within the existing tolerance;
3. an ambiguous equal-scoring match is not linked automatically;
4. the same recurring item is linked at most once per calendar month.

No recurring schedule creates a transaction automatically.

## Duplicate fingerprints

Each expense receives a local fingerprint derived from:

- date
- time
- merchant/vendor
- amount
- currency
- payment source ID

Database Health reports potential duplicate fingerprints for review. Phase 6 does not silently delete duplicates.

## Dashboard derivation

The dashboard now prefers the transaction engine for cycle activity.

It separates posted expenses into:

- day-to-day spending
- posted recurring charges
- Pay-Later purchases

Only day-to-day spending reduces Safe to Spend after commitments have already been reserved.

This prevents already-reserved recurring charges and deferred Pay-Later purchases from being counted a second time.

## Cycle Activity drill-down

The dashboard now includes a Cycle Activity card showing:

- day-to-day spending
- posted recurring charges
- Pay-Later purchases
- top categories
- payment sources
- transaction provenance

These views are derived from the local database and are not stored as separate balances.

## Data version

- Schema version: 2
- Data version: 19
- Phase 6 DEV release: 2.0.0-dev.1

## Rollback checkpoint

Pre-Phase-6 source state is preserved in:

`checkpoint/pre-phase6-dashboard-v1.9.0-dev.1`
