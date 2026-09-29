import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'vault-siege-admin-token';
const VALIDATORS = ['EXACT_MATCH', 'CASE_INSENSITIVE', 'REGEX', 'HASH_SHA256'];
const emptyPuzzle = {
    id: null,
    hunt_id: '',
    stage_order: 1,
    title: '',
    prompt_text: '',
    hint_text: '',
    validator_type: 'CASE_INSENSITIVE',
    validation_target: ''
};

async function fetchPuzzles(token, huntId) {
    const response = await fetch(`${API_BASE}/api/v1/admin/puzzles?huntId=${encodeURIComponent(huntId)}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to load puzzles.');
    return data;
}

export default function AdminPanel() {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [huntId, setHuntId] = useState(import.meta.env.VITE_HUNT_ID || '');
    const [puzzles, setPuzzles] = useState([]);
    const [form, setForm] = useState(emptyPuzzle);
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token || !huntId) return;

        let cancelled = false;
        fetchPuzzles(token, huntId)
            .then((data) => {
                if (!cancelled) setPuzzles(data);
            })
            .catch((requestError) => {
                if (!cancelled) setError(requestError.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [token, huntId]);

    const login = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/api/v1/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Login failed.');
            localStorage.setItem(TOKEN_KEY, data.token);
            setToken(data.token);
            setPassword('');
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setPuzzles([]);
    };

    const openCreate = () => {
        setForm({ ...emptyPuzzle, hunt_id: huntId });
        setMessage('');
        setError('');
        setModalOpen(true);
    };

    const openEdit = (puzzle) => {
        setForm({ ...puzzle, hint_text: puzzle.hint_text || '' });
        setMessage('');
        setError('');
        setModalOpen(true);
    };

    const savePuzzle = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        const isEditing = Boolean(form.id);
        const payload = {
            hunt_id: form.hunt_id || huntId,
            stage_order: Number(form.stage_order),
            title: form.title,
            prompt_text: form.prompt_text,
            hint_text: form.hint_text || null,
            validator_type: form.validator_type,
            validation_target: form.validation_target
        };

        try {
            const response = await fetch(
                `${API_BASE}/api/v1/admin/puzzles${isEditing ? `/${form.id}` : ''}`,
                {
                    method: isEditing ? 'PATCH' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to save puzzle.');
            setModalOpen(false);
            setMessage(isEditing ? 'Puzzle updated.' : 'Puzzle added.');
            setPuzzles(await fetchPuzzles(token, huntId));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    const deletePuzzle = async (puzzleId) => {
        if (!window.confirm('Delete this puzzle stage?')) return;
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/api/v1/admin/puzzles/${puzzleId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = response.status === 204 ? null : await response.json();
            if (!response.ok) throw new Error(data?.message || 'Unable to delete puzzle.');
            setMessage('Puzzle deleted.');
            setPuzzles(await fetchPuzzles(token, huntId));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <section className="panel login-panel">
                <div className="eyebrow">Restricted access</div>
                <h1>Admin sign in</h1>
                <p className="muted">Manage the stages in a hunt.</p>
                <form onSubmit={login} className="stack-form">
                    <label>
                        Username
                        <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
                    </label>
                    <label>
                        Password
                        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                    </label>
                    {error && <p className="notice error">{error}</p>}
                    <button className="primary-button" disabled={loading} type="submit">{loading ? 'Signing in...' : 'Sign in'}</button>
                </form>
            </section>
        );
    }

    return (
        <section className="admin-layout">
            <div className="admin-toolbar panel">
                <div>
                    <div className="eyebrow">Hunt administration</div>
                    <h1>Puzzle stages</h1>
                </div>
                <div className="toolbar-actions">
                    <input value={huntId} onChange={(event) => setHuntId(event.target.value)} placeholder="Hunt UUID" aria-label="Hunt ID" />
                    <button className="primary-button" onClick={openCreate} disabled={!huntId} type="button">Add puzzle</button>
                    <button className="quiet-button" onClick={logout} type="button">Sign out</button>
                </div>
            </div>

            {error && <p className="notice error">{error}</p>}
            {message && <p className="notice success">{message}</p>}
            {!huntId && <p className="notice warning">Enter a hunt ID to load its stages.</p>}
            <div className="panel puzzle-table-wrap">
                {loading && <p className="muted">Working...</p>}
                {!loading && puzzles.length === 0 && huntId && <p className="muted">No puzzles in this hunt yet.</p>}
                {puzzles.length > 0 && (
                    <div className="puzzle-table">
                        <div className="puzzle-row puzzle-header">
                            <span>Stage</span><span>Title</span><span>Validator</span><span>Actions</span>
                        </div>
                        {puzzles.map((puzzle) => (
                            <div className="puzzle-row" key={puzzle.id}>
                                <strong>{puzzle.stage_order}</strong>
                                <span>{puzzle.title}</span>
                                <span className="type-label">{puzzle.validator_type}</span>
                                <span className="row-actions">
                                    <button className="quiet-button" onClick={() => openEdit(puzzle)} type="button">Edit</button>
                                    <button className="danger-button" onClick={() => deletePuzzle(puzzle.id)} type="button">Delete</button>
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModalOpen(false)}>
                    <form className="modal panel" onSubmit={savePuzzle}>
                        <div className="stage-heading">
                            <div>
                                <div className="eyebrow">{form.id ? 'Edit stage' : 'New stage'}</div>
                                <h2>{form.id ? 'Update puzzle' : 'Add puzzle'}</h2>
                            </div>
                            <button className="quiet-button" onClick={() => setModalOpen(false)} type="button">Close</button>
                        </div>
                        <div className="form-grid">
                            <label>
                                Stage order
                                <input type="number" min="1" value={form.stage_order} onChange={(event) => setForm({ ...form, stage_order: event.target.value })} required />
                            </label>
                            <label>
                                Validator
                                <select value={form.validator_type} onChange={(event) => setForm({ ...form, validator_type: event.target.value })}>
                                    {VALIDATORS.map((validator) => <option key={validator} value={validator}>{validator}</option>)}
                                </select>
                            </label>
                        </div>
                        <label>
                            Title
                            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                        </label>
                        <label>
                            Prompt text
                            <textarea value={form.prompt_text} onChange={(event) => setForm({ ...form, prompt_text: event.target.value })} rows="4" required />
                        </label>
                        <label>
                            Hint
                            <textarea value={form.hint_text} onChange={(event) => setForm({ ...form, hint_text: event.target.value })} rows="3" />
                        </label>
                        <label>
                            Target string
                            <input value={form.validation_target} onChange={(event) => setForm({ ...form, validation_target: event.target.value })} required />
                        </label>
                        <button className="primary-button" disabled={loading} type="submit">{loading ? 'Saving...' : 'Save puzzle'}</button>
                    </form>
                </div>
            )}
        </section>
    );
}
