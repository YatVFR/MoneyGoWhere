# MoneyGoWhere Phase 3 — Unified Accounts & Payment Sources

Phase 3 introduces a canonical account registry while preserving the existing feature-specific account collections for backward compatibility.

## Canonical account registry

The live database now includes:

- `accounts[]`
- `paymentSourceMap{}`
- `accountModelMeta{}`

Every account in `accounts[]` has a stable `id` and normalized account type.

Supported canonical types include:

- `credit`
- `debit`
- `wallet`
- `prepaid`
- `paylater`
- `bank`
- `other`

The registry mirrors the existing source collections:

- `creditAccounts[]`
- `walletAccounts[]`
- `payLaterAccounts[]`
- `bankAccounts[]`

Existing IDs are reused wherever present. Missing IDs are generated and written back to the legacy source record so the relationship stays stable.

## Transaction relationship

Schema-v2 transactions may now carry:

- `paymentSourceId` — canonical stable account ID
- `paymentAccountId` — compatibility alias retained for existing modules

Existing text fields such as `card`, `cardIdentity`, `paymentSource` and `paymentMethod` remain intact.

The account registry attempts automatic linking only when a single unambiguous account match is found. Existing explicit IDs always take precedence.

## Compatibility

Phase 3 does not remove the legacy account collections. Existing UI modules may continue to edit them during the transition.

After account changes, the registry synchronizes the legacy collections into `accounts[]`.

Credit / PayLater calculations now prefer stable account IDs and fall back to historical text matching only when no linked ID is available.

Apple Pay and imported payment-source linking now writes both `paymentSourceId` and `paymentAccountId`.

## Data version

- Schema version: 2
- Data version: 16
- Phase 3 DEV release: 1.7.0-dev.1

## Health checks

Database Health now reports:

- canonical account count
- orphan payment-source links
- duplicate IDs
- invalid records
- quarantined records

An orphan payment link means a transaction contains an account ID that no longer exists in the canonical registry.

## Future direction

The legacy account collections remain compatibility mirrors in Phase 3. A later refactor may make `accounts[]` the only persisted account store once all UI modules consume the canonical registry directly.
