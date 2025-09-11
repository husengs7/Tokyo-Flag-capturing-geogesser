// MongoDB接続設定
const mongoose = require('mongoose');

// データベース接続関数
const connectDB = async () => {
    try {
        // 環境変数からMongoDB URIを取得、なければローカルのデフォルト値を使用
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tokyo-flag-geogesser';
        
        // MongoDBに接続
        const conn = await mongoose.connect(mongoURI);

        // 接続成功時のログ出力
        console.log(`MongoDB接続成功: ${conn.connection.host}`);
    } catch (error) {
        // 接続失敗時のエラーハンドリング
        console.error('MongoDB接続エラー:', error);
        process.exit(1); // アプリケーションを終了
    }
};

module.exports = connectDB;