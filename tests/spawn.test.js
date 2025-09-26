// 🎮 スポーン機能テスト (online_lobby.html)

const { JSDOM } = require('jsdom');
const fetchMock = require('jest-fetch-mock');

fetchMock.enableMocks();

describe('個別ランダムスポーン機能 (online_lobby.html)', () => {
    let dom;
    let window;
    let document;

    // 各テストの前にDOMとグローバル変数をセットアップ
    beforeEach(async () => {
        // online_lobby.htmlの基本構造を読み込む
        dom = await JSDOM.fromFile('./public/online/views/online_lobby.html', {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost/online/views/online_lobby.html?roomId=test-spawn-room'
        });

        window = dom.window;
        document = window.document;

        // fetchをリセット
        fetchMock.resetMocks();

        // online_lobby.js内のグローバル変数を設定
        window.roomId = 'test-spawn-room';
        window.currentUser = { id: 'user-host', username: 'ホスト' };
        window.isHost = true;
    });

    // テストヘルパー：非同期処理を待機
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    describe('startGame Function', () => {

        test('各プレイヤーに個別のスポーン地点を生成し、ゲーム開始APIを呼び出す', async () => {
            // モックするプレイヤーデータ
            const mockPlayers = [
                { userId: { _id: 'user-host' }, username: 'ホスト' },
                { userId: { _id: 'user-2' }, username: 'プレイヤー2' }
            ];

            // APIコールをモック
            fetchMock.mockResponse(async req => {
                if (req.url.includes('/api/streetview/check')) {
                    // StreetViewチェックは常に成功させる
                    const body = await req.json();
                    return JSON.stringify({
                        success: true,
                        data: {
                            status: 'OK',
                            location: { lat: body.lat, lng: body.lng }
                        }
                    });
                }
                if (req.url.includes(`/multi/rooms/${window.roomId}`)) {
                    // プレイヤー情報取得API
                    return JSON.stringify({
                        success: true,
                        data: { players: mockPlayers }
                    });
                }
                if (req.url.includes(`/multi/rooms/${window.roomId}/start`)) {
                    // ゲーム開始API
                    return JSON.stringify({ success: true });
                }
                return JSON.stringify({ success: false, message: 'Mock not found' });
            });

            // startGame関数を実行
            await window.startGame();

            // ゲーム開始APIが呼び出されたことを確認
            const startCall = fetchMock.mock.calls.find(call => call[0].includes('/start'));
            expect(startCall).toBeDefined();

            // 送信されたリクエストボディを解析
            const body = JSON.parse(startCall[1].body);

            // 1. targetLocationが生成されているか
            expect(body.targetLocation).toBeDefined();
            expect(body.targetLocation).toHaveProperty('lat');
            expect(body.targetLocation).toHaveProperty('lng');

            // 2. playerStartDataが正しい形式か
            expect(body.playerStartData).toBeInstanceOf(Array);
            expect(body.playerStartData).toHaveLength(2);

            // 3. 各プレイヤーのデータが正しいか
            const hostData = body.playerStartData.find(p => p.userId === 'user-host');
            const playerData = body.playerStartData.find(p => p.userId === 'user-2');

            expect(hostData).toBeDefined();
            expect(hostData.startLocation).toHaveProperty('lat');
            expect(hostData.startLocation).toHaveProperty('lng');

            expect(playerData).toBeDefined();
            expect(playerData.startLocation).toHaveProperty('lat');
            expect(playerData.startLocation).toHaveProperty('lng');

            // 4. 2人のスポーン地点が異なることを確認（高確率で異なるはず）
            expect(hostData.startLocation.lat).not.toBe(playerData.startLocation.lat);
            expect(hostData.startLocation.lng).not.toBe(playerData.startLocation.lng);

            // 5. UIが更新されているか
            const startBtn = document.getElementById('ready-btn');
            expect(startBtn.textContent).toContain('ゲームを開始中...');
        });

        test('プレイヤー情報取得に失敗した場合、エラーを表示して処理を中断する', async () => {
            // プレイヤー情報取得APIを失敗させる
            fetchMock.mockResponseOnce(JSON.stringify({ success: false, message: 'DBエラー' }));

            // エラー表示関数のモック
            window.showError = jest.fn();

            // startGame関数を実行
            await window.startGame();

            // ゲーム開始APIは呼び出されない
            const startCall = fetchMock.mock.calls.find(call => call[0].includes('/start'));
            expect(startCall).toBeUndefined();

            // エラーメッセージが表示される
            expect(window.showError).toHaveBeenCalledWith(expect.stringContaining('プレイヤー情報の取得に失敗しました'));

            // ボタンが操作可能に戻る
            const startBtn = document.getElementById('ready-btn');
            expect(startBtn.disabled).toBe(false);
        });
    });
});