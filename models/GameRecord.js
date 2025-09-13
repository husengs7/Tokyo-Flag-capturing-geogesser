// ゲーム記録モデル（個人履歴保存用）
const mongoose = require('mongoose');

// ゲーム記録スキーマ定義
const gameRecordSchema = new mongoose.Schema({
    // プレイヤーID（Userモデルへの参照）
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // ゲームモード
    gameMode: {
        type: String,
        enum: ['solo', 'multi'],
        required: true,
        default: 'solo'
    },
    // 目標地点の座標
    targetLocation: {
        lat: { type: Number, required: true },  // 緯度
        lng: { type: Number, required: true },  // 経度
    },
    // プレイヤーの開始地点
    playerStartLocation: {
        lat: { type: Number, required: true },  // 開始時の緯度
        lng: { type: Number, required: true }   // 開始時の経度
    },
    // プレイヤーの最終到達地点
    finalLocation: {
        lat: { type: Number, required: true },  // 最終緯度
        lng: { type: Number, required: true }   // 最終経度
    },
    // ゲームスコア
    score: {
        type: Number,
        required: true,
        min: 0
    },
    // 目標地点からの最終距離（メートル）
    finalDistance: {
        type: Number,
        required: true,
        min: 0
    },
    // ヒント使用フラグ
    hintUsed: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true  // createdAt、updatedAtを自動追加
});

// インデックス設定（クエリ高速化用）
gameRecordSchema.index({ userId: 1 });              // ユーザー別検索用
gameRecordSchema.index({ userId: 1, createdAt: -1 }); // ユーザー別履歴取得用
gameRecordSchema.index({ score: -1 });              // スコア降順ランキング用
gameRecordSchema.index({ createdAt: -1 });          // 最新記録順検索用
gameRecordSchema.index({ gameMode: 1 });            // モード別検索用

module.exports = mongoose.model('GameRecord', gameRecordSchema);