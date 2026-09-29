import React, { useState } from 'react';

export default function WelcomeScreen() {
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState('');

    const handleDownload = async () => {
        setDownloading(true);
        setError('');
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/claim-reward`);
            if (!res.ok) {
                const data = await res.json();
                setError(data.message || "Download denied.");
                setDownloading(false);
                return;
            }
            // Convert response to blob and trigger download
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Go Ahead Open This.bat';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            setError("Failed to connect to the system.");
        }
        setDownloading(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-blue-100 selection:bg-blue-500/30 relative overflow-hidden">
            {/* Background Void/Smoke Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.2)_0%,rgba(2,6,23,1)_100%)] pointer-events-none"></div>

            {/* Main System Panel */}
            <div className="max-w-2xl w-full bg-slate-900/60 backdrop-blur-md border-2 border-blue-400 shadow-[0_0_30px_rgba(96,165,250,0.5)] p-8 relative z-10">

                {/* Tech/Game UI Corner Accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-200"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-200"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-200"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-200"></div>

                {/* Header */}
                <div className="flex flex-col items-center mb-8 border-b border-blue-500/30 pb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500/20 border-2 border-blue-400 text-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.6)]">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </span>
                        <h1 className="text-3xl font-black uppercase tracking-widest text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                            QUEST CLEARED
                        </h1>
                    </div>
                    <h2 className="text-xs font-semibold tracking-[0.3em] text-blue-300 uppercase">
                        [STATUS: SYSTEM MATRICES UNLOCKED]
                    </h2>
                </div>

                {/* System Narrative */}
                <div className="space-y-4 mb-8 text-center text-sm font-medium tracking-wider">
                    <p className="leading-relaxed drop-shadow-[0_0_5px_rgba(191,219,254,0.3)] text-green-400 font-bold uppercase">
                        Congratulations. You have solved the puzzle.
                    </p>
                    <p className="text-blue-200/80 text-xs uppercase tracking-widest leading-loose">
                        All chronological gateways breached. The dimensional rift is stabilized. Your rewards have arrived.
                    </p>
                </div>

                {/* Message from the Architect */}
                <div className="mb-10 p-6 bg-blue-950/40 border border-blue-400/50 rounded-sm relative shadow-[inset_0_0_20px_rgba(30,58,138,0.4)]">
                    <div className="absolute -top-3 left-4 bg-slate-900 px-2 text-yellow-400 text-[10px] font-bold tracking-[0.2em] uppercase border border-yellow-400/50">
                        [DIRECTIVE FROM THE ARCHITECT]
                    </div>
                    <p className="text-blue-100 text-sm leading-relaxed font-mono">
                        "Welcome to the dungeon. We forged this gauntlet to test your resolve, and you've proven worthy of the title <span className="text-green-400 font-bold">[PLAYER]</span>.
                        <br /><br />
                        Over the next three years, the System will issue relentless quests and unforgiving trials. Face them. Your opportunities to Level Up are absolute, and your growth has no level cap.
                        <br /><br />
                        Survive, level up, and arise."
                        <br />
                        <span className="text-blue-400 mt-4 block font-bold tracking-widest uppercase text-xs">
                            — The Architect
                        </span>
                    </p>
                </div>

                {/* Download Button — now fetches from protected API endpoint */}
                <div className="flex flex-col items-center gap-3">
                    <div className="relative group w-full max-w-md">
                        <div className="absolute -inset-0.5 bg-blue-500/30 blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="relative flex items-center justify-center gap-4 bg-slate-900 border border-blue-400/80 px-6 py-4 hover:bg-blue-900/40 transition-colors w-full disabled:opacity-50 disabled:cursor-wait"
                        >
                            <span className="text-yellow-400 font-bold tracking-widest uppercase text-xs">
                                {downloading ? '[DOWNLOADING...]' : '[CLAIM REWARD]'}
                            </span>
                        </button>
                    </div>
                    {error && (
                        <div className="text-red-500 font-bold text-xs tracking-widest uppercase drop-shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse">
                            [ERROR: {error}]
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}