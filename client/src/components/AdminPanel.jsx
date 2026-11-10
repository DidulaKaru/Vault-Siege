import { useEffect, useState, useCallback } from 'react';
import { adminApi, ADMIN_TOKEN_KEY } from '../api';

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

const emptyTeamForm = {
    team_name: '',
    access_code: ''
};

function generateCodeSuggestion() {
    const prefixes = ['SHADOW', 'MONARCH', 'VAULT', 'CIPHER', 'HUNTER', 'APEX', 'PHANTOM', 'AEGIS', 'TITAN', 'NEXUS', 'VORTEX', 'SOLO'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
}

function formatActivityTime(isoString) {
    if (!isoString) return '—';
    try {
        const date = new Date(isoString);
        const isToday = new Date().toDateString() === date.toDateString();
        const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return isToday ? timePart : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timePart}`;
    } catch {
        return '—';
    }
}

export default function AdminPanel() {
    const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY));
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [huntId, setHuntId] = useState('');

    // Tab state: 'teams' or 'puzzles'
    const [activeTab, setActiveTab] = useState('teams');

    // Puzzles state
    const [puzzles, setPuzzles] = useState([]);
    const [puzzleForm, setPuzzleForm] = useState(emptyPuzzle);
    const [puzzleModalOpen, setPuzzleModalOpen] = useState(false);

    // Teams & Progress state
    const [teams, setTeams] = useState([]);
    const [stats, setStats] = useState(null);
    const [teamForm, setTeamForm] = useState(emptyTeamForm);
    const [addTeamModalOpen, setAddTeamModalOpen] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [copiedCodeId, setCopiedCodeId] = useState(null);

    // Status & notifications
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    // Data loading helpers
    const loadPuzzles = useCallback(async () => {
        try {
            const data = await adminApi.puzzles(huntId || undefined);
            setPuzzles(data);
            if (data[0]?.hunt_id && !huntId) {
                setHuntId(data[0].hunt_id);
            }
        } catch (err) {
            setError(err.message || 'Unable to load puzzles.');
        }
    }, [huntId]);

    const loadTeamsAndProgress = useCallback(async () => {
        try {
            const [teamsData, progressData] = await Promise.all([
                adminApi.teams(huntId || undefined),
                adminApi.progress(huntId || undefined)
            ]);
            setTeams(teamsData);
            setStats(progressData);
            if (progressData?.hunt_id && !huntId) {
                setHuntId(progressData.hunt_id);
            }
        } catch (err) {
            setError(err.message || 'Unable to load teams progress.');
        }
    }, [huntId]);

    // Initial load when token or activeTab changes
    useEffect(() => {
        if (!token) return undefined;

        let cancelled = false;
        if (activeTab === 'teams') {
            Promise.all([
                adminApi.teams(huntId || undefined),
                adminApi.progress(huntId || undefined)
            ]).then(([teamsData, progressData]) => {
                if (!cancelled) {
                    setTeams(teamsData);
                    setStats(progressData);
                    if (progressData?.hunt_id && !huntId) {
                        setHuntId(progressData.hunt_id);
                    }
                }
            }).catch((err) => {
                if (!cancelled) setError(err.message || 'Unable to load teams progress.');
            });
        } else if (activeTab === 'puzzles') {
            adminApi.puzzles(huntId || undefined).then((data) => {
                if (!cancelled) {
                    setPuzzles(data);
                    if (data[0]?.hunt_id && !huntId) {
                        setHuntId(data[0].hunt_id);
                    }
                }
            }).catch((err) => {
                if (!cancelled) setError(err.message || 'Unable to load puzzles.');
            });
        }

        return () => {
            cancelled = true;
        };
    }, [token, activeTab, huntId]);

    // Auto-refresh interval (every 10s) for live progress
    useEffect(() => {
        if (!token || activeTab !== 'teams' || !autoRefresh) return;

        const intervalId = setInterval(() => {
            loadTeamsAndProgress();
        }, 10000);

        return () => clearInterval(intervalId);
    }, [token, activeTab, autoRefresh, loadTeamsAndProgress]);

    // Authentication actions
    const login = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const data = await adminApi.login(username, password);
            localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
            setToken(data.token);
            setPassword('');
        } catch (requestError) {
            setError(requestError.message || 'Login failed.');
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken(null);
        setPuzzles([]);
        setTeams([]);
        setStats(null);
    };

    // Copy to clipboard helper
    const copyToClipboard = (code, teamId) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                setCopiedCodeId(teamId);
                setTimeout(() => setCopiedCodeId(null), 2000);
            }).catch(() => {});
        }
    };

    // Team management actions
    const openAddTeam = () => {
        setTeamForm(emptyTeamForm);
        setError('');
        setMessage('');
        setAddTeamModalOpen(true);
    };

    const handleCreateTeam = async (event) => {
        event.preventDefault();
        const teamNameTrimmed = teamForm.team_name.trim();
        const accessCodeTrimmed = teamForm.access_code.trim();

        if (!teamNameTrimmed || !accessCodeTrimmed) {
            setError('Team name and access code are required.');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');
        try {
            await adminApi.createTeam({
                hunt_id: huntId || undefined,
                team_name: teamNameTrimmed,
                access_code: accessCodeTrimmed
            });
            setAddTeamModalOpen(false);
            setTeamForm(emptyTeamForm);
            setMessage(`Group "${teamNameTrimmed}" registered successfully.`);
            await loadTeamsAndProgress(false);
        } catch (err) {
            setError(err.message || 'Failed to create group.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetProgress = async (team) => {
        if (!window.confirm(`Reset progress for "${team.team_name}" back to Stage 1?`)) return;
        setRefreshing(true);
        setError('');
        setMessage('');
        try {
            await adminApi.updateTeam(team.id, { reset_progress: true });
            setMessage(`Progress reset to Stage 1 for "${team.team_name}".`);
            await loadTeamsAndProgress(false);
        } catch (err) {
            setError(err.message || 'Failed to reset progress.');
        } finally {
            setRefreshing(false);
        }
    };

    const handleDeleteTeam = async (team) => {
        if (!window.confirm(`Permanently remove group "${team.team_name}" from the hunt?`)) return;
        setRefreshing(true);
        setError('');
        setMessage('');
        try {
            await adminApi.deleteTeam(team.id);
            setMessage(`Group "${team.team_name}" deleted.`);
            await loadTeamsAndProgress(false);
        } catch (err) {
            setError(err.message || 'Failed to delete group.');
        } finally {
            setRefreshing(false);
        }
    };

    // Puzzle management actions
    const openCreatePuzzle = () => {
        const nextStageOrder = puzzles.length + 1;
        setPuzzleForm({ ...emptyPuzzle, hunt_id: huntId, stage_order: nextStageOrder });
        setMessage('');
        setError('');
        setPuzzleModalOpen(true);
    };

    const openEditPuzzle = (puzzle) => {
        setPuzzleForm({ ...puzzle, hint_text: puzzle.hint_text || '' });
        setMessage('');
        setError('');
        setPuzzleModalOpen(true);
    };

    const savePuzzle = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        const isEditing = Boolean(puzzleForm.id);
        const payload = {
            hunt_id: puzzleForm.hunt_id || huntId,
            stage_order: Number(puzzleForm.stage_order),
            title: puzzleForm.title,
            prompt_text: puzzleForm.prompt_text,
            hint_text: puzzleForm.hint_text || null,
            validator_type: puzzleForm.validator_type,
            validation_target: puzzleForm.validation_target
        };

        try {
            if (isEditing) {
                await adminApi.updatePuzzle(puzzleForm.id, payload);
                setMessage('Puzzle stage updated.');
            } else {
                await adminApi.createPuzzle(payload);
                setMessage('Puzzle stage added.');
            }
            setPuzzleModalOpen(false);
            await loadPuzzles(false);
        } catch (requestError) {
            setError(requestError.message || 'Unable to save puzzle.');
        } finally {
            setLoading(false);
        }
    };

    const deletePuzzle = async (puzzleId) => {
        if (!window.confirm('Delete this puzzle stage?')) return;
        setLoading(true);
        setError('');
        try {
            await adminApi.deletePuzzle(puzzleId);
            setMessage('Puzzle deleted.');
            await loadPuzzles(false);
        } catch (requestError) {
            setError(requestError.message || 'Unable to delete puzzle.');
        } finally {
            setLoading(false);
        }
    };

    // Unauthenticated login screen
    if (!token) {
        return (
            <section className="panel login-panel">
                <div className="eyebrow">Restricted access</div>
                <h1>Admin sign in</h1>
                <p className="muted">Authorize command privileges to manage hunters and vault stages.</p>
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
                    <button className="primary-button" disabled={loading} type="submit">{loading ? 'Authenticating...' : 'Sign in'}</button>
                </form>
            </section>
        );
    }

    return (
        <section className="admin-layout">
            {/* Top Command Toolbar */}
            <div className="admin-toolbar panel">
                <div>
                    <div className="eyebrow">Command Center</div>
                    <h1>Vault Operations</h1>
                </div>
                <div className="toolbar-actions">
                    <button className="quiet-button" onClick={logout} type="button">Sign out</button>
                </div>
            </div>

            {/* Top Navigation Tabs */}
            <div className="admin-tabs">
                <button
                    type="button"
                    className={`tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
                    onClick={() => setActiveTab('teams')}
                >
                    <span className="tab-title">Teams & Live Progress</span>
                    <span className="tab-pill">{teams.length}</span>
                </button>
                <button
                    type="button"
                    className={`tab-btn ${activeTab === 'puzzles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('puzzles')}
                >
                    <span className="tab-title">Puzzles</span>
                    <span className="tab-pill">{puzzles.length}</span>
                </button>
            </div>

            {/* Notifications */}
            {error && <p className="notice error">{error}</p>}
            {message && <p className="notice success">{message}</p>}

            {/* TAB 1: TEAMS & LIVE PROGRESS */}
            {activeTab === 'teams' && (
                <div className="teams-view">
                    {/* Live Metric Cards */}
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <span className="metric-label">Total Groups</span>
                            <span className="metric-value">{stats ? stats.total_teams : teams.length}</span>
                            <span className="metric-sub">Registered units</span>
                        </div>
                        <div className="metric-card active-card">
                            <span className="metric-label">In Field (Active)</span>
                            <span className="metric-value active-val">
                                {stats ? stats.active_teams : teams.filter((t) => !t.is_completed).length}
                            </span>
                            <span className="metric-sub">Engaged in raid</span>
                        </div>
                        <div className="metric-card cleared-card">
                            <span className="metric-label">Vault Cleared</span>
                            <span className="metric-value cleared-val">
                                {stats ? stats.completed_teams : teams.filter((t) => t.is_completed).length}
                            </span>
                            <span className="metric-sub">Reached extraction</span>
                        </div>
                        <div className="metric-card rate-card">
                            <span className="metric-label">Completion Rate</span>
                            <span className="metric-value rate-val">
                                {stats ? `${stats.completion_rate}%` : '0%'}
                            </span>
                            <span className="metric-sub">
                                {stats?.total_stages ? `${stats.total_stages} stages total` : 'Global progress'}
                            </span>
                        </div>
                    </div>

                    {/* Sub-toolbar for Teams: Live Toggle, Refresh, Add Group */}
                    <div className="panel sub-toolbar">
                        <div className="sub-toolbar-left">
                            <label className="toggle-label">
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={(e) => setAutoRefresh(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                                <span className="toggle-text">Auto-Refresh (10s)</span>
                            </label>

                            {autoRefresh ? (
                                <span className="live-badge live-active" title="Monitoring real-time team updates every 10s">
                                    <span className="live-dot"></span>
                                    LIVE
                                </span>
                            ) : (
                                <span className="live-badge live-paused" title="Auto-refresh is paused">
                                    PAUSED
                                </span>
                            )}
                        </div>

                        <div className="toolbar-actions">
                            <button
                                className="quiet-button"
                                onClick={() => loadTeamsAndProgress(true)}
                                disabled={refreshing}
                                type="button"
                                title="Manually fetch latest status"
                            >
                                {refreshing ? 'Updating...' : '↻ Refresh'}
                            </button>
                            <button className="primary-button" onClick={openAddTeam} type="button">
                                + Add Group
                            </button>
                        </div>
                    </div>

                    {/* Teams Leaderboard & Live Progress Table */}
                    <div className="panel table-container">
                        {refreshing && teams.length === 0 && <p className="muted">Scanning hunter channels...</p>}
                        {!refreshing && teams.length === 0 && (
                            <div className="empty-state">
                                <p className="muted">No groups currently deployed in this vault hunt.</p>
                                <button className="primary-button" onClick={openAddTeam} type="button">
                                    Deploy First Group
                                </button>
                            </div>
                        )}
                        {teams.length > 0 && (
                            <div className="table-responsive">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th className="th-rank">Rank</th>
                                            <th className="th-name">Group Name</th>
                                            <th className="th-code">Access Code</th>
                                            <th className="th-progress">Stage Progress</th>
                                            <th className="th-status">Status</th>
                                            <th className="th-time">Last Activity</th>
                                            <th className="th-actions">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teams.map((team, idx) => {
                                            const totalStages = team.total_stages || stats?.total_stages || 0;
                                            const pct = team.is_completed
                                                ? 100
                                                : totalStages > 0
                                                    ? Math.min(100, Math.round(((team.current_stage_order - 1) / totalStages) * 100))
                                                    : 0;

                                            return (
                                                <tr key={team.id} className={team.is_completed ? 'row-cleared' : ''}>
                                                    <td className="td-rank">
                                                        <span className={`rank-indicator rank-${idx + 1}`}>
                                                            {idx === 0 ? '👑 #1' : `#${idx + 1}`}
                                                        </span>
                                                    </td>
                                                    <td className="td-name">
                                                        <strong className="team-title">{team.team_name}</strong>
                                                    </td>
                                                    <td className="td-code">
                                                        <div className="code-pill">
                                                            <code className="code-text">{team.access_code}</code>
                                                            <button
                                                                type="button"
                                                                className={`copy-code-btn ${copiedCodeId === team.id ? 'copied' : ''}`}
                                                                onClick={() => copyToClipboard(team.access_code, team.id)}
                                                                title="Copy access code to clipboard"
                                                            >
                                                                {copiedCodeId === team.id ? 'Copied!' : 'Copy'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="td-progress">
                                                        <div className="stage-progress-box">
                                                            <div className="progress-details">
                                                                <span className="stage-readout">
                                                                    {team.is_completed
                                                                        ? `Cleared (${totalStages}/${totalStages})`
                                                                        : `Stage ${team.current_stage_order} of ${totalStages}`}
                                                                </span>
                                                                <span className="stage-percent">{pct}%</span>
                                                            </div>
                                                            <div className="progress-rail">
                                                                <div
                                                                    className={`progress-fill ${team.is_completed ? 'fill-cleared' : ''}`}
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="td-status">
                                                        {team.is_completed ? (
                                                            <span className="status-badge badge-cleared">
                                                                Vault Cleared
                                                            </span>
                                                        ) : (
                                                            <span className="status-badge badge-active">
                                                                In Progress
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="td-time muted-time">
                                                        {formatActivityTime(team.completed_at || team.updated_at || team.created_at)}
                                                    </td>
                                                    <td className="td-actions">
                                                        <div className="row-actions">
                                                            <button
                                                                type="button"
                                                                className="quiet-button btn-reset"
                                                                onClick={() => handleResetProgress(team)}
                                                                title="Reset progression to Stage 1"
                                                            >
                                                                Reset
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="danger-button"
                                                                onClick={() => handleDeleteTeam(team)}
                                                                title="Delete this group"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: PUZZLES */}
            {activeTab === 'puzzles' && (
                <div className="puzzles-view">
                    <div className="panel sub-toolbar">
                        <div>
                            <span className="eyebrow">Stage Pipeline</span>
                            <h2>Configured Puzzles</h2>
                        </div>
                        <div className="toolbar-actions">
                            <button className="primary-button" onClick={openCreatePuzzle} type="button">
                                + Add Puzzle
                            </button>
                        </div>
                    </div>

                    <div className="panel puzzle-table-wrap">
                        {loading && puzzles.length === 0 && <p className="muted">Loading stages...</p>}
                        {!loading && puzzles.length === 0 && <p className="muted">No puzzles in the active hunt yet.</p>}
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
                                            <button className="quiet-button" onClick={() => openEditPuzzle(puzzle)} type="button">Edit</button>
                                            <button className="danger-button" onClick={() => deletePuzzle(puzzle.id)} type="button">Delete</button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL: ADD GROUP */}
            {addTeamModalOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setAddTeamModalOpen(false)}>
                    <form className="modal panel" onSubmit={handleCreateTeam}>
                        <div className="stage-heading">
                            <div>
                                <div className="eyebrow">Raid Management</div>
                                <h2>Deploy New Group</h2>
                            </div>
                            <button className="quiet-button" onClick={() => setAddTeamModalOpen(false)} type="button">✕</button>
                        </div>

                        <label>
                            Group / Team Name
                            <input
                                value={teamForm.team_name}
                                onChange={(event) => setTeamForm({ ...teamForm, team_name: event.target.value })}
                                placeholder="e.g. Shadow Monarchs, Alpha Unit..."
                                autoFocus
                                required
                            />
                        </label>

                        <label>
                            Access Code (Required, editable)
                            <div className="input-action-group">
                                <input
                                    value={teamForm.access_code}
                                    onChange={(event) => setTeamForm({ ...teamForm, access_code: event.target.value })}
                                    placeholder="Enter custom code or generate a suggestion..."
                                    required
                                />
                                <button
                                    type="button"
                                    className="quiet-button suggestion-btn"
                                    onClick={() => setTeamForm({ ...teamForm, access_code: generateCodeSuggestion() })}
                                    title="Generate a randomized thematic code suggestion into the input"
                                >
                                    ⚡ Suggest Code
                                </button>
                            </div>
                            <span className="field-hint muted">
                                Admins can manually specify any code or click &quot;Suggest Code&quot; to populate a recommended value.
                            </span>
                        </label>

                        <div className="modal-footer">
                            <button className="quiet-button" onClick={() => setAddTeamModalOpen(false)} type="button">
                                Cancel
                            </button>
                            <button className="primary-button" disabled={loading} type="submit">
                                {loading ? 'Deploying...' : 'Deploy Group'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MODAL: PUZZLE STAGE EDIT / CREATE */}
            {puzzleModalOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setPuzzleModalOpen(false)}>
                    <form className="modal panel" onSubmit={savePuzzle}>
                        <div className="stage-heading">
                            <div>
                                <div className="eyebrow">{puzzleForm.id ? 'Edit stage' : 'New stage'}</div>
                                <h2>{puzzleForm.id ? 'Update puzzle' : 'Add puzzle'}</h2>
                            </div>
                            <button className="quiet-button" onClick={() => setPuzzleModalOpen(false)} type="button">✕</button>
                        </div>
                        <div className="form-grid">
                            <label>
                                Stage order
                                <input type="number" min="1" value={puzzleForm.stage_order} onChange={(event) => setPuzzleForm({ ...puzzleForm, stage_order: event.target.value })} required />
                            </label>
                            <label>
                                Validator
                                <select value={puzzleForm.validator_type} onChange={(event) => setPuzzleForm({ ...puzzleForm, validator_type: event.target.value })}>
                                    {VALIDATORS.map((validator) => <option key={validator} value={validator}>{validator}</option>)}
                                </select>
                            </label>
                        </div>
                        <label>
                            Title
                            <input value={puzzleForm.title} onChange={(event) => setPuzzleForm({ ...puzzleForm, title: event.target.value })} required />
                        </label>
                        <label>
                            Prompt text
                            <textarea value={puzzleForm.prompt_text} onChange={(event) => setPuzzleForm({ ...puzzleForm, prompt_text: event.target.value })} rows="4" required />
                        </label>
                        <label>
                            Hint
                            <textarea value={puzzleForm.hint_text} onChange={(event) => setPuzzleForm({ ...puzzleForm, hint_text: event.target.value })} rows="3" />
                        </label>
                        <label>
                            Target string
                            <input value={puzzleForm.validation_target} onChange={(event) => setPuzzleForm({ ...puzzleForm, validation_target: event.target.value })} required />
                        </label>
                        <div className="modal-footer">
                            <button className="quiet-button" onClick={() => setPuzzleModalOpen(false)} type="button">Cancel</button>
                            <button className="primary-button" disabled={loading} type="submit">{loading ? 'Saving...' : 'Save puzzle'}</button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
}
