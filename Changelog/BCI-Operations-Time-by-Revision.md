# BCI Operations · Hands-on time by revision

**Modeled total: 167 h across 87 changelog cards.** The 86 earlier cards still total 166 h 40 m. The full-source packaging checkpoint adds 20 minutes without counting another rollout. No previous hour total was used as a target.

For each independent standard release: 30 minutes figuring out the idea + 15 prompting + 30 reviewing + 20 for rollout = 95 minutes. Increase prompting and review for larger work. Shared stages, version-only checks, and fixes within the same idea do not get a second 30-minute discovery charge; isolated staging checks do not assume a live rollout. Rollout time is an allowance, not proof Randy deployed a build. Excludes unattended build time, unrelated chat and work Greg did alone.

Timestamps establish when requests, rewrites and deliveries happened, not how long Randy was continuously at the keyboard. The estimates can exceed a chat window because research, reviewing files and rollout can occur outside it. The date is the build handoff in Eastern time, not installation. Totals follow the changelog order, which is not always chronological across alternate staging builds.

## Timestamp checks (Eastern)
- **0.7.5 / 0.8.5**, Nov 19, 8:35 AM to Nov 19, 9:51 AM: Tickets redesign through dual-build handoff; bundled planning and review share one session, permissions is a separate scope.
- **0.10.6**, Nov 26, 10:17 AM to Nov 26, 12:54 PM: First calendar request to ZIP handoff: Gantt/calendar mockups, revised calendar, field journal, pay charts, permissions, multiple combined prompt rewrites.
- **0.10.13**, Nov 26, 7:41 PM to Nov 27, 12:21 AM: Spec, revised categories, Excel working copy, review, real prices/stock, importer and confirmed import. Includes gaps; do not count wall time as active time.
- **0.10.16**, Nov 27, 10:12 PM to Nov 28, 12:46 AM: Spend Clock prototype, geographic filters, map feedback, campaign drilldown, then integration request; standalone iterations counted here once.
- **0.10.17**, Nov 28, 12:52 AM to Nov 28, 1:11 AM: Audition real recordings and Need for Speed clips, approve selection, receive source ZIP.

The project started with Randy’s November 7, 6:41 AM request. The pilot handoff followed at 8:33 AM. The original build conversation documents 40 cards; later release handoffs are in Randy’s Dot chat. The consolidated staging card uses the November 19 handoff that includes the layout and mobile Work Orders changes. The earlier same-tag staging ZIP did not contain that full set.

## Per-revision calculation

