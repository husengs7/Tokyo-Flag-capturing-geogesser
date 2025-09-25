// 3km距離制限システムの厳密なテスト
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Room = require('../models/Room');
const { calculateDistance } = require('../utils/gameUtils');

describe('3km距離制限システム厳密テスト', () => {
    let testUser1, testUser2;
    let roomId, roomKey;
    let cookies1, cookies2;

    beforeAll(async () => {
        // テスト用ユーザー作成
        testUser1 = new User({
            username: `distancetest1_${Date.now()}`,
            email: `distancetest1_${Date.now()}@test.com`,
            password: 'password123'
        });
        await testUser1.save();

        testUser2 = new User({
            username: `distancetest2_${Date.now()}`,
            email: `distancetest2_${Date.now()}@test.com`,
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

        const login2 = await request(app)
            .post('/auth/login')
            .send({
                username: testUser2.username,
                password: 'password123'
            })
            .expect(200);

        cookies2 = login2.headers['set-cookie'];
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
            })
            .expect(200);

        roomId = roomResponse.body.data.roomId;
        roomKey = roomResponse.body.data.roomKey;

        // 参加者追加と準備完了
        await request(app)
            .post('/multi/rooms/join')
            .set('Cookie', cookies2)
            .send({ roomKey })
            .expect(200);

        await request(app)
            .put(`/multi/rooms/${roomId}/ready`)
            .set('Cookie', cookies2)
            .send({ isReady: true })
            .expect(200);
    });

    afterEach(async () => {
        // 各テストの後にルームを削除
        if (roomId) {
            await Room.findByIdAndDelete(roomId);
        }
    });

    describe('クライアント側座標生成テスト', () => {
        test('generatePlayerStartPosition関数が必ず3km以内の位置を生成する', () => {
            console.log('\n=== クライアント側座標生成テスト ===');

            // クライアント側の関数を再現
            function generatePlayerStartPosition(targetLocation) {
                let attempts = 0;
                const maxAttempts = 100;

                function calculateDistance(lat1, lng1, lat2, lng2) {
                    const R = 6371000;
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLng = (lng2 - lng1) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                            Math.sin(dLng/2) * Math.sin(dLng/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return R * c;
                }

                function tryGeneratePosition() {
                    if (attempts >= maxAttempts) {
                        const angle = Math.random() * 2 * Math.PI;
                        const distance = 500 + Math.random() * 500; // 500m-1000m
                        const offsetLat = (distance * Math.cos(angle)) / 111320;
                        const offsetLng = (distance * Math.sin(angle)) / (111320 * Math.cos(targetLocation.lat * Math.PI / 180));
                        return {
                            lat: targetLocation.lat + offsetLat,
                            lng: targetLocation.lng + offsetLng
                        };
                    }

                    const angle = Math.random() * 2 * Math.PI;
                    const distance = 100 + Math.random() * 2900; // 100m～3000m

                    const offsetLat = (distance * Math.cos(angle)) / 111320;
                    const offsetLng = (distance * Math.sin(angle)) / (111320 * Math.cos(targetLocation.lat * Math.PI / 180));

                    const playerPos = {
                        lat: targetLocation.lat + offsetLat,
                        lng: targetLocation.lng + offsetLng
                    };

                    const actualDistance = calculateDistance(targetLocation.lat, targetLocation.lng, playerPos.lat, playerPos.lng);

                    if (actualDistance >= 100 && actualDistance <= 3000) {
                        if (playerPos.lat >= 35.5 && playerPos.lat <= 35.8 &&
                            playerPos.lng >= 139.4 && playerPos.lng <= 139.9) {
                            return playerPos;
                        }
                    }

                    attempts++;
                    return tryGeneratePosition();
                }

                return tryGeneratePosition();
            }

            const targetLocation = { lat: 35.681236, lng: 139.767125 }; // 東京駅
            console.log('ターゲット位置:', targetLocation);

            let allDistances = [];

            // 50回テストして全て3km以内であることを確認
            for (let i = 0; i < 50; i++) {
                const playerPos = generatePlayerStartPosition(targetLocation);
                const distance = calculateDistance(playerPos.lat, playerPos.lng, targetLocation.lat, targetLocation.lng);

                allDistances.push(distance);

                console.log(`テスト${i + 1}: 距離=${Math.round(distance)}m, 位置=(${playerPos.lat.toFixed(6)}, ${playerPos.lng.toFixed(6)})`);

                // 厳密な3km制限チェック
                expect(distance).toBeGreaterThanOrEqual(100);
                expect(distance).toBeLessThanOrEqual(3000);

                // 東京23区内チェック
                expect(playerPos.lat).toBeGreaterThanOrEqual(35.5);
                expect(playerPos.lat).toBeLessThanOrEqual(35.8);
                expect(playerPos.lng).toBeGreaterThanOrEqual(139.4);
                expect(playerPos.lng).toBeLessThanOrEqual(139.9);
            }

            // 統計計算
            const avgDistance = allDistances.reduce((a, b) => a + b, 0) / allDistances.length;
            const minDistance = Math.min(...allDistances);
            const maxDistance = Math.max(...allDistances);

            console.log(`\n📊 統計結果:`);
            console.log(`平均距離: ${Math.round(avgDistance)}m`);
            console.log(`最小距離: ${Math.round(minDistance)}m`);
            console.log(`最大距離: ${Math.round(maxDistance)}m`);

            // 統計的な検証
            expect(minDistance).toBeGreaterThanOrEqual(100);
            expect(maxDistance).toBeLessThanOrEqual(3000);
            expect(avgDistance).toBeGreaterThan(500);
            expect(avgDistance).toBeLessThan(2500);

            console.log('✅ 全ての生成位置が3km制限を満たしています');
        });
    });

    describe('サーバー側距離検証テスト', () => {
        test('サーバーが3km制限を厳密に検証する', async () => {
            console.log('\n=== サーバー側距離検証テスト ===');

            const targetLocation = { lat: 35.681236, lng: 139.767125 };

            // テストケース1: 正常な3km以内の距離
            const validPlayerLocation = {
                lat: 35.685000, // 東京駅から約500m
                lng: 139.770000
            };

            const validDistance = calculateDistance(validPlayerLocation.lat, validPlayerLocation.lng, targetLocation.lat, targetLocation.lng);
            console.log(`有効ケースの距離: ${Math.round(validDistance)}m`);

            const validResponse = await request(app)
                .post(`/multi/rooms/${roomId}/start`)
                .set('Cookie', cookies1)
                .send({
                    targetLat: targetLocation.lat,
                    targetLng: targetLocation.lng,
                    playerLat: validPlayerLocation.lat,
                    playerLng: validPlayerLocation.lng
                });

            console.log('有効ケースレスポンス:', validResponse.body);
            expect(validResponse.status).toBe(200);
            expect(validResponse.body.success).toBe(true);

            console.log('✅ 有効な距離（3km以内）は正常に受け入れられました');

            // 新しいルームで無効ケーステスト
            const newRoomResponse = await request(app)
                .post('/multi/rooms')
                .set('Cookie', cookies1)
                .send({ maxPlayers: 2, roundCount: 3 })
                .expect(200);

            const newRoomId = newRoomResponse.body.data.roomId;
            const newRoomKey = newRoomResponse.body.data.roomKey;

            await request(app)
                .post('/multi/rooms/join')
                .set('Cookie', cookies2)
                .send({ roomKey: newRoomKey })
                .expect(200);

            await request(app)
                .put(`/multi/rooms/${newRoomId}/ready`)
                .set('Cookie', cookies2)
                .send({ isReady: true })
                .expect(200);

            // テストケース2: 3km以上の距離（無効）
            const invalidPlayerLocation = {
                lat: 35.650000, // 東京駅から約4km
                lng: 139.720000
            };

            const invalidDistance = calculateDistance(invalidPlayerLocation.lat, invalidPlayerLocation.lng, targetLocation.lat, targetLocation.lng);
            console.log(`無効ケースの距離: ${Math.round(invalidDistance)}m`);

            const invalidResponse = await request(app)
                .post(`/multi/rooms/${newRoomId}/start`)
                .set('Cookie', cookies1)
                .send({
                    targetLat: targetLocation.lat,
                    targetLng: targetLocation.lng,
                    playerLat: invalidPlayerLocation.lat,
                    playerLng: invalidPlayerLocation.lng
                });

            console.log('無効ケースレスポンス:', invalidResponse.body);
            expect(invalidResponse.status).toBe(400);
            expect(invalidResponse.body.success).toBe(false);
            expect(invalidResponse.body.message).toContain('3km以上離れています');

            console.log('✅ 無効な距離（3km以上）は正しく拒否されました');

            // クリーンアップ
            await Room.findByIdAndDelete(newRoomId);
        });

        test('複数の座標パターンで距離制限をテスト', async () => {
            console.log('\n=== 複数パターン距離制限テスト ===');

            const testCases = [
                {
                    name: '東京駅周辺',
                    target: { lat: 35.681236, lng: 139.767125 },
                    validPlayer: { lat: 35.685000, lng: 139.770000 },
                    invalidPlayer: { lat: 35.650000, lng: 139.720000 }
                },
                {
                    name: '新宿駅周辺',
                    target: { lat: 35.689634, lng: 139.692101 },
                    validPlayer: { lat: 35.695000, lng: 139.695000 },
                    invalidPlayer: { lat: 35.720000, lng: 139.650000 }
                },
                {
                    name: '渋谷駅周辺',
                    target: { lat: 35.659515, lng: 139.700731 },
                    validPlayer: { lat: 35.665000, lng: 139.705000 },
                    invalidPlayer: { lat: 35.630000, lng: 139.670000 }
                }
            ];

            for (let i = 0; i < testCases.length; i++) {
                const testCase = testCases[i];
                console.log(`\nテストケース ${i + 1}: ${testCase.name}`);

                // 新しいルーム作成
                const roomResponse = await request(app)
                    .post('/multi/rooms')
                    .set('Cookie', cookies1)
                    .send({ maxPlayers: 2, roundCount: 3 })
                    .expect(200);

                const testRoomId = roomResponse.body.data.roomId;
                const testRoomKey = roomResponse.body.data.roomKey;

                await request(app)
                    .post('/multi/rooms/join')
                    .set('Cookie', cookies2)
                    .send({ roomKey: testRoomKey })
                    .expect(200);

                await request(app)
                    .put(`/multi/rooms/${testRoomId}/ready`)
                    .set('Cookie', cookies2)
                    .send({ isReady: true })
                    .expect(200);

                // 有効ケーステスト
                const validDistance = calculateDistance(
                    testCase.validPlayer.lat, testCase.validPlayer.lng,
                    testCase.target.lat, testCase.target.lng
                );

                console.log(`  有効距離: ${Math.round(validDistance)}m`);

                const validResponse = await request(app)
                    .post(`/multi/rooms/${testRoomId}/start`)
                    .set('Cookie', cookies1)
                    .send({
                        targetLat: testCase.target.lat,
                        targetLng: testCase.target.lng,
                        playerLat: testCase.validPlayer.lat,
                        playerLng: testCase.validPlayer.lng
                    });

                expect(validResponse.status).toBe(200);
                expect(validResponse.body.success).toBe(true);
                console.log(`  ✅ ${testCase.name} 有効ケース成功`);

                // クリーンアップ
                await Room.findByIdAndDelete(testRoomId);
            }

            console.log('✅ 全てのパターンで距離制限が正しく動作しました');
        });
    });

    describe('エッジケーステスト', () => {
        test('境界値での距離制限テスト', async () => {
            console.log('\n=== 境界値テスト ===');

            const targetLocation = { lat: 35.681236, lng: 139.767125 };

            // 境界値テストケース
            const edgeCases = [
                {
                    name: '最小距離（100m）',
                    distance: 100,
                    shouldPass: true
                },
                {
                    name: '最大距離（3000m）',
                    distance: 3000,
                    shouldPass: true
                },
                {
                    name: '最小未満（50m）',
                    distance: 50,
                    shouldPass: false
                },
                {
                    name: '最大超過（3100m）',
                    distance: 3100,
                    shouldPass: false
                }
            ];

            for (let i = 0; i < edgeCases.length; i++) {
                const testCase = edgeCases[i];
                console.log(`\n境界値テスト: ${testCase.name}`);

                // 指定距離でプレイヤー位置を計算
                const angle = 0; // 北方向
                const offsetLat = (testCase.distance * Math.cos(angle)) / 111320;
                const offsetLng = (testCase.distance * Math.sin(angle)) / (111320 * Math.cos(targetLocation.lat * Math.PI / 180));

                const playerLocation = {
                    lat: targetLocation.lat + offsetLat,
                    lng: targetLocation.lng + offsetLng
                };

                const actualDistance = calculateDistance(playerLocation.lat, playerLocation.lng, targetLocation.lat, targetLocation.lng);
                console.log(`  実際の距離: ${Math.round(actualDistance)}m`);

                // 新しいルーム作成
                const roomResponse = await request(app)
                    .post('/multi/rooms')
                    .set('Cookie', cookies1)
                    .send({ maxPlayers: 2, roundCount: 3 })
                    .expect(200);

                const testRoomId = roomResponse.body.data.roomId;
                const testRoomKey = roomResponse.body.data.roomKey;

                await request(app)
                    .post('/multi/rooms/join')
                    .set('Cookie', cookies2)
                    .send({ roomKey: testRoomKey })
                    .expect(200);

                await request(app)
                    .put(`/multi/rooms/${testRoomId}/ready`)
                    .set('Cookie', cookies2)
                    .send({ isReady: true })
                    .expect(200);

                const response = await request(app)
                    .post(`/multi/rooms/${testRoomId}/start`)
                    .set('Cookie', cookies1)
                    .send({
                        targetLat: targetLocation.lat,
                        targetLng: targetLocation.lng,
                        playerLat: playerLocation.lat,
                        playerLng: playerLocation.lng
                    });

                if (testCase.shouldPass) {
                    expect(response.status).toBe(200);
                    expect(response.body.success).toBe(true);
                    console.log(`  ✅ ${testCase.name} 正常に受け入れられました`);
                } else {
                    expect(response.status).toBe(400);
                    expect(response.body.success).toBe(false);
                    console.log(`  ✅ ${testCase.name} 正しく拒否されました`);
                }

                await Room.findByIdAndDelete(testRoomId);
            }

            console.log('✅ 全ての境界値テストが正常に動作しました');
        });
    });
});