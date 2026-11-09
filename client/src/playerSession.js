const SESSION_KEY = 'vault-siege-team-session';

export function loadPlayer() {
    try {
        const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        return session && typeof session === 'object' && session.teamId &&
            localStorage.getItem('vault-siege-team-token') ? session : null;
    } catch {
        return null;
    }
}

export function savePlayer(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
