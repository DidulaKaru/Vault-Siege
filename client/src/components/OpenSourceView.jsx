import React, { useEffect, useState } from 'react';

export default function OpenSourceView({ onBreach, submissionToken }) {
    const [dots, setDots] = useState('');

    // 1. Simple visual loading animation
    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);

    // Poll config-status to detect when the PR has been merged.
    // Era 5 advancement is now handled SERVER-SIDE in index.js.
    // The client just polls system-state and will pick up the theme change.
    useEffect(() => {
        const checkConfig = setInterval(() => {
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/config-status`)
                .then(res => res.json())
                .then(data => {
                    // When config values match, the server-side interval in index.js
                    // will advance activeLayerIndex automatically. We just re-fetch state
                    // to detect the change via the parent's polling in App.jsx.
                    if (data.attackMode === true && data.rateLimit >= 200) {
                        onBreach(); // Triggers fetchState in App.jsx to pick up new theme
                    }
                })
                .catch(err => console.error("Waiting for server..."));
        }, 3000);

        return () => clearInterval(checkConfig);
    }, [onBreach]);

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-blue-100 selection:bg-blue-500/30 relative overflow-hidden">
            {/* Background Void/Smoke Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.15)_0%,rgba(2,6,23,1)_100%)] pointer-events-none"></div>

            {/* Main System Panel */}
            <div className="max-w-3xl w-full bg-slate-900/40 backdrop-blur-md border-2 border-blue-400 shadow-[0_0_25px_rgba(96,165,250,0.4)] p-8 relative z-10">

                {/* Tech/Game UI Corner Accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-200"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-200"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-200"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-200"></div>

                {/* Header */}
                <div className="flex flex-col items-center mb-8 border-b border-blue-500/30 pb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full border-2 border-blue-400 text-blue-400 text-sm font-bold shadow-[0_0_10px_rgba(96,165,250,0.5)]">
                            !
                        </span>
                        <h1 className="text-2xl font-bold uppercase tracking-widest text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
                            QUEST UPDATED
                        </h1>
                    </div>
                    <h2 className="text-xs font-semibold tracking-[0.3em] text-blue-300 uppercase">
                        [TRIAL: ARCHITECTURE OVERRIDE]
                    </h2>
                </div>

                {/* Narrative / Instructions */}
                <div className="space-y-6 mb-10 text-center text-sm font-medium tracking-wider">
                    <p className="leading-relaxed drop-shadow-[0_0_5px_rgba(191,219,254,0.3)]">
                        [THE SYSTEM HAS IMPOSED A LIMITATION ON THE <span className="text-green-400 font-bold">'PLAYER'</span>.]
                    </p>
                    <p className="text-blue-300/70 text-xs uppercase tracking-widest leading-loose">
                        Traffic throttle constraint is active. Core source is immutable from this interface.
                    </p>
                </div>

                {/* Hint Box */}
                <div className="p-6 bg-blue-950/30 border border-blue-500/30 rounded-sm my-6 text-center space-y-4 shadow-[inset_0_0_15px_rgba(30,58,138,0.3)]">
                    <h3 className="text-blue-400 font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.44a.25.25 0 0 1 .379-.213Z"></path>
                        </svg>
                        [HIDDEN REQUIREMENT DETECTED]
                    </h3>
                    <p className="text-blue-100 text-xs leading-relaxed uppercase tracking-wider">
                        The configuration source (<code className="text-blue-300 font-mono">config.js</code>) is hosted remotely. Refer to the artifact recovered in the prior phase to locate the upstream repository. Fork the architecture, modify <code className="text-yellow-400 font-bold">MAX_RATE_LIMIT</code> and <code className="text-yellow-400 font-bold">ATTACK_MODE_ENABLED</code>, and submit a formal Pull Request.
                    </p>
                </div>

                {/* Polling Indicator */}
                <div className="pt-4 mt-8 border-t border-blue-500/30 flex flex-col items-center justify-center gap-4">
                    <div className="text-red-500 text-xs font-bold tracking-[0.2em] uppercase animate-pulse border border-red-500/50 bg-red-950/30 px-3 py-1">
                        [STATUS: LOCKED]
                    </div>
                    <div className="text-blue-300 text-xs flex items-center gap-3 tracking-widest uppercase">
                        <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        AWAITING CONFIGURATION PATCH{dots}
                    </div>
                </div>

            </div>
        </div>
    );
}