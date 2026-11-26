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

## Sign out and remove an account

Use **Sign out** in the header on desktop or phone. It clears the current browser's
BCI sign-in session when that feature is enabled and then opens Cloudflare Access's
sign-out page. Cloudflare signs the browser out of all applications in the same Access
team, not just BCI Operations. The separate identity provider may still remember its
own sign-in. In loopback-only local development there is no actual identity-provider
session, so **Sign out** only leaves the loaded workspace.

To remove a teammate, open **Team → Teammates → Remove** and type their exact account
email. This removes their Team entry and blocks subsequent app requests immediately.
It does not delete their work, payroll history, staff history or audit records.
Deployment administrators and your own account cannot be removed; the last active
administrator is protected. Resolve a running work-order clock before removing the
teammate so worked time is not discarded. If the teammate is already disabled with an
open clock, recover or correct the time with the administrator before removal.

When User Security storage exists, removal also revokes stored BCI sessions,
recorded sign-in secrets, invitations and pending sign-in steps. Reauthorizing the
email is a separate decision and the person must set up BCI sign-in again if required.
The in-app allowlist is independent of Cloudflare. If the existing dedicated
Cloudflare Access group sync is enabled it will run after removal; if it is disabled
or reports failure, update the relevant Access policy separately. Removing Team access
does not itself revoke the person's Cloudflare token or change other sites.

Staging verification: have a test account sign out on a phone. Check that the
workspace is no longer displayed and that reopening the app follows the configured
sign-in flow. In a separate session, remove a synthetic Team account with work/leave
history. Its open session must fail further reads and writes; the admin's history
must stay intact. If BCI sign-in is enabled, reauthorize the same test email and
verify old BCI credentials/sessions do not sign it back in. Check the separate
Cloudflare sync status and leave production accounts untouched during staging.

## Permission prerequisites

When you edit a custom access profile, enabling an area checks its required
read permissions and lists the dependency in the form. New scoped prerequisite
areas default to **Own records**, not all records. If you mean to allow a wider
scope, choose it explicitly. To remove a prerequisite, confirm the list of
options that will also be removed. Grants that require editing, deleting, or
access to payroll still require a separate selection. Existing profiles do not
gain permissions automatically: this applies when an administrator edits and
saves a profile.

## Owner permission testing

Randy can use **Test Permissions** beside **Sign out**, choose a built-in
role or saved access profile, and use **Return to My View** when finished.
On the hosted app the verified identity defaults to Randy's exact address
`rbevins@bcielite.tech` and must have administrator access. If Randy signs in
through a different verified owner address, Greg can set
`BCI_PERMISSION_TEST_OWNER_EMAIL` to that one address in the deployment
environment. This setting does not grant administrator access. The existing
`PUBLIC_ORIGIN` should be the exact hosted app origin, including the scheme,
so start and return requests can be validated.

The preview cookie applies to the browser session, so other tabs in that
browser cannot use live APIs while Test Mode is active. Preview sessions are
temporary (up to one hour) and only contain fictional data. Functionality that
would change live access, use real credentials, contact external services, or
inspect raw deployment data is disabled. Normal authorized in-app changes
apply only to the synthetic test data. No employee login or payroll record is
created. Return to your normal view before leaving the test tab open or
signing out.
