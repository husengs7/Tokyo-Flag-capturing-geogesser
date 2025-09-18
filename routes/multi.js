// マルチプレイ関連のルーティング（ルーム管理、ゲーム進行、履歴取得）
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const multiController = require('../controllers/multiController');

const router = express.Router();

// 全てのマルチプレイエンドポイントは認証必須
router.use(requireAuth);

// ルーム管理
router.post('/rooms', multiController.createRoom); // ルーム作成
router.post('/rooms/join', multiController.joinRoom); // ルーム参加
router.get('/rooms/:roomId', multiController.getRoomInfo); // ルーム情報取得
router.delete('/rooms/:roomId/leave', multiController.leaveRoom); // ルーム退出

// プレイヤー状態管理
router.put('/rooms/:roomId/ready', multiController.setPlayerReady); // 準備状態更新
router.put('/rooms/:roomId/position', multiController.updatePosition); // 位置情報更新

// ゲーム進行
router.post('/rooms/:roomId/start', multiController.startGame); // ゲーム開始
router.post('/rooms/:roomId/respawn', multiController.recordRespawn); // リスポーン記録
router.post('/rooms/:roomId/guess', multiController.submitGuess); // 推測提出
router.post('/rooms/:roomId/next-round', multiController.nextRound); // 次ラウンド開始
router.post('/rooms/:roomId/complete', multiController.completeGame); // ゲーム完了

// 情報取得
router.get('/rooms/:roomId/ranking', multiController.getCurrentRanking); // 現在のランキング

// 履歴・統計
router.get('/history', multiController.getGameHistory); // マルチゲーム履歴
router.get('/stats', multiController.getGameStats); // マルチゲーム統計

// 管理・開発用
router.get('/rooms', multiController.getActiveRooms); // アクティブルーム一覧

module.exports = router;