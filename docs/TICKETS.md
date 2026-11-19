# Tickets

Open Tickets to see active, completed, overdue, and assigned tickets by
billing client. Select a client for their contacts, projects, work orders,
and ticket list. My work shows tickets assigned to the signed-in user.
The Review queue lists active work order review tickets.

Create a ticket under a billing client. Project, work order, and job contact
links are optional and must belong to that client. Internal notes and client
correspondence have distinct labels. Correspondence entries are manually
recorded. Attachments download as files, up to 250 KB each and eight per ticket.

Submitting a work order adds one review ticket. Existing unreviewed closeouts
also appear in the queue. Open the linked work order to inspect its entries and
approvals. Mark reviewed enables invoicing and completes the review ticket.
Request corrections saves the submitted snapshot, returns the order to Released,
and keeps the ticket active until review. The crew can add missing entries and
resubmit. Existing entry editing is governed by the existing work order rules.

The Tickets permission row controls view, create, edit, and delete. View all
tickets expands visibility beyond the user's own or assigned tickets. Work
order reviewers can see linked review tickets. Assignment, notes, attachments,
and work order review have separate grants. Existing custom profiles need the
new grants selected. Manual ticket deletion uses the red confirmation and
administrator Trash. Review tickets follow work order history.

The browser module is public/modules/tickets.js. Models/tickets.js owns ticket
validation, visibility, and the review lifecycle. Models/lib.js connects closeout,
review, and correction actions. The release uses the existing state transaction
and needs no SQL schema migration. See EMAIL_AND_NOTIFICATIONS.md for intake and notification setup.
