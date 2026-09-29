const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const puzzleRegistry = require('./puzzles/puzzleRegistry');
const config = require('./config');

const app = express();
app.use(cors());
app.use(express.json());

// ── HMAC Token Configuration ──────────────────────────────
// Secret for signing submission tokens. Falls back to a random value per boot.
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 30_000; // Tokens expire after 30 seconds

function generateSubmissionToken(layerId) {
    const timestamp = Date.now();
    const payload = `${layerId}:${timestamp}`;
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    return `${payload}:${signature}`;
}

function validateSubmissionToken(token, expectedLayerId) {
    if (!token || typeof token !== 'string') return false;

    const parts = token.split(':');
    if (parts.length !== 3) return false;

    const [layerId, timestampStr, providedSig] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Check layer matches current active layer
    if (layerId !== expectedLayerId) return false;

    // Check token has not expired
    if (Date.now() - timestamp > TOKEN_TTL_MS) return false;

    // Verify HMAC signature
    const payload = `${layerId}:${timestampStr}`;
    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(providedSig, 'hex'), Buffer.from(expectedSig, 'hex'));
}

// ── Rate Limiting ─────────────────────────────────────────
const bypassLimiter = rateLimit({
    windowMs: 30_000,       // 30-second window
    max: 5,                 // 5 attempts per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "DENIED", message: "Rate limit exceeded. Too many attempts." }
});

// 7-State Sequence based on the updated orientation plan
const systemLayers = [
    { id: "punchcards", theme: "ERA_MECHANICAL" },
    { id: "hash", theme: "ERA_HASH" },
    { id: "book", theme: "ERA_ARCHIVE" },
    { id: "morse", theme: "ERA_MORSE" },
    { id: "github", theme: "ERA_OPEN_SOURCE" },
    { id: "siege", theme: "ERA_CLOUD_SIEGE" },
    { id: "unlocked", theme: "SYSTEM_ACCESSED" }
];

const STATE_FILE = path.join(__dirname, 'game-state.json');

function loadState() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            const state = JSON.parse(data);
            if (typeof state.activeLayerIndex === 'number') {
                return state.activeLayerIndex;
            }
        }
    } catch (err) {
        console.error("Error loading state file:", err);
    }
    return 0;
}

function saveState(index) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify({ activeLayerIndex: index }));
    } catch (err) {
        console.error("Error saving state file:", err);
    }
}

let activeLayerIndex = loadState();

//Go back

// Change this to go back to the first layer
activeLayerIndex = 6;
// Go to final page
// Locate this block in server/index.js
let siegeMetrics = {
    activeConnections: 0,
    // Pull from environment, fallback to 275 for the live event
    targetThreshold: parseInt(process.env.SIEGE_LIMIT) || 275
};

// I meant to have a .env file for the siege limit. Check if this works

const activeUsers = new Map();

// ── IP-based siege tracking ───────────────────────────────
// Maps IP -> Set of clientIds (limit 1 per IP to prevent spoofing)
const ipClientMap = new Map();
const MAX_CLIENTS_PER_IP = 1;

setInterval(() => {
    if (systemLayers[activeLayerIndex]?.id !== "siege") return;

    const now = Date.now();
    let currentActiveCount = 0;

    for (let [clientId, data] of activeUsers.entries()) {
        if (now - data.lastPing > 5000) {
            // Clean up expired user and their IP mapping
            activeUsers.delete(clientId);
            const ipClients = ipClientMap.get(data.ip);
            if (ipClients) {
                ipClients.delete(clientId);
                if (ipClients.size === 0) ipClientMap.delete(data.ip);
            }
        } else {
            currentActiveCount++;
        }
    }

    siegeMetrics.activeConnections = currentActiveCount;

    if (currentActiveCount >= siegeMetrics.targetThreshold) {
        activeLayerIndex++; // Globally upgrade to SYSTEM_ACCESSED (State 6)
        saveState(activeLayerIndex);
    }
}, 1000);

// ── Status and state reporting endpoint ───────────────────
app.get('/api/v1/system-state', (req, res) => {
    const currentLayer = systemLayers[activeLayerIndex];
    res.json({
        currentLayer: currentLayer,
        layerIndex: activeLayerIndex,
        metrics: currentLayer?.id === "siege" ? siegeMetrics : null,
        // Include a signed token the client must return with bypass-layer submissions
        submissionToken: currentLayer?.id !== "unlocked"
            ? generateSubmissionToken(currentLayer.id)
            : null
    });
});

