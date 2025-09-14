// ゲーム関連のコントローラー（Google Maps API、距離計算、ゲームセッション管理）
const axios = require('axios');
const { validateCoordinates } = require('../utils/gameUtils');
const { successResponse, errorResponse } = require('../utils/response');
const GameService = require('../services/gameService');
const User = require('../models/User');
const GameRecord = require('../models/GameRecord');

// Google Maps JavaScript API スクリプト（APIキーをサーバー側で注入）
exports.getMapsScript = (req, res) => {
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
};

// Street View Panorama 存在確認プロキシ
exports.checkStreetView = async (req, res) => {
    try {
        const { lat, lng, radius = 1000 } = req.body;

        // 入力値検証
        if (!validateCoordinates(lat, lng)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        // APIキー確認
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            return errorResponse(res, 'Google Maps APIキーが設定されていません', 500);
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
            successResponse(res, {
                status: 'OK',
                location: {
                    lat: parseFloat(data.location.lat),
                    lng: parseFloat(data.location.lng)
                }
            });
        } else {
            successResponse(res, { status: 'ZERO_RESULTS' });
        }
    } catch (error) {
        console.error('Street View API エラー:', error);
        errorResponse(res, 'Street View API リクエストが失敗しました', 500);
    }
};

// 直線距離計算プロキシ
exports.calculateDistance = (req, res) => {
    try {
        const { lat1, lng1, lat2, lng2 } = req.body;

        // 入力値検証
        if (!validateCoordinates(lat1, lng1) || !validateCoordinates(lat2, lng2)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        const { calculateDistance } = require('../utils/gameUtils');
        const distance = calculateDistance(lat1, lng1, lat2, lng2);
        successResponse(res, { distance: Math.round(distance) });
    } catch (error) {
        console.error('距離計算エラー:', error);
        errorResponse(res, '距離計算が失敗しました', 500);
    }
};

// ゲームセッション開始
exports.startGame = async (req, res) => {
    try {
        const { targetLat, targetLng, playerLat, playerLng } = req.body;

        // 入力値検証
        if (!validateCoordinates(targetLat, targetLng) || !validateCoordinates(playerLat, playerLng)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        // ゲームセッション作成
        const gameSession = GameService.createGameSession(targetLat, targetLng, playerLat, playerLng);

        // セッションに保存
        req.session.gameSession = gameSession;

        successResponse(res, {
            gameId: gameSession.id,
            initialDistance: gameSession.initialDistance
        });
    } catch (error) {
        console.error('ゲームセッション開始エラー:', error);
        errorResponse(res, 'ゲームセッションの開始に失敗しました', 500);
    }
};

// ヒント使用記録
exports.recordHint = (req, res) => {
    try {
        const { gameId } = req.body;
        let gameSession = req.session.gameSession;

        // セッション検証
        if (!GameService.validateGameSession(gameSession, gameId)) {
            return errorResponse(res, '無効なゲームセッションです', 400);
        }

        // ヒント使用を記録
        gameSession = GameService.recordHintUsage(gameSession);
        req.session.gameSession = gameSession;

        successResponse(res, { success: true });
    } catch (error) {
        console.error('ヒント記録エラー:', error);
        errorResponse(res, 'ヒントの記録に失敗しました', 500);
    }
};

// ゲーム完了・スコア計算
exports.completeGame = async (req, res) => {
    try {
        const { gameId, finalPlayerLat, finalPlayerLng } = req.body;
        let gameSession = req.session.gameSession;

        // セッション検証
        if (!GameService.validateGameSession(gameSession, gameId)) {
            return errorResponse(res, '無効なゲームセッションです', 400);
        }

        // 入力値検証
        if (!validateCoordinates(finalPlayerLat, finalPlayerLng)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        // ゲーム完了処理
        const result = GameService.completeGame(gameSession, finalPlayerLat, finalPlayerLng);
        if (!result) {
            return errorResponse(res, 'ゲームの完了処理に失敗しました', 500);
        }

        // ログインユーザーの場合、スコア更新とゲーム履歴保存
        if (req.isAuthenticated() && req.user) {
            try {
                // ユーザー統計更新（ソロモード）
                const currentSoloStats = req.user.soloStats || { totalScore: 0, playCount: 0, bestScore: 0 };
                const newSoloTotalScore = currentSoloStats.totalScore + result.score;
                const newSoloPlayCount = currentSoloStats.playCount + 1;
                const newSoloBestScore = Math.max(currentSoloStats.bestScore, result.score);

                // ベストスコア更新判定
                if (result.score > currentSoloStats.bestScore) {
                    result.isNewBestScore = true;
                }

                await User.findByIdAndUpdate(req.user._id, {
                    soloStats: {
                        totalScore: newSoloTotalScore,
                        playCount: newSoloPlayCount,
                        bestScore: newSoloBestScore
                    }
                });

                // ゲーム履歴を保存
                const gameRecord = new GameRecord({
                    userId: req.user._id,
                    gameMode: 'solo', // 現在はソロモードのみ
                    score: result.score,
                    finalDistance: result.distance,
                    hintUsed: gameSession.hintUsed || false,
                    targetLocation: {
                        lat: gameSession.targetLocation?.lat || 0,
                        lng: gameSession.targetLocation?.lng || 0
                    },
                    playerStartLocation: {
                        lat: gameSession.initialPlayerLocation?.lat || 0,
                        lng: gameSession.initialPlayerLocation?.lng || 0
                    },
                    finalLocation: {
                        lat: finalPlayerLat,
                        lng: finalPlayerLng
                    }
                });

                await gameRecord.save();
                result.gameRecordId = gameRecord._id;

            } catch (dbError) {
                console.error('データベース更新エラー:', dbError);
                // ゲーム結果は返すが、DBエラーは警告として記録
                result.warning = 'スコアの保存に失敗しました';
            }
        }

        // セッション更新
        req.session.gameSession = gameSession;

        successResponse(res, result);
    } catch (error) {
        console.error('ゲーム完了エラー:', error);
        errorResponse(res, 'ゲームの完了処理に失敗しました', 500);
    }
};