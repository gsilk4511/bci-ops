# BCI Operations Sign-In · 0.9.6 staging only

**Do not turn on for live users.** Both BCI sign-in and email verification ship
off. No Cloudflare rule, live account, SMTP service, access grant, or production
record has been changed. Review the supporting `USER_SECURITY.md`, but use the
activation instructions below for 0.9.6; its pilot and enforcement flags are
different from the original 0.9.5 TOTP-only flow.

## What a pilot user sees

Cloudflare first, then **Log in to BCI Operations**. On first use, create a BCI
passphrase (at least 15 characters). Use an existing BCI authenticator or enroll
using Apple Passwords, Google Authenticator, or Bitwarden with the QR. If
expressly enabled and eligible, field-only staff may ask for a short-lived
code to their verified account email. Each future login needs both the BCI
password and the configured method; it is not a passwordless email link.

An existing active user does not need a new invitation, email, role, or BCI
record. The existing approved account remains authoritative and the application
uses the same canonical email/user reference for staff profiles, permission
profiles, field journal, work orders and payroll. A new staff member must first
be added and activated by Greg in Team with the intended email, role and
permission profile, and be allowed by the Cloudflare policy. That Team approval
is the invitation boundary in 0.9.6; no separate enrollment link or token is
needed for the new BCI sign-in. Greg can give the user the existing portal URL.
The user signs in to Cloudflare with that exact approved email, selects
**Log in to BCI Operations**, creates the BCI password, and finishes verification.
An unknown or disabled identity cannot create an account.
A previously enrolled TOTP key remains intact and must be used before setting
the new BCI password. A Cloudflare identity change must be verified by Greg;
the app will not silently create a second profile for it.

## Keep Cloudflare, make staged changes only

1. Deploy 0.9.6 with existing active Compose and DB volume, new app image tag,
   `BCI_APP_SIGNIN=off` and `BCI_SIGNIN_EMAIL` unset. Verify old app sign-in
   works; the new routes remain hidden. Keep `BCI_AGENT_API` unset. Do not
   change the real Cloudflare policies.
2. In isolated staging with synthetic records, validate the current backup and
   run the additive `sql/002_user_security.sql` in the intended database if
   not already applied. Configure existing verified Cloudflare Access and exact
   HTTPS `PUBLIC_ORIGIN`, isolate the origin, add the two protected admin
   emails to `BCI_ADMIN_EMAILS` with independent credentials, preserve the
   encryption key and separate backup. Set `BCI_USER_SECURITY=optional`.
3. Enable `BCI_APP_SIGNIN=pilot` with an explicit comma-separated
   `BCI_SIGNIN_PILOTS` containing the two protected admins and representative
   crew. Nonpilot users retain the prior behavior. Start using authenticator
   only. Check a current staff member from a fresh browser: same Team user ID,
   name/photo, job access, journal entries, and payroll linkage before and
   after setup. Include a pre-existing 0.9.5 TOTP user who must not scan a new
   QR. Confirm unapproved/disabled identities and copied or stale sessions
   cannot enter. Test valid/replayed/incorrect TOTP, and recovery after losing
   a device. Each independent admin must use one saved recovery code and retain
   unused codes. Test restore of DB and separately saved key in a fresh staging
   environment with no prior sessions.
4. If approved for limited field users, optionally set `BCI_SIGNIN_EMAIL=on`,
   `BCI_EMAIL_SMTP_HOST`, `BCI_EMAIL_SMTP_PORT` (465 or 587),
   `BCI_EMAIL_SMTP_USER`, `BCI_EMAIL_SMTP_PASSWORD` and `BCI_EMAIL_FROM`.
   Put SMTP credentials in the server secret store only. Sender must have the
   provider's verified sending domain and acceptable SPF/DKIM/DMARC posture.
   Test with authorized isolated addresses: arrived within five minutes;
   mailbox or outage handling; expiry, replay, rate caps, and TLS validation.
   The browser cannot specify a recipient; we use the Cloudflare-verified
   address matched to the approved account. Ensure SMTP and reverse proxy
   logs do not contain OTPs, auth cookies, passwords, or app tokens.
5. Email is restricted to the tech role with a limited field permission
   profile. A standard tech with extra permissions may not qualify. Owners,
   office/admin or security-sensitive grants always require app-based TOTP.
   Email verification is lower assurance, especially if Cloudflare uses that
   same mailbox. It must never be used to recover an owner or silently replace
   a prior TOTP. Promotion or removing email support requires Greg's verified
   reset and re-enrollment to TOTP; keep the user's original Team record.
6. After both admins pass and the cold restore succeeds, test
   `BCI_APP_SIGNIN=required` in isolated staging. An unready activation leaves
   setup and recovery available but blocks protected business routes. The
   two-admin check is recorded for that protected roster once; consuming or
   replacing a recovery code cannot then take the whole site offline at the
   next restart. Missing DB/key or an invalid existing encryption key still
   fail closed. Moving Cloudflare out is a future separate rollout, only after
   an independent first-factor perimeter, recovery, throttling, CSRF, DDoS/WAF,
   key backup, and penetration/security review are validated. This release still
   requires Cloudflare Identity on all human routes.

## Storage, loss and rollback

The security table stores salted scrypt password hashes, authenticated encrypted
authenticator seeds, HMAC digests of OTPs and random session IDs, verification
rate counters, and bounded audits. Passwords, OTPs, mail secrets, raw authenticator
keys, and backed-up encryption keys are not in the business tables, generic
API projection or application image. SMTP traffic is verified TLS. Email codes
expire in five minutes; password-step cookies expire in ten minutes; verified
sessions expire at eight hours and still require current Cloudflare/Team access.

Use a saved one-time recovery code and BCI password after Cloudflare if the
device is unavailable. Forgotten password, inaccessible mailbox, or identity
change requires verified out-of-band admin recovery, not a public fallback.
Greg follows the local trusted-host reset procedure in `USER_SECURITY.md`:
use current backup and record the authority, keep BCI sign-in enforced for the
affected user (or pilot that exact user), reset credentials only, then reenroll
on the same approved Team record. A recovery session cannot manage Agent API
credentials. Receiving an email code is never an owner recovery method.

To stop a failed pilot: isolate staging, disable the application pilot and
email flags, and, if needed, restore the previous image and its deployment
config while leaving MariaDB data, the additive table, and separate key backup
in place. This fallback deliberately restores prior security, so record the
downgrade and have Greg and Randy validate it. No rollback needs to delete
app users or reset payroll/work order records. No Dot connection is included.
