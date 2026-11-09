import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPlayer, savePlayer } from '../src/playerSession.js';

const values = new Map();
globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
};

test('completion persists across refresh and switching teams clears completion', () => {
    localStorage.setItem('vault-siege-team-token', 'test-token');
    savePlayer({ teamId: 'one', completed: false });
    assert.equal(loadPlayer().completed, false);
    savePlayer({ ...loadPlayer(), completed: true });
    assert.equal(loadPlayer().completed, true);
    localStorage.removeItem('vault-siege-team-token');
    assert.equal(loadPlayer(), null);
    localStorage.setItem('vault-siege-team-token', 'next-token');
    savePlayer({ teamId: 'two', completed: false });
    assert.equal(loadPlayer().completed, false);
    localStorage.setItem('vault-siege-team-session', '{invalid');
    assert.equal(loadPlayer(), null);
    localStorage.setItem('vault-siege-team-session', '7');
    assert.equal(loadPlayer(), null);
});
