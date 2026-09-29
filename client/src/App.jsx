import React, { useState, useEffect } from 'react';
import MechanicalView from './components/MechanicalView';
import HashView from './components/HashView';
import BookView from './components/BookView';
import MorseView from './components/MorseView';
import OpenSourceView from './components/OpenSourceView';
import CloudSiegeView from './components/CloudSiegeView';
import WelcomeScreen from './components/WelcomeScreen';
import ArchitectBanner from './components/ArchitectBanner';

export default function App() {
    const [themeState, setThemeState] = useState("LOADING");
    const [metrics, setMetrics] = useState(null);
    const [submissionToken, setSubmissionToken] = useState(null);

    const fetchState = () => {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/system-state`)
            .then(res => res.json())
            .then(data => {
                setThemeState(data.currentLayer.theme);
                if (data.metrics) setMetrics(data.metrics);
                if (data.submissionToken) setSubmissionToken(data.submissionToken);
            })
            .catch(() => setThemeState("DISCONNECTED"));
    };

    useEffect(() => {
        fetchState();
        const interval = setInterval(fetchState, 2000);
        return () => clearInterval(interval);
    }, []);

    const renderView = () => {
        switch (themeState) {
            case "ERA_MECHANICAL":
                return <MechanicalView onBreach={fetchState} submissionToken={submissionToken} />;
            case "ERA_HASH":
                return <HashView onBreach={fetchState} submissionToken={submissionToken} />;
            case "ERA_ARCHIVE":
                return <BookView onBreach={fetchState} submissionToken={submissionToken} />;
            case "ERA_MORSE":
                return <MorseView onBreach={fetchState} submissionToken={submissionToken} />;
            case "ERA_OPEN_SOURCE":
                return <OpenSourceView onBreach={fetchState} submissionToken={submissionToken} />;
            case "ERA_CLOUD_SIEGE":
                return <CloudSiegeView metrics={metrics} onBreach={fetchState} />;
            case "SYSTEM_ACCESSED":
                return <WelcomeScreen />;
        case "DISCONNECTED":
            return (
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-red-100 relative overflow-hidden">
                    {/* Background Void/Smoke Effect - Red */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(153,27,27,0.15)_0%,rgba(2,6,23,1)_100%)] pointer-events-none"></div>

                    {/* Disconnected Error Panel */}
                    <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-md border-2 border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.4)] p-8 relative z-10 text-center animate-[pulse_2s_ease-in-out_infinite]">

                        {/* Tech UI Corner Accents */}
                        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-red-400"></div>
                        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-red-400"></div>
                        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-red-400"></div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-red-400"></div>

                        <div className="flex justify-center mb-4">
                            <span className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-red-500 text-red-500 font-bold shadow-[0_0_15px_rgba(220,38,38,0.8)]">
                                X
                            </span>
                        </div>
                        <h1 className="text-2xl font-black uppercase tracking-widest text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] mb-2">
                            [LINK SEVERED]
                        </h1>
                        <p className="text-red-400 text-xs tracking-[0.2em] uppercase mt-4">
                            The System has lost connection to the core matrix. Retrying synchronization...
                        </p>
                    </div>
                </div>
            );
        default:
            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-blue-100 relative overflow-hidden">
                    {/* Background Void/Smoke Effect - Blue */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.15)_0%,rgba(2,6,23,1)_100%)] pointer-events-none"></div>

                    <div className="z-10 flex flex-col items-center">
                        {/* Spinning loader */}
                        <svg className="animate-spin h-12 w-12 text-blue-500 mb-8 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>

                        <h1 className="text-xl font-bold uppercase tracking-[0.3em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
                            [SYSTEM INITIALIZING]
                        </h1>
                        <div className="flex items-center gap-2 mt-4">
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                            <p className="text-blue-400/80 text-xs tracking-widest uppercase">
                                Synchronizing Player Data...
                            </p>
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <>
            <ArchitectBanner />
            {renderView()}
        </>
    );
}