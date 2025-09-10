const express = require('express');
const axios = require('axios');
const { calculateDistance, validateCoordinates } = require('../services/utils');
const GameService = require('../services/gameService');

const router = express.Router();

// Google Maps JavaScript API スクリプト（APIキーをサーバー側で注入）
router.get('/maps-script', (_req, res) => {
    // APIキー確認
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        return res.status(500).send('console.error("Google Maps APIキーが設定されていません");');
    }

    res.type('application/javascript');
    res.send(`
        (function() {
            const script = document.createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=geometry';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        })();
    `);
});

// Street View Panorama 存在確認プロキシ
router.post('/streetview/check', async (req, res) => {
    try {
        const { lat, lng, radius = 1000 } = req.body;

        // 入力値検証
        if (!validateCoordinates(lat, lng)) {
            return res.status(400).json({ error: '無効な座標です' });
        }

        // APIキー確認
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            return res.status(500).json({ error: 'Google Maps APIキーが設定されていません' });
        }

        const response = await axios.get('https://maps.googleapis.com/maps/api/streetview/metadata', {
            params: {
                key: process.env.GOOGLE_MAPS_API_KEY,
                location: `${lat},${lng}`,
                radius: radius,
                source: 'outdoor'  // 屋外のストリートビューのみ
            }
        });

        const data = response.data;

        if (data.status === 'OK') {
            res.json({
                status: 'OK',
                location: {
                    lat: parseFloat(data.location.lat),
                    lng: parseFloat(data.location.lng)
                }
            });
        } else {
            res.json({ status: 'ZERO_RESULTS' });
        }
    } catch (error) {
        console.error('Street View API エラー:', error);
        res.status(500).json({ error: 'Street View API リクエストが失敗しました' });
    }
});

// 直線距離計算プロキシ
router.post('/distance', (req, res) => {
    try {
        const { lat1, lng1, lat2, lng2 } = req.body;

        // 入力値検証
        if (!validateCoordinates(lat1, lng1) || !validateCoordinates(lat2, lng2)) {
            return res.status(400).json({ error: '無効な座標です' });
        }

        const distance = calculateDistance(lat1, lng1, lat2, lng2);
        res.json({ distance: Math.round(distance) });
    } catch (error) {
        console.error('距離計算エラー:', error);
        res.status(500).json({ error: '距離計算が失敗しました' });
    }
});

// ゲームセッション開始
router.post('/game/start', async (req, res) => {
    try {
        const { targetLat, targetLng, playerLat, playerLng } = req.body;

        // 入力値検証
        if (!validateCoordinates(targetLat, targetLng) || !validateCoordinates(playerLat, playerLng)) {
            return res.status(400).json({ error: '無効な座標です' });
        }

        // ゲームセッション作成
        const gameSession = GameService.createGameSession(targetLat, targetLng, playerLat, playerLng);

        // セッションに保存
        req.session.gameSession = gameSession;
        
        res.json({ 
            gameId: gameSession.id,
            initialDistance: gameSession.initialDistance
        });
    } catch (error) {
        console.error('ゲームセッション開始エラー:', error);
        res.status(500).json({ error: 'ゲームセッションの開始に失敗しました' });
    }
});

// ヒント使用記録
router.post('/game/hint', (req, res) => {
    try {
        const { gameId } = req.body;
        let gameSession = req.session.gameSession;
        
        // セッション検証
        if (!GameService.validateGameSession(gameSession, gameId)) {
            return res.status(400).json({ error: '無効なゲームセッションです' });
        }
        
        // ヒント使用を記録
        gameSession = GameService.recordHintUsage(gameSession);
        req.session.gameSession = gameSession;
        
        res.json({ success: true });
    } catch (error) {
        console.error('ヒント記録エラー:', error);
        res.status(500).json({ error: 'ヒントの記録に失敗しました' });
    }
});

// ゲーム完了・スコア計算
router.post('/game/complete', (req, res) => {
    try {
        const { gameId, finalPlayerLat, finalPlayerLng } = req.body;
        let gameSession = req.session.gameSession;
        
        // セッション検証
        if (!GameService.validateGameSession(gameSession, gameId)) {
            return res.status(400).json({ error: '無効なゲームセッションです' });
        }
        
        // 入力値検証
        if (!validateCoordinates(finalPlayerLat, finalPlayerLng)) {
            return res.status(400).json({ error: '無効な座標です' });
        }
        
        // ゲーム完了処理
        const result = GameService.completeGame(gameSession, finalPlayerLat, finalPlayerLng);
        if (!result) {
            return res.status(500).json({ error: 'ゲームの完了処理に失敗しました' });
        }
        
        // セッション更新
        req.session.gameSession = gameSession;
        
        res.json(result);
    } catch (error) {
        console.error('ゲーム完了エラー:', error);
        res.status(500).json({ error: 'ゲームの完了処理に失敗しました' });
    }
});

module.exports = router;