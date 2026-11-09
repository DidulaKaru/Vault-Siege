// Lock the team before reading its stage so concurrent requests see committed progress.
async function loadTeamStage(client, teamId, huntId) {
    const { rows: [team] } = await client.query(
        'SELECT * FROM teams WHERE id = $1 AND hunt_id = $2 FOR UPDATE', [teamId, huntId]
    );
    if (!team || team.is_completed) return { team, puzzle: null };
    const { rows: [puzzle] } = await client.query(
        `SELECT * FROM puzzles WHERE hunt_id = $1 AND stage_order >= $2
         ORDER BY stage_order LIMIT 1 FOR SHARE`, [huntId, team.current_stage_order]
    );
    if (puzzle && puzzle.stage_order !== team.current_stage_order) {
        await client.query('UPDATE teams SET current_stage_order = $2, updated_at = NOW() WHERE id = $1',
            [teamId, puzzle.stage_order]);
    }
    return { team, puzzle };
}
module.exports = { loadTeamStage };
