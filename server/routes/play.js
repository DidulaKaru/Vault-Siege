const express = require('express');
const pool = require('../db');
const { requireTeam, issueToken } = require('../middleware/auth');
const { validateSubmission } = require('../services/validator');

const router = express.Router();
const authenticateTeam = requireTeam;

router.post('/login', async (req, res) => {
    const { access_code: accessCode } = req.body;
    if (typeof accessCode !== 'string' || !accessCode.trim()) {
        return res.status(400).json({ message: 'access_code is required.' });
    }

    try {
        const result = await pool.query(
            `SELECT t.id, t.hunt_id, t.team_name, t.current_stage_order, t.is_completed
             FROM teams t
             JOIN hunts h ON h.id = t.hunt_id
             WHERE t.access_code = $1 AND h.is_active = true`,
            [accessCode.trim()]
        );
        if (result.rowCount === 0) {
            return res.status(401).json({ message: 'Invalid access code.' });
        }

        const team = result.rows[0];
        const token = issueToken({ teamId: team.id, huntId: team.hunt_id, role: 'team' });
        return res.json({
            token,
            sessionToken: token,
            teamId: team.id,
            huntId: team.hunt_id,
            teamName: team.team_name,
            currentStageOrder: team.current_stage_order,
            completed: team.is_completed
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to authenticate team.' });
    }
});

router.post('/join', async (req, res) => {
    const { huntId, teamName } = req.body;

    if (!huntId || typeof teamName !== 'string' || !teamName.trim()) {
        return res.status(400).json({ message: 'huntId and teamName are required.' });
    }

    try {
        const huntResult = await pool.query(
            'SELECT id FROM hunts WHERE id = $1 AND is_active = true',
            [huntId]
        );
        if (huntResult.rowCount === 0) {
            return res.status(404).json({ message: 'Active hunt not found.' });
        }

        const teamResult = await pool.query(
            `INSERT INTO teams (hunt_id, access_code, team_name)
             VALUES ($1, $2, $2)
             ON CONFLICT (hunt_id, team_name) DO UPDATE SET updated_at = NOW()
             RETURNING id, hunt_id, team_name, current_stage_order, is_completed`,
            [huntId, teamName.trim()]
        );
        const team = teamResult.rows[0];
        const sessionToken = issueToken({
            role: 'team',
            sub: team.id,
            huntId: team.hunt_id
        });

        return res.json({
            sessionToken,
            teamId: team.id,
            huntId: team.hunt_id,
            teamName: team.team_name,
            currentStageOrder: team.current_stage_order,
            completed: team.is_completed
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to join hunt.' });
    }
});

router.get('/stage', authenticateTeam, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.stage_order, p.title, p.prompt_text, p.hint_text
             FROM teams t
             JOIN puzzles p ON p.hunt_id = t.hunt_id
                AND p.stage_order = t.current_stage_order
             WHERE t.id = $1 AND t.hunt_id = $2`,
            [req.auth.teamId || req.auth.sub, req.auth.huntId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'No active stage found.' });
        }

        return res.json(result.rows[0]);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load current stage.' });
    }
});

router.post('/submit', authenticateTeam, async (req, res) => {
    const submission = req.body.submission ?? req.body.answer ?? req.body.input;
    if (typeof submission !== 'string') {
        return res.status(400).json({ message: 'submission must be a string.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const puzzleResult = await client.query(
            `SELECT p.validator_type, p.validation_target
             FROM teams t
             JOIN puzzles p ON p.hunt_id = t.hunt_id
                AND p.stage_order = t.current_stage_order
             WHERE t.id = $1 AND t.hunt_id = $2
             FOR UPDATE OF t`,
            [req.auth.teamId || req.auth.sub, req.auth.huntId]
        );

        if (puzzleResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'No active stage found.' });
        }

        const puzzle = puzzleResult.rows[0];
        if (!validateSubmission(submission, puzzle.validator_type, puzzle.validation_target)) {
            await client.query('ROLLBACK');
            return res.json({ success: false, completed: false });
        }

        const nextStageResult = await client.query(
            `SELECT 1
             FROM teams t
             JOIN puzzles p ON p.hunt_id = t.hunt_id
                AND p.stage_order = t.current_stage_order + 1
             WHERE t.id = $1`,
            [req.auth.teamId || req.auth.sub]
        );
        const completed = nextStageResult.rowCount === 0;

        await client.query(
            `UPDATE teams
             SET current_stage_order = current_stage_order + 1,
                 is_completed = $2,
                 updated_at = NOW()
             WHERE id = $1`,
            [req.auth.teamId || req.auth.sub, completed]
        );
        await client.query('COMMIT');

        return res.json({ success: true, completed });
    } catch (error) {
        await client.query('ROLLBACK');
        return res.status(500).json({ message: 'Failed to submit answer.' });
    } finally {
        client.release();
    }
});

module.exports = router;