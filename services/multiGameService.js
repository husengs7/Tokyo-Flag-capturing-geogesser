// マルチゲーム進行管理サービス（3ラウンド制の進行、スコア管理、履歴保存）
const Room = require('../models/Room');
const User = require('../models/User');
const GameRecord = require('../models/GameRecord');
const MultiGameRecord = require('../models/MultiGameRecord');
const { calculateDistance, calculateScore } = require('../utils/gameUtils');

class MultiGameService {

    /**
     * 新しいマルチゲームを開始（3ラウンドの1ラウンド目）
     * @param {string} roomId - ルームID
     * @param {number} targetLat - フラッグの緯度
     * @param {number} targetLng - フラッグの経度
     * @param {number} playerLat - スタート位置の緯度
     * @param {number} playerLng - スタート位置の経度
     * @returns {Promise<Room>} 更新されたルーム
     */
    static async startMultiGame(roomId, targetLat, targetLng, playerLat, playerLng) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // ルーム状態チェック
            if (room.status !== 'waiting') {
                throw new Error('ゲーム開始できない状態です');
            }

            // 全プレイヤーが準備完了かチェック
            if (!room.allPlayersReady()) {
                throw new Error('全プレイヤーの準備が完了していません');
            }

            // 初期距離を計算
            const initialDistance = calculateDistance(playerLat, playerLng, targetLat, targetLng);

            // ゲーム状態を更新
            room.status = 'playing';
            room.gameState = {
                currentRound: 1,
                roundStartTime: new Date(),
                targetLocation: { lat: targetLat, lng: targetLng },
                playerStartLocation: { lat: playerLat, lng: playerLng },
                initialDistance: Math.round(initialDistance),
                allPlayersGuessed: false,
                rankingDisplayUntil: null
            };

            // 全プレイヤーのスコア関連データをリセット
            room.players.forEach(player => {
                player.totalScore = 0;
                player.gameScores = [];
                player.hasGuessed = false;
                player.currentPosition = {
                    lat: playerLat,
                    lng: playerLng,
                    timestamp: new Date()
                };
            });

            // 各プレイヤーのMultiGameRecordを作成
            for (const player of room.players) {
                const existingRecord = await MultiGameRecord.findOne({
                    userId: player.userId,
                    roomId: roomId,
                    isCompleted: false
                });

                // 既存の未完了記録がない場合のみ作成
                if (!existingRecord) {
                    const multiGameRecord = new MultiGameRecord({
                        userId: player.userId,
                        roomId: roomId,
                        roomKey: room.roomKey,
                        gameRecords: [], // 空の配列で開始
                        totalScore: 0
                    });
                    await multiGameRecord.save();
                }
            }

