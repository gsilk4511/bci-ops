# BCI Operations: .7.5 and .8.5 handoff for Randy and Greg

- **0.7.5** is the operations workflow release. **0.8.5** is cumulative and adds the permissions overhaul on top of 0.7.5. Use 0.7.5 as the comparison or rollback image. You do not need to roll 0.7.5 out to production before 0.8.5.
- **Randy:** Use a small sample job in staging. Confirm Tickets, Client Portal, the copper + fiber estimate and signed printout, draft work orders, a progress invoice and deposit, My Time, and a phone receipt upload. Sign off on who can see and change what before rolling out .8.5.
- **Greg:** Owns backup, staging, image build, permissions rollout, and rollback. Stage on gcccluster1 with the existing Cloudflare Access setup and a separate, protected database copy or synthetic data. Do not put the app in local development authentication mode on a public address.

## Before deploying

1. Record the currently running app image/tag/digest, active Compose project, file, build context, and app port. Keep the current image available. Back up the MariaDB data and the current source and configuration; verify the backup can be restored.
2. Extract the ZIP into a new scratch directory first. It has exactly one top-level `source/`. Use that clean application tree, not a ZIP overlay that leaves old modules behind, and do not create `source/source`.
3. Carry over the **existing** live `.env.secure`, `mariadb.env`, and **active** Compose file as appropriate for the machine. Leave the server's topology, Cloudflare credentials, `DB_HOST=db`, private bridge, app build path, ports and persistent MariaDB volume unchanged. Do not substitute the older Unraid Compose file. Compare the new bundled Compose only as an example. No database reseed is needed.
4. In the active Compose definition, set the **app** image tag to the version you are deploying, such as `bci-operations:0.8.5`, while keeping its existing build context pointing to the outer `source/` folder that contains the Dockerfile and package.json. If your file doesn’t have an app `build:` definition, stop here and build/tag the image explicitly from the clean source on the Docker host; plain Recreate won’t build it.

## Rebuild the app, not the database

From the existing Compose project directory **on the Docker host**, using the same project name/options as the current deployment (set `-p` if it was used) and substitute the actual active filename if different:

```sh
docker compose -f compose.secure.yml config --quiet
docker compose -f compose.secure.yml build bci-operations
docker compose -f compose.secure.yml up -d --no-deps --force-recreate bci-operations
docker compose -f compose.secure.yml ps
docker compose -f compose.secure.yml images bci-operations
```

Use an app-only build/recreate; don't use `down -v`, remove volumes, change database networks, or use `Recreate` against the old tag. Avoid pasting full inspect/config output containing secrets. Check the logo version and `/api/health` for the same new release and verify existing records through the authenticated app. Keep old images until staging and production smoke tests pass.

## Checks after the update

- Test each role with a separate sign-in, rather than doing everything as admin. Pick one tech, reviewer/office user, finance user, and authorized admin. For .8.5, verify a hidden screen and its data stay hidden, a read-only screen has no write controls, and Delete is absent without the relevant permission. Keep one confirmed admin signed in while reviewing custom profiles.
- Verify phone notes, receipt capture and view permissions, own-row edits, safe Trash recovery, the version beside the logo, and access to existing work orders and invoices. Create or select one **BCI ELITE ADMIN** project under the **Randy Bevins** billing client before testing the internal work order shortcut. Review staff balances before processing leave. Test payroll, mail and invoice workflows with sample records only until role and balance checks pass.
- QuickBooks remains the system of record: verify net amounts and deposit credits against the actual invoice before recording either. Emailing an estimate is a manual PDF attachment; the app does not send it for you.

## Rollback

If smoke tests fail, pause users' writes. Keep any incident data and back up the current state. Repoint **only the app** to the last verified image/tag, then recreate the app without rebuilding or touching dependencies. Do not restore an older DB snapshot over new activity as a routine step; new workflow fields and records may not behave the same way with a downgraded app. Verify rollback with a protected copy first if the new workflows have already been used.

Reference: [Docker: deploying changes with Compose](https://docs.docker.com/compose/how-tos/production/#deploying-changes).
