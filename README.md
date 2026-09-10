# MoneyGoWhere 💸

**Your money. Your spending. Now you know where.**

MoneyGoWhere (MGW) is a clean, mobile-first, local-first personal finance PWA for tracking spending, income, budgets, commitments, debt and recurring financial obligations.

## Current Release — v1.5.3

MoneyGoWhere is designed around one goal:

> Open MoneyGoWhere and understand your financial position within 10 seconds.

### Dashboard

- Monthly or pay-cycle tracking
- Net income and total spending
- Monthly budget used and remaining
- Safe-to-Spend calculation
- Budget After Commitments
- Smart Spending Advisor
- Top spending categories
- 6-month spending trend
- Budget-health and almost-over-budget warnings
- Collapsible dashboard cards with locally remembered open/closed state

### Budget After Commitments

The planning figure protects known obligations before discretionary spending:

```text
Budget After Commitments
= Net income
− fixed & recurring commitments
− debt repayments
− Pay-Later commitments
− reserved money
```

Credit limits are informational and are not treated as income or available cash.

### Expense Tracking

Categories include:

- Groceries
- Kids Essentials
- Utilities
- Household
- Transport
- Loans & Commitments
- Taxes
- Lifestyle
- Savings
- Investment
- Healthcare
- Installments
- Other

Vehicle and bike maintenance tracking remains intentionally separate because it is handled by FuelTracker.

### Receipt-assisted Entry

Users can take or upload a receipt photo. Client-side OCR attempts to extract:

- Date
- Time
- Vendor
- Location
- Total amount

MoneyGoWhere can suggest a spending category from known vendor/category rules. Extracted values remain editable and require review before saving.

Duplicate checks help detect transactions with matching date, vendor and amount.

### 🍎 Apple Pay / iOS Shortcuts Integration

MoneyGoWhere includes an iOS Shortcuts bridge for bringing Apple Pay transaction details into the expense-entry workflow.

Because a browser/PWA cannot directly read Apple Wallet transaction history, the integration uses an iOS Shortcut automation:

```text
Apple Pay transaction
        ↓
iOS Shortcuts automation
        ↓
MoneyGoWhere URL bridge
        ↓
Pre-filled expense
        ↓
Category suggestion + duplicate check
        ↓
User review
        ↓
Save
```

The bridge can receive:

- Merchant / vendor
- Amount
- Card / payment source
- Transaction date
- Transaction time
- Optional categorisation hint

MoneyGoWhere then:

- Marks the payment method as Apple Pay
- Suggests a spending category from local merchant rules
- Detects supported shopping platforms where possible
- Checks for a possible duplicate transaction using date, vendor and amount
- Opens the normal expense form with the transaction pre-filled
- Requires user review before the expense is saved

The bridge is invoked using the `mgw=applepay` URL parameter together with the transaction fields supplied by the Shortcut. Personal transaction data is not embedded in the public application repository.

> **Status:** The Apple Pay/iOS Shortcuts bridge is implemented in MoneyGoWhere. Real-device Apple Pay UAT remains to be completed, so it should not yet be considered fully production-validated.

### Income Tracking

Track:

- Base / gross salary
- Net salary
- Bonus
- One-off payments
- Salary trends and bonus history

### Recurring Schedules — v1.5.3

MoneyGoWhere now has a local recurring-schedule engine for income and commitments.

Supported frequencies:

- Monthly
- Every 2 months
- Quarterly
- Half-yearly
- Yearly

A schedule can have a start month, optional end month, or continue without an end date.

The engine stores **one recurrence rule** rather than creating duplicate records for every future month. Only the selected period is evaluated, reducing database growth and unnecessary processing.

Recurring net income and recurring commitments are included in Budget After Commitments calculations when their schedule applies to the selected period.

> v1.5.3 currently provides the recurrence engine and schedule summary. Full Add/Edit recurring-schedule forms are planned as a follow-up UI enhancement.

### Monthly Commitments

Fixed obligations can be recorded separately, including:

- Utilities
- Insurance
- Loans
- Housing
- Transport
- Family commitments
- Subscriptions
- Other fixed obligations

Commitments can be edited, paused/resumed or deleted.

Credit-card debt and Pay-Later obligations should not be duplicated here because their dedicated trackers already protect those repayments in cash planning.

