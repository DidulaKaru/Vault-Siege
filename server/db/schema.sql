CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hunts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(120) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE validation_strategy AS ENUM ('EXACT_MATCH', 'CASE_INSENSITIVE', 'REGEX', 'HASH_SHA256');

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

CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hunt_id UUID NOT NULL REFERENCES hunts(id) ON DELETE CASCADE,
    access_code VARCHAR(120) NOT NULL,
    team_name VARCHAR(60) NOT NULL,
    current_stage_order INT NOT NULL DEFAULT 1,
    is_completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_hunt_access_code UNIQUE(hunt_id, access_code),
    CONSTRAINT uq_hunt_team UNIQUE(hunt_id, team_name)
);