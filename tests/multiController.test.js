const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const session = require('express-session');
const passport = require('passport');

// モデルとコントローラーのインポート
const User = require('../models/User');
const Room = require('../models/Room');
const multiController = require('../controllers/multiController');
const { requireAuth } = require('../middleware/auth');

describe('MultiController', () => {
    let mongoServer;
    let app;
    let user;

    beforeAll(async () => {
        // MongoDB Memory Serverを起動
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();

        // Mongooseに接続
        await mongoose.connect(mongoUri);

        // Expressアプリケーションの設定
        app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // セッション設定
        app.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false,
            cookie: { secure: false }
        }));

        // Passport設定（簡易版）
        passport.use(User.createStrategy());
        passport.serializeUser(User.serializeUser());
        passport.deserializeUser(User.deserializeUser());

        app.use(passport.initialize());
        app.use(passport.session());

        // 認証ミドルウェア
        const testAuth = (req, res, next) => {
            req.user = user;
            req.isAuthenticated = () => true;
            next();
        };

        // テスト用ルーティング
        app.post('/multi/rooms', testAuth, multiController.createRoom);
        app.post('/multi/rooms/join', testAuth, multiController.joinRoom);
        app.get('/multi/rooms/:roomId', testAuth, multiController.getRoomInfo);
        app.put('/multi/rooms/:roomId/ready', testAuth, multiController.setPlayerReady);
        app.post('/multi/rooms/:roomId/start', testAuth, multiController.startGame);
    });

    beforeEach(async () => {
        // テスト用ユーザー作成
        await User.deleteMany({});
        await Room.deleteMany({});

        user = new User({
            username: 'testuser',
            soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
            multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
        });
        await user.save();
    });

    afterEach(async () => {
        // テストデータクリーンアップ
        await User.deleteMany({});
        await Room.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    describe('POST /multi/rooms (createRoom)', () => {
        test('正常なルーム作成', async () => {
            const response = await request(app)
                .post('/multi/rooms')
                .send({
                    maxPlayers: 4,
                    roundCount: 3
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('roomId');
            expect(response.body.data).toHaveProperty('roomKey');
            expect(response.body.data.settings.maxPlayers).toBe(4);
            expect(response.body.data.settings.roundCount).toBe(3);
            expect(response.body.data.players).toHaveLength(1);
            expect(response.body.data.players[0].username).toBe('testuser');
            expect(response.body.data.players[0].isHost).toBe(true);
        });

        test('デフォルト値でのルーム作成', async () => {
            const response = await request(app)
                .post('/multi/rooms')
                .send({})
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.settings.maxPlayers).toBe(4);
            expect(response.body.data.settings.roundCount).toBe(3);
        });

        test('無効な値でのルーム作成（最大プレイヤー数）', async () => {
            const response = await request(app)
                .post('/multi/rooms')
                .send({
                    maxPlayers: 10, // 最大4人を超える
                    roundCount: 3
                })
                .expect(500);

            expect(response.body.success).toBe(false);
        });

        test('無効な値でのルーム作成（ラウンド数）', async () => {
            const response = await request(app)
                .post('/multi/rooms')
                .send({
                    maxPlayers: 4,
                    roundCount: 10 // 最大5ラウンドを超える
                })
                .expect(500);

            expect(response.body.success).toBe(false);
        });

        test('ルームキーの一意性確認', async () => {
            const response1 = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 2, roundCount: 1 })
                .expect(200);

            // 別のユーザーを作成して2番目のルームを作成
            const user2 = new User({
                username: 'testuser2',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await user2.save();

            // user2として2番目のルームを作成
            user = user2;

            const response2 = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 3, roundCount: 2 })
                .expect(200);

            expect(response1.body.data.roomKey).not.toBe(response2.body.data.roomKey);
        });

        test('同一ユーザーが複数ルーム作成（古いルームは自動退出）', async () => {
            // 最初のルーム作成
            const response1 = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 2, roundCount: 1 })
                .expect(200);

            const firstRoomKey = response1.body.data.roomKey;

            // 同じユーザーで2番目のルーム作成（古いルームから自動退出される）
            const response2 = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 3, roundCount: 2 })
                .expect(200);

            const secondRoomKey = response2.body.data.roomKey;

            // ルームキーが異なることを確認
            expect(firstRoomKey).not.toBe(secondRoomKey);

            // 最初のルームが削除されているか確認
            const rooms = await Room.find({ roomKey: firstRoomKey });
            expect(rooms).toHaveLength(0);

            // 2番目のルームは存在することを確認
            const secondRoom = await Room.findOne({ roomKey: secondRoomKey });
            expect(secondRoom).toBeTruthy();
            expect(secondRoom.players).toHaveLength(1);
        });
    });

    describe('POST /multi/rooms/join (joinRoom)', () => {
        let roomKey;
        let roomId;

        beforeEach(async () => {
            // テスト用ルーム作成
            const createResponse = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 4, roundCount: 3 })
                .expect(200);

            roomKey = createResponse.body.data.roomKey;
            roomId = createResponse.body.data.roomId;
        });

        test('正常なルーム参加', async () => {
            // 別のユーザーを作成
            const user2 = new User({
                username: 'testuser2',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await user2.save();

            // user2として参加
            user = user2;

            const response = await request(app)
                .post('/multi/rooms/join')
                .send({ roomKey: roomKey })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.roomId).toBe(roomId);
            expect(response.body.data.players).toHaveLength(2);
        });

        test('複数ルーム参加時の自動退出機能', async () => {
            // user1で最初のルーム作成
            const response1 = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 2, roundCount: 1 })
                .expect(200);

            const firstRoomKey = response1.body.data.roomKey;

            // 別のユーザーでもう一つルーム作成
            const user2 = new User({
                username: 'testuser2',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await user2.save();

            user = user2;

            const response2 = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 2, roundCount: 1 })
                .expect(200);

            const secondRoomKey = response2.body.data.roomKey;

            // user1が2番目のルームに参加（1番目のルームから自動退出される）
            user = await User.findOne({ username: 'testuser' });

            const joinResponse = await request(app)
                .post('/multi/rooms/join')
                .send({ roomKey: secondRoomKey })
                .expect(200);

            expect(joinResponse.body.success).toBe(true);
            expect(joinResponse.body.data.players).toHaveLength(2);

            // 最初のルームにuser1がいないことを確認
            const firstRoom = await Room.findOne({ roomKey: firstRoomKey });
            if (firstRoom) {
                const hasUser1 = firstRoom.players.some(p => p.userId.toString() === user._id.toString());
                expect(hasUser1).toBe(false);
            }
        });

        test('存在しないルームキーでの参加', async () => {
            const response = await request(app)
                .post('/multi/rooms/join')
                .send({ roomKey: 'ABCD12' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('ルームが見つかりません');
        });

        test('無効なルームキー形式', async () => {
            const response = await request(app)
                .post('/multi/rooms/join')
                .send({ roomKey: '123' }) // 6桁未満
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /multi/rooms/:roomId (getRoomInfo)', () => {
        let roomId;

        beforeEach(async () => {
            const createResponse = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 4, roundCount: 3 })
                .expect(200);

            roomId = createResponse.body.data.roomId;
        });

        test('正常なルーム情報取得', async () => {
            const response = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.roomId).toBe(roomId);
            expect(response.body.data.players).toHaveLength(1);
        });

        test('存在しないルームIDでの情報取得', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/multi/rooms/${fakeId}`)
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('ゲーム開始フローテスト', () => {
        let hostUser, participantUser;
        let roomId, roomKey;

        beforeEach(async () => {
            // ホストユーザー作成
            hostUser = new User({
                username: 'host',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await hostUser.save();

            // 参加者ユーザー作成
            participantUser = new User({
                username: 'participant',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await participantUser.save();

            // ホストでルーム作成
            user = hostUser;
            const createResponse = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 2, roundCount: 3 })
                .expect(200);

            roomId = createResponse.body.data.roomId;
            roomKey = createResponse.body.data.roomKey;

            // 参加者をルームに参加させる
            user = participantUser;
            await request(app)
                .post('/multi/rooms/join')
                .send({ roomKey: roomKey })
                .expect(200);
        });

        test('参加者の準備完了状態設定', async () => {
            // 参加者として準備完了にする
            user = participantUser;

            const response = await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.isReady).toBe(true);

            // ルーム情報確認
            const roomInfoResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            const participantPlayer = roomInfoResponse.body.data.players.find(p =>
                p.username === 'participant'
            );
            expect(participantPlayer.isReady).toBe(true);
        });

        test('ホストによるゲーム開始（全員準備完了時）', async () => {
            // 参加者を準備完了状態にする
            user = participantUser;
            await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            // ホストとしてゲーム開始
            user = hostUser;
            const gameStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send({
                    targetLat: 35.6762,
                    targetLng: 139.6503,
                    playerLat: 35.6762,
                    playerLng: 139.6503
                })
                .expect(200);

            console.log('ゲーム開始レスポンス:', gameStartResponse.body);

            expect(gameStartResponse.body.success).toBe(true);
            expect(gameStartResponse.body.data).toHaveProperty('gameState');
            expect(gameStartResponse.body.data).toHaveProperty('currentRound', 1);

            // ルーム状態確認 - 参加者の視点から
            user = participantUser;
            const roomInfoResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            console.log('ゲーム開始後のルーム情報:', roomInfoResponse.body);

            expect(roomInfoResponse.body.success).toBe(true);
            expect(roomInfoResponse.body.data.status).toBe('playing');
        });

        test('ゲーム開始時の参加者への信号送信テスト', async () => {
            // 参加者を準備完了状態にする
            user = participantUser;
            await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            // ホストとしてゲーム開始
            user = hostUser;
            const gameStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send({
                    targetLat: 35.6762,
                    targetLng: 139.6503,
                    playerLat: 35.6762,
                    playerLng: 139.6503
                })
                .expect(200);

            // ホストの視点: ゲーム開始成功を確認
            expect(gameStartResponse.body.success).toBe(true);
            expect(gameStartResponse.body.data.status).toBe('playing');

            // 参加者の視点: ポーリングでゲーム開始を検知できることを確認
            user = participantUser;
            const participantRoomInfoResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            expect(participantRoomInfoResponse.body.success).toBe(true);
            expect(participantRoomInfoResponse.body.data.status).toBe('playing');
            expect(participantRoomInfoResponse.body.data).toHaveProperty('gameState');

            console.log('参加者から見たゲーム開始後のルーム状態:', {
                status: participantRoomInfoResponse.body.data.status,
                hasGameState: !!participantRoomInfoResponse.body.data.gameState,
                currentRound: participantRoomInfoResponse.body.data.gameState?.currentRound
            });
        });

        test('準備未完了時のゲーム開始失敗', async () => {
            // 参加者が準備未完了のままゲーム開始を試行
            user = hostUser;

            const gameStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send({
                    targetLat: 35.6762,
                    targetLng: 139.6503,
                    playerLat: 35.6762,
                    playerLng: 139.6503
                })
                .expect(400);

            expect(gameStartResponse.body.success).toBe(false);
            expect(gameStartResponse.body.message).toContain('準備');
        });

        test('非ホストによるゲーム開始試行（権限エラー）', async () => {
            // 参加者を準備完了状態にする
            user = participantUser;
            await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            // 参加者（非ホスト）としてゲーム開始を試行
            const gameStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send({
                    targetLat: 35.6762,
                    targetLng: 139.6503,
                    playerLat: 35.6762,
                    playerLng: 139.6503
                })
                .expect(400);

            expect(gameStartResponse.body.success).toBe(false);
            expect(gameStartResponse.body.message).toContain('ホスト');
        });

        test('無効な座標でのゲーム開始', async () => {
            // 参加者を準備完了状態にする
            user = participantUser;
            await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            // ホストとして無効な座標でゲーム開始
            user = hostUser;
            const gameStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send({
                    targetLat: 999, // 無効な緯度
                    targetLng: 999, // 無効な経度
                    playerLat: 35.6762,
                    playerLng: 139.6503
                })
                .expect(400);

            expect(gameStartResponse.body.success).toBe(false);
            expect(gameStartResponse.body.message).toContain('無効な座標');
        });
    });

    describe('準備状態詳細デバッグテスト', () => {
        let hostUser, participantUser;
        let roomId, roomKey;

        beforeEach(async () => {
            // ホストユーザー作成
            hostUser = new User({
                username: 'debughost',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await hostUser.save();

            // 参加者ユーザー作成
            participantUser = new User({
                username: 'debugparticipant',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await participantUser.save();

            // ホストでルーム作成
            user = hostUser;
            const createResponse = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 2, roundCount: 3 })
                .expect(200);

            roomId = createResponse.body.data.roomId;
            roomKey = createResponse.body.data.roomKey;

            console.log('デバッグテスト - ルーム作成完了:', { roomId, roomKey });

            // 参加者をルームに参加させる
            user = participantUser;
            const joinResponse = await request(app)
                .post('/multi/rooms/join')
                .send({ roomKey: roomKey })
                .expect(200);

            console.log('デバッグテスト - ルーム参加完了:', joinResponse.body);
        });

        test('参加者の準備状態変更とホストから見たルーム情報の同期', async () => {
            console.log('\n=== 準備状態変更デバッグテスト開始 ===');

            // 1. 初期状態確認（ホストの視点）
            user = hostUser;
            let hostViewResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            console.log('1. ホスト視点の初期ルーム状態:', JSON.stringify(hostViewResponse.body, null, 2));

            expect(hostViewResponse.body.success).toBe(true);
            expect(hostViewResponse.body.data.players).toHaveLength(2);

            const initialParticipant = hostViewResponse.body.data.players.find(p => p.username === 'debugparticipant');
            expect(initialParticipant).toBeTruthy();
            expect(initialParticipant.isReady).toBe(false);

            // 2. 参加者として準備完了に設定
            user = participantUser;
            console.log('\n2. 参加者の準備完了操作を実行...');

            const readyResponse = await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            console.log('準備完了レスポンス:', JSON.stringify(readyResponse.body, null, 2));

            expect(readyResponse.body.success).toBe(true);
            expect(readyResponse.body.data.isReady).toBe(true);

            // 3. 参加者視点でルーム情報確認
            console.log('\n3. 参加者視点でルーム情報確認...');

            const participantViewResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            console.log('参加者視点のルーム状態:', JSON.stringify(participantViewResponse.body, null, 2));

            const participantSelfView = participantViewResponse.body.data.players.find(p => p.username === 'debugparticipant');
            expect(participantSelfView.isReady).toBe(true);

            // 4. ホスト視点で更新後のルーム情報確認（ここでネットワークエラーが発生する可能性）
            user = hostUser;
            console.log('\n4. ホスト視点で更新後のルーム情報確認...');

            const hostViewAfterResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            console.log('ホスト視点の更新後ルーム状態:', JSON.stringify(hostViewAfterResponse.body, null, 2));

            expect(hostViewAfterResponse.body.success).toBe(true);

            const updatedParticipant = hostViewAfterResponse.body.data.players.find(p => p.username === 'debugparticipant');
            expect(updatedParticipant).toBeTruthy();
            expect(updatedParticipant.isReady).toBe(true);

            console.log('=== 準備状態変更デバッグテスト完了 ===\n');
        });

        test('準備状態の切り替え（ON→OFF→ON）', async () => {
            console.log('\n=== 準備状態切り替えテスト開始 ===');

            user = participantUser;

            // 準備完了に設定
            console.log('1. 準備完了に設定...');
            let response1 = await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            expect(response1.body.success).toBe(true);
            expect(response1.body.data.isReady).toBe(true);

            // 準備解除に設定
            console.log('2. 準備解除に設定...');
            let response2 = await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: false })
                .expect(200);

            expect(response2.body.success).toBe(true);
            expect(response2.body.data.isReady).toBe(false);

            // 再度準備完了に設定
            console.log('3. 再度準備完了に設定...');
            let response3 = await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            expect(response3.body.success).toBe(true);
            expect(response3.body.data.isReady).toBe(true);

            // 最終状態確認
            console.log('4. 最終状態確認...');
            const finalCheck = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            console.log('最終ルーム状態:', JSON.stringify(finalCheck.body, null, 2));

            const participant = finalCheck.body.data.players.find(p => p.username === 'debugparticipant');
            expect(participant.isReady).toBe(true);

            console.log('=== 準備状態切り替えテスト完了 ===\n');
        });

        test('存在しないルームでの準備状態設定', async () => {
            user = participantUser;

            const fakeRoomId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .put(`/multi/rooms/${fakeRoomId}/ready`)
                .send({ isReady: true })
                .expect(404);

            expect(response.body.success).toBe(false);
            console.log('存在しないルームでのエラーレスポンス:', response.body);
        });

        test('無効なisReadyパラメータでの準備状態設定', async () => {
            user = participantUser;

            // 文字列を送信
            const response1 = await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: 'invalid' });

            console.log('無効なパラメータでのレスポンス1:', response1.status, response1.body);

            // undefinedを送信（デフォルト値のテスト）
            const response2 = await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({});

            console.log('空パラメータでのレスポンス2:', response2.status, response2.body);
        });

        test('連続した準備状態変更でのレースコンディション対策', async () => {
            console.log('\n=== レースコンディションテスト開始 ===');

            user = participantUser;

            // 同時に複数の準備状態変更を送信
            const promises = [
                request(app).put(`/multi/rooms/${roomId}/ready`).send({ isReady: true }),
                request(app).put(`/multi/rooms/${roomId}/ready`).send({ isReady: false }),
                request(app).put(`/multi/rooms/${roomId}/ready`).send({ isReady: true })
            ];

            const responses = await Promise.all(promises);

            console.log('連続リクエストの結果:', responses.map(r => ({
                status: r.status,
                success: r.body.success,
                isReady: r.body.data?.isReady
            })));

            // 最終状態を確認
            const finalCheck = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            console.log('レースコンディション後の最終状態:', finalCheck.body.data.players.find(p => p.username === 'debugparticipant'));

            // 全てのリクエストが成功することを確認
            responses.forEach((response, index) => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                console.log(`Request ${index + 1}: isReady = ${response.body.data.isReady}`);
            });

            console.log('=== レースコンディションテスト完了 ===\n');
        });
    });

    describe('ホストのゲームスタート詳細デバッグテスト', () => {
        let hostUser, participantUser;
        let roomId, roomKey;

        beforeEach(async () => {
            // ホストユーザー作成
            hostUser = new User({
                username: 'gamestarthost',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await hostUser.save();

            // 参加者ユーザー作成
            participantUser = new User({
                username: 'gamestartparticipant',
                soloStats: { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: { totalScore: 0, playCount: 0, bestScore: 0 }
            });
            await participantUser.save();

            // ホストでルーム作成
            user = hostUser;
            const createResponse = await request(app)
                .post('/multi/rooms')
                .send({ maxPlayers: 2, roundCount: 3 })
                .expect(200);

            roomId = createResponse.body.data.roomId;
            roomKey = createResponse.body.data.roomKey;

            console.log('ゲームスタートテスト - ルーム作成完了:', { roomId, roomKey });

            // 参加者をルームに参加させる
            user = participantUser;
            await request(app)
                .post('/multi/rooms/join')
                .send({ roomKey: roomKey })
                .expect(200);

            console.log('ゲームスタートテスト - ルーム参加完了');

            // 参加者を準備完了状態にする
            await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: true })
                .expect(200);

            console.log('ゲームスタートテスト - 参加者準備完了');
        });

        test('ホストのゲームスタート処理の詳細デバッグ', async () => {
            console.log('\n=== ホストのゲームスタート詳細デバッグ開始 ===');

            user = hostUser;

            // 1. ゲームスタート前のルーム状態確認
            console.log('1. ゲームスタート前のルーム状態確認...');
            const preStartResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            console.log('ゲームスタート前のルーム状態:', {
                status: preStartResponse.body.data.status,
                players: preStartResponse.body.data.players.map(p => ({
                    username: p.username,
                    isReady: p.isReady,
                    isHost: p.isHost
                }))
            });

            expect(preStartResponse.body.data.status).toBe('waiting');
            const allReady = preStartResponse.body.data.players.every(p => p.isHost || p.isReady);
            expect(allReady).toBe(true);

            // 2. ゲームスタートAPIを呼び出し
            console.log('2. ゲームスタートAPIを呼び出し...');

            const gameStartPayload = {
                targetLat: 35.6762, // 東京駅
                targetLng: 139.6503,
                playerLat: 35.6586, // 新宿駅
                playerLng: 139.7454
            };

            console.log('ゲームスタートペイロード:', gameStartPayload);

            const gameStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send(gameStartPayload);

            console.log('ゲームスタートレスポンス:', {
                status: gameStartResponse.status,
                success: gameStartResponse.body?.success,
                message: gameStartResponse.body?.message,
                hasGameState: !!gameStartResponse.body?.data?.gameState
            });

            // レスポンスの詳細確認
            if (!gameStartResponse.body?.success) {
                console.error('ゲームスタート失敗の詳細:', gameStartResponse.body);
            }

            expect(gameStartResponse.status).toBe(200);
            expect(gameStartResponse.body.success).toBe(true);
            expect(gameStartResponse.body.data).toHaveProperty('gameState');
            expect(gameStartResponse.body.data).toHaveProperty('currentRound', 1);

            // 3. ゲームスタート後のルーム状態確認
            console.log('3. ゲームスタート後のルーム状態確認...');
            const postStartResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .expect(200);

            console.log('ゲームスタート後のルーム状態:', {
                status: postStartResponse.body.data.status,
                hasGameState: !!postStartResponse.body.data.gameState,
                currentRound: postStartResponse.body.data.gameState?.currentRound
            });

            expect(postStartResponse.body.data.status).toBe('playing');
            expect(postStartResponse.body.data.gameState).toBeTruthy();
            expect(postStartResponse.body.data.gameState.currentRound).toBe(1);

            console.log('=== ホストのゲームスタート詳細デバッグ完了 ===\n');
        });

        test('無効な座標でのゲームスタート', async () => {
            console.log('\n=== 無効な座標でのゲームスタートテスト ===');

            user = hostUser;

            const invalidPayloads = [
                { name: '緯度が範囲外', payload: { targetLat: 999, targetLng: 139.6503, playerLat: 35.6586, playerLng: 139.7454 } },
                { name: '経度が範囲外', payload: { targetLat: 35.6762, targetLng: 999, playerLat: 35.6586, playerLng: 139.7454 } },
                { name: 'プレイヤー緯度が範囲外', payload: { targetLat: 35.6762, targetLng: 139.6503, playerLat: 999, playerLng: 139.7454 } },
                { name: 'プレイヤー経度が範囲外', payload: { targetLat: 35.6762, targetLng: 139.6503, playerLat: 35.6586, playerLng: 999 } }
            ];

            for (const test of invalidPayloads) {
                console.log(`${test.name}のテスト:`, test.payload);

                const response = await request(app)
                    .post(`/multi/rooms/${roomId}/start`)
                    .send(test.payload);

                console.log(`${test.name}の結果:`, { status: response.status, success: response.body?.success, message: response.body?.message });

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
                expect(response.body.message).toContain('無効な座標');
            }

            console.log('=== 無効な座標テスト完了 ===\n');
        });

        test('参加者が準備未完了時のゲームスタート', async () => {
            console.log('\n=== 参加者準備未完了時のゲームスタートテスト ===');

            // 参加者の準備状態を解除
            user = participantUser;
            await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .send({ isReady: false })
                .expect(200);

            console.log('参加者の準備状態を解除しました');

            // ホストがゲームスタートを試行
            user = hostUser;
            const gameStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send({
                    targetLat: 35.6762,
                    targetLng: 139.6503,
                    playerLat: 35.6586,
                    playerLng: 139.7454
                });

            console.log('準備未完了時のゲームスタート結果:', {
                status: gameStartResponse.status,
                success: gameStartResponse.body?.success,
                message: gameStartResponse.body?.message
            });

            expect(gameStartResponse.status).toBe(400);
            expect(gameStartResponse.body.success).toBe(false);
            expect(gameStartResponse.body.message).toContain('準備');

            console.log('=== 参加者準備未完了テスト完了 ===\n');
        });

        test('必須パラメータ欠如時のゲームスタート', async () => {
            console.log('\n=== 必須パラメータ欠如時のゲームスタートテスト ===');

            user = hostUser;

            const incompletePayloads = [
                { name: 'targetLat欠如', payload: { targetLng: 139.6503, playerLat: 35.6586, playerLng: 139.7454 } },
                { name: 'targetLng欠如', payload: { targetLat: 35.6762, playerLat: 35.6586, playerLng: 139.7454 } },
                { name: 'playerLat欠如', payload: { targetLat: 35.6762, targetLng: 139.6503, playerLng: 139.7454 } },
                { name: 'playerLng欠如', payload: { targetLat: 35.6762, targetLng: 139.6503, playerLat: 35.6586 } },
                { name: '全パラメータ欠如', payload: {} }
            ];

            for (const test of incompletePayloads) {
                console.log(`${test.name}のテスト:`, test.payload);

                const response = await request(app)
                    .post(`/multi/rooms/${roomId}/start`)
                    .send(test.payload);

                console.log(`${test.name}の結果:`, { status: response.status, success: response.body?.success, message: response.body?.message });

                expect(response.status).toBe(400);
                expect(response.body.success).toBe(false);
            }

            console.log('=== 必須パラメータ欠如テスト完了 ===\n');
        });

        test('ゲーム開始後の重複スタート防止', async () => {
            console.log('\n=== ゲーム開始後の重複スタート防止テスト ===');

            user = hostUser;

            // 最初のゲームスタート
            console.log('1回目のゲームスタート...');
            const firstStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send({
                    targetLat: 35.6762,
                    targetLng: 139.6503,
                    playerLat: 35.6586,
                    playerLng: 139.7454
                })
                .expect(200);

            expect(firstStartResponse.body.success).toBe(true);
            console.log('1回目のゲームスタート成功');

            // 2回目のゲームスタート（重複）
            console.log('2回目のゲームスタート（重複）...');
            const secondStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .send({
                    targetLat: 35.6762,
                    targetLng: 139.6503,
                    playerLat: 35.6586,
                    playerLng: 139.7454
                });

            console.log('2回目のゲームスタート結果:', {
                status: secondStartResponse.status,
                success: secondStartResponse.body?.success,
                message: secondStartResponse.body?.message
            });

            expect(secondStartResponse.status).toBe(400);
            expect(secondStartResponse.body.success).toBe(false);
            expect(secondStartResponse.body.message).toContain('ゲーム開始できない状態');

            console.log('=== 重複スタート防止テスト完了 ===\n');
        });
    });
});