import React, { useState } from 'react';

export default function MorseView({ onBreach, submissionToken }) {
    const [input, setInput] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/bypass-layer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submission: input, submissionToken })
        })
            .then(async res => {
                const data = await res.json();
                if (res.ok) onBreach();
                else setError(data.message || "INVALID COORDINATES");
            })
            .catch(() => setError("SYSTEM CONNECTION FAILED"));
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-blue-100 selection:bg-blue-500/30 relative overflow-hidden">
            {/* Background Void/Smoke Effect */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.15)_0%,rgba(2,6,23,1)_100%)] pointer-events-none"></div>

            {/* Main System Panel */}
            <div className="max-w-2xl w-full bg-slate-900/40 backdrop-blur-md border-2 border-blue-400 shadow-[0_0_25px_rgba(96,165,250,0.4)] p-8 relative z-10">

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
                        [TRIAL: HARDWARE INTERCEPTION]
                    </h2>
                </div>

                {/* Narrative / Instructions */}
                <div className="space-y-6 mb-10 text-center text-sm font-medium tracking-wider">
                    <p className="leading-relaxed drop-shadow-[0_0_5px_rgba(191,219,254,0.3)]">
                        [THE SYSTEM REQUIRES THE <span className="text-green-400 font-bold">'PLAYER'</span> TO INTERFACE WITH EXTERNAL HARDWARE.]
                    </p>
                    <p className="text-blue-300/70 text-xs uppercase tracking-widest leading-loose">
                        A physical hardware node awaits your inspection. The Architect has embedded a localized transmission within the circuitry, but the signal remains hidden amoungst the noise. Deploy your highest-tier embedded mage to manipulate the physical matrix and force the signal into the light. Decipher the temporal pulses to extract your next spatial coordinates.
                    </p>
                </div>

                {/* Input Form */}
                <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-6">
                    <div className="w-full max-w-md">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => { setInput(e.target.value); setError(''); }}
                            className="w-full bg-slate-950/60 border border-blue-500/50 p-4 text-center text-white text-lg tracking-[0.2em] focus:outline-none focus:border-blue-400 focus:shadow-[0_0_20px_rgba(96,165,250,0.5)] font-mono uppercase transition-all rounded-sm"
                            placeholder="INPUT NODE TARGET"
                            autoFocus
                        />
                    </div>

                    {/* Penalty/Error Output */}
                    {error && (
                        <div className="text-red-500 font-bold text-sm tracking-widest uppercase drop-shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse">
                            [PENALTY: {error}]
                        </div>
                    )}

                    {/* Action Button */}
                    <button
                        type="submit"
                        className="w-full max-w-md bg-blue-600/10 text-blue-100 font-bold py-4 px-6 border border-blue-500/50 hover:bg-blue-600/30 hover:border-blue-300 hover:shadow-[0_0_25px_rgba(96,165,250,0.6)] transition-all uppercase tracking-widest rounded-sm mt-4"
                    >
                        VERIFY WITH SYSTEM
                    </button>
                </form>

            </div>
        </div>
    );
}