| Revision | Build handoff (ET) | Evidence | Change | Idea min | Prompt min | Review min | Rollout min | Time | Running | Basis |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| Pilot | 2026-11-07 8:33 AM | Original build chat | First runnable BCI Operations pilot | 30 | 55 | 80 | 20 | 3 h 5 m | 3 h 5 m | Multi-screen workflow or significant data/permission review |
| Branded pilot | 2026-11-07 8:40 AM | Original build chat | BCI mobile and desktop theme | 30 | 15 | 30 | 20 | 1 h 35 m | 4 h 40 m | Independent feature / standard revision |
| Local test v1 | 2026-11-07 9:02 AM | Original build chat | Windows test build | 30 | 30 | 55 | 20 | 2 h 15 m | 6 h 55 m | Several decisions, a longer spec, or extra verification |
| Local test v2 | 2026-11-07 9:21 AM | Original build chat | Technician rate categories | 30 | 15 | 30 | 20 | 1 h 35 m | 8 h 30 m | Independent feature / standard revision |
| Local test v3 | 2026-11-07 9:24 AM | Original build chat | Separate cost and selling price | 0 | 10 | 20 | 20 | 50 m | 9 h 20 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.4 era · Client hierarchy | 2026-11-09 3:15 PM | Original build chat | Billing clients, job contacts and projects | 30 | 30 | 55 | 20 | 2 h 15 m | 11 h 35 m | Several decisions, a longer spec, or extra verification |
| 0.4 era · Guided creation | 2026-11-09 6:03 PM | Original build chat | Guided client, contact and project setup | 30 | 15 | 30 | 20 | 1 h 35 m | 13 h 10 m | Independent feature / standard revision |
| 0.4 era · Permissions portal | 2026-11-09 6:17 PM | Original build chat | Saved staff access profiles | 30 | 30 | 55 | 20 | 2 h 15 m | 15 h 25 m | Several decisions, a longer spec, or extra verification |
| 0.4 era · JSON import | 2026-11-09 6:48 PM | Original build chat | Reviewed client and project import | 30 | 15 | 30 | 20 | 1 h 35 m | 17 h | Independent feature / standard revision |
| 0.4 era · CSV import | 2026-11-09 6:51 PM | Original build chat | Direct QuickBooks customer CSV | 30 | 15 | 30 | 20 | 1 h 35 m | 18 h 35 m | Independent feature / standard revision |
| 0.4 era · Payroll and invoices | 2026-11-09 7:35 PM | Original build chat | Payroll periods and project invoices | 30 | 30 | 55 | 20 | 2 h 15 m | 20 h 50 m | Several decisions, a longer spec, or extra verification |
| 0.4 era · Hardening | 2026-11-09 7:43 PM | Original build chat | Request safeguards and billing fixes | 0 | 10 | 20 | 20 | 50 m | 21 h 40 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.4.1 | 2026-11-09 8:59 PM | Original build chat | Per-client pricing and release verification | 30 | 15 | 30 | 20 | 1 h 35 m | 23 h 15 m | Independent feature / standard revision |
| 0.4.2 | 2026-11-09 9:15 PM | Original build chat | Project hub | 30 | 30 | 55 | 20 | 2 h 15 m | 25 h 30 m | Several decisions, a longer spec, or extra verification |
| 0.4.3 | 2026-11-09 9:19 PM | Original build chat | Scoped Database Testing | 0 | 5 | 15 | 0 | 20 m | 25 h 50 m | Local/staging checkpoint; no separate rollout assumed |
| 0.4.4 | 2026-11-09 11:46 PM | Original build chat | Primary contacts and clock | 30 | 15 | 30 | 20 | 1 h 35 m | 27 h 25 m | Independent feature / standard revision |
| 0.4.5 | 2026-11-10 8:24 AM | Original build chat | Cloudflare Access sync | 30 | 15 | 30 | 20 | 1 h 35 m | 29 h | Independent feature / standard revision |
| 0.4.6 | 2026-11-10 8:30 AM | Original build chat | Simpler Work Orders | 30 | 15 | 30 | 20 | 1 h 35 m | 30 h 35 m | Independent feature / standard revision |
| 0.4.7 | 2026-11-10 8:59 AM | Original build chat | Material catalog import | 30 | 30 | 55 | 20 | 2 h 15 m | 32 h 50 m | Several decisions, a longer spec, or extra verification |
| 0.4.8 | 2026-11-10 6:58 PM | Original build chat | Standard branded invoices | 30 | 15 | 30 | 20 | 1 h 35 m | 34 h 25 m | Independent feature / standard revision |
| 0.5.0 | 2026-11-10 8:31 PM | Original build chat | Foundation and recoverable records | 30 | 55 | 80 | 20 | 3 h 5 m | 37 h 30 m | Multi-screen workflow or significant data/permission review |
| 0.5.1 | 2026-11-10 9:21 PM | Original build chat | Pricing Profiles | 30 | 30 | 55 | 20 | 2 h 15 m | 39 h 45 m | Several decisions, a longer spec, or extra verification |
| 0.5.2 | 2026-11-10 11:08 PM | Original build chat | Tickets and review queue | 30 | 55 | 80 | 20 | 3 h 5 m | 42 h 50 m | Multi-screen workflow or significant data/permission review |
| 0.5.3 | 2026-11-10 11:41 PM | Original build chat | Microsoft 365 intake and notifications | 30 | 55 | 80 | 20 | 3 h 5 m | 45 h 55 m | Multi-screen workflow or significant data/permission review |
| 0.5.4 | 2026-11-10 11:49 PM | Original build chat | Guided Training | 30 | 15 | 30 | 20 | 1 h 35 m | 47 h 30 m | Independent feature / standard revision |
| 0.5.5 | 2026-11-10 11:54 PM | Original build chat | Staging audit fixes | 0 | 10 | 20 | 20 | 50 m | 48 h 20 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.5.6 | 2026-11-10 11:56 PM | Original build chat | iPhone notification setup fix | 0 | 10 | 20 | 20 | 50 m | 49 h 10 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.5.7 | 2026-11-11 12:09 AM | Original build chat | Estimates, navigation and home queues | 30 | 55 | 80 | 20 | 3 h 5 m | 52 h 15 m | Multi-screen workflow or significant data/permission review |
| 0.5.8 | 2026-11-11 7:42 AM | Original build chat | Invoices tab | 30 | 30 | 55 | 20 | 2 h 15 m | 54 h 30 m | Several decisions, a longer spec, or extra verification |
| 0.5.9 | 2026-11-11 7:51 AM | Original build chat | Work-order and invoice print layouts | 30 | 15 | 30 | 20 | 1 h 35 m | 56 h 5 m | Independent feature / standard revision |
| 0.6.0 | 2026-11-11 8:14 AM | Original build chat | Client pricing choices and corrections | 30 | 30 | 55 | 20 | 2 h 15 m | 58 h 20 m | Several decisions, a longer spec, or extra verification |
| 0.6.1 | 2026-11-11 8:37 AM | Original build chat | Live team access refresh | 30 | 15 | 30 | 20 | 1 h 35 m | 59 h 55 m | Independent feature / standard revision |
| 0.6.2 | 2026-11-11 10:01 AM | Original build chat | Estimate editor and conversion (staging) | 30 | 25 | 45 | 0 | 1 h 40 m | 61 h 35 m | New staging scope; no separate rollout assumed |
| 0.6.3 | 2026-11-11 11:55 AM | Original build chat | Projected stock and shortage tickets (staging) | 30 | 25 | 45 | 0 | 1 h 40 m | 63 h 15 m | New staging scope; no separate rollout assumed |
| 0.6.4 | 2026-11-11 12:06 PM | Original build chat | Container startup repair (staging) | 0 | 10 | 20 | 20 | 50 m | 64 h 5 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.6.5 | 2026-11-11 1:25 PM | Original build chat | Journal note corrections (staging) | 0 | 10 | 20 | 20 | 50 m | 64 h 55 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.6.6 | 2026-11-11 2:20 PM | Original build chat | Printed journal columns (staging) | 30 | 25 | 45 | 0 | 1 h 40 m | 66 h 35 m | New staging scope; no separate rollout assumed |
| 0.6.7 | 2026-11-11 2:57 PM | Original build chat | Base pricing, paid travel and custom reports (staging) | 30 | 25 | 45 | 0 | 1 h 40 m | 68 h 15 m | New staging scope; no separate rollout assumed |
| 0.6.8 | 2026-11-12 11:26 AM | Original build chat | Read-only connector (separate staging build) | 30 | 25 | 45 | 0 | 1 h 40 m | 69 h 55 m | New staging scope; no separate rollout assumed |
| 0.6.9 | 2026-11-12 11:31 AM | Original build chat | Read-only job briefings (separate staging build) | 0 | 15 | 30 | 0 | 45 m | 70 h 40 m | Shared work already scoped with its companion release; distinct review only |
| 0.6.5-staging.1 (main source) | 2026-11-19 8:21 AM | Dot handoff | Consolidated staging source | 0 | 15 | 30 | 0 | 45 m | 71 h 25 m | Shared work already scoped with its companion release; distinct review only |
| 0.7.5 | 2026-11-19 9:51 AM | Dot handoff | Operations workflow revision | 30 | 90 | 115 | 20 | 4 h 15 m | 75 h 40 m | Combined Tickets, clients, billing, estimator, generated work orders, and staff workflows |
| 0.8.5 | 2026-11-19 9:51 AM | Dot handoff | Team permissions and record access | 30 | 55 | 80 | 20 | 3 h 5 m | 78 h 45 m | Multi-screen workflow or significant data/permission review |
| 0.8.5.1 | 2026-11-19 1:27 PM | Dot handoff | Logo badge verification build | 0 | 5 | 15 | 0 | 20 m | 79 h 5 m | Local/staging checkpoint; no separate rollout assumed |
| 0.8.6-catalog.1 | 2026-11-19 10:58 PM | Dot handoff | Manufacturer catalog and part photos | 30 | 75 | 100 | 20 | 3 h 45 m | 82 h 50 m | Many catalog and image decisions across repeated review passes |
| 0.8.6-catalog.2 | 2026-11-20 8:49 AM | Dot handoff | Print pagination and financial privacy | 30 | 15 | 30 | 20 | 1 h 35 m | 84 h 25 m | Independent feature / standard revision |
| 0.8.6-catalog.3 | 2026-11-20 9:30 AM | Dot handoff | Two-row Original Field Journal | 0 | 10 | 20 | 20 | 50 m | 85 h 15 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.8.6-catalog.4 | 2026-11-20 11:02 AM | Dot handoff | Single BCI Warehouse grid | 30 | 30 | 55 | 20 | 2 h 15 m | 87 h 30 m | Several decisions, a longer spec, or extra verification |
| 0.8.6-catalog.5 | 2026-11-20 11:10 AM | Dot handoff | Warehouse receipts and field purchases | 30 | 55 | 80 | 20 | 3 h 5 m | 90 h 35 m | Multi-screen workflow or significant data/permission review |
| 0.8.6-catalog.6 | 2026-11-20 11:18 AM | Dot handoff | Admin changelog and visible part colors | 30 | 30 | 55 | 20 | 2 h 15 m | 92 h 50 m | Several decisions, a longer spec, or extra verification |
| 0.8.6-catalog.7 | 2026-11-20 12:12 PM | Dot handoff | Warehouse and catalog export | 30 | 15 | 30 | 20 | 1 h 35 m | 94 h 25 m | Independent feature / standard revision |
| 0.8.6-catalog.8 | 2026-11-20 12:42 PM | Dot handoff | Warehouse filters and faster material lookup | 30 | 30 | 55 | 20 | 2 h 15 m | 96 h 40 m | Several decisions, a longer spec, or extra verification |
| 0.8.6-catalog.9 | 2026-11-20 3:29 PM | Dot handoff | Dedicated Services tab | 30 | 15 | 30 | 20 | 1 h 35 m | 98 h 15 m | Independent feature / standard revision |
| 0.8.6-catalog.10 | 2026-11-20 3:52 PM | Dot handoff | Warehouse reset and image-free grid | 30 | 15 | 30 | 20 | 1 h 35 m | 99 h 50 m | Independent feature / standard revision |
| 0.8.6-catalog.11 | 2026-11-20 5:36 PM | Dot handoff | Delete unused imported parts | 0 | 10 | 20 | 20 | 50 m | 100 h 40 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.8.7 | 2026-11-21 4:54 PM | Dot handoff | My Time & Profile command center | 30 | 55 | 80 | 20 | 3 h 5 m | 103 h 45 m | Multi-screen workflow or significant data/permission review |
| 0.8.8 | 2026-11-21 4:58 PM | Dot handoff | Business Manager dashboard | 30 | 15 | 30 | 20 | 1 h 35 m | 105 h 20 m | Independent feature / standard revision |
| 0.8.9 | 2026-11-21 7:58 PM | Dot handoff | Profile Studio and technician badges | 30 | 30 | 55 | 20 | 2 h 15 m | 107 h 35 m | Several decisions, a longer spec, or extra verification |
| 0.9.0 | 2026-11-21 8:21 PM | Dot handoff | Technician contribution and bonus projection | 30 | 55 | 80 | 20 | 3 h 5 m | 110 h 40 m | Multi-screen workflow or significant data/permission review |
| 0.9.1 | 2026-11-21 8:25 PM | Dot handoff | Work-time bonus formula | 0 | 10 | 20 | 20 | 50 m | 111 h 30 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.9.2 | 2026-11-21 8:37 PM | Dot handoff | Full-page staff themes | 30 | 30 | 55 | 20 | 2 h 15 m | 113 h 45 m | Several decisions, a longer spec, or extra verification |
| 0.9.3 | 2026-11-23 10:53 PM | Dot handoff | Work-order corrections, shared travel and vehicle profiles | 30 | 55 | 80 | 20 | 3 h 5 m | 116 h 50 m | Multi-screen workflow or significant data/permission review |
| 0.9.4 | 2026-11-23 11:35 PM | Dot handoff | Pricing tables and profile editing | 30 | 30 | 55 | 20 | 2 h 15 m | 119 h 5 m | Several decisions, a longer spec, or extra verification |
| 0.9.5 | 2026-11-23 11:51 PM | Dot handoff | User Security and Agent API staging | 30 | 25 | 45 | 0 | 1 h 40 m | 120 h 45 m | New staging scope; no separate rollout assumed |
| 0.9.6 | 2026-11-24 12:17 AM | Dot handoff | BCI Operations sign-in staging | 0 | 15 | 30 | 0 | 45 m | 121 h 30 m | Shared work already scoped with its companion release; distinct review only |
| 0.9.7 | 2026-11-24 10:09 AM | Dot handoff | Employee time reconciliation | 30 | 30 | 55 | 20 | 2 h 15 m | 123 h 45 m | Several decisions, a longer spec, or extra verification |
| 0.9.8 | 2026-11-24 1:09 PM | Dot handoff | Correct work-order service types | 30 | 15 | 30 | 20 | 1 h 35 m | 125 h 20 m | Independent feature / standard revision |
| 0.9.9 | 2026-11-24 1:14 PM | Dot handoff | Log Materials part grid | 30 | 15 | 30 | 20 | 1 h 35 m | 126 h 55 m | Independent feature / standard revision |
| 0.10.0 | 2026-11-25 11:57 PM | Dot handoff | Fleet schedules and live My Time | 30 | 55 | 80 | 20 | 3 h 5 m | 130 h | Multi-screen workflow or significant data/permission review |
| 0.10.1 | 2026-11-26 12:40 AM | Dot handoff | Fleet cards and vehicle profile styles | 30 | 30 | 55 | 20 | 2 h 15 m | 132 h 15 m | Several decisions, a longer spec, or extra verification |
| 0.10.2 | 2026-11-26 12:58 AM | Dot handoff | Unbilled work in Money | 30 | 15 | 30 | 20 | 1 h 35 m | 133 h 50 m | Independent feature / standard revision |
| 0.10.3 | 2026-11-26 1:18 AM | Dot handoff | Customize Dashboard and manage access | 30 | 55 | 80 | 20 | 3 h 5 m | 136 h 55 m | Multi-screen workflow or significant data/permission review |
| 0.10.4 | 2026-11-26 8:43 AM | Dot handoff | Live bonus and profile card appearance | 30 | 30 | 55 | 20 | 2 h 15 m | 139 h 10 m | Several decisions, a longer spec, or extra verification |
| 0.10.5 | 2026-11-26 9:58 AM | Dot handoff | Wide screens and profile weather | 30 | 15 | 30 | 20 | 1 h 35 m | 140 h 45 m | Independent feature / standard revision |
| 0.10.6 | 2026-11-26 12:54 PM | Dot handoff | Scheduling, Team permissions, and time entry | 30 | 95 | 120 | 20 | 4 h 25 m | 145 h 10 m | Combined 12-item spec, successive rewrites, scheduling mockups, permissions and acceptance checks |
| 0.10.7 | 2026-11-26 1:51 PM | Dot handoff | Live contribution estimates and bonus meter | 30 | 30 | 55 | 20 | 2 h 15 m | 147 h 25 m | Several decisions, a longer spec, or extra verification |
| 0.10.8 | 2026-11-26 2:15 PM | Dot handoff | Contribution cost follows Worked hours | 0 | 10 | 20 | 20 | 50 m | 148 h 15 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.10.9 | 2026-11-26 2:24 PM | Dot handoff | Staff pay scale and holiday requests | 30 | 15 | 30 | 20 | 1 h 35 m | 149 h 50 m | Independent feature / standard revision |
| 0.10.10 | 2026-11-26 2:50 PM | Dot handoff | Prevent duplicate Holiday time | 0 | 10 | 20 | 20 | 50 m | 150 h 40 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.10.11 | 2026-11-26 3:59 PM | Dot handoff | Vehicle trip and hourly travel charges | 30 | 15 | 30 | 20 | 1 h 35 m | 152 h 15 m | Independent feature / standard revision |
| 0.10.12 | 2026-11-26 4:31 PM | Dot handoff | Sort the Original Field Journal by work date | 0 | 10 | 20 | 20 | 50 m | 153 h 5 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.10.13 | 2026-11-27 12:10 AM | Dot handoff | Warehouse catalog import and stock targets | 30 | 110 | 140 | 20 | 5 h | 158 h 5 m | Revised catalog spec, workbook review, pricing and stocking decisions, confirmed import |
| 0.10.14 | 2026-11-27 12:26 AM | Dot handoff | Compact Warehouse grid | 0 | 10 | 20 | 20 | 50 m | 158 h 55 m | Follow-up to an already counted idea; 20-minute rollout allowance |
| 0.10.15 | 2026-11-27 1:44 PM | Dot handoff | Customizable menu sounds | 30 | 15 | 30 | 20 | 1 h 35 m | 160 h 30 m | Independent feature / standard revision |
| 0.10.16 | 2026-11-28 12:46 AM | Dot handoff | Admin Spend Clock and profile market feed | 30 | 85 | 100 | 20 | 3 h 55 m | 164 h 25 m | Spend Clock design and map iterations, campaigns, admin integration and RSS; counted once here |
| 0.10.17 | 2026-11-28 1:11 AM | Dot handoff | Selectable vehicle card sounds | 30 | 30 | 55 | 20 | 2 h 15 m | 166 h 40 m | Several decisions, a longer spec, or extra verification |
| 0.10.18 | 2026-11-28 | Full source ZIP | Complete changelog dates and hands-on time | 0 | 5 | 15 | 0 | 20 m | 167 h | Packaging and review only; replaces the overlay, not a second rollout |
