const dataService = require('../src/services/data_service');

module.exports = async (req, res) => {
    const { pid, type, lp } = req.query;
    const lp_id = lp || 'mini_main';

    let baseUrl = "https://v0-air-future-mini-design.vercel.app";
    let destination = baseUrl;
    if (lp && lp !== 'mini_main' && lp !== 'mini_lp') {
        destination = `${baseUrl}/${lp}`;
    }

    if (type === 'biz' || type === 'tob') {
        destination = "https://airfuture.jp/";
    }
    const trackingPID = pid || 'direct_visit';

    try {
        await dataService.init();

        const ua = req.headers['user-agent'] || '';
        const ref = req.headers['referer'] || '';
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        const isBot = dataService.isBot(ua, ref);

        // Set Cookies for CV tracking (expires in 30 days)
        res.setHeader('Set-Cookie', [
            `af_pid=${trackingPID}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`,
            `af_lp=${lp_id}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`
        ]);

        // Server-side logging: captures Bots and Humans with full headers
        try {
            await dataService.addEventLog('click', {
                pid: trackingPID,
                lp_id,
                ua,
                ref,
                ip,
                is_bot: isBot,
                dest_url: destination
            });
        } catch (logErr) {
            console.error('[CRITICAL] Tracking Log Failed:', logErr.message);
        }
    } catch (rootErr) {
        console.error('[CRITICAL] Tracking Initialization Failed:', rootErr.message);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AirFuture | Redirecting...</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;900&family=Noto+Sans+JP:wght@400;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Outfit', 'Noto Sans JP', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .glass { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.5); }
        
        /* Spinner Animation */
        .spinner {
            width: 60px;
            height: 60px;
            position: relative;
            margin: 0 auto 24px;
        }
        .spinner-ring {
            position: absolute;
            width: 100%;
            height: 100%;
            border: 4px solid transparent;
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        }
        .spinner-ring:nth-child(1) { animation-delay: -0.45s; }
        .spinner-ring:nth-child(2) { animation-delay: -0.3s; opacity: 0.7; }
        .spinner-ring:nth-child(3) { animation-delay: -0.15s; opacity: 0.5; }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Pulse Animation */
        .pulse-dot {
            width: 12px;
            height: 12px;
            background: #6366f1;
            border-radius: 50%;
            display: inline-block;
            margin: 0 4px;
            animation: pulse 1.4s ease-in-out infinite;
        }
        .pulse-dot:nth-child(1) { animation-delay: 0s; }
        .pulse-dot:nth-child(2) { animation-delay: 0.2s; }
        .pulse-dot:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes pulse {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
        }
        
        /* Progress Bar Animation */
        .progress-bar {
            animation: fill 1.2s ease-out forwards;
        }
        
        @keyframes fill {
            0% { width: 0%; }
            100% { width: 100%; }
        }
        
        /* Fade In */
        .fade-in {
            animation: fadeIn 0.6s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-6">
    <div class="max-w-md w-full relative z-10 text-center fade-in">
        <!-- Spinner -->
        <div class="spinner">
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
        </div>

        <div class="glass rounded-3xl p-8 shadow-2xl">
            <h1 class="text-2xl font-black text-slate-800 mb-3 tracking-tight">
                いつもありがとう！<br>
                <span class="text-indigo-600">製品ページ</span>に繋がるよ♪
            </h1>
            
            <p class="text-sm text-slate-500 font-semibold mb-6">
                最新の稼働データをチェック中...✨
            </p>

            <div class="w-full h-2 bg-slate-100 rounded-full mb-6 overflow-hidden">
                <div class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full progress-bar"></div>
            </div>
            
            <div class="flex justify-center items-center mb-4">
                <div class="pulse-dot"></div>
                <div class="pulse-dot"></div>
                <div class="pulse-dot"></div>
            </div>
            
            <p class="text-xs text-slate-400 font-bold uppercase tracking-widest">Optimizing for you...</p>
        </div>
    </div>

    <script>
        const pid = "${trackingPID || ''}";
        const destination = "${destination}";
        
        async function runTracking() {
            try {
                if (pid) {
                    localStorage.setItem('af_pid', pid);
                    localStorage.setItem('af_lp', "${lp_id}");
                }
            } catch (e) {
                console.warn('LocalStorage access failed:', e);
            }

            // Append pid to destination URL for CV tracking on the destination side
            let finalDest = destination;
            try {
                if (pid) {
                    const url = new URL(destination);
                    url.searchParams.set('pid', pid);
                    finalDest = url.toString();
                }
            } catch (e) {
                console.warn('URL parsing failed:', e);
            }

            setTimeout(() => {
                window.location.href = finalDest;
            }, 1200);
        }

        runTracking();
    </script>
</body>
</html>
    `);
};
