// 🎮 MultiGameService機能テスト
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const MultiGameService = require('../services/multiGameService');
const Room = require('../models/Room');
const User = require('../models/User');
const GameRecord = require('../models/GameRecord');
const MultiGameRecord = require('../models/MultiGameRecord');

describe('MultiGameService機能テスト', () => {
  let mongoServer;
  let testUsers = [];
  let testRoom;

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
    for (let i = 1; i <= 3; i++) {
      const user = new User({
        username: `multigameuser${i}`,
        multiStats: {
          playCount: 0,
          totalScore: 0,
          bestScore: 0
        }
      });
      await user.save();
      testUsers.push(user);
    }

    // テスト用ルームを作成
    testRoom = new Room({
      hostId: testUsers[0]._id,
      roomKey: '123456',
      settings: {
        maxPlayers: 3,
        roundCount: 3
      },
      status: 'waiting',
      gameState: {
        currentRound: 0,
        targetLocation: { lat: 35.6762, lng: 139.6503 },
        playerStartLocation: { lat: 35.6896, lng: 139.7006 },
        initialDistance: 1000
      }
    });

    // プレイヤーを追加
    await testRoom.addPlayer(testUsers[0]._id, testUsers[0].username, true);
    await testRoom.addPlayer(testUsers[1]._id, testUsers[1].username, false);

    // 全員準備完了にする
    testRoom.players.forEach(player => {
      player.isReady = true;
    });
    await testRoom.save();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('startMultiGame', () => {
    test('マルチゲームを正常に開始できる', async () => {
      const targetLat = 35.6762;
      const targetLng = 139.6503;
      const playerLat = 35.6896;
      const playerLng = 139.7006;

      const room = await MultiGameService.startMultiGame(
        testRoom._id, targetLat, targetLng, playerLat, playerLng
      );

      expect(room.status).toBe('playing');
      expect(room.gameState.currentRound).toBe(1);
      expect(room.gameState.targetLocation.lat).toBe(targetLat);
      expect(room.gameState.targetLocation.lng).toBe(targetLng);
      expect(room.gameState.playerStartLocation.lat).toBe(playerLat);
      expect(room.gameState.playerStartLocation.lng).toBe(playerLng);
      expect(room.gameState.initialDistance).toBeGreaterThan(0);
      expect(room.gameState.allPlayersGuessed).toBe(false);
      expect(room.gameState.roundStartTime).toBeInstanceOf(Date);

      // 全プレイヤーのスコアがリセットされているか確認
      room.players.forEach(player => {
        expect(player.totalScore).toBe(0);
        expect(player.gameScores).toEqual([]);
        expect(player.hasGuessed).toBe(false);
        expect(player.currentPosition.lat).toBe(playerLat);
        expect(player.currentPosition.lng).toBe(playerLng);
      });

      // MultiGameRecordが作成されているか確認
      const multiGameRecords = await MultiGameRecord.find({ roomId: testRoom._id });
      expect(multiGameRecords).toHaveLength(2);
    });

    test('存在しないルームでのゲーム開始はエラー', async () => {
      const fakeRoomId = new mongoose.Types.ObjectId();

      await expect(
        MultiGameService.startMultiGame(fakeRoomId, 35.6762, 139.6503, 35.6896, 139.7006)
      ).rejects.toThrow('ルームが見つかりません');
    });

    test('waiting以外の状態でのゲーム開始はエラー', async () => {
      testRoom.status = 'playing';
      await testRoom.save();

      await expect(
        MultiGameService.startMultiGame(testRoom._id, 35.6762, 139.6503, 35.6896, 139.7006)
      ).rejects.toThrow('ゲーム開始できない状態です');
    });

    test('全プレイヤーが準備完了していない場合はエラー', async () => {
      testRoom.players[1].isReady = false;
      await testRoom.save();

      await expect(
        MultiGameService.startMultiGame(testRoom._id, 35.6762, 139.6503, 35.6896, 139.7006)
      ).rejects.toThrow('全プレイヤーの準備が完了していません');
    });

    test('既存の未完了MultiGameRecordがある場合は新規作成しない', async () => {
      // 既存の未完了記録を作成
      const existingRecord = new MultiGameRecord({
        userId: testUsers[0]._id,
        roomId: testRoom._id,
        roomKey: testRoom.roomKey,
        gameRecords: [],
        totalScore: 0,
        isCompleted: false
      });
      await existingRecord.save();

      await MultiGameService.startMultiGame(testRoom._id, 35.6762, 139.6503, 35.6896, 139.7006);

      // 重複して作成されていないことを確認
      const records = await MultiGameRecord.find({
        userId: testUsers[0]._id,
        roomId: testRoom._id
      });
      expect(records).toHaveLength(1);
    });
  });

  describe('processPlayerGuess', () => {
    beforeEach(async () => {
      // ゲームを開始状態にする
      await MultiGameService.startMultiGame(testRoom._id, 35.6762, 139.6503, 35.6896, 139.7006);
      // 最新のルーム情報を取得
      testRoom = await Room.findById(testRoom._id);
    });

    test('プレイヤーの推測を正常に処理できる', async () => {
      const guessLat = 35.6800;
      const guessLng = 139.6600;

      const result = await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, guessLat, guessLng, false
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.hintUsed).toBe(false);
      expect(result.totalScore).toBe(result.score);
      expect(result.currentRound).toBe(1);
      expect(result.ranking).toBeDefined();

      // ルーム状態を確認
      const updatedRoom = await Room.findById(testRoom._id);
      const player = updatedRoom.players.find(p => p.userId.toString() === testUsers[0]._id.toString());
      expect(player.hasGuessed).toBe(true);
      expect(player.gameScores).toHaveLength(1);
      expect(player.totalScore).toBe(result.score);

      // GameRecordが作成されているか確認
      const gameRecords = await GameRecord.find({ userId: testUsers[0]._id });
      expect(gameRecords).toHaveLength(1);
      expect(gameRecords[0].gameMode).toBe('multi');
      expect(gameRecords[0].score).toBe(result.score);

      // MultiGameRecordが更新されているか確認
      const multiGameRecord = await MultiGameRecord.findOne({
        userId: testUsers[0]._id,
        roomId: testRoom._id
      });
      expect(multiGameRecord.gameRecords).toHaveLength(1);
    });

    test('ヒント使用時はスコアが減少する', async () => {
      const guessLat = 35.6800;
      const guessLng = 139.6600;

      const resultWithoutHint = await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, guessLat, guessLng, false
      );

      // 2番目のプレイヤーでヒント使用
      const resultWithHint = await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[1]._id, guessLat, guessLng, true
      );

      expect(resultWithHint.score).toBeLessThan(resultWithoutHint.score);
      expect(resultWithHint.hintUsed).toBe(true);
    });

    test('全員推測完了時はランキング状態になる', async () => {
      const guessLat = 35.6800;
      const guessLng = 139.6600;

      // 1番目のプレイヤーが推測
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, guessLat, guessLng, false
      );

      // 2番目のプレイヤーが推測（全員推測完了）
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[1]._id, guessLat, guessLng, false
      );

      const updatedRoom = await Room.findById(testRoom._id);
      expect(updatedRoom.status).toBe('ranking');
      expect(updatedRoom.gameState.allPlayersGuessed).toBe(true);
      expect(updatedRoom.gameState.rankingDisplayUntil).toBeInstanceOf(Date);
    });

    test('既に推測済みのプレイヤーの再推測はエラー', async () => {
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, 35.6800, 139.6600, false
      );

      await expect(
        MultiGameService.processPlayerGuess(
          testRoom._id, testUsers[0]._id, 35.6800, 139.6600, false
        )
      ).rejects.toThrow('既に推測済みです');
    });

    test('存在しないプレイヤーの推測はエラー', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();

      await expect(
        MultiGameService.processPlayerGuess(
          testRoom._id, fakeUserId, 35.6800, 139.6600, false
        )
      ).rejects.toThrow('このルームに参加していません');
    });
  });

  describe('nextRound', () => {
    beforeEach(async () => {
      // ゲームを開始し、1ラウンド目を完了状態にする
      await MultiGameService.startMultiGame(testRoom._id, 35.6762, 139.6503, 35.6896, 139.7006);
      // 最新のルーム情報を取得
      testRoom = await Room.findById(testRoom._id);

      // 全員推測完了にする
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, 35.6800, 139.6600, false
      );
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[1]._id, 35.6800, 139.6600, false
      );
    });

    test('次のラウンドに正常に進める', async () => {
      const newTargetLat = 35.7000;
      const newTargetLng = 139.7000;
      const newPlayerLat = 35.6900;
      const newPlayerLng = 139.6900;

      const room = await MultiGameService.nextRound(
        testRoom._id, newTargetLat, newTargetLng, newPlayerLat, newPlayerLng
      );

      expect(room.gameState.currentRound).toBe(2);
      expect(room.gameState.targetLocation.lat).toBe(newTargetLat);
      expect(room.gameState.targetLocation.lng).toBe(newTargetLng);
      expect(room.gameState.playerStartLocation.lat).toBe(newPlayerLat);
      expect(room.gameState.playerStartLocation.lng).toBe(newPlayerLng);
      expect(room.gameState.allPlayersGuessed).toBe(false);
      expect(room.gameState.rankingDisplayUntil).toBeNull();
      expect(room.status).toBe('playing');

      // 全プレイヤーの推測状態がリセットされているか確認
      room.players.forEach(player => {
        expect(player.hasGuessed).toBe(false);
        expect(player.currentPosition.lat).toBe(newPlayerLat);
        expect(player.currentPosition.lng).toBe(newPlayerLng);
      });
    });

    test('まだ完了していないラウンドから次に進むのはエラー', async () => {
      // 推測状態をリセット
      const room = await Room.findById(testRoom._id);
      room.gameState.allPlayersGuessed = false;
      room.players.forEach(player => {
        player.hasGuessed = false;
      });
      await room.save();

      await expect(
        MultiGameService.nextRound(testRoom._id, 35.7000, 139.7000, 35.6900, 139.6900)
      ).rejects.toThrow('現在のラウンドがまだ完了していません');
    });

    test('最終ラウンド後は次に進めない', async () => {
      // 3ラウンド目まで進める
      await MultiGameService.nextRound(testRoom._id, 35.7000, 139.7000, 35.6900, 139.6900);

      // 2ラウンド目完了
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, 35.7050, 139.7050, false
      );
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[1]._id, 35.7050, 139.7050, false
      );

      await MultiGameService.nextRound(testRoom._id, 35.7100, 139.7100, 35.7000, 139.7000);

      // 3ラウンド目完了
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, 35.7150, 139.7150, false
      );
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[1]._id, 35.7150, 139.7150, false
      );

      // 3ラウンド目から4ラウンド目に進もうとするとエラー
      await expect(
        MultiGameService.nextRound(testRoom._id, 35.7200, 139.7200, 35.7100, 139.7100)
      ).rejects.toThrow('既に全ラウンドが完了しています');
    });
  });

  describe('completeMultiGame', () => {
    beforeEach(async () => {
      // 3ラウンド完了状態まで進める
      await MultiGameService.startMultiGame(testRoom._id, 35.6762, 139.6503, 35.6896, 139.7006);
      // 最新のルーム情報を取得
      testRoom = await Room.findById(testRoom._id);

      // 1ラウンド目
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, 35.6800, 139.6600, false
      );
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[1]._id, 35.6850, 139.6650, false
      );

      // 2ラウンド目
      await MultiGameService.nextRound(testRoom._id, 35.7000, 139.7000, 35.6900, 139.6900);
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, 35.7050, 139.7050, false
      );
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[1]._id, 35.7100, 139.7100, false
      );

      // 3ラウンド目
      await MultiGameService.nextRound(testRoom._id, 35.7200, 139.7200, 35.7100, 139.7100);
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[0]._id, 35.7250, 139.7250, false
      );
      await MultiGameService.processPlayerGuess(
        testRoom._id, testUsers[1]._id, 35.7300, 139.7300, false
      );

      // 現在のラウンドが最終ラウンド (3) を超えるように直接Room.nextRound()を呼ぶ
      const room = await Room.findById(testRoom._id);
      await room.nextRound();
    });

    test('マルチゲームを正常に完了できる', async () => {
      const result = await MultiGameService.completeMultiGame(testRoom._id);

      expect(result.finalRanking).toBeDefined();
      expect(result.finalRanking).toHaveLength(2);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.totalRounds).toBe(3);

      // ルーム状態が完了になっているか確認
      const completedRoom = await Room.findById(testRoom._id);
      expect(completedRoom.status).toBe('finished');

      // MultiGameRecordが完了状態になっているか確認
      const multiGameRecords = await MultiGameRecord.find({ roomId: testRoom._id });
      multiGameRecords.forEach(record => {
        expect(record.isCompleted).toBe(true);
        expect(record.finalRanking).toBeGreaterThan(0);
        expect(record.opponents).toHaveLength(1);
      });

      // ユーザー統計が更新されているか確認
      const updatedUsers = await User.find({ _id: { $in: [testUsers[0]._id, testUsers[1]._id] } });
      updatedUsers.forEach(user => {
        expect(user.multiStats.playCount).toBe(1);
        expect(user.multiStats.totalScore).toBeGreaterThan(0);
        expect(user.multiStats.bestScore).toBeGreaterThan(0);
      });
    });

    test('まだ完了していないゲームの完了処理はエラー', async () => {
      // 2ラウンド目までしか進んでいない状態を作成
      const incompleteRoom = new Room({
        hostId: testUsers[0]._id,
        roomKey: '789012',
        settings: { maxPlayers: 2, roundCount: 3 },
        gameState: {
          currentRound: 2,
          targetLocation: { lat: 35.6762, lng: 139.6503 },
          playerStartLocation: { lat: 35.6896, lng: 139.7006 },
          initialDistance: 1000
        }
      });
      await incompleteRoom.save();

      await expect(
        MultiGameService.completeMultiGame(incompleteRoom._id)
      ).rejects.toThrow('まだ全ラウンドが完了していません');
    });
  });

  describe('getCurrentRanking', () => {
    beforeEach(async () => {
      await MultiGameService.startMultiGame(testRoom._id, 35.6762, 139.6503, 35.6896, 139.7006);
      // 最新のルーム情報を取得
      testRoom = await Room.findById(testRoom._id);
    });

    test('現在のランキング状況を取得できる', async () => {
      const ranking = await MultiGameService.getCurrentRanking(testRoom._id);

      expect(ranking).toHaveLength(2);
      expect(ranking[0]).toHaveProperty('rank');
      expect(ranking[0]).toHaveProperty('userId');
      expect(ranking[0]).toHaveProperty('username');
      expect(ranking[0]).toHaveProperty('totalScore');
      expect(ranking[0]).toHaveProperty('gameScores');
    });

    test('存在しないルームのランキング取得はエラー', async () => {
      const fakeRoomId = new mongoose.Types.ObjectId();

      await expect(
        MultiGameService.getCurrentRanking(fakeRoomId)
      ).rejects.toThrow('ルームが見つかりません');
    });
  });

  describe('getPlayerMultiGameHistory', () => {
    beforeEach(async () => {
      // 完了済みのMultiGameRecordを作成
      const completedRecord = new MultiGameRecord({
        userId: testUsers[0]._id,
        roomId: testRoom._id,
        roomKey: testRoom.roomKey,
        gameRecords: [new mongoose.Types.ObjectId()],
        totalScore: 8000,
        isCompleted: true,
        finalRanking: 1,
        opponents: [{
          userId: testUsers[1]._id,
          username: testUsers[1].username,
          finalScore: 6000
        }]
      });
      await completedRecord.save();
    });

    test('プレイヤーのマルチゲーム履歴を取得できる', async () => {
      const history = await MultiGameService.getPlayerMultiGameHistory(testUsers[0]._id);

      expect(history).toHaveLength(1);
      expect(history[0].userId.toString()).toBe(testUsers[0]._id.toString());
      expect(history[0].totalScore).toBe(8000);
      expect(history[0].isCompleted).toBe(true);
      expect(history[0].finalRanking).toBe(1);
    });

    test('履歴がない場合は空配列を返す', async () => {
      const history = await MultiGameService.getPlayerMultiGameHistory(testUsers[2]._id);
      expect(history).toHaveLength(0);
    });

    test('limit指定で取得件数を制限できる', async () => {
      // 複数の履歴を作成
      for (let i = 0; i < 5; i++) {
        const record = new MultiGameRecord({
          userId: testUsers[0]._id,
          roomId: new mongoose.Types.ObjectId(),
          roomKey: `00000${i}`,
          gameRecords: [new mongoose.Types.ObjectId()],
          totalScore: 7000 + i * 100,
          isCompleted: true,
          finalRanking: 2
        });
        await record.save();
      }

      const history = await MultiGameService.getPlayerMultiGameHistory(testUsers[0]._id, 3);
      expect(history).toHaveLength(3);
    });
  });

  describe('getMultiGameStats', () => {
    beforeEach(async () => {
      // 複数の完了済みゲーム記録を作成
      const games = [
        { score: 10000, ranking: 1 }, // 1位
        { score: 8000, ranking: 2 },  // 2位
        { score: 9000, ranking: 1 },  // 1位
        { score: 7000, ranking: 3 }   // 3位
      ];

      for (const game of games) {
        const record = new MultiGameRecord({
          userId: testUsers[0]._id,
          roomId: new mongoose.Types.ObjectId(),
          roomKey: Math.random().toString().substring(2, 8),
          gameRecords: [new mongoose.Types.ObjectId()],
          totalScore: game.score,
          isCompleted: true,
          finalRanking: game.ranking,
          totalPlayers: 3
        });
        await record.save();
      }
    });

    test('マルチゲームの統計情報を正しく計算できる', async () => {
      const stats = await MultiGameService.getMultiGameStats(testUsers[0]._id);

      expect(stats.totalGames).toBe(4);
      expect(stats.averageScore).toBe(8500); // (10000+8000+9000+7000)/4
      expect(stats.averageRanking).toBe(1.75); // (1+2+1+3)/4
      expect(stats.winRate).toBe(50.0); // 2勝/4戦 = 50%
      expect(stats.bestScore).toBe(10000);
    });

    test('完了したゲームがない場合はゼロ値を返す', async () => {
      const stats = await MultiGameService.getMultiGameStats(testUsers[2]._id);

      expect(stats.totalGames).toBe(0);
      expect(stats.averageScore).toBe(0);
      expect(stats.averageRanking).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.bestScore).toBe(0);
    });
  });

  describe('エラーハンドリング', () => {
    test('無効なObjectIdでもエラーハンドリングされる', async () => {
      await expect(
        MultiGameService.startMultiGame('invalid-id', 35.6762, 139.6503, 35.6896, 139.7006)
      ).rejects.toThrow();
    });

    test('nullパラメータでもエラーハンドリングされる', async () => {
      await expect(
        MultiGameService.processPlayerGuess(null, testUsers[0]._id, 35.6762, 139.6503, false)
      ).rejects.toThrow();
    });
  });
});