// Config status endpoint for Era 5 (GitHub) with cache busting
app.get('/api/v1/config-status', (req, res) => {
    try {
        const configPath = require.resolve('./config.js');
        delete require.cache[configPath];
        const liveConfig = require('./config.js');

        res.json({
            attackMode: liveConfig.ATTACK_MODE_ENABLED,
            rateLimit: liveConfig.MAX_RATE_LIMIT
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to read configuration" });
    }
});

// ── Heartbeat ping endpoint for the Siege ─────────────────
app.post('/api/v1/siege-ping', (req, res) => {
    if (systemLayers[activeLayerIndex]?.id !== "siege") {
        return res.status(400).json({ status: "DENIED", message: "Siege endpoint is offline." });
    }

    const { clientId } = req.body;
    if (!clientId) {
        return res.status(400).json({ status: "DENIED", message: "Missing client ID." });
    }

    // IP-based anti-spoofing: limit each IP to MAX_CLIENTS_PER_IP client IDs
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

    if (!ipClientMap.has(clientIp)) {
        ipClientMap.set(clientIp, new Set());
    }

    const ipClients = ipClientMap.get(clientIp);

    // Allow if this clientId is already registered for this IP, or under the limit
    if (!ipClients.has(clientId)) {
        if (ipClients.size >= MAX_CLIENTS_PER_IP) {
            return res.status(429).json({
                status: "DENIED",
                message: "Maximum concurrent sessions reached for this node."
            });
        }
        ipClients.add(clientId);
    }

    activeUsers.set(clientId, { lastPing: Date.now(), ip: clientIp });

    res.json({ status: "ACKNOWLEDGED" });
});

// ── Dynamic puzzle gatekeeper ─────────────────────────────
app.post('/api/v1/bypass-layer', bypassLimiter, (req, res) => {
    const { submission, submissionToken } = req.body;
    const activeLayer = systemLayers[activeLayerIndex];

    if (!activeLayer || activeLayer.id === "unlocked") {
        return res.json({ status: "COMPLETE", theme: "SYSTEM_ACCESSED" });
    }

    // Block bypass-layer for layers that have alternative progression paths
    // Era 5 (github): must go through config-status polling / real PR flow
    // Era 6 (siege): must reach connection threshold — no manual bypass
    if (activeLayer.id === "github" || activeLayer.id === "siege") {
        return res.status(403).json({
            status: "DENIED",
            message: "This security layer cannot be bypassed through direct submission."
        });
    }

    // Validate HMAC submission token
    if (!validateSubmissionToken(submissionToken, activeLayer.id)) {
        return res.status(403).json({
            status: "DENIED",
            message: "Invalid or expired submission token. Refresh your interface."
        });
    }

    try {
        const currentPuzzle = puzzleRegistry.findPuzzle(activeLayer.id);
        const evaluation = currentPuzzle.validate(submission);

        if (evaluation.success) {
            activeLayerIndex++;
            saveState(activeLayerIndex);
            return res.json({
                status: "STATE UPGRADED",
                message: "Security override acknowledged.",
                nextLayer: systemLayers[activeLayerIndex]
            });
        }

        return res.status(400).json({ status: "DENIED", message: evaluation.message });
    } catch (error) {
        return res.status(500).json({ status: "ERROR", message: "Failed to evaluate puzzle layer." });
    }
});

// ── Era 5 (GitHub) — server-side auto-advancement ─────────
// When config-status polling detects the correct values AND we're on the github layer,
// advance the state automatically. This is the ONLY way to pass Era 5.
setInterval(() => {
    if (systemLayers[activeLayerIndex]?.id !== "github") return;

    try {
        const configPath = require.resolve('./config.js');
        delete require.cache[configPath];
        const liveConfig = require('./config.js');

        const threshold = parseInt(process.env.ERA5_RATE_LIMIT) || 200;

        if (liveConfig.ATTACK_MODE_ENABLED === true && liveConfig.MAX_RATE_LIMIT >= threshold) {
            activeLayerIndex++;
            saveState(activeLayerIndex);
            console.log("[ERA 5] Configuration override detected. Advancing to next layer.");
        }
    } catch (error) {
        // Config not yet modified — keep polling
    }
}, 3000);

// ── Protected reward download ─────────────────────────────
app.get('/api/v1/claim-reward', (req, res) => {
    if (activeLayerIndex < 6) {
        return res.status(403).json({
            status: "DENIED",
            message: "System has not been fully breached. Complete all trials first."
        });
    }

    const rewardPath = path.join(__dirname, 'secure-assets', 'Go Ahead Open This.bat');
    if (!fs.existsSync(rewardPath)) {
        return res.status(404).json({ status: "ERROR", message: "Reward artifact not found." });
    }

    res.download(rewardPath, 'Go Ahead Open This.bat');
});

// ── Architect Broadcast ───────────────────────────────────
// Message from the architect, controlled via environment variables.
// Set ARCHITECT_MESSAGE to enable, ARCHITECT_ACTIVATED_AT to the ISO timestamp
// when you want the 10-minute window to start counting from.
// If ARCHITECT_ACTIVATED_AT is not set, it defaults to server boot time.
const ARCHITECT_TTL_MS = 10 * 60 * 1000; // 10 minutes

app.get('/api/v1/architect-broadcast', (req, res) => {
    const message = process.env.ARCHITECT_MESSAGE;

    if (!message) {
        return res.json({ active: false });
    }

    // Parse activation time — defaults to server boot time if not set
    const activatedAt = process.env.ARCHITECT_ACTIVATED_AT
        ? new Date(process.env.ARCHITECT_ACTIVATED_AT).getTime()
        : serverBootTime;

    const expiresAt = activatedAt + ARCHITECT_TTL_MS;
    const now = Date.now();

    if (now >= expiresAt) {
        return res.json({ active: false });
    }

    res.json({
        active: true,
        id: activatedAt,
        message: message,
        expiresAt: expiresAt,
        remainingMs: expiresAt - now
    });
});

const serverBootTime = Date.now();
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Vault Engine running on port ${PORT}`);
});