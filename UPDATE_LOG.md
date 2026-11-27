# 0.10.14 — Compact Warehouse grid

- Tighten Warehouse rows. Keep the part name, available color and unit, and existing stock and pricing columns. Hide internal SKU in the grid without changing search or exports.
- Replace inline count and pricing dropdowns with one Edit button at the top. Select a part name in Edit mode to open its editor. Otherwise the name opens read-only details, including any legacy balances.
- Keep existing permissions and save rules. No catalog re-import or database migration.

# 0.10.13 — Warehouse catalog import and stock targets

- Extend Import Warehouse Updates with an admin-only preview and explicit apply for the v2 JSON format. Continue accepting existing metadata-only v1 patches.
- New parts keep their internal SKU, billing unit, category, material-use category, available color and brand, and explicitly entered prices and costs. Existing records stay on their original IDs.
- Separate stocking targets from live quantities. Show on-hand-only gaps for individual SKUs and shared Signamax faceplate port-count groups.
- Never delete a held item or rewrite prior materials, work orders, invoices or receipts. Never derive change-order pricing from normal sell pricing for this import.
- Changelog cards show release dates where known, Hours worked, and a recorded development-time subtotal. No SQL migration.

# 0.10.12 — Sort the Original Field Journal by work date

- Time, Travel and Parts display oldest work date first, including backdated entries and date edits. The work-order printout uses the same order across all entries. This changes display only, not dates, billing or saved snapshots.

# 0.10.11 — Vehicle trip and hourly travel charges

- Travel requires a Shared Yes or No choice. Shared travel records the employee’s time with no client charge. Select a Base trip charge (defaults to $120 per vehicle round trip) or an hourly travel charge for billable travel. Enter one vehicle charge per round trip and log each staff member’s own hours.
- Fixed trip charges don’t multiply by employee hours. Work orders, prints, Money, and QuickBooks support documents use the same billing calculation. Existing hourly travel, signed change-order rates, and issued invoices are preserved; payroll still reads the recorded hours.

# 0.10.10 — Prevent duplicate Holiday time

- Manual Holiday and approved Holiday requests check for existing time for the same employee and day in either order. If a legacy typed name appears to match, stop and ask for review without linking or removing records.
- Payroll Preview flags existing potential duplicates and requires resolution before approval. The update does not edit current rows, approved payroll, or payments. No database import or migration.

# 0.10.9 — Staff pay scale and holiday requests

- Add Pay scale to the employer-only Staff profiles table. Accrual reads the staff profile’s effective-dated wage first, then a usable entered hourly Pay scale (such as 31.50 or $31.50/hr); do not derive hourly pay from an annual salary or tier label.
- Add Holiday under Add Time Off. Upon approval, create a Holiday payroll entry, show the approved day on the schedule under existing visibility rules, and leave vacation and sick balances alone.
- No change to Cash wage policy, pay-period locks, or data import/migration.

# 0.10.8 — Contribution cost follows Worked hours

- Accrual cost uses the same Worked calculation as Last Five Weeks, extended from January 1 through today. Use straight-time hourly wages plus 25%, including worked travel and shop hours; no PTO, sick, holiday or overtime premium in Accrual.
- Show year-to-date Worked hours directly above the employment-cost chart, even if the wage needed for the dollar total is missing.
- Cash, payroll approvals, employer settings and the weekly display are unchanged. No database import or migration.

# 0.10.7 — Live contribution estimates and bonus meter

- Accrual shows employment cost, after-reserve labor profit and the estimated bonus as time is logged, before review, invoicing or payment.
- Prefer dated wages. Older gaps can use an explicitly hourly profile rate or a currently effective dated hourly rate; flag straight-time estimates when the workweek is unset. An unusable row no longer hides the correctly matched subtotal.
- Keep the gross bonus meter prominent, show a separate approximate take-home figure, and put calculation details and data notes under the question-mark guide.
- No payroll, cash eligibility, data, permission or database migration changes.

# 0.10.6 — Scheduling, Team permissions, and time entry

- Central scheduling: overview, separate project and work order views, combined timeline, crew and technician views; multiday appointments with per-day hours; fleet and staff dates.
- Project and work order Schedule controls, work-order calendar export, and separate client invitation handoff for organizer review.
- Time, Travel and Parts journal tabs; original-submitter filtering; work-order Actions menu and relocated Manage Records.
- Payroll-based employment costs, live and invoiced/paid contribution views, and after-reserve labor profit.
- Team permission prerequisites, owner-only synthetic permission test, employee profile drilldown, and authorized time logging on an employee’s behalf.
- Tactile desktop and phone controls. Omit bundled catalog photos; preserve existing operational records and uploads.

# 0.10.5 — Wide screens and profile weather

- Desktop browser windows 1,440 CSS pixels or wider use available workspace width, instead of the previous main-column cap.
- My Time & Profile has a weather panel on the right at wide widths. On narrower screens, it is a collapsed, optional section.
- Barre, VT forecast from the National Weather Service. No geolocation, account credentials, external browser fetch, or database migration. Weather is separate from staff metrics and unavailable in practice mode.
- No changes to business texting, billing, payroll, or deployment credentials.

