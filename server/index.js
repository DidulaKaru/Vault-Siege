require('dotenv').config();
const express = require('express');
const cors = require('cors');
const playRoutes = require('./routes/play');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/v1/play', playRoutes);
app.use('/api/v1/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
});