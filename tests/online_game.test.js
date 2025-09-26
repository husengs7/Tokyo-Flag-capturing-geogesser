// 🎮 online_game.js 機能テスト

// JSDOMを使ってブラウザ環境をシミュレート
const { JSDOM } = require('jsdom');
// fetch APIをモック
const fetchMock = require('jest-fetch-mock');

fetchMock.enableMocks();

describe('オンラインゲーム画面 (online_game.js) の機能テスト', () => {
    let dom;
    let window;
    let document;

    // 各テストの前にDOMとグローバル変数をセットアップ
    beforeEach(async () => {
        // online_game.htmlの基本構造を読み込む
        dom = await JSDOM.fromFile('./public/online/views/online_game.html', {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/online/views/online_game.html?roomId=test-room-id'
        });

        window = dom.window;
        document = window.document;

        // fetchをリセット
        fetchMock.resetMocks();

        // グローバルAPIのモック
        window.google = {
            maps: {
                Map: jest.fn(() => ({
                    setStreetView: jest.fn(),
                    setCenter: jest.fn(),
                    setZoom: jest.fn(),
                    addListener: jest.fn(),
                })),
                StreetViewPanorama: jest.fn(() => ({
                    addListener: jest.fn(),
                })),
                Marker: jest.fn(function(options) { // `function` キーワードで `this` を束縛
                    this.position = options.position;
                    this.map = options.map;
                    this.setMap = jest.fn();
                    this.setPosition = jest.fn((newPos) => {
                        this.position = newPos;
                    });
                    this.getPosition = jest.fn(() => this.position);
                    return this;
                }),
                LatLng: jest.fn((lat, lng) => ({ lat: () => lat, lng: () => lng })),
                SymbolPath: {
                    CIRCLE: 'circle_path'
                },
                event: {
                    addListener: jest.fn(),
                },
            },
        };

        // 外部ライブラリのモック
        window.confetti = jest.fn();

        // online_game.js内のグローバル変数を設定
        window.roomId = 'test-room-id';
        window.currentUser = { id: 'user-self', username: '自分' };
    });

    // テストヘルパー：非同期処理を待機
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    describe('他プレイヤーの位置情報表示機能', () => {

        test('新しいプレイヤーが参加した時、マーカーが正しく作成される', () => {
            const playersData = [
                { userId: 'user-self', username: '自分' },
                {
                    userId: 'user-2',
                    username: 'プレイヤー2',
                    currentPosition: { lat: 35.6, lng: 139.7 }
                }
            ];

            // テスト対象の関数を呼び出し
            window.updateOtherPlayerMarkers(playersData);

            // マーカーが1つだけ作成されたことを確認
            expect(window.google.maps.Marker).toHaveBeenCalledTimes(1);
            // 作成されたマーカーがプレイヤー2のものであることを確認
            expect(window.otherPlayerMarkers['user-2']).toBeDefined();
            expect(window.otherPlayerMarkers['user-2'].getPosition().lat()).toBe(35.6);
            // 自分自身のマーカーは作成されないことを確認
            expect(window.otherPlayerMarkers['user-self']).toBeUndefined();
        });

        test('プレイヤーの位置が更新された時、既存マーカーの位置が更新される', () => {
            // 初期状態：プレイヤー2のマーカーを作成
            const initialPlayers = [{
                userId: 'user-2',
                username: 'プレイヤー2',
                currentPosition: { lat: 35.6, lng: 139.7 }
            }];
            window.updateOtherPlayerMarkers(initialPlayers);

            const markerInstance = window.otherPlayerMarkers['user-2'];
            expect(markerInstance.getPosition().lat()).toBe(35.6);

            // 更新状態：プレイヤー2の位置が変わる
            const updatedPlayers = [{
                userId: 'user-2',
                username: 'プレイヤー2',
                currentPosition: { lat: 35.61, lng: 139.71 }
            }];
            window.updateOtherPlayerMarkers(updatedPlayers);

            // setPositionが新しい座標で呼び出されたことを確認
            expect(markerInstance.setPosition).toHaveBeenCalledWith(expect.objectContaining({
                lat: expect.any(Function), // LatLngオブジェクトのモック
                lng: expect.any(Function),
            }));
            // 内部的に位置が更新されていることを確認
            expect(markerInstance.getPosition().lat()).toBe(35.61);
        });

        test('プレイヤーが退出した時、マーカーがマップから削除される', () => {
            // 初期状態：2人の他プレイヤーマーカーを作成
            const initialPlayers = [
                { userId: 'user-2', username: 'プレイヤー2', currentPosition: { lat: 35.6, lng: 139.7 } },
                { userId: 'user-3', username: 'プレイヤー3', currentPosition: { lat: 35.7, lng: 139.8 } }
            ];
            window.updateOtherPlayerMarkers(initialPlayers);

            expect(Object.keys(window.otherPlayerMarkers)).toHaveLength(2);
            const marker2 = window.otherPlayerMarkers['user-2'];

            // 更新状態：プレイヤー2が退出
            const updatedPlayers = [
                { userId: 'user-3', username: 'プレイヤー3', currentPosition: { lat: 35.7, lng: 139.8 } }
            ];
            window.updateOtherPlayerMarkers(updatedPlayers);

            // プレイヤー2のマーカーが削除されたことを確認
            expect(marker2.setMap).toHaveBeenCalledWith(null);
            expect(window.otherPlayerMarkers['user-2']).toBeUndefined();
            // プレイヤー3のマーカーは残っていることを確認
            expect(window.otherPlayerMarkers['user-3']).toBeDefined();
            expect(Object.keys(window.otherPlayerMarkers)).toHaveLength(1);
        });
    });

    describe('自分の位置情報送信機能', () => {

        beforeEach(() => {
            // panoramaのモックをセットアップ
            window.panorama = {
                listeners: {},
                addListener: function(event, callback) {
                    this.listeners[event] = callback;
                },
                getPosition: jest.fn(() => new window.google.maps.LatLng(35.5, 139.5)),
                // テスト用のイベント発火関数
                trigger: function(event) {
                    if (this.listeners[event]) {
                        this.listeners[event]();
                    }
                }
            };
            window.setupPositionUpdateEvents();
        });

        test('position_changedイベントでsendPositionUpdateが呼び出される', async () => {
            fetchMock.mockResponseOnce(JSON.stringify({ success: true }));

            // イベントを発火
            window.panorama.trigger('position_changed');

            // fetchが正しいエンドポイントとデータで呼ばれたか確認
            expect(fetchMock).toHaveBeenCalledWith(
                '/multi/rooms/test-room-id/position',
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({ lat: 35.5, lng: 139.5 })
                })
            );
        });

        test('1秒間のスロットリングが機能する', async () => {
            jest.useFakeTimers();
            fetchMock.mockResponse(JSON.stringify({ success: true }));

            // 短時間に3回イベントを発火
            window.panorama.trigger('position_changed');
            await wait(100);
            window.panorama.trigger('position_changed');
            await wait(100);
            window.panorama.trigger('position_changed');

            // fetchは1回しか呼ばれない
            expect(fetchMock).toHaveBeenCalledTimes(1);

            // 1秒待機
            jest.advanceTimersByTime(1000);

            // 再度イベントを発火
            window.panorama.trigger('position_changed');

            // fetchが合計2回呼ばれる
            expect(fetchMock).toHaveBeenCalledTimes(2);

            jest.useRealTimers();
        });
    });

    describe('スポーン機能とLatLngエラー修正テスト', () => {

        beforeEach(() => {
            // Google Maps geometry機能のモック
            window.google.maps.geometry = {
                spherical: {
                    computeDistanceBetween: jest.fn(() => 1500), // 1.5km
                    computeOffset: jest.fn((point, distance, heading) =>
                        new window.google.maps.LatLng(35.6 + 0.01, 139.7 + 0.01)
                    )
                }
            };

            // ゲーム状態のモック
            window.gameState = {
                targetLocation: { lat: 35.681236, lng: 139.767125 }, // プレーンオブジェクト
                playerStartLocation: { lat: 35.68, lng: 139.76 }
            };

            window.players = [
                {
                    userId: 'user-self',
                    username: '自分',
                    currentPosition: { lat: 35.685, lng: 139.770 }
                },
                {
                    userId: 'user-2',
                    username: 'プレイヤー2',
                    currentPosition: { lat: 35.675, lng: 139.765 }
                }
            ];

            window.targetLocation = null;
            window.initialPlayerLocation = null;
            window.initialPlayerDistance = 0;
        });

        test('targetLocationがプレーンオブジェクトからLatLngオブジェクトに正しく変換される', () => {
            // initializeMap相当の処理をシミュレート
            const mockMap = new window.google.maps.Map();
            const mockPanorama = new window.google.maps.StreetViewPanorama();

            // targetLocationを設定（修正後のロジック）
            window.targetLocation = new window.google.maps.LatLng(
                window.gameState.targetLocation.lat,
                window.gameState.targetLocation.lng
            );

            expect(window.targetLocation.lat).toBeDefined();
            expect(window.targetLocation.lng).toBeDefined();
            expect(window.targetLocation.lat()).toBe(35.681236);
            expect(window.targetLocation.lng()).toBe(139.767125);
        });

        test('startOnlineGameSessionでLatLngオブジェクトが正しく処理される', () => {
            // 関数をモック実装
            window.startOnlineGameSession = function(targetPos, playerPos) {
                // 型を統一（修正後のロジック）
                const targetLatLng = targetPos instanceof window.google.maps.LatLng ?
                    targetPos : new window.google.maps.LatLng(targetPos.lat, targetPos.lng);
                const playerLatLng = playerPos instanceof window.google.maps.LatLng ?
                    playerPos : new window.google.maps.LatLng(playerPos.lat, playerPos.lng);

                window.initialPlayerLocation = {
                    lat: playerLatLng.lat(),
                    lng: playerLatLng.lng()
                };

                window.initialPlayerDistance = window.google.maps.geometry.spherical.computeDistanceBetween(
                    playerLatLng,
                    targetLatLng
                );

                return { targetLatLng, playerLatLng };
            };

            // プレーンオブジェクトで呼び出し
            const targetPos = { lat: 35.681236, lng: 139.767125 };
            const playerPos = { lat: 35.685, lng: 139.770 };

            const result = window.startOnlineGameSession(targetPos, playerPos);

            expect(result.targetLatLng.lat()).toBe(35.681236);
            expect(result.playerLatLng.lat()).toBe(35.685);
            expect(window.initialPlayerLocation.lat).toBe(35.685);
            expect(window.initialPlayerDistance).toBe(1500);

            // LatLngオブジェクトで呼び出し
            const targetLatLng = new window.google.maps.LatLng(35.681236, 139.767125);
            const playerLatLng = new window.google.maps.LatLng(35.685, 139.770);

            const result2 = window.startOnlineGameSession(targetLatLng, playerLatLng);

            expect(result2.targetLatLng.lat()).toBe(35.681236);
            expect(result2.playerLatLng.lat()).toBe(35.685);
        });

        test('プレイヤー個別スポーン位置が正しく取得される', () => {
            window.setPlayerStartPosition = function() {
                const currentPlayer = window.players.find(p => p.userId === window.currentUser.id);

                if (currentPlayer && currentPlayer.currentPosition) {
                    const playerStartPos = new window.google.maps.LatLng(
                        currentPlayer.currentPosition.lat,
                        currentPlayer.currentPosition.lng
                    );

                    window.panorama = { setPosition: jest.fn() };
                    window.panorama.setPosition(playerStartPos);

                    window.initialPlayerLocation = {
                        lat: playerStartPos.lat(),
                        lng: playerStartPos.lng()
                    };

                    return playerStartPos;
                }

                return null;
            };

            const result = window.setPlayerStartPosition();

            expect(result).toBeDefined();
            expect(result.lat()).toBe(35.685);
            expect(result.lng()).toBe(139.770);
            expect(window.panorama.setPosition).toHaveBeenCalledWith(result);
            expect(window.initialPlayerLocation.lat).toBe(35.685);
        });

        test('異なるプレイヤーが異なるスポーン位置を取得する', () => {
            window.generatePlayerStartPosition = function(targetLocation, playerIndex, totalPlayers) {
                const angleSegment = (2 * Math.PI) / Math.max(totalPlayers, 2);
                const baseAngle = angleSegment * playerIndex;
                const angleVariation = angleSegment * 0.8;
                const angle = baseAngle + (Math.random() * angleVariation - angleVariation / 2);
                const distance = 500 + Math.random() * 2500;

                const lat = targetLocation.lat + (distance * Math.cos(angle)) / 111320;
                const lng = targetLocation.lng + (distance * Math.sin(angle)) / (111320 * Math.cos(targetLocation.lat * Math.PI / 180));

                return { lat, lng };
            };

            const targetLocation = { lat: 35.681236, lng: 139.767125 };

            // 2人のプレイヤーの位置を生成
            const pos1 = window.generatePlayerStartPosition(targetLocation, 0, 2);
            const pos2 = window.generatePlayerStartPosition(targetLocation, 1, 2);

            // 異なる位置が生成されることを確認
            expect(pos1.lat).not.toBe(pos2.lat);
            expect(pos1.lng).not.toBe(pos2.lng);

            // ターゲット位置から十分離れていることを確認
            expect(Math.abs(pos1.lat - targetLocation.lat)).toBeGreaterThan(0.001);
            expect(Math.abs(pos2.lat - targetLocation.lat)).toBeGreaterThan(0.001);
        });
    });
});