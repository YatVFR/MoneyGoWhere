# MoneyGoWhere Phase 7 — Hardening, Cleanup & Release Readiness

Phase 7 hardens the DEV codebase before UAT promotion. It does not change the finance schema; Schema v2 / Data Version 19 remain current.

## Runtime cleanup

The runtime coordinator no longer repeats Settings, Import and Dashboard modules in the generic deferred-module list.

Dedicated loaders now own those feature groups. This reduces unnecessary preload work, duplicate loader passes and Safari-side initialization churn.

## Backup / restore ownership

The Phase 5 MasterDB engine is now the primary Settings backup and restore owner.

Compatibility code no longer competes for the same controls:

- legacy finance export handlers no longer add competing capture listeners;
- the runtime export handler remains only as a fallback function;
- import-normalizer defers to MasterDB restore when the MasterDB engine is present;
- legacy normalized import remains available as a compatibility fallback.

## Release Readiness panel

Settings now includes a local synthetic self-test panel.

The tests use generated in-memory records only and do not copy or upload personal finance data.

Checks include:

- release identity
- Schema v2 normalization
- unified account registry
- recurring engine
- transaction derivation/provenance
- MasterDB validation
- payment-form integration
- runtime module health

The panel can be rerun manually.

## CI release smoke workflow

Phase 7 adds:

`scripts/release-smoke.mjs`

and:

`.github/workflows/release-readiness.yml`

The workflow checks:

- required architecture files exist;
- index build/version metadata is coherent;
- versioned static scripts use the current BUILD value;
- required core modules are present in the service-worker shell;
- module lists do not contain duplicate entries;
- Release Readiness is part of the Settings loader;
- MasterDB owns the restore compatibility path;
- dashboard uses the transaction engine;
- transaction provenance/link fields exist;
- MasterDB, Full Backup and restore rollback contracts remain present.

The workflow runs on DEV, UAT, MAIN and pull requests.

## Release

- DEV release: 2.0.0-dev.2
- Schema: 2
- Data Version: 19
- Rollback checkpoint: `checkpoint/pre-phase7-hardening-v2.0.0-dev.1`

Phase 7 is the final DEV hardening stage before dedicated UAT promotion/testing.
