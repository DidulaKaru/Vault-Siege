import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SESSION_KEY = 'vault-siege-team-session';

function loadSession() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
        return null;
    }
}

export default function TeamHuntView() {
    const [session, setSession] = useState(loadSession);
    const [huntId, setHuntId] = useState(import.meta.env.VITE_HUNT_ID || '');
    const [teamName, setTeamName] = useState('');
    const [stage, setStage] = useState(null);
    const [answer, setAnswer] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [error, setError] = useState('');
    const [showHint, setShowHint] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!session?.sessionToken) return;

        let cancelled = false;
        fetch(`${API_BASE}/api/v1/play/stage`, {
            headers: { Authorization: `Bearer ${session.sessionToken}` }
        })
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'No active stage found.');
                return data;
            })
            .then((data) => {
                if (!cancelled) {
                    setStage(data);
                    setError('');
                    setShowHint(false);
                }
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
    }, [session]);

    const joinHunt = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/api/v1/play/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ huntId, teamName })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to join hunt.');

            localStorage.setItem(SESSION_KEY, JSON.stringify(data));
            setSession(data);
            setFeedback(null);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    const submitAnswer = async (event) => {
        event.preventDefault();
        if (!session?.sessionToken || !stage) return;

        setLoading(true);
        setFeedback(null);
        setError('');
        try {
            const response = await fetch(`${API_BASE}/api/v1/play/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.sessionToken}`
                },
                body: JSON.stringify({ submission: answer })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Unable to submit answer.');

            if (!data.success) {
                setFeedback({ type: 'failure', message: 'That answer did not unlock this stage.' });
                return;
            }

            const nextSession = {
                ...session,
                currentStageOrder: session.currentStageOrder + 1,
                completed: data.completed
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
            setSession(nextSession);
            setAnswer('');
            setFeedback({
                type: 'success',
                message: data.completed ? 'Hunt complete. Your team cleared every stage.' : 'Stage cleared. Loading the next challenge...'
            });

            if (data.completed) {
                setStage(null);
                return;
            }

            const nextStageResponse = await fetch(`${API_BASE}/api/v1/play/stage`, {
                headers: { Authorization: `Bearer ${session.sessionToken}` }
            });
            const nextStage = await nextStageResponse.json();
            if (!nextStageResponse.ok) throw new Error(nextStage.message || 'Unable to load the next stage.');
            setStage(nextStage);
            setShowHint(false);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    const leaveTeam = () => {
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
        setStage(null);
        setFeedback(null);
        setError('');
    };

    if (!session) {
        return (
            <section className="panel join-panel">
                <div className="eyebrow">Player access</div>
                <h1>Enter the hunt</h1>
                <p className="muted">Join your team and pick up the current stage.</p>
                <form onSubmit={joinHunt} className="stack-form">
                    <label>
                        Hunt ID
                        <input value={huntId} onChange={(event) => setHuntId(event.target.value)} placeholder="Hunt UUID" required />
                    </label>
                    <label>
                        Team name
                        <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="e.g. The Signal Society" required />
                    </label>
                    {error && <p className="notice error">{error}</p>}
                    <button className="primary-button" disabled={loading} type="submit">
                        {loading ? 'Joining...' : 'Join hunt'}
                    </button>
                </form>
            </section>
        );
    }

    return (
        <section className="hunt-layout">
            <div className="team-bar panel">
                <div>
                    <div className="eyebrow">Active team</div>
                    <h1>{session.teamName}</h1>
                </div>
                <div className="team-status">
                    <span>Stage</span>
                    <strong>{session.completed ? 'Complete' : session.currentStageOrder}</strong>
                </div>
                <button className="quiet-button" onClick={leaveTeam} type="button">Switch team</button>
            </div>

            <div className="panel stage-panel">
                {loading && !stage && <p className="muted">Loading stage...</p>}
                {!loading && !stage && session.completed && (
                    <div className="completion-state">
                        <div className="eyebrow">Hunt complete</div>
                        <h2>Every lock is open.</h2>
                        <p className="muted">Your team has completed this hunt.</p>
                    </div>
                )}
                {!loading && !stage && !session.completed && <p className="notice error">{error || 'No active stage found.'}</p>}
                {stage && (
                    <>
                        <div className="stage-heading">
                            <div>
                                <div className="eyebrow">Stage {stage.stage_order}</div>
                                <h2>{stage.title}</h2>
                            </div>
                            {stage.hint_text && (
                                <button className="quiet-button" onClick={() => setShowHint(!showHint)} type="button">
                                    {showHint ? 'Hide hint' : 'Show hint'}
                                </button>
                            )}
                        </div>
                        <p className="prompt-text">{stage.prompt_text}</p>
                        {showHint && <div className="hint-box">{stage.hint_text}</div>}
                        <form onSubmit={submitAnswer} className="answer-form">
                            <label htmlFor="answer">Your answer</label>
                            <div className="answer-row">
                                <input id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type your answer" autoComplete="off" required />
                                <button className="primary-button" disabled={loading} type="submit">
                                    {loading ? 'Checking...' : 'Submit answer'}
                                </button>
                            </div>
                        </form>
                        {feedback && <p className={`notice ${feedback.type}`}>{feedback.message}</p>}
                        {error && <p className="notice error">{error}</p>}
                    </>
                )}
            </div>
        </section>
    );
}
