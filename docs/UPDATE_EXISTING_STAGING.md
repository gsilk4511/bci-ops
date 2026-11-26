# Update existing BCI Operations staging to 0.10.3

## Greg: use the existing staging stack

1. Back up the existing source and MariaDB staging database first.
2. Extract the ZIP once. It has exactly one top-level `source/` folder.
   Copy **the contents** of that folder into the existing source directory;
   do not put the new folder inside the old one.
3. Keep Greg's existing `compose.bci-operations-fixed.yml`, `.env.secure`,
   `mariadb.env`, MariaDB database name, named volume, bridge, and service
   hostname `db`. Do not replace these with bundled examples.
4. Confirm the app build context points to the updated source. In the active
   Compose file, change the app image tag to `bci-operations:0.10.3`. Do not
   change the database service. Use the actual app service name if different.

From the deployment directory:

```sh
docker compose -f compose.bci-operations-fixed.yml config --quiet
docker compose -f compose.bci-operations-fixed.yml up -d --build --no-deps --force-recreate bci-operations
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
```

Recreate by itself does not build a new image. Verify `0.10.3` in the health
response and beside the BCI logo. For the default-off install no SQL migration, reimport or reseed is needed. To test optional User Security separately, follow USER_SECURITY.md.
If you roll back, restore the previous source, restore its former image tag
and rebuild only the app. Keep the database and its volume in place.

## Randy: test technician contribution and bonus projection

Use only synthetic work orders, employee accounts and financial inputs in
staging. See TECHNICIAN-CONTRIBUTION.md for the work-time, wage and attribution rules.
Confirm that standard staff cannot edit percentages or wages, or view
anyone else’s results. No payout action is included.

## Randy: test the staff theme

Pick a nondefault section color, text color and lighting in Profile Studio.
Save, reload and check the heading, My Profile panel, time and leave panels,
Business Manager if permitted, and the staff charts. The individual profile
card and coworker cards keep their existing appearance. Open another app
screen and confirm the staff theme does not follow you there.

## Randy: test Profile Studio

See PROFILE-STUDIO.md. Check the edit preview, saved look after reload, a
coworker's internal profile, and the icon on linked work-order entries.
Confirm the client printout is unchanged. A staff member can edit their
own profile if they already have the Customize own staff profile grant.

## Randy: set up Business Manager access

See BUSINESS-MANAGER.md for access setup and a fleet-and-bills smoke test.
Installing the update does not change Leslie’s account or permissions.

## Randy: smoke-test with two staff logins before promoting

- My Time & Profile: change your About text, link and photo, then reload. Test
  removing the photo and confirm that clock and leave forms still work.
- Sign in under a different test profile. The directory should show only
  the first employee's display name, picture, About and shared links, not
  their login, pay, leave, work history or contribution.
- Verify the work-order/project counts against entries from the same user,
  remembering that historical time without an employee account link isn't
  attributed. Cross-check a test invoice with documented time distribution.
- Verify the three charts and private bonus estimate. Missing wage history
  or unavailable invoice evidence must not produce a fabricated bonus.

## Verify 0.9.8 before promoting

1. On a synthetic completed/reviewed/invoiced work order, use Edit notes in Original field journal. Print Work Order should display the changed note; the issued invoice should remain unchanged.
2. Record normal travel for the driver and shared travel for another signed-in employee. Both hours should appear in the journal and payroll review; only normal travel appears as a charge on the invoice.
3. Grant Vehicles visibility and management via Leslie's intended custom profile (no account changes are included). Verify a fleet-only test profile can manage vehicles but cannot open Business Manager bills, payroll, or another employee’s private profile data. If using an existing custom profile, preserve unrelated grants and do not edit a shared profile accidentally.
4. Verify existing vehicle records are present in Vehicles. Add or edit a photo and schedule inspection and registration dates without needing mileage. Test an oil-change mileage target independently of its date. Future due dates do not schedule calendar appointments or create service history; Record Service is for completed work only.
5. On a phone-width viewport check the first and last authorized tab labels are fully legible and reachable by sideways scrolling. The main page should not scroll horizontally.

## Randy: test the Pricing page
- Confirm Billing clients starts closed. Expand it, search, and use Next and Previous on a list with more than ten matches.
- Expand Base catalog rates and existing pricing rules. Labor includes travel; Parts is separate. Search, sort and change the page size independently.
- Open New profile or Edit. With synthetic staging data, edit one rule on each of two pages, sort or search, then Preview. Both changes must appear. Save and reopen to confirm both. Check that prior rates, assignments, and issued invoices are unchanged outside the intended staging edits.

## Optional BCI Sign-In staging pilot

This package still ships with the separate BCI sign-in feature and SMTP off. Do not activate
for live users or remove Cloudflare. See APP_SIGNIN.md for the pilot,
account-retention checks, recovery and rollback.

## Employee time reconciliation

No new SQL migration or account rewrite. Follow TIME_ATTRIBUTION.md for the
preview, exact selection, open-payroll verification and rollback safeguards.

