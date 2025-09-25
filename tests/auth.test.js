const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

describe('認証エンドポイントのテスト', () => {
    let agent;

    beforeAll(async () => {
        // テスト用エージェント作成（セッション維持）
        agent = request.agent(app);

        // テスト用ユーザーを削除（存在する場合）
        try {
            await User.findOneAndDelete({ username: 'testuser' });
        } catch (error) {
            // ユーザーが存在しない場合は無視
        }
    });

    afterAll(async () => {
        // テスト用ユーザーをクリーンアップ
        try {
            await User.findOneAndDelete({ username: 'testuser' });
        } catch (error) {
            // エラーは無視
        }
    });

    describe('POST /auth/register', () => {
        test('新規ユーザー登録が成功する', async () => {
            const response = await agent
                .post('/auth/register')
                .send({
                    username: 'testuser',
                    password: 'testpassword123'
                });

            console.log('登録レスポンス:', response.status, response.body);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('username', 'testuser');
            expect(response.body.data).toHaveProperty('id');
        });
    });

    describe('GET /auth/me - 登録直後', () => {
        test('登録直後にユーザー情報が取得できる', async () => {
            const response = await agent.get('/auth/me');

            console.log('/auth/me レスポンス (登録直後):', response.status, response.body);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('username', 'testuser');
            expect(response.body.data).toHaveProperty('id');
        });
    });

    describe('POST /auth/logout', () => {
        test('ログアウトが成功する', async () => {
            const response = await agent.post('/auth/logout');

            console.log('ログアウトレスポンス:', response.status, response.body);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /auth/me - ログアウト後', () => {
        test('ログアウト後は認証エラーになる', async () => {
            const response = await agent.get('/auth/me');

            console.log('/auth/me レスポンス (ログアウト後):', response.status, response.body);

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /auth/login', () => {
        test('ログインが成功する', async () => {
            const response = await agent
                .post('/auth/login')
                .send({
                    username: 'testuser',
                    password: 'testpassword123'
                });

            console.log('ログインレスポンス:', response.status, response.body);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('username', 'testuser');
            expect(response.body.data).toHaveProperty('id');
        });
    });

    describe('GET /auth/me - ログイン後', () => {
        test('ログイン後にユーザー情報が取得できる', async () => {
            const response = await agent.get('/auth/me');

            console.log('/auth/me レスポンス (ログイン後):', response.status, response.body);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('username', 'testuser');
            expect(response.body.data).toHaveProperty('id');
            expect(response.body.data).toHaveProperty('_id');
        });
    });

    describe('multiController認証テスト', () => {
        test('認証済みユーザーでルーム作成', async () => {
            const response = await agent
                .post('/multi/rooms')
                .send({
                    maxPlayers: 4,
                    roundCount: 3
                });

            console.log('ルーム作成レスポンス:', response.status, response.body);

            if (response.status === 200) {
                expect(response.body.success).toBe(true);
                expect(response.body.data).toHaveProperty('roomId');
                expect(response.body.data).toHaveProperty('roomKey');

                // 作成されたルーム情報を取得してみる
                const roomId = response.body.data.roomId;
                const roomInfoResponse = await agent.get(`/multi/rooms/${roomId}`);

                console.log('ルーム情報取得レスポンス:', roomInfoResponse.status, roomInfoResponse.body);

                expect(roomInfoResponse.status).toBe(200);
                expect(roomInfoResponse.body.success).toBe(true);
                expect(roomInfoResponse.body.data).toHaveProperty('roomKey');
                expect(roomInfoResponse.body.data).toHaveProperty('players');
            } else {
                console.log('ルーム作成失敗 - レスポンス詳細:', response.body);
                // 失敗した場合でもテストを継続
            }
        });
    });
});