// Socket.io サーバー設定（リアルタイム通信用）
const { Server } = require('socket.io');
const User = require('../models/User');
const RoomService = require('../services/roomService');
const MultiGameService = require('../services/multiGameService');

// Socket.io認証ミドルウェア
const authenticateSocket = async (socket, next) => {
    try {
        // セッションからユーザー情報を取得（Express-sessionと連携）
        const sessionId = socket.handshake.auth.sessionId || socket.request.session?.passport?.user;

        if (!sessionId) {
            return next(new Error('認証が必要です'));
        }

        // ユーザー情報を取得
        const user = await User.findById(sessionId);
        if (!user) {
            return next(new Error('ユーザーが見つかりません'));
        }

        // ソケットにユーザー情報を添付
        socket.userId = user._id.toString();
        socket.username = user.username;

        next();
    } catch (error) {
        console.error('Socket認証エラー:', error);
        next(new Error('認証に失敗しました'));
    }
};

// Socket.ioサーバー初期化
function initializeSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // 認証ミドルウェアを適用
    io.use(authenticateSocket);

    // 接続処理
    io.on('connection', (socket) => {
        console.log(`ユーザー接続: ${socket.username} (${socket.userId})`);

        // ルーム参加処理
        socket.on('join-room', async (data) => {
            try {
                const { roomKey } = data;

                // ルーム参加
                const room = await RoomService.joinRoom(roomKey, socket.userId);

                // Socket.ioルームに参加
                socket.join(room._id.toString());

                // ルーム内の他のプレイヤーに参加通知
                socket.to(room._id.toString()).emit('player-joined', {
                    userId: socket.userId,
                    username: socket.username,
                    playersCount: room.players.length
                });

                // 参加者にルーム情報を送信
                socket.emit('room-joined', {
                    success: true,
                    room: {
                        id: room._id,
                        roomKey: room.roomKey,
                        status: room.status,
                        players: room.players,
                        gameState: room.gameState
                    }
                });

                console.log(`${socket.username} がルーム ${roomKey} に参加`);

            } catch (error) {
                console.error('ルーム参加エラー:', error);
                socket.emit('room-join-error', { message: error.message });
            }
        });

        // ルーム作成処理
        socket.on('create-room', async (data) => {
            try {
                const { settings } = data;

                // ルーム作成
                const room = await RoomService.createRoom(socket.userId, settings);

                // Socket.ioルームに参加
                socket.join(room._id.toString());

                socket.emit('room-created', {
                    success: true,
                    room: {
                        id: room._id,
                        roomKey: room.roomKey,
                        status: room.status,
                        players: room.players,
                        settings: room.settings
                    }
                });

                console.log(`${socket.username} がルーム ${room.roomKey} を作成`);

            } catch (error) {
                console.error('ルーム作成エラー:', error);
                socket.emit('room-create-error', { message: error.message });
            }
        });

        // プレイヤー準備状態更新
        socket.on('player-ready', async (data) => {
            try {
                const { roomId, isReady } = data;

                const room = await RoomService.setPlayerReady(roomId, socket.userId, isReady);

                // ルーム内の全員に準備状態を通知
                io.to(roomId).emit('player-ready-updated', {
                    userId: socket.userId,
                    isReady: isReady,
                    allPlayersReady: room.allPlayersReady()
                });

                console.log(`${socket.username} の準備状態: ${isReady}`);

            } catch (error) {
                console.error('準備状態更新エラー:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // ゲーム開始
        socket.on('start-game', async (data) => {
            try {
                const { roomId, targetLat, targetLng, playerLat, playerLng } = data;

                const room = await MultiGameService.startMultiGame(
                    roomId, targetLat, targetLng, playerLat, playerLng
                );

                // ルーム内の全員にゲーム開始を通知
                io.to(roomId).emit('game-started', {
                    gameState: room.gameState,
                    status: room.status,
                    currentRound: room.gameState.currentRound
                });

                console.log(`ルーム ${room.roomKey} でゲーム開始`);

            } catch (error) {
                console.error('ゲーム開始エラー:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // プレイヤー位置更新（リアルタイム）
        socket.on('update-position', async (data) => {
            try {
                const { roomId, lat, lng } = data;

                await RoomService.updatePlayerPosition(roomId, socket.userId, lat, lng);

                // ルーム内の他のプレイヤーに位置情報を送信
                socket.to(roomId).emit('player-position-updated', {
                    userId: socket.userId,
                    username: socket.username,
                    position: { lat, lng, timestamp: new Date() }
                });

            } catch (error) {
                console.error('位置更新エラー:', error);
                // 位置更新はエラーを送信しない（頻繁に発生するため）
            }
        });

        // プレイヤーの推測処理
        socket.on('player-guess', async (data) => {
            try {
                const { roomId, guessLat, guessLng, hintUsed } = data;

                const result = await MultiGameService.processPlayerGuess(
                    roomId, socket.userId, guessLat, guessLng, hintUsed
                );

                // 推測者に結果を送信
                socket.emit('guess-result', result);

                // ルーム内の全員に推測完了を通知
                io.to(roomId).emit('player-guessed', {
                    userId: socket.userId,
                    username: socket.username,
                    score: result.score,
                    totalScore: result.totalScore
                });

                // 全員が推測完了した場合、ランキングを表示
                if (result.ranking) {
                    setTimeout(() => {
                        io.to(roomId).emit('round-ranking', {
                            ranking: result.ranking,
                            currentRound: result.currentRound
                        });
                    }, 1000);
                }

                console.log(`${socket.username} が推測完了: スコア ${result.score}`);

            } catch (error) {
                console.error('推測処理エラー:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // 次ラウンド開始
        socket.on('next-round', async (data) => {
            try {
                const { roomId, targetLat, targetLng, playerLat, playerLng } = data;

                const room = await MultiGameService.nextRound(
                    roomId, targetLat, targetLng, playerLat, playerLng
                );

                // ルーム内の全員に次ラウンド開始を通知
                io.to(roomId).emit('next-round-started', {
                    gameState: room.gameState,
                    currentRound: room.gameState.currentRound
                });

                console.log(`ルーム ${room.roomKey} で第${room.gameState.currentRound}ラウンド開始`);

            } catch (error) {
                console.error('次ラウンド開始エラー:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // ゲーム完了処理
        socket.on('complete-game', async (data) => {
            try {
                const { roomId } = data;

                const result = await MultiGameService.completeMultiGame(roomId);

                // ルーム内の全員に最終結果を送信
                io.to(roomId).emit('game-completed', {
                    finalRanking: result.finalRanking,
                    completedAt: result.completedAt,
                    totalRounds: result.totalRounds
                });

                console.log(`ルーム ${roomId} でゲーム完了`);

            } catch (error) {
                console.error('ゲーム完了エラー:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // ルーム退出
        socket.on('leave-room', async (data) => {
            try {
                const { roomId } = data;

                const room = await RoomService.leaveRoom(roomId, socket.userId);

                // Socket.ioルームから退出
                socket.leave(roomId);

                // ルーム内の他のプレイヤーに退出通知
                socket.to(roomId).emit('player-left', {
                    userId: socket.userId,
                    username: socket.username
                });

                socket.emit('room-left', { success: true });

                console.log(`${socket.username} がルーム ${roomId} から退出`);

            } catch (error) {
                console.error('ルーム退出エラー:', error);
                socket.emit('error', { message: error.message });
            }
        });

        // 接続切断処理
        socket.on('disconnect', async (reason) => {
            console.log(`ユーザー切断: ${socket.username} (理由: ${reason})`);

            // 参加中のルームから自動退出処理は実装しない
            // （一時的な切断の可能性があるため）
        });

        // エラーハンドリング
        socket.on('error', (error) => {
            console.error('Socketエラー:', error);
        });
    });

    return io;
}

module.exports = { initializeSocket };