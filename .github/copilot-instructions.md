# Engineering Instructions for Treasure Hunt Platform

## Tech Stack
- Frontend: React (Vite), Tailwind CSS
- Backend: Node.js, Express
- Database: PostgreSQL (using `pg` driver or Prisma/Knex)

## Architecture Rules
1. Universal Puzzle Contract: Every puzzle is defined by:
   - `id`, `stage_order`, `title`, `prompt_text`, `hint_text`
   - `validator_type` ('EXACT_MATCH', 'CASE_INSENSITIVE', 'REGEX', 'HASH_SHA256')
   - `validation_target` (Expected answer or hash)
2. Zero Solution Leakage: Never return `validator_type` or `validation_target` to `/api/v1/play/*` routes.
3. Decoupling: Remove all legacy siege pinging, IP maps, Morse, and hardcoded config polling.