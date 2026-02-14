/**
 * AirFuture Tracking Library v1
 * Handles PID extraction and deduplicated CV logging.
 */

export const getPid = () => {
  if (typeof window === 'undefined') return null;

  try {
    // 1. URL Query
    const urlParams = new URLSearchParams(window.location.search);
    const queryPid = urlParams.get('pid');
    if (queryPid) return queryPid;

    // 2. localStorage
    const localPid = localStorage.getItem('af_pid');
    if (localPid) return localPid;

    // 3. Cookie
    const cookies = document.cookie.split('; ');
    const pidCookie = cookies.find(row => row.startsWith('af_pid='));
    if (pidCookie) return pidCookie.split('=')[1];

  } catch (e) {
    console.error('Error getting PID:', e);
  }

  return null;
};

export const logCvOnce = async (pid) => {
  if (!pid || typeof window === 'undefined') return false;

  const storageKey = `cv_sent_${pid}`;
  
  // Deduplication check
  if (localStorage.getItem(storageKey)) {
    console.log('[afTracking] CV already recorded for this PID:', pid);
    return true; 
  }

  try {
    // Save to localStorage immediately to prevent race conditions
    localStorage.setItem(storageKey, 'true');
    // Also store as current PID for fallback
    localStorage.setItem('af_pid', pid);

    const response = await fetch(`/api/log_cv?pid=${pid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    return response.ok;
  } catch (error) {
    console.error('[afTracking] CV logging failed:', error);
    return false;
  }
};
