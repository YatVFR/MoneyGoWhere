# MoneyGoWhere Phase 5 — MasterDB, Full Backup & Recovery

Phase 5 separates the live browser database from explicit portable backup formats.

## Backup formats

### MoneyGoWhere MasterDB

`kind: moneygowhere-masterdb`

Contains the normalized MoneyGoWhere finance database together with:

- app version
- schema version
- data version
- format version
- export timestamp
- record summary
- canonical accounts
- canonical recurring items
- imports, quarantine data and database settings

MasterDB is the primary portable finance-data backup.

### Full App Backup

`kind: moneygowhere-full-backup`

Contains the complete finance database plus supported local app preferences, including the selected reporting period/range and local UI preferences stored under `mgw-ui-*`.

The Full App Backup is intended for restoring the application more completely on another browser/device.

## Restore validation

Restore accepts:

- Phase 5 MasterDB files
- Phase 5 Full App Backup files
- legacy MoneyGoWhere JSON backups containing `expenses[]` and `income[]`

Before restore, the file is:

1. identified by backup kind;
2. schema-migrated in memory if required;
3. passed through the stability sanitizer;
4. normalized to the current schema;
5. synchronized with the account and recurring registries;
6. summarized for the user.

No live data is replaced until the user confirms the Restore Preview.

## Restore Preview

The preview displays:

- expenses
- income records
- accounts
- recurring items
- budgets
- import-history records
- quarantined records
- source app/schema information

## Restore rollback

Immediately before a confirmed restore, MoneyGoWhere writes one local rollback snapshot:

`moneygowhere-restore-rollback-v1`

The Database Health panel exposes **ROLLBACK LAST RESTORE** while a valid snapshot is available.

This snapshot represents the database immediately before the most recent confirmed restore.

## Backup metadata

A successful export updates local `backupMeta` with:

- last export timestamp
- export kind
- app version
- schema version
- data version

## Compatibility

The browser storage key remains:

`moneygowhere-db-v1`

This is deliberate. Phase 5 changes the portable backup contract without forcing an additional browser-storage migration.

Legacy raw JSON export/import handlers are retained only as fallbacks. Phase 5 routes the normal Settings backup and restore actions through the MasterDB engine.

## Data version

- Schema version: 2
- Data version: 18
- Phase 5 DEV release: 1.9.0-dev.1

## Rollback checkpoint

Pre-Phase-5 source state is preserved in:

`checkpoint/pre-phase5-masterdb-v1.8.0-dev.1`
