// MoneyGoWhere finance model compatibility fix.
// In the legacy finance sheet, netSalary already represents total take-home pay
// for the month, including the net effect of bonus/one-off payments.
// Keep bonus and oneOff as separate analytics fields without adding them twice
// to dashboard net income.
if (typeof totals === 'function') {
  totals = function(d) {
    const ex = sum(monthExpenses(d));
    const inc = monthIncome(d);
    const net = inc.reduce((t, x) => t + (Number(x.netSalary) || 0), 0);
    return { ex, net };
  };
  if (typeof renderAll === 'function') renderAll();
}
