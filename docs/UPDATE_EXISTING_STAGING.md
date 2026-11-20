# Update an existing BCI Operations staging installation

1. Back up the current source directory and the MariaDB staging database.
2. Extract the release and copy its source files into the existing application
   source directory. Keep both existing environment files (.env.secure and mariadb.env). Check that DB_NAME is
   bci_operations_stage before rebuilding.
3. With Greg overseeing terminal work, build and start the matching release from
   the source directory. Use Greg's active gcccluster1 Compose file (known as
   `compose.bci-operations-fixed.yml`), not the bundled examples or the legacy
   Unraid file. Confirm its build context is the existing source directory,
   then change only the app image tag to `bci-operations:0.8.6-catalog.3`.
   Keep the database service, volume, environment and networking in place.
   Run the commands from the deployment directory containing the active
   Compose file. If the app service name differs, substitute its actual name.
   Recreate alone uses the previously built image; rebuild the app service.

```sh
docker compose -f compose.bci-operations-fixed.yml config --quiet
docker compose -f compose.bci-operations-fixed.yml up -d --build --no-deps --force-recreate bci-operations
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
```

Expect the release in `package.json` (`0.8.6-catalog.3`) and storage
`mariadb`. Reload and check that the same version appears beside the BCI logo
on desktop and phone. This update needs no SQL migration or reseed.

For each new patch release, bump `package.json` and match the active app image tag and both Compose example image
tags. The header badge and `/api/health` both read the package version; do not
edit the HTML placeholder. Run `npm test` to check that deployment tags agree.

No catalog re-import is required. To verify this specific fix, open a short and
a multi-page work order from an admin account and use the work order's Print
button, then Print / Save PDF (Letter). Check that the journal header repeats,
ordinary two-row entries are intact, work descriptions span the full width,
amounts are readable, and the client copy has no
Direct job cost or Estimated gross profit. Both figures should remain visible
on the internal screen for users with finance access. Use the work order Print
button rather than printing the live app screen.

Sign in with your administrator and technician test accounts. Check module
visibility and run the Training walkthrough. Verify a printed invoice in
Chrome with browser headers and footers disabled. Existing custom profiles
need the desired new module grants. Microsoft 365 intake and phone delivery
require the setup and live checks in EMAIL_AND_NOTIFICATIONS.md.

If the build fails, restore the previous source package and rebuild that
version using the existing staging database configuration.
