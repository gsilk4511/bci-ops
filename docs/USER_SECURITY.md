# BCI Operations 0.9.5: User Security and Agent API staging runbook

For the separate 0.9.6 local BCI sign-in flow, use [APP_SIGNIN.md](APP_SIGNIN.md).
The invitation token described here applies only to the earlier 0.9.5 flow.

**Do not enable either feature on a live deployment.** This candidate ships with
both off; upgrading app code alone needs no security migration or keys and
keeps the existing Cloudflare login. Go through the staging gates below with
Randy and Greg. A successful code test does not validate your Cloudflare
installation, authenticator device, real MariaDB migration, or the Dot's
ability to use a service-authenticated connection.

## Storage and access

- Team still assigns an approved email and role. After Cloudflare verifies the
  same identity, a 24-hour, single-use invitation opens setup. This is invite
  acceptance, not public signup and not a second password database. An optional
  unenrolled account keeps its earlier app access during the migration period.
- The authenticator uses the standard six-digit, 30-second TOTP format with an
  on-server generated QR. The setup seed expires in ten minutes if not
  confirmed; when already invited, restart setup without a new invite. Confirm
  a current code, then save the recovery codes before navigating away.
- Security data is isolated from work orders in the `bci_user_security` InnoDB
  table, in the existing MariaDB database. It stores authenticated encrypted
  authenticator seeds, digests of random sessions/invites/recovery codes,
  consumption counters, and a bounded audit trail. Nothing is returned in
  normal app state or raw Database Testing. QR and one-time secrets are returned
  only at setup/creation, never by a list endpoint.
- Greg keeps the master encryption key in the server's protected environment
  or approved secret store, and separately backs it up away from the encrypted
  database backup. Never place it in source, the ZIP, the image, a browser,
  screenshots, chat or email. This version has no in-place master-key rotation;
  do not replace it casually. Losing it means restoring it or carefully
  reenrolling affected identities in staging. Full restore testing is mandatory.
- A verified app session uses a private HTTPS cookie and expires after eight
  hours; all protected routes continue to require verified Cloudflare identity
  and the current app role. TOTP codes cannot be reused, including in parallel.
  Recovery codes are consumed once, audited, and do not provide recent-TOTP
  privileges such as managing integrations.

## Stage MFA before requiring it

1. Back up the staging source, MariaDB data, Cloudflare and Compose configuration.
   Preserve Greg's active Compose file, existing environment files and DB volume.
   Use a segregated staging app with no live data or credentials.
2. Leave `BCI_USER_SECURITY=off` and Agent API unset; verify the new image tag
   and the old sign-in path. From the intended staging DB console, run
   `source/sql/002_user_security.sql` using approved DB credentials; independently
   verify the intended database name and that row 1 exists. It is additive and
   can be reapplied. Never reseed. Runtime account needs SELECT and UPDATE on
   the isolated security table; no DDL grant at runtime is needed.
3. Configure `PUBLIC_ORIGIN` as the exact staging HTTPS origin, existing
   Cloudflare settings and two different verified owner emails in the existing
   `BCI_ADMIN_EMAILS`. Securely generate a fresh random 32-byte key
   (standard base64 or unpadded base64url) as `BCI_MFA_ENCRYPTION_KEY`.
   Leave Agent API off. Select `BCI_USER_SECURITY=optional` in staging only.
4. Visit `/security`. First protected administrator obtains a one-time invite
   via the setup page, scans with Bitwarden Authenticator, proves a valid code,
   stores the offline recovery codes, and consumes one in the recovery drill.
   After verifying a fresh TOTP if needed, that admin issues the second
   independent protected administrator's invite. Test that wrong email,
   expired/wrong invite, guessed code, repeated code and a disabled Team
   member are denied. Try in two independent devices/browser profiles.
5. On a new browser session test recovery without the phone and prove the same
   recovery code is rejected a second time. Verify recent-TOTP privileges
   require a fresh real TOTP even after recovery. Check runtime UTC clock
   synchronization and exact HTTPS origin handling, including mobile.
6. Restore the staging MariaDB backup and separately backed-up MFA key into a
   fresh isolated instance, without copying browser cookies. Sign in through
   the independent administrator path and consume a test recovery code again
   (using a code unused at the saved backup point), and verify it cannot be
   replayed. Verify normal login, protected API and photos before deciding.
7. Only after explicit sign-off try `required` in isolated staging. Startup
   refuses required mode without two protected admins enrolled with tested and
   remaining recovery codes. Every regular user needs an invitation and setup.
   Confirm unenrolled accounts cannot reach app pages, state, photos, or actions.
   Production go/no-go is a separate explicit decision; do not assume it.

## Lost device, emergency and rollback

Use a saved one-time code and the Cloudflare sign-in first, or call Greg using a
known verified contact route. An admin can replace recovery codes from a fresh
TOTP session. If the authenticator needs a full reset, Greg validates the
person out of band, records the authorization and takes a backup. In a planned
maintenance window choose optional mode, leave Agent API off, and from the
trusted app host/container run the local-only script in the documented app
environment:
`node scripts/reset-user-authenticator.js user@example.org "RESET user@example.org"`.
It audits the reset, invalidates prior sessions and enrollment credentials,
and fences that user from business access until reenrollment. A second verified
administrator issues a new invitation. There is no browser bypass. If all
admins are unavailable, follow the offline recovery/rollback plan; do not
reset them blindly. A preplanned temporary fallback to the previously signed
Cloudflare-only app is a security downgrade; isolate traffic, get explicit
approval, disable Agent API, and verify access independently. Roll back code
and the app image tag only, leaving the database volume and additive table
intact and keeping encryption backups. Rotate affected agent credentials and
reanalyze access before returning to service.

## Separate Agent API acceptance

Do not enable until MFA is verified. Greg needs a **separate** Cloudflare Access
application on the exact machine API path with a Service Auth policy limited to
a dedicated service credential; not a bypass rule and not the human audience.
Keep the origin reachable only through approved infrastructure; verify direct
origin or credential-less requests cannot reach protected data. Configure
`BCI_AGENT_ACCESS_AUD` and `BCI_AGENT_ACCESS_COMMON_NAME` from the verified
service application/identity, and only then `BCI_AGENT_API=on` in staging.
The app checks the separate signed machine assertion and app token. Security
page management requires admin role and a TOTP verified in the last ten minutes.

The only exposed operation is GET `/api/agent/v1/status` using the machine edge
credentials plus `Authorization: Bearer <app token>`. Its response is release
and connection scope only. No prices, projects, work orders, payroll, or
generic actions are available. The token is displayed once; store it only in a
verified secure integration, not in chat, logs, a URL, or browser storage.
Verify missing edge identity, wrong audience, missing/expired app token,
unsupported path, and POST are all denied. Test app-token revoke and fresh
request separately from disabling/revoking the Cloudflare service credential
itself; revoking an edge session alone does not disable an active service
credential. Recheck with fresh sessions. Actual supported Dot transport must
be verified separately before establishing a connection or granting any
capability. This release does not connect Randy’s Agent or teach it tasks.

References: [Bitwarden Authenticator](https://bitwarden.com/help/bitwarden-authenticator/),
[Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
