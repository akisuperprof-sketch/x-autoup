const express = require('express');
const path = require('path');
const dashboardApi = require('../../api/dashboard');
const generateApi = require('../../api/generate');
const postApi = require('../../api/post');
const deleteApi = require('../../api/delete');
const cronApi = require('../../api/cron');

const schedulerService = require('../services/scheduler_service');

const app = express();
const PORT = process.env.PORT || 3000;

// Start background scheduler (local crons)
schedulerService.start();

app.use(express.static(path.join(__dirname, '../../public')));
app.use(express.json()); // Enable JSON body parsing

const adapt = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
};

// API Routes
app.get('/api/dashboard', adapt(dashboardApi));
app.post('/api/generate', adapt(generateApi));
app.post('/api/post', adapt(postApi));
app.post('/api/delete', adapt(deleteApi));
app.get('/api/cron', adapt(cronApi));
app.get('/api/metrics', adapt(require('../../api/metrics')));

// Tracking Routes
app.get('/go', adapt(require('../../api/go')));
app.get('/api/log_click', adapt(require('../../api/log_click')));
app.post('/api/log_click', adapt(require('../../api/log_click')));
app.get('/api/log_cv', adapt(require('../../api/log_cv')));
app.post('/api/log_cv', adapt(require('../../api/log_cv')));

// Fallback to landing/dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/landing.html'));
});
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/admin.html'));
});
app.get('/apply', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/apply.html'));
});

app.listen(PORT, () => {
    console.log(`
    🚀 Server running at http://localhost:${PORT}
    Stats Dashboard: http://localhost:${PORT}/dashboard.html
    Force Generate:  curl -X POST http://localhost:${PORT}/api/generate
    Trigger Cron:    http://localhost:${PORT}/api/cron
    `);
});
