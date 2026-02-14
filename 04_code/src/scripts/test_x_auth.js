const xService = require('../services/x_service');
const logger = require('../utils/logger');

async function checkAuth() {
    try {
        if (!xService.client) {
            console.error('X API client not initialized. Check your environment variables.');
            return;
        }

        // Get authenticated user info
        const me = await xService.client.v2.me();
        
        console.log('✅ Connection Successful!');
        console.log('User ID:', me.data.id);
        console.log('Name:', me.data.name);
        console.log('Username:', me.data.username);
        
    } catch (error) {
        console.error('❌ Connection Failed:', error);
        if (error.code === 401 || error.code === 403) {
            console.error('Make sure your API Keys and Access Tokens are correct and have correct permissions (Read and Write).');
        }
    }
}

checkAuth();
