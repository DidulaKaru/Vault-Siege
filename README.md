# Hunter Gate // Universal Treasure Hunt Engine

Hunter Gate is a data-driven, multi-tenant treasure hunt platform. The
project transforms hardcoded, narrative puzzle scripts into a universal,
parameterized workflow engine where:

- **Architects (Admins)** dynamically configure hunts, manage stages, and set
  validation strategies.
- **Hunters (Teams)** join using an `access_code` and progress through sequential
  challenges with isolated team state.

---

## 1. System Vision and Architecture

The application is structured into three cleanly separated tiers:

```text
[ Hunter UI (/) ]         [ Architect UI (/admin) ]
          │                             │
          └──────────────┬──────────────┘
                         │ HTTP / REST
                         ▼
                 [ Express API Server (:5000) ]
                 ├── /api/v1/play   (Team progression and verification)
                 └── /api/v1/admin  (Puzzle and hunt orchestration)
                         │
                         ▼ TCP (:5432)
                 [ PostgreSQL Database ]
```

### Core Architectural Invariants

1. **Decoupled State Machine:** Progression state and puzzle definitions
   reside in PostgreSQL, while answer validation and state transitions are
   orchestrated by Node.js via `server/services/validator.js`.
2. **Universal Puzzle Contract:** Every challenge follows a uniform
   input-and-verify lifecycle:
   - Prompt and optional hint
   - Validator strategy (`EXACT_MATCH`, `CASE_INSENSITIVE`, `REGEX`,
     `HASH_SHA256`)
   - Target answer or hash
3. **Zero Solution Leakage:** Endpoints consumed by players
   (`/api/v1/play/*`) strictly project public fields (`title`,
   `prompt_text`, `hint_text`, `stage_order`). Validation types and target
   answers must never cross the network boundary to the player.
4. **Isolated Team Progression:** Every participating party maintains an
   independent `current_stage_order` index, allowing teams to compete
   asynchronously on the same active hunt.
5. **Multi-Hunt Readiness:** The schema supports multiple hunts, while active
   hunt management is currently handled at initialization and database level.

---

## 2. Database Schema (PostgreSQL)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Active Hunt Metadata
CREATE TABLE hunts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(120) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Accounts
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Universal Puzzle Stages
CREATE TYPE validation_strategy AS ENUM (
    'EXACT_MATCH',
    'CASE_INSENSITIVE',
    'REGEX',
    'HASH_SHA256'
);

CREATE TABLE puzzles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
    stage_order INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    prompt_text TEXT NOT NULL,
    hint_text TEXT,
    validator_type validation_strategy NOT NULL DEFAULT 'CASE_INSENSITIVE',
    validation_target TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_hunt_stage UNIQUE(hunt_id, stage_order)
);

-- Hunter Parties and Progression
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
    team_name VARCHAR(60) NOT NULL,
    access_code VARCHAR(120) NOT NULL,
    current_stage_order INT NOT NULL DEFAULT 1,
    is_completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_hunt_team UNIQUE(hunt_id, team_name),
    CONSTRAINT uq_hunt_access_code UNIQUE(hunt_id, access_code)
);
```

---

## 3. API Contract Reference

### Player Routes (`/api/v1/play`)

- **`POST /login`**: Accepts `{ "access_code": "..." }` and returns a
  signed Team JWT with a flat team session payload:

  ```json
  {
    "token": "...",
    "teamId": "...",
    "huntId": "...",
    "teamName": "...",
    "currentStageOrder": 1,
    "completed": false
  }
  ```
- **`POST /join`**: Accepts `{ "huntId": "...", "teamName": "..." }` to create a
  team in an active hunt. Returns a random `accessCode` for future login.
  Existing team names return 409; resume them through `/login` with their code.
- **`GET /stage`** *(protected by Team JWT)*: Returns
  `{ stage_order, title, prompt_text, hint_text }` for the authenticated
  team, or `{ completed: true }` after completion. Deleted current stages
  recover to the next existing stage; empty hunts return 404 without completion.
- **`POST /submit`** *(protected by Team JWT)*: Accepts
  `{ "submission": "..." }`, `{ "answer": "..." }`, or `{ "input": "..." }`.
  Every submission must also include `stage_order` from the displayed puzzle;
  stale stage numbers return 409 to prevent duplicate submissions advancing twice.
  Evaluates the answer against the stage validator. On success, advances
  `current_stage_order` and returns
  `{ success: true, completed: boolean, currentStageOrder: number }`.

### Admin Routes (`/api/v1/admin`)

- **`POST /login`**: Accepts
  `{ "username": "...", "password": "..." }` and returns an Admin JWT.
- **`GET /puzzles`** *(protected by Admin JWT)*: Lists all stages and
  validation parameters for the selected or active hunt.
- **`POST /puzzles`** *(protected by Admin JWT)*: Creates a stage. If
  `hunt_id` or `stage_order` is omitted, the active hunt and next stage number
  are used. Invalid stages return 400 and duplicates return 409.
- **`PUT /puzzles/:id`** and **`PATCH /puzzles/:id`** *(protected by Admin
  JWT)*: Update stage parameters.
- **`DELETE /puzzles/:id`** *(protected by Admin JWT)*: Removes a stage.

---

## 4. UI Design Specification

- **Theme inspiration:** Dark fantasy “System UI” (Solo Leveling aesthetic).
- **Surfaces and accents:** The current styling uses a `#0b1120` slate
  background with dark, high-contrast accents and cyan status treatments.
