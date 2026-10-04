# Copilot Development Instructions: Hunter Gate Platform

## System Architecture
- Multi-tenant treasure hunt engine. All puzzles follow a universal prompt-validator contract.
- Backend: Express + PostgreSQL (`pg` driver with connection pooling).
- Frontend: React + Vite + Tailwind CSS v4.
- Theme: Solo Leveling "System UI" (deep blacks `#030712`, neon cyan `#00f0ff` / `#38bdf8`, monospace, glowing borders).

## Mandatory Constraints
1. **Never Leak Validation Details:** Under no circumstances should `validator_type` or `validation_target` be serialized or returned in any `/api/v1/play/*` response.
2. **Team State Isolation:** Team stage progression is strictly tracked in the `teams` table via `current_stage_order`. All puzzle answers must advance only the submitting team.
3. **Database Defaults:** When `hunt_id` is omitted in admin requests, always resolve the active hunt via `SELECT id FROM hunts WHERE is_active = true LIMIT 1`.
4. **Enum Matching:** PostgreSQL enum `validation_strategy` requires uppercase: `'EXACT_MATCH'`, `'CASE_INSENSITIVE'`, `'REGEX'`, `'HASH_SHA256'`. Ensure backend routes always uppercase input before insertion.
5. **Team Auth:** Team authentication is handled via `access_code` on the `teams` table.
6. **Universal Puzzle Contract:** Every puzzle includes `id`, `stage_order`, `title`, `prompt_text`, `hint_text`, `validator_type`, and `validation_target`.
7. **Decoupling:** Do not reintroduce legacy siege pinging, IP maps, Morse logic, or hardcoded configuration polling.
