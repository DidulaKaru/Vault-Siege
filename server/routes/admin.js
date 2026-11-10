const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAdmin, issueToken } = require('../middleware/auth');

const router = express.Router();
const authenticateAdmin = requireAdmin;
const validatorTypes = new Set(['EXACT_MATCH', 'CASE_INSENSITIVE', 'REGEX', 'HASH_SHA256']);

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: 'username and password are required.' });
    }

    try {
        const result = await pool.query(
            'SELECT id, username, password_hash FROM admins WHERE username = $1',
            [username]
        );
        const admin = result.rows[0];
        if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        return res.json({
            token: issueToken({ adminId: admin.id, role: 'admin', sub: admin.id, username: admin.username })
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to authenticate administrator.' });
    }
});

router.use(authenticateAdmin);

router.get('/puzzles', async (req, res) => {
    try {
        const huntId = req.query.hunt_id || (await pool.query(
            'SELECT id FROM hunts WHERE is_active = true LIMIT 1'
        )).rows[0]?.id;
        if (!huntId) return res.status(404).json({ message: 'No active hunt found.' });

        const result = await pool.query(
            `SELECT id, hunt_id, stage_order, title, prompt_text, hint_text,
                    validator_type, validation_target
             FROM puzzles
             WHERE hunt_id = $1
             ORDER BY stage_order ASC`,
            [huntId]
        );
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load puzzles.' });
    }
});

router.post('/puzzles', async (req, res) => {
    const puzzle = {
        ...req.body,
        validator_type: typeof req.body?.validator_type === 'string'
            ? req.body.validator_type.toUpperCase()
            : req.body?.validator_type
    };

    try {
        const huntId = typeof puzzle.hunt_id === 'string' ? puzzle.hunt_id.trim() : puzzle.hunt_id;
        const activeHunt = await pool.query('SELECT id FROM hunts WHERE is_active = true LIMIT 1');
        const targetHuntId = !huntId ? activeHunt.rows[0]?.id : huntId;
        puzzle.hunt_id = targetHuntId;
    } catch (error) {
        console.error('Failed to create puzzle:', error);
        return res.status(500).json({ message: 'Failed to create puzzle.' });
    }

    const missingFields = ['title', 'prompt_text', 'validation_target']
        .filter((field) => puzzle[field] === undefined || puzzle[field] === null || puzzle[field] === '');
    if (missingFields.length > 0) {
        return res.status(400).json({
            message: 'Required puzzle fields are missing.',
            details: { missing: missingFields }
        });
    }
    if (!puzzle.hunt_id) {
        return res.status(400).json({ message: 'No active hunt found.' });
    }

    try {
        const requestedStageOrder = puzzle.stage_order;
        const stageOrderIsValid = Number.isInteger(requestedStageOrder) && requestedStageOrder > 0;
        const stageConflict = stageOrderIsValid && await pool.query(
            'SELECT 1 FROM puzzles WHERE hunt_id = $1 AND stage_order = $2 LIMIT 1',
            [puzzle.hunt_id, requestedStageOrder]
        );
        if (!stageOrderIsValid || stageConflict.rowCount > 0) {
            const nextStage = await pool.query(
                'SELECT COALESCE(MAX(stage_order), 0) + 1 AS next_stage_order FROM puzzles WHERE hunt_id = $1',
                [puzzle.hunt_id]
            );
            puzzle.stage_order = nextStage.rows[0].next_stage_order;
        }
        if (!isValidPuzzleInput(puzzle)) {
            return res.status(400).json({
                message: 'Invalid puzzle fields.',
                details: {
                    stage_order: 'stage_order must be a positive integer.',
                    validator_type: `validator_type must be one of ${[...validatorTypes].join(', ')}.`
                }
            });
        }

        const result = await pool.query(
            `INSERT INTO puzzles
                (hunt_id, stage_order, title, prompt_text, hint_text, validator_type, validation_target)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, hunt_id, stage_order, title, prompt_text, hint_text,
                       validator_type, validation_target`,
            toPuzzleValues(puzzle)
        );
        return res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Failed to create puzzle:', err);
        return respondToPuzzleError(res, err, 'Failed to create puzzle.');
    }
});

async function updatePuzzle(req, res) {
    const updates = req.body;
    const fields = ['title', 'prompt_text', 'hint_text', 'validator_type', 'validation_target', 'stage_order'];
    const entries = fields.filter((field) => updates[field] !== undefined);

    if (entries.length === 0 || !hasValidPuzzleUpdates(updates, entries)) {
        return res.status(400).json({ message: 'At least one valid puzzle field is required.' });
    }

    const values = entries.map((field) => updates[field]);
    const assignments = entries.map((field, index) => `${field} = $${index + 1}`);
    values.push(req.params.id);

    try {
        const result = await pool.query(
            `UPDATE puzzles
             SET ${assignments.join(', ')}
             WHERE id = $${values.length}
             RETURNING id, hunt_id, stage_order, title, prompt_text, hint_text,
                       validator_type, validation_target`,
            values
        );
        if (result.rowCount === 0) return res.status(404).json({ message: 'Puzzle not found.' });
        return res.json(result.rows[0]);
    } catch (error) {
        return respondToPuzzleError(res, error, 'Failed to update puzzle.');
    }
}

router.patch('/puzzles/:id', updatePuzzle);
router.put('/puzzles/:id', updatePuzzle);

router.delete('/puzzles/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM puzzles WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'Puzzle not found.' });
        return res.status(204).send();
    } catch (error) {
        return res.status(500).json({ message: 'Failed to delete puzzle.' });
    }
});

// Teams Management & Progress Routes

router.get('/teams', async (req, res) => {
    try {
        const huntId = req.query.hunt_id || (await pool.query(
            'SELECT id FROM hunts WHERE is_active = true LIMIT 1'
        )).rows[0]?.id;
        if (!huntId) return res.status(404).json({ message: 'No active hunt found.' });

        const result = await pool.query(
            `SELECT 
                t.id,
                t.hunt_id,
                t.team_name,
                t.access_code,
                t.current_stage_order,
                t.is_completed,
                t.created_at,
                t.updated_at,
                t.completed_at,
                (SELECT COUNT(*) FROM puzzles WHERE hunt_id = t.hunt_id)::int AS total_stages
             FROM teams t
             WHERE t.hunt_id = $1
             ORDER BY t.is_completed DESC, t.completed_at ASC NULLS LAST, t.current_stage_order DESC, t.team_name ASC`,
            [huntId]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error('Failed to load teams:', error);
        return res.status(500).json({ message: 'Failed to load teams.' });
    }
});

router.post('/teams', async (req, res) => {
    const { team_name, access_code, hunt_id } = req.body;

    if (
        typeof team_name !== 'string' ||
        !team_name.trim() ||
        typeof access_code !== 'string' ||
        !access_code.trim()
    ) {
        return res.status(400).json({
            message: 'team_name and access_code are required strings.'
        });
    }

    try {
        const targetHuntId = hunt_id || (await pool.query(
            'SELECT id FROM hunts WHERE is_active = true LIMIT 1'
        )).rows[0]?.id;

        if (!targetHuntId) {
            return res.status(400).json({ message: 'No active hunt found.' });
        }

        const result = await pool.query(
            `INSERT INTO teams (hunt_id, team_name, access_code, current_stage_order, is_completed)
             VALUES ($1, $2, $3, 1, false)
             RETURNING *`,
            [targetHuntId, team_name.trim(), access_code.trim()]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A team with that name or access code already exists.' });
        }
        console.error('Failed to create team:', error);
        return res.status(500).json({ message: 'Failed to create team.' });
    }
});

router.patch('/teams/:id', async (req, res) => {
    const { id } = req.params;
    const { reset_progress, team_name, access_code } = req.body;

    try {
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (reset_progress === true) {
            updates.push('current_stage_order = 1');
            updates.push('is_completed = false');
            updates.push('completed_at = NULL');
        }

        if (typeof team_name === 'string' && team_name.trim().length > 0) {
            updates.push(`team_name = $${paramIndex++}`);
            values.push(team_name.trim());
        }

        if (typeof access_code === 'string' && access_code.trim().length > 0) {
            updates.push(`access_code = $${paramIndex++}`);
            values.push(access_code.trim());
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'No valid update fields provided.' });
        }

        updates.push('updated_at = NOW()');
        values.push(id);

        const query = `
            UPDATE teams
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
        `;

        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Team not found.' });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ message: 'A team with that name or access code already exists.' });
        }
        console.error('Failed to update team:', error);
        return res.status(500).json({ message: 'Failed to update team.' });
    }
});

router.delete('/teams/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM teams WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Team not found.' });
        }
        return res.json({ id: result.rows[0].id, message: 'Team deleted successfully.' });
    } catch (error) {
        console.error('Failed to delete team:', error);
        return res.status(500).json({ message: 'Failed to delete team.' });
    }
});

router.get('/progress', async (req, res) => {
    try {
        const huntId = req.query.hunt_id || (await pool.query(
            'SELECT id FROM hunts WHERE is_active = true LIMIT 1'
        )).rows[0]?.id;
        if (!huntId) return res.status(404).json({ message: 'No active hunt found.' });

        const stagesCountResult = await pool.query(
            'SELECT COUNT(*)::int AS count FROM puzzles WHERE hunt_id = $1',
            [huntId]
        );
        const total_stages = stagesCountResult.rows[0]?.count || 0;

        const teamStatsResult = await pool.query(
            `SELECT 
                COUNT(*)::int AS total_teams,
                COUNT(*) FILTER (WHERE is_completed = true)::int AS completed_teams,
                COUNT(*) FILTER (WHERE is_completed = false)::int AS active_teams
             FROM teams
             WHERE hunt_id = $1`,
            [huntId]
        );
        const { total_teams = 0, completed_teams = 0, active_teams = 0 } = teamStatsResult.rows[0] || {};

        const stageBreakdownResult = await pool.query(
            `SELECT 
                p.stage_order,
                p.title,
                COUNT(t.id)::int AS team_count
             FROM puzzles p
             LEFT JOIN teams t ON t.hunt_id = p.hunt_id 
                AND t.current_stage_order = p.stage_order 
                AND t.is_completed = false
             WHERE p.hunt_id = $1
             GROUP BY p.stage_order, p.title
             ORDER BY p.stage_order ASC`,
            [huntId]
        );

        return res.json({
            hunt_id: huntId,
            total_teams: Number(total_teams),
            active_teams: Number(active_teams),
            completed_teams: Number(completed_teams),
            total_stages: Number(total_stages),
            completion_rate: total_teams > 0 ? Math.round((completed_teams / total_teams) * 100) : 0,
            stage_breakdown: stageBreakdownResult.rows
        });
    } catch (error) {
        console.error('Failed to get progress:', error);
        return res.status(500).json({ message: 'Failed to load progress stats.' });
    }
});

function isValidPuzzleInput(puzzle) {
    return puzzle
        && puzzle.hunt_id
        && Number.isInteger(puzzle.stage_order)
        && typeof puzzle.title === 'string'
        && typeof puzzle.prompt_text === 'string'
        && validatorTypes.has(puzzle.validator_type)
        && typeof puzzle.validation_target === 'string';
}

function hasValidPuzzleUpdates(updates, fields) {
    return fields.every((field) => {
        if (field === 'stage_order') return Number.isInteger(updates[field]);
        if (field === 'validator_type') return validatorTypes.has(updates[field]);
        if (field === 'hint_text') return updates[field] === null || typeof updates[field] === 'string';
        return typeof updates[field] === 'string';
    });
}

function toPuzzleValues(puzzle) {
    return [
        puzzle.hunt_id,
        puzzle.stage_order,
        puzzle.title,
        puzzle.prompt_text,
        puzzle.hint_text || null,
        puzzle.validator_type,
        puzzle.validation_target
    ];
}

function respondToPuzzleError(res, error, fallbackMessage) {
    if (error.code === '23505') {
        return res.status(409).json({ message: 'That stage order already exists for this hunt.' });
    }
    return res.status(500).json({ message: fallbackMessage });
}

module.exports = router;