## Correct a work-order service (0.9.8)
On an editable work order, select **Edit Work Order**, then **Edit** beside
the employee’s labor or travel row in the Original field journal. Select the
correct **Service type**, then save. For example, switch Cable Technician to
Conduit Helper if that hourly service has been configured in Services/Pricing.
Hours, date, employee, and timestamps stay the same if left unchanged; the
app recalculates the rate and total using the configured pricing. Submitted
orders return for review. Verify a normal order and any signed change-order
example in isolated staging before deploying. Do not edit issued invoices
or time in approved payroll; those are still locked. No new SQL migration.

## Undo a closeout from its review ticket (0.9.8)
Open the submitted work-order ticket in **Tickets**, then select **Undo
Closeout** and enter what remains to be done. Eligible submitted or reviewed,
uninvoiced work orders return to **Released**. The current completion clears;
the original closeout, reason, time, notes, materials, receipts and stock
history remain. After the crew finishes, resubmit from the work order and
verify the same ticket returns to **Ready for review**. Find already reviewed
tickets in the completed-ticket view. This action is not available for orders
linked to an invoice or containing time in approved payroll.

## Log Materials grid (0.9.9)
From a released work order, open **Log Materials** on a phone. Confirm that
the first page shows up to ten directly selectable parts and no part dropdown
or recommendation cards. Search by name/SKU, use category/type/brand filters,
and use Next/Previous 10. The selected item and units remain visible below the
grid while browsing. Switching approved work scope clears an out-of-scope
selection. Verify quantity, stock projection, existing receipt flow, and the
exact selected item in the resulting field journal. No new SQL migration.

## Fleet and live staff summary (0.10.0)

Use an isolated staging database and sample documents first. Give the person managing the fleet Vehicles View and Manage. Give a driver Vehicles View only if they should use the fleet screen; assign the vehicle and/or cleaning task to their existing Team account. Confirm that an unassigned reader cannot download document files, and that an assigned driver can read insurance, registration and inspection documents on their vehicle but cannot read DMV / restricted uploads or edit the fleet. Restricted documents are kept in application database state, not in the public folder. Protect database backups accordingly. Files are downloaded as attachments; PDFs, JPEGs and PNGs up to 350 KB each; 12 files per vehicle and approximately 2.8 MB of encoded data fleet-wide. Upload only actual fleet paperwork; use DMV / restricted for verification letters, never upload credentials.

- Check that a legacy vehicle keeps its notes after entering model year. Add an inspection month and a separate registration date, then book and reschedule the inspection. The deadline stays the same. Bookings and notices are in-app only; there is no calendar sync.
- Log oil service on a date and mileage with a recurring interval, then confirm the next due thresholds. Set a cleanup recurrence and assignment, and mark it done as that assigned driver. Check tire set A across 40,000 mount, 46,000 remove, 52,000 reinstall and 53,000 current: 7,000 miles on set A, not 13,000. Rotate tires and add a backdated service entry; neither resets the set or replaces the newest reading.
- Set the actual first day of the payroll workweek in My Time & Profile before relying on the Regular/Overtime projection. Review actual compensability/coverage and payroll rules separately. With synthetic data only, compare the current plus four prior weeks as the employee and a different employee. Test 40 onsite hours plus seven compensable job-to-job travel hours and eight unworked holiday hours: 40 regular, seven overtime, eight holiday under those fixture assumptions. A shared billing flag does not remove employee hours.
- Confirm that verified qualifying work-order labor appears in the private bonus estimate before an invoice exists and stays when an invoice is unpaid. Correct an eligible entry and confirm the projection refreshes without changing locked payroll. There is no payout, payroll approval or invoice write from this screen.

## Compact fleet layout and profile customization (0.10.1)

Open Vehicles on desktop and phone. Confirm the default board shows the whole compact card as a tap target and does not show VIN, notes or service actions. Verify the Overdue and Due now / soon counts and filters. Open a result and check the header and the Maintenance & Cleaning, Tires, Documents and Service History sections. Use Back to Fleet to check the old filter and scroll position.

As a fleet manager, use Customize profile to preview and save a different banner, lighting, photo trim, section color and text color. Confirm the appearance on both the vehicle profile and corresponding card after refreshing. Check that the photo, schedules, documents and permissions are intact. A reader cannot customize or edit. This build does not require a data import or migration; do not copy a sample database over staging.

## Money tab (0.10.2)

In staging, use one project containing an open work order with logged amounts, a completed order with no invoice, and a separate already-invoiced order. In Money, open and completed unbilled work should appear in the same project total. Under test conditions only, record a QuickBooks reference for the eligible completed order and confirm that exactly its amount comes out of Unbilled. Keep open work present and confirm a project-level deposit does not mark every work order billed. Verify the customer and billing-status filters and exercise a finance role with restricted access. This is a read-only reporting change; it does not add QuickBooks sync, alter the closeout process, or create invoices automatically.

## Dashboard and account controls (0.10.3)

See [Dashboard](DASHBOARD.md) for the layout acceptance steps. Use sample accounts only when exercising removal. Confirm Sign out works in the actual Cloudflare and app sign-in modes in use, and test keyboard/phone access. Do not remove a real account for staging verification. Preserve configured recovery administrators and existing access settings.
