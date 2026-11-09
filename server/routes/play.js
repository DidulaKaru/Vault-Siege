const express = require('express');
const pool = require('../db');
const { requireTeam, issueToken } = require('../middleware/auth');
const { validateSubmission } = require('../services/validator');

const { loadTeamStage } = require('../services/progress');
const { randomUUID } = require('crypto');
const router = express.Router();
const authenticateTeam = requireTeam;

router.post('/login', async (req, res) => {
    const { access_code: accessCode } = req.body || {};
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
        if (result.rowCount > 1) {
            return res.status(409).json({ message: 'Access code is ambiguous across active hunts. Ask the administrator for a unique code.' });
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
    const { huntId, teamName } = req.body || {};

    if (typeof huntId !== 'string' || !huntId || typeof teamName !== 'string' || !teamName.trim() || teamName.trim().length > 60) {
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
             VALUES ($1, $2, $3)
             ON CONFLICT (hunt_id, team_name) DO NOTHING
             RETURNING id, hunt_id, team_name, access_code, current_stage_order, is_completed`,
            [huntId, randomUUID(), teamName.trim()]
        );
        const team = teamResult.rows[0];
        if (!team) return res.status(409).json({ message: 'Team already exists. Log in with its access code.' });
        const sessionToken = issueToken({
            role: 'team',
            sub: team.id,
            huntId: team.hunt_id
        });

        return res.json({
            sessionToken,
            accessCode: team.access_code,
            teamId: team.id,
            huntId: team.hunt_id,
            teamName: team.team_name,
            currentStageOrder: team.current_stage_order,
            completed: team.is_completed
        });
    } catch (error) {
        if (error.code === '22P02') return res.status(400).json({ message: 'Invalid huntId.' });
        return res.status(500).json({ message: 'Failed to join hunt.' });
    }
});

router.get('/stage', authenticateTeam, async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { team, puzzle } = await loadTeamStage(client, req.auth.teamId || req.auth.sub, req.auth.huntId);
        await client.query('COMMIT');
        if (!team) return res.status(404).json({ message: 'Team not found.' });
        if (team.is_completed) return res.json({ completed: true });
        if (!puzzle) return res.status(404).json({ message: 'No active stage found. Ask the administrator to add a stage.' });
        const { stage_order, title, prompt_text, hint_text } = puzzle;
        return res.json({ stage_order, title, prompt_text, hint_text, completed: false });
    } catch {
        if (client) await client.query('ROLLBACK').catch(() => {});
        return res.status(500).json({ message: 'Failed to load current stage.' });
    } finally {
        client?.release();
    }
});

router.post('/submit', authenticateTeam, async (req, res) => {
    const submission = req.body?.submission ?? req.body?.answer ?? req.body?.input;
    const stageOrder = req.body?.stage_order;
    if (typeof submission !== 'string' || !submission.trim() ||
        (!Number.isInteger(stageOrder) || stageOrder <= 0)) {
        return res.status(400).json({ message: 'A nonempty submission and valid stage_order are required.' });
    }
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const teamId = req.auth.teamId || req.auth.sub;
        const { team, puzzle } = await loadTeamStage(client, teamId, req.auth.huntId);
        if (!team || (!team.is_completed && !puzzle)) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'No active stage found.' });
        }
        if (team.is_completed) {
            await client.query('COMMIT');
            return res.json({ success: true, completed: true });
        }
        if (stageOrder !== puzzle.stage_order) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'Stage changed. Refresh to load the current puzzle.' });
        }
        if (!validateSubmission(submission, puzzle.validator_type, puzzle.validation_target)) {
            await client.query('COMMIT');
            return res.json({ success: false, completed: false });
        }
        const { rows: [nextStage] } = await client.query(
            'SELECT stage_order FROM puzzles WHERE hunt_id = $1 AND stage_order > $2 ORDER BY stage_order LIMIT 1 FOR SHARE',
            [req.auth.huntId, puzzle.stage_order]
        );
        const completed = !nextStage;
        const currentStageOrder = nextStage?.stage_order ?? puzzle.stage_order;
        await client.query(
            'UPDATE teams SET current_stage_order = $2, is_completed = $3, updated_at = NOW() WHERE id = $1',
            [teamId, currentStageOrder, completed]
        );
        await client.query('COMMIT');
        return res.json({ success: true, completed, currentStageOrder });
    } catch {
        if (client) await client.query('ROLLBACK').catch(() => {});
        return res.status(500).json({ message: 'Failed to submit answer.' });
    } finally {
        client?.release();
    }
});

module.exports = router;
