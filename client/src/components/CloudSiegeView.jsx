import React, { useEffect, useState } from 'react';

// Generates a simple random ID for the current browser session
const generateClientId = () => Math.random().toString(36).substring(2, 15);

export default function CloudSiegeView({ metrics }) {
    const [clientId] = useState(generateClientId());

    // Automatic heartbeat ping
    useEffect(() => {
        const interval = setInterval(() => {
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/siege-ping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId })
            }).catch(() => console.error("Heartbeat failed"));
        }, 2000);

        return () => clearInterval(interval);
    }, [clientId]);

    const progressPercentage = metrics
        ? Math.min((metrics.activeConnections / metrics.targetThreshold) * 100, 100)
        : 0;

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-red-100 selection:bg-red-900/50 relative overflow-hidden">
            {/* Background Void/Smoke Effect - Tinted Red for Emergency */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(153,27,27,0.15)_0%,rgba(2,6,23,1)_100%)] pointer-events-none"></div>

            {/* Main System Panel */}
            <div className="max-w-3xl w-full bg-slate-900/40 backdrop-blur-md border-2 border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)] p-8 relative z-10 animate-[pulse_4s_ease-in-out_infinite]">

                {/* Tech/Game UI Corner Accents - Red */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-400"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-400"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-400"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-400"></div>

                {/* Header */}
                <div className="flex flex-col items-center mb-8 border-b border-red-600/30 pb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 flex items-center justify-center rounded-full border-2 border-red-500 text-red-500 text-sm font-bold shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-ping">
                            !
                        </span>
                        <h1 className="text-3xl font-black uppercase tracking-widest text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
                            EMERGENCY QUEST
                        </h1>
                    </div>
                    <h2 className="text-xs font-semibold tracking-[0.3em] text-red-400 uppercase">
                        [TRIAL: SYSTEM OVERLOAD]
                    </h2>
                </div>

                {/* Narrative / Instructions */}
                <div className="space-y-6 mb-10 text-center text-sm font-medium tracking-wider">
                    <p className="leading-relaxed drop-shadow-[0_0_5px_rgba(254,202,202,0.3)] text-red-100">
                        [THE SYSTEM IS MEASURING THE COLLECTIVE RESOLVE OF THE <span className="text-green-400 font-bold">'PLAYERS'</span>.]
                    </p>
                    <p className="text-yellow-300/80 text-xs uppercase tracking-widest leading-loose">
                        Two men will not die;
                        <br />
                        the grappled boat will not sink
                        <br />
                        A three-ply towrope will not break.
                        <br />
                        If two assist one another, how can they fail?
                    </p>
                    <p className="text-white-300/80 text-xs uppercase tracking-widest leading-loose">
                        - The Epic of Gilgamesh
                    </p>

                    <p className="text-red-300/80 text-xs uppercase tracking-widest leading-loose">
                        Exactly 275 Players must synchronize to stabilize the dimensional rift. Keep your interface active. If you choose not to accept, or if the connection severs, there will be a <span className="text-red-500 font-bold text-sm drop-shadow-[0_0_8px_rgba(220,38,38,1)]">[PENALTY]</span>.
                    </p>
                </div>

                {/* Live Synchronization Tracker */}
                <div className="border border-red-600/50 bg-red-950/30 p-8 rounded-sm text-center relative overflow-hidden mb-8 shadow-[inset_0_0_20px_rgba(220,38,38,0.2)]">
                    <div className="text-xs text-red-400 uppercase tracking-[0.2em] mb-4 font-bold">
                        Live Player Synchronization
                    </div>
                    <div className="text-7xl font-black text-white drop-shadow-[0_0_20px_rgba(220,38,38,0.8)] tabular-nums tracking-tighter">
                        {metrics ? metrics.activeConnections : 0}
                        <span className="text-2xl text-red-600 ml-2 tracking-normal">/ {metrics?.targetThreshold || 275}</span>
                    </div>

                    {/* Node ID Marker */}
                    <div className="absolute top-3 right-3 text-[10px] text-red-500/60 tracking-widest font-mono">
                        ID: {clientId.toUpperCase()}
                    </div>
                    {/* Active Ping Indicator */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 text-[10px] text-red-500/60 tracking-widest">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_5px_rgba(220,38,38,0.8)]"></div>
                        LINK LIVE
                    </div>
                </div>

                {/* Progress Bar (HP/MP Style) */}
                <div className="space-y-3">
                    <div className="flex justify-between text-xs font-bold text-red-400 tracking-widest uppercase">
                        <span>Stabilization Rate</span>
                        <span>{progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-950/80 h-6 border border-red-600/50 p-0.5 relative rounded-sm overflow-hidden">
                        <div
                            style={{ width: `${progressPercentage}%` }}
                            className="bg-gradient-to-r from-red-800 to-red-500 h-full shadow-[0_0_15px_rgba(220,38,38,0.8)] transition-all duration-1000 ease-in-out relative"
                        >
                            {/* Inner glow effect for the bar */}
                            <div className="absolute inset-0 bg-white/20 w-full h-1"></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}