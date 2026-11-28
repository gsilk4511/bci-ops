# BCI Operations v0.10.20 | Full source release

This ZIP contains one top-level `source/` folder. It includes the entire application, Dockerfile, dependency lockfile, migrations, tests, admin changelog, guided Estimates workspace, offline Takeoff Lab and the seasonal header/snow effect. No earlier ZIP or patch is needed. There is no prebuilt Docker image in this archive.

## Greg: update the existing staging stack

1. Back up the current source and staging MariaDB including its drawing table if present. Record the working image tag. Extract into a clean location and point the app's build context at the extracted `source/` folder. If you reuse the existing source directory, copy the **contents** into it without nesting another `source/`. Preserve your real Compose file, environment files, credentials, named volumes, database name, and network. The included examples are reference only.
2. Check the existing app database for the drawing table defined in [003_estimate_plan_storage.sql](../sql/003_estimate_plan_storage.sql). If missing (for example, an upgrade from 0.10.18), apply that additive SQL to the staging app database with a database administrator. The app account needs SELECT and INSERT on the table. If it is already present, there is no new holiday migration. Do not reseed an existing database. For a fresh isolated stage instead, initialize the empty app database with `001_pilot.sql`, and `003_estimate_plan_storage.sql` for drawings. Use `002_user_security.sql` when setting up optional BCI Sign-In per [the security guide](USER_SECURITY.md). Keep the existing authentication mode on an upgrade.
3. Set the app image tag to `bci-operations:0.10.20`; leave the database service alone. Using the real Compose filename and service (examples below), build and recreate only the app container.

```sh
docker compose -f compose.bci-operations-fixed.yml config --quiet
docker compose -f compose.bci-operations-fixed.yml up -d --build --no-deps --force-recreate bci-operations
docker compose -f compose.bci-operations-fixed.yml exec -T bci-operations node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>r.json()).then(console.log)"
```

4. Verify **v0.10.20** in health and the header. Use staging users to check sign-in, the existing dashboard and work orders, and a synthetic estimate (draft → reviewed takeoff or private PDF → client agreement → unreleased work orders). See [Estimates walkthrough](ESTIMATES-01019.md#try-it). If using drawings, confirm proxy and database limits accommodate a 10 MB PDF (roughly 13.4 MB in the JSON request). On desktop and phone, check the seasonal header, a short flurry after about 35 seconds in the foreground, Reduce Motion, and normal form input and print layout.
5. To roll back, restore the prior source/image and build reference, retaining the database and new drawing table. Back up and preserve new drafts and approved agreements before reverting; do not edit records created with the new editor from an older version or restore an old database blindly.

## Release contents and exclusions

- Licensed Ram V8 and Honda V6 vehicle sounds remain included with attribution. Previously selected game sounds appear as Off in this build, without rewriting stored vehicle records during deployment. The Docker build excludes leftover game audio, but **publishing this ZIP does not remove any earlier Git history or registry images**.
- No real environment files, database, customer attachments, dependency directory, extracted game audio, or private chat links in the changelog worksheet are bundled.
- For local verification, use Node 20+ (Docker uses Node 22), then `npm ci`, `npm run check`, and `npm test`. Automated HTTP tests use the disposable JSON adapter. Test MariaDB, Cloudflare and phones on your actual staging stack before promoting.