### Credit Cards & Debt

MoneyGoWhere can locally track credit accounts including:

- Credit limit
- Outstanding balance
- Available credit
- Utilization
- Statement balance
- Minimum payment
- Planned payment
- Payments made during the current cycle
- Personal card spending budget

Credit-card repayments are recorded separately from expenses so paying a card bill does not create a second expense.

### Pay-Later Tracking

Track installment / Pay-Later accounts with:

- Outstanding balance
- Current-cycle amount due
- Next due date
- Payments made

Only the relevant cycle obligation affects cash planning; the original purchase remains part of spending analysis.

### Smart Spending Advisor

The Smart Spending Advisor is a deterministic, local rules engine. It can highlight:

- High commitment-to-income ratios
- Low discretionary buffers
- Categories materially above recent spending patterns
- Protected debt and installment allocations

The advisor does not send financial data to a cloud AI service and is not financial advice.

### Calendar Month or Pay Cycle

Tracking can use either:

- Calendar month, or
- Payday-to-payday cycle

For example, payday 25 can represent **25 Aug → 24 Sep**.

Expenses, income, budgets and insights follow the selected tracking period.

### Backup & Restore

MoneyGoWhere uses a local-first database stored in the browser.

- New devices start empty
- Finance records are not bundled into the public GitHub application
- Users can export a JSON backup
- Backups include app/schema/data metadata
- Restore is used to transfer the personal database between devices

**Back up your database before installing a major update or clearing browser/PWA data.**

## Privacy Architecture 🔒

MoneyGoWhere is intentionally local-first:

```text
Your finance data
       ↓
Browser / PWA local storage
       ↓
Dashboard + local calculations
       ↓
Optional user-controlled JSON backup
```

Personal finance records are not committed to this public repository. Receipt OCR, Apple Pay bridge processing, debt calculations, recurring schedules and Smart Spending Advisor calculations run locally in the browser.

## PWA & Update Handling

MoneyGoWhere can be installed as a Progressive Web App. The service worker caches core application assets for resilience and uses a controlled update process rather than automatically replacing the active version while it is running.

Current application/cache version: **1.5.3**

## Performance

v1.5.x includes several lightweight optimizations:

- Cached currency formatters
- Coalesced dashboard rendering
- Reduced unnecessary DOM rewrites
- Single-pass payment aggregation
- Cycle-specific recurrence evaluation
- Recurring rules stored once rather than materialized into many monthly records
- Narrowly scoped DOM observation for collapsible dashboard sections
- No heavy frontend framework required

## UX / Theme

- Clean and mobile-first
- Light, spacious cards
- Rounded UI components
- Section/category icons for recognition
- Minimal visual clutter
- Floating bottom navigation: **Dashboard · Add · Insights · Settings**
- Add workflow for receipt scan, manual expense and income

## Main Local Data Sets

Depending on enabled features, the local database can contain:

```text
income
expenses
budgets
settings
monthlyCommitments
recurringIncome
recurringCommitments
creditAccounts
creditPayments
payLaterAccounts
payLaterPayments
```

## Release History

### v1.5.3
- Collapsible Dashboard engine
- Persistent collapse preferences
- Recurring income/commitment engine
- Recurrence-aware Budget After Commitments
- Performance and rendering cleanup
- Apple Pay/iOS Shortcuts bridge retained and documented
- Data version 9
- PWA cache v1.5.3

### v1.5.2
- Smart Spending Advisor
- Budget After Commitments
- Monthly commitments manager
- Performance optimizer
- Commitment/expense double-count protection

### v1.5.1
- Credit-card/debt tracker
- Pay-Later tracker
- Safe-to-Spend enhancements
- Repayment accounting guardrails

### v1.5.0
- Enhanced client-side receipt OCR
- Editable receipt extraction
- Vendor/category suggestions
- Duplicate detection improvements

## Development Principles

1. Keep personal financial data out of the public application repository.
2. Preserve backward compatibility with existing local databases and backups.
3. Create a rollback checkpoint before production promotion.
4. Avoid double-counting expenses, repayments and commitments.
5. Prefer lightweight local calculations over unnecessary external services.
6. Keep the application version visible for troubleshooting and update tracking.
7. Optimize and verify changes before promoting them to production.
