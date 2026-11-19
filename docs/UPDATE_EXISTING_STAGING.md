# Update an existing BCI Operations staging installation

1. Back up the current source directory and the MariaDB staging database.
2. Extract the release and copy its source files into the existing application
   source directory. Keep both existing environment files (.env.secure and mariadb.env). Check that DB_NAME is
   bci_operations_stage before rebuilding.
3. With Greg overseeing terminal work, build and start the matching release from
   the source directory. Use the active Compose configuration from the server, not the legacy Unraid file. The current gcccluster1 Compose defines an absolute build context. Rebuild and recreate the app service only.

```sh
docker compose -f compose.secure.yml config --quiet
docker compose -f compose.secure.yml up -d --build --no-deps --force-recreate bci-operations
docker exec bci-operations-secure node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
```

Expect the release in `package.json` (Update 1: `0.6.5-staging.1`) and storage
`mariadb`. Reload and check that the same version appears beside the BCI logo
on desktop and phone. This update needs no SQL migration or reseed.

For each new patch release, bump `package.json` and match both Compose image
tags. The header badge and `/api/health` both read the package version; do not
edit the HTML placeholder. Run `npm test` to check that deployment tags agree.

Sign in with your administrator and technician test accounts. Check module
visibility and run the Training walkthrough. Verify a printed invoice in
Chrome with browser headers and footers disabled. Existing custom profiles
need the desired new module grants. Microsoft 365 intake and phone delivery
require the setup and live checks in EMAIL_AND_NOTIFICATIONS.md.

If the build fails, restore the previous source package and rebuild that
version using the existing staging database configuration.
