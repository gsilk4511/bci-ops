# Verify Team permissions

In Team, open a teammate's **View effective access** to see the module views
and actions the server currently grants. Edit a teammate to switch between a
built-in role and a saved custom profile. Saving a shared profile updates every
account assigned to it.

A signed-in browser checks for grant changes when it returns to the foreground
and every 15 seconds while visible. On a change it reloads authorized data
and closes any open form. The server also checks current access on each
request, including writes made before the next browser check.

Administrators listed in BCI_ADMIN_EMAILS retain deployment-level administrator
access. Change that environment setting if those accounts need different access.

Invoices has its own View selection. It also requires Work Orders View and
finance access. Existing profiles that previously showed Invoices retain that
visibility until saved in the updated matrix.

To verify on staging, sign in with a separate crew account on a phone. Edit
that account's profile from desktop Team, then foreground the phone. Check
that the allowed tabs and actions update. Disable the crew account and verify
the app clears its operational screen. Restore access using Team afterward.