# 0.10.4 — Live bonus and profile card appearance

- Profile Studio colors, lighting and table styles now apply to Technician Contribution and My Last Five Weeks, including after live refresh.
- Contribution defaults to Accrual (logged work); Cash filters to work recorded on invoices, paid or unpaid. Both use the recorded labor rate and effective wage plus 25% on the same eligible work hours.
- Show pretax labor profit, a 30% planning reserve on positive annual labor profit, and after-reserve profit. Apply the configured share to positive after-reserve profit. Keep the year-end estimate prominent and live, with no payroll, invoicing, or payment changes.

# 0.10.3 — Dashboard and account controls

- Home becomes Dashboard. Work-order review, billing and open-project cards replace the old Tickets shortcut. Actual ticket records and old links stay in Service desk.
- Edit, add, remove, drag and resize cards, then save the grid under the signed-in account. Phones show cards in the same grid order.
- Add header sign-out and guarded administrator removal of added Team logins. Historical work-order and payroll records are retained.

# 0.10.2 — Unbilled work in Money

- Money now rolls up logged work order labor, materials and travel by project, regardless of closeout. A recorded QuickBooks invoice removes only the linked work orders from Unbilled.
- Customer and billing-status filters apply to both totals and detail. The Money tab only reads records; invoice, payroll, and the separate dashboard closeout metric are unchanged.

# 0.10.1 — Compact fleet cards and styleable vehicle profiles

- Turn each vehicle into a compact clickable card with photo, name, model and attention badge. Filter the fleet by overdue or due soon and open full vehicle pages.
- Move vehicle information, maintenance and cleanup, tires, documents, and service history into the corresponding profile.
- Fleet managers can preview and save five appearance choices from the same preset library as team profiles. Styles appear on both the profile and its card.
- Retains fleet records, photos, schedules, permissions and staff time. No import or database migration.

# 0.10.0 — Fleet schedules and live My Time

- Added model year, driver assignment, individual maintenance schedules and independent appointments, recorded odometer dates and seasonal tire-set mileage, assigned cleaning, and permissioned fleet document storage.
- My Time adds five recent workweeks with Regular, Overtime, PTO, Sick and Holiday and a private live work-order bonus estimate before billing/collection. The regular/overtime estimate requires the real payroll week start to be configured.
- No card linking, purchasing integration, calendar sync, payout, or payroll mutation. Existing work-order receipt flow is unchanged.

# 0.9.9 — Log Materials part grid

- Replaces the four quick-pick cards and native part dropdown with a detailed ten-row, filterable results grid. Direct taps choose parts; selected SKU stays visible when paging or filtering.

# 0.9.8 — Edit work-order service types

- Service type is editable on existing eligible own/admin-managed labor and travel entries. Existing edit permissions and locks apply.
- Review tickets add Undo Closeout. Eligible orders return to Released; the reason and previous closeout remain in history.
- Changes use applicable service pricing; approved payroll and issued invoices are not rewritten.

# 0.9.7 — Employee time reconciliation

- Admin-only preview and correction for time recorded under duplicate labels. No records are reconciled automatically on update.
- Does not merge logins or permissions, rewrite approved payroll/invoices, or change billed rates. See docs/TIME_ATTRIBUTION.md.

# 0.9.6 — BCI Operations sign-in staging

- Optional pilot for BCI passphrase plus authenticator or eligible approved email verification after Cloudflare. Existing users retain their accounts.
- Default off. Follow docs/APP_SIGNIN.md before pilot or enforcement.

# 0.9.5 — User Security staging candidate

- User Security and Agent API are off by default. See docs/USER_SECURITY.md before enabling either.
- Separate opt-in MariaDB migration and external encryption key; no changes to existing business records.

# 0.9.4 — Pricing tables and profile editing

- Billing clients start collapsed. Clients, base labor (including travel), and base parts tables have independent search, sort, and pagination.
- New and Edit Pricing Profile use the same split grids. Off-page edits and selections are kept in the draft; the same preview/save flow applies.
- No data migration, pricing-model change, or permission change.

# BCI Operations 0.9.3

- Work-order PDFs reflect current journal descriptions after submission, review or invoicing. Existing issued invoice and closeout snapshots remain unchanged.
- The shared travel checkbox keeps an employee’s travel time for payroll and the journal, and does not add a client charge.
- Vehicles are separate from Business Manager bills, with dedicated permissions, vehicle profiles and service/inspection tracking.
- Phone navigation fits full tab labels in a horizontally scrollable row.
- Uses the existing database model; back up data and preserve deployment settings.

# BCI Operations 0.9.2

- Saved Profile Studio appearance now extends across My Time & Profile, including its page heading and panels. The existing profile card, permissions and workflows are unchanged.
- Styling is limited to the staff workspace. Coworker cards retain their own looks; other app screens keep the app theme.
- Includes 0.9.1's contribution and bonus setup. No SQL migration or reseed.

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
