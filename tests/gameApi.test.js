// 🎮 ゲームAPI統合テスト
const request = require('supertest');
const express = require('express');
const { calculateScore } = require('../utils/gameUtils');

// テスト用のExpressアプリを作成（ゲームAPIのシミュレーション）
function createGameTestApp() {
  const app = express();
  app.use(express.json());

  // ゲーム関連のユーティリティをインポート
  const { calculateDistance, calculateScore } = require('../utils/gameUtils');

  // 距離計算APIエンドポイント
  app.post('/api/calculate-distance', (req, res) => {
    try {
      const { startLat, startLng, endLat, endLng } = req.body;

      // バリデーション
      if (!startLat || !startLng || !endLat || !endLng) {
        return res.status(400).json({
          success: false,
          error: '座標が不足しています'
        });
      }

      const distance = calculateDistance(startLat, startLng, endLat, endLng);

      res.json({
        success: true,
        data: {
          distance: Math.round(distance),
          startPoint: { lat: startLat, lng: startLng },
          endPoint: { lat: endLat, lng: endLng }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'サーバーエラーが発生しました'
      });
    }
  });

  // スコア計算APIエンドポイント
  app.post('/api/calculate-score', (req, res) => {
    try {
      const { finalDistance, initialDistance, hintUsed = false } = req.body;

      // バリデーション
      if (finalDistance === undefined || initialDistance === undefined) {
        return res.status(400).json({
          success: false,
          error: '距離パラメータが不足しています'
        });
      }

      const score = calculateScore(finalDistance, initialDistance, hintUsed);

      res.json({
        success: true,
        data: {
          score: score,
          finalDistance: finalDistance,
          initialDistance: initialDistance,
          hintUsed: hintUsed,
          accuracy: Math.round((1 - finalDistance / initialDistance) * 100)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'スコア計算エラーが発生しました'
      });
    }
  });

  return app;
}

describe('ゲームAPI統合テスト', () => {
  let app;

  beforeAll(() => {
    app = createGameTestApp();
  });

  describe('POST /api/calculate-distance', () => {
    test('有効な座標で距離計算', async () => {
      const requestData = {
        startLat: 35.6762,  // 東京駅
        startLng: 139.6503,
        endLat: 35.6896,    // 新宿駅
        endLng: 139.7006
      };

      const response = await request(app)
        .post('/api/calculate-distance')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.distance).toBeGreaterThan(4000); // 約4.7km
      expect(response.body.data.distance).toBeLessThan(6000);
      expect(response.body.data.startPoint).toEqual({
        lat: requestData.startLat,
        lng: requestData.startLng
      });
    });

    test('座標不足でエラーレスポンス', async () => {
      const requestData = {
        startLat: 35.6762,
        startLng: 139.6503
        // endLat, endLng が不足
      };

      const response = await request(app)
        .post('/api/calculate-distance')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('座標が不足しています');
    });
  });

  describe('POST /api/calculate-score', () => {
    test('完璧な精度でのスコア計算', async () => {
      const requestData = {
        finalDistance: 0,
        initialDistance: 1000,
        hintUsed: false
      };

      const response = await request(app)
        .post('/api/calculate-score')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.score).toBe(5000); // 最高スコア
      expect(response.body.data.accuracy).toBe(100); // 100%精度
      expect(response.body.data.hintUsed).toBe(false);
    });

    test('ヒント使用時のスコア計算', async () => {
      const requestData = {
        finalDistance: 200,
        initialDistance: 1000,
        hintUsed: true
      };

      const response = await request(app)
        .post('/api/calculate-score')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hintUsed).toBe(true);
      expect(response.body.data.accuracy).toBe(80); // 80%精度

      // ヒント使用時はスコアが低くなる
      const normalScore = calculateScore(200, 1000, false);
      expect(response.body.data.score).toBeLessThan(normalScore);
    });

    test('パラメータ不足でエラーレスポンス', async () => {
      const requestData = {
        finalDistance: 100
        // initialDistance が不足
      };

      const response = await request(app)
        .post('/api/calculate-score')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('距離パラメータが不足しています');
    });
  });

});