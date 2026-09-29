const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { authenticateToken, issueToken } = require('../middleware/auth');

const router = express.Router();
const authenticateAdmin = authenticateToken('admin');
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
            token: issueToken({ type: 'admin', sub: admin.id, username: admin.username })
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to authenticate administrator.' });
    }
});

router.use(authenticateAdmin);

router.get('/puzzles', async (req, res) => {
    const { huntId } = req.query;
    if (!huntId) return res.status(400).json({ message: 'huntId is required.' });

    try {
        const result = await pool.query(
            `SELECT id, hunt_id, stage_order, title, prompt_text, hint_text,
                    validator_type, validation_target
             FROM puzzles
             WHERE hunt_id = $1
             ORDER BY stage_order`,
            [huntId]
        );
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load puzzles.' });
    }
});

router.post('/puzzles', async (req, res) => {
    const puzzle = req.body;
    if (!isValidPuzzleInput(puzzle)) {
        return res.status(400).json({ message: 'Invalid puzzle fields.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO puzzles
                (hunt_id, stage_order, title, prompt_text, hint_text, validator_type, validation_target)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, hunt_id, stage_order, title, prompt_text, hint_text,
                       validator_type, validation_target`,
            toPuzzleValues(puzzle)
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        return respondToPuzzleError(res, error, 'Failed to create puzzle.');
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