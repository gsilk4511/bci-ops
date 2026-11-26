# Staff setup and time review (.7.5)
1. Add each employee through the existing Team access flow. Ask staff to open **My Time & Profile** and set their display name and contact email. The contact email is not the Cloudflare sign-in.
2. As admin, open **My Time & Profile → Staff profiles** to enter pay scale and opening available vacation and sick hours. Staff can see their own values and cannot change them. Verify the opening balances against your payroll records before approving the first request; this does not calculate accrued leave.
3. A staff member uses **Add Time Off** for vacation or sick leave. Pending hours do not touch the balance. Admins review requests in the same area. Approval records one payroll-preview entry and deducts once from the applicable available balance. The app will not approve leave into a finalized pay period; handle that correction with payroll.
4. Create or verify exactly one **BCI ELITE ADMIN** project under the **Randy Bevins** billing client. When that record exists, staff with work-order creation access can use **+ New Internal Work Order**. Create one order for each distinct truck, inventory, shop or office task, and log multiple sessions on that order. Internal work is still employee work time, but must not appear on customer invoices.
5. Staff filter **My Time** by week or pay-period dates and follow linked orders. Older entries with no trusted employee identifier are not automatically assigned by a name guess. Review those using the existing payroll and order history before reconciling a period.

The pay scale field is a profile reference, not a gross pay calculation. QuickBooks remains the payroll processor. The staging app does not change payroll rates or post payroll externally.

## Live five-week profile

The private **My last five weeks** panel shows the current workweek and the previous four.
Work-order labor, travel and retained applicable payroll time feed Worked; PTO, Sick and Holiday
have separate columns. Shared travel remains employee time even when the customer travel charge
is zero. Pending leave is reported separately, not counted; approved requests count via their
payroll record, which avoids counting the same leave twice. A running clock is not posted time.

An admin opens **My Time & Profile → Set profile workweek** to confirm the first weekday
used in the established BCI payroll schedule. Until then, the screen groups dates Monday–Sunday
and does not display a Regular or Overtime estimate. The split uses a 40-worked-hour threshold
once configured. It does not set payroll dates, change overtime input, or amend an approved
payroll snapshot. The time status column says whether logged time falls inside a finalized
period, not whether each current row was part of the original payout. Keep payroll exceptions
and corrections in the existing review process.

For **Payroll → Log shop time or leave**, enter the employee’s existing Team sign-in email so the
row is attributed even if their display name changes. Use **Reconcile employee time** for historical
name-only records instead of assuming identities. The current staff tab refreshes summaries every
30 seconds while visible and on returning to the tab. No employee schedules or payroll payments
are created by this feature.
