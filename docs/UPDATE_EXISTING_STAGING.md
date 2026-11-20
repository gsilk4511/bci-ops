# Update an existing BCI Operations staging installation

1. Back up the current source directory and the MariaDB staging database.
2. Extract the release and copy its source files into the existing application
   source directory. Keep both existing environment files (.env.secure and mariadb.env). Check that DB_NAME is
   bci_operations_stage before rebuilding.
3. With Greg overseeing terminal work, build and start the matching release from
   the source directory. Use Greg's active gcccluster1 Compose file (known as
   `compose.bci-operations-fixed.yml`), not the bundled examples or the legacy
   Unraid file. Confirm its build context is the existing source directory,
   then change only the app image tag to `bci-operations:0.8.6-catalog.6`.
   Keep the database service, volume, environment and networking in place.
   Run the commands from the deployment directory containing the active
   Compose file. If the app service name differs, substitute its actual name.
   Recreate alone uses the previously built image; rebuild the app service.

```sh
docker compose -f compose.bci-operations-fixed.yml config --quiet
docker compose -f compose.bci-operations-fixed.yml up -d --build --no-deps --force-recreate bci-operations
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
```

Expect the release in `package.json` (`0.8.6-catalog.6`) and storage
`mariadb`. Reload and check that the same version appears beside the BCI logo
on desktop and phone. This update needs no SQL migration or reseed.

For each new patch release, bump `package.json` and match the active app image tag and both Compose example image
tags. The header badge and `/api/health` both read the package version; do not
edit the HTML placeholder. Run `npm test` to check that deployment tags agree.

No catalog re-import is required. In staging, open Admin → Changelog as an
administrator, open Read more and return to the list. Verify a staff account
cannot open the page or its endpoint. In Warehouse verify known and missing
Color / Finish and try the color filter and Log Materials search. Then combine search
and Brand/Category/Type filters, then save a small test count with a reason
and verify its delta under Activity. Change test unit pricing separately and
verify its readback. Use a test work order to confirm new material moves are
attributed to BCI Warehouse. Receive a small test quantity with a sample
receipt photo. Log a separate field purchase on a test work order. In Activity,
view the photo and commit the linked purchase; verify that a repeat attempt
does not add stock again. Old locations are historical records, not part
of the warehouse count. Compare those balances with a physical count before
reconciling them; this build does not merge stock from existing locations.

The release also retains the preceding work-order print fixes. On Letter,
check that the Original Field Journal fits the page, with the date, tech,
quantity/hours and charge above the description. The client printout should
not show Direct job cost or Estimated gross profit.

Sign in with your administrator and technician test accounts. Check module
visibility and run the Training walkthrough. Verify a printed invoice in
Chrome with browser headers and footers disabled. Existing custom profiles
need the desired new module grants. Microsoft 365 intake and phone delivery
require the setup and live checks in EMAIL_AND_NOTIFICATIONS.md.

If the build fails, restore the previous source package and rebuild that
version using the existing staging database configuration.
