// マルチプレイ関連のコントローラー（ルーム管理、ゲーム進行、履歴取得）
const RoomService = require('../services/roomService');
const MultiGameService = require('../services/multiGameService');
const Room = require('../models/Room');
const { successResponse, errorResponse } = require('../utils/response');
const { validateCoordinates } = require('../utils/gameUtils');

// ルーム作成
exports.createRoom = async (req, res) => {
    try {
        const { maxPlayers = 4, roundCount = 3 } = req.body;

        const room = await RoomService.createRoom(req.user._id, {
            maxPlayers,
            roundCount
        });

        successResponse(res, {
            roomId: room._id.toString(),
            roomKey: room.roomKey,
            hostId: room.hostId,
            players: room.players,
            status: room.status,
            settings: room.settings
        }, 'ルームを作成しました');

    } catch (error) {
        console.error('ルーム作成エラー:', error);
        errorResponse(res, error.message, 500);
    }
};

// ユーザーのルームクリーンアップ（ルーム参加前に使用）
exports.cleanupUserRooms = async (req, res) => {
    try {
        await RoomService.leaveAllUserRooms(req.user._id);
        successResponse(res, null, 'ユーザーのルームデータをクリーンアップしました');
    } catch (error) {
        console.error('ルームクリーンアップエラー:', error);
        errorResponse(res, error.message, 500);
    }
};

