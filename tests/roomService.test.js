// 🏠 RoomService機能テスト
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const RoomService = require('../services/roomService');
const Room = require('../models/Room');
const User = require('../models/User');

describe('RoomService機能テスト', () => {
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
      const user = new User({ username: `roomuser${i}` });
      await user.save();
      testUsers.push(user);
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('createRoom', () => {
    test('新しいルームを作成できる', async () => {
      const room = await RoomService.createRoom(testUsers[0]._id);

      expect(room).toBeDefined();
      expect(room.hostId.toString()).toBe(testUsers[0]._id.toString());
      expect(room.players).toHaveLength(1);
      expect(room.players[0].isHost).toBe(true);
      expect(room.players[0].isReady).toBe(true);
      expect(room.status).toBe('waiting');
    });

    test('カスタム設定でルームを作成できる', async () => {
      const settings = {
        maxPlayers: 3,
        roundCount: 5
      };

      const room = await RoomService.createRoom(testUsers[0]._id, settings);

      expect(room.settings.maxPlayers).toBe(3);
      expect(room.settings.roundCount).toBe(5);
    });

    test('存在しないユーザーでルーム作成はエラー', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();

      await expect(
        RoomService.createRoom(fakeUserId)
      ).rejects.toThrow('ホストユーザーが見つかりません');
    });

    test('既に他のルームに参加しているユーザーはルーム作成不可', async () => {
      // 最初のルームを作成
      await RoomService.createRoom(testUsers[0]._id);

      // 同じユーザーで2つ目のルーム作成を試行
      await expect(
        RoomService.createRoom(testUsers[0]._id)
      ).rejects.toThrow('既に他のルームに参加しています');
    });
  });

  describe('joinRoom', () => {
    let hostRoom;

    beforeEach(async () => {
      hostRoom = await RoomService.createRoom(testUsers[0]._id);
    });

    test('ルームキーでルームに参加できる', async () => {
      const room = await RoomService.joinRoom(hostRoom.roomKey, testUsers[1]._id);

      expect(room.players).toHaveLength(2);
      expect(room.players[1].userId.toString()).toBe(testUsers[1]._id.toString());
      expect(room.players[1].username).toBe(testUsers[1].username);
      expect(room.players[1].isHost).toBe(false);
      expect(room.players[1].isReady).toBe(false);
    });

    test('存在しないルームキーでの参加はエラー', async () => {
      await expect(
        RoomService.joinRoom('999999', testUsers[1]._id)
      ).rejects.toThrow('ルームが見つかりません');
    });

    test('存在しないユーザーでの参加はエラー', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();

      await expect(
        RoomService.joinRoom(hostRoom.roomKey, fakeUserId)
      ).rejects.toThrow('ユーザーが見つかりません');
    });

    test('ゲーム中のルームには参加不可', async () => {
      hostRoom.status = 'playing';
      await hostRoom.save();

      await expect(
        RoomService.joinRoom(hostRoom.roomKey, testUsers[1]._id)
      ).rejects.toThrow('このルームは現在参加できません');
    });

    test('既に他のルームに参加しているユーザーは参加不可', async () => {
      // 2つ目のルームを作成
      const secondRoom = await RoomService.createRoom(testUsers[2]._id);

      // testUsers[1]を最初のルームに参加させる
      await RoomService.joinRoom(hostRoom.roomKey, testUsers[1]._id);

      // 同じユーザーで2つ目のルームに参加を試行
      await expect(
        RoomService.joinRoom(secondRoom.roomKey, testUsers[1]._id)
      ).rejects.toThrow('既に他のルームに参加しています');
    });

    test('満員のルームには参加不可', async () => {
      // 4人まで埋める（ホスト含めて）
      for (let i = 1; i < 4; i++) {
        await RoomService.joinRoom(hostRoom.roomKey, testUsers[i]._id);
      }

      // 5人目のユーザー作成
      const extraUser = new User({ username: 'extrauser' });
      await extraUser.save();

      await expect(
        RoomService.joinRoom(hostRoom.roomKey, extraUser._id)
      ).rejects.toThrow('ルームが満員です');
    });
  });

  describe('leaveRoom', () => {
    let room;

    beforeEach(async () => {
      room = await RoomService.createRoom(testUsers[0]._id);
      await RoomService.joinRoom(room.roomKey, testUsers[1]._id);
      await RoomService.joinRoom(room.roomKey, testUsers[2]._id);
    });

    test('ルームから正常に退出できる', async () => {
      // データベースから最新のルーム情報を取得
      const freshRoom = await Room.findById(room._id);
      expect(freshRoom.players).toHaveLength(3);

      const updatedRoom = await RoomService.leaveRoom(room._id, testUsers[1]._id);

      expect(updatedRoom.players).toHaveLength(2);
      expect(updatedRoom.players.find(p => p.userId.toString() === testUsers[1]._id.toString())).toBeUndefined();
    });

    test('ホストが退出すると新しいホストが選出される', async () => {
      // データベースから最新のルーム情報を取得
      const freshRoom = await Room.findById(room._id);
      expect(freshRoom.players).toHaveLength(3);

      const updatedRoom = await RoomService.leaveRoom(room._id, testUsers[0]._id);

      expect(updatedRoom.players).toHaveLength(2);
      expect(updatedRoom.players[0].isHost).toBe(true);
      expect(updatedRoom.players[0].userId.toString()).toBe(testUsers[1]._id.toString());
    });

    test('全員退出するとルームが削除される', async () => {
      // 順番に退出して最終的にルームを削除
      const roomId = room._id;
      await RoomService.leaveRoom(roomId, testUsers[0]._id);
      await RoomService.leaveRoom(roomId, testUsers[1]._id);
      const result = await RoomService.leaveRoom(roomId, testUsers[2]._id);

      expect(result).toBeNull();

      // ルームが実際に削除されているか確認
      const deletedRoom = await Room.findById(roomId);
      expect(deletedRoom).toBeNull();
    });

    test('参加していないユーザーの退出はエラー', async () => {
      await expect(
        RoomService.leaveRoom(room._id, testUsers[3]._id)
      ).rejects.toThrow('このルームに参加していません');
    });

    test('存在しないルームからの退出はエラー', async () => {
      const fakeRoomId = new mongoose.Types.ObjectId();

      await expect(
        RoomService.leaveRoom(fakeRoomId, testUsers[0]._id)
      ).rejects.toThrow('ルームが見つかりません');
    });
  });

  describe('setPlayerReady', () => {
    let room;

    beforeEach(async () => {
      room = await RoomService.createRoom(testUsers[0]._id);
      await RoomService.joinRoom(room.roomKey, testUsers[1]._id);
    });

    test('プレイヤーの準備状態を設定できる', async () => {
      // データベースから最新のルーム情報を取得
      const freshRoom = await Room.findById(room._id);
      expect(freshRoom.players).toHaveLength(2);

      const updatedRoom = await RoomService.setPlayerReady(room._id, testUsers[1]._id, true);

      const player = updatedRoom.players.find(p => p.userId.toString() === testUsers[1]._id.toString());
      expect(player.isReady).toBe(true);
    });

    test('準備状態を解除できる', async () => {
      // データベースから最新のルーム情報を取得
      const freshRoom = await Room.findById(room._id);
      expect(freshRoom.players).toHaveLength(2);

      // 最初にready状態にする
      await RoomService.setPlayerReady(room._id, testUsers[1]._id, true);

      // 準備状態を解除
      const updatedRoom = await RoomService.setPlayerReady(room._id, testUsers[1]._id, false);

      const player = updatedRoom.players.find(p => p.userId.toString() === testUsers[1]._id.toString());
      expect(player.isReady).toBe(false);
    });

    test('参加していないプレイヤーの準備状態設定はエラー', async () => {
      await expect(
        RoomService.setPlayerReady(room._id, testUsers[3]._id, true)
      ).rejects.toThrow('このルームに参加していません');
    });
  });

  describe('getRoomInfo と getRoomByKey', () => {
    let room;

    beforeEach(async () => {
      room = await RoomService.createRoom(testUsers[0]._id);
    });

    test('ルームIDでルーム情報を取得できる', async () => {
      const roomInfo = await RoomService.getRoomInfo(room._id);

      expect(roomInfo._id.toString()).toBe(room._id.toString());
      expect(roomInfo.hostId).toBeDefined();
      expect(roomInfo.players).toHaveLength(1);
    });

    test('ルームキーでルーム情報を取得できる', async () => {
      const roomInfo = await RoomService.getRoomByKey(room.roomKey);

      expect(roomInfo.roomKey).toBe(room.roomKey);
      expect(roomInfo._id.toString()).toBe(room._id.toString());
    });

    test('存在しないルームIDでの取得はエラー', async () => {
      const fakeRoomId = new mongoose.Types.ObjectId();

      await expect(
        RoomService.getRoomInfo(fakeRoomId)
      ).rejects.toThrow('ルームが見つかりません');
    });

    test('存在しないルームキーでの取得はエラー', async () => {
      await expect(
        RoomService.getRoomByKey('999999')
      ).rejects.toThrow('ルームが見つかりません');
    });
  });

  describe('updatePlayerPosition', () => {
    let room;

    beforeEach(async () => {
      room = await RoomService.createRoom(testUsers[0]._id);
    });

    test('プレイヤーの位置情報を更新できる', async () => {
      // データベースから最新のルーム情報を取得
      const freshRoom = await Room.findById(room._id);
      expect(freshRoom.players).toHaveLength(1);

      const lat = 35.6762;
      const lng = 139.6503;

      const updatedRoom = await RoomService.updatePlayerPosition(room._id, testUsers[0]._id, lat, lng);

      const player = updatedRoom.players[0];
      expect(player.currentPosition.lat).toBe(lat);
      expect(player.currentPosition.lng).toBe(lng);
      expect(player.currentPosition.timestamp).toBeInstanceOf(Date);
    });

    test('参加していないプレイヤーの位置更新はエラー', async () => {
      await expect(
        RoomService.updatePlayerPosition(room._id, testUsers[1]._id, 35.6762, 139.6503)
      ).rejects.toThrow('このルームに参加していません');
    });
  });

  describe('setPlayerGuessed', () => {
    let room;

    beforeEach(async () => {
      room = await RoomService.createRoom(testUsers[0]._id);
      await RoomService.joinRoom(room.roomKey, testUsers[1]._id);
      room.status = 'playing';
      await room.save();
    });

    test('プレイヤーの推測状態を設定できる', async () => {
      // データベースから最新のルーム情報を取得
      const freshRoom = await Room.findById(room._id);
      expect(freshRoom.players).toHaveLength(2);

      const updatedRoom = await RoomService.setPlayerGuessed(room._id, testUsers[0]._id, true);

      const player = updatedRoom.players.find(p => p.userId.toString() === testUsers[0]._id.toString());
      expect(player.hasGuessed).toBe(true);
    });

    test('全員が推測完了するとランキング状態になる', async () => {
      // データベースから最新のルーム情報を取得
      const freshRoom = await Room.findById(room._id);
      expect(freshRoom.players).toHaveLength(2);

      // 両方のプレイヤーが推測完了
      await RoomService.setPlayerGuessed(room._id, testUsers[0]._id, true);
      const updatedRoom = await RoomService.setPlayerGuessed(room._id, testUsers[1]._id, true);

      expect(updatedRoom.status).toBe('ranking');
      expect(updatedRoom.gameState.allPlayersGuessed).toBe(true);
      expect(updatedRoom.gameState.rankingDisplayUntil).toBeInstanceOf(Date);
    });
  });

  describe('getActiveRooms', () => {
    test('アクティブなルーム一覧を取得できる', async () => {
      // 複数のルームを作成
      const room1 = await RoomService.createRoom(testUsers[0]._id);
      const room2 = await RoomService.createRoom(testUsers[1]._id);

      // 1つのルームを完了状態にする
      room1.status = 'finished';
      await room1.save();

      const activeRooms = await RoomService.getActiveRooms();

      expect(activeRooms).toHaveLength(1);
      expect(activeRooms[0]._id.toString()).toBe(room2._id.toString());
    });

    test('アクティブなルームがない場合は空配列を返す', async () => {
      const activeRooms = await RoomService.getActiveRooms();
      expect(activeRooms).toHaveLength(0);
    });
  });

  describe('cleanupOldRooms', () => {
    test('古いルームを削除できる', async () => {
      // ルームを作成
      const room = await RoomService.createRoom(testUsers[0]._id);

      // ルームを完了状態にして古い日時に設定（pre-saveフックを回避するため直接DBを更新）
      await Room.findByIdAndUpdate(room._id, {
        status: 'finished',
        updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25時間前
      });

      const deletedCount = await RoomService.cleanupOldRooms(24);

      expect(deletedCount).toBe(1);

      // ルームが削除されているか確認
      const deletedRoom = await Room.findById(room._id);
      expect(deletedRoom).toBeNull();
    });

    test('古くないルームは削除されない', async () => {
      const room = await RoomService.createRoom(testUsers[0]._id);

      const deletedCount = await RoomService.cleanupOldRooms(24);

      expect(deletedCount).toBe(0);

      // ルームが残っているか確認
      const existingRoom = await Room.findById(room._id);
      expect(existingRoom).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    test('無効なObjectIdでもエラーハンドリングされる', async () => {
      // 無効なObjectId形式
      await expect(
        RoomService.getRoomInfo('invalid-id')
      ).rejects.toThrow();
    });

    test('nullパラメータでもエラーハンドリングされる', async () => {
      await expect(
        RoomService.createRoom(null)
      ).rejects.toThrow();
    });
  });
});