# MoneyGoWhere Database Schema v2

MoneyGoWhere remains local-first. The live database is stored in browser storage under `moneygowhere-db-v1` for backward compatibility with existing installations.

## Identity

- `app`: `MoneyGoWhere`
- `version`: 2
- `schemaVersion`: 2
- `dataVersion`: 17
- `createdAt`: database creation timestamp
- `updatedAt`: last application save timestamp

The storage key is intentionally unchanged in schema v2 so existing browsers can be migrated in place.

## Top-level collections

- `expenses[]`
- `income[]`
- `creditAccounts[]`
- `creditPayments[]`
- `payLaterAccounts[]`
- `payLaterPayments[]`
- `monthlyCommitments[]`
- `recurringIncome[]`
- `recurringCommitments[]`
- `recurringBills[]`
- `walletAccounts[]`
- `bankAccounts[]`
- `accounts[]` — canonical Phase 3 account registry
- `recurringItems[]` — canonical Phase 4 recurring registry
- `importQueue[]`
- `importHistory[]`
- `receiptImportQueue[]`
- `receiptImportHistory[]`

## Structured objects

- `budgets`: monthly total and category budgets.
- `settings`: local app preferences.
- `importQuarantine`: malformed import records retained for review instead of being silently discarded.
- `backupMeta`: local backup metadata.
- `schemaMeta`: migration provenance.
- `paymentSourceMap`: normalized payment-source token to stable account ID map.
- `accountModelMeta`: unified account-registry metadata.
- `recurringModelMeta`: unified recurring-engine metadata.

## Migration

Schema v1 databases and legacy backups are upgraded in place to schema v2. The migration is additive: existing fields and feature collections are preserved.

Before the first v1 → v2 migration, MoneyGoWhere creates one local rollback snapshot at:

`moneygowhere-rollback-pre-schema2-v1`

The migration engine then:

1. clones the existing database;
2. preserves existing collections and unknown compatible fields;
3. supplies missing schema-v2 collections with empty defaults;
4. adds schema/version metadata;
5. runs the existing stability sanitizer;
6. persists the upgraded database.

No existing feature collection is renamed or intentionally deleted in Phase 2.

## Compatibility

Legacy MoneyGoWhere backups that contain `expenses[]` and `income[]` remain accepted. They pass through the schema migration and stability sanitization layers before becoming the live database.

Schema v2 remains the compatibility foundation. Phase 3 introduced the canonical `accounts[]` registry and stable payment-source IDs. Phase 4 extends data version 17 with canonical `recurringItems[]` while preserving legacy recurring collections as compatibility mirrors.
