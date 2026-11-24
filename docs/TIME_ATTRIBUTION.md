# Reconcile employee time · 0.9.7

This is an administrator action, not a background merge or a login migration.
Installing the release changes no employee time. Test on backed-up staging
using approved synthetic rows before touching actual payroll.

1. Open **Team → Reconcile employee time**, or **Payroll → Review → Reconcile
   employee time** as an administrator. Choose **Exact historical name** for
   name-only records or **Exact legacy email** for a verified old address.
   The name mode will not include a time record already linked to a different
   email, even if its displayed name matches.
2. Choose the current active Team account and enter the exact legacy value.
   Narrow by time period or specific row ID if the name might be shared.
   Preview includes the matching rows, dates, work orders, categories, hours,
   and any dates in already approved pay periods. Batches over 200 require
   smaller date windows. Clear any running timers for the selected identities.
3. Verify that every row belongs to the intended person. Add a reason and
   type the displayed `REASSIGN N` phrase. A stale change rejects the batch;
   run a fresh preview. The correction logs who did it and what moved. Nothing
   changes a login, permissions, staff profile, wage rate, job charge, time
   interval, work order closeout, invoice, or prior approved payroll snapshot.
4. **Run Payroll Review again before choosing Approve and lock period.** A
   saved old review is invalidated after correction. A new review groups
   corrected entries under the verified current email. Compare refreshed
   overtime and any downstream payroll or projected bonus amounts; employee
   grouping may change those values even though raw hours, rates, and costs
   are not edited. Overlapping time and
   duplicate entry IDs are flagged by Payroll Review and block approval;
   the tool does not delete or deduplicate those times. Different labels are
   not themselves proof of anyone's ownership. Unconfirmed labels remain
   separate and don't automatically block approval; review them manually.
5. If a past approved pay period appears in the preview, the correction
   updates current ownership and My Time only. The approved report and any
   export/disbursement stay as recorded. If a financial/payroll correction is
   needed, route it through the office’s normal payroll process separately.

For the reported Simon example, choose historical name `Simon` and active
`simon.m@bcielite.tech`; preview the intended period before applying. On those
two screenshot rows only, the expected combined current review is 33.00 work
hours + 12.50 travel hours = 45.50. Leave any separate addresses and other
staff labels alone unless independently confirmed. This release does not
claim to have changed any production account or records.

Keep verified backups before corrections. Rolling software back removes the
new controls and interpretation but does not reverse saved corrections or
restore pay records. If an attribution is wrong, stop before payroll approval
and have Greg review the audit and planned correction; do not restore an old
whole database over unrelated new work.
