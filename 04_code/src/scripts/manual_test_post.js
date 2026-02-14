const { TwitterApi } = require("twitter-api-v2");
require("dotenv").config();

const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
});

async function testPost() {
    try {
        const tweet = await client.v2.tweet("【テスト投稿】AirFuture API連携確認中です_v2");
        console.log("Posted:", tweet.data.id);
        console.log(`View Tweet: https://x.com/i/status/${tweet.data.id}`);
    } catch (e) {
        console.error("Test Post Failed:", e);
    }
}

testPost();
