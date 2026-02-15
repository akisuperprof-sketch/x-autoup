# CHANGELOG - AirFuture X-Operator

## [v4.1] - 2026-02-16
### Added
- **スマート・リトライ（自動文面修復）機能**: X APIエラー（429/スパム判定）発生時、文末に異なる絵文字を自動付与して「別投稿」として再送を試みることで成功率を向上。
- **管理画面コントロールボタン**: 「統計更新（X API消費）」「記事補充（AI消費）」を手動実行できるボタンを新設。

### Changed
- **Cron実行周期の最適化**: X APIの制限リセット周期（15分）に合わせ、15分おきの実行にプログラム側も最適化。
- **定期実行の軽量化**: 定期実行時は「投稿」タスクのみを実行し、API 429エラーを徹底回避。

## [v4.0] - 2026-02-16
# AirFuture X-Operator System Specification v4.1

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
    - **トラッキング精度 (v4.0)**: アクセスを「Human」「Dev（管理者）」「Bot（機械）」に3分類し、統計からノイズを完全除去。
    - **スマート・リトライ (v4.1)**: 投稿失敗時に文末を自動微調整（絵文字ローテーション）してXのスパムフィルターを自動回避。
    - **タスク分離 (v4.1)**: 定期実行は「投稿」に特化。重い「統計取得」「AI生成」は管理画面から手動実行可能。

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
- **Tracking (v4.0)**:
    - **Traffic Categorization**: `is_bot` (Crawler/Preview) / `is_dev` (Admin/Self) / `Human` (Users)
    - **Noise Exclusion**: Bot/Dev アクセスをメイン統計（PV/CV）から強制除外。
    - **ID Normalization**: `mini_lp` と `mini_main` の自動名寄せ集計。
- **Data Integrity**: Slot ID Primary Key (Sheets-based constraint)
