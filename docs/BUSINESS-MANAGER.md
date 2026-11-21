# Business Manager
Open **My Time & Profile** to see the Business Manager section if you have
access. It tracks the company's vehicle and bill due dates separately from
personal profiles, payroll, customer invoices, and QuickBooks.

## Randy: grant staging access to Leslie

1. In **Team → Teammates**, find Leslie's existing account and
   open **View effective access**. Note the access she already needs.
2. Under **Saved access levels**, use **+ Profile** to create a dedicated
   **Business Manager** profile. Enable **My Time and staff profiles** and
   set **Business Manager** to **Read & write**. Keep the regular Manage
   action selected. Use **Read only** for someone who should see but not edit
   records. Leave unrelated grants off unless Leslie already needs them.
3. A custom profile replaces the user's previous permission set; it does
   not stack with it. Copy across any of Leslie's existing required grants
   and record scopes deliberately before switching. Do not widen a shared
   access profile unless everyone assigned to it should see the tracker.
4. Edit Leslie's existing teammate row and select the new saved profile
   under **Access level**. Verify her effective access and smoke-test her login.
   Do not change Cloudflare, login enrollment, finance, or payroll just to
   enable the tracker. An administrator already has access for verification.

## Staging smoke test

- Add two test vehicles with different registration deadlines. Add an oil
  change deadline (and mileage when known). Make one deadline overdue and
  one upcoming so they can be distinguished.
- Record service or renewal; verify that the completed occurrence is visible
  and the next deadline does not overwrite the other vehicle's schedule.
- Enter a test utility bill and mark that bill complete. Verify that other
  bills remain open and the completed bill stays visible in history.
- Sign in as ordinary staff and verify the Business Manager section and
  its data are not available. Test a read-only profile cannot save changes.

Recording a paid bill or a vehicle service records what happened. It
does not pay the bill, renew registration with the state, contact a
vendor, send an alert, or modify QuickBooks. Use the dashboard to review
deadlines until a separate reminder integration is requested.
