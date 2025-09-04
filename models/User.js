// ユーザーモデル定義
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose'); // 認証機能を提供

// ユーザースキーマ定義
const userSchema = new mongoose.Schema({
    username: {
        type: String,       // ユーザー名
        required: true,     // 必須項目
        unique: true,       // 一意制約
        trim: true          // 前後の空白を除去
    },
    bestScore: {
        type: Number,       // 最高スコア
        default: 0          // デフォルト値は0
    }
}, {
    timestamps: true        // createdAt、updatedAtを自動追加
});

// Passportのローカル認証機能を追加（passwordフィールドやメソッドを自動生成）
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);