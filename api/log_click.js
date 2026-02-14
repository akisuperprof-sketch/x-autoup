const dataService = require('../src/services/data_service');

module.exports = async (req, res) => {
    const { pid, lp } = req.query;

    if (!pid) {
        return res.status(400).json({ error: 'Missing pid' });
    }

    try {
        await dataService.init();
        // If pid is not a number (e.g. 'hayfever_lp'), incrementClick might fail if looking up by ID in a fixed list,
        // but for logging it's fine. We try incrementClick but ignore errors or it returns false.
        await dataService.incrementClick(pid);

        const ua = req.headers['user-agent'] || '';
        const ref = req.headers['referer'] || '';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

        await dataService.addEventLog('click', {
            pid,
            lp_id: lp || 'default_lp',
            ua,
            ref,
            ip
        });
        res.status(200).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
