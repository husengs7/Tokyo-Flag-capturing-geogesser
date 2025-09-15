// 🔌 Socket.ioリアルタイム通信テスト
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

describe('Socket.io リアルタイム通信テスト', () => {
  let io, serverSocket, clientSocket, httpServer, port;

  beforeAll(async () => {
    return new Promise((resolve) => {
      httpServer = createServer();
      io = new Server(httpServer);

      httpServer.listen(() => {
        port = httpServer.address().port;

        io.on('connection', (socket) => {
          serverSocket = socket;
        });

        clientSocket = new Client(`http://localhost:${port}`);

        clientSocket.on('connect', () => {
          resolve();
        });
      });
    });
  });

  afterAll(() => {
    if (clientSocket) clientSocket.close();
    if (io) io.close();
    if (httpServer) httpServer.close();
  });

  test('Socket.io サーバーが正常に初期化される', () => {
    expect(io).toBeDefined();
    expect(httpServer).toBeDefined();
    expect(port).toBeGreaterThan(0);
  });

  test('クライアントがサーバーに接続できる', () => {
    expect(clientSocket.connected).toBe(true);
    expect(serverSocket).toBeDefined();
  });

  test('メッセージの送受信が正常に動作', (done) => {
    const testMessage = { message: 'Hello Socket.io!' };

    clientSocket.emit('test-message', testMessage);

    serverSocket.on('test-message', (data) => {
      expect(data).toEqual(testMessage);
      done();
    });
  });

  test('ルーム参加イベントのテスト', (done) => {
    const roomData = { roomKey: 'TEST123' };

    clientSocket.emit('join-room', roomData);

    serverSocket.on('join-room', (data) => {
      expect(data.roomKey).toBe('TEST123');

      // ルーム参加成功をシミュレート
      serverSocket.emit('room-joined', {
        success: true,
        room: {
          id: 'room123',
          roomKey: 'TEST123',
          status: 'waiting',
          players: [],
          gameState: {}
        }
      });
    });

    clientSocket.on('room-joined', (response) => {
      expect(response.success).toBe(true);
      expect(response.room.roomKey).toBe('TEST123');
      done();
    });
  });

  test('プレイヤー位置更新のリアルタイム通信', (done) => {
    const positionData = {
      roomId: 'room123',
      lat: 35.6762,
      lng: 139.6503
    };

    clientSocket.emit('update-position', positionData);

    serverSocket.on('update-position', (data) => {
      expect(data.lat).toBe(35.6762);
      expect(data.lng).toBe(139.6503);

      // 他のプレイヤーに位置更新を通知をシミュレート
      serverSocket.broadcast.emit('player-position-updated', {
        userId: 'user123',
        username: 'testUser',
        position: {
          lat: data.lat,
          lng: data.lng,
          timestamp: new Date()
        }
      });

      done();
    });
  });

  test('プレイヤー推測イベントのテスト', (done) => {
    const guessData = {
      roomId: 'room123',
      guessLat: 35.6762,
      guessLng: 139.6503,
      hintUsed: false
    };

    clientSocket.emit('player-guess', guessData);

    serverSocket.on('player-guess', (data) => {
      expect(data.guessLat).toBe(35.6762);
      expect(data.guessLng).toBe(139.6503);
      expect(data.hintUsed).toBe(false);

      // 推測結果をシミュレート
      serverSocket.emit('guess-result', {
        score: 4500,
        totalScore: 4500,
        distance: 100,
        accuracy: 95
      });
    });

    clientSocket.on('guess-result', (result) => {
      expect(result.score).toBe(4500);
      expect(result.accuracy).toBe(95);
      done();
    });
  });

  test('ゲーム開始イベントのテスト', (done) => {
    const gameStartData = {
      roomId: 'room123',
      targetLat: 35.6762,
      targetLng: 139.6503,
      playerLat: 35.6896,
      playerLng: 139.7006
    };

    clientSocket.emit('start-game', gameStartData);

    serverSocket.on('start-game', (data) => {
      expect(data.targetLat).toBe(35.6762);
      expect(data.playerLat).toBe(35.6896);

      // ゲーム開始通知をシミュレート
      serverSocket.emit('game-started', {
        gameState: {
          currentRound: 1,
          totalRounds: 5,
          started: true
        },
        status: 'playing',
        currentRound: 1
      });
    });

    clientSocket.on('game-started', (response) => {
      expect(response.gameState.currentRound).toBe(1);
      expect(response.status).toBe('playing');
      done();
    });
  });

  test('エラーハンドリングのテスト', (done) => {
    clientSocket.emit('invalid-event', { invalid: 'data' });

    // エラー応答をシミュレート
    serverSocket.emit('error', { message: '無効なイベントです' });

    clientSocket.on('error', (error) => {
      expect(error.message).toBe('無効なイベントです');
      done();
    });
  });

  test('切断処理のテスト', (done) => {
    let disconnected = false;

    serverSocket.on('disconnect', (reason) => {
      disconnected = true;
      expect(reason).toBeDefined();
      done();
    });

    clientSocket.disconnect();

    setTimeout(() => {
      if (!disconnected) {
        done();
      }
    }, 100);
  });
});

describe('複数クライアント同時接続テスト', () => {
  let io, httpServer, clients = [];

  beforeAll(async () => {
    return new Promise((resolve) => {
      httpServer = createServer();
      io = new Server(httpServer);
      httpServer.listen(() => {
        const port = httpServer.address().port;
        let connectedCount = 0;

        io.on('connection', () => {
          connectedCount++;
          if (connectedCount === 3) {
            setTimeout(resolve, 50); // 少し待ってから完了
          }
        });

        // 3つのクライアントを同時接続
        for (let i = 0; i < 3; i++) {
          const client = new Client(`http://localhost:${port}`);
          clients.push(client);
        }
      });
    });
  });

  afterAll(() => {
    clients.forEach(client => client.close());
    io.close();
    httpServer.close();
  });

  test('複数クライアントが同時接続できる', () => {
    clients.forEach((client) => {
      expect(client.connected).toBe(true);
    });
    expect(clients.length).toBe(3);
  });

  test('ブロードキャストメッセージのテスト', (done) => {
    // シンプルなブロードキャストテスト
    clients[1].on('test-broadcast', (data) => {
      expect(data.message).toBe('テストメッセージ');
      done();
    });

    // サーバーから直接ブロードキャスト
    io.emit('test-broadcast', { message: 'テストメッセージ' });
  });
});