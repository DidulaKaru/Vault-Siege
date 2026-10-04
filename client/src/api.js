const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PLAY_TOKEN_KEY = 'vault-siege-team-token';
const ADMIN_TOKEN_KEY = 'vault-siege-admin-token';

async function request(path, options = {}, tokenKey) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const token = localStorage.getItem(tokenKey);
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
        const error = new Error(data?.message || 'Request failed.');
        error.status = response.status;
        throw error;
    }

    return data;
}

function jsonRequest(path, method, body, tokenKey) {
    return request(path, { method, body: JSON.stringify(body) }, tokenKey);
}

export const playApi = {
    login: (accessCode) => jsonRequest('/api/v1/play/login', 'POST', { access_code: accessCode }, PLAY_TOKEN_KEY),
    stage: () => request('/api/v1/play/stage', {}, PLAY_TOKEN_KEY),
    submit: (submission) => jsonRequest('/api/v1/play/submit', 'POST', { submission }, PLAY_TOKEN_KEY)
};

export const adminApi = {
    login: (username, password) => jsonRequest('/api/v1/admin/login', 'POST', { username, password }, ADMIN_TOKEN_KEY),
    puzzles: (huntId) => request(
        huntId ? `/api/v1/admin/puzzles?hunt_id=${encodeURIComponent(huntId)}` : '/api/v1/admin/puzzles',
        {},
        ADMIN_TOKEN_KEY
    ),
    createPuzzle: (puzzle) => jsonRequest('/api/v1/admin/puzzles', 'POST', puzzle, ADMIN_TOKEN_KEY),
    updatePuzzle: (id, puzzle) => jsonRequest(`/api/v1/admin/puzzles/${id}`, 'PUT', puzzle, ADMIN_TOKEN_KEY),
    deletePuzzle: (id) => request(`/api/v1/admin/puzzles/${id}`, { method: 'DELETE' }, ADMIN_TOKEN_KEY)
};

export { ADMIN_TOKEN_KEY, PLAY_TOKEN_KEY };
