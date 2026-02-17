# AirFuture X-Operator System Specification v4.4

## 1. 目的 (Core Mission)
X（Twitter）からLP（ランディングページ）への遷移を最大化し、AirFutureの購入成約率（CVR）を極限まで高めること。運用コストを最小化しつつ、データに基づいた「稼げる投稿」を自動で改善し続ける。

## 2. AI 記事生成・運用ルール (AI Generation & Ops Rules)

### 2.1 投稿トーン & 性格 (Persona)
- **名前**: AirFuture-kun (48世紀のSRE/エンジニアAI)
- **一人称**: ボク
- **口調**: 親しみやすく知性的、かつ感情に訴える表現。「マジ」の多用は禁止。
- **絵文字制限**: **1投稿につき最大3つまで**。

### 2.2 技術制約 & 運用ルール
- **ガバナンス**: 全ての開発・運用は [GOVERNANCE.md](./GOVERNANCE.md) (Antigravity Global Governance Rules v1.0) に準拠する。
- **文字数**: **110文字以上 〜 140文字以内**。
- **ハッシュタグ**: **最大2件まで**。
- **自動補充生成 (Fill-in mode)** (v3.7): 
    - 毎日午前8時(JST)の定期実行時に、当日〜3日先までの予約状況をスキャン。
    - 標準投稿枠（08:00, 12:00, 20:00）に空きがある場合、AIが自動で内容を生成し、その枠を埋める。
- **緊急即時生成 (Emergency Failover)** (v3.7): 
    - 投稿実行時に該当枠の予約が0件だった場合、その場でAIが1記事を生成し、即座に投稿を完了させる。
    - 10分ごとの頻繁なCron実行時でも重複生成を防ぐ hourly ロック機構を搭載。
- **堅牢な配信ロジック**:
    - **5分バッファ (拡張済)**: 10分周期のCronに最適化し、最大10分の判定バッファを確保。
    - **スロット一意性 (Slot ID)**: `YYYYMMDD-HH` 形式のIDによる物理的な重複投稿の阻止。
    - **トラッキング精度 (v4.0-4.2)**: 
        - アクセスを「人間」「開発者」「BOT」に3分類し、ノイズを除去。スプレッドシート表記も日本語（開発者/一般、BOT/人間）化。
    - **スマート・リトライ (v4.1)**: 投稿失敗時に文末を自動微調整（絵文字ローテーション）してXのスパムフィルターを回避。
    - **タスク分離 (v4.3)**: 定期実行は「投稿」に特化。統計取得は直近48時間に限定し、API 429エラー検知で即座に中断。管理画面にCron/台帳リンクを配置。

### 2.3 ステータス管理仕様 (Status Management)
スプレッドシートの `status` 列により、各記事の挙動を制御する。
- **`scheduled`**: 配信予約中（正常な投稿対象）。
- **`posted`**: 配信完了。
- **`draft_ai` / `draft`**: 下書き状態。自動投稿の対象外。
- **`cancel` / `stop`**: 配信停止。プログラムは無視し、枠が空いている場合は「緊急生成」の対象となる。
- **`deleted`**: 削除。管理画面のリストからも非表示となる。
- **`retry`**: 配信失敗後の再試行待ち。

### 2.4 花粉・季節インテリジェンス (v4.4 New)
- **PollenService**: 毎朝、日本の気象予報サイト (Tenki.jp等) から最新の花粉飛散レベルを取得する。
- **季節自動移行**: `2月15日` を境に、内部的なターゲット季節を「Winter」から「Spring (Pollen Season)」へ自動で切り替える。
- **動的プロンプト**: 取得した花粉レベル（非常に多い/多い/少ない等）をAIに伝え、冬のフレーズを禁止した上で、今の状況に最適な共感フレーズを生成させる。

### 2.5 生成・ブランディングルール
- **生成ルール**: `.agent/workflows/branding_generation_rules.md` に準拠。
- **マスター素材**: `af-mini-specialLP/dist/favicon.png` を正規製品モデルの唯一のリファレンスとする。
- **既存素材優先**: `/public/images` 内の既存アセット（寝室、車内等）を背景素材として再利用し、世界観を統一する。

### 2.6 ガバナンス & 保守ルール (Governance)
- **構成の固定**: 本リポジトリは Vercel の Root Directory 設定に基づき、**`04_code/`** を開発・実行の正会員とする。
- **配置制限**: 新規ファイルは必ず `04_code/` 内に配置し、ルートディレクトリを汚染しないこと。
- **ルーティング防衛**: `vercel.json` の書き換え時は、APIエンドポイントの拡張子（.js）をリライト先から除去するルールを厳守する。
- **変更履歴の強制**: システム構成に関わる変更は必ず `CHANGELOG.md` に記録し、`GOVERNANCE.md` に準拠すること。

## 4. ディレクトリ構成 (System Architecture)
Vercel Hobbyの標準仕様に準拠するため、プロジェクトをフラットな構成に統一しています。

```
/ (Root)
├── api/                # エンドポイント (cron, go, admin等)
├── src/                # サービス・ロジック
├── public/             # 静的ファイル (admin.html等)
├── vercel.json         # ルーティング設定
└── package.json        # 依存関係
```

## 5. 正しいアクセス方法
```
"https://airfuture.vercel.app/api/cron"  // 定期実行 (内部で x-autoup にプロキシ)
"https://airfuture.vercel.app/admin"    // 管理画面
"https://airfuture.vercel.app/go"       // リンク計測
```

**理由**: 
- `vercel.json` では `/apply` と `/admin` のみがルーティング定義されている
- `.html` 拡張子付きのパスは存在しないため404エラーとなる

**参照**: `vercel.json` L26-27 (apply), L14-19 (admin)

## 5. インフラ構成 (Infrastructure)

### 5.1 配信スケジュール (Cron Architecture)
- **Primary**: `cron-job.org` (外部サービス) による毎時実行。Vercelの無料枠制限（1日1回）をバイパスし、予約通りの配信を担保する。
- **Secondary**: Vercel Cron (Daily) による午前8時のバックアップ実行。
- **認証**: パラメータ `?pw=[ADMIN_PASSWORD]` によるアクセス制御。

### 5.2 技術スタック
- **Hosting**: Vercel (Hobby)
- **Database**: Google Sheets (Custom Logic via Google Sheet API)
- **Monitoring**: 独自実装の「System Status」インジケーターによるDB死活監視。
- **Tracking (v4.0)**:
    - **Traffic Categorization**: `is_bot` (Crawler/Preview) / `is_dev` (Admin/Self) / `Human` (Users)
    - **Noise Exclusion**: Bot/Dev アクセスをメイン統計（PV/CV）から強制除外。
    - **ID Normalization**: `mini_lp` と `mini_main` の自動名寄せ集計。
- **Data Integrity**: Slot ID Primary Key (Sheets-based constraint)
