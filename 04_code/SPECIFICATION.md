# AirFuture X-Operator System Specification v6.2 (Self-Sustaining Max)

## 1. 目的 (Core Mission)
X（Twitter）のアルゴリズムにおける「人間っぽさスコア（Human-likeness Score）」を最大化し、スパム判定によるシャドウバンを回避しながら、プロフィール経由でのLP流入を継続させること。

## 2. AI 記事生成・運用ルール (AI Generation & Ops Rules)

### 2.1 投稿トーン & 性格 (Persona)
- **名前**: AirFuture-kun (公的には「個人の空気質研究者」として振舞う)
- **性格**: 48世紀の技術知見を持ちつつも、現代では「空気に詳しすぎる少しマニアックな個人」を装う。
- **口調**: 独り言、気づき、発見をベースとした自然な日本語。専門知識と日常（コーヒー、結露、ペット等）を織り交ぜる。
- **絵文字制限**: **1投稿につき最大1つまで**（ボット感を出す過剰な装飾は禁止）。

### 2.2 技術制約 & 運用ルール (Intelligence v6.1)
- **AI エンジン**: **Google Gemini 2.0 Flash** を採用。高速なレスポンスと高い文脈理解力を活用。
- **ガバナンス**: 全ての開発・運用は [GOVERNANCE.md](./GOVERNANCE.md) に準拠。
- **文字数**: **90文字以上 〜 130文字以内**（短文を混ぜて不規則性を出す）。
- **ハッシュタグ**: **完全禁止**（#airfuture も含む。宣伝色を排除し「人間っぽさ」を優先）。
- **スマート空き枠検索 (Smart Slot Finding)**: 
    - 1日2回の自動投稿（朝：07:00-09:00, 昼〜午後：11:00-15:00）。
    - 投稿枠（Slot）の競合チェックを強化し、`slot_id` による完全な二重投稿防止を実装。
    - 投稿枠には大幅なランダムゆらぎ（±60〜120分）を付与し、毎日異なる時間に投稿。
    - API操作の直前に **1〜5秒のランダム待機** を挿入（Vercelタイムアウト制限10秒を考慮しつつ、機械的な定時実行を回避）。
- **人間っぽさスコア向上戦略 (Human-likeness Strategy)**:
    - **完全独自性担保 (Uniqueness Guardian)**: 過去の全投稿の前方10文字をチェックし、1文字でも一致すれば再生成（最大3回リトライ）。
    - **トレンド連動 (Live Trends Sync)**: 最新ニュース（Google News RSS）を記事生成時にリアルタイムで注入し、情報の鮮度と信頼性を向上。
    - **反プレースホルダー・バリデーション**: `[URL]` や `[YourProfileURL]` といった仮文字列、および `[` `]` 記号を含む生成をシステムレベルで却下。
    - **自動洗浄 (Final Sanitization)**: 投稿直前に正規表現を通し、仮にプレースホルダーが混入しても物理的に除去し、自然な文章に整形。
    - **トピックの動的回転 (Dynamic Topic Rotation)**: 生成のたびに10種類以上のトピック候補（3Dプリンター、ペット、睡眠、仕事、テクノロジー等）からランダムに視点を選択。
    - **URL/CTA比率**: 誘導文（プロフィールへ、等）を**全投稿の50%以下**に制限。残る 50% は純粋な雑談・気づきとする。
    - **文体の不規則性**: AIに対し、フック（冒頭）の形式（質問、嘆嘆、静かな気づき等）をランダム化するように指示。
- **緊急即時生成 (Emergency Failover)**: 
    - 投稿実行時に該当枠（08時、12時台）の予約が0件だった場合、その場でAIが1記事を生成し、即座に投稿を完了させる。
- **自律的在庫補充 (Auto-Replenish)**:
    - 予約在庫が6件（約2日分）を下回った場合、定期実行（Cron）時にAIが自動的に新規記事を生成し、空き枠を埋める。
    - 生成時は常に「完全独自性担保」のフィルターを通し、マンネリ化を防止。
- **管理画面の一本化**:
    - **UI構造**: `af-mini-specialLP` の管理画面から集中制御。
    - **入力仕様**: 「生成記事数(Articles)」を指定し、自動で空き枠を埋める。
    - **運用正URL**: `https://airfuture.vercel.app/admin`。
- **環境変数ガバナンス**: 
    - セキュリティ強化のため、GitHub への環境変数流出を完全に遮断。
    - ローカル開発環境は `vercel link` により `x-autoup` プロジェクトと直接同期し、`.env.local` にて管理。

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
5. **サイバープレミアム・デザイン**:
    - **背景**: スレートブルーの宇宙背景にメッシュグラデーションを融合。
    - **質感**: 強力なガラスモフィズム（透過ガラス）と、ネオン発光によるアクセント。
    - **テーマ分け**: 作戦系（上段）は **インディゴ・ブルー**、分析系（下段）は **エメラルド・グリーン** で視覚的に分離。
    - **日次PV水位マトリクス**: 直近7日間のトラフィックを「日次」で集計し、エリアチャートで可視化。

### 2.4 ステータス管理仕様 (Status Management)
スプレッドシートの `status` 列により、各記事の挙動を制御する。
- **`scheduled`**: 配信予約中（正常な投稿対象）。
- **`posted`**: 配信完了。
- **`draft_ai` / `draft`**: 下書き状態。自動投稿の対象外。
- **`cancel` / `stop`**: 配信停止。プログラムは無視し、枠が空いている場合は「緊急生成」の対象となる。
- **`deleted`**: 削除。管理画面のリストからも非表示となる。
- **`retry`**: 配信失敗後の再試行待ち。

### 2.5 花粉・季節インテリジェンス (v4.4)
- **PollenService**: 毎朝、日本の気象予報サイト (Tenki.jp等) から最新の花粉飛散レベルを取得する。
- **季節自動移行**: `2月15日` を境に、内部的なターゲット季節を「Winter」から「Spring (Pollen Season)」へ自動で切り替える。
- **動的プロンプト**: 取得した花粉レベル（非常に多い/多い/少ない等）をAIに伝え、冬のフレーズを禁止した上で、今の状況に最適な共感フレーズを生成させる。

### 2.6 生成・ブランディングルール
- **生成ルール**: `.agent/workflows/branding_generation_rules.md` に準拠。
- **マスター素材**: `af-mini-specialLP/dist/favicon.png` を正規製品モデルの唯一のリファレンスとする。
- **既存素材優先**: `/public/images` 内の既存アセット（寝室、車内等）を背景素材として再利用し、世界観を統一する。

### 2.7 ガバナンス & 保守ルール (Governance)
- **構成の固定**: 本リポジトリは Vercel の Root Directory 設定に基づき、**`04_code/`** を開発・実行の正会員とする。
- **配置制限**: 新規ファイルは必ず `04_code/` 内に配置し、ルートディレクトリを汚染しないこと。
- **ルーティング防衛**: `vercel.json` の書き換え時は、APIエンドポイントの拡張子（.js）をリライト先から除去するルールを厳守する。
- **変更履歴の強制**: システム構成に関わる変更は必ず `CHANGELOG.md` に記録し、`GOVERNANCE.md` に準拠すること。

## 3. プロジェクト予算・体制 (Budget & Framework)
- **初期構築費用**: ¥2,100,000 (税別)
    - 開発・システム構築: ¥1,500,000
    - デザイン & UX制作: ¥600,000 (*2026/02/05 追加)
- **運用保守**: 月次メンテナンス・X運用を含む。

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
