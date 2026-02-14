const dataService = require('../src/services/data_service');

module.exports = async (req, res) => {
    // CV can come from query (GET) or body (POST)
    const body = req.body || {};
    const pid = req.query.pid || body.pid;
    const lp_id = req.query.lp || body.lp || 'mini_main';
    const revenue = parseFloat(req.query.revenue || body.revenue || 0);
    const order_id = req.query.order_id || body.order_id || '';

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid for CV tracking' });
    }

    try {
        await dataService.init();

        const ua = req.headers['user-agent'] || '';
        const ref = req.headers['referer'] || '';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const isBot = dataService.isBot(ua, ref);

        await dataService.addEventLog('cv', {
            pid,
            lp_id,
            revenue,
            order_id,
            ua,
            ref,
            ip_hash: dataService.getIpHash(ip),
            is_bot: isBot
        });

        res.status(200).json({ success: true, message: `CV logged for post ${pid}`, revenue });
    } catch (e) {
        console.error('CV Logging Error:', e);
        res.status(500).json({ error: e.message });
    }
};
