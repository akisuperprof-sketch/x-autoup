import { getPid, logCvOnce } from './afTracking';

/**
 * 全域監視型 CVトラッカー (AirFuture Auto CV Tracker)
 * data-af-apply 属性を持つ要素のクリックを自動捕捉し、CVを記録してから遷移させます。
 */
export const initAutoCv = () => {
    if (typeof window === 'undefined' || window.af_initialized) return;
    window.af_initialized = true;

    console.log('[afAutoCv] Initializing automatic CV tracking...');

    document.addEventListener('click', async (e) => {
        // data-af-apply 属性を持つ要素、またはその子要素を検索
        const target = e.target.closest('[data-af-apply]');
        if (!target) return;

        // リンクのデフォルト挙動（即時遷移）を一時停止
        e.preventDefault();

        const pid = getPid();
        const href = target.getAttribute('href') || target.getAttribute('data-href');

        console.log(`[afAutoCv] Capture click on: ${href}, pid: ${pid}`);

        if (pid) {
            // 非同期でCVを記録 (内部で重複チェックあり)
            logCvOnce(pid);
        }

        // 遷移先URLの構築 (pidがあればクエリパラメータにも付与)
        let finalHref = href;
        if (pid && finalHref && finalHref.startsWith('http')) {
            try {
                const url = new URL(finalHref);
                url.searchParams.set('pid', pid);
                finalHref = url.toString();
            } catch (e) {
                console.warn('[afAutoCv] Could not append pid to URL:', finalHref);
            }
        }

        // UX維持と計測安定性のための待機 (120ms)
        setTimeout(() => {
            if (finalHref) {
                window.location.href = finalHref;
            }
        }, 120);
    }, true); // キャプチャフェーズでイベントを確実に捕捉
};
