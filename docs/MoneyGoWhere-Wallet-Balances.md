# My Wallet balance tracking — DEV 2.0.0-dev.29

Bank accounts store a bank name, nickname and optional last four account digits. Full account numbers are not requested.

1. Add or edit a bank account in Settings → My Wallet.
2. Enable Track balance, enter the balance at the **beginning** of the tracking start date, and save.
3. Link debit cards and PayNow / PayLah! payment methods to that bank.
4. Configure YouTrip with its own opening balance and date.
5. For credit cards, enable tracking and enter opening outstanding and the start date.

Saved expenses on or after the start date and up to today affect their explicitly linked payment source. Multiple payment methods linked to the same bank share its balance; the bank account and debit card are not separate pools of funds. Credit spending increases outstanding and reduces available credit. Pending imports do not affect balances.

Balances are calculated from the opening amount and current records. Editing, deleting, changing the payment source or reloading recalculates the balance without repeated deductions. Inactive accounts retain historical links. Existing accounts are not automatically enrolled in tracking.

When recording a credit or Pay-Later repayment, optionally select the bank that funded it. The repayment reduces debt and the selected bank balance without adding another expense. Existing repayments without a funding link do not guess a bank. Income can optionally name its receiving bank; net salary, bonus and one-off income add to that account.

PayLah! is modeled as sharing the linked bank balance, per the approved user preference.

Foreign transactions use the native amount when their currency matches the account, or a recorded conversion for an SGD account. Missing conversions are shown as pending and excluded from the displayed balance until resolved. Tracked balances are estimates from saved records; unrecorded fees, transfers and spending require reconciliation. Opening figures must describe the beginning of the selected date, not the current balance after that day's already recorded spending.

The checkpoint is checkpoint/pre-dev29-wallet-balances. Validation includes shared-bank deductions, credit repayment, history boundaries, conversions, edits, deletion, reload, identifier validation, backup preservation and failed-save protection. Local DOM form fixtures test actual save handlers; visual Safari/iPhone verification remains required.
