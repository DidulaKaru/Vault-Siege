# Vault-Siege local audit — 10 November 2026

**Verdict: NOT READY for sign-off as a local progress evaluation.** The fixes,
frontend build, lint and isolated application checks pass. Docker runtime and
persistent-volume verification are still blocked by Docker socket permissions.
This verdict reflects missing runtime evidence, not a failing application test.

## Confirmed bugs and fixes

| Files | Root cause and implemented fix |
| --- | --- |
| `client/src/components/PlayView.jsx`, `client/src/playerSession.js`, `client/src/api.js` | Completion changed React state without saving the session and triggered another stage request. Completion now persists, completed sessions skip stage retrieval, and older saved sessions recover from the server's completion response. Logout clears answers/hints and team switching is disabled during submission. Submissions carry the displayed stage number. |
| `server/routes/play.js`, `server/services/progress.js` | Progression checked only `current_stage_order + 1`, marking a team completed across a gap. It now selects the lowest existing later stage, locks the team before reading its puzzle, and records that exact next stage transactionally. Stage retrieval repairs a deleted current stage by selecting the next existing stage. Empty hunts or missing terminal stages return a useful 404 without marking unsolved teams completed. Completed teams get a completion response. |
| `server/routes/play.js` | Duplicate submissions could apply to the next puzzle when answers matched. A required `stage_order` is compared after obtaining the team lock; stale submissions return 409. Completed submissions are idempotent. Connection acquisition is now inside error handling. |
| `docker-compose.yml`, `server/db/initDb.js` | The old shell initialized after any probe failure, and direct repeated initialization failed on existing tables. Initialization now runs a transactional schema probe under an advisory lock. A complete schema is preserved, a partial schema stops startup, and query/connection failures propagate without seeding. A new database uses ADMIN_PASSWORD directly instead of a hardcoded password followed by an unconditional password reset. Existing admin passwords are preserved. |
| `server/routes/admin.js`, `client/src/components/AdminPanel.jsx` | Invalid/duplicate stage requests were silently assigned another number. Explicit invalid stages now return 400 and duplicates 409. Only omitted stages are assigned automatically. Blank fields, nonpositive updates, invalid regexes and malformed SHA256 targets are rejected. Invalid UUID/foreign-key/length errors return 400. The UI suggests `MAX(stage_order) + 1` instead of `puzzles.length + 1`, and an expired saved admin token returns to login. |
| `server/routes/play.js`, `server/middleware/auth.js` | Public join could resume an existing team using its name alone, and new access codes were predictable names. Existing teams must use access-code login; new teams get random codes. Ambiguous codes across active hunts are rejected instead of selecting an arbitrary team. The known JWT-secret fallback is removed; JWT_SECRET is required. |
| `server/index.js`, `server/db/index.js`, `docker-compose.yml` | The old health check accepted HTTP 404 without testing the database. `/health` now tests PostgreSQL and returns 200 or 503; Compose requires 200. Database connection attempts have a finite timeout. Unexpected API errors and malformed JSON get JSON responses. |
| `client/.dockerignore`, `server/.dockerignore`, both Dockerfiles, both `bun.lock` files, `.gitignore`, `server/package.json` | Build contexts included host dependencies, environment files and outputs. Ignore files now exclude them. Docker uses Node 22 and npm: the frontend runs npm ci and npm run build; the backend runs npm install --omit=dev to reconcile its manifest with the existing npm lockfile. The backend runtime excludes dev dependencies. Missing nodemon is declared. Local Bun workflows remain separate from Docker builds. |
| Both package manifests, `server/tests/regression.test.js`, `client/tests/playerSession.test.js` | Added repeatable regression commands. The backend tests use PGlite as a development-only dependency, not as an application database. |
| `README.md`, `.env.example`, `AUDIT.md` | Corrected local commands, initialization/password semantics, API changes and verification instructions. The user's `.env` was not changed. |

The application ports, React styling, Express/PostgreSQL architecture, browser's
localhost API URL, Nginx configuration, database schema and named volume remain
in place. No database records or volumes were removed, and no commit or push
was performed. Existing completion flags are preserved; the audit does not
attempt to infer or reset teams incorrectly completed by older code.

## Verification actually executed

| Check | Result |
| --- | --- |
| Bun dependency installation in `client` and `server` | Passed after retrying network access. Initial attempts failed on a read-only temporary directory and DNS; `/tmp` cache settings and permitted network access resolved downloads. |
| `bun run --cwd client test` | Passed: 1 session regression test covering persistence, logout/team switch and malformed storage. |
| `bun run --cwd client lint` | Passed. |
| `bun run --cwd client build` | Passed with Vite 8.1.5. |
| `bun run --cwd server test` | Passed: 9 tests exercising actual route HTTP calls and application SQL against an isolated PostgreSQL engine. Covers all validators, gap progression, missing/empty stages, completion/relogin, team isolation, duplicate requests, admin CRUD/validation, authentication, database failures, repeated initialization and partial schemas. |
| Backend `node --check` on source/test JavaScript | Passed. |
| `docker compose config --quiet` | Passed. No resolved secrets were printed. Required environment values are present; current database URL components do not contain characters requiring URL encoding. |
| `docker version`, `docker compose ps -a`, `docker compose up --build -d`, container logs | Docker CLI and Compose exist, but daemon socket access fails with permission denied. Retrying with available elevated execution also failed; sudo is unavailable under the execution restrictions. |
| Requests to `localhost:8080` and `localhost:5000/health` | No connection (HTTP 000). These endpoints were not running in this execution environment. |
| Playwright against local Vite at `127.0.0.1:5173` with controlled API responses | Passed completion after submit, refresh without another stage request, completed-team relogin, team switching, incomplete-session refresh and old-session recovery. No page runtime errors. This verifies the UI, not the Docker integration. |
| Original source comparison | The same isolated regression harness against original routes reproduced premature completion at a gap, failure at a deleted current stage, invalid input acceptance, existing-team takeover and repeated initialization failure. The unchanged validator test passed. |
| `git diff --check` | Passed. |

PGlite test connections are serialized by the test adapter. These tests validate
SQL and duplicate-request semantics but do not prove PostgreSQL's real
multi-connection lock scheduling. They omit the `pgcrypto` extension statement
because PGlite already provides `gen_random_uuid`; the production schema is
unchanged. No test connects to the project's configured PostgreSQL database.

## Local build and demonstration

From the repository root, keep the existing `.env` and run:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps -a
docker compose logs --tail=100 db-init backend frontend
curl --fail http://localhost:5000/health
curl --fail --head http://localhost:8080/
```

All long-running services should be healthy; `db-init` should exit with code 0.
Use http://localhost:8080/admin with username `admin`. A fresh database uses
ADMIN_PASSWORD; an existing database retains its previous password. Create,
edit and delete a test puzzle. Use http://localhost:8080/ with an existing team
code. Only a fresh database guarantees the sample `HUNTER-001` code and answers
`go`, then `2026`; existing puzzles/progress are preserved. Finish the hunt,
refresh, switch teams and log in again to demonstrate completion persistence.

For a safe persistence check, record a test puzzle's title and team progress,
then run:

```bash
docker compose restart db backend frontend
docker compose ps -a
curl --fail http://localhost:5000/health
```

After services recover, verify the same puzzle and progress. Re-running
`docker compose up --build -d` also preserves the named database volume.
Never remove that volume for this verification.

Remaining sign-off work: build/start the actual Docker images, verify Nginx and
backend availability on ports 8080/5000, run flows against the existing
PostgreSQL data, inspect container health/logs, and confirm persistence after a
non-destructive restart. These checks require access to the local Docker daemon.
