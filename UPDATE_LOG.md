# BCI Operations 0.8.6-catalog.3

- The printed Original Field Journal now places date, tech, quantity/hours and
  charge on top, followed by the full-width work title and description.
- Keep ordinary two-row entries together while allowing long notes to flow.
  Client printouts still omit direct job costs and estimated gross profit.
- Supersedes 0.8.6-catalog.2. No changes to rate calculations, stored entries,
  inventory, invoices, or database configuration.

# BCI Operations 0.8.6-catalog.2

- Client work-order print preview and PDF omit direct job cost and estimated gross
  profit for all roles. Authorized staff still see both on the internal work order.
- Work orders flow naturally across Letter pages. The field journal repeats its
  column headers, and standard entries, change orders, and the billing summary stay
  together where they fit. Existing client-facing billed amounts are unchanged.
- Cumulative from the catalog/photo release below. No schema, server settings or
  inventory changes; no need to rerun an import.

# BCI Operations 0.8.6-catalog.1

This is the catalog and photo release, not the full planned 0.8.6.

- Admin Inventory import with a read-only preview, manufacturer + MPN matching,
  explicit skip of conflicts, and no changes to prices, counts or journal history.
- Browse stock or all materials from Inventory. Search by part number, brand
  or description and view product photos, including clearly marked family images.
- Tap a part photo to enlarge, zoom and pan in Inventory and material selection.
- Same-origin authenticated 512 × 512 JPEGs bundled directly in the app image.
- Existing deployment configuration stays in place. Bundled Compose examples
  are reference only. No schema migration or MariaDB reseed is required.

# 0.8.5 | Permission and record access revision

Cumulative after 0.7.5. See [revision .8.5 notes](docs/REVISION-8.5.md) for module modes, scoped records, server enforcement, and staging limitations. Current profiles retain prior access until edited; review each role before production.

# 0.7.5 | Operations workflow revision

See [revision .7.5 notes](docs/REVISION-7.5.md) and the separate deployment handoff. This update uses new optional fields in the existing state record; there is no SQL migration or reseed. Preserve the active deployment settings and database.

# BCI Operations source layout update

**Application release: 0.6.5-staging.1.** Folder-only reorganization.
The image tag and logo badge are intentionally unchanged. No feature,
permission, schema, database, or Cloudflare changes are part of this package.

| In the source folder | What belongs here |
| --- | --- |
| `Server/` | Node app entry point and HTTP/API routing |
| `Models/` | Server-side application modules, including `pricing-profiles.js` |
| `public/` | Browser screens, styles, logo, and web app assets |
| `scripts/`, `sql/`, `tests/` | Maintenance scripts, SQL, and developer tests |
| Root | Dockerfile, package.json, Compose files, environment files, README and update log |

The nested `source/source/` was an older copy and is not shipped. Each of
its files had an outer counterpart, and the active startup, imports, and
Docker build use only the outer tree. Docker also ignores any stray nested
copy that remains in an old build directory.

## One-time replacement on gcccluster1

1. Back up the current source directory and database. Unzip this package into
   a separate staging location. It has exactly one top-level `source/`.
2. Keep the server's existing `.env.secure`, `mariadb.env`, and active Compose
   configuration. The ZIP intentionally omits live environment files.
3. Have Greg stage the new tree, place the existing deployment files at its
   top level, and put that tree at the same build-context path as the old
   source. Keep the old source backup outside the build context. If updating
   in place instead, move the old nested `source/` and the old root JavaScript
   files out of the live tree after backing them up. A ZIP overlay alone does
   not remove old files. Don't nest the extracted `source/` under the old one.
4. From the existing deployment working directory, using the same Compose
   file and project name as the running stack:

   ```sh
   docker compose -f compose.secure.yml config --quiet
   docker compose -f compose.secure.yml up -d --build --no-deps --force-recreate bci-operations
   docker exec bci-operations-secure node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
   ```

   If your stack uses another Compose filename or explicit project name, keep
   those options. Recreate by itself does not rebuild the image. This command
   targets the app only; do not remove or recreate the MariaDB volume. Confirm
   the new layout with `docker exec bci-operations-secure test -f /app/Server/server.js`.
   Health should report `mariadb` and release `0.6.5-staging.1`; verify the badge
   and an existing work order in staging. No SQL migration or reseed.

After this one-time update, routine code changes go into the folders above.
Only replace root files when a dependency, release version or deployment
configuration actually changes.

## Work Orders phone layout

The phone list now shows client, release, entry count, and creation date on
the first row, with the linked job title and full scope below. Creation date
uses Eastern time, consistent with the work-order print view. Existing list
order, desktop table, field journal, print views, and deployment settings
are unchanged.
