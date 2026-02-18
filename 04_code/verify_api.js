const dataService = require('./src/services/data_service');
const googleSheetService = require('./src/services/google_sheet_service');

async function test() {
    await dataService.init();
    const posts = await dataService.getPosts();

    // Stub logs
    const journeyLogs = [];
    const nowJST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);

    function generatePvTrend(logs, posts, nowJST) {
        const bins = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(nowJST.getTime() - i * 24 * 60 * 60 * 1000);
            const key = `${d.getMonth() + 1}/${d.getDate()}`;
            bins[key] = { pv: 0, posts: 0 };
        }
        posts.forEach(p => {
            if (p.status === 'posted' && p.posted_at) {
                try {
                    const d = new Date(p.posted_at);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    if (bins[key] !== undefined) bins[key].posts++;
                } catch (e) { }
            }
        });
        return Object.entries(bins).map(([t, v]) => ({ t, v: v.pv, posts: v.posts }));
    }

    const res = generatePvTrend(journeyLogs, posts, nowJST);
    console.log(JSON.stringify(res, null, 2));
}

test();
