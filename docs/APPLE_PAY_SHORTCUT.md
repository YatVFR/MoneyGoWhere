# MoneyGoWhere Apple Pay Shortcut Bridge

MoneyGoWhere v1.3.0 can receive a Wallet transaction from an iPhone Shortcut by opening the app URL with transaction parameters. The existing Numbers logging action can stay in place.

## Recommended Shortcut flow

1. Trigger: **Wallet → Transaction**.
2. Keep the existing **Add Row to Numbers** action for the independent backup log.
3. After that action, add a **Text** action containing the MoneyGoWhere URL and variables from the transaction input.
4. Pass the Text into a **URL** action, then use **Open URLs**.

Use this shape:

`https://yatvfr.github.io/MoneyGoWhere/?mgw=applepay&merchant=[Merchant]&amount=[Amount]&card=[Card or Pass]`

Optional parameters supported by MoneyGoWhere:

- `date=YYYY-MM-DD`
- `time=HH:MM`
- `hint=<category hint>`

If date/time are omitted, MoneyGoWhere uses the device's current local date/time when the automation opens the app. This is appropriate when the Wallet automation runs immediately.

## What MoneyGoWhere does

- Prefills merchant, amount, Apple Pay payment method and card/payment source.
- Detects supported online platforms such as Shopee, TikTok Shop, Lazada, Amazon, Qoo10 and Carousell.
- Suggests a spending category using local merchant/keyword rules.
- Shows a confidence score when a category is suggested.
- Requires review before saving.
- Checks same-day merchant + amount for a possible duplicate before opening the entry form.
- Stores payment source separately from spending category.

## Privacy

The bridge does not read Apple Wallet directly. It only receives the values the Shortcut explicitly passes in the URL. Do not pass full card numbers, security codes, banking credentials or other secrets.

## Existing Numbers log

Keep the current `ApplePay_Expenses_2026` / `Expenses_Log` action. This provides an independent transaction trail even if MoneyGoWhere is closed or a transaction is not saved after review.