- **Client routing:**
  - `/`: Hunter Gate `access_code` entry and active quest interface.
  - `/admin`: Architect Console login and puzzle management dashboard.

---

## 5. Local Docker Setup

Install Docker Engine with Compose. Bun 1.4.4 and Node.js 22 are used for local
checks; Dockerfiles use Node.js 22 and npm for installation and builds.

If you do not have a root .env, copy .env.example to .env. Keep your existing
.env and database volume when updating. Set all variables in the template.
POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB must match an existing volume's
credentials; changing these values does not update an existing PostgreSQL user.
Use URL-safe database credentials, or percent-encode special characters in the
DATABASE_URL expression in Compose. Never put secrets in VITE_API_URL; Vite
includes that value in the public frontend build.

Run from the repository root:

```bash
docker compose config --quiet
docker compose up --build -d
docker compose ps -a
docker compose logs --tail=100 db-init backend frontend
curl --fail http://localhost:5000/health
curl --fail --head http://localhost:8080/
```

Open http://localhost:8080/ for players and http://localhost:8080/admin for
administration. The browser API remains http://localhost:5000. Rebuild the
frontend after changing VITE_API_URL.

A fresh database seeds admin username `admin` with ADMIN_PASSWORD, a sample
hunt, and team code `HUNTER-001`. The initial puzzle answers are `go` and
`2026`. Existing databases retain their accounts, passwords, puzzles and team
progress; ADMIN_PASSWORD does not reset an existing account. A query failure
or partial schema stops initialization without seeding.

For the demonstration, log in as admin, create/edit/delete a test puzzle, then
log in as a player and submit answers. Refresh after completion to verify the
completion screen. A completed team remains completed when new stages are added.
To test persistence without removing any data:

```bash
docker compose restart db backend frontend
docker compose ps -a
curl --fail http://localhost:5000/health
```

After services recover, confirm your puzzle edits and team progress remain.
Do not remove the `postgres_data` volume.

## 6. Local Checks and Development

```bash
cd server
bun install --frozen-lockfile
bun run test
cd ../client
bun install --frozen-lockfile
bun run test
bun run lint
bun run build
```

Backend regressions use an isolated in-memory PostgreSQL engine (PGlite), with
serialized test connections. They never connect to your configured database.
They verify application SQL and duplicate-request behavior; real PostgreSQL
multi-connection locking and Docker persistence still require the Docker checks.

For development outside Docker, supply DATABASE_URL, JWT_SECRET and
ADMIN_PASSWORD to the backend environment. With a separate locally reachable
PostgreSQL instance and the root .env configured for it:

```bash
cd server
bun --env-file=../.env run db:init
bun --env-file=../.env run dev
# In another terminal:
cd client
bun --env-file=../.env run dev
```

Compose does not publish the database port. The root template's localhost
DATABASE_URL is for a separate host PostgreSQL instance; Compose supplies its
own URL using the `db` service name.

See [AUDIT.md](AUDIT.md) for confirmed defects, verification results and limits.
