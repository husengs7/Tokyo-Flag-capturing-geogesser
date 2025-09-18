// ゲームセッション管理サービス（セッション作成、検証、完了処理）
const { calculateDistance, calculateScore } = require('../utils/gameUtils');

class GameService {
    // ゲームセッション作成
    static createGameSession(targetLat, targetLng, playerLat, playerLng) {
        const initialDistance = calculateDistance(playerLat, playerLng, targetLat, targetLng);
        
        const gameSession = {
            id: Date.now().toString(),
            targetLocation: { lat: targetLat, lng: targetLng },
            initialPlayerLocation: { lat: playerLat, lng: playerLng },
            initialDistance: Math.round(initialDistance),
            hintUsed: false,
            respawnCount: 0,
            startTime: new Date(),
            completed: false
        };

        return gameSession;
    }

    // セッション検証
    static validateGameSession(gameSession, gameId) {
        return gameSession && 
               gameSession.id === gameId && 
               !gameSession.completed;
    }

    // ヒント使用記録
    static recordHintUsage(gameSession) {
        if (gameSession) {
            gameSession.hintUsed = true;
        }
        return gameSession;
    }

    // リスポーン使用記録
    static recordRespawnUsage(gameSession) {
        if (gameSession) {
            gameSession.respawnCount = (gameSession.respawnCount || 0) + 1;
        }
        return gameSession;
    }

    // ゲーム完了・スコア計算
    static completeGame(gameSession, finalPlayerLat, finalPlayerLng) {
        if (!gameSession) return null;

        // 最終距離計算
        const finalDistance = calculateDistance(
            finalPlayerLat, finalPlayerLng,
            gameSession.targetLocation.lat, gameSession.targetLocation.lng
        );
        
        // スコア計算
        const score = calculateScore(
            Math.round(finalDistance),
            gameSession.initialDistance,
            gameSession.hintUsed
        );

        // ゲームセッション完了マーク
        gameSession.completed = true;
        gameSession.finalDistance = Math.round(finalDistance);
        gameSession.score = score;
        gameSession.endTime = new Date();

        return {
            distance: Math.round(finalDistance),
            score: score,
            hintUsed: gameSession.hintUsed,
            respawnCount: gameSession.respawnCount || 0
        };
    }
}

module.exports = GameService;