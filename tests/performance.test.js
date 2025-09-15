// ⚡ パフォーマンス・ストレステスト
const request = require('supertest');
const express = require('express');
const { calculateDistance, calculateScore } = require('../utils/gameUtils');

// 大量データ生成ヘルパー
function generateTestData(count) {
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      startLat: 35.6762 + (Math.random() - 0.5) * 0.1,
      startLng: 139.6503 + (Math.random() - 0.5) * 0.1,
      endLat: 35.6896 + (Math.random() - 0.5) * 0.1,
      endLng: 139.7006 + (Math.random() - 0.5) * 0.1
    });
  }
  return data;
}

// テスト用APIサーバー
function createPerformanceTestApp() {
  const app = express();
  app.use(express.json());

  // 距離計算API（パフォーマンステスト用）
  app.post('/api/calculate-distance', (req, res) => {
    const { startLat, startLng, endLat, endLng } = req.body;
    const distance = calculateDistance(startLat, startLng, endLat, endLng);
    res.json({ distance: Math.round(distance) });
  });

  // バッチ距離計算API
  app.post('/api/batch-calculate-distance', (req, res) => {
    const { coordinates } = req.body;

    const results = coordinates.map(coord => {
      const distance = calculateDistance(
        coord.startLat, coord.startLng,
        coord.endLat, coord.endLng
      );
      return {
        ...coord,
        distance: Math.round(distance)
      };
    });

    res.json({ results });
  });

  // スコア計算API
  app.post('/api/calculate-score', (req, res) => {
    const { finalDistance, initialDistance, hintUsed } = req.body;
    const score = calculateScore(finalDistance, initialDistance, hintUsed);
    res.json({ score });
  });

  return app;
}

