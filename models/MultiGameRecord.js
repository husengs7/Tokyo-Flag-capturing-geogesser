// マルチプレイゲーム履歴モデル（3ゲーム分の記録をまとめて管理）
const mongoose = require('mongoose');

// マルチゲーム記録のメインスキーマ
const multiGameRecordSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    roomKey: {
        type: String,
        required: true // 参照用（ルーム削除後も履歴を保持）
    },
    gameMode: {
        type: String,
        enum: ['multi'],
        default: 'multi' // 将来的に他のマルチモード追加の可能性
    },

    // 3ゲーム分のGameRecord参照
    gameRecords: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GameRecord',
        required: true
    }],

    // 集計データ
    totalScore: {
        type: Number,
        required: true,
        default: 0 // 3ゲームの合計スコア
    },
    averageScore: {
        type: Number,
        default: 0 // 平均スコア（完了ゲーム数で割る）
    },
    averageDistance: {
        type: Number,
        default: 0 // 平均距離（メートル）
    },

    // 対戦情報
    finalRanking: {
        type: Number,
        min: 1,
        max: 4 // ルーム内での最終順位（1位-4位）
    },
    totalPlayers: {
        type: Number,
        min: 2,
        max: 4 // そのゲームの総参加人数
    },
    opponents: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: String,
        finalScore: Number // 対戦相手の最終スコア
    }],

    // 完了状態
    isCompleted: {
        type: Boolean,
        default: false // 3ゲーム全て完了したかどうか
    },
    completedAt: {
        type: Date,
        default: null // 3ゲーム完了時刻
    },

    // メタデータ
    createdAt: {
        type: Date,
        default: Date.now // 最初のゲーム開始時刻
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 更新日時の自動更新
multiGameRecordSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// GameRecordを追加するメソッド
multiGameRecordSchema.methods.addGameRecord = function(gameRecordId) {
    // 既に3ゲーム完了している場合はエラー
    if (this.gameRecords.length >= 3) {
        throw new Error('既に3ゲーム完了しています');
    }

    // GameRecord IDを追加
    this.gameRecords.push(gameRecordId);

    // 3ゲーム完了チェック
    if (this.gameRecords.length === 3) {
        this.isCompleted = true;
        this.completedAt = new Date();
    }

    return this.save();
};

// 統計を再計算するメソッド（GameRecord参照から）
multiGameRecordSchema.methods.calculateStats = async function() {
    // GameRecordを取得
    await this.populate('gameRecords');

    if (this.gameRecords.length === 0) {
        return;
    }

    // 合計スコア計算
    this.totalScore = this.gameRecords.reduce((sum, game) => sum + game.score, 0);

    // 平均値計算
    const completedGames = this.gameRecords.length;
    this.averageScore = this.totalScore / completedGames;
    this.averageDistance = this.gameRecords.reduce((sum, game) => sum + game.finalDistance, 0) / completedGames;

    return this.save();
};

// 最終ランキング設定メソッド
multiGameRecordSchema.methods.setFinalRanking = function(ranking, totalPlayers, opponents) {
    this.finalRanking = ranking;
    this.totalPlayers = totalPlayers;
    this.opponents = opponents;

    return this.save();
};

// 統計情報取得メソッド
multiGameRecordSchema.methods.getStats = async function() {
    // GameRecordを取得（まだpopulateされていない場合）
    if (!this.populated('gameRecords')) {
        await this.populate('gameRecords');
    }

    return {
        totalGames: this.gameRecords.length,
        totalScore: this.totalScore,
        averageScore: this.averageScore,
        averageDistance: this.averageDistance,
        bestGameScore: this.gameRecords.length > 0 ? Math.max(...this.gameRecords.map(g => g.score)) : 0,
        worstGameScore: this.gameRecords.length > 0 ? Math.min(...this.gameRecords.map(g => g.score)) : 0,
        isCompleted: this.isCompleted,
        finalRanking: this.finalRanking,
        gameRecords: this.gameRecords // 詳細情報も含める
    };
};

// データベースインデックス設定
multiGameRecordSchema.index({ userId: 1, createdAt: -1 }); // ユーザー別履歴取得用
multiGameRecordSchema.index({ roomId: 1 }); // ルーム別検索用
multiGameRecordSchema.index({ roomKey: 1 }); // ルームキー別検索用
multiGameRecordSchema.index({ isCompleted: 1, completedAt: -1 }); // 完了済み記録の検索用
multiGameRecordSchema.index({ finalRanking: 1, totalPlayers: 1 }); // ランキング統計用

module.exports = mongoose.model('MultiGameRecord', multiGameRecordSchema);