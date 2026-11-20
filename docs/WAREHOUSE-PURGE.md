# Permanently delete unused imported parts

This one-time administrator control covers only the exact 3,843 material
records created by the November 20 manufacturer catalog import. It does not
target the 262 original material records (including the 11 the import
enriched), service records, or a new import. It can check the original
import whether still active or already archived by this exact batch.

1. Back up the intended database and verify that the backup can be restored.
   Back up any changes made since the previous archive export.
2. Deploy version 0.8.6-catalog.11 and use the existing Compose deployment
   and environment. Rebuild only the app. Deployment removes nothing.
3. As administrator open **Warehouse → Warehouse files → Delete Imported Parts**.
   Read the preview. It checks the installed database, not the old export.
   A matching item used in history, priced since import, or holding a stock
   record is left in place. Unexpected identity drift blocks deletion.
4. If the result is correct, affirm the backup and enter the confirmation
   shown on the screen. There is no Undo button for permanent deletion.
   If a concurrent change invalidates the preview, run the preview again.
5. Refresh Warehouse, verify the count against the preview, and spot-check
   a historical work order, a receipt and an original priced part. Do not
   re-import the discarded manufacturer pack.

The older archive script is a reversible alternative if unsure; use one
method, not both in sequence. The previous archive rollback cannot restore
permanently deleted records.
