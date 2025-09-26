// ゲーム開始エラー修正のJestテスト

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const session = require('express-session');
const passport = require('passport');

const User = require('../models/User');
const Room = require('../models/Room');
const RoomService = require('../services/roomService');
const multiController = require('../controllers/multiController');
const { requireAuth } = require('../middleware/auth');

describe('ゲーム開始エラー修正テスト', () => {
    let mongoServer;
    let app;
    let hostUser, playerUser;
    let room;
    let hostCookie, playerCookie;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Express アプリケーションの設定
        app = express();
        app.use(express.json());
        app.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: true,
            cookie: { secure: false }
        }));
        app.use(passport.initialize());
        app.use(passport.session());

        // ルートを追加（認証は各テストで個別設定）
        app.post('/multi/rooms/:roomId/start', (req, res, next) => {
            // テスト用認証ミドルウェア
            const cookie = req.get('Cookie') || '';
            if (cookie.includes('host') && hostUser) {
                req.user = { _id: hostUser._id.toString() };
            } else if (cookie.includes('player') && playerUser) {
                req.user = { _id: playerUser._id.toString() };
            }
            next();
        }, multiController.startGame);

        app.post('/auth/login', (req, res) => {
            const { email } = req.body;
            const isHost = email === 'host@test.com';
            res.set('Set-Cookie', [`user=${isHost ? 'host' : 'player'}; Path=/`]);
            res.json({ success: true });
        });

        app.post('/multi/rooms', (req, res, next) => {
            if (hostUser) req.user = { _id: hostUser._id.toString() };
            next();
        }, multiController.createRoom);

        app.post('/multi/rooms/:roomId/join', (req, res, next) => {
            const cookie = req.get('Cookie') || '';
            if (cookie.includes('player') && playerUser) {
                req.user = { _id: playerUser._id.toString() };
            }
            next();
        }, multiController.joinRoom);

        app.put('/multi/rooms/:roomId/ready', (req, res, next) => {
            const cookie = req.get('Cookie') || '';
            if (cookie.includes('host') && hostUser) {
                req.user = { _id: hostUser._id.toString() };
            } else if (cookie.includes('player') && playerUser) {
                req.user = { _id: playerUser._id.toString() };
            }
            next();
        }, multiController.setPlayerReady);
    }, 60000);

    afterAll(async () => {
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

        // ログイン用のセッション取得
        const hostLoginRes = await request(app)
            .post('/auth/login')
            .send({
                email: 'host@test.com',
                password: 'password123'
            });
        hostCookie = hostLoginRes.headers['set-cookie'];

        const playerLoginRes = await request(app)
            .post('/auth/login')
            .send({
                email: 'player@test.com',
                password: 'password123'
            });
        playerCookie = playerLoginRes.headers['set-cookie'];

        // ルーム作成
        const roomResponse = await request(app)
            .post('/multi/rooms')
            .set('Cookie', hostCookie)
            .send({
                maxPlayers: 2,
                roundCount: 3
            });

        room = roomResponse.body.data;

        // プレイヤーをルームに参加
        await request(app)
            .post(`/multi/rooms/${room.roomId}/join`)
            .set('Cookie', playerCookie)
            .send({
                roomKey: room.roomKey
            });

        // 全プレイヤーを準備状態に
        await request(app)
            .put(`/multi/rooms/${room.roomId}/ready`)
            .set('Cookie', hostCookie)
            .send({ isReady: true });

        await request(app)
            .put(`/multi/rooms/${room.roomId}/ready`)
            .set('Cookie', playerCookie)
            .send({ isReady: true });
    });

    test('修正前: playerStartDataが必要な古い実装でエラーが発生する', async () => {
        // 古い実装のリクエスト（playerStartDataあり）
        const response = await request(app)
            .post(`/multi/rooms/${room.roomId}/start`)
            .set('Cookie', hostCookie)
            .send({
                targetLocation: { lat: 35.681236, lng: 139.767125 },
                playerStartData: [
                    {
                        userId: hostUser._id.toString(),
                        startLocation: { lat: 35.685, lng: 139.770 }
                    },
                    {
                        userId: playerUser._id.toString(),
                        startLocation: { lat: 35.675, lng: 139.765 }
                    }
                ]
            });

        // 修正前は成功するはず（もしくは別のエラー）
        console.log('古い実装レスポンス:', response.status, response.body);
    });

    test('修正後: targetLocationのみでゲーム開始が成功する', async () => {
        // 新しい実装のリクエスト（targetLocationのみ）
        const response = await request(app)
            .post(`/multi/rooms/${room.roomId}/start`)
            .set('Cookie', hostCookie)
            .send({
                targetLocation: { lat: 35.681236, lng: 139.767125 }
            });

        console.log('新しい実装レスポンス:', response.status, response.body);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.gameState).toBeDefined();
        expect(response.body.data.gameState.targetLocation).toEqual({
            lat: 35.681236,
            lng: 139.767125
        });
        expect(response.body.data.status).toBe('playing');
    });

    test('無効な座標でのエラーハンドリング', async () => {
        const response = await request(app)
            .post(`/multi/rooms/${room.roomId}/start`)
            .set('Cookie', hostCookie)
            .send({
                targetLocation: { lat: 999, lng: 999 } // 無効な座標
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('無効な座標です');
    });

    test('targetLocationが欠けている場合のエラーハンドリング', async () => {
        const response = await request(app)
            .post(`/multi/rooms/${room.roomId}/start`)
            .set('Cookie', hostCookie)
            .send({}); // targetLocationなし

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('無効な座標です');
    });

    test('ホスト以外がゲーム開始しようとした場合のエラー', async () => {
        const response = await request(app)
            .post(`/multi/rooms/${room.roomId}/start`)
            .set('Cookie', playerCookie) // ホストではない
            .send({
                targetLocation: { lat: 35.681236, lng: 139.767125 }
            });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('ホストのみがゲームを開始できます');
    });
});