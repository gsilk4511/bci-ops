# Warehouse filters and work-order material lookup

This release updates how you find products; it does not edit the product list,
stock balances, supplier pack sizes or historical entries.

## On staging

- Open Warehouse. Starting with no filters, select Cable Matters and look at
  Category, Type, Color / Finish and Stock. Each menu should show compatible
  choices and the number of matching parts. Select Copper and check the other
  options. Clear one filter and confirm the others stay selected. Reset all
  filters to return to the complete list.
- Add text search and try a nonexistent part. Confirm that the app reports no
  matching parts and lets you remove only the search or an individual filter.
- Open Log Materials on a test work order on a phone. Check a trade shortcut,
  a stocked item, a keyed SKU search and browsing the full catalog. Open the
  selected part's details and photo, if available. Verify the unit before
  entering quantity. A part sold as each is distinct from a case or pack;
  choosing a pack does not convert the quantity.
- Confirm the existing stock-location, draft, receipt and review behavior
  using a test work order rather than changing any historical record.

## Review older parts separately

The one-time legacy review workbook is a working list, not import data.
Check the old description, evidence, unit and stock locations before making
any decisions. Similar names or a brand keyword are not proof of equivalence.
Start with physical counts and source receipts for nonzero historical
balances, then confirm true manufacturer/part numbers with labels, distributor
records or invoices. Keep unresolved records and references intact. Never
re-import the export to update old rows. See WAREHOUSE-EXPORT.md for updating
supported descriptive fields by stable record ID once edits are verified.
