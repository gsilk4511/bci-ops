# Guided Training

Open **Training → Start training**. The orange **Practice mode** guide
shows the current lesson. **Show me** opens the relevant screen, highlights
the action, and focuses it. **Back**, **Next**, and **Skip** move between
available lessons. **Exit training** returns to the operational app. Open
Training again to resume. Reset your workspace to repeat the exercise.

The walkthrough covers client, optional contact, project, work order,
approval, labor, travel, materials, closeout, review, and invoice detail.
Use fictional customer information and a practice signature. Sample orders
at different stages give users a place to practice when their access profile
omits an earlier action. If you print from training, the document is labeled
**PRACTICE INVOICE · TRAINING ONLY**.

Existing custom access profiles need **Training View**. Each exercise also
requires the matching operational view and action grants. Administrators can
reset all practice workspaces from the live Training tab.

The browser selects a distinct practice API for both reads and writes.
The server checks the user's current grants and runs an allowlisted exercise
action against that user's private practice state. The practice state is
persisted under its own key in the existing database state document.
Operational views, inventory, payroll, invoices, email intake, and alerts
read the operational state. There is no SQL migration.

The walkthrough is in public/modules/training.js. The API and sample
workspace are in Models/training.js and Server/server.js. Verify with npm run check and
npm test. Browser layout and signoff interaction should be checked in staging
on a phone and desktop.
