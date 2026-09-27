# MoneyGoWhere Apple Pay File Inbox — Dev

This flow avoids opening Safari after every Apple Pay transaction.

## Shortcut flow

1. In Shortcuts, edit the **Transaction** personal automation for Apple Pay.
2. Remove the **Open URLs** action.
3. Keep any independent Numbers logging action if you want it.
4. Add a **Text** action with this structure:

MGW-APPLEPAY
date=[Formatted Current Date]
time=[Formatted Current Time]
merchant=[Merchant]
amount=[Amount]
card=[Card or Pass]
currency=SGD

5. Add **Save File** and save each transaction into an iCloud Drive folder such as `Shortcuts/MoneyGoWhere/ApplePayInbox`.
6. Turn **Ask Where to Save** off.
7. Use a unique file name, for example `MGW-[yyyyMMdd-HHmmss].txt`.
8. Optionally add **Show Notification** with `Saved to MoneyGoWhere Inbox`.

No MoneyGoWhere URL is opened by this flow.

## Import into MoneyGoWhere

When you next open MoneyGoWhere, go to **Add → Pending Imports** and tap **Import Apple Pay Inbox**. Select one or more saved `.txt` or `.json` files. They are added to the local review queue and do not become expenses until you accept and categorise them.

The existing URL receiver remains available as a legacy fallback, but it will still open a browser on iOS.

## Privacy

Do not put full card numbers, CVV/security codes or banking credentials in the file. A card nickname or last four digits is enough.