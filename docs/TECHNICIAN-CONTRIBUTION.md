# Technician Contribution: live year-end bonus estimate

Only the signed-in employee’s aggregate contribution is shown on My Time &
Profile. Teammate directory cards do not expose time, pay, or contribution.

## Basis and formula

- **Accrual · logged work** is the default. It uses eligible work-order labor
  when logged, before invoice issuance or payment. It is a work projection,
  not the general ledger's accrual accounting.
- **Cash · invoiced work** is BCI’s billed-work view, not cash receipts. It
  counts work linked to a recorded invoice, including unpaid invoices, and
  excludes unbilled work. Grouped invoices use their stored labor lines;
  standalone QuickBooks references use the locked work-order labor. Costs
  use the wage in effect for the same hours. Both views group by the labor
  work date; the toggle does not initiate any QuickBooks sync.

For each eligible customer labor line linked to the employee, calculate:

1. Labor revenue = hours × recorded customer labor rate.
2. Loaded employment cost = those same hours × wage effective on the work date
   × 1.25. The 25% allowance estimates taxes, workers’ comp and office costs.
3. Pretax labor profit = revenue − loaded cost. Project losses offset gains.
4. Estimated tax reserve = 30% of positive year-to-date labor profit. A loss
   produces no reserve. This is a planning assumption, not actual tax.
5. Year-end bonus estimate = the configured share of positive labor profit
   after the reserve. The standard share is 5%; an explicit 0% remains 0%.
   No negative bonus, payroll write or payout is made.

Travel, materials, internal work and leave are not inputs. Missing wage history,
ambiguous time rows, and relevant scoped-out work withhold a complete estimate.
The chart allocates the estimated annual reserve across profitable projects
so that project amounts and signed losses reconcile to the annual total.

## Administration and target date

In **My Time & Profile → Staff profiles → Edit staff profile**, record wage
history and any employee/year-specific percentage. Historical work uses the
wage in effect on its work date, not a newer wage projected backwards. Bonus
year uses Eastern work dates. Target: the Friday nearest December 15
(December 18 in 2026). The projection is not locked on that date.

## Staging example

Log 10 synthetic customer labor hours at $140/hour with a $35 hourly wage and
5% bonus share. Expect $1,400.00 revenue, $437.50 employment cost, $962.50
pretax labor profit, $288.75 reserve, $673.75 after reserve and $33.69 bonus.
Cash starts at $0. Record a valid invoice and confirm it counts even when
payment is zero. A later payment does not change either view. Add qualifying work before invoicing
and confirm the live amount updates. Travel, parts, internal work and leave
must not change the estimate. Verify custom Profile Studio styling applies to
both live cards and remains after periodic refresh or reload.
