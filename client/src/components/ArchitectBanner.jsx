import React, { useState, useEffect } from 'react';

const DISMISS_KEY = 'architect_banner_dismissed';

export default function ArchitectBanner() {
    const [visible, setVisible] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [message, setMessage] = useState('');

    const [messageId, setMessageId] = useState(null);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/v1/architect-broadcast`)
            .then(res => res.json())
            .then(data => {
                if (!data.active || !data.message) return;

                // If user already dismissed THIS specific message, don't show
                if (localStorage.getItem(DISMISS_KEY) === String(data.id)) return;

                setMessageId(data.id);
                setMessage(data.message);
                setTimeLeft(data.remainingMs);
                setVisible(true);
            })
            .catch(() => { /* Server unreachable — silently skip */ });
    }, []);

    // Countdown timer
    useEffect(() => {
        if (!visible) return;

        const tick = setInterval(() => {
            setTimeLeft(prev => {
                const next = prev - 1000;
                if (next <= 0) {
                    clearInterval(tick);
                    hide();
                    return 0;
                }
                return next;
            });
        }, 1000);

        return () => clearInterval(tick);
    }, [visible]);

    const dismiss = () => {
        if (messageId) {
            localStorage.setItem(DISMISS_KEY, String(messageId));
        }
        hide();
    };

    const hide = () => {
        setFadeOut(true);
        setTimeout(() => setVisible(false), 500);
    };

    if (!visible) return null;

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return (
        <div
            className={`fixed inset-0 z-50 flex items-start justify-center pt-6 px-4 pointer-events-none transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
        >
            <div className="pointer-events-auto max-w-2xl w-full bg-slate-900/90 backdrop-blur-xl border border-yellow-400/60 shadow-[0_0_40px_rgba(250,204,21,0.15)] p-6 relative animate-[slideDown_0.6s_ease-out]">

                {/* Corner Accents — Gold */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-yellow-400/80"></div>
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-yellow-400/80"></div>
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-yellow-400/80"></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-yellow-400/80"></div>

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <h3 className="text-yellow-400 text-xs font-bold tracking-[0.2em] uppercase">
                            [TRANSMISSION FROM THE ARCHITECT]
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-yellow-400/60 text-[10px] font-mono tracking-wider">
                            {timeStr}
                        </span>
                        <button
                            onClick={dismiss}
                            className="text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                            aria-label="Dismiss"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Message — rendered from server */}
                <p className="text-blue-100 text-sm leading-relaxed font-mono whitespace-pre-line">
                    {message}
                </p>
                <span className="text-yellow-400/70 mt-3 block font-bold tracking-widest uppercase text-[10px]">
                    — The Architect
                </span>
            </div>
        </div>
    );
}
