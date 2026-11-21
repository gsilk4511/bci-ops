# Update existing BCI Operations staging to 0.8.8

## Greg: use the existing staging stack

1. Back up the existing source and MariaDB staging database first.
2. Extract the ZIP once. It has exactly one top-level `source/` folder.
   Copy **the contents** of that folder into the existing source directory;
   do not put the new folder inside the old one.
3. Keep Greg's existing `compose.bci-operations-fixed.yml`, `.env.secure`,
   `mariadb.env`, MariaDB database name, named volume, bridge, and service
   hostname `db`. Do not replace these with bundled examples.
4. Confirm the app build context points to the updated source. In the active
   Compose file, change the app image tag to `bci-operations:0.8.8`. Do not
   change the database service. Use the actual app service name if different.

From the deployment directory:

```sh
docker compose -f compose.bci-operations-fixed.yml config --quiet
docker compose -f compose.bci-operations-fixed.yml up -d --build --no-deps --force-recreate bci-operations
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
```

Recreate by itself does not build a new image. Verify `0.8.8` in the health
response and beside the BCI logo. No SQL migration, reimport or reseed.
If you roll back, restore the previous source, restore its former image tag
and rebuild only the app. Keep the database and its volume in place.

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
- Verify Profit and Employment cost are labeled but not populated. No bonus
  payout is calculated. See TECHNICIAN-CONTRIBUTION.md for coverage details.
