# AirFuture X-Operator System Specification v3.9

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
    - **時間ゆらぎ (Jitter)** (v3.9): 投稿予約時に0〜7分のランダムな遅延を付与し、ボット検知を回避。
    - **スロット一意性 (Slot ID)** (v3.9): `YYYYMMDD-HH` 形式のIDによる物理的な重複投稿の阻止。
    - **タスク分離**: 投稿、ドラフト生成、メトリクス集計を独立して実行。

### 2.3 ガバナンス & 保守ルール (Governance)
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
- **Tracking**: Server-side Logging (Click) + Client-side Gateway (CV)
- **Data Integrity**: Slot ID Primary Key (Sheets-based constraint)