// ルーム参加
exports.joinRoom = async (req, res) => {
    try {
        const { roomKey } = req.body;

        if (!roomKey || roomKey.length !== 6) {
            return errorResponse(res, '有効な6桁のルームキーを入力してください', 400);
        }

        const room = await RoomService.joinRoom(roomKey, req.user._id);

        successResponse(res, {
            roomId: room._id.toString(),
            roomKey: room.roomKey,
            players: room.players,
            status: room.status,
            gameState: room.gameState
        }, 'ルームに参加しました');

    } catch (error) {
        console.error('ルーム参加エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// ルーム情報取得
exports.getRoomInfo = async (req, res) => {
    try {
        const { roomId } = req.params;

        // 認証チェック
        if (!req.user || !req.user._id) {
            return errorResponse(res, '認証が必要です', 401);
        }

        const room = await RoomService.getRoomInfo(roomId);

        // 参加者でない場合は詳細情報を制限
        const isParticipant = room.players.some(p => {
            const playerId = p.userId._id ? p.userId._id.toString() : p.userId.toString();
            return playerId === req.user._id.toString();
        });

        if (!isParticipant) {
            return successResponse(res, {
                roomKey: room.roomKey,
                playersCount: room.players.length,
                maxPlayers: room.settings.maxPlayers,
                status: room.status
            });
        }

        successResponse(res, {
            roomId: room._id.toString(),
            roomKey: room.roomKey,
            hostId: room.hostId._id ? room.hostId._id.toString() : room.hostId.toString(),
            players: room.players,
            status: room.status,
            gameState: room.gameState,
            settings: room.settings
        });

    } catch (error) {
        console.error('ルーム情報取得エラー:', error);
        errorResponse(res, error.message, 404);
    }
};

// ルーム退出
exports.leaveRoom = async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await RoomService.leaveRoom(roomId, req.user._id);

        if (room === null) {
            successResponse(res, null, 'ルームを解散しました');
        } else {
            successResponse(res, {
                roomId: room._id,
                players: room.players
            }, 'ルームから退出しました');
        }

    } catch (error) {
        console.error('ルーム退出エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// プレイヤー準備状態更新
exports.setPlayerReady = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { isReady = true } = req.body;

        const room = await RoomService.setPlayerReady(roomId, req.user._id, isReady);

        successResponse(res, {
            userId: req.user._id,
            isReady: isReady,
            allPlayersReady: room.allPlayersReady(),
            players: room.players.map(p => ({
                userId: p.userId,
                username: p.username,
                isReady: p.isReady,
                isHost: p.isHost
            }))
        }, '準備状態を更新しました');

    } catch (error) {
        console.error('準備状態更新エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// ゲーム開始
exports.startGame = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { targetLocation } = req.body;

        // ターゲット座標検証
        if (!targetLocation || !validateCoordinates(targetLocation.lat, targetLocation.lng)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        // ホスト権限チェック
        const room = await RoomService.getRoomInfo(roomId);
        const hostId = room.hostId._id ? room.hostId._id.toString() : room.hostId.toString();
        if (hostId !== req.user._id.toString()) {
            return errorResponse(res, 'ホストのみがゲームを開始できます', 400);
        }

        const updatedRoom = await MultiGameService.startMultiGame(
            roomId, targetLocation
        );

        successResponse(res, {
            roomId: updatedRoom._id,
            gameState: updatedRoom.gameState,
            status: updatedRoom.status,
            currentRound: updatedRoom.gameState.currentRound
        }, '第1ラウンドを開始しました');

    } catch (error) {
        console.error('ゲーム開始エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// プレイヤーのスポーン位置を受信
exports.setSpawnPosition = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { lat, lng } = req.body;

        // 座標検証
        if (!validateCoordinates(lat, lng)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        // プレイヤーの現在位置を更新
        const room = await Room.findById(roomId);
        if (!room) {
            return errorResponse(res, 'ルームが見つかりません', 404);
        }

        const player = room.players.find(p => p.userId.toString() === req.user._id.toString());
        if (!player) {
            return errorResponse(res, 'プレイヤーが見つかりません', 404);
        }

        player.currentPosition = {
            lat: lat,
            lng: lng,
            timestamp: new Date()
        };

        await room.save();

        console.log(`${player.username}のスポーン位置を設定: (${lat}, ${lng})`);

        successResponse(res, {
            position: player.currentPosition
        }, 'スポーン位置を設定しました');

    } catch (error) {
        console.error('スポーン位置設定エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// プレイヤーの推測処理
exports.submitGuess = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { guessLat, guessLng, hintUsed = false } = req.body;

        // 座標検証
        if (!validateCoordinates(guessLat, guessLng)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        const result = await MultiGameService.processPlayerGuess(
            roomId, req.user._id, guessLat, guessLng, hintUsed
        );

        successResponse(res, result, '推測を処理しました');

    } catch (error) {
        console.error('推測処理エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// リスポーン使用記録
exports.recordRespawn = async (req, res) => {
    try {
        const { roomId } = req.params;

        const result = await MultiGameService.recordPlayerRespawn(roomId, req.user._id);

        successResponse(res, result, 'リスポーン使用を記録しました');

    } catch (error) {
        console.error('リスポーン記録エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// 次ラウンド開始
exports.nextRound = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { targetLat, targetLng, playerLat, playerLng } = req.body;

        // 座標検証
        if (!validateCoordinates(targetLat, targetLng) ||
            !validateCoordinates(playerLat, playerLng)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        const room = await MultiGameService.nextRound(
            roomId, targetLat, targetLng, playerLat, playerLng
        );

        successResponse(res, {
            roomId: room._id,
            gameState: room.gameState,
            currentRound: room.gameState.currentRound,
            initialDistance: room.gameState.initialDistance
        }, `第${room.gameState.currentRound}ラウンドを開始しました`);

    } catch (error) {
        console.error('次ラウンド開始エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// ゲーム完了処理
exports.completeGame = async (req, res) => {
    try {
        const { roomId } = req.params;

        const result = await MultiGameService.completeMultiGame(roomId);

        successResponse(res, result, 'マルチゲームが完了しました');

    } catch (error) {
        console.error('ゲーム完了エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// 現在のランキング取得
exports.getCurrentRanking = async (req, res) => {
    try {
        const { roomId } = req.params;

        const ranking = await MultiGameService.getCurrentRanking(roomId);

        successResponse(res, { ranking }, '現在のランキング');

    } catch (error) {
        console.error('ランキング取得エラー:', error);
        errorResponse(res, error.message, 400);
    }
};

// プレイヤーのマルチゲーム履歴取得
exports.getGameHistory = async (req, res) => {
    try {
        const { limit = 10, page = 1 } = req.query;

        const history = await MultiGameService.getPlayerMultiGameHistory(
            req.user._id,
            parseInt(limit)
        );

        successResponse(res, {
            history: history,
            count: history.length
        }, 'マルチゲーム履歴を取得しました');

    } catch (error) {
        console.error('履歴取得エラー:', error);
        errorResponse(res, error.message, 500);
    }
};

// プレイヤーのマルチゲーム統計取得
exports.getGameStats = async (req, res) => {
    try {
        const stats = await MultiGameService.getMultiGameStats(req.user._id);

        successResponse(res, stats, 'マルチゲーム統計を取得しました');

    } catch (error) {
        console.error('統計取得エラー:', error);
        errorResponse(res, error.message, 500);
    }
};

// アクティブルーム一覧取得（開発・管理用）
exports.getActiveRooms = async (req, res) => {
    try {
        const rooms = await RoomService.getActiveRooms();

        const roomList = rooms.map(room => ({
            roomId: room._id,
            roomKey: room.roomKey,
            hostUsername: room.hostId.username,
            playersCount: room.players.length,
            maxPlayers: room.settings.maxPlayers,
            status: room.status,
            createdAt: room.createdAt
        }));

        successResponse(res, { rooms: roomList }, 'アクティブルーム一覧');

    } catch (error) {
        console.error('アクティブルーム取得エラー:', error);
        errorResponse(res, error.message, 500);
    }
};

// 位置情報更新（WebSocket経由が主だが、HTTP APIも提供）
exports.updatePosition = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { lat, lng } = req.body;

        // 座標検証
        if (!validateCoordinates(lat, lng)) {
            return errorResponse(res, '無効な座標です', 400);
        }

        const room = await RoomService.updatePlayerPosition(roomId, req.user._id, lat, lng);

        successResponse(res, {
            userId: req.user._id,
            position: { lat, lng, timestamp: new Date() }
        }, '位置情報を更新しました');

    } catch (error) {
        console.error('位置情報更新エラー:', error);
        errorResponse(res, error.message, 400);
    }
};