# フロントエンド実装ガイドライン（Claude Code用）

## 🚨 重要事項 - 必読

**このドキュメントを実装前に必ず熟読し、各実装ステップ後に必ず検証作業を実行してください。**

## 📋 実装前の必須事項

### 1. バックエンド実装の完全理解

フロントエンド実装開始前に、以下のファイルを**全て読み込み**、実装詳細を完全に把握してください：

**必須読み込みファイル：**

```markdown
/controllers/multiController.js    ← 14個のAPI実装詳細
/config/socket.js                  ← 32個のSocket.io実装詳細
/services/multiGameService.js      ← ゲームロジック実装
/services/roomService.js           ← ルーム管理ロジック実装
/models/Room.js                    ← データモデル定義
/models/User.js                    ← ユーザーモデル定義
/models/MultiGameRecord.js         ← マルチゲーム記録モデル
/routes/multi.js                   ← ルーティング定義
# バックエンド実装ファイルを直接参照
```

### 2. 実装パターンの厳格遵守

以下の実装パターンを**絶対に**遵守してください：

#### レスポンス形式

```javascript
// 統一レスポンス形式の正しい処理
async function apiCall(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'API Error');
    }

    return data.data; // data.dataを返す（dataではない）
}
```

#### プロパティ名の正確性

```javascript
// ❌ 間違い（仕様書にないプロパティ）
player.score          // 存在しない
room.id              // 存在しない
room.maxPlayers      // 存在しない

// ✅ 正しい（実装にあるプロパティ）
player.totalScore    // 正しい
room._id             // 正しい
room.settings.maxPlayers // 正しい
```

## 🔍 段階的実装・検証プロセス

### Phase 1: Socket.io接続・基本UI実装後

**実装内容：**

- Socket.io接続確立
- 基本的なUI構造
- ルーム作成・参加フォーム

**必須検証項目：**

1. Socket.io認証が正しく動作するか
2. 実装で使用するプロパティ名がバックエンドと完全一致するか
3. エラーハンドリングが適切か

**検証コマンド：**

```bash
# バックエンド実装を再確認
grep -r "successResponse" controllers/multiController.js
grep -r "socket.emit" config/socket.js
```

### Phase 2: ルーム管理機能実装後

**実装内容：**

- ルーム作成API呼び出し
- ルーム参加API呼び出し
- ルーム情報表示

**必須検証項目：**

1. `POST /multi/rooms` の全レスポンスプロパティが正しく処理されているか
2. `POST /multi/rooms/join` の全レスポンスプロパティが正しく処理されているか
3. `GET /multi/rooms/:roomId` の条件付きレスポンス（参加者/非参加者）が適切に処理されているか
4. Socket.ioイベント（room-joined, room-created等）が正しく実装されているか

**検証コマンド：**

```bash
# 実装確認
grep -A 10 "createRoom.*=.*async" controllers/multiController.js
grep -A 10 "joinRoom.*=.*async" controllers/multiController.js
grep -A 5 "room-joined" config/socket.js
```

### Phase 3: ゲーム進行機能実装後

**実装内容：**

- 準備状態管理
- ゲーム開始処理
- 推測提出処理

**必須検証項目：**

1. `PUT /multi/rooms/:roomId/ready` の全レスポンス構造が正しく処理されているか
2. `POST /multi/rooms/:roomId/start` の全レスポンス構造が正しく処理されているか
3. `POST /multi/rooms/:roomId/guess` の全レスポンス構造が正しく処理されているか
4. Socket.ioゲームイベント（game-started, player-guessed等）が正しく実装されているか

**検証コマンド：**

```bash
# ゲーム進行実装確認
grep -A 15 "setPlayerReady.*=.*async" controllers/multiController.js
grep -A 15 "startGame.*=.*async" controllers/multiController.js
grep -A 15 "submitGuess.*=.*async" controllers/multiController.js
```

### Phase 4: リアルタイム位置共有実装後

**実装内容：**

- 位置情報送信
- 他プレイヤー位置表示
- マーカー管理

**必須検証項目：**

1. `update-position` イベントのデータ構造が正しいか
2. `player-position-updated` イベントの受信処理が正しいか
3. 位置データのプロパティ名（lat, lng, timestamp）が正確か

**検証コマンド：**

```bash
# 位置共有実装確認
grep -A 10 "update-position.*async" config/socket.js
grep -A 10 "updatePlayerPosition" services/roomService.js
```

### Phase 5: 完全実装後の最終検証

**必須検証項目：**

1. 全14個のREST APIエンドポイントが正しく実装されているか
2. 全32個のSocket.ioイベントが正しく実装されているか
3. 全データモデルのプロパティ名が正確か
4. エラーハンドリングが全箇所で適切か

## 🚨 実装時の絶対禁止事項

### 1. 存在しないプロパティの使用禁止

以下のプロパティは**絶対に使用しないでください**（実装に存在しません）：

```javascript
// ❌ Player オブジェクトの存在しないプロパティ
player.score         // 正: player.totalScore
player.ready         // 正: player.isReady
player.host          // 正: player.isHost
player.position      // 正: player.currentPosition
player.guessed       // 正: player.hasGuessed
player.id            // 正: player.userId

// ❌ Room オブジェクトの存在しないプロパティ
room.id              // 正: room._id
room.key             // 正: room.roomKey
room.host            // 正: room.hostId
room.maxPlayers      // 正: room.settings.maxPlayers
room.rounds          // 正: room.settings.roundCount

// ❌ GameState オブジェクトの存在しないプロパティ
gameState.round      // 正: gameState.currentRound
gameState.target     // 正: gameState.targetLocation
gameState.playerStart // 正: gameState.playerStartLocation
gameState.distance   // 正: gameState.initialDistance
```

### 2. レスポンス形式の誤解釈禁止

```javascript
// ❌ 間違った処理
const response = await fetch('/multi/rooms');
const rooms = response.data.activeRooms; // activeRoomsは存在しない

// ✅ 正しい処理
const response = await fetch('/multi/rooms');
const data = await response.json();
const rooms = data.data.rooms; // 実装では"rooms"
```

### 3. Socket.ioイベント名の推測禁止

実装にないイベント名を推測で使用することを禁止します。必ず実装コードを確認してください。

## 📝 各実装ステップ後の必須チェックリスト

実装の各段階で、以下のチェックリストを**必ず実行**してください：

### ✅ API実装チェック

- [ ] 全てのfetchリクエストのURL、メソッド、ボディが実装と一致している
- [ ] レスポンスの全プロパティ名が実装と一致している
- [ ] 条件付きレスポンス（getRoomInfo, leaveRoom等）を正しく処理している
- [ ] エラーレスポンスを適切に処理している

### ✅ Socket.ioチェック

- [ ] 全てのemitイベント名が実装と一致している
- [ ] 全てのonイベント名が実装と一致している
- [ ] イベントデータ構造が実装と一致している
- [ ] エラーイベントを適切に処理している

### ✅ データモデルチェック

- [ ] Player, Room, GameState等の全プロパティ名が実装と一致している
- [ ] ネストしたオブジェクト（settings, currentPosition等）を正しく処理している
- [ ] 配列データ（players, gameScores等）を正しく処理している

### ✅ 統合チェック

- [ ] 既存ソロモードとの統合が適切に行われている
- [ ] Google Maps APIの統合が正しく動作している
- [ ] UI/UXが意図通りに動作している

## 🛠️ 実装検証のための具体的コマンド

各実装段階で以下のコマンドを実行し、バックエンド実装と照合してください：

```bash
# 1. API実装確認
grep -n "successResponse.*res.*{" controllers/multiController.js

# 2. Socket.ioイベント確認
grep -n "emit.*(" config/socket.js | head -20
grep -n "on.*(" config/socket.js | head -20

# 3. データモデル確認
grep -n "Schema.*new.*mongoose" models/*.js

# 4. プロパティ名確認
grep -rn "player\." models/Room.js
grep -rn "gameState\." models/Room.js

# 5. 条件付きレスポンス確認
grep -A 5 -B 5 "isParticipant" controllers/multiController.js
grep -A 5 -B 5 "room === null" controllers/multiController.js
```

## ⚠️ 緊急時の対応

実装中に不明な点や矛盾を発見した場合：

1. **即座に実装を停止**
2. **バックエンド実装ファイルを再読み込み**
3. **具体的な実装コードとの差異を特定**
4. **修正後に全体の整合性を再確認**

## 📚 最終確認事項

実装完了時には以下を確認してください：

1. **全14個のREST APIエンドポイント**が正しく実装されている
2. **全32個のSocket.ioイベント**が正しく実装されている
3. **全データモデルのプロパティ**が実装と完全一致している
4. **エラーハンドリング**が全箇所で適切に行われている
5. **レスポンス形式**が統一されている

---

## 📱 フロントエンド実装必須ページ一覧

### 1. 🏠 **マルチプレイメニューページ**

**URL:** `/multi` または `/multiplayer`

**必要な機能:**

- ルーム作成フォーム（最大人数・ラウンド数設定）
- ルーム参加フォーム（6桁コード入力）
- 既存のソロモードUIとの統合

**実装条件:**

- 認証済みユーザーのみアクセス可能
- Socket.io接続確立済み状態で動作
- `POST /multi/rooms` と `POST /multi/rooms/join` APIを使用

### 2. 🎯 **ルーム待機ページ**

**URL:** `/multi/room/:roomKey`

**必要な機能:**

- ルーム情報表示（ルームキー、参加者リスト）
- 準備完了ボタン（ready/not ready切り替え）
- ホスト専用ゲーム開始ボタン
- プレイヤー退出ボタン
- リアルタイムプレイヤー状態更新

**実装条件:**

- 全プレイヤーが準備完了時のみゲーム開始可能
- Socket.ioイベント（`player-ready`, `player-joined`, `player-left`）でリアルタイム同期
- `PUT /multi/rooms/:roomId/ready` と `POST /multi/rooms/:roomId/start` APIを使用

### 3. 🗾 **マルチプレイゲーム画面**

**URL:** `/multi/game/:roomKey`

**必要な機能:**

- Google Maps/StreetView統合
- リアルタイム他プレイヤー位置表示
- 現在ラウンド・総ラウンド表示
- 推測提出ボタン
- ヒント使用ボタン
- プレイヤーリスト・現在スコア表示(任意)

**実装条件:**

- 既存のソロモード地図機能を拡張
- 他プレイヤーの位置をマーカーで表示
- Socket.ioイベント（`update-position`, `player-position-updated`, `player-guess`）を使用
- `POST /multi/rooms/:roomId/guess` APIでスコア送信

### 4. 📊 **ラウンド結果・ランキング画面**

**必要な機能:**

- 各プレイヤーの推測結果表示
- ラウンドスコア・累計スコア表示
- フラッグと各プレイヤー推測位置の地図表示
- 次ラウンドボタン（ホスト専用、最終ラウンドでは最終結果ボタン）

**実装条件:**

- 全プレイヤーの推測完了後に自動表示
- ランキングは累計スコア順
- Socket.ioイベント（`round-ranking`, `next-round-started`）を受信
- `POST /multi/rooms/:roomId/next-round` APIで次ラウンド開始

### 5. 🏆 **最終結果ページ**

**必要な機能:**

- 最終ランキング表示
- 各ラウンドの詳細スコア表示(任意)
- 全ラウンドの推測軌跡表示（地図）(任意)
- 新しいゲームボタン
- ルーム退出ボタン

**実装条件:**

- 3ラウンド完了後に表示
- Socket.ioイベント（`game-completed`）を受信
- `POST /multi/rooms/:roomId/complete` APIでゲーム完了処理

## 🔧 フロントエンド実装における技術要件

### Socket.io接続管理

- 接続状態表示
- 切断時の再接続処理
- 統一されたエラーハンドリング

### レスポンシブ対応

- デスクトップ・タブレット・スマートフォン対応
- 地図操作の最適化

### リアルタイム表示

- プレイヤー参加・退出の即座反映
- 位置情報のスムーズな更新
- ゲーム状態変化のアニメーション

### 既存システム統合

- 認証システムとの連携
- ソロモードとのナビゲーション統合

---

## 🔄 **RESPAWN機能の実装仕様**

### ソロプレイとマルチプレイのRESPAWN管理方法の違い

**⚠️ 重要：** ソロプレイとマルチプレイでRESPAWN機能の管理方法が異なります。

#### 🎮 **ソロプレイの場合**

**状態管理：** フロントエンド（session）+ バックエンド（session）

```javascript
// フロントエンド: game.js
let respawnCount = 0;  // フロントエンドで管理

// RESPAWNボタン押下時
function respawnPlayer() {
    respawnCount++;
    recordRespawnUsage();  // サーバーに記録
}

// API呼び出し
POST /api/game/respawn
Body: { gameId: gameId }

// GUESS送信時に含める
POST /api/game/complete
Body: { ..., respawnCount: respawnCount }
```

**データフロー：**

```markdown
Frontend respawnCount → Session gameSession → GameRecord
```

#### 🎯 **マルチプレイの場合**

**状態管理：** Room（リアルタイム） → GameRecord（永続化）

```javascript
// RESPAWNボタン押下時
POST /multi/rooms/:roomId/respawn
→ Room.players[x].respawnCount++

// GUESS送信時は自動でRoom値を使用
POST /multi/rooms/:roomId/guess
Body: { guessLat, guessLng, hintUsed }
→ GameRecord.respawnCount = room.player.respawnCount
```

**データフロー：**

```markdown
RESPAWN押下 → Room.player.respawnCount++
     ↓
GUESS送信 → GameRecord.respawnCount = Room値
     ↓
次ラウンド → Room.player.respawnCount = 0
```

#### 📊 **実装上の重要な違い**

| 項目 | ソロプレイ | マルチプレイ |
|------|-----------|-------------|
| **状態管理場所** | フロントエンド + Session | Room モデル |
| **API設計** | `/api/game/respawn` | `/multi/rooms/:roomId/respawn` |
| **データ送信** | GUESS時にcountを送信 | Roomから自動取得 |
| **リセット** | 新ゲーム開始時 | ラウンド切り替え時 |
| **セキュリティ** | クライアント改ざん可能 | サーバー側管理のみ |
| **リアルタイム性** | なし | 他プレイヤーに同期可能 |

#### 🔧 **実装時の注意点**

1. **API エンドポイントの使い分け**

   ```javascript
   // ソロプレイ
   POST /api/game/respawn

   // マルチプレイ
   POST /multi/rooms/:roomId/respawn
   ```

2. **データフローの理解**
   - **ソロ**: フロントエンド主導
   - **マルチ**: サーバー（Room）主導

3. **フロントエンド実装での考慮**

   ```javascript
   // ソロプレイ実装例
   if (gameMode === 'solo') {
       await fetch('/api/game/respawn', {
           body: JSON.stringify({ gameId })
       });
       respawnCount++; // フロントエンドで管理
   }

   // マルチプレイ実装例
   if (gameMode === 'multi') {
       await fetch(`/multi/rooms/${roomId}/respawn`);
       // サーバー側で自動管理、フロントエンドでのcount不要
   }
   ```

#### ✅ **検証済み実装パターン**

以下のパターンは既存コードベースとの一貫性が確認済みです：

- **エンドポイント命名**: `/game/hint` → `/game/respawn`
- **プロパティ命名**: `hasGuessed` → `respawnCount`
- **データ型**: `Number` with `default: 0, min: 0`
- **Controller構造**: 既存の簡潔なパターンに準拠

---

**このガイドラインを厳格に遵守することで、バックエンドとの完全な互換性を保証し、統合時のトラブルを回避できます。**

**実装の各段階で必ず検証作業を行い、不明な点があれば即座に実装を停止してバックエンド実装を再確認してください。**
