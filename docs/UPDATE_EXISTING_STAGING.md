# Update existing BCI Operations staging to 0.9.4

## Greg: use the existing staging stack

1. Back up the existing source and MariaDB staging database first.
2. Extract the ZIP once. It has exactly one top-level `source/` folder.
   Copy **the contents** of that folder into the existing source directory;
   do not put the new folder inside the old one.
3. Keep Greg's existing `compose.bci-operations-fixed.yml`, `.env.secure`,
   `mariadb.env`, MariaDB database name, named volume, bridge, and service
   hostname `db`. Do not replace these with bundled examples.
4. Confirm the app build context points to the updated source. In the active
   Compose file, change the app image tag to `bci-operations:0.9.4`. Do not
   change the database service. Use the actual app service name if different.

From the deployment directory:

```sh
docker compose -f compose.bci-operations-fixed.yml config --quiet
docker compose -f compose.bci-operations-fixed.yml up -d --build --no-deps --force-recreate bci-operations
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
```

Recreate by itself does not build a new image. Verify `0.9.4` in the health
response and beside the BCI logo. No SQL migration, reimport or reseed.
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

## Verify 0.9.4 before promoting

1. On a synthetic completed/reviewed/invoiced work order, use Edit notes in Original field journal. Print Work Order should display the changed note; the issued invoice should remain unchanged.
2. Record normal travel for the driver and shared travel for another signed-in employee. Both hours should appear in the journal and payroll review; only normal travel appears as a charge on the invoice.
3. Grant Vehicles visibility and management via Leslie's intended custom profile (no account changes are included). Verify a fleet-only test profile can manage vehicles but cannot open Business Manager bills, payroll, or another employee’s private profile data. If using an existing custom profile, preserve unrelated grants and do not edit a shared profile accidentally.
4. Verify existing vehicle records are present in Vehicles. Add or edit a photo and schedule inspection and registration dates without needing mileage. Test an oil-change mileage target independently of its date. Future due dates do not schedule calendar appointments or create service history; Record Service is for completed work only.
5. On a phone-width viewport check the first and last authorized tab labels are fully legible and reachable by sideways scrolling. The main page should not scroll horizontally.

## Randy: test the Pricing page
- Confirm Billing clients starts closed. Expand it, search, and use Next and Previous on a list with more than ten matches.
- Expand Base catalog rates and existing pricing rules. Labor includes travel; Parts is separate. Search, sort and change the page size independently.
- Open New profile or Edit. With synthetic staging data, edit one rule on each of two pages, sort or search, then Preview. Both changes must appear. Save and reopen to confirm both. Check that prior rates, assignments, and issued invoices are unchanged outside the intended staging edits.
