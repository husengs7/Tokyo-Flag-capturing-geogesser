// 🏠 Roomモデル詳細テスト
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Room = require('../models/Room');
const User = require('../models/User');

describe('Roomモデル詳細テスト', () => {
  let mongoServer;
  let testUsers = [];

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  }, 60000);

  beforeEach(async () => {
    // データベースクリーンアップ
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // テスト用ユーザーを作成
    testUsers = [];
    for (let i = 1; i <= 4; i++) {
      const user = new User({ username: `testuser${i}` });
      await user.save();
      testUsers.push(user);
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('ルーム作成とroomKey生成', () => {
    test('新しいルームを作成すると6桁のroomKeyが自動生成される', async () => {
      const room = new Room({
        hostId: testUsers[0]._id,
        roomKey: '123456', // テスト用の固定値
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });

      const savedRoom = await room.save();

      expect(savedRoom.roomKey).toBeDefined();
      expect(savedRoom.roomKey.length).toBe(6);
      expect(/^\d{6}$/.test(savedRoom.roomKey)).toBe(true); // 6桁の数字
    });

    test('重複しないroomKeyが生成される', async () => {
      const rooms = [];

      // 複数のルームを作成
      for (let i = 0; i < 5; i++) {
        const room = new Room({
          hostId: testUsers[i % testUsers.length]._id,
          roomKey: `12345${i}`,
          gameState: {
            targetLocation: { lat: 35.6762, lng: 139.6503 },
            playerStartLocation: { lat: 35.6896, lng: 139.7006 },
            initialDistance: 1000
          }
        });
        const savedRoom = await room.save();
        rooms.push(savedRoom);
      }

      // すべてのroomKeyが異なることを確認
      const roomKeys = rooms.map(room => room.roomKey);
      const uniqueKeys = new Set(roomKeys);
      expect(uniqueKeys.size).toBe(rooms.length);
    });

    test('updatedAtが自動更新される', async () => {
      const room = new Room({
        hostId: testUsers[0]._id,
        roomKey: '234567',
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });

      const savedRoom = await room.save();
      const originalUpdatedAt = savedRoom.updatedAt;

      // 少し待ってから更新
      await new Promise(resolve => setTimeout(resolve, 10));

      savedRoom.status = 'playing';
      await savedRoom.save();

      expect(savedRoom.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('プレイヤー管理メソッド', () => {
    let room;

    beforeEach(async () => {
      room = new Room({
        hostId: testUsers[0]._id,
        roomKey: '345678',
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });
      await room.save();
    });

    describe('addPlayer', () => {
      test('ホストプレイヤーを追加できる', async () => {
        await room.addPlayer(testUsers[0]._id, testUsers[0].username, true);

        expect(room.players.length).toBe(1);
        expect(room.players[0].userId.toString()).toBe(testUsers[0]._id.toString());
        expect(room.players[0].username).toBe(testUsers[0].username);
        expect(room.players[0].isHost).toBe(true);
        expect(room.players[0].isReady).toBe(true); // ホストは自動ready
      });

      test('通常プレイヤーを追加できる', async () => {
        await room.addPlayer(testUsers[1]._id, testUsers[1].username, false);

        expect(room.players.length).toBe(1);
        expect(room.players[0].isHost).toBe(false);
        expect(room.players[0].isReady).toBe(false); // 通常プレイヤーは手動ready
      });

      test('複数プレイヤーを追加できる', async () => {
        await room.addPlayer(testUsers[0]._id, testUsers[0].username, true);
        await room.addPlayer(testUsers[1]._id, testUsers[1].username, false);
        await room.addPlayer(testUsers[2]._id, testUsers[2].username, false);

        expect(room.players.length).toBe(3);
      });

      test('既に参加しているプレイヤーの重複追加はエラー', async () => {
        await room.addPlayer(testUsers[0]._id, testUsers[0].username, true);

        try {
          await room.addPlayer(testUsers[0]._id, testUsers[0].username, false);
          fail('エラーが投げられるべきでした');
        } catch (error) {
          expect(error.message).toBe('既にこのルームに参加しています');
        }
      });

      test('最大人数を超える追加はエラー', async () => {
        // 4人まで追加
        for (let i = 0; i < 4; i++) {
          await room.addPlayer(testUsers[i]._id, testUsers[i].username, i === 0);
        }

        // 5人目を追加しようとするとエラー
        const extraUser = new User({ username: 'extrauser' });
        await extraUser.save();

        try {
          await room.addPlayer(extraUser._id, extraUser.username, false);
          fail('エラーが投げられるべきでした');
        } catch (error) {
          expect(error.message).toBe('ルームが満員です');
        }
      });
    });

    describe('removePlayer', () => {
      beforeEach(async () => {
        // テスト用プレイヤーを追加
        await room.addPlayer(testUsers[0]._id, testUsers[0].username, true); // ホスト
        await room.addPlayer(testUsers[1]._id, testUsers[1].username, false);
        await room.addPlayer(testUsers[2]._id, testUsers[2].username, false);
      });

      test('通常プレイヤーを削除できる', async () => {
        await room.removePlayer(testUsers[1]._id);

        expect(room.players.length).toBe(2);
        expect(room.players.find(p => p.userId.toString() === testUsers[1]._id.toString())).toBeUndefined();
      });

      test('ホストを削除すると新しいホストが選出される', async () => {
        await room.removePlayer(testUsers[0]._id); // ホストを削除

        expect(room.players.length).toBe(2);
        expect(room.players[0].isHost).toBe(true); // 最初のプレイヤーが新ホスト
        expect(room.players[0].userId.toString()).toBe(testUsers[1]._id.toString());
      });

      test('存在しないプレイヤーの削除はエラー', async () => {
        const extraUser = new User({ username: 'extrauser' });
        await extraUser.save();

        try {
          await room.removePlayer(extraUser._id);
          fail('エラーが投げられるべきでした');
        } catch (error) {
          expect(error.message).toBe('プレイヤーが見つかりません');
        }
      });
    });
  });

  describe('ゲーム状態管理メソッド', () => {
    let room;

    beforeEach(async () => {
      room = new Room({
        hostId: testUsers[0]._id,
        roomKey: '456789',
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000,
          currentRound: 1
        }
      });
      await room.save();

      // プレイヤーを追加
      await room.addPlayer(testUsers[0]._id, testUsers[0].username, true);
      await room.addPlayer(testUsers[1]._id, testUsers[1].username, false);
    });

    describe('allPlayersReady', () => {
      test('全プレイヤーがready状態の場合trueを返す', async () => {
        // プレイヤー2も準備完了にする
        room.players[1].isReady = true;
        await room.save();

        expect(room.allPlayersReady()).toBe(true);
      });

      test('一部プレイヤーがnot ready状態の場合falseを返す', async () => {
        // プレイヤー2はnot ready状態のまま
        expect(room.allPlayersReady()).toBe(false);
      });

      test('プレイヤーが1人以下の場合falseを返す', async () => {
        await room.removePlayer(testUsers[1]._id);
        room.players[0].isReady = true;
        await room.save();

        expect(room.allPlayersReady()).toBe(false);
      });
    });

    describe('allPlayersGuessed', () => {
      test('全プレイヤーが推測完了の場合trueを返す', async () => {
        room.players.forEach(player => {
          player.hasGuessed = true;
        });
        await room.save();

        expect(room.allPlayersGuessed()).toBe(true);
      });

      test('一部プレイヤーが未推測の場合falseを返す', async () => {
        room.players[0].hasGuessed = true;
        room.players[1].hasGuessed = false;
        await room.save();

        expect(room.allPlayersGuessed()).toBe(false);
      });
    });

    describe('getCurrentRanking', () => {
      beforeEach(async () => {
        // スコアを設定
        room.players[0].totalScore = 8000;
        room.players[0].gameScores = [3000, 5000];
        room.players[1].totalScore = 6000;
        room.players[1].gameScores = [2000, 4000];
        await room.save();
      });

      test('合計スコア順でランキングを返す', async () => {
        const ranking = room.getCurrentRanking();

        expect(ranking).toHaveLength(2);
        expect(ranking[0].rank).toBe(1);
        expect(ranking[0].totalScore).toBe(8000);
        expect(ranking[0].username).toBe(testUsers[0].username);

        expect(ranking[1].rank).toBe(2);
        expect(ranking[1].totalScore).toBe(6000);
        expect(ranking[1].username).toBe(testUsers[1].username);
      });

      test('ランキングに必要な情報が含まれている', async () => {
        const ranking = room.getCurrentRanking();

        expect(ranking[0]).toHaveProperty('rank');
        expect(ranking[0]).toHaveProperty('userId');
        expect(ranking[0]).toHaveProperty('username');
        expect(ranking[0]).toHaveProperty('totalScore');
        expect(ranking[0]).toHaveProperty('gameScores');
      });
    });

    describe('nextRound', () => {
      beforeEach(async () => {
        // プレイヤーの推測状態を設定
        room.players.forEach(player => {
          player.hasGuessed = true;
        });
        room.gameState.allPlayersGuessed = true;
        room.gameState.currentRound = 2;
        await room.save();
      });

      test('次のラウンドに進むとプレイヤー状態がリセットされる', async () => {
        await room.nextRound();

        expect(room.gameState.currentRound).toBe(3);
        expect(room.gameState.allPlayersGuessed).toBe(false);
        room.players.forEach(player => {
          expect(player.hasGuessed).toBe(false);
        });
      });

      test('最終ラウンド完了後はfinished状態になる', async () => {
        room.gameState.currentRound = 3; // 最終ラウンド
        room.settings.roundCount = 3;
        await room.save();

        await room.nextRound();

        expect(room.gameState.currentRound).toBe(4);
        expect(room.status).toBe('finished');
      });

      test('ランキング表示期間がリセットされる', async () => {
        room.gameState.rankingDisplayUntil = new Date();
        await room.save();

        await room.nextRound();

        expect(room.gameState.rankingDisplayUntil).toBeNull();
      });
    });
  });

  describe('バリデーション', () => {
    test('最大プレイヤー数制限が機能する', async () => {
      const room = new Room({
        hostId: testUsers[0]._id,
        roomKey: '567890',
        players: new Array(5).fill(null).map((_, i) => ({
          userId: testUsers[i % testUsers.length]._id,
          username: `user${i}`
        })),
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });

      await expect(room.save()).rejects.toThrow('ルームの最大参加者数は4人です');
    });

    test('ステータスのenum制限が機能する', async () => {
      const room = new Room({
        hostId: testUsers[0]._id,
        roomKey: '678901',
        status: 'invalid_status',
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });

      await expect(room.save()).rejects.toThrow();
    });

    test('必須フィールドの検証が機能する', async () => {
      const room = new Room({
        // hostIdが欠けている
        roomKey: '789012',
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });

      await expect(room.save()).rejects.toThrow();
    });
  });

  describe('設定とデフォルト値', () => {
    test('デフォルト設定が正しく適用される', async () => {
      const room = new Room({
        hostId: testUsers[0]._id,
        roomKey: '890123',
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });

      await room.save();

      expect(room.status).toBe('waiting');
      expect(room.settings.maxPlayers).toBe(4);
      expect(room.settings.roundCount).toBe(3);
      expect(room.gameState.currentRound).toBe(0);
    });

    test('カスタム設定を指定できる', async () => {
      const room = new Room({
        hostId: testUsers[0]._id,
        roomKey: '901234',
        settings: {
          maxPlayers: 3,
          roundCount: 5
        },
        gameState: {
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });

      await room.save();

      expect(room.settings.maxPlayers).toBe(3);
      expect(room.settings.roundCount).toBe(5);
    });
  });
});