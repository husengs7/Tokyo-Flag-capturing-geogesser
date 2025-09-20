// マルチプレイルーム管理モデル
const mongoose = require('mongoose');

// プレイヤー情報のスキーマ
const playerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    username: {
        type: String,
        required: true
    },
    isHost: {
        type: Boolean,
        default: false
    },
    isReady: {
        type: Boolean,
        default: false // ゲーム開始準備完了状態
    },
    totalScore: {
        type: Number,
        default: 0 // 3ゲーム通しての合計スコア
    },
    gameScores: {
        type: [Number],
        default: [] // 各ゲーム（最大3つ）のスコア
    },
    currentPosition: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        timestamp: { type: Date, default: Date.now }
    },
    hasGuessed: {
        type: Boolean,
        default: false // 現在のラウンドで推測済みかどうか
    },
    respawnCount: {
        type: Number,
        default: 0 // 現在のラウンドでのリスポーン使用回数
    },
    socketId: {
        type: String,
        default: null // WebSocket接続ID（リアルタイム通信用）
    }
}, { _id: false });

// ゲーム状態のスキーマ
const gameStateSchema = new mongoose.Schema({
    currentRound: {
        type: Number,
        default: 0 // 0: 待機中, 1-3: ゲーム進行中
    },
    roundStartTime: {
        type: Date,
        default: null // ラウンド開始時刻
    },
    targetLocation: {
        lat: { type: Number, required: true }, // フラッグの位置
        lng: { type: Number, required: true }
    },
    playerStartLocation: {
        lat: { type: Number, required: true }, // プレイヤーのスタート位置
        lng: { type: Number, required: true }
    },
    initialDistance: {
        type: Number,
        required: true // スタート地点からフラッグまでの初期距離
    },
    allPlayersGuessed: {
        type: Boolean,
        default: false // 全プレイヤーが推測完了したかどうか
    },
    rankingDisplayUntil: {
        type: Date,
        default: null // ランキング表示終了時刻（5秒間表示）
    }
}, { _id: false });

// ルームのメインスキーマ
const roomSchema = new mongoose.Schema({
    roomKey: {
        type: String,
        unique: true,
        length: 6 // 6桁の数字（プレイヤーが入力するルーム識別子）
    },
    hostId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true // ルーム作成者
    },
    players: {
        type: [playerSchema],
        default: [],
        validate: {
            validator: function (players) {
                return players.length <= 4;
            },
            message: 'ルームの最大参加者数は4人です'
        }
    },
    status: {
        type: String,
        enum: ['waiting', 'playing', 'ranking', 'finished'],
        default: 'waiting'
        // waiting: プレイヤー募集中
        // playing: ゲーム進行中
        // ranking: ランキング表示中（5秒間）
        // finished: 3ゲーム完了
    },
    gameState: gameStateSchema,
    settings: {
        maxPlayers: {
            type: Number,
            default: 4,
            min: 2,
            max: 4 // 最大4人まで
        },
        roundCount: {
            type: Number,
            default: 3,
            min: 1,
            max: 5 // 基本は3ラウンド、将来的に変更可能
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// ルームキー自動生成（保存前に実行）
roomSchema.pre('save', async function (next) {
    if (!this.roomKey) {
        let roomKey;
        let existingRoom;

        // 重複しない6桁の数字を生成
        do {
            roomKey = Math.floor(100000 + Math.random() * 900000).toString();
            existingRoom = await mongoose.model('Room').findOne({ roomKey });
        } while (existingRoom);

        this.roomKey = roomKey;
    }

    // 更新日時を自動更新
    this.updatedAt = new Date();
    next();
});

// プレイヤーをルームに追加
roomSchema.methods.addPlayer = function (userId, username, isHost = false) {
    // 既に参加しているかチェック
    const existingPlayer = this.players.find(p => p.userId.toString() === userId.toString());
    if (existingPlayer) {
        throw new Error('既にこのルームに参加しています');
    }

    // 最大人数チェック
    if (this.players.length >= this.settings.maxPlayers) {
        throw new Error('ルームが満員です');
    }

    // プレイヤー追加
    this.players.push({
        userId,
        username,
        isHost,
        isReady: isHost // ホストは自動的にready状態
    });

    return this.save();
};

// プレイヤーをルームから削除
roomSchema.methods.removePlayer = function (userId) {
    const playerIndex = this.players.findIndex(p => p.userId.toString() === userId.toString());
    if (playerIndex === -1) {
        throw new Error('プレイヤーが見つかりません');
    }

    const removedPlayer = this.players[playerIndex];
    this.players.splice(playerIndex, 1);

    // ホストが抜けた場合、新しいホストを選出
    if (removedPlayer.isHost && this.players.length > 0) {
        this.players[0].isHost = true; // 最初のプレイヤーを新しいホストに
    }

    return this.save();
};

// 全プレイヤーの準備完了チェック
roomSchema.methods.allPlayersReady = function () {
    return this.players.length >= 2 && this.players.every(player => player.isReady);
};

// 全プレイヤーの推測完了チェック
roomSchema.methods.allPlayersGuessed = function () {
    return this.players.every(player => player.hasGuessed);
};

// 現在のランキングを取得（合計スコア順）
roomSchema.methods.getCurrentRanking = function () {
    return [...this.players]
        .sort((a, b) => b.totalScore - a.totalScore)
        .map((player, index) => ({
            rank: index + 1,
            userId: player.userId,
            username: player.username,
            totalScore: player.totalScore,
            gameScores: player.gameScores
        }));
};

// 次のラウンドに進む処理
roomSchema.methods.nextRound = function () {
    // 全プレイヤーの推測状態をリセット
    this.players.forEach(player => {
        player.hasGuessed = false;
        player.respawnCount = 0; // リスポーン回数もリセット
    });

    this.gameState.currentRound++;
    this.gameState.allPlayersGuessed = false;
    this.gameState.rankingDisplayUntil = null;

    // 3ラウンド終了後はゲーム完了状態に
    if (this.gameState.currentRound > this.settings.roundCount) {
        this.status = 'finished';
    }

    return this.save();
};

// データベースインデックス設定（検索パフォーマンス向上）
// roomKey は unique: true で既にインデックス設定済み
roomSchema.index({ hostId: 1 }); // ホストIDでの検索
roomSchema.index({ createdAt: -1 }); // 作成日時でのソート
roomSchema.index({ 'players.userId': 1 }); // プレイヤーIDでの検索

module.exports = mongoose.model('Room', roomSchema);