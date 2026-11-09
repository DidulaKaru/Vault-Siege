require('dotenv').config();
const express = require('express');
const cors = require('cors');
const playRoutes = require('./routes/play');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', async (_req, res) => {
    try {
        await require('./db').query('SELECT 1');
        res.json({ status: 'ok' });
    } catch {
        res.status(503).json({ status: 'unhealthy' });
    }
});
app.use('/api/v1/play', playRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use((error, _req, res, _next) => {
    res.status(error.status === 400 ? 400 : 500).json({ message: error.status === 400 ? 'Invalid JSON request.' : 'Request failed.' });
});

const PORT = process.env.PORT || 5000;
if (require.main === module) app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});
module.exports = app;
