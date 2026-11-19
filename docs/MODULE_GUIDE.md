# BCI Operations maintenance guide

## Release 0.5.4 — Guided Training

This release starts the staged implementation approved for BCI Operations.
The screens of all existing tabs now have their own source modules. The
application shell still owns shared state, navigation, event delegation, and
some existing forms. Those controllers will move with their feature upgrades.
The Pricing module now supports profiles. See PRICING_PROFILES.md for
setup, rate resolution, and the preview/save workflow. See TICKETS.md for the service desk. See EMAIL_AND_NOTIFICATIONS.md for intake and phone setup. See TRAINING.md for practice. Assignment scopes and user access preview
remain subsequent stages.

## Where to edit a screen

All paths below are relative to the source folder.

| Area | Module |
| --- | --- |
| Training | public/modules/training.js |
| Overview | public/modules/overview.js |
| Customers | public/modules/customers.js |
| Projects | public/modules/projects.js |
| Project detail | public/modules/project-detail.js |
| Work orders | public/modules/work-orders.js |
| Work order detail | public/modules/work-order-detail.js |
| Tickets | public/modules/tickets.js |
| Email intake | public/modules/mail-intake.js |
| Notifications | public/modules/notifications.js |
| Inventory | public/modules/inventory.js |
| Money | public/modules/money.js |
| Reports | public/modules/reports.js |
| Payroll | public/modules/payroll.js |
| Pricing | public/modules/pricing.js |
| Team | public/modules/team.js |
| Database Testing | public/modules/database-testing.js |
| Printed invoices | public/modules/invoice-document.js |
| Editing, deletion, Trash | public/modules/records.js |
| Shared styling | public/app.css |
| State, navigation, shared forms | public/app.js |

Each screen exports its existing render function. Screen modules import
live bindings from app.js so they render the latest state after an API reload.
Do not read imported state at module initialization. Read it inside render
functions. Mutations pass through send(), which calls the server and reloads
state after a successful transaction. A browser may cache module files for
the current page lifetime; reload the page after deploying a new release.

The shell and screens currently form a circular module graph. The module
link/render regression test checks initialization. Future feature controllers
should use explicit shared APIs rather than adding arbitrary shell exports.

## Server responsibilities

- Models/permissions.js defines valid permissions, legacy profile compatibility,
  module read gates, and write authorization.
- Models/visibility.js prepares an independent response snapshot and redacts restricted
  fields. It is shared by /api/state and the record inspector.
- Models/records.js handles corrections, linked-record checks, soft deletion,
  restore, and permanent removal.
- Models/lib.js owns existing operational business actions.
- Models/pricing.js resolves effective rates and Models/pricing-profiles.js handles profile changes and previews.
- Server/server.js authenticates requests and applies updates inside the existing
  MariaDB state-row transaction or local JSON transaction.

The database connection still comes from the deployed .env.secure. This
release adds fields to the application state JSON and needs no SQL table
or column changes.

## Permission behavior

Permission profiles use a View/Add/Edit/Delete matrix where actions apply.
Special approvals, finance visibility, stock adjustments, and database
inspection remain explicit grants. Inventory Edit maps to Adjust Stock.

Actions require both their action grant and the corresponding module's View.
Team administration and Trash are administrator-only. Administrators retain
full access. Database Testing sections require both their inspector grants
and the source module's View.

Old profiles receive their former screen visibility until saved through the
new matrix. Saving writes schemaVersion 2. New edit/delete rights default off
for non-administrators. This avoids silently granting deletion after deployment.

Work-order, payroll, project, and report screens still receive the minimal
related customer/project/product labels they need for context. Hiding a
Customers tab does not hide a customer's name on an accessible work order.
Costs in nested snapshots are removed when finance visibility is absent.

Clock Out/Cancel remain available to the owner of an already-running timer
after a grant changes, so the user can safely stop their timer.

## Edit and deletion behavior

Choose Edit / delete records in a supported tab to enter management mode.
The list is searchable, and rows can be selected for deletion. Job contacts
are available through the record-type selector in Customers.

The red warning names the records and requires a reason. The full batch is
validated before any deletion occurs. The server moves complete record
snapshots to administrator-only Trash, recording actor, time, and reason.
Trash provides Restore and a second, permanent-delete confirmation.

Projects with active work orders and clients with active projects cannot be
deleted. Delete eligible children first. Contacts assigned to projects require
reassignment. Pricing items with purchases, movements, stock, job entries or
change-order references cannot be deleted. Only empty stock locations without
movements can be deleted.

Draft work orders can be deleted when they contain no approval, changes,
entries, closeout, invoice, or running timer. Work orders with operational
history are blocked pending the later void/archive workflow.

Corrections to project names, PO numbers, client details, contacts, and work
order titles preserve record IDs and relationships. Scope corrections are
blocked once work has approval or operational history. Use change orders.
Saved invoice snapshots keep their recorded names and amounts.

Top-level edits and contact edits detect stale forms using updatedAt.
Restore requires parents to exist and checks project number/SKU conflicts.
Permanent removal of a parent is blocked while recoverable dependent records
remain in Trash.

## Verifying an update

Run npm run check and npm test from source. Tests cover module linking/rendering,
allow/deny permissions, nested cost redaction, stale edits, deletion guards,
restore, and purge. The module test uses Node's experimental VM modules API
in development only.

This environment could not run Chromium, so actual desktop/mobile interaction,
browser print output, and a live MariaDB deployment need staging verification.
The release does not include changes to your deployment secrets.

For a targeted update, identify the owning module, its imports, and the business
action it calls. Inspect those boundaries first. Update shared code only when
the requested behavior needs it, and list that change in the release notes.
