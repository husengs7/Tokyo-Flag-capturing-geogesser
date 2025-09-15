// 🛠️ テスト環境のセットアップ
// このファイルでテスト用の設定を行います

const mongoose = require('mongoose');

// テスト用データベース設定
const MONGODB_TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/tokyo-geoguesser-test';

// テスト前の共通セットアップ
beforeAll(async () => {
  // テスト用データベースに接続
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_TEST_URI);
  }
});

// 各テスト後のクリーンアップ
afterEach(async () => {
  // テストデータをクリーンアップ
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// テスト完了後の後処理
afterAll(async () => {
  // データベース接続を閉じる
  await mongoose.connection.close();
});

module.exports = {
  MONGODB_TEST_URI
};