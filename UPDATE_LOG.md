# BCI Operations 0.9.1

- Technician Contribution uses only the employee’s own verified billed work hours, excluding travel, parts and nonbillable time.
- Employment cost is hourly wage plus 25%, applied to those work hours. The difference is labor profit. The standard bonus is 5% of positive eligible YTD labor profit; explicit annual staff overrides still work.
- Admin wage entries are effective dated. The per-work-order overhead-entry screen from 0.9.0 is retired; no payroll or payout automation.
- Includes 0.8.9 Profile Studio and 0.8.8 Business Manager. No SQL migration or reseed.

# BCI Operations 0.9.0

- Added private project charts for attributed billed revenue, employment cost and profit after direct costs and overhead, plus a year-to-date bonus estimate.
- Admins set a profit-share percent and enter verified work-order costs. Missing cost records and unavailable inputs are shown explicitly.
- Displays the Friday nearest December 15 as the scheduled bonus date. This does not send a payment, write to payroll, or finalize an accounting period.
- Includes 0.8.9 Profile Studio and 0.8.8 Business Manager. No SQL migration or reseed.

# BCI Operations 0.8.9

- Added Profile Studio with a live preview and twenty preset choices each for profile rings, lighting, banners, section colors, text colors and trade icons.
- Coworkers can open an internal profile and see its appearance and shared details. Private profile fields are unchanged.
- Technician icons appear on internal work orders for linked employees, not on client output.
- Includes Business Manager from 0.8.8 and the 0.8.7 staff views. No SQL migration, reimport or reseed.

# BCI Operations 0.8.8

- Added an opt-in Business Manager dashboard in My Time & Profile for internal vehicle registration, oil-change and business bill deadlines.
- Track upcoming and overdue items, then record renewals, service and bill completion. This is a tracking tool, not a payment or notification integration.
- Business Manager permissions are separate from finance, payroll and the staff directory. The app update does not assign anybody access.
- Includes the 0.8.7 staff command-center update. No SQL migration, catalog import, or reseed.

# BCI Operations 0.8.7

- My Time & Profile now includes an editable picture, display name, About section and social links; it keeps existing time and leave workflows.
- The signed-in internal directory contains only employee-shared profile details. It does not disclose coworkers’ pay, leave, time history or contribution values.
- The private technician dashboard counts distinct logged work orders and projects attributable to the signed-in employee. Older unlinked entries are not guessed.
- Contribution is attributed project revenue from supported sent or paid work-order invoices before sales tax and ignoring deposit/credit deductions, allocated by verified hours. It is not collected cash, profit or a bonus. Incomplete coverage is labeled. Profit and employment cost are reserved for a later cost model.
- No provisioning, deployment, production data change, SQL migration, catalog import or reseed is part of this release.

# BCI Operations 0.8.6-catalog.11

- Warehouse files has a one-time administrator button for permanent deletion
  of eligible records from the exact 3,843-row November 20 import.
- Preview and final confirmation are mandatory. Current and historical
  references, stock records, and changed rates protect an item.
- No deletion on deployment; the image-free Warehouse and receipt images
  are unchanged. See docs/WAREHOUSE-PURGE.md.

# BCI Operations 0.8.6-catalog.10

- Warehouse no longer displays product thumbnails or product-image links.
  Receipt photos are unchanged.
- A separate MariaDB preview/apply tool can archive the 3,843 identified
  manufacturer-created rows without erasing catalog IDs or prior work.
  Existing originals, including 11 enriched by the import, remain active.
- Rebuilding the app does not run the data update. See
  docs/WAREHOUSE-RESET.md for backup, preview, apply, verification and restore.

# BCI Operations 0.8.6-catalog.9

- Office → Services lists labor and travel separately from parts and stock.
- Authorized users can add an hourly labor or travel service. Configure
  standard and change-order rates in Pricing; an unpriced service is not
  silently billed at zero. Existing rates, IDs, grants and history are retained.
- No stock, material catalog or pricing cleanup is applied on deploy.
  No SQL migration or catalog re-import is needed.

# BCI Operations 0.8.6-catalog.8

- Warehouse filters narrow down to compatible options as filters are selected.
  Clear an individual filter to broaden it without resetting the whole page.
- The work-order Log Materials picker makes common trades and stocked and
  recently used parts easier to find, with the full catalog still searchable.
  Purchase packs and individual parts remain distinct; quantities are not converted.
- No SQL migration, catalog re-import, stock edits or cleanup of older rows.
  Review the separate legacy catalog audit before changing legacy identities.

# BCI Operations 0.8.6-catalog.7

- Export Warehouse and catalog as an administrator. The JSON snapshot includes
  stable identifiers and current stock by location, not just visible filter rows.
- Review and apply separate update-only patches. Reject stale, unknown or
  duplicate targets. A patch cannot add parts, change stock or prices, or remove
  records; ordinary Import Catalog remains separate.
- No SQL migration or catalog re-import needed.

# BCI Operations 0.8.6-catalog.6

- Admin → Changelog lists historical releases, staging builds and test packages.
  Read more opens a scrollable detail view with a return to the release list.
  The server exposes the history only to app administrators.
- Warehouse rows show Color / Finish clearly. Known finishes can be filtered
  and searched. Work-order material search and part labels include known colors.
  Blank metadata remains Not specified; no catalog data or counts changed.
- Cumulative from 0.8.6-catalog.5. No SQL migration or catalog re-import.

# BCI Operations 0.8.6-catalog.5

- Renamed the Inventory tab to Warehouse. The existing data layout and saved
  inventory-related permissions are retained.
- Receive Parts records a warehouse receipt with the time it was entered and an
  optional receipt image. Warehouse Activity shows stock receipts and linked field
  purchases, including the originating work order.
- Field work still issues material once on the work order. Commit to Warehouse
  records the corresponding receipt in the warehouse ledger exactly once,
  without duplicating work-order material or removing the original photo.
- Cumulative from 0.8.6-catalog.4. No SQL migration, reseed, or catalog re-import.

# BCI Operations 0.8.6-catalog.4

- Inventory uses one BCI Warehouse grid with combined part filters and editable
  stock counts, part details and pricing for authorized users.
- Add Item and Import Catalog are the only top-level inventory actions. The
  Activity feed, existing purchase history, and catalog photo zoom remain intact.
- New work-order material usage draws from BCI Warehouse. Existing entries and
  old-location balances stay intact; review them before entering physical counts.
- Cumulative from 0.8.6-catalog.3. No SQL migration, reseed, or catalog re-import.

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
