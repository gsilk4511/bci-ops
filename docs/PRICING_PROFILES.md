# Pricing profiles

Open Pricing to see clients, their effective profiles, and project overrides.
Confirmed payments are drawn from receipts recorded against invoices in BCI
Operations and are visible with finance permission.

Create a profile, set rates, select Preview changes, and save. Use Assign on
the client list, a project detail screen, or an open work order. Use Set
company default to apply one profile across clients without an override.

## How rates are selected

Work order assignments take precedence over project, client, and company
assignments. The first applicable profile supplies all item rules. A profile
starts with a 25% default markup. Part markups use the latest inventory receipt
by purchase date, then entry time. The editor displays the cost and date to
users who can view costs. A part without a receipt needs a fixed rate before
billing through a profile. Standard service rates fall back to the base
service rate, including the project's service category. Change-order rates
fall back to the fixed part price, markup, or base change rate as applicable.

Unassigned records continue to use their existing pricing rules until a
company default is selected. This keeps installed clients' rates from changing
on deployment. Review existing client rules when assigning a new profile.

Bulk edits can set markup, adjust standard rates by a percentage, set a
change-order rate, or round standard rates to an increment. Percentage
adjustments and rounding set fixed rates. Use the preserve-fixed checkbox
to skip existing fixed standard rates. Select visible operates on the filtered
table, and the individual checkboxes allow specific item selections.

Preview shows item rates and affected existing draft entries. Save checks the
same proposal against the current state inside the database transaction.
Changes to the previewed inputs or relevant records require a fresh preview.

Existing approved scope entries, recorded change-order prices, completed work
orders, and invoice snapshots retain their saved rates. New entries on open
orders use the current effective profile, except entries on an approved
change order use its signed rate. Assigned profiles must be removed from
their assignments before they can be archived.

## Code and permissions

- public/modules/pricing.js owns the screen, editor, and bulk controls.
- Models/pricing.js resolves assignments and prices.
- Models/pricing-profiles.js validates, previews, and saves profile operations.
- Models/lib.js uses the effective profile when creating entries and change orders.
- The permission profile editor distinguishes profile management, assignment,
  bulk controls, and finance visibility.

This release uses the existing application state storage and requires no
SQL schema migration. Run npm run check and npm test to verify the release.
