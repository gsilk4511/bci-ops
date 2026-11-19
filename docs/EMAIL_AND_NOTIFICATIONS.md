# Microsoft 365 email intake and phone notifications

## Mailbox setup

Create a dedicated Exchange Online mailbox and a single-tenant Microsoft
Entra application with a client secret. Have your Microsoft 365 administrator
grant the application the Exchange Online RBAC role **Application Mail.Read**
scoped to that one mailbox. Use the Object ID of the enterprise application's
service principal. An organization-wide Entra Mail.Read grant is additive
and would bypass the mailbox restriction.

After connecting to Exchange Online PowerShell, an administrator can set
the scope using a unique alias for the intake mailbox:

```powershell
New-ServicePrincipal -AppId "<application-client-id>" -ObjectId "<enterprise-app-object-id>" -DisplayName "BCI Operations Intake"
New-ManagementScope -Name "BCI Operations Intake Mailbox" -RecipientRestrictionFilter "Alias -eq 'bci-intake'"
New-ManagementRoleAssignment -App "<enterprise-app-object-id>" -Role "Application Mail.Read" -CustomResourceScope "BCI Operations Intake Mailbox"
Test-ServicePrincipalAuthorization -Identity "<enterprise-app-object-id>" -Resource "<intake-mailbox-address>"
```

Check the intake mailbox is in scope and a different mailbox is out of scope.
Use the actual unique alias in the filter. Confirm the service principal has
no separate broad Microsoft Graph mail grants.

Add these values to the existing deployment environment file:

```dotenv
BCI_MAIL_TENANT_ID=
BCI_MAIL_CLIENT_ID=
BCI_MAIL_CLIENT_SECRET=
BCI_MAIL_ADDRESS=
# Optional ISO timestamp. Default is the first successful sync's startup time.
# BCI_MAIL_START_AT=2026-11-01T00:00:00Z
```

The application reads the dedicated mailbox Inbox. Use its sign-in address for
BCI_MAIL_ADDRESS. The container needs outbound HTTPS to Microsoft login and
Graph. After rebuilding and restarting the container, go to **Tickets →
Email intake → Sync now**. The screen and Team administration show the mailbox,
last successful sync, and error status.

Forward a test email to the mailbox. Forwarded messages and uncertain matches
appear in **Unassigned intake**. Confirm a suggestion or choose a billing
client. If necessary, create a client from the intake screen and then assign
the email. A unique direct sender match creates a ticket automatically.
Replies with the same Graph conversation ID join a single open ticket for that
client. Ambiguous threads create a separate ticket or go to intake.

The application records the sender, recipients, subject, received time,
and up to 100,000 characters of plain-text body. It retains up to eight
non-inline file attachments per email, up to 250 KB each. The original email
and larger attachments are available in Microsoft 365. Sync runs each minute,
with up to four Graph pages per run. The stored cursor and message IDs prevent
repeat import, including after a message's ticket is deleted.

Grant **Triage intake email**, **Tickets View**, and **Create tickets** for
manual assignment. **Read imported ticket email** governs email contents and
attachment downloads after assignment, together with ticket scope.

Microsoft reference
https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac

## Phone setup

Install the application dependencies and generate one persistent VAPID key
pair for the deployment:

```sh
npm install
npx web-push generate-vapid-keys --json
```

Keep the private key in the environment file. Use the same key pair across
rebuilds so registered devices continue to work.

```dotenv
BCI_PUSH_PUBLIC_KEY=
BCI_PUSH_PRIVATE_KEY=
BCI_PUSH_SUBJECT=mailto:ops@example.com
```

Set the subject to a monitored contact email. Push delivery uses HTTPS and
requires outbound access to the browser's push service. The application
itself must be served over HTTPS. On iOS or iPadOS 16.4 or later, add BCI Ops
to the Home Screen, open it from there, and sign in. Open **Notifications →
Enable on this device**, then choose **Send test notification**. The test
goes to the device where you tap the button. You can register up to eight
devices per account. Notification settings cover assignment, overdue tickets,
review, and unassigned intake, plus quiet hours in your chosen time zone.

The inbox is available with the **Notifications View** grant. Phone alerts
contain generic text and open an authenticated ticket, intake, or notification
view. Users can mark an alert read. An overdue alert is sent once for a
ticket's current due date. Delivery checks run every 30 seconds and retain
per-device receipts. An offline device is subject to its provider's delivery
limits. Alerts are only shown while their source remains visible and relevant.

Apple reference
https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/

## Verification

Run npm run check and npm test. Automated tests use a simulated Microsoft
Graph response and push sender. On staging, verify that the scoped mailbox
can sync, a forwarded message can be assigned, and an actual registered
phone receives the test notification. The release uses the existing state
storage and requires no SQL schema migration.
