# Approved staged work

1. Foundation — release 0.5.0
   - Existing tab renderers split into modules
   - Module View and action gates, permission matrix, response filtering
   - Record corrections, guarded deletion, administrator Trash
   - Shared form/controller extraction continues during feature work
2. Pricing profiles — release 0.5.1
   - Client-first page, revenue confirmed in BCI Operations
   - Named profiles, duplicate/archive, fixed and markup part rates
   - Default parts markup 25% above latest tax-inclusive received cost
   - Work order > project > client > company assignment precedence
   - Bulk percentage previews and approved/history price protection
3. Tickets — release 0.5.2
   - Client-first active/completed queue and cross-client My work
   - Manual tickets and idempotent completed-work-order review tickets
   - Client management drill-down and linked work-order actions
4. Email intake and phone notifications — release 0.5.3
   - Dedicated Microsoft 365 mailbox connection
   - Deduplication, client suggestions, unassigned intake and safe attachments
   - Connection health, notification inbox, opt-in phone setup and test
5. Training — release 0.5.4
   - Guided overlays, arrows, skip/back/exit and progress
   - Isolated resettable training data
6. Remaining permission and lifecycle work
   - Assigned/all record scopes, explicit user access preview
   - Void/archive history-bearing records with appropriate reversal workflows
   - Extend record management to other applicable modules

All stages require readable comments, deployment packages with visible versions,
server enforcement, and verification through ordinary UI/API entry points.
