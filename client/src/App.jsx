import { useEffect, useState } from 'react';
import AdminPanel from './components/AdminPanel';
import TeamHuntView from './components/TeamHuntView';

export default function App() {
    const [view, setView] = useState(() => window.location.pathname === '/admin' ? 'admin' : 'hunt');

    useEffect(() => {
        const handlePopState = () => setView(window.location.pathname === '/admin' ? 'admin' : 'hunt');
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigate = (nextView) => {
        const path = nextView === 'admin' ? '/admin' : '/';
        window.history.pushState({}, '', path);
        setView(nextView);
    };

    return (
        <div className="app-shell">
            <header className="app-header">
                <div>
                    <div className="brand-mark">VAULT / SIEGE</div>
                    <span className="header-subtitle">Universal hunt control</span>
                </div>
                <nav className="app-nav" aria-label="Primary navigation">
                    <button className={view === 'hunt' ? 'nav-button active' : 'nav-button'} onClick={() => navigate('hunt')} type="button">Hunt player</button>
                    <button className={view === 'admin' ? 'nav-button active' : 'nav-button'} onClick={() => navigate('admin')} type="button">Admin</button>
                </nav>
            </header>
            <main className="app-content">
                {view === 'admin' ? <AdminPanel /> : <TeamHuntView />}
            </main>
        </div>
    );
}