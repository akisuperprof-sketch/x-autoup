# AirFuture X-Operator System Specification v4.5

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
- **タイムゾーン管理**: すべての時刻判定および統計集計は **日本時間 (JST / UTC+9)** を基準とする。環境依存の `new Date()` の直接使用は禁止（詳細は `GOVERNANCE.md` 参照）。
- **ハッシュタグ**: **最大2件まで**。
- **自動補充生成 (Fill-in mode)** (v3.7): 
    - 毎日午前8時(JST)の定期実行時に、当日〜3日先までの予約状況をスキャン。
    - 標準投稿枠（08:00, 12:00, 20:00）に空きがある場合、AIが自動で内容を生成し、その枠を埋める。
- **緊急即時生成 (Emergency Failover)** (v3.7): 
    - 投稿実行時に該当枠の予約が0件だった場合、その場でAIが1記事を生成し、即座に投稿を完了させる。
    - 10分ごとの頻繁なCron実行時でも重複生成を防ぐ hourly ロック機構を搭載。
- **管理画面の一本化 (v7.1 New)**:
    - **構造**: 管理画面 (`admin.html`) は、**LPリポジトリ (`af-mini-specialLP`) のみに存在し、管理される**。システム側 (`x-autoup`) のファイルは廃止・削除された。
    - **運用正URL**: `https://airfuture.vercel.app/admin`。

### 2.3 管理画面 UIガバナンス (Admin UI Governance - v7.8 最終形態)
管理画面は「一瞥ですべての戦況を把握する」司令塔であり、デザイン変更時も以下の物理的構造を**聖域として固定**し、絶対に破壊してはならない。

1. **3段垂直構成 (Three-Tier Stack)**:
    - **上段 [h-[28%]]**: 作戦エリア（X予約・履歴）。クイックアクションと配信キューが横に並ぶ。
    - **中段 [grid/h-[14%]]**: 戦略エリア（LPパフォーマンスカード）。5列固定のグリッド形式。
    - **下段 [残り全高]**: 分析エリア。左にKPI縦パネル(13%)、中央に時系列グラフ&回遊フロー、右に実行ログ。
2. **スクロール・ゼロ原則**:
    - ブラウザのデフォルトスクロールバーを発生させない。常に `h-screen` 内に収めること。
    - 各セクション内の溢れは個別の `overflow-y-auto`（スクロール隠し）で処理する。
3. **ID・データ紐付けの固定**:
    - `kpi-clicks`, `kpi-cv`, `kpi-revenue`, `kpi-cvr` などのID名は、バックエンドからの流し込みと直結しているため、名称変更・削除を厳禁する。
4. **情報の「高効率圧縮」**:
    - デザインを美しくする際も、文字サイズを大きくして情報の密度を下げる行為（見切れの発生）は禁止。
5. **サイバープレミアム・デザイン (v7.8)**:
    - **背景**: スレートブルーの宇宙背景にメッシュグラデーションを融合。
    - **質感**: 強力なガラスモフィズム（透過ガラス）と、ネオン発光によるアクセント。
    - **テーマ分け**: 作戦系（上段）は **インディゴ・ブルー**、分析系（下段）は **エメラルド・グリーン** で視覚的に分離。
    - **日次PV水位マトリクス**: 直近7日間のトラフィックを「日次」で集計し、エリアチャートで可視化。

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

## 4. システム構成定義 (System Architecture)

### 4.1 プロジェクト・ドメイン・関係性

| ドメイン (Domain) | プロジェクト名 | 役割 | 主要パス |
| :--- | :--- | :--- | :--- |
| **airfuture.vercel.app** | **x-autoup** | **バックエンド業務 (Backend & Gateway)**<br>システムの心臓部。CV計測、データ蓄積、Xへの自動投稿、購入ページへのゲートウェイ。 | `/apply`: 計測ゲートウェイ<br>`/api/*`: 投稿エンジン・ログAPI |
| **v0-air-future-mini-design.vercel.app** | **af-mini-specialLP** | **フロントエンド業務 (Frontend UI)**<br>ユーザーへの「訴求の顔」。メインおよび専門領域別のLPを提供。 | `/`: メインLP (ブランド世界観・4種の利用シーン) |

### 4.2 専門LP群 (集約特化型)
これらは `af-mini-specialLP` プロジェクト内で構築され、`airfuture.vercel.app` 経由で提供されます。

| 専門ターゲット | パス | URL (運用用) | テーマカラー | 訴求内容のポイント |
| :--- | :--- | :--- | :--- | :--- |
| 花粉症専門 | `/hayfever` | [https://airfuture.vercel.app/hayfever](https://airfuture.vercel.app/hayfever) | 🟡 イエロー系 | 花粉の不活化、薬に頼らない対策 |
| 歯科医院専門 | `/dental` | [https://airfuture.vercel.app/dental](https://airfuture.vercel.app/dental) | 🔵 水色系 | 院内感染防止、技工室のレジン臭対策 |
| ペットオーナー | `/pet` | [https://airfuture.vercel.app/pet](https://airfuture.vercel.app/pet) | 🟢 グリーン系 | ペット臭の元からの分解、除菌・消臭 |
| 3Dプリンター | `/3dprinter` | [https://airfuture.vercel.app/3dprinter](https://airfuture.vercel.app/3dprinter) | ⚫ ブラック系 | 造形中の有害ガス(VOC)除去 |
| **計測用** | `/apply` | [https://airfuture.vercel.app/apply](https://airfuture.vercel.app/apply) | ⚪ 白 (計測経由) | 各LPの「購入する」ボタンクリック先 |
| **admin (管理)** | `/admin` | [https://airfuture.vercel.app/admin](https://airfuture.vercel.app/admin) | - | 統合管理ダッシュボード |

### 4.3 誘導および流入設計
- **誘導入口用URL**: `https://airfuture.vercel.app` (Xのプロフに設置)
- **設計コンセプト**: ここを踏むと計測が始まり、瞬間的にメインLPに繋がる設計。

## 5. インフラ構成 (Infrastructure)

### 5.1 配信スケジュール (Cron Architecture)
- **Primary**: `cron-job.org` (外部サービス) による毎時実行。Vercelの無料枠制限を回避。
- **Secondary**: Vercel Cron (Daily) によるバックアップ実行。

### 5.2 技術スタック
- **Hosting**: Vercel (Hobby)
- **Database**: Google Sheets (Custom Logic via Google Sheet API)
- **Tracking**:
    - **Traffic Categorization**: `is_bot` (Crawler) / `is_dev` (Admin) / `Human` (Users)
    - **Noise Exclusion**: Bot/Dev アクセスを統計から除外。
    - **ID Normalization**: `mini_lp` と `mini_main` の自動名寄せ集計。
