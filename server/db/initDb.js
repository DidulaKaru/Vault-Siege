require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./index');

const schemaPath = path.join(__dirname, 'schema.sql');

async function seedDatabase(client) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    const adminResult = await client.query(
        `INSERT INTO admins (username, password_hash)
         VALUES ($1, $2)
         ON CONFLICT (username) DO NOTHING
         RETURNING id`,
        ['admin', passwordHash]
    );

    const huntResult = await client.query(
        `INSERT INTO hunts (title)
         VALUES ($1)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        ['Default Test Hunt']
    );
    const huntId = huntResult.rows[0]?.id || (await client.query(
        'SELECT id FROM hunts WHERE title = $1 ORDER BY created_at LIMIT 1',
        ['Default Test Hunt']
    )).rows[0].id;

    const puzzles = [
        {
            stageOrder: 1,
            title: 'First Signal',
            promptText: 'What word begins the test hunt?',
            hintText: 'It is the opposite of stop.',
            validatorType: 'CASE_INSENSITIVE',
            validationTarget: 'go'
        },
        {
            stageOrder: 2,
            title: 'Final Lock',
            promptText: 'Enter the exact test code.',
            hintText: 'The code is four digits.',
            validatorType: 'EXACT_MATCH',
            validationTarget: '2026'
        }
    ];

    for (const puzzle of puzzles) {
        await client.query(
            `INSERT INTO puzzles
                (hunt_id, stage_order, title, prompt_text, hint_text, validator_type, validation_target)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (hunt_id, stage_order) DO UPDATE SET
                title = EXCLUDED.title,
                prompt_text = EXCLUDED.prompt_text,
                hint_text = EXCLUDED.hint_text,
                validator_type = EXCLUDED.validator_type,
                validation_target = EXCLUDED.validation_target`,
            [
                huntId,
                puzzle.stageOrder,
                puzzle.title,
                puzzle.promptText,
                puzzle.hintText,
                puzzle.validatorType,
                puzzle.validationTarget
            ]
        );
    }

    await client.query(
        `INSERT INTO teams (hunt_id, team_name, access_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (hunt_id, access_code) DO NOTHING`,
        [huntId, 'Shadow Monarchs', 'HUNTER-001']
    );
    console.log('Seeded team "Shadow Monarchs" with access code HUNTER-001');

    return { adminId: adminResult.rows[0]?.id, huntId, puzzleCount: puzzles.length };
}

async function initDatabase() {
    if (!process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD must be set.');
    const schema = await fs.readFile(schemaPath, 'utf8');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(7429301)');
        const { rows: [state] } = await client.query(
            "SELECT to_regclass('public.admins') AS admins, to_regclass('public.hunts') AS hunts, to_regclass('public.puzzles') AS puzzles, to_regclass('public.teams') AS teams, to_regtype('public.validation_strategy') AS strategy"
        );
        if (Object.values(state).every(Boolean)) {
            await client.query('COMMIT');
            console.log('Existing database found: preserving accounts, puzzles and progress.');
            return;
        }
        if (Object.values(state).some(Boolean)) throw new Error('Partial database schema found; initialization stopped to preserve data.');
        await client.query(schema);
        const seed = await seedDatabase(client);
        await client.query('COMMIT');
        console.log(`Database initialized. Seeded hunt ${seed.huntId} with ${seed.puzzleCount} puzzles.`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

if (require.main === module) {
    initDatabase().catch((error) => {
        console.error('Database initialization failed:', error);
        process.exitCode = 1;
    });
}

module.exports = { initDatabase, seedDatabase };