const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');

const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message} ${data ? JSON.stringify(data) : ''}\n`;

    console.log(logEntry.trim());

    // Only write to file if NOT in production (Vercel)
    if (process.env.RUN_MODE !== 'production') {
        try {
            if (!fs.existsSync(LOG_DIR)) {
                fs.mkdirSync(LOG_DIR, { recursive: true });
            }
            const logFile = path.join(LOG_DIR, `${new Date().toISOString().split('T')[0]}.log`);
            fs.appendFileSync(logFile, logEntry);
        } catch (err) {
            // Silently fail if file system is read-only
        }
    }
};

module.exports = {
    info: (msg, data) => log('INFO', msg, data),
    error: (msg, data) => log('ERROR', msg, data),
    warn: (msg, data) => log('WARN', msg, data),
};
