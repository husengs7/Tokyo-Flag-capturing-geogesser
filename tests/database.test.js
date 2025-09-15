// 🗄️ データベース統合テスト
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const GameRecord = require('../models/GameRecord');
const Room = require('../models/Room');

describe('データベース統合テスト', () => {
  let mongoServer;

  beforeAll(async () => {
    // インメモリーMongoDBサーバーを起動
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // テスト用データベースに接続
    await mongoose.connect(mongoUri);
  }, 60000);

  beforeEach(async () => {
    // 各テスト前にデータベースをクリーンアップ
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    // テスト完了後にデータベース接続を閉じる
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('ユーザーモデルテスト', () => {
    test('新しいユーザーを作成できる', async () => {
      const userData = {
        username: 'testuser',
        soloStats: {
          totalScore: 1000,
          playCount: 5,
          bestScore: 300
        }
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.username).toBe('testuser');
      expect(savedUser.soloStats.totalScore).toBe(1000);
      expect(savedUser.createdAt).toBeDefined();
    });

    test('デフォルト値が正しく設定される', async () => {
      const user = new User({ username: 'defaultuser' });
      const savedUser = await user.save();

      expect(savedUser.soloStats.totalScore).toBe(0);
      expect(savedUser.soloStats.playCount).toBe(0);
      expect(savedUser.soloStats.bestScore).toBe(0);
      expect(savedUser.multiStats.totalScore).toBe(0);
      expect(savedUser.multiStats.playCount).toBe(0);
      expect(savedUser.multiStats.bestScore).toBe(0);
    });

    test('ユーザー統計を更新できる', async () => {
      const user = new User({ username: 'updateuser' });
      await user.save();

      // 統計を更新
      user.soloStats.totalScore = 2500;
      user.soloStats.playCount = 10;
      user.soloStats.bestScore = 500;

      const updatedUser = await user.save();

      expect(updatedUser.soloStats.totalScore).toBe(2500);
      expect(updatedUser.soloStats.playCount).toBe(10);
      expect(updatedUser.soloStats.bestScore).toBe(500);
    });

    test('同じユーザー名で複数ユーザーを作成できない', async () => {
      const user1 = new User({ username: 'duplicateuser' });
      await user1.save();

      const user2 = new User({ username: 'duplicateuser' });

      await expect(user2.save()).rejects.toThrow();
    });

    test('ユーザーを検索できる', async () => {
      const user1 = new User({ username: 'searchuser1' });
      const user2 = new User({ username: 'searchuser2' });
      await user1.save();
      await user2.save();

      const foundUser = await User.findOne({ username: 'searchuser1' });
      expect(foundUser.username).toBe('searchuser1');

      const allUsers = await User.find({});
      expect(allUsers.length).toBe(2);
    });
  });

  describe('ゲーム記録モデルテスト', () => {
    let testUser;

    beforeEach(async () => {
      testUser = new User({ username: 'gameuser' });
      await testUser.save();
    });

    test('ゲーム記録を作成できる', async () => {
      const gameData = {
        userId: testUser._id,
        gameMode: 'solo',
        score: 4500,
        finalDistance: 150,
        targetLocation: {
          lat: 35.6762,
          lng: 139.6503
        },
        playerStartLocation: {
          lat: 35.6896,
          lng: 139.7006
        },
        finalLocation: {
          lat: 35.6880,
          lng: 139.7000
        },
        hintUsed: false
      };

      const gameRecord = new GameRecord(gameData);
      const savedRecord = await gameRecord.save();

      expect(savedRecord._id).toBeDefined();
      expect(savedRecord.userId.toString()).toBe(testUser._id.toString());
      expect(savedRecord.score).toBe(4500);
      expect(savedRecord.finalDistance).toBe(150);
      expect(savedRecord.targetLocation.lat).toBe(35.6762);
    });

    test('ユーザー別ゲーム記録を取得できる', async () => {
      // 複数のゲーム記録を作成
      const records = [
        {
          userId: testUser._id,
          gameMode: 'solo',
          score: 4500,
          finalDistance: 100,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          finalLocation: { lat: 35.6880, lng: 139.7000 }
        },
        {
          userId: testUser._id,
          gameMode: 'solo',
          score: 3200,
          finalDistance: 200,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          finalLocation: { lat: 35.6850, lng: 139.6950 }
        },
        {
          userId: testUser._id,
          gameMode: 'multi',
          score: 4800,
          finalDistance: 80,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          finalLocation: { lat: 35.6780, lng: 139.6520 }
        }
      ];

      for (const record of records) {
        const gameRecord = new GameRecord(record);
        await gameRecord.save();
      }

      // ユーザーのすべての記録を取得
      const userRecords = await GameRecord.find({ userId: testUser._id });
      expect(userRecords.length).toBe(3);

      // ソロゲームの記録のみ取得
      const soloRecords = await GameRecord.find({
        userId: testUser._id,
        gameMode: 'solo'
      });
      expect(soloRecords.length).toBe(2);
    });

    test('スコア順でソートできる', async () => {
      const scores = [3000, 5000, 2000, 4500];
      for (const score of scores) {
        const gameRecord = new GameRecord({
          userId: testUser._id,
          gameMode: 'solo',
          score: score,
          finalDistance: 100,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          finalLocation: { lat: 35.6880, lng: 139.7000 }
        });
        await gameRecord.save();
      }

      // スコア降順でソート
      const sortedRecords = await GameRecord.find({ userId: testUser._id })
        .sort({ score: -1 });

      expect(sortedRecords[0].score).toBe(5000);
      expect(sortedRecords[1].score).toBe(4500);
      expect(sortedRecords[2].score).toBe(3000);
      expect(sortedRecords[3].score).toBe(2000);
    });
  });

  describe('ルームモデルテスト', () => {
    let testUser1, testUser2;

    beforeEach(async () => {
      testUser1 = new User({ username: 'roomuser1' });
      testUser2 = new User({ username: 'roomuser2' });
      await testUser1.save();
      await testUser2.save();
    });

    test('ルームを作成できる', async () => {
      const roomData = {
        roomKey: 'TEST123',
        hostId: testUser1._id,
        status: 'waiting',
        settings: {
          rounds: 5,
          timeLimit: 60
        },
        players: [{
          userId: testUser1._id,
          username: testUser1.username,
          isReady: false,
          joinedAt: new Date()
        }]
      };

      const room = new Room(roomData);
      const savedRoom = await room.save();

      expect(savedRoom.roomKey).toBe('TEST123');
      expect(savedRoom.hostId.toString()).toBe(testUser1._id.toString());
      expect(savedRoom.players.length).toBe(1);
      expect(savedRoom.status).toBe('waiting');
    });

    test('プレイヤーをルームに追加できる', async () => {
      const room = new Room({
        roomKey: 'ADDTEST',
        hostId: testUser1._id,
        status: 'waiting',
        players: [{
          userId: testUser1._id,
          username: testUser1.username,
          isReady: false,
          joinedAt: new Date()
        }]
      });
      await room.save();

      // 新しいプレイヤーを追加
      room.players.push({
        userId: testUser2._id,
        username: testUser2.username,
        isReady: false,
        joinedAt: new Date()
      });

      const updatedRoom = await room.save();
      expect(updatedRoom.players.length).toBe(2);
      expect(updatedRoom.players[1].userId.toString()).toBe(testUser2._id.toString());
    });

    test('ルームキーでルームを検索できる', async () => {
      const room = new Room({
        roomKey: 'SEARCH123',
        hostId: testUser1._id,
        status: 'waiting',
        players: []
      });
      await room.save();

      const foundRoom = await Room.findOne({ roomKey: 'SEARCH123' });
      expect(foundRoom).toBeDefined();
      expect(foundRoom.roomKey).toBe('SEARCH123');
    });

    test('ルームステータスを更新できる', async () => {
      const room = new Room({
        roomKey: 'STATUS123',
        hostId: testUser1._id,
        status: 'waiting',
        players: []
      });
      await room.save();

      // ステータスを更新
      room.status = 'playing';
      const updatedRoom = await room.save();

      expect(updatedRoom.status).toBe('playing');
    });
  });

  describe('データベース制約テスト', () => {
    test('必須フィールドが欠けている場合エラーになる', async () => {
      const incompleteRecord = new GameRecord({
        // 必須フィールドが欠けている
        userId: new mongoose.Types.ObjectId(),
        score: 100
        // finalDistance, targetLocation等が欠けている
      });

      await expect(incompleteRecord.save()).rejects.toThrow();
    });

    test('無効なデータ型の場合エラーになる', async () => {
      const invalidUser = new User({
        username: 'typetest',
        soloStats: {
          totalScore: 'invalid_number' // 文字列を数値フィールドに
        }
      });

      await expect(invalidUser.save()).rejects.toThrow();
    });
  });

  describe('集計クエリテスト', () => {
    beforeEach(async () => {
      // テストデータを作成
      const user1 = new User({ username: 'agguser1' });
      const user2 = new User({ username: 'agguser2' });
      await user1.save();
      await user2.save();

      const gameRecords = [
        {
          userId: user1._id,
          gameMode: 'solo',
          score: 5000,
          finalDistance: 50,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          finalLocation: { lat: 35.6780, lng: 139.6520 }
        },
        {
          userId: user1._id,
          gameMode: 'solo',
          score: 3000,
          finalDistance: 300,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          finalLocation: { lat: 35.6800, lng: 139.6600 }
        },
        {
          userId: user2._id,
          gameMode: 'solo',
          score: 4500,
          finalDistance: 100,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          finalLocation: { lat: 35.6790, lng: 139.6550 }
        },
        {
          userId: user2._id,
          gameMode: 'multi',
          score: 4000,
          finalDistance: 150,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          finalLocation: { lat: 35.6820, lng: 139.6580 }
        }
      ];

      for (const record of gameRecords) {
        const gameRecord = new GameRecord(record);
        await gameRecord.save();
      }
    });

    test('ユーザー別平均スコアを計算できる', async () => {
      const averageScores = await GameRecord.aggregate([
        { $match: { gameMode: 'solo' } },
        {
          $group: {
            _id: '$userId',
            averageScore: { $avg: '$score' },
            count: { $sum: 1 }
          }
        }
      ]);

      expect(averageScores.length).toBe(2);

      // ユーザーごとの平均スコアを確認
      const user1 = await User.findOne({ username: 'agguser1' });
      const user1Avg = averageScores.find(a => a._id.toString() === user1._id.toString());
      expect(user1Avg.averageScore).toBe(4000); // (5000 + 3000) / 2
      expect(user1Avg.count).toBe(2);
    });

    test('最高スコアを取得できる', async () => {
      const maxScore = await GameRecord.findOne({}).sort({ score: -1 });
      expect(maxScore.score).toBe(5000);
    });
  });
});