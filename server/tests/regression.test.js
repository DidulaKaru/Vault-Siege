const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

process.env.JWT_SECRET = randomUUID();
process.env.ADMIN_PASSWORD = randomUUID();
const db = new PGlite();
let gate = Promise.resolve();
let failQueries = false;
let failConnections = false;
async function connect() {
    if (failConnections) throw new Error('Simulated connection failure');
    let release;
    const previous = gate;
    gate = new Promise(resolve => { release = resolve; });
    await previous;
    return { query, release };
}
async function query(sql, values) {
    if (failQueries) throw new Error('Simulated database failure');
    // PGlite provides gen_random_uuid natively; the production extension is not needed here.
    if (sql.startsWith('CREATE EXTENSION')) {
        await db.exec(sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', ''));
        return { rows: [], rowCount: 0 };
    }
    const result = await db.query(sql, values);
    return { ...result, rowCount: result.rowCount ?? result.affectedRows ?? result.rows.length };
}
const pool = {
    connect,
    async query(sql, values) {
        const client = await connect();
        try { return await client.query(sql, values); } finally { client.release(); }
    },
    async end() {}
};
require.cache[require.resolve('../db')] = { exports: pool };
const { initDatabase } = require('../db/initDb');
const { issueToken } = require('../middleware/auth');
const { validateSubmission } = require('../services/validator');
let server, base, adminToken;
async function api(path, { method = 'GET', token, body } = {}) {
    const response = await fetch(`${base}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
async function fixture(stages = [1, 3], current = 1) {
    const hunt = randomUUID(), team = randomUUID();
    await pool.query('INSERT INTO hunts (id, title) VALUES ($1, $2)', [hunt, 'Regression']);
    await pool.query('INSERT INTO teams (id, hunt_id, team_name, access_code, current_stage_order) VALUES ($1,$2,$3,$4,$5)',
        [team, hunt, 'Test team', team, current]);
    for (const stage of stages) {
        await pool.query(`INSERT INTO puzzles (hunt_id, stage_order, title, prompt_text, validator_type, validation_target)
            VALUES ($1,$2,'Test','Prompt','EXACT_MATCH','same')`, [hunt, stage]);
    }
    return { hunt, team, token: issueToken({ role: 'team', teamId: team, huntId: hunt }) };
}
const submit = (token, stage_order, submission = 'same') => api('/api/v1/play/submit',
    { method: 'POST', token, body: { submission, stage_order } });
before(async () => {
    await initDatabase();
    server = require('../index').listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const login = await api('/api/v1/admin/login', { method: 'POST', body: { username: 'admin', password: process.env.ADMIN_PASSWORD } });
    assert.equal(login.status, 200);
    adminToken = login.data.token;
});
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.close();
});

test('all validator strategies preserve exact, case, regex and hash semantics', () => {
    assert.equal(validateSubmission('a', 'EXACT_MATCH', 'A'), false);
    assert.equal(validateSubmission(' a ', 'EXACT_MATCH', ' a '), true);
    assert.equal(validateSubmission(' GO ', 'CASE_INSENSITIVE', 'go'), true);
    assert.equal(validateSubmission('42', 'REGEX', '^\\d{2}$'), true);
    assert.equal(validateSubmission('42', 'REGEX', '['), false);
    assert.equal(validateSubmission('secret', 'HASH_SHA256', createHash('sha256').update('secret').digest('hex')), true);
    assert.equal(validateSubmission('secret', 'HASH_SHA256', 'bad'), false);
});
test('progression skips gaps, preserves other teams and completes only the final stage', async () => {
    const { team, token } = await fixture();
    const other = await fixture();
    assert.equal((await submit(token, 1, 'wrong')).data.success, false);
    assert.deepEqual((await submit(token, 1)).data, { success: true, completed: false, currentStageOrder: 3 });
    const stage = await api('/api/v1/play/stage', { token });
    assert.equal(stage.data.stage_order, 3);
    assert.equal('validation_target' in stage.data, false);
    assert.equal((await submit(token, 3)).data.completed, true);
    assert.deepEqual((await api('/api/v1/play/stage', { token })).data, { completed: true });
    const login = await api('/api/v1/play/login', { method: 'POST', body: { access_code: team } });
    assert.equal(login.data.completed, true);
    assert.equal((await api('/api/v1/play/stage', { token: other.token })).data.stage_order, 1);
});
test('deleted current stages recover to later stages; empty hunts remain incomplete', async () => {
    const { token } = await fixture([3], 2);
    assert.equal((await api('/api/v1/play/stage', { token })).data.stage_order, 3);
    const empty = await fixture([]);
    assert.equal((await api('/api/v1/play/stage', { token: empty.token })).status, 404);
    assert.equal((await submit(empty.token, 1)).status, 404);
    assert.equal((await pool.query('SELECT is_completed FROM teams WHERE id = $1', [empty.team])).rows[0].is_completed, false);
});
test('concurrent duplicate submissions cannot solve the next stage with the same answer', async () => {
    const { token } = await fixture([1, 2, 3]);
    const results = await Promise.all([submit(token, 1), submit(token, 1)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal((await api('/api/v1/play/stage', { token })).data.stage_order, 2);
    assert.equal((await submit(token, undefined)).status, 400);
});
test('admin CRUD rejects invalid fields, duplicate stages and invalid validator targets', async () => {
    const { hunt } = await fixture([]);
    const body = { hunt_id: hunt, stage_order: 3, title: 'Valid', prompt_text: 'Prompt', validator_type: 'EXACT_MATCH', validation_target: 'answer' };
    const create = body => api('/api/v1/admin/puzzles', { method: 'POST', token: adminToken, body });
    for (const invalid of [{ stage_order: -1 }, { stage_order: 1.5 }, { title: ' ' }, { prompt_text: [] },
        { validator_type: 'REGEX', validation_target: '[' }, { validator_type: 'HASH_SHA256', validation_target: 'bad' }]) {
        assert.equal((await create({ ...body, ...invalid })).status, 400);
    }
    const created = await create(body);
    assert.equal(created.status, 201);
    assert.equal((await create(body)).status, 409);
    const path = `/api/v1/admin/puzzles/${created.data.id}`;
    assert.equal((await api(path, { method: 'PATCH', token: adminToken, body: { stage_order: 0 } })).status, 400);
    assert.equal((await api(path, { method: 'PATCH', token: adminToken, body: { validator_type: 'REGEX', validation_target: '[' } })).status, 400);
    assert.equal((await api(path, { method: 'PATCH', token: adminToken, body: { title: 'Updated' } })).data.title, 'Updated');
    assert.equal((await api(path, { method: 'DELETE', token: adminToken })).status, 204);
    assert.equal((await api(path, { method: 'DELETE', token: adminToken })).status, 404);
});
test('auth enforces roles, expiry and access codes; join cannot take over an existing team', async () => {
    const { token, hunt } = await fixture();
    assert.equal((await api('/api/v1/admin/puzzles')).status, 401);
    assert.equal((await api('/api/v1/admin/puzzles', { token })).status, 403);
    assert.equal((await api('/api/v1/play/stage', { token: adminToken })).status, 403);
    assert.equal((await api('/api/v1/play/stage', { token: issueToken({ role: 'team' }, { expiresIn: -1 }) })).status, 401);
    assert.equal((await api('/api/v1/play/login', { method: 'POST', body: { access_code: randomUUID() } })).status, 401);
    assert.equal((await api('/api/v1/play/join', { method: 'POST', body: { huntId: hunt, teamName: 'Test team' } })).status, 409);
    const joined = await api('/api/v1/play/join', { method: 'POST', body: { huntId: hunt, teamName: 'New team' } });
    assert.equal(joined.status, 200);
    assert.notEqual(joined.data.accessCode, 'New team');
});
test('health reports database failure and submission connection failures return JSON', async () => {
    assert.equal((await api('/health')).status, 200);
    const { token } = await fixture();
    failQueries = true;
    try {
        assert.equal((await api('/health')).status, 503);
        assert.equal((await submit(token, 1)).status, 500);
    } finally { failQueries = false; }
    failConnections = true;
    try {
        assert.equal((await submit(token, 1)).status, 500);
    } finally { failConnections = false; }
});
test('repeated initialization preserves puzzles, progress and the original admin password', async () => {
    const before = (await pool.query('SELECT * FROM admins')).rows;
    const counts = (await pool.query('SELECT count(*) FROM puzzles')).rows;
    process.env.ADMIN_PASSWORD = randomUUID();
    await initDatabase();
    assert.deepEqual((await pool.query('SELECT * FROM admins')).rows, before);
    assert.deepEqual((await pool.query('SELECT count(*) FROM puzzles')).rows, counts);
    failQueries = true;
    await assert.rejects(initDatabase, /Simulated database failure/);
    failQueries = false;
});

test('partial schemas stop initialization without recreating tables', async () => {
    await pool.query('ALTER TABLE admins RENAME TO admins_saved');
    try {
        await assert.rejects(initDatabase, /Partial database schema/);
        assert.equal((await pool.query("SELECT to_regclass('public.admins') AS table_name")).rows[0].table_name, null);
    } finally {
        await pool.query('ALTER TABLE admins_saved RENAME TO admins');
    }
});
