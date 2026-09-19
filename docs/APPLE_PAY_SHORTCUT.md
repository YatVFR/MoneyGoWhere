# MoneyGoWhere Apple Wallet Shortcut Bridge — Legacy URL Flow

This is the older Apple Pay handoff method. It opens an HTTPS URL after a transaction, so iOS normally launches Safari rather than the Home Screen-installed MoneyGoWhere web app.

For the recommended browser-free workflow, use **APPLE_PAY_FILE_INBOX.md** instead. The Transaction automation saves a small local/iCloud inbox file and MoneyGoWhere imports it later into Pending Imports.

## Legacy automation setup

1. Open **Shortcuts → Automation**.
2. Create or edit **Transaction**.
3. Under **When I tap**, select every Apple Pay card that should send transactions to MoneyGoWhere.
4. Make sure the automation is enabled and configured to run automatically / immediately rather than waiting for confirmation.
5. Keep the existing **Add Row to Numbers** action if you want the independent backup log.
6. Add a **Text** action containing the MoneyGoWhere Dev URL below. Insert the Transaction trigger's Merchant, Amount and Card/Pass magic variables into the matching positions.
7. Pass that Text to a **URL** action, then add **Open URLs**.

## Legacy Dev receiver URL

`https://yatvfr.github.io/MoneyGoWhere/dev/?mgw=applepay&merchant=[Merchant]&amount=[Amount]&card=[Card or Pass]`

Optional parameters: `date`, `time`, `currency`, `sourceId`, and `hint`.

## Limitation

Because this uses **Open URLs**, iOS may launch Safari. MoneyGoWhere cannot force an HTTPS Shortcut action to target the installed Home Screen web app.

## Privacy

Do not pass full card numbers, CVV/security codes, banking credentials or other secrets. A card nickname or last four digits is enough.