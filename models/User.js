// ユーザーモデル定義
const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose'); // 認証機能を提供

// ユーザースキーマ定義
const userSchema = new mongoose.Schema({
    // ソロモード統計
    soloStats: {
        totalScore: {
            type: Number,
            default: 0
        },
        playCount: {
            type: Number,
            default: 0
        },
        bestScore: {
            type: Number,
            default: 0
        }
    },
    // マルチモード統計
    multiStats: {
        totalScore: {
            type: Number,
            default: 0
        },
        playCount: {
            type: Number,
            default: 0
        },
        bestScore: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true        // createdAt、updatedAtを自動追加
});

// Passportのローカル認証機能を追加（passwordフィールドやメソッドを自動生成）
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);