// 🔐 認証コントローラーのテスト
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const passport = require('passport');

// テスト対象とモデル
const authController = require('../controllers/authController');
const User = require('../models/User');

// passportの設定
require('../config/passport');

// Express アプリケーションのセットアップ
const app = express();

// ミドルウェアの設定
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// セッションの設定
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: false
}));

// Passportの初期化
app.use(passport.initialize());
app.use(passport.session());

// テスト用ルート
app.post('/auth/register', authController.register);
app.post('/auth/login', authController.login);
app.post('/auth/logout', authController.logout);
app.get('/auth/me', authController.getMe);

describe('認証コントローラーのテスト', () => {
  let mongoServer;
  let agent;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // SuperTest agentを作成してセッションを維持
    agent = request.agent(app);
  }, 60000);

  beforeEach(async () => {
    // データベースクリーンアップ
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('POST /auth/register', () => {
    test('新しいユーザーを正常に登録できる', async () => {
      const userData = {
        username: 'testuser',
        password: 'password123'
      };

      const response = await agent
        .post('/auth/register')
        .send(userData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ユーザー登録が完了しました');
      expect(response.body.data.username).toBe(userData.username);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.soloStats).toBeDefined();
      expect(response.body.data.multiStats).toBeDefined();
      expect(response.body.data.password).toBeUndefined(); // パスワードは含まれないことを確認

      // データベースにユーザーが作成されているか確認
      const createdUser = await User.findOne({ username: userData.username });
      expect(createdUser).toBeDefined();
      expect(createdUser.username).toBe(userData.username);
    });

    test('登録後に自動ログインされる', async () => {
      const userData = {
        username: 'autoLoginUser',
        password: 'password123'
      };

      // ユーザー登録
      await agent
        .post('/auth/register')
        .send(userData)
        .expect(200);

      // /auth/me にアクセスしてログイン状態を確認
      const meResponse = await agent
        .get('/auth/me')
        .expect(200);

      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data.username).toBe(userData.username);
    });

    test('必須フィールドが不足している場合はエラー', async () => {
      const incompleteData = { username: 'testuser' }; // パスワードなし

      const response = await agent
        .post('/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ユーザー名とパスワードは必須です');
    });

    test('重複するユーザー名での登録はエラー', async () => {
      const userData = {
        username: 'duplicateuser',
        password: 'password123'
      };

      // 最初のユーザーを登録
      await agent
        .post('/auth/register')
        .send(userData)
        .expect(200);

      // 同じユーザー名で再度登録を試行
      const response = await agent
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('そのユーザー名は既に使用されています');
    });

    test('空のユーザー名での登録はエラー', async () => {
      const userData = {
        username: '',
        password: 'password123'
      };

      const response = await agent
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('空のパスワードでの登録はエラー', async () => {
      const userData = {
        username: 'testuser',
        password: ''
      };

      const response = await agent
        .post('/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    let testUser;

    beforeEach(async () => {
      // テスト用ユーザーを事前に作成
      testUser = new User({ username: 'loginuser' });
      await User.register(testUser, 'password123');
    });

    test('正しい認証情報でログインできる', async () => {
      const loginData = {
        username: 'loginuser',
        password: 'password123'
      };

      const response = await agent
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ログイン成功');
      expect(response.body.data.username).toBe(loginData.username);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.soloStats).toBeDefined();
      expect(response.body.data.multiStats).toBeDefined();
    });

    test('間違ったパスワードでのログインはエラー', async () => {
      const loginData = {
        username: 'loginuser',
        password: 'wrongpassword'
      };

      const response = await agent
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ユーザー名またはパスワードが間違っています');
    });

    test('存在しないユーザーでのログインはエラー', async () => {
      const loginData = {
        username: 'nonexistentuser',
        password: 'password123'
      };

      const response = await agent
        .post('/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('ユーザー名またはパスワードが間違っています');
    });

    test('必須フィールドが不足している場合のログイン', async () => {
      const incompleteData = { username: 'loginuser' }; // パスワードなし

      const response = await agent
        .post('/auth/login')
        .send(incompleteData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('ログイン後にセッションが維持される', async () => {
      const loginData = {
        username: 'loginuser',
        password: 'password123'
      };

      // ログイン
      await agent
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      // セッション状態で /auth/me にアクセス
      const meResponse = await agent
        .get('/auth/me')
        .expect(200);

      expect(meResponse.body.success).toBe(true);
      expect(meResponse.body.data.username).toBe(loginData.username);
    });
  });

  describe('POST /auth/logout', () => {
    let testUser;

    beforeEach(async () => {
      // テスト用ユーザーを作成してログイン
      testUser = new User({ username: 'logoutuser' });
      await User.register(testUser, 'password123');

      await agent
        .post('/auth/login')
        .send({ username: 'logoutuser', password: 'password123' })
        .expect(200);
    });

    test('ログイン状態からログアウトできる', async () => {
      // ログイン状態を確認
      await agent
        .get('/auth/me')
        .expect(200);

      // ログアウト
      const response = await agent
        .post('/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('ログアウトしました');
    });

    test('ログアウト後は認証が必要なエンドポイントにアクセスできない', async () => {
      // ログアウト
      await agent
        .post('/auth/logout')
        .expect(200);

      // /auth/me にアクセスするとunauthorized
      const meResponse = await agent
        .get('/auth/me')
        .expect(401);

      expect(meResponse.body.success).toBe(false);
      expect(meResponse.body.message).toBe('認証されていません');
    });

    test('ログアウト状態でのログアウトも正常に処理される', async () => {
      // 既にログアウト状態でもう一度ログアウト
      await agent
        .post('/auth/logout')
        .expect(200);

      const response = await agent
        .post('/auth/logout')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /auth/me', () => {
    let testUser;

    beforeEach(async () => {
      // テスト用ユーザーを作成
      testUser = new User({
        username: 'meuser',
        soloStats: { totalScore: 5000, playCount: 10, bestScore: 1000 },
        multiStats: { totalScore: 3000, playCount: 5, bestScore: 800 }
      });
      await User.register(testUser, 'password123');
    });

    test('ログイン状態で現在のユーザー情報を取得できる', async () => {
      // ログイン
      await agent
        .post('/auth/login')
        .send({ username: 'meuser', password: 'password123' })
        .expect(200);

      // ユーザー情報取得
      const response = await agent
        .get('/auth/me')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('meuser');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.soloStats).toEqual({
        totalScore: 5000,
        playCount: 10,
        bestScore: 1000
      });
      expect(response.body.data.multiStats).toEqual({
        totalScore: 3000,
        playCount: 5,
        bestScore: 800
      });
    });

    test('ログアウト状態での現在ユーザー情報取得はエラー', async () => {
      // 新しいエージェント（セッションなし）を使用
      const freshAgent = request.agent(app);

      const response = await freshAgent
        .get('/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('認証されていません');
    });

    test('統計情報が未設定のユーザーでもデフォルト値が返される', async () => {
      // 統計情報なしのユーザーを作成
      const basicUser = new User({ username: 'basicuser' });
      await User.register(basicUser, 'password123');

      // ログイン
      await agent
        .post('/auth/login')
        .send({ username: 'basicuser', password: 'password123' })
        .expect(200);

      // ユーザー情報取得
      const response = await agent
        .get('/auth/me')
        .expect(200);

      expect(response.body.data.soloStats).toEqual({
        totalScore: 0,
        playCount: 0,
        bestScore: 0
      });
      expect(response.body.data.multiStats).toEqual({
        totalScore: 0,
        playCount: 0,
        bestScore: 0
      });
    });
  });

  describe('統合テスト - ユーザーフロー', () => {
    test('ユーザー登録 → ログアウト → ログイン → ユーザー情報取得の完全フロー', async () => {
      const userData = {
        username: 'flowuser',
        password: 'password123'
      };

      // 1. ユーザー登録（自動ログイン）
      const registerResponse = await agent
        .post('/auth/register')
        .send(userData)
        .expect(200);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.username).toBe(userData.username);

      // 2. ログイン状態を確認
      await agent
        .get('/auth/me')
        .expect(200);

      // 3. ログアウト
      await agent
        .post('/auth/logout')
        .expect(200);

      // 4. ログアウト状態を確認
      await agent
        .get('/auth/me')
        .expect(401);

      // 5. 再ログイン
      const loginResponse = await agent
        .post('/auth/login')
        .send(userData)
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.username).toBe(userData.username);

      // 6. 最終的にログイン状態であることを確認
      const finalMeResponse = await agent
        .get('/auth/me')
        .expect(200);

      expect(finalMeResponse.body.success).toBe(true);
      expect(finalMeResponse.body.data.username).toBe(userData.username);
    });

    test('複数のセッションで独立したログイン状態を保持', async () => {
      // ユーザー1を作成
      const user1 = new User({ username: 'sessionuser1' });
      await User.register(user1, 'password123');

      // ユーザー2を作成
      const user2 = new User({ username: 'sessionuser2' });
      await User.register(user2, 'password123');

      // 2つの独立したエージェントを作成
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);

      // エージェント1でユーザー1としてログイン
      await agent1
        .post('/auth/login')
        .send({ username: 'sessionuser1', password: 'password123' })
        .expect(200);

      // エージェント2でユーザー2としてログイン
      await agent2
        .post('/auth/login')
        .send({ username: 'sessionuser2', password: 'password123' })
        .expect(200);

      // 両方のセッションで正しいユーザー情報が返されることを確認
      const me1Response = await agent1.get('/auth/me').expect(200);
      const me2Response = await agent2.get('/auth/me').expect(200);

      expect(me1Response.body.data.username).toBe('sessionuser1');
      expect(me2Response.body.data.username).toBe('sessionuser2');

      // エージェント1をログアウト
      await agent1.post('/auth/logout').expect(200);

      // エージェント1は認証されていない状態
      await agent1.get('/auth/me').expect(401);

      // エージェント2はまだログイン状態
      const stillLoggedResponse = await agent2.get('/auth/me').expect(200);
      expect(stillLoggedResponse.body.data.username).toBe('sessionuser2');
    });
  });

  describe('セキュリティテスト', () => {
    test('パスワードはレスポンスに含まれない', async () => {
      const userData = {
        username: 'securityuser',
        password: 'password123'
      };

      // 登録
      const registerResponse = await agent
        .post('/auth/register')
        .send(userData)
        .expect(200);

      expect(registerResponse.body.data.password).toBeUndefined();
      expect(registerResponse.body.data.salt).toBeUndefined();
      expect(registerResponse.body.data.hash).toBeUndefined();

      // ログイン
      const loginResponse = await agent
        .post('/auth/login')
        .send(userData)
        .expect(200);

      expect(loginResponse.body.data.password).toBeUndefined();
      expect(loginResponse.body.data.salt).toBeUndefined();
      expect(loginResponse.body.data.hash).toBeUndefined();

      // ユーザー情報取得
      const meResponse = await agent
        .get('/auth/me')
        .expect(200);

      expect(meResponse.body.data.password).toBeUndefined();
      expect(meResponse.body.data.salt).toBeUndefined();
      expect(meResponse.body.data.hash).toBeUndefined();
    });

    test('SQLインジェクション攻撃に対する耐性', async () => {
      const maliciousData = {
        username: "admin'; DROP TABLE users; --",
        password: "password' OR '1'='1"
      };

      // 悪意のあるデータでの登録試行は正常に処理される（MongoDBなのでSQLインジェクションは無効）
      await agent
        .post('/auth/register')
        .send(maliciousData)
        .expect(200);

      // データベースは正常に動作し続ける
      const normalUser = {
        username: 'normaluser',
        password: 'password123'
      };

      await agent
        .post('/auth/register')
        .send(normalUser)
        .expect(200);
    });
  });
});