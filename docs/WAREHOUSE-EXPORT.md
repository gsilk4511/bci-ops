# Warehouse export and duplicate-safe updates

1. In the app, sign in as an administrator and open **Warehouse**.
2. Download the **Export Warehouse & Catalog** JSON. It reads the app's recorded
   material catalog and inventory, not the old import file or the currently
   selected filters. It includes stable part IDs, SKUs, manufacturer model
   numbers, part information, stock by location, and the services catalog for
   reference. Treat the export as an internal business file. It does not include
   work orders, customer records, receipt photos, or staff information.
3. Keep this snapshot unchanged when sharing it for reconciliation. A cleanup
   can identify exact matches and propose edits to those existing records. It
   should not treat a new manufacturer match, a pack SKU, or a similar name as
   permission to modify or merge a different item.
4. Choose **Import Warehouse Updates** to load a separate update-only patch
   (up to 200 existing material rows at a time). Review the preview before applying.
   Each row must match the original part ID, SKU and revision in the live app.
   If any row is stale or invalid, refresh the export and prepare the patch
   again. Counts, prices, costing, supplier IDs, and history are not changed.

The snapshot is a read-only report, not an import file. Do not upload it using
**Import Catalog**. That button remains a separate workflow for adding new
manufacturer parts. An update-only patch never creates or deletes parts.

## Patch shape

```json
{
  "format": "bci-warehouse-patch-v1",
  "items": [
    {
      "id": "existing-app-item-id-from-export",
      "sku": "SKU-FROM-EXPORT",
      "revision": "revision-from-export",
      "changes": {
        "system": "Copper",
        "partType": "Jacks",
        "color": "White"
      }
    }
  ]
}
```