            await room.save();
            return room;

        } catch (error) {
            console.error('マルチゲーム開始エラー:', error);
            throw error;
        }
    }

    /**
     * プレイヤーの推測を処理し、スコアを計算
     * @param {string} roomId - ルームID
     * @param {string} userId - ユーザーID
     * @param {number} guessLat - 推測位置の緯度
     * @param {number} guessLng - 推測位置の経度
     * @param {boolean} hintUsed - ヒント使用の有無
     * @returns {Promise<Object>} 推測結果（スコア、距離等）
     */
    static async processPlayerGuess(roomId, userId, guessLat, guessLng, hintUsed = false) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // プレイヤー検索
            const player = room.players.find(p => p.userId.toString() === userId.toString());
            if (!player) {
                throw new Error('このルームに参加していません');
            }

            // 既に推測済みかチェック
            if (player.hasGuessed) {
                throw new Error('既に推測済みです');
            }

            // 最終距離を計算
            const finalDistance = calculateDistance(
                guessLat, guessLng,
                room.gameState.targetLocation.lat,
                room.gameState.targetLocation.lng
            );

            // スコアを計算
            const score = calculateScore(
                Math.round(finalDistance),
                room.gameState.initialDistance,
                hintUsed
            );

            // プレイヤーのスコアを更新
            player.gameScores.push(score);
            player.totalScore += score;
            player.hasGuessed = true;

            // GameRecordを作成（マルチモード）
            const gameRecord = new GameRecord({
                userId: userId,
                gameMode: 'multi',
                score: score,
                finalDistance: Math.round(finalDistance),
                hintUsed: hintUsed,
                respawnCount: player.respawnCount || 0,
                targetLocation: {
                    lat: room.gameState.targetLocation.lat,
                    lng: room.gameState.targetLocation.lng
                },
                playerStartLocation: {
                    lat: room.gameState.playerStartLocation.lat,
                    lng: room.gameState.playerStartLocation.lng
                },
                finalLocation: {
                    lat: guessLat,
                    lng: guessLng
                },
                playTime: 0 // マルチでは個別のプレイ時間は管理しない
            });

            await gameRecord.save();

            // MultiGameRecordにGameRecord IDを追加
            const multiGameRecord = await MultiGameRecord.findOne({
                userId: userId,
                roomId: roomId,
                isCompleted: false
            });

            if (multiGameRecord) {
                await multiGameRecord.addGameRecord(gameRecord._id);
                // 統計を再計算
                await multiGameRecord.calculateStats();
            }

            // 全員が推測完了したかチェック
            if (room.allPlayersGuessed()) {
                room.gameState.allPlayersGuessed = true;
                room.status = 'ranking';
                // 5秒後にランキング表示終了
                room.gameState.rankingDisplayUntil = new Date(Date.now() + 5000);
            }

            await room.save();

            return {
                score: score,
                distance: Math.round(finalDistance),
                hintUsed: hintUsed,
                totalScore: player.totalScore,
                currentRound: room.gameState.currentRound,
                ranking: room.getCurrentRanking()
            };

        } catch (error) {
            console.error('推測処理エラー:', error);
            throw error;
        }
    }

    /**
     * 次のラウンドに進む
     * @param {string} roomId - ルームID
     * @param {number} targetLat - 次のラウンドのフラッグ緯度
     * @param {number} targetLng - 次のラウンドのフラッグ経度
     * @param {number} playerLat - 次のラウンドのスタート緯度
     * @param {number} playerLng - 次のラウンドのスタート経度
     * @returns {Promise<Room>} 更新されたルーム
     */
    static async nextRound(roomId, targetLat, targetLng, playerLat, playerLng) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // 現在のラウンドが完了しているかチェック
            if (!room.gameState.allPlayersGuessed) {
                throw new Error('現在のラウンドがまだ完了していません');
            }

            // 3ラウンド終了後は次に進めない
            if (room.gameState.currentRound >= room.settings.roundCount) {
                throw new Error('既に全ラウンドが完了しています');
            }

            // 初期距離を計算
            const initialDistance = calculateDistance(playerLat, playerLng, targetLat, targetLng);

            // 次のラウンドに進む
            room.gameState.currentRound++;
            room.gameState.roundStartTime = new Date();
            room.gameState.targetLocation = { lat: targetLat, lng: targetLng };
            room.gameState.playerStartLocation = { lat: playerLat, lng: playerLng };
            room.gameState.initialDistance = Math.round(initialDistance);
            room.gameState.allPlayersGuessed = false;
            room.gameState.rankingDisplayUntil = null;
            room.status = 'playing';

            // 全プレイヤーの推測状態をリセット
            room.players.forEach(player => {
                player.hasGuessed = false;
                player.currentPosition = {
                    lat: playerLat,
                    lng: playerLng,
                    timestamp: new Date()
                };
            });

            await room.save();
            return room;

        } catch (error) {
            console.error('次ラウンド処理エラー:', error);
            throw error;
        }
    }

    /**
     * マルチゲームを完了（3ラウンド終了後）
     * @param {string} roomId - ルームID
     * @returns {Promise<Object>} 最終結果（ランキング等）
     */
    static async completeMultiGame(roomId) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // 3ラウンド完了チェック
            if (room.gameState.currentRound < room.settings.roundCount) {
                throw new Error('まだ全ラウンドが完了していません');
            }

            // 最終ランキングを取得
            const finalRanking = room.getCurrentRanking();

            // 各プレイヤーのMultiGameRecordに最終ランキングを設定
            for (let i = 0; i < finalRanking.length; i++) {
                const rankedPlayer = finalRanking[i];

                // 対戦相手情報を作成
                const opponents = finalRanking
                    .filter(p => p.userId.toString() !== rankedPlayer.userId.toString())
                    .map(p => ({
                        userId: p.userId,
                        username: p.username,
                        finalScore: p.totalScore
                    }));

                // MultiGameRecordを更新
                const multiGameRecord = await MultiGameRecord.findOne({
                    userId: rankedPlayer.userId,
                    roomId: roomId
                });

                if (multiGameRecord) {
                    await multiGameRecord.setFinalRanking(
                        rankedPlayer.rank,
                        finalRanking.length,
                        opponents
                    );
                }
            }

            // 各プレイヤーのユーザー統計を更新
            for (const player of room.players) {
                await User.findByIdAndUpdate(player.userId, {
                    $inc: {
                        'multiStats.playCount': 1, // 対戦回数を1増加
                        'multiStats.totalScore': player.totalScore // 合計スコアを加算
                    },
                    $max: {
                        'multiStats.bestScore': player.totalScore // ベストスコアを更新
                    }
                });
            }

            // ルーム状態を完了に更新
            room.status = 'finished';
            await room.save();

            return {
                finalRanking: finalRanking,
                completedAt: new Date(),
                totalRounds: room.settings.roundCount
            };

        } catch (error) {
            console.error('マルチゲーム完了エラー:', error);
            throw error;
        }
    }

    /**
     * ルーム内の現在のランキング状況を取得
     * @param {string} roomId - ルームID
     * @returns {Promise<Array>} 現在のランキング
     */
    static async getCurrentRanking(roomId) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            return room.getCurrentRanking();
        } catch (error) {
            console.error('ランキング取得エラー:', error);
            throw error;
        }
    }

    /**
     * プレイヤーのマルチゲーム履歴を取得
     * @param {string} userId - ユーザーID
     * @param {number} limit - 取得件数制限
     * @returns {Promise<Array>} マルチゲーム履歴
     */
    static async getPlayerMultiGameHistory(userId, limit = 10) {
        try {
            return await MultiGameRecord.find({ userId: userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('opponents.userId', 'username');
        } catch (error) {
            console.error('マルチゲーム履歴取得エラー:', error);
            throw error;
        }
    }

    /**
     * マルチゲームの統計情報を取得
     * @param {string} userId - ユーザーID
     * @returns {Promise<Object>} 統計情報
     */
    static async getMultiGameStats(userId) {
        try {
            const completedGames = await MultiGameRecord.find({
                userId: userId,
                isCompleted: true
            });

            if (completedGames.length === 0) {
                return {
                    totalGames: 0,
                    averageScore: 0,
                    averageRanking: 0,
                    winRate: 0,
                    bestScore: 0
                };
            }

            const totalGames = completedGames.length;
            const totalScore = completedGames.reduce((sum, game) => sum + game.totalScore, 0);
            const averageScore = totalScore / totalGames;

            const totalRanking = completedGames.reduce((sum, game) => sum + game.finalRanking, 0);
            const averageRanking = totalRanking / totalGames;

            const wins = completedGames.filter(game => game.finalRanking === 1).length;
            const winRate = (wins / totalGames) * 100;

            const bestScore = Math.max(...completedGames.map(game => game.totalScore));

            return {
                totalGames,
                averageScore: Math.round(averageScore),
                averageRanking: parseFloat(averageRanking.toFixed(2)),
                winRate: parseFloat(winRate.toFixed(1)),
                bestScore
            };
        } catch (error) {
            console.error('マルチゲーム統計取得エラー:', error);
            throw error;
        }
    }

    /**
     * プレイヤーのリスポーン使用を記録
     * @param {string} roomId - ルームID
     * @param {string} userId - プレイヤーのユーザーID
     * @returns {Promise<Object>} 処理結果
     */
    static async recordPlayerRespawn(roomId, userId) {
        try {
            const room = await Room.findById(roomId);
            if (!room) {
                throw new Error('ルームが見つかりません');
            }

            // プレイヤー検索
            const player = room.players.find(p => p.userId.toString() === userId.toString());
            if (!player) {
                throw new Error('このルームに参加していません');
            }

            // ゲーム中かチェック
            if (room.status !== 'playing') {
                throw new Error('ゲーム中ではありません');
            }

            // 既に推測済みかチェック
            if (player.hasGuessed) {
                throw new Error('既に推測済みです');
            }

            // リスポーン回数を増加
            player.respawnCount = (player.respawnCount || 0) + 1;

            // ルーム保存
            await room.save();

            return {
                success: true,
                respawnCount: player.respawnCount,
                gameState: room.gameState
            };

        } catch (error) {
            console.error('リスポーン記録エラー:', error);
            throw error;
        }
    }
}

module.exports = MultiGameService;