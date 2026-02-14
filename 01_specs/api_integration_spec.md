# API Integration Specification (X, Veo3, Gemini)

## 1. X API Integration
### 認証
*   **Method**: OAuth 2.0 User Context
*   **Scopes**: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
*   **Token Management**: Refresh tokens must be stored securely and refreshed automatically.

### 投稿機能
*   **Endpoint**: `POST /2/tweets`
*   **Parameters**: `text`, `media.media_ids` (for images/videos)
*   **Rate Limits**: 
    *   Free: 500 posts/month (Write-only)
    *   Basic: 100 posts/24h (User level), 50,000 posts/month (App level)

### トレンド取得 (Basic Tier or External)
*   **Endpoint**: `GET /2/trends/by/woeid/:woeid` (v1.1) or similar v2 endpoint if available.
*   **Note**: If API limits prevent frequent trend checking, consider using a lightweight external scraper or RSS feed for trends.

## 2. Google Gemini API Integration (Content Generation)
### 用途
*   投稿ドラフト生成 (Text Generation)
*   画像生成プロンプトの作成
*   投稿内容の自己評価 (Safety/Quality Check)

### 設定
*   **Model**: `gemini-1.5-pro` (for complex logic) or `gemini-1.5-flash` (for speed/cost)
*   **Input**: Character profile, Campaign specs, Trend data
*   **Output**: JSON formatted draft posts (text, hashtags, CTA type)

## 3. Google Veo3 / Video Generation API (Future Integration)
### 用途
*   ショート動画生成 (AirFutureくんの活動、空気の動きの可視化)
*   **Note**: Veo3 is currently in limited access. Placeholder integration for now.

### 代替案 (Current)
*   **Image Generation**: Use Gemini (Imagen 3) or OpenAI (DALL-E 3) via API to generate static images for posts.
*   **Video**: Use simple animation tools or ffmpeg to create slideshows from generated images.

## 4. Error Handling & Logging
*   All API calls must be wrapped in try-catch blocks.
*   **Retry Logic**: Exponential backoff for 429 (Rate Limit) and 5xx errors.
*   **Logging**: Log request ID, timestamp, status code, and error message to `logs` table.
