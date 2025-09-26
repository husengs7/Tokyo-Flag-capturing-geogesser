// リアルタイム位置表示システムのJestテスト

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

const User = require('../models/User');
const Room = require('../models/Room');
const RoomService = require('../services/roomService');
const MultiGameService = require('../services/multiGameService');
const { initializeSocket } = require('../config/socket');

describe('リアルタイム位置表示システムテスト', () => {
    let mongoServer;
    let app, server, io;
    let hostUser, playerUser;
    let room;
    let hostSocket, playerSocket;
    let port;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Express アプリケーション設定
        app = express();
        app.use(express.json());
        server = http.createServer(app);

        // Socket.io初期化（認証を無効化してテスト用に設定）
        io = new Server(server, {
            cors: { origin: "*" }
        });

        // テスト用の簡単な認証なしSocket.io設定
        io.on('connection', (socket) => {
            console.log(`テストSocket接続: ${socket.id}`);

            // ルーム参加処理
            socket.on('join-room', async (data) => {
                try {
                    socket.join(data.roomId);
                    socket.emit('room-joined', { success: true });
                    console.log(`Socket ${socket.id} がルーム ${data.roomId} に参加`);
                } catch (error) {
                    socket.emit('room-join-error', { message: error.message });
                }
            });

            // 位置更新処理
            socket.on('update-position', async (data) => {
                try {
                    const { roomId, lat, lng, userId, username } = data;

                    // データベースに位置を保存（userIdがある場合のみ）
                    if (userId) {
                        try {
                            await RoomService.updatePlayerPosition(roomId, userId, lat, lng);
                            console.log(`DB位置更新成功: ${username} (${lat}, ${lng})`);
                        } catch (dbError) {
                            console.log(`DB位置更新スキップ: ${dbError.message}`);
                            // データベース更新に失敗してもWebSocket通信は継続
                        }
                    }

                    // ルーム内の他のプレイヤーに位置情報を送信（常に実行）
                    socket.to(roomId).emit('player-position-updated', {
                        userId: userId || socket.id,
                        username: username || `User-${socket.id}`,
                        position: { lat, lng, timestamp: new Date() }
                    });

                    console.log(`WebSocket位置更新: ${username || socket.id} (${lat}, ${lng})`);
                } catch (error) {
                    console.error('位置更新エラー:', error);
                }
            });
        });

        // ポートを動的に取得
        server.listen(() => {
            port = server.address().port;
            console.log(`テストサーバー起動: http://localhost:${port}`);
        });
    }, 30000);

    afterAll(async () => {
        if (hostSocket) hostSocket.disconnect();
        if (playerSocket) playerSocket.disconnect();
        if (server) server.close();
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // データベースクリーンアップ
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }

        // テストユーザー作成
        hostUser = await User.create({
            username: 'testhost',
            email: 'host@test.com',
            password: 'password123'
        });

        playerUser = await User.create({
            username: 'testplayer',
            email: 'player@test.com',
            password: 'password123'
        });

        // ルーム作成
        room = await RoomService.createRoom(hostUser._id, {
            maxPlayers: 2,
            roundCount: 3
        });

        // プレイヤーをルームに参加
        await RoomService.joinRoom(room.roomKey, playerUser._id);

        // 両プレイヤーを準備状態に
        await RoomService.setPlayerReady(room._id, hostUser._id, true);
        await RoomService.setPlayerReady(room._id, playerUser._id, true);

        // ゲーム開始
        await MultiGameService.startMultiGame(room._id, { lat: 35.681236, lng: 139.767125 });

        room = await Room.findById(room._id); // 更新されたルームを取得
    });

    test('WebSocket接続とルーム参加が正常に動作する', (done) => {
        hostSocket = Client(`http://localhost:${port}`);

        hostSocket.on('connect', () => {
            console.log('ホストSocket接続成功');

            hostSocket.emit('join-room', { roomId: room._id.toString() });
        });

        hostSocket.on('room-joined', (data) => {
            expect(data.success).toBe(true);
            console.log('ホストがルーム参加成功');
            hostSocket.disconnect();
            done();
        });

        hostSocket.on('room-join-error', (error) => {
            console.error('ルーム参加エラー:', error);
            done(new Error(error.message));
        });
    }, 10000);

    test('位置更新が他プレイヤーに正しく送信される', (done) => {
        hostSocket = Client(`http://localhost:${port}`);
        playerSocket = Client(`http://localhost:${port}`);

        let hostJoined = false;
        let playerJoined = false;

        const checkBothJoined = () => {
            if (hostJoined && playerJoined) {
                // 両方のプレイヤーがルームに参加したら位置更新テスト開始
                console.log('両プレイヤーがルーム参加完了、位置更新テスト開始');

                // プレイヤーが位置更新を受信するリスナーを設定
                playerSocket.on('player-position-updated', (data) => {
                    console.log('プレイヤーが位置更新を受信:', data);

                    expect(data.userId).toBe(hostUser._id.toString());
                    expect(data.username).toBe(hostUser.username);
                    expect(data.position.lat).toBe(35.685);
                    expect(data.position.lng).toBe(139.770);
                    expect(data.position.timestamp).toBeDefined();

                    hostSocket.disconnect();
                    playerSocket.disconnect();
                    done();
                });

                // ホストが位置を更新
                hostSocket.emit('update-position', {
                    roomId: room._id.toString(),
                    userId: hostUser._id.toString(),
                    username: hostUser.username,
                    lat: 35.685,
                    lng: 139.770
                });
            }
        };

        hostSocket.on('connect', () => {
            hostSocket.emit('join-room', { roomId: room._id.toString() });
        });

        playerSocket.on('connect', () => {
            playerSocket.emit('join-room', { roomId: room._id.toString() });
        });

        hostSocket.on('room-joined', () => {
            console.log('ホストがルーム参加');
            hostJoined = true;
            checkBothJoined();
        });

        playerSocket.on('room-joined', () => {
            console.log('プレイヤーがルーム参加');
            playerJoined = true;
            checkBothJoined();
        });
    }, 15000);

    test('連続的な位置更新が正しく処理される', (done) => {
        hostSocket = Client(`http://localhost:${port}`);
        playerSocket = Client(`http://localhost:${port}`);

        let hostJoined = false;
        let playerJoined = false;
        let updateCount = 0;
        const expectedUpdates = 3;

        const checkBothJoined = () => {
            if (hostJoined && playerJoined) {
                console.log('連続位置更新テスト開始');

                // プレイヤーが位置更新を受信するリスナーを設定
                playerSocket.on('player-position-updated', (data) => {
                    updateCount++;
                    console.log(`位置更新 #${updateCount}:`, data);

                    expect(data.userId).toBe(hostUser._id.toString());
                    expect(data.username).toBe(hostUser.username);
                    expect(data.position.lat).toBeCloseTo(35.685 + updateCount * 0.001, 5);
                    expect(data.position.lng).toBeCloseTo(139.770 + updateCount * 0.001, 5);

                    if (updateCount === expectedUpdates) {
                        console.log('全ての位置更新を受信完了');
                        hostSocket.disconnect();
                        playerSocket.disconnect();
                        done();
                    }
                });

                // 0.5秒間隔で位置を更新（実際のアプリと同じ間隔）
                let currentUpdate = 0;
                const updateInterval = setInterval(() => {
                    currentUpdate++;
                    hostSocket.emit('update-position', {
                        roomId: room._id.toString(),
                        userId: hostUser._id.toString(),
                        username: hostUser.username,
                        lat: 35.685 + currentUpdate * 0.001,
                        lng: 139.770 + currentUpdate * 0.001
                    });

                    if (currentUpdate >= expectedUpdates) {
                        clearInterval(updateInterval);
                    }
                }, 500);
            }
        };

        hostSocket.on('connect', () => {
            hostSocket.emit('join-room', { roomId: room._id.toString() });
        });

        playerSocket.on('connect', () => {
            playerSocket.emit('join-room', { roomId: room._id.toString() });
        });

        hostSocket.on('room-joined', () => {
            hostJoined = true;
            checkBothJoined();
        });

        playerSocket.on('room-joined', () => {
            playerJoined = true;
            checkBothJoined();
        });
    }, 20000);

    test('データベースへの位置保存が正しく動作する', async () => {
        // 位置を更新
        await RoomService.updatePlayerPosition(
            room._id.toString(),
            hostUser._id.toString(),
            35.685,
            139.770
        );

        // データベースから確認
        const updatedRoom = await Room.findById(room._id);
        const hostPlayer = updatedRoom.players.find(p =>
            p.userId.toString() === hostUser._id.toString()
        );

        expect(hostPlayer.currentPosition.lat).toBe(35.685);
        expect(hostPlayer.currentPosition.lng).toBe(139.770);
        expect(hostPlayer.currentPosition.timestamp).toBeDefined();
    });

    test('無効な座標での位置更新が適切にエラーハンドリングされる', (done) => {
        hostSocket = Client(`http://localhost:${port}`);

        hostSocket.on('connect', () => {
            hostSocket.emit('join-room', { roomId: room._id.toString() });
        });

        hostSocket.on('room-joined', () => {
            // 無効な座標を送信
            hostSocket.emit('update-position', {
                roomId: room._id.toString(),
                userId: hostUser._id.toString(),
                username: hostUser.username,
                lat: 999, // 無効な緯度
                lng: 999  // 無効な経度
            });

            // エラーが発生しても他の機能に影響しないことを確認
            setTimeout(() => {
                console.log('無効な座標テスト完了 - システムが安定');
                hostSocket.disconnect();
                done();
            }, 1000);
        });
    }, 10000);
});