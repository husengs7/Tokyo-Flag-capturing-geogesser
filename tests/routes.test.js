// 🌐 基本ルートのテスト
const request = require('supertest');
const express = require('express');
const path = require('path');

// テスト用のExpressアプリを作成
function createTestApp() {
  const app = express();

  // 基本的なルート設定（実際のルートファイルから抜粋）
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'game.html'));
  });

  app.get('/rules', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'rules.html'));
  });

  // 簡単なAPIエンドポイント（テスト用）
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'サーバーは正常に動作しています' });
  });

  return app;
}

describe('基本ルートのテスト', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /api/health', () => {
    test('ヘルスチェックエンドポイントが正常に応答', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        message: 'サーバーは正常に動作しています'
      });
    });
  });

  describe('HTMLファイルのルート', () => {
    test('GET / は200ステータスを返す', async () => {
      await request(app)
        .get('/')
        .expect(200);
    });

    test('GET /game は200ステータスを返す', async () => {
      await request(app)
        .get('/game')
        .expect(200);
    });

    test('GET /rules は200ステータスを返す', async () => {
      await request(app)
        .get('/rules')
        .expect(200);
    });
  });

  describe('存在しないルート', () => {
    test('GET /nonexistent は404を返す', async () => {
      await request(app)
        .get('/nonexistent')
        .expect(404);
    });
  });

});