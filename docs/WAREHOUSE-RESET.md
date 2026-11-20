# BCI Operations: reversible Warehouse reset

The November 20 Warehouse export contained 4,105 materials. The filtered
manufacturer pack matched 3,854, but only 3,843 were newly created by the
import. The other 11 matched existing records and were only enriched. They,
the other 251 pre-existing rows, and service records are outside this batch.

The updater archives eligible exact IDs, SKUs, manufacturers and part numbers
from that export. It does not delete rows, zero counts, modify costs or prices,
rewrite old work, or automatically run on boot. A later change on the server
may reduce the number eligible. Review skipped rows before doing anything to them.

## Greg: backup, rebuild, preview and apply

1. Back up MariaDB and the existing app version. Keep the existing Compose
   file, environment files, database, volume and network. Test with staging
   before changing the business database.
2. Rebuild only the app service with the full 0.8.6-catalog.10 source, using
   the existing Compose file and same build context. Follow
   [UPDATE_EXISTING_STAGING.md](UPDATE_EXISTING_STAGING.md). Check the version
   next to the BCI logo. Do not run any Seeder or Import Catalog.
3. From the usual Docker host deployment directory, run the preview in the
   updated app service, using its configured DB environment. Replace the
   Compose or service name below if the existing deployment uses another.

```sh
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node scripts/archive-manufacturer-import-nov20-2026.js
```

4. Check `identityDrift` is false, review eligible/skip counts and the
   listed reasons. On the November 20 export there were 3,843 target IDs,
   leaving 262 active materials if no new blockers have appeared.
   Nonzero stock (including negative balances), active dependencies, and
   rates set since import are reasons to leave a row active. Missing IDs or
   changed identities block the entire apply; do not bypass those checks.
5. Apply on the intended database only after the backup and preview.

```sh
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node scripts/archive-manufacturer-import-nov20-2026.js --apply
```

6. Refresh Warehouse and check Active material SKUs. Check an original
   part and an original Services entry, a saved estimate or work order,
   and a receipt photo. The Warehouse product grid should have no images.
   Warehouse export still includes archived rows for continuity and marks
   them `warehouseArchived: true`. Do not re-import that snapshot.

## Undo only this batch

Run the same script with `--rollback` to preview; add `--apply` to restore
only archive markers set by this batch. This does not rewind other activity
in the database.

```sh
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node scripts/archive-manufacturer-import-nov20-2026.js --rollback
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node scripts/archive-manufacturer-import-nov20-2026.js --rollback --apply
```
