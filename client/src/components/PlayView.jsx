import { useEffect, useState } from 'react';
import { PLAY_TOKEN_KEY, playApi } from '../api';

function loadPlayer() {
    try {
        return JSON.parse(localStorage.getItem('vault-siege-team-session') || 'null');
    } catch {
        return null;
    }
}

export default function PlayView() {
    const [player, setPlayer] = useState(loadPlayer);
    const [accessCode, setAccessCode] = useState('');
    const [stage, setStage] = useState(null);
    const [answer, setAnswer] = useState('');
    const [hintOpen, setHintOpen] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const signOut = () => {
        localStorage.removeItem(PLAY_TOKEN_KEY);
        localStorage.removeItem('vault-siege-team-session');
        setPlayer(null);
        setStage(null);
        setFeedback(null);
        setError('');
    };

    useEffect(() => {
        if (!localStorage.getItem(PLAY_TOKEN_KEY)) return undefined;

        let cancelled = false;
        playApi.stage()
            .then((nextStage) => {
                if (!cancelled) {
                    setStage(nextStage);
                    setError('');
                }
            })
            .catch((requestError) => {
                if (!cancelled) {
                    if (requestError.status === 401 || requestError.status === 403) signOut();
                    else setError(requestError.message);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [player]);

    const login = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const session = await playApi.login(accessCode.trim());
            localStorage.setItem(PLAY_TOKEN_KEY, session.token || session.sessionToken);
            localStorage.setItem('vault-siege-team-session', JSON.stringify(session));
            setPlayer(session);
            setAccessCode('');
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    const submitAnswer = async (event) => {
        event.preventDefault();
        if (!answer.trim()) return;

        setLoading(true);
        setFeedback(null);
        setError('');
        try {
            const result = await playApi.submit(answer);
            if (!result.success) {
                setFeedback({ type: 'failure', message: 'Incorrect answer, try again.' });
                return;
            }

            if (result.completed) {
                setPlayer((current) => ({ ...current, completed: true }));
                setStage(null);
                setAnswer('');
                return;
            }

            const nextStage = await playApi.stage();
            setStage(nextStage);
            setAnswer('');
            setHintOpen(false);
            setFeedback({ type: 'success', message: 'Stage cleared. The next lock is ready.' });
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    if (!player) {
        return (
            <section className="panel join-panel">
                <div className="eyebrow">Player access</div>
                <h1>Enter the hunt</h1>
                <p className="muted">Use the access code your hunt architect gave your team.</p>
                <form onSubmit={login} className="stack-form">
                    <label htmlFor="access-code">
                        Access code
                        <input
                            id="access-code"
                            value={accessCode}
                            onChange={(event) => setAccessCode(event.target.value)}
                            placeholder="Enter your team code"
                            autoComplete="one-time-code"
                            required
                        />
                    </label>
                    {error && <p className="notice error">{error}</p>}
                    <button className="primary-button" disabled={loading} type="submit">
                        {loading ? 'Unlocking...' : 'Enter hunt'}
                    </button>
                </form>
            </section>
        );
    }

    if (player.completed) {
        return (
            <section className="panel completion-state">
                <div className="eyebrow">Vault opened</div>
                <h1>Hunt Completed</h1>
                <p className="muted">Your team cleared every stage. The vault recognizes your work.</p>
                <button className="quiet-button" onClick={signOut} type="button">Switch team</button>
            </section>
        );
    }

    return (
        <section className="hunt-layout">
            <div className="team-bar panel">
                <div>
                    <div className="eyebrow">Active team</div>
                    <h1>{player.teamName || 'Hunt team'}</h1>
                </div>
                <div className="team-status">
                    <span>Stage</span>
                    <strong>{stage?.stage_order || player.currentStageOrder || '...'}</strong>
                </div>
                <button className="quiet-button" onClick={signOut} type="button">Switch team</button>
            </div>

            <div className="panel stage-panel">
                {loading && !stage && <p className="muted">Loading the current stage...</p>}
                {!loading && !stage && error && <p className="notice error">{error}</p>}
                {stage && (
                    <>
                        <div className="stage-heading">
                            <div>
                                <div className="eyebrow">Stage {stage.stage_order}</div>
                                <h2>{stage.title}</h2>
                            </div>
                            {stage.hint_text && (
                                <button className="quiet-button" onClick={() => setHintOpen((open) => !open)} type="button">
                                    {hintOpen ? 'Hide hint' : 'Reveal hint'}
                                </button>
                            )}
                        </div>
                        <p className="prompt-text">{stage.prompt_text}</p>
                        {hintOpen && <div className="hint-box">{stage.hint_text}</div>}
                        <form onSubmit={submitAnswer} className="answer-form">
                            <label htmlFor="answer">Your answer</label>
                            <div className="answer-row">
                                <input id="answer" value={answer} onChange={(event) => setAnswer(event.target.value)} autoComplete="off" required />
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
