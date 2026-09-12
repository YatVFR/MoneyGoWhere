# MoneyGoWhere Apple Wallet Shortcut Bridge — Dev

MoneyGoWhere does not read Apple Wallet directly. The iPhone **Transaction** personal automation is the trigger; it passes the Wallet transaction to the MoneyGoWhere Dev URL.

## Required automation setup

1. Open **Shortcuts → Automation**.
2. Create or edit **Transaction**.
3. Under **When I tap**, select every Apple Pay card that should send transactions to MoneyGoWhere.
4. Make sure the automation is **enabled** and configured to run automatically / immediately rather than waiting for confirmation.
5. Keep the existing **Add Row to Numbers** action if you want the independent backup log.
6. Add a **Text** action containing the MoneyGoWhere Dev URL below. Insert the Transaction trigger's Merchant, Amount and Card/Pass magic variables into the matching positions.
7. Pass that Text to a **URL** action, then add **Open URLs**.

## Dev receiver URL

`https://yatvfr.github.io/MoneyGoWhere/dev/?mgw=applepay&merchant=[Merchant]&amount=[Amount]&card=[Card or Pass]`

Optional parameters:

- `date=YYYY-MM-DD`
- `time=HH:MM`
- `currency=SGD`
- `sourceId=<unique transaction id>`
- `hint=<category hint>`

If Merchant or Card can contain spaces, `&`, `#` or other special characters, URL-encode those values before inserting them into the URL.

## Receiver test

Open this URL directly in Safari to test MoneyGoWhere without making a payment:

`https://yatvfr.github.io/MoneyGoWhere/dev/?mgw=applepay&merchant=MGWTEST&amount=1.23&card=TEST`

Expected result: MoneyGoWhere opens and the transaction appears in **Add New → Pending Imports**.

## Important troubleshooting

If the direct test works but a real Apple Pay transaction does not launch MoneyGoWhere, the web receiver is working and the problem is the iOS Transaction automation. Check that the correct card is selected, the automation is enabled, and automatic/immediate running is allowed. Personal automations are device-specific, so recreate the Transaction automation on the current iPhone if necessary.

## Privacy

Do not pass full card numbers, CVV/security codes, banking credentials or other secrets in the URL. A card nickname or last four digits is enough for MoneyGoWhere.