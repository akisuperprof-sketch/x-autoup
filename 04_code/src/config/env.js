require('dotenv').config();

module.exports = {
    X_API_KEY: process.env.X_API_KEY,
    X_API_SECRET: process.env.X_API_SECRET,
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN,
    X_ACCESS_SECRET: process.env.X_ACCESS_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,

    // Google Sheets Config
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,

    PORT: process.env.PORT || 3000,
    DRY_RUN: process.env.DRY_RUN === 'true',
    RUN_MODE: process.env.RUN_MODE || 'local',
    AUTO_IMAGE: process.env.AUTO_IMAGE === '1',
    WEBHOOK_URL: process.env.WEBHOOK_URL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'airfuture2026'
};