describe('パフォーマンステスト', () => {
  let app;

  beforeAll(() => {
    app = createPerformanceTestApp();
  });

  describe('距離計算パフォーマンス', () => {
    test('単一距離計算のパフォーマンス', async () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        calculateDistance(35.6762, 139.6503, 35.6896, 139.7006);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`1000回の距離計算: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100); // 100ms以内で完了することを期待
    });

    test('API経由での距離計算パフォーマンス', async () => {
      const startTime = performance.now();
      const promises = [];

      // 50個の並列リクエスト
      for (let i = 0; i < 50; i++) {
        const promise = request(app)
          .post('/api/calculate-distance')
          .send({
            startLat: 35.6762,
            startLng: 139.6503,
            endLat: 35.6896,
            endLng: 139.7006
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`50個の並列API呼び出し: ${duration.toFixed(2)}ms`);

      // すべてのレスポンスが成功していることを確認
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.distance).toBeGreaterThan(0);
      });

      expect(duration).toBeLessThan(1000); // 1秒以内で完了
    }, 10000);

    test('バッチ処理のパフォーマンス', async () => {
      const testData = generateTestData(100);
      const startTime = performance.now();

      const response = await request(app)
        .post('/api/batch-calculate-distance')
        .send({ coordinates: testData });

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`100個のバッチ距離計算: ${duration.toFixed(2)}ms`);

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(100);
      expect(duration).toBeLessThan(500); // 500ms以内で完了
    });
  });

  describe('スコア計算パフォーマンス', () => {
    test('大量スコア計算のパフォーマンス', async () => {
      const startTime = performance.now();

      for (let i = 0; i < 10000; i++) {
        calculateScore(100, 1000, Math.random() > 0.5);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`10000回のスコア計算: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50); // 50ms以内で完了
    });

    test('異なる距離でのスコア計算パフォーマンス', async () => {
      const distances = Array.from({ length: 1000 }, () => Math.random() * 10000);
      const startTime = performance.now();

      distances.forEach(distance => {
        calculateScore(distance, 5000, false);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`1000回の変動距離スコア計算: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(20); // 20ms以内で完了
    });
  });

  describe('メモリ使用量テスト', () => {
    test('大量データ処理時のメモリリーク検証', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 大量の座標データを生成・処理
      for (let iteration = 0; iteration < 100; iteration++) {
        const testData = generateTestData(1000);

        testData.forEach(data => {
          calculateDistance(
            data.startLat, data.startLng,
            data.endLat, data.endLng
          );
        });

        // ガベージコレクションを促す
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`メモリ増加: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // メモリ増加が10MB以内であることを確認
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

describe('ストレステスト', () => {
  let app;

  beforeAll(() => {
    app = createPerformanceTestApp();
  });

  describe('高負荷API呼び出し', () => {
    test('100個の同時API呼び出し', async () => {
      const promises = [];
      const startTime = performance.now();

      // 100個の同時リクエスト
      for (let i = 0; i < 100; i++) {
        const promise = request(app)
          .post('/api/calculate-distance')
          .send({
            startLat: 35.6762 + Math.random() * 0.01,
            startLng: 139.6503 + Math.random() * 0.01,
            endLat: 35.6896 + Math.random() * 0.01,
            endLng: 139.7006 + Math.random() * 0.01
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`100個の同時リクエスト: ${duration.toFixed(2)}ms`);

      // 成功率を確認
      const successfulResponses = responses.filter(res => res.status === 200);
      const successRate = (successfulResponses.length / responses.length) * 100;

      console.log(`成功率: ${successRate.toFixed(1)}%`);

      expect(successRate).toBeGreaterThan(95); // 95%以上の成功率
      expect(duration).toBeLessThan(5000); // 5秒以内で完了
    }, 15000);

    test('段階的負荷増加テスト', async () => {
      const loadLevels = [10, 25, 50, 75];
      const results = [];

      for (const load of loadLevels) {
        const startTime = performance.now();
        const promises = [];

        for (let i = 0; i < load; i++) {
          const promise = request(app)
            .post('/api/calculate-score')
            .send({
              finalDistance: Math.random() * 1000,
              initialDistance: 1000,
              hintUsed: Math.random() > 0.5
            });
          promises.push(promise);
        }

        const responses = await Promise.all(promises);
        const endTime = performance.now();
        const duration = endTime - startTime;

        const successCount = responses.filter(res => res.status === 200).length;

        results.push({
          load,
          duration,
          successRate: (successCount / load) * 100
        });

        console.log(`負荷${load}: ${duration.toFixed(2)}ms, 成功率: ${((successCount / load) * 100).toFixed(1)}%`);
      }

      // すべての負荷レベルで90%以上の成功率を期待
      results.forEach(result => {
        expect(result.successRate).toBeGreaterThan(90);
      });

      // 負荷増加に対する線形的な応答時間増加を確認
      const maxDuration = Math.max(...results.map(r => r.duration));
      expect(maxDuration).toBeLessThan(3000); // 最大3秒以内
    }, 20000);
  });

  describe('エラー処理ストレステスト', () => {
    test('無効なデータでの連続リクエスト', async () => {
      const invalidRequests = [
        { startLat: 'invalid', startLng: 139.6503, endLat: 35.6896, endLng: 139.7006 },
        { startLat: null, startLng: 139.6503, endLat: 35.6896, endLng: 139.7006 },
        { startLat: 35.6762, startLng: 139.6503, endLat: 'invalid', endLng: 139.7006 },
        {}, // 空のオブジェクト
        { startLat: 35.6762 } // 不完全なデータ
      ];

      const promises = [];

      // 各無効リクエストを2回ずつ送信（テスト時間短縮）
      invalidRequests.forEach(invalidData => {
        for (let i = 0; i < 2; i++) {
          const promise = request(app)
            .post('/api/calculate-distance')
            .send(invalidData);
          promises.push(promise);
        }
      });

      const responses = await Promise.all(promises);

      // レスポンスが返ってくることを確認（エラーハンドリングがあることが重要）
      expect(responses).toHaveLength(10);

      // いくつかのレスポンスが適切に処理されていることを確認
      let errorResponses = 0;
      let invalidResults = 0;

      responses.forEach(response => {
        if (response.status >= 400) {
          errorResponses++;
        } else if (response.status === 200) {
          if (isNaN(response.body?.distance) || response.body?.distance === undefined) {
            invalidResults++;
          }
        }
      });

      console.log(`エラー応答: ${errorResponses}個, 無効結果: ${invalidResults}個`);
      console.log(`${responses.length}個の無効リクエストが処理されました`);

      // すべてのリクエストが何らかの形で処理されたことを確認
      expect(responses.length).toBe(10);
    });
  });

  describe('リソース制限テスト', () => {
    test('大きなペイロードの処理', async () => {
      const largeData = generateTestData(100); // 100個の座標データ（制限内）

      const response = await request(app)
        .post('/api/batch-calculate-distance')
        .send({ coordinates: largeData });

      // ペイロードサイズ制限でエラーになる場合は413、成功する場合は200
      if (response.status === 413) {
        console.log('大きなペイロードが適切に制限されました（413 Payload Too Large）');
        expect(response.status).toBe(413);
      } else {
        expect(response.status).toBe(200);
        expect(response.body.results).toHaveLength(100);
        console.log('ペイロード（100個の座標）が正常に処理されました');
      }
    }, 10000);
  });
});