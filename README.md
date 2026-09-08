# MoneyGoWhere 💸

**Your money. Your spending. Now you know where.**

MoneyGoWhere (MGW) is a clean, mobile-first personal finance web app focused on answering a simple question: **where did my money go?**

## Version 1 Scope

### Dashboard
- Separate, simplified monthly dashboard
- Net income, monthly spending, budget used and remaining amount
- Clear budget-health indicator
- Almost-over-budget and exceeded-budget alerts
- Top spending categories for the selected month

### Expense Tracking
Initial categories:
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
- Other

Vehicle/bike maintenance tracking is intentionally excluded because it is already handled by FuelTracker.

### Receipt-assisted Entry
Users can take or upload a receipt photo. The app should extract, where available:
- Date
- Time
- Vendor
- Location
- Total amount
- Currency

The **spending category is selected by the user** before saving. All extracted values must remain editable before confirmation.

### Budget Monitoring
- Overall monthly budget
- Optional category budgets
- Warning states as spending approaches the limit
- Budget exceeded state

Initial thresholds:
- Healthy: below 80%
- Watch: 80–89%
- Almost over budget: 90–99%
- Exceeded: 100%+

### Spending Insights
Compare spending across:
- Current month
- Previous month
- 6 months
- 12 months

Highlight:
- Highest-spending category
- Category totals and share of spending
- Change from previous month
- Difference from 6-month average
- Difference from 12-month average

### Income Insights
Track separately:
- Base salary
- Net salary
- Bonus
- One-off payments

Visualise:
- Salary trend
- Bonus history
- Salary growth
- Month/year comparisons

## UX / Theme
- Clean, fresh and mobile-first
- Light background and spacious cards
- Rounded UI components
- Consistent section/category icons
- Minimal visual clutter
- Icons used for quick recognition rather than decoration
- Bottom navigation: Dashboard, Add, Insights, Settings
- Prominent Add action: Scan Receipt, Manual Expense, Add Income

## Initial Data Model

Core datasets:
- `income`
- `expenses`
- `budgets`
- `settings`

Example expense:

```json
{
  "id": "EXP-20260908-001",
  "date": "2026-09-08",
  "time": "19:42",
  "vendor": "NTUC FairPrice",
  "location": "Tampines Mall",
  "category": "Groceries",
  "amount": 86.40,
  "currency": "SGD",
  "notes": "",
  "source": "receipt_scan"
}
```

## Development Principle

> Open MoneyGoWhere and understand the financial month within 10 seconds.

Version 1 should remain deliberately simple. Enhancements will be added incrementally after the core dashboard, expense capture, budgeting and insights workflows are stable.
