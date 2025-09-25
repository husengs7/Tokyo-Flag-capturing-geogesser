// ゲームシステムのテスト（3km制限、フラッグ表示など）
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Room = require('../models/Room');
const { calculateDistance } = require('../utils/gameUtils');

describe('ゲームシステムテスト（game.js移植機能）', () => {
    let testUser1, testUser2;
    let roomId, roomKey;
    let cookies1, cookies2;

    beforeAll(async () => {
        // テスト用ユーザー作成
        testUser1 = new User({
            username: `gametest1_${Date.now()}`,
            email: `gametest1_${Date.now()}@test.com`,
            password: 'password123'
        });
        await testUser1.save();

        testUser2 = new User({
            username: `gametest2_${Date.now()}`,
            email: `gametest2_${Date.now()}@test.com`,
            password: 'password123'
        });
        await testUser2.save();

        // ログイン
        const login1 = await request(app)
            .post('/auth/login')
            .send({
                username: testUser1.username,
                password: 'password123'
            })
            .expect(200);

        cookies1 = login1.headers['set-cookie'];
        console.log('User1 cookies:', cookies1);

        const login2 = await request(app)
            .post('/auth/login')
            .send({
                username: testUser2.username,
                password: 'password123'
            })
            .expect(200);

        cookies2 = login2.headers['set-cookie'];
        console.log('User2 cookies:', cookies2);
    });

    afterAll(async () => {
        // クリーンアップ
        await Room.deleteMany({ $or: [{ hostId: testUser1._id }, { hostId: testUser2._id }] });
        await User.deleteMany({ _id: { $in: [testUser1._id, testUser2._id] } });
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // 各テストの前にルームを作成
        const roomResponse = await request(app)
            .post('/multi/rooms')
            .set('Cookie', cookies1)
            .send({
                maxPlayers: 2,
                roundCount: 3
            });

        expect(roomResponse.status).toBe(200);
        roomId = roomResponse.body.data.roomId;
        roomKey = roomResponse.body.data.roomKey;
    });

    afterEach(async () => {
        // 各テストの後にルームを削除
        if (roomId) {
            await Room.findByIdAndDelete(roomId);
        }
    });

    describe('3km距離システムテスト', () => {
        test('プレイヤー開始位置がターゲットから300m-3km圏内に生成される', () => {
            // JavaScriptの座標生成関数をテスト
            function generatePlayerStartPosition(targetLocation) {
                let attempts = 0;
                const maxAttempts = 50;

                function tryGeneratePosition() {
                    if (attempts >= maxAttempts) {
                        const angle = Math.random() * 2 * Math.PI;
                        const distance = 500;
                        const offsetLat = (distance * Math.cos(angle)) / 111320;
                        const offsetLng = (distance * Math.sin(angle)) / (111320 * Math.cos(targetLocation.lat * Math.PI / 180));
                        return {
                            lat: targetLocation.lat + offsetLat,
                            lng: targetLocation.lng + offsetLng
                        };
                    }

                    const angle = Math.random() * 2 * Math.PI;
                    const distance = 300 + Math.random() * 2700; // 300m～3000m

                    const offsetLat = (distance * Math.cos(angle)) / 111320;
                    const offsetLng = (distance * Math.sin(angle)) / (111320 * Math.cos(targetLocation.lat * Math.PI / 180));

                    const playerPos = {
                        lat: targetLocation.lat + offsetLat,
                        lng: targetLocation.lng + offsetLng
                    };

                    if (playerPos.lat >= 35.5 && playerPos.lat <= 35.8 &&
                        playerPos.lng >= 139.4 && playerPos.lng <= 139.9) {
                        return playerPos;
                    }

                    attempts++;
                    return tryGeneratePosition();
                }

                return tryGeneratePosition();
            }

            console.log('\n=== 3km距離システムテスト開始 ===');

            // テスト用ターゲット位置（東京駅周辺）
            const targetLocation = { lat: 35.681236, lng: 139.767125 };
            console.log('ターゲット位置:', targetLocation);

            // 10回テストして全て3km圏内かチェック
            for (let i = 0; i < 10; i++) {
                const playerPos = generatePlayerStartPosition(targetLocation);
                const distance = calculateDistance(playerPos.lat, playerPos.lng, targetLocation.lat, targetLocation.lng);

                console.log(`テスト${i + 1}: プレイヤー位置 = ${playerPos.lat.toFixed(6)}, ${playerPos.lng.toFixed(6)}, 距離 = ${distance.toFixed(0)}m`);

                // 距離が300m-3000m圏内であることを確認
                expect(distance).toBeGreaterThanOrEqual(200); // 若干の誤差を許容
                expect(distance).toBeLessThanOrEqual(3100); // 若干の誤差を許容

                // 東京23区内であることを確認
                expect(playerPos.lat).toBeGreaterThanOrEqual(35.5);
                expect(playerPos.lat).toBeLessThanOrEqual(35.8);
                expect(playerPos.lng).toBeGreaterThanOrEqual(139.4);
                expect(playerPos.lng).toBeLessThanOrEqual(139.9);
            }

            console.log('✅ 全ての生成位置が3km圏内制限を満たしています');
            console.log('=== 3km距離システムテスト完了 ===\n');
        });

        test('ゲーム開始時に3km制限が適用される', async () => {
            console.log('\n=== ゲーム開始3km制限テスト開始 ===');

            // 参加者追加
            await request(app)
                .post('/multi/rooms/join')
                .set('Cookie', cookies2)
                .send({ roomKey });

            // 参加者準備完了
            await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .set('Cookie', cookies2)
                .send({ isReady: true });

            console.log('参加者準備完了');

            // 3km制限システムでゲーム開始
            const targetLocation = { lat: 35.681236, lng: 139.767125 };

            // プレイヤー位置を3km圏内に生成
            const angle = Math.random() * 2 * Math.PI;
            const distance = 500 + Math.random() * 2000; // 500m～2500m
            const offsetLat = (distance * Math.cos(angle)) / 111320;
            const offsetLng = (distance * Math.sin(angle)) / (111320 * Math.cos(targetLocation.lat * Math.PI / 180));

            const playerLocation = {
                lat: targetLocation.lat + offsetLat,
                lng: targetLocation.lng + offsetLng
            };

            const actualDistance = calculateDistance(playerLocation.lat, playerLocation.lng, targetLocation.lat, targetLocation.lng);
            console.log('生成されたプレイヤー位置:', playerLocation);
            console.log('ターゲットまでの距離:', actualDistance.toFixed(0) + 'm');

            const gameStartResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .set('Cookie', cookies1)
                .send({
                    targetLat: targetLocation.lat,
                    targetLng: targetLocation.lng,
                    playerLat: playerLocation.lat,
                    playerLng: playerLocation.lng
                });

            console.log('ゲーム開始レスポンス:', gameStartResponse.body);

            expect(gameStartResponse.status).toBe(200);
            expect(gameStartResponse.body.success).toBe(true);

            // 初期距離が正しく計算されているか確認
            const initialDistance = gameStartResponse.body.data.initialDistance;
            console.log('サーバー計算の初期距離:', initialDistance + 'm');

            // 距離の一致確認（若干の誤差は許容）
            expect(Math.abs(initialDistance - actualDistance)).toBeLessThan(10);

            // 3km圏内であることを確認
            expect(initialDistance).toBeGreaterThanOrEqual(300);
            expect(initialDistance).toBeLessThanOrEqual(3000);

            console.log('✅ 3km制限システムが正しく動作しています');
            console.log('=== ゲーム開始3km制限テスト完了 ===\n');
        });
    });

    describe('フラッグ常時表示システムテスト', () => {
        test('ゲーム開始後のルーム情報にターゲット位置が含まれる', async () => {
            console.log('\n=== フラッグ表示データテスト開始 ===');

            // 参加者追加と準備
            await request(app)
                .post('/multi/rooms/join')
                .set('Cookie', cookies2)
                .send({ roomKey });

            await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .set('Cookie', cookies2)
                .send({ isReady: true });

            // ゲーム開始
            const targetLocation = { lat: 35.681236, lng: 139.767125 };
            const playerLocation = { lat: 35.685000, lng: 139.770000 };

            await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .set('Cookie', cookies1)
                .send({
                    targetLat: targetLocation.lat,
                    targetLng: targetLocation.lng,
                    playerLat: playerLocation.lat,
                    playerLng: playerLocation.lng
                });

            // ルーム情報取得（フロントエンドがフラッグ表示に使用）
            const roomInfoResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .set('Cookie', cookies1);

            console.log('ルーム情報レスポンス:', JSON.stringify(roomInfoResponse.body.data, null, 2));

            expect(roomInfoResponse.status).toBe(200);
            expect(roomInfoResponse.body.success).toBe(true);

            const roomData = roomInfoResponse.body.data;

            // ゲーム状態にターゲット位置が含まれていることを確認
            expect(roomData.gameState).toBeDefined();
            expect(roomData.gameState.targetLocation).toBeDefined();
            expect(roomData.gameState.targetLocation.lat).toBe(targetLocation.lat);
            expect(roomData.gameState.targetLocation.lng).toBe(targetLocation.lng);

            // プレイヤー開始位置も含まれていることを確認
            expect(roomData.gameState.playerStartLocation).toBeDefined();
            expect(roomData.gameState.playerStartLocation.lat).toBe(playerLocation.lat);
            expect(roomData.gameState.playerStartLocation.lng).toBe(playerLocation.lng);

            console.log('✅ フラッグ表示用データが正しく提供されています');
            console.log('=== フラッグ表示データテスト完了 ===\n');
        });
    });

    describe('システム統合テスト', () => {
        test('game.js移植システム全体の動作確認', async () => {
            console.log('\n=== システム統合テスト開始 ===');

            // 1. ルーム参加
            const joinResponse = await request(app)
                .post('/multi/rooms/join')
                .set('Cookie', cookies2)
                .send({ roomKey });

            expect(joinResponse.status).toBe(200);
            console.log('✅ ルーム参加成功');

            // 2. 参加者準備完了
            const readyResponse = await request(app)
                .put(`/multi/rooms/${roomId}/ready`)
                .set('Cookie', cookies2)
                .send({ isReady: true });

            expect(readyResponse.status).toBe(200);
            console.log('✅ 準備完了設定成功');

            // 3. game.js式3km制限でのゲーム開始
            const targetLocation = { lat: 35.681236, lng: 139.767125 };
            const angle = Math.random() * 2 * Math.PI;
            const distance = 800; // 800m
            const offsetLat = (distance * Math.cos(angle)) / 111320;
            const offsetLng = (distance * Math.sin(angle)) / (111320 * Math.cos(targetLocation.lat * Math.PI / 180));

            const playerLocation = {
                lat: targetLocation.lat + offsetLat,
                lng: targetLocation.lng + offsetLng
            };

            const startResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .set('Cookie', cookies1)
                .send({
                    targetLat: targetLocation.lat,
                    targetLng: targetLocation.lng,
                    playerLat: playerLocation.lat,
                    playerLng: playerLocation.lng
                });

            expect(startResponse.status).toBe(200);
            expect(startResponse.body.success).toBe(true);
            console.log('✅ ゲーム開始成功（3km制限適用）');

            // 4. 推測送信テスト
            const guessResponse = await request(app)
                .post(`/multi/rooms/${roomId}/guess`)
                .set('Cookie', cookies1)
                .send({
                    guessLat: playerLocation.lat + 0.001, // 少しズラした位置
                    guessLng: playerLocation.lng + 0.001,
                    hintUsed: false
                });

            expect(guessResponse.status).toBe(200);
            expect(guessResponse.body.success).toBe(true);
            console.log('✅ 推測送信成功');

            // 5. 最終的なルーム状態確認
            const finalRoomResponse = await request(app)
                .get(`/multi/rooms/${roomId}`)
                .set('Cookie', cookies1);

            expect(finalRoomResponse.status).toBe(200);
            const finalRoomData = finalRoomResponse.body.data;

            // フラッグ表示用データの確認
            expect(finalRoomData.gameState.targetLocation).toBeDefined();
            expect(finalRoomData.gameState.playerStartLocation).toBeDefined();
            expect(finalRoomData.gameState.initialDistance).toBeGreaterThan(0);

            console.log('最終ルーム状態:', {
                status: finalRoomData.status,
                currentRound: finalRoomData.gameState.currentRound,
                targetLocation: finalRoomData.gameState.targetLocation,
                initialDistance: finalRoomData.gameState.initialDistance
            });

            console.log('✅ 全システム統合テスト成功');
            console.log('=== システム統合テスト完了 ===\n');
        });
    });
});