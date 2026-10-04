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