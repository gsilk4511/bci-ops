# Technician Contribution: work-time bonus estimate

My Time & Profile shows a private project breakdown and a year-to-date
estimate. It is not an accounting ledger, cash receipts, payroll, a final
bonus, or the company's net profit.

## Formula

For each supported billed work-labor line linked to the employee:

1. **Labor revenue** = recorded invoiced work hours × the recorded rate
   charged to the client on that line.
2. **Loaded employment cost** = those work hours × the employee's hourly
   wage effective on the work date × 1.25. The 25% is a flat allowance for
   taxes, workers' compensation and office costs; not an actual expense figure.
3. **Labor profit** = labor revenue minus loaded employment cost.
4. **Bonus estimate** = 5% of positive year-to-date labor profit, unless an
   admin set a different employee-specific rate for this bonus year. Losses
   on eligible work reduce the annual result before the zero floor. No
   negative bonus or deduction is made.

Parts, travel, vacation, sick leave and other nonbillable time are not inputs.
Taking leave does not subtract from the meter or change payroll or leave
balances. A better client rate on eligible work can increase labor margin
without anyone needing to forgo vacation.

Use only sent/paid, reviewed invoices with verified labor evidence. For a
standalone invoice, the frozen reviewed labor must exactly match the linked
work entries. Voids,
duplicate billing references, and internal non-client work are not counted.
No matching from employee display names or use of a catalog cost as wages.
Missing wages, unavailable or ambiguous invoice rows, and relevant scoped
records prevent a complete bonus projection. No manual job cost entries
from 0.9.0 are used by this method.

## Admin setup

In **My Time & Profile → Staff profiles → Edit**, use the same form as
vacation and sick balances to record the hourly wage, effective date and
annual profit-share percentage. Add a new wage entry when the wage changes.
For work before the earliest recorded wage, record the correct earlier
wage instead of extending a newer rate backwards. No annual override
means 5%. An explicit 0% is a configured zero, not the default.

## Year and date

The app groups invoiced work by the Eastern calendar year of the recorded
sent invoice. The Friday nearest December 15 is the bonus target; in 2026
it is December 18. The projection is not locked on that date. Decide
separately how to handle late-December invoices or adjustments before
processing payroll. The app neither sends a payment nor edits payroll.

## Staging verification

Use a synthetic labor line: 10 hours billed at $140/hour and wage of $35/hour.
Expect $1,400 labor revenue, $437.50 loaded cost, $962.50 labor profit, and
a $48.13 bonus projection at 5% (rounded to cents). Add travel, parts and PTO
entries; all four amounts must stay the same. Verify a later wage change
doesn't affect earlier work. Test a missing historical wage, a scoped-out
eligible job, a rate override of 0%, and ordinary staff access boundaries.
