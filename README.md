# BCI Operations — Secure staging source

The React-free, mobile-responsive BCI Operations prototype has been extended into an **authenticated staging application** suitable for Greg's controlled gcccluster1/Cloudflare staging trial. It is **not a completed production accounting, payroll, or contractual e-signature platform**. For the current server, use **`UPDATE_LOG.md`** and **`docs/UPDATE_EXISTING_STAGING.md`**. The Unraid guide is legacy.

## Included and working in application logic
- Cloudflare Access JWT verification against signed team keys, issuer, audience, and expiry. Fail closed unless configured; the email must be on an additional BCI allowlist.
- Admin / office / tech access rules enforced in Node API. Admin team management and catalog pricing. Techs can create customers, projects, work orders, signed change orders, and daily entries.
- On-device drawn PNG signatures, explicit consent, captured time and BCI staff identity. Original signed scope, estimate, rates, journal and closeout snapshots retained. **The physical person's authority is not verified**.
- Change-order pricing separate from base rates; up to three items per change; change types Add / Move / Remove.
- Work-order labor, material, and travel journal; optional clock times for overlapping crew grouping logic; submitted closeout snapshots and office review before QuickBooks invoicing.
- Purchase/receipt references, received inventory, negative stock and audit adjustments, inventory transfer, auto-generated SKU/barcode value (camera barcode scanning and printable barcode label still need work).
- Money and reporting views, manual three-line QuickBooks handoff, payment confirmation; browser Print → Save as PDF.
- MariaDB persistence using a **transaction-locked JSON state table**. The single-record schema is a temporary staging design and must be normalized for the production release.
- The gcccluster1 app and MariaDB share the private Compose network. Keep the existing compose, port, volume and Cloudflare Access settings.

## Not yet built or certified
Native server PDF generator, barcode scanning, offline change/field entry queue, customer-facing self-service approvals, proper job dispatch scheduling, direct QuickBooks integration (intentionally excluded), full financial accounting, automatic card statement imports, overtime payroll calculations, normalized accounting schema, high-concurrency load tests, audit immutability/storage policies, verified signer identity and legal review. The UI shows detailed field journals and a type/date labor summary; the crew-overlap algorithm is unit-tested but a polished customer crew-billing display is pending.

## Developer-only local run
If using local mode, **never set NODE_ENV=production** and bind the host to loopback. Local mode simulates an admin for development only:

```bash
APP_AUTH_MODE=local NODE_ENV=development HOST=127.0.0.1 DB_PROVIDER=json PORT=3100 npm start
```

Open `http://127.0.0.1:3100`; this creates demo sample state in local `data`. For Cloudflare HTTPS staging follow the deploy guide; do not use local mode with NPM or a publicly routable IP.

## Tests

```bash
npm test
npm run check
```

Actual Cloudflare team tokens, MariaDB connectivity, gcccluster1 networking, browser behavior on real iPhones and restore testing **must be validated on Greg's environment**.

### Payroll and project invoice handoff

Log labor or travel on a released work order. When start and end are
provided, the app calculates elapsed hours. The signed-in employee is assigned automatically, and work notes are required.
Use My Time & Profile to check logged hours and request sick or vacation leave.
Perform internal work on a nonbillable work order under Randy Bevins → BCI ELITE ADMIN. Use the separate Add Receipt control for purchased materials. Office payroll reviewers choose
a date range, check exceptions, and confirm overtime hours per employee
before locking the period. Approved payroll is available as a CSV for
manual entry/reconciliation and a browser-printable accountant PDF.
QuickBooks remains the payroll processor. This release does not calculate
overtime eligibility or automate payroll posting.

After work-order review, use Create project invoice to select reviewed
work orders on one project, choose the customer detail layout, and print
or save as PDF. Enter the QuickBooks invoice reference after creating it
there. Work orders already attached to an invoice cannot be billed again.
Itemized descriptions can be edited in the draft without changing field
notes. Crew views use timestamp overlaps within each work order; untimed
labor is shown separately. Enter payments against any work order in the
recorded invoice group.

The update uses the existing application schema and deployment environment.
Test with a completed pay period and a multi-work-order project before live use.
