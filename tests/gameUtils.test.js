// 🎯 ゲームユーティリティ関数のテスト
const { calculateDistance, calculateScore, validateCoordinates } = require('../utils/gameUtils');

describe('ゲームユーティリティ関数', () => {

  describe('calculateDistance', () => {
    test('東京駅から新宿駅までの距離を計算', () => {
      // 東京駅の座標
      const tokyoLat = 35.6812;
      const tokyoLng = 139.7671;

      // 新宿駅の座標
      const shinjukuLat = 35.6896;
      const shinjukuLng = 139.7006;

      const distance = calculateDistance(tokyoLat, tokyoLng, shinjukuLat, shinjukuLng);

      // 約6.5km程度のはず
      expect(distance).toBeGreaterThan(6000);
      expect(distance).toBeLessThan(8000);
    });

    test('同じ地点の距離は0', () => {
      const lat = 35.6762;
      const lng = 139.6503;

      const distance = calculateDistance(lat, lng, lat, lng);
      expect(distance).toBe(0);
    });
  });

  describe('validateCoordinates', () => {
    test('東京の正常な座標', () => {
      expect(validateCoordinates(35.6762, 139.6503)).toBe(true);
    });

    test('有効な境界値座標', () => {
      expect(validateCoordinates(90, 180)).toBe(true);   // 北極、国際日付変更線
      expect(validateCoordinates(-90, -180)).toBe(true); // 南極、国際日付変更線
    });

    test('範囲外の座標は無効', () => {
      expect(validateCoordinates(91, 0)).toBeFalsy();   // 緯度が範囲外
      expect(validateCoordinates(0, 181)).toBeFalsy();  // 経度が範囲外
    });

    test('null や undefined は無効', () => {
      expect(validateCoordinates(null, 139.6503)).toBeFalsy();
      expect(validateCoordinates(35.6762, undefined)).toBeFalsy();
    });
  });

  describe('calculateScore', () => {
    test('完璧な精度でヒント未使用', () => {
      const score = calculateScore(0, 1000, false);
      expect(score).toBe(5000); // 実装では最高スコア5000
    });

    test('ヒント使用時はスコア減少', () => {
      const scoreWithoutHint = calculateScore(100, 1000, false);
      const scoreWithHint = calculateScore(100, 1000, true);

      // ヒント使用時は 1.2 で割る（約0.83倍）
      expect(scoreWithHint).toBeLessThan(scoreWithoutHint);
      expect(scoreWithHint).toBeCloseTo(scoreWithoutHint / 1.2, 0);
    });

    test('距離が遠いほどスコアが低い', () => {
      const nearScore = calculateScore(100, 1000, false);
      const farScore = calculateScore(500, 1000, false);

      expect(nearScore).toBeGreaterThan(farScore);
    });
  });

});