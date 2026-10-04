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
- **`POST /join`**: The current implementation accepts
  `{ "huntId": "...", "teamName": "..." }` to create or resume a team in an
  active hunt. It does not currently accept the requested
  `{ "team_name": "...", "access_code": "..." }` shape; `teamName` is used as
  both the team name and generated access code.
- **`GET /stage`** *(protected by Team JWT)*: Returns
  `{ stage_order, title, prompt_text, hint_text }` for the authenticated
  team.
- **`POST /submit`** *(protected by Team JWT)*: Accepts
  `{ "submission": "..." }`, `{ "answer": "..." }`, or `{ "input": "..." }`.
  Evaluates the answer against the stage validator. On success, advances
  `current_stage_order` and returns
  `{ success: true, completed: boolean }`.

### Admin Routes (`/api/v1/admin`)

- **`POST /login`**: Accepts
  `{ "username": "...", "password": "..." }` and returns an Admin JWT.
- **`GET /puzzles`** *(protected by Admin JWT)*: Lists all stages and
  validation parameters for the selected or active hunt.
- **`POST /puzzles`** *(protected by Admin JWT)*: Creates a stage. If
  `hunt_id` or `stage_order` is omitted or conflicts, the active hunt and
  next sequential stage number are used.
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

## 5. Local Setup and Execution

### Prerequisites

- Node.js v20+
- PostgreSQL 16+ running locally on port 5432

### Database

```bash
sudo -u postgres psql
CREATE USER hunt_admin WITH PASSWORD 'devpassword123';
CREATE DATABASE treasure_hunt OWNER hunt_admin;
GRANT ALL PRIVILEGES ON DATABASE treasure_hunt TO hunt_admin;
\q
```

### Backend

```bash
cd server
npm install

# Configure server/.env before starting:
# DATABASE_URL=postgres://hunt_admin:devpassword123@localhost:5432/treasure_hunt
# JWT_SECRET=super_secret_dev_key_12345
# PORT=5000
# NODE_ENV=development

# Initialize schema and seed data (admin, sample puzzles, and initial team).
node -r dotenv/config db/initDb.js

# Run the API server.
node -r dotenv/config index.js
```

The seed creates the administrator `admin` with password `password123`, an
active default hunt, the `First Signal` and `Final Lock` stages, and the
`Shadow Monarchs` team with access code `HUNTER-001`.

### Frontend

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Open:

- Hunter Gate: <http://localhost:5173/> (access code: `HUNTER-001`)
- Architect Console: <http://localhost:5173/admin> (user: `admin`, password:
  `password123`)

---

## 6. Future Project Roadmap (DevOps)

Once the core web application and administration workflows are verified, the
next milestone focuses on containerization and deployment pipelines:

- [ ] Multi-stage production Dockerfile for the Express backend.
- [ ] Multi-stage Dockerfile and Nginx static asset hosting for the React
  frontend.
- [ ] Unified `docker-compose.yml` orchestrating PostgreSQL with health checks
  and volume mounts, the backend, and ingress.
- [ ] CI/CD configuration for automated linting, schema validation, and image
  builds.
