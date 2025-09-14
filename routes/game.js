// ゲーム関連のルーティング（Google Maps API、ゲームセッション管理）
const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const gameController = require('../controllers/gameController');

const router = express.Router();

// Google Maps JavaScript API スクリプト
router.get('/maps-script', gameController.getMapsScript);

// Street View Panorama 存在確認プロキシ
router.post('/streetview/check', gameController.checkStreetView);

// 直線距離計算プロキシ
router.post('/distance', gameController.calculateDistance);

// ゲームセッション開始
router.post('/game/start', gameController.startGame);

// ヒント使用記録
router.post('/game/hint', gameController.recordHint);

// ゲーム完了・スコア計算
router.post('/game/complete', optionalAuth, gameController.completeGame);

module.exports = router;