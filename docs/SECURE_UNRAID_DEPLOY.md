# BCI Operations v0.4 — Greg's staged Unraid release plan

**This release is an authenticated functional staging app, not approved for production use.** Do not enter actual client information until the staging acceptance tests, legal approval/signature review, backup restoration test, and authorization testing are complete.

## Existing network (observed November 7, 2026)
- Unraid host: `10.50.6.72`.
- MariaDB/LAMP macvlan: `10.50.6.5`.
- Nginx Proxy Manager: `10.50.6.10`.
- Cloudflare Tunnel: `10.50.6.6`.
- Existing Docker `eth0` macvlan subnet: `10.50.6.0/24`; reserved application address: `10.50.6.20`.
- v0.3 demo container: `bci-operations-staging`, published only to `127.0.0.1:3100` on Unraid. **Leave running during v0.4 validation**; v0.4 uses a DIFFERENT container name and MariaDB staging database.

## Prerequisites — check and back up first
1. Take an Unraid appdata and MariaDB backup; verify that you can restore the database on a nonproduction system.
2. In Adminer, create `bci_operations_stage` (not existing `bci_operations`) and a restricted account using the template `scripts/init-stage.sql`, replacing the sample password with a unique secret; execute `sql/001_pilot.sql` **within `bci_operations_stage`**, not your existing database.
3. Confirm `10.50.6.20` remains reserved, and MariaDB allows connections from that address to `10.50.6.5:3306`. Do not open port 3306 to the internet.
4. In Cloudflare Zero Trust, create a **self-hosted Access application** for the exact future hostname, for example `ops.example.com`. Default-deny; grant only known emails or groups; require your preferred MFA policy. Copy the team's `https://TEAM.cloudflareaccess.com` domain and the **Application Audience (AUD) tag**.
5. Create a Cloudflare Tunnel public hostname routing to the NPM HTTP address `http://10.50.6.10:80`, if your current Tunnel-to-NPM route uses that pattern. Alternatively route directly to `http://10.50.6.20:3100` and omit NPM for this hostname. If you use NPM, add a dedicated proxy host for the hostname with forward address `10.50.6.20` / port `3100`; preserve the `Cf-Access-Jwt-Assertion` header. For a private internal HTTP hop, restrict LAN reachability; TLS from the browser to Cloudflare remains mandatory. Do not change existing proxy hosts.
6. Verify that Cloudflare Access protects the exact hostname *before* enabling the public Tunnel route. For defense in depth turn on Tunnel **Protect with Access** if supported by your existing tunnel configuration. The Node app independently validates the Access JWT signature, issuer, audience and expiry; a direct LAN request without the JWT returns 401.

## Deploy as NEW, isolated container
Extract this ZIP into a new directory, not the current v0.3 `source` folder:

`/mnt/user/appdata/bci-operations-secure/source/`

Keep `.env.secure` outside SMB/public shares when possible and chmod to `600`.

```sh
cd /mnt/user/appdata/bci-operations-secure/source
cp .env.secure.example .env.secure
chmod 600 .env.secure
```

Edit `.env.secure` locally with team domain, AUD, BCI admin email, public origin, staging DB credentials. **Do not put those secrets in ChatGPT or screenshots.** Set `ALLOW_DEMO_SEED=YES` in this file for the new empty `bci_operations_stage` database only, then remove it after the initial boot (recreating the container without changing the database). The demo seed is sample-only and includes an obviously fake customer.

Build and start **only this new Compose service**:

```sh
docker compose -f compose.secure.yml config --quiet
docker compose -f compose.secure.yml up -d --build
docker ps --filter name=bci-operations-secure
docker logs --tail 60 bci-operations-secure
```

The new container has its own macvlan IP `10.50.6.20:3100` with **no host port publication**. Confirm it responds within its own network namespace:

```sh
docker exec bci-operations-secure node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
```

From a normal LAN PC, `http://10.50.6.20:3100/api/state` must return 401 without a token; do not mistake successful `api/health` for a security test. On the public hostname, verify Cloudflare Access forces login; after login, an email in the admin bootstrap list should load the app. An Access-authorized email not on the app's list should receive 403 until the admin adds the account in **Team**.

## Roles
- Tech: create customers, projects, work orders, changes; capture approval signatures; log time, parts, travel; receive inventory; submit closeout.
- Office: additionally view financial reports, review closeout, confirm manual QuickBooks invoices/payments, transfer/adjust stock.
- Admin: additionally edit price catalog, approve app users, change reserve percentage. Administrators set by `BCI_ADMIN_EMAILS` are always admins.

## Validation before real use
- From iPhone and desktop: create sample customer/project/work order; confirm no entries before drawn-signature approval; add three-line change order and obtain drawn client consent; enter time and issue more material than on hand; closeout; office review; print PDF; record a fake QB reference and partial payment.
- Restart **only the BCI container**, then ensure all records remain in MariaDB.
- Check `GET /api/state` has no access without Access JWT even from the LAN; test a non-allowlisted account and a tech account against office-only actions.
- Test backups and restore of stage database. Test Access logout on shared iPhones, and clear any old v0.3 browser service-worker cache (the new frontend unregisters it automatically on successful load).
- **Signer warning:** a drawn signature proves input was recorded but does not by itself establish the signer’s legal identity or authority. The app logs the authenticated BCI employee who captured the signature and stores the exact approved scope and estimate. Validate your approval agreement with counsel before replacing your existing customer contracts.

## Rollback
Stop only new container:

```sh
docker stop bci-operations-secure
```

Do not run `docker compose down -v` on other stacks. The v0.3 JSON pilot remains separately available on Unraid loopback, and the `bci_operations_stage` database remains unchanged. You can remove the new proxy hostname/tunnel route without changing any existing routes.

## What is still NOT production-ready
- MariaDB currently stores the app state in **one transaction-locked JSON document**, not normalized tables. That is durable for staging but inadequate for higher-volume multi-user production and audit retention.
- No offline queue, photo/receipt uploads, camera barcode scanner, vendor reconciliation imports, schedule/dispatch, automated payroll overtime rules, or native PDF generator. PDF comes from browser Print → Save as PDF.
- No client-facing self-service login; field signature is captured on the technician's device. No independently verified signer identity.
- No automated tests against a live MariaDB/Cloudflare account or iPhone device in this environment; these need Greg's staged validation.

## Owner-only Database Testing

Set BCI_TESTING_OWNER_EMAIL in the deployment's .env.secure to the exact
Cloudflare Access email of the one existing BCI admin who should see the tab.
Recreate the app container using the updated source and existing environment.
The tab stays off when the value is empty or MariaDB is not configured.
It uses the application's existing MariaDB account and read privileges.
The inspector lists accessible base tables in DB_NAME and pages through rows
with read-only queries. The pilot's records are under pilot_state.state_json.
