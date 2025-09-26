// オンライン マルチプレイ ゲーム用JavaScript
// game.jsの機能をベースにマルチプレイ対応機能を追加

// グローバル変数
let map;
let panorama;
let streetViewService;
let targetLocation;
let flagMarker;
let playerMarker;
let connectionLine;
let distanceCircle;
let distanceRevealed = false;
let hintUsed = false;
let respawnCount = 0;
let initialPlayerLocation = null;
let retryCount = 0;
let initialPlayerDistance = 0;
let hintUpdateInterval = null;
let hintTimer = null;
let hintCircle = null;
let hintTimeLeft = 10;
let hintCountdownInterval = null;
let countdownElement = null;
let memoMarkers = [];
let memoMode = false;
let longPressTimer = null;
const MAX_RETRIES = 10;
const SCORE_CONSTANT = 3;

// 東京23区の正確な境界ポリゴン定義（game.jsと同一）
const TOKYO_23_WARDS_POLYGON = [
    // 千代田区・中央区・港区エリア（南東から時計回り）
    [35.676, 139.692], [35.690, 139.701], [35.695, 139.715], [35.686, 139.723],
    [35.680, 139.740], [35.670, 139.748], [35.660, 139.752], [35.648, 139.747],
    [35.642, 139.737], [35.639, 139.725], [35.645, 139.710],

    // 新宿区・渋谷区エリア（西部）
    [35.658, 139.690], [35.670, 139.685], [35.685, 139.690], [35.693, 139.678],
    [35.702, 139.683], [35.708, 139.695], [35.715, 139.702], [35.720, 139.715],

    // 豊島区・文京区エリア（中央北部）
    [35.728, 139.720], [35.735, 139.710], [35.742, 139.715], [35.748, 139.725],
    [35.755, 139.735], [35.762, 139.745], [35.768, 139.752],

    // 北区・荒川区・台東区エリア（北部）
    [35.775, 139.758], [35.785, 139.765], [35.795, 139.772], [35.805, 139.780],
    [35.815, 139.785], [35.825, 139.792], [35.835, 139.800],

    // 足立区・葛飾区エリア（北東部）
    [35.845, 139.808], [35.855, 139.815], [35.865, 139.825], [35.872, 139.835],
    [35.878, 139.845], [35.882, 139.855], [35.885, 139.865],

    // 江戸川区エリア（東部）
    [35.880, 139.870], [35.875, 139.875], [35.868, 139.868], [35.860, 139.860],
    [35.850, 139.855], [35.840, 139.848], [35.828, 139.842],

    // 江東区・墨田区エリア（東部から南下）
    [35.815, 139.835], [35.805, 139.828], [35.795, 139.820], [35.785, 139.812],
    [35.775, 139.805], [35.765, 139.798], [35.755, 139.792],

    // 中央区・港区南部（東京湾沿い）
    [35.745, 139.785], [35.735, 139.778], [35.725, 139.770], [35.715, 139.762],
    [35.705, 139.755], [35.695, 139.748], [35.685, 139.742],

    // 品川区・大田区エリア（南部）
    [35.675, 139.735], [35.665, 139.728], [35.655, 139.720], [35.645, 139.712],
    [35.635, 139.705], [35.625, 139.698], [35.615, 139.692],

    // 大田区南西部
    [35.605, 139.685], [35.595, 139.678], [35.585, 139.672], [35.575, 139.665],
    [35.565, 139.658], [35.555, 139.652], [35.545, 139.645],

    // 世田谷区・目黒区エリア（西部）
    [35.540, 139.638], [35.545, 139.628], [35.552, 139.618], [35.560, 139.608],
    [35.570, 139.598], [35.580, 139.590], [35.590, 139.582],

    // 世田谷区北部・杉並区エリア
    [35.600, 139.575], [35.610, 139.568], [35.620, 139.562], [35.630, 139.555],
    [35.640, 139.550], [35.650, 139.545], [35.660, 139.540],

    // 中野区・新宿区西部
    [35.670, 139.535], [35.680, 139.530], [35.688, 139.538], [35.695, 139.548],
    [35.702, 139.558], [35.708, 139.568], [35.715, 139.578],

    // 豊島区・板橋区・練馬区エリア（北西部）
    [35.722, 139.588], [35.730, 139.598], [35.738, 139.608], [35.745, 139.618],
    [35.752, 139.628], [35.760, 139.638], [35.768, 139.648],

    // 板橋区・北区エリア（北部）
    [35.775, 139.658], [35.782, 139.668], [35.788, 139.678], [35.795, 139.688],
    [35.802, 139.698], [35.808, 139.708], [35.815, 139.718],

    // 最初の点に戻る
    [35.676, 139.692]
];

// 主要な水域の除外ポリゴン（game.jsと同一）
const WATER_EXCLUSION_ZONES = [
    // 東京湾
    {
        name: "東京湾",
        polygon: [
            [35.530, 139.750], [35.530, 139.870], [35.620, 139.870],
            [35.630, 139.820], [35.640, 139.780], [35.650, 139.760]
        ]
    },
    // 隅田川
    {
        name: "隅田川",
        polygon: [
            [35.660, 139.780], [35.665, 139.785], [35.720, 139.800],
            [35.750, 139.810], [35.760, 139.815], [35.758, 139.820],
            [35.718, 139.805], [35.663, 139.785], [35.658, 139.782]
        ]
    },
    // 荒川
    {
        name: "荒川",
        polygon: [
            [35.760, 139.815], [35.780, 139.825], [35.820, 139.845],
            [35.850, 139.865], [35.852, 139.870], [35.848, 139.872],
            [35.818, 139.850], [35.778, 139.830], [35.758, 139.820]
        ]
    },
    // 皇居周辺の濠
    {
        name: "皇居濠",
        polygon: [
            [35.679, 139.744], [35.685, 139.750], [35.690, 139.756],
            [35.688, 139.762], [35.682, 139.760], [35.677, 139.754]
        ]
    }
];

// 点がポリゴン内にあるかチェック（Ray Casting Algorithm）
const pointInPolygon = (lat, lng, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i][0] > lat) !== (polygon[j][0] > lat)) &&
            (lng < (polygon[j][1] - polygon[i][1]) * (lat - polygon[i][0]) / (polygon[j][0] - polygon[i][0]) + polygon[i][1])) {
            inside = !inside;
        }
    }
    return inside;
};

// 東京23区内かつ水域でない場所の判定
const isValidLocation = (lat, lng) => {
    // 東京23区内チェック
    if (!pointInPolygon(lat, lng, TOKYO_23_WARDS_POLYGON)) {
        return false;
    }

    // 水域除外チェック
    for (const waterZone of WATER_EXCLUSION_ZONES) {
        if (pointInPolygon(lat, lng, waterZone.polygon)) {
            return false;
        }
    }

    return true;
};

// 主要道路周辺の優先座標範囲
const MAJOR_ROAD_ZONES = [
    // 山手線周辺エリア
    { center: [35.681, 139.767], radius: 800, weight: 3 }, // 東京駅
    { center: [35.689, 139.692], radius: 600, weight: 3 }, // 新宿駅
    { center: [35.659, 139.701], radius: 600, weight: 3 }, // 渋谷駅
    { center: [35.729, 139.731], radius: 500, weight: 2 }, // 池袋駅
    { center: [35.630, 139.740], radius: 500, weight: 2 }, // 品川駅
    { center: [35.670, 139.802], radius: 500, weight: 2 }, // 錦糸町駅

    // 主要幹線道路沿い
    { center: [35.696, 139.614], radius: 400, weight: 2 }, // 環七沿い(杉並)
    { center: [35.738, 139.669], radius: 400, weight: 2 }, // 環八沿い(板橋)
    { center: [35.643, 139.716], radius: 400, weight: 2 }, // 目黒通り沿い
    { center: [35.712, 139.610], radius: 400, weight: 2 }, // 青梅街道沿い

    // 商業地区
    { center: [35.700, 139.773], radius: 300, weight: 1 }, // 上野
    { center: [35.646, 139.710], radius: 300, weight: 1 }, // 恵比寿
    { center: [35.665, 139.731], radius: 300, weight: 1 }, // 六本木
    { center: [35.667, 139.650], radius: 300, weight: 1 }, // 下北沢
];

// 重み付きランダム座標生成
const generateWeightedRandomLocation = () => {
    // 重みに基づいてエリアを選択
    const totalWeight = MAJOR_ROAD_ZONES.reduce((sum, zone) => sum + zone.weight, 0);
    let randomWeight = Math.random() * totalWeight;

    let selectedZone = MAJOR_ROAD_ZONES[0];
    for (const zone of MAJOR_ROAD_ZONES) {
        randomWeight -= zone.weight;
        if (randomWeight <= 0) {
            selectedZone = zone;
            break;
        }
    }

    // 選択されたエリア内でランダム座標生成
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * selectedZone.radius;
    const lat = selectedZone.center[0] + (distance * Math.cos(angle)) / 111320;
    const lng = selectedZone.center[1] + (distance * Math.sin(angle)) / (111320 * Math.cos(selectedZone.center[0] * Math.PI / 180));

    return { lat, lng };
};

// オンライン用変数
let roomId = null;
let currentUser = null;
let currentRound = 1;
let totalRounds = 3;
let roomKey = '';
let players = [];
let gameState = null;
let pollInterval = null;
let hasSubmittedGuess = false;
let isGameComplete = false;

// WebSocket関連
let socket = null;
let playerPositionMarkers = new Map(); // 他プレイヤーの位置マーカー管理
let positionUpdateInterval = null; // 定期的な位置送信用

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Online game page loading...');

    try {
        // URLパラメータからルームIDを取得
        const urlParams = new URLSearchParams(window.location.search);
        roomId = urlParams.get('roomId');

        if (!roomId) {
            showError('ルームIDが指定されていません');
            return;
        }

        // 認証状態を確認
        const authResponse = await fetch('/auth/me', {
            credentials: 'include'
        });

        if (!authResponse.ok) {
            window.location.href = '/login';
            return;
        }

        const authData = await authResponse.json();
        if (!authData.success || !authData.data) {
            window.location.href = '/login';
            return;
        }

        currentUser = authData.data;
        console.log('Current user:', currentUser);

        // ダークモードの初期化
        initializeDarkMode();

        // WebSocket接続初期化
        initializeWebSocket();

        // イベントリスナーの設定
        setupEventListeners();

        // ゲーム状態の取得
        await initializeGame();

        // 定期的な状態更新を開始（WebSocketの補完用）
        startGamePolling();

    } catch (error) {
        console.error('初期化エラー:', error);
        showError('ゲームの初期化に失敗しました');
    }
});

// WebSocket初期化
function initializeWebSocket() {
    if (typeof io === 'undefined') {
        console.warn('Socket.ioが読み込まれていません - リアルタイム機能は無効です');
        return;
    }

    // Socket.io接続
    socket = io({
        auth: {
            sessionId: currentUser?.id
        }
    });

    // 接続成功
    socket.on('connect', () => {
        console.log('🔗 WebSocket connected:', {
            socketId: socket.id,
            userId: currentUser?.id,
            username: currentUser?.username
        });

        // ルームに参加（ルーム情報取得後に行う）
        // initializeGameで設定する
    });

    // 他プレイヤーの位置更新を受信
    socket.on('player-position-updated', (data) => {
        console.log('📍 他プレイヤー位置更新受信:', {
            userId: data.userId,
            username: data.username,
            position: {
                lat: data.position.lat.toFixed(6),
                lng: data.position.lng.toFixed(6)
            },
            timestamp: data.position.timestamp
        });
        updatePlayerPositionMarker(data);
    });

    // プレイヤー推測完了通知を受信
    socket.on('player-guessed', (data) => {
        console.log(`${data.username} が推測完了: ${data.score}点`);
        updatePlayersPanel(); // プレイヤー状態を更新
    });

    // エラーハンドリング
    socket.on('connect_error', (error) => {
        console.error('WebSocket接続エラー:', error);
    });

    socket.on('error', (error) => {
        console.error('WebSocketエラー:', error);
        showError(`リアルタイム通信エラー: ${error.message}`);
    });
}

// ダークモード初期化
function initializeDarkMode() {
    const darkModeToggle = document.getElementById('input');
    const isDarkMode = localStorage.getItem('darkMode') === 'true';

    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }

    darkModeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }
    });
}

// イベントリスナーの設定
function setupEventListeners() {
    document.getElementById('guess-button').addEventListener('click', submitGuess);
    document.getElementById('reveal-distance-button').addEventListener('click', revealDistance);
    document.getElementById('respawn-button').addEventListener('click', respawn);
    document.getElementById('next-round-button').addEventListener('click', nextRound);
    document.getElementById('view-results-button').addEventListener('click', viewResults);
    document.getElementById('leave-game-button').addEventListener('click', leaveGame);
    document.getElementById('close-results-button').addEventListener('click', closeResults);
    document.getElementById('return-lobby-button').addEventListener('click', returnToLobby);

    // 初期状態: Guess button should be disabled until user places a guess marker
    const guessButton = document.getElementById('guess-button');
    if (guessButton) guessButton.disabled = true;

    // メモ機能の初期化
    initializeMemoFunction();
}

// ゲーム初期化
async function initializeGame() {
    try {
        const response = await fetch(`/multi/rooms/${roomId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('ルーム情報の取得に失敗しました');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'ゲーム情報の取得に失敗しました');
        }

        const roomData = data.data;
        updateGameInfo(roomData);

        if (roomData.gameState) {
            gameState = roomData.gameState;
            // Google Mapsが読み込まれるのを待つ
            if (typeof google !== 'undefined') {
                initializeMap();
            } else {
                window.initMap = initializeMap;
            }
        }

        // WebSocketでルームに参加
        if (socket && socket.connected && roomKey) {
            console.log('🔗 WebSocketルーム参加試行:', { roomKey, userId: currentUser?.id });
            socket.emit('join-room', { roomKey: roomKey });

            // ルーム参加成功のリスナー
            socket.on('room-joined', (data) => {
                console.log('✅ WebSocketルーム参加成功:', data);
            });

            // ルーム参加エラーのリスナー
            socket.on('room-join-error', (error) => {
                console.error('❌ WebSocketルーム参加エラー:', error);
                showError(`リアルタイム機能エラー: ${error.message}`);
            });
        } else {
            console.warn('WebSocket接続またはルームキーが無効:', {
                socketConnected: socket?.connected,
                roomKey: roomKey
            });
        }

    } catch (error) {
        console.error('ゲーム初期化エラー:', error);
        showError(error.message);
    }
}

// ゲーム情報の更新
function updateGameInfo(roomData) {
    roomKey = roomData.roomKey;
    players = roomData.players || [];

    // ヘッダー情報更新
    document.getElementById('room-key').textContent = roomKey;

    if (roomData.gameState) {
        currentRound = roomData.gameState.currentRound || 1;
        document.getElementById('current-round').textContent = currentRound;
    }

    totalRounds = roomData.settings?.roundCount || 3;
    document.getElementById('total-rounds').textContent = totalRounds;

    // プレイヤー情報更新
    updatePlayersPanel();

    // ゲーム状態に応じたボタン表示
    updateButtonVisibility(roomData);
}

// プレイヤーパネルの更新
function updatePlayersPanel() {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';

    // スコア順にソート
    const sortedPlayers = [...players].sort((a, b) => {
        const aScore = a.gameStats?.totalScore || 0;
        const bScore = b.gameStats?.totalScore || 0;
        return bScore - aScore;
    });

    sortedPlayers.forEach((player, index) => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';

        const score = player.gameStats?.totalScore || 0;
        const status = getPlayerStatus(player);

        playerElement.innerHTML = `
            <div class="player-name">
                ${player.isHost ? '👑 ' : ''}${player.username}
                ${player.userId === currentUser.id ? ' (あなた)' : ''}
            </div>
            <div class="player-score">${score}pt</div>
            <div class="player-status ${status.class}">${status.text}</div>
        `;

        playersList.appendChild(playerElement);
    });
}

// プレイヤーの状態取得
function getPlayerStatus(player) {
    if (!gameState) {
        return { text: '待機中', class: 'status-waiting' };
    }

    const currentPlayer = players.find(p => p.userId === currentUser.id);
    if (player.userId === currentUser.id) {
        if (hasSubmittedGuess) {
            return { text: '提出済み', class: 'status-guessed' };
        } else {
            return { text: '推測中', class: 'status-guessing' };
        }
    }

    // 他のプレイヤーの状態は推測
    return { text: '推測中', class: 'status-guessing' };
}

// ボタン表示の更新
function updateButtonVisibility(roomData) {
    const guessBtn = document.getElementById('guess-button');
    const nextRoundBtn = document.getElementById('next-round-button');
    const resultsBtn = document.getElementById('view-results-button');

    if (hasSubmittedGuess) {
        guessBtn.style.display = 'none';

        if (currentRound < totalRounds) {
            nextRoundBtn.style.display = 'inline-block';
        } else {
            resultsBtn.style.display = 'inline-block';
        }
    } else {
        guessBtn.style.display = 'inline-block';
        nextRoundBtn.style.display = 'none';
        resultsBtn.style.display = 'none';
    }
}

// Google Maps初期化
function initializeMap() {
    if (!gameState) return;

    // 東京周辺の初期位置を設定
    const tokyoCenter = { lat: 35.6762, lng: 139.6503 };

    // マップの初期化
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 10,
        center: tokyoCenter,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false, // ペグマン削除
        fullscreenControl: true,
        mapTypeControl: false
    });

    // スポーン位置を生成してストリートビューを初期化
    const spawnPosition = generateRandomSpawnPosition(gameState.targetLocation);

    // ストリートビューの初期化
    panorama = new google.maps.StreetViewPanorama(
        document.getElementById('pano'), {
            position: spawnPosition, // ランダムなスポーン位置を使用
            pov: { heading: 0, pitch: 0 },
            zoom: 1,
            fullscreenControl: true,
            addressControl: false,
            linksControl: true,
            panControl: true,
            zoomControl: true
        }
    );

    map.setStreetView(panorama);
    streetViewService = new google.maps.StreetViewService();

    // プレイヤー位置変更の検出
    panorama.addListener('position_changed', () => {
        const currentPosition = panorama.getPosition();
        if (currentPosition && socket && socket.connected) {
            // リアルタイムで位置をサーバーに送信
            const positionData = {
                roomId: roomId,
                lat: currentPosition.lat(),
                lng: currentPosition.lng()
            };

            socket.emit('update-position', positionData);
            console.log('📍 手動位置更新送信:', {
                lat: currentPosition.lat().toFixed(6),
                lng: currentPosition.lng().toFixed(6)
            });
        }
    });

    // targetLocationをGoogle Maps LatLngオブジェクトに変換
    targetLocation = new google.maps.LatLng(gameState.targetLocation.lat, gameState.targetLocation.lng);

    // 初期位置はクライアント側でスポーン時に設定するため削除
    initialPlayerLocation = null;

    initialPlayerDistance = gameState.initialDistance;

    // フラッグマーカーを常時表示
    setupTargetFlag();

    // プレイヤーマーカーの設置を削除（謎の◯マーカー排除）

    // マップクリックイベント
    setupMapEvents();

    // ストリートビューの適切な位置設定（game.jsから移植）
    setPlayerStartPosition();

    console.log('Map initialized for multiplayer game');
}

// クライアント側で個別スポーン位置を生成
async function setPlayerStartPosition() {
    if (!targetLocation) {
        console.error('ターゲット位置が設定されていません');
        return;
    }

    console.log('🎲 クライアント側で個別スポーン位置を生成中...');

    // 各クライアントがランダムなスポーン位置を生成
    const playerStartPos = generateRandomSpawnPosition(targetLocation);

    console.log('🎯 個別スポーン位置を生成:', {
        lat: playerStartPos.lat(),
        lng: playerStartPos.lng(),
        player: currentUser.username
    });

    // 即座にパノラマ位置を設定
    panorama.setPosition(playerStartPos);

    // 初期位置記録
    initialPlayerLocation = {
        lat: playerStartPos.lat(),
        lng: playerStartPos.lng()
    };

    // 初期距離を計算
    initialPlayerDistance = google.maps.geometry.spherical.computeDistanceBetween(
        playerStartPos,
        targetLocation
    );

    console.log(`✅ 個別スポーン完了: 距離=${Math.round(initialPlayerDistance)}m`);

    // スポーン位置をサーバーに送信
    await sendSpawnPositionToServer(initialPlayerLocation);

    // オンライン用のゲームセッション開始
    startOnlineGameSession(targetLocation, playerStartPos);
}

// ランダムスポーン位置生成（3km圏内）
function generateRandomSpawnPosition(targetLocation) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = 500 + Math.random() * 2500; // 500m～3000m

    // Google Maps geometryを使用して正確な座標計算
    return google.maps.geometry.spherical.computeOffset(
        targetLocation,
        distance,
        angle * 180 / Math.PI
    );
}

// スポーン位置をサーバーに送信
async function sendSpawnPositionToServer(spawnPosition) {
    try {
        const response = await fetch(`/multi/rooms/${roomId}/spawn-position`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                lat: spawnPosition.lat,
                lng: spawnPosition.lng
            })
        });

        const data = await response.json();
        if (data.success) {
            console.log('✅ スポーン位置をサーバーに送信完了');

            // WebSocketでリアルタイム位置更新も送信
            if (socket && socket.connected) {
                socket.emit('update-position', {
                    roomId: roomId,
                    lat: spawnPosition.lat,
                    lng: spawnPosition.lng
                });
            }
        } else {
            console.warn('⚠️ スポーン位置送信に失敗:', data.message);
        }
    } catch (error) {
        console.error('❌ スポーン位置送信エラー:', error);
    }
}

// オンライン用ゲームセッション開始（game.jsのstartGameSessionを参考）
function startOnlineGameSession(targetPos, playerPos) {
    // targetPosとplayerPosの型を統一（Google Maps LatLng形式に変換）
    const targetLatLng = targetPos instanceof google.maps.LatLng ? targetPos : new google.maps.LatLng(targetPos.lat, targetPos.lng);
    const playerLatLng = playerPos instanceof google.maps.LatLng ? playerPos : new google.maps.LatLng(playerPos.lat, playerPos.lng);

    // 初期プレイヤー位置を記録（game.jsと同様）
    initialPlayerLocation = {
        lat: playerLatLng.lat(),
        lng: playerLatLng.lng()
    };

    // 初期距離を記録
    initialPlayerDistance = google.maps.geometry.spherical.computeDistanceBetween(
        playerLatLng,
        targetLatLng
    );

    console.log('🎮 オンラインゲームセッション開始 (個別ランダムスポーン):', {
        target: { lat: targetLatLng.lat(), lng: targetLatLng.lng() },
        player: { lat: playerLatLng.lat(), lng: playerLatLng.lng() },
        distance: Math.round(initialPlayerDistance) + 'm',
        note: '各プレイヤーが異なるランダム位置からスタート'
    });

    // ゲーム状態をリセット（game.jsと同様）
    distanceRevealed = false;
    hintUsed = false;
    hasSubmittedGuess = false;

    // メモ機能もリセット
    resetMemoFunction();

    // UI要素の状態をリセット
    const guessButton = document.getElementById('guess-button');
    const hintButton = document.getElementById('reveal-distance-button');
    const respawnButton = document.getElementById('respawn-button');

    // Guess button should be disabled until user clicks map to set guess location
    if (guessButton) guessButton.disabled = true;
    if (hintButton) hintButton.disabled = false;
    if (respawnButton) respawnButton.disabled = false;

    // 定期的な位置送信を開始（3秒間隔）
    startPeriodicPositionUpdate();
}

// 目的地フラッグを常時表示する設定（game.jsから移植）
function setupTargetFlag() {
    if (!targetLocation) return;

    // 既存のフラッグマーカーがあれば削除
    if (flagMarker) {
        flagMarker.setMap(null);
    }

    // フラッグマーカー設置（game.jsと同じ赤いフラッグ）
    flagMarker = new google.maps.Marker({
        position: targetLocation,
        map: map,
        title: "フラッグ",
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                <polygon points="4,4 4,28 6,28 6,18 26,14 6,10 6,4" fill="red" stroke="black" stroke-width="1"/>
            </svg>
        `),
            scaledSize: new google.maps.Size(32, 32)
        }
    });

    // マップをフラッグ中心に調整（3km圏内が見える縮尺）
    map.setCenter(targetLocation);
    map.setZoom(14);

    console.log('Target flag displayed at:', targetLocation);
}

// マップイベントの設定
function setupMapEvents() {
    // マップクリック（推測位置設定）
    map.addListener('click', (event) => {
        if (!hasSubmittedGuess) {
            setGuessLocation(event.latLng);
        }
    });

    // 長押し検出（モバイル対応）
    let longPressTimer = null;

    map.addListener('mousedown', (event) => {
        longPressTimer = setTimeout(() => {
            if (!hasSubmittedGuess) {
                setGuessLocation(event.latLng);
            }
        }, 500);
    });

    map.addListener('mouseup', () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
}

// 推測位置の設定
function setGuessLocation(latLng) {
    if (hasSubmittedGuess) return;

    console.log('📍 Setting guess location:', { lat: latLng.lat(), lng: latLng.lng() });

    // 既存のマーカーを削除
    if (playerMarker) {
        playerMarker.setMap(null);
        console.log('🗑️ Removed previous guess marker');
    }

    // 新しいマーカーを作成
    playerMarker = new google.maps.Marker({
        position: latLng,
        map: map,
        title: 'あなたの推測位置',
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <circle cx="12" cy="12" r="10" fill="#1a73e8" stroke="white" stroke-width="2"/>
                </svg>
            `)
        }
    });

    console.log('✅ Guess marker created, enabling guess button');
    document.getElementById('guess-button').disabled = false;
}

// プレイヤーマーカーの更新機能を削除（謎の◯マーカー排除）

// 推測提出
async function submitGuess() {
    console.log('🎯 Submit guess called', {
        playerMarker: !!playerMarker,
        hasSubmittedGuess: hasSubmittedGuess
    });

    if (!playerMarker || hasSubmittedGuess) {
        console.log('❌ Cannot submit guess:', {
            playerMarkerExists: !!playerMarker,
            alreadySubmitted: hasSubmittedGuess
        });
        return;
    }

    const guessPosition = playerMarker.getPosition();
    const guessLat = guessPosition.lat();
    const guessLng = guessPosition.lng();

    console.log('📤 Submitting guess:', { lat: guessLat, lng: guessLng });

    try {
        const response = await fetch(`/multi/rooms/${roomId}/guess`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                guessLat: guessLat,
                guessLng: guessLng,
                hintUsed: hintUsed
            })
        });

        const data = await response.json();

        if (data.success) {
            hasSubmittedGuess = true;

            // 推測完了時は位置送信を停止
            stopPeriodicPositionUpdate();

            processGuessResult(data.data);
        } else {
            showError(data.message || '推測の送信に失敗しました');
        }

    } catch (error) {
        console.error('推測送信エラー:', error);
        showError('ネットワークエラーが発生しました');
    }
}

// 推測結果の処理
function processGuessResult(result) {
    // フラッグは既に常時表示されているので、ここでは接続線のみ描画

    // 接続線を描画
    const guessPosition = playerMarker.getPosition();
    connectionLine = new google.maps.Polyline({
        path: [guessPosition, targetLocation],
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        map: map
    });

    // 結果表示
    const distance = result.distance;
    const score = result.score;

    document.getElementById('result').innerHTML = `
        距離: ${distance}m | スコア: ${score}点
    `;

    // 祝福エフェクト
    if (score > 0) {
        triggerCelebration(score);
    }

    // ボタン表示更新
    updateButtonVisibility({ gameState: gameState });

    // プレイヤー情報更新
    updatePlayersPanel();
}

// ヒント機能
async function revealDistance() {
    if (distanceRevealed || !panorama) return;

    const currentPosition = panorama.getPosition();
    if (!currentPosition) return;

    try {
        // ヒント使用をマーク
        hintUsed = true;
        distanceRevealed = true;

        // 距離計算
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
            currentPosition,
            targetLocation
        );

        // 距離表示
        document.getElementById('distance-display').textContent =
            `目標まで約 ${Math.round(distance)}m`;

        // ヒント円を描画
        drawHintCircle(targetLocation, distance);

        document.getElementById('reveal-distance-button').disabled = true;

    } catch (error) {
        console.error('ヒント表示エラー:', error);
    }
}

// ヒント円の描画
function drawHintCircle(center, radius) {
    if (hintCircle) {
        hintCircle.setMap(null);
    }

    hintCircle = new google.maps.Circle({
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        fillColor: '#FF0000',
        fillOpacity: 0.1,
        map: map,
        center: center,
        radius: radius
    });

    // 10秒後に円を削除
    startHintCountdown();
}

// ヒントカウントダウン
function startHintCountdown() {
    hintTimeLeft = 10;

    // カウントダウン表示要素を作成
    countdownElement = document.createElement('div');
    countdownElement.className = 'hint-countdown-overlay';
    countdownElement.textContent = hintTimeLeft;

    // マップコンテナの中央に配置
    const mapContainer = document.getElementById('map');
    countdownElement.style.position = 'absolute';
    countdownElement.style.top = '50%';
    countdownElement.style.left = '50%';
    countdownElement.style.transform = 'translate(-50%, -50%)';
    mapContainer.appendChild(countdownElement);

    // カウントダウン開始
    hintCountdownInterval = setInterval(() => {
        hintTimeLeft--;
        countdownElement.textContent = hintTimeLeft;

        if (hintTimeLeft <= 0) {
            clearInterval(hintCountdownInterval);

            // 円を削除
            if (hintCircle) {
                hintCircle.setMap(null);
                hintCircle = null;
            }

            // カウントダウン要素を削除
            if (countdownElement) {
                countdownElement.remove();
                countdownElement = null;
            }

            // 距離表示をクリア
            document.getElementById('distance-display').textContent = '';
        }
    }, 1000);
}

// リスポーン機能
async function respawn() {
    if (!targetLocation) return;

    respawnCount++;
    console.log(`🔄 リスポーン実行 (${respawnCount}回目)`);

    const respawnButton = document.getElementById('respawn-button');
    if (respawnButton) {
        respawnButton.disabled = true;
        respawnButton.textContent = 'リスポーン中...';
    }

    // リスポーン用の改善されたロジック（初期スポーンと統一）
    let attempts = 0;
    const maxAttempts = 100; // 十分な試行回数

    function tryRespawnPosition() {
        if (attempts >= maxAttempts) {
            console.warn('⚠️ リスポーン: 最大試行回数に達しました。ターゲット位置からスタートします');
            panorama.setPosition(targetLocation);
            resetRespawnButton();
            return;
        }

        // フラッグから300m～3km圏内の位置を生成
        const angle = Math.random() * 2 * Math.PI;
        const distance = 300 + Math.random() * 2700; // 300m～3000m
        const newPos = google.maps.geometry.spherical.computeOffset(targetLocation, distance, angle * 180 / Math.PI);

        console.log(`🎯 リスポーン位置生成: 試行${attempts + 1}, 角度${(angle * 180 / Math.PI).toFixed(1)}°, 距離${distance.toFixed(0)}m`);

        // 段階的制約緩和（初期スポーンと同じロジック）
        let isValid = false;
        if (attempts < 15) {
            // 最初15回は厳格チェック（23区内 + 水域除外）
            isValid = isValidLocation(newPos.lat(), newPos.lng());
        } else if (attempts < 30) {
            // 16-30回は緩めのチェック（23区内のみ）
            isValid = pointInPolygon(newPos.lat(), newPos.lng(), TOKYO_23_WARDS_POLYGON);
            if (isValid && attempts === 15) {
                console.log('🔄 リスポーン: 水域制限を緩めて位置を選択');
            }
        } else {
            // 31回以降はさらに緩めのチェック（東京都内の広範囲）
            const tokyoBounds = {
                north: 35.9,
                south: 35.5,
                east: 139.9,
                west: 139.3
            };
            const lat = newPos.lat();
            const lng = newPos.lng();
            isValid = (lat >= tokyoBounds.south && lat <= tokyoBounds.north &&
                      lng >= tokyoBounds.west && lng <= tokyoBounds.east);
            if (isValid && attempts === 30) {
                console.log('🔄 リスポーン: さらに制限を緩めて東京都内で位置を選択');
            }
        }

        if (!isValid) {
            console.log(`❌ リスポーン位置無効 - 再生成 (試行 ${attempts + 1}/${maxAttempts})`);
            attempts++;
            setTimeout(() => tryRespawnPosition(), 10);
            return;
        }

        console.log(`リスポーン位置確認中... 試行回数: ${attempts + 1}, 位置: (${newPos.lat().toFixed(6)}, ${newPos.lng().toFixed(6)})`);

        // ストリートビューが利用可能かチェック
        fetch('/api/streetview/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lat: newPos.lat(),
                lng: newPos.lng(),
                radius: 300
            })
        })
        .then(response => response.json())
        .then(data => {
            const streetViewData = data.success ? data.data : data;
            if (streetViewData.status === 'OK') {
                const newPlayerPosition = new google.maps.LatLng(streetViewData.location.lat, streetViewData.location.lng);
                panorama.setPosition(newPlayerPosition);

                const newDistance = google.maps.geometry.spherical.computeDistanceBetween(
                    newPlayerPosition,
                    targetLocation
                );

                console.log(`✅ リスポーン成功: 新しい距離=${Math.round(newDistance)}m`);
                resetRespawnButton();
            } else {
                console.log(`❌ リスポーン位置でストリートビューが利用できません。再試行... (status: ${streetViewData.status})`);
                attempts++;
                // 再帰の代わりにsetTimeoutを使用
                setTimeout(() => tryRespawnPosition(), 100);
            }
        })
        .catch(error => {
            console.error('リスポーン時のストリートビュー確認エラー:', error);
            attempts++;
            // 再帰の代わりにsetTimeoutを使用
            setTimeout(() => tryRespawnPosition(), 100);
        });
    }

    function resetRespawnButton() {
        if (respawnButton) {
            respawnButton.textContent = 'RESPAWN';
            // 10秒クールダウン
            setTimeout(() => {
                respawnButton.disabled = false;
            }, 10000);
        }
    }

    tryRespawnPosition();
}

// ランダム位置生成
function generateRandomPosition(center, radiusMeters) {
    const earthRadius = 6371000; // 地球の半径（メートル）
    const centerLat = center.lat * Math.PI / 180;
    const centerLng = center.lng * Math.PI / 180;

    // ランダムな距離と角度
    const distance = Math.random() * radiusMeters;
    const bearing = Math.random() * 2 * Math.PI;

    const lat = Math.asin(
        Math.sin(centerLat) * Math.cos(distance / earthRadius) +
        Math.cos(centerLat) * Math.sin(distance / earthRadius) * Math.cos(bearing)
    );

    const lng = centerLng + Math.atan2(
        Math.sin(bearing) * Math.sin(distance / earthRadius) * Math.cos(centerLat),
        Math.cos(distance / earthRadius) - Math.sin(centerLat) * Math.sin(lat)
    );

    return {
        lat: lat * 180 / Math.PI,
        lng: lng * 180 / Math.PI
    };
}

// 次のラウンド
async function nextRound() {
    // ホストのみが次のラウンドを開始可能
    const isHost = players.find(p => p.userId === currentUser.id)?.isHost;
    if (!isHost) {
        showError('ホストのみが次のラウンドを開始できます');
        return;
    }

    try {
        const newTargetLocation = generateRandomTokyoLocation();
        const newPlayerLocation = generateRandomTokyoLocation();

        const response = await fetch(`/multi/rooms/${roomId}/next-round`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                targetLat: newTargetLocation.lat,
                targetLng: newTargetLocation.lng,
                playerLat: newPlayerLocation.lat,
                playerLng: newPlayerLocation.lng
            })
        });

        const data = await response.json();

        if (data.success) {
            // ゲーム状態をリセット
            resetRoundState();

            // 新しいラウンドの状態を取得
            await initializeGame();
        } else {
            showError(data.message || '次のラウンドの開始に失敗しました');
        }

    } catch (error) {
        console.error('次ラウンド開始エラー:', error);
        showError('ネットワークエラーが発生しました');
    }
}

// ラウンド状態のリセット
function resetRoundState() {
    hasSubmittedGuess = false;
    distanceRevealed = false;
    hintUsed = false;

    // マーカーとライン削除
    if (flagMarker) {
        flagMarker.setMap(null);
        flagMarker = null;
    }
    if (connectionLine) {
        connectionLine.setMap(null);
        connectionLine = null;
    }
    if (hintCircle) {
        hintCircle.setMap(null);
        hintCircle = null;
    }

    // 他プレイヤーの位置マーカーもクリア
    clearPlayerPositionMarkers();

    // ヒントタイマークリア
    if (hintCountdownInterval) {
        clearInterval(hintCountdownInterval);
        hintCountdownInterval = null;
    }
    if (countdownElement) {
        countdownElement.remove();
        countdownElement = null;
    }

    // 表示リセット
    document.getElementById('result').textContent = '';
    document.getElementById('distance-display').textContent = '';
    document.getElementById('reveal-distance-button').disabled = false;
}

// 東京都内のランダム位置生成
function generateRandomTokyoLocation() {
    // 東京23区内の有効な座標を生成
    let randomLocation;
    let validLocationFound = false;
    let locationAttempts = 0;
    const MAX_LOCATION_ATTEMPTS = 100;

    while (!validLocationFound && locationAttempts < MAX_LOCATION_ATTEMPTS) {
        // 80%の確率で主要道路周辺、20%の確率で従来のランダム生成
        let candidateLocation;
        if (Math.random() < 0.8) {
            // 主要道路周辺の重み付き座標生成
            candidateLocation = generateWeightedRandomLocation();
        } else {
            // 従来のランダム座標生成（フォールバック）
            const randomLat = 35.53 + Math.random() * 0.35; // 35.53-35.88
            const randomLng = 139.34 + Math.random() * 0.54; // 139.34-139.88
            candidateLocation = { lat: randomLat, lng: randomLng };
        }

        if (isValidLocation(candidateLocation.lat, candidateLocation.lng)) {
            randomLocation = candidateLocation;
            validLocationFound = true;
        }
        locationAttempts++;
    }

    if (!validLocationFound) {
        console.error("東京23区内の有効な地点が見つかりませんでした");
        // フォールバック：デフォルトの範囲でランダム生成
        const minLat = 35.5;
        const maxLat = 35.8;
        const minLng = 139.4;
        const maxLng = 139.9;
        return {
            lat: minLat + Math.random() * (maxLat - minLat),
            lng: minLng + Math.random() * (maxLng - minLng)
        };
    }

    return randomLocation;
}

// 結果表示
function viewResults() {
    document.getElementById('game-results-modal').style.display = 'flex';
    loadFinalResults();
}

// 最終結果の読み込み
async function loadFinalResults() {
    try {
        const response = await fetch(`/multi/rooms/${roomId}/ranking`, {
            credentials: 'include'
        });

        const data = await response.json();

        if (data.success) {
            displayFinalRankings(data.data.ranking);
        } else {
            showError('結果の取得に失敗しました');
        }

    } catch (error) {
        console.error('結果取得エラー:', error);
        showError('ネットワークエラーが発生しました');
    }
}

// 最終ランキング表示
function displayFinalRankings(rankings) {
    const container = document.getElementById('final-rankings');
    container.innerHTML = '';

    rankings.forEach((player, index) => {
        const rankElement = document.createElement('div');
        rankElement.className = `ranking-item rank-${index + 1}`;

        const medals = ['🥇', '🥈', '🥉'];
        const medal = medals[index] || `${index + 1}位`;

        rankElement.innerHTML = `
            <div class="rank-position">${medal}</div>
            <div class="rank-name">${player.username}</div>
            <div class="rank-score">${player.totalScore}点</div>
        `;

        container.appendChild(rankElement);
    });
}

// 結果モーダルを閉じる
function closeResults() {
    document.getElementById('game-results-modal').style.display = 'none';
}

// ロビーに戻る
function returnToLobby() {
    window.location.href = `/online/views/online_lobby.html?roomId=${roomId}`;
}

// ゲーム退出
async function leaveGame() {
    if (!confirm('ゲームを退出しますか？進行中のデータは失われます。')) {
        return;
    }

    try {
        await fetch(`/multi/rooms/${roomId}/leave`, {
            method: 'DELETE',
            credentials: 'include'
        });

        window.location.href = '/rooms';

    } catch (error) {
        console.error('ゲーム退出エラー:', error);
        // エラーが発生してもリダイレクト
        window.location.href = '/rooms';
    }
}

// ゲーム状態のポーリング
function startGamePolling() {
    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/multi/rooms/${roomId}`, {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    updateGameInfo(data.data);

                    // ゲーム完了チェック
                    if (data.data.status === 'completed' && !isGameComplete) {
                        isGameComplete = true;
                        stopGamePolling();
                        viewResults();
                    }
                }
            }

        } catch (error) {
            console.error('ポーリングエラー:', error);
        }
    }, 3000); // 3秒ごと
}

// ポーリング停止
function stopGamePolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// メモ機能の初期化
function initializeMemoFunction() {
    const memoEyeBox = document.getElementById('memo-box-left');
    const memoTrashBox = document.getElementById('memo-box-right');

    if (!memoEyeBox || !memoTrashBox) return;

    // 目のアイコンボックスからのドラッグ機能
    setupMemoBoxDrag(memoEyeBox);

    // ゴミ箱アイコンクリックでメモ削除
    memoTrashBox.addEventListener('click', clearAllMemoMarkers);

    // マップクリックイベントの設定
    setupMapClickEvents();
}

// メモボックスのドラッグ機能設定
function setupMemoBoxDrag(memoEyeBox) {
    let isDragging = false;
    let dragStartX, dragStartY;

    memoEyeBox.addEventListener('mousedown', function(e) {
        if (memoMarkers.length >= 1) return; // 既にメモがある場合は設置不可

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        memoEyeBox.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;

        // ドラッグ中の視覚効果
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            memoEyeBox.style.opacity = '0.7';
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (!isDragging) return;

        isDragging = false;
        memoEyeBox.style.cursor = 'pointer';
        memoEyeBox.style.opacity = '1';

        // マップ上にドロップされた場合、その位置にメモを設置
        const mapElement = document.getElementById('map');
        if (mapElement) {
            const mapRect = mapElement.getBoundingClientRect();

            if (e.clientX >= mapRect.left && e.clientX <= mapRect.right &&
                e.clientY >= mapRect.top && e.clientY <= mapRect.bottom) {

                // マップ座標に変換してメモを設置
                const bounds = map.getBounds();
                if (bounds) {
                    const ne = bounds.getNorthEast();
                    const sw = bounds.getSouthWest();

                    const lng = sw.lng() + (ne.lng() - sw.lng()) * ((e.clientX - mapRect.left) / mapRect.width);
                    const lat = ne.lat() - (ne.lat() - sw.lat()) * ((e.clientY - mapRect.top) / mapRect.height);

                    placeMemoMarker(new google.maps.LatLng(lat, lng));
                }
            }
        }
    });
}

// マップクリックイベントの設定
function setupMapClickEvents() {
    if (!map) return;

    // 既存のクリックイベントは削除（ドラッグのみで設置）
}

// メモマーカーを設置
function placeMemoMarker(position) {
    if (!position || memoMarkers.length >= 1) return; // 1つまでの制限

    // 既存のメモマーカーがあれば削除
    clearAllMemoMarkers();

    // 目の絵文字マーカーを作成
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                <polygon points="4,4 4,28 6,28 6,18 26,14 6,10 6,4" fill="lightblue" stroke="black" stroke-width="1"/>
            </svg>
        `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(6, 16)
        },
        title: 'メモマーカー（ドラッグで移動可能）',
        draggable: true,
        zIndex: 1000
    });

    // マーカーのドラッグ機能を設定
    setupMarkerDrag(marker);

    // マーカー配列に追加
    memoMarkers.push(marker);
}

// メモマーカーを削除
function removeMemoMarker(marker) {
    // マップから削除
    marker.setMap(null);

    // 配列から削除
    const index = memoMarkers.indexOf(marker);
    if (index > -1) {
        memoMarkers.splice(index, 1);
    }
}

// 全メモマーカーをクリア
function clearAllMemoMarkers() {
    memoMarkers.forEach(marker => {
        marker.setMap(null);
    });
    memoMarkers = [];
}

// マーカーのドラッグ機能設定
function setupMarkerDrag(marker) {
    marker.addListener('dragend', function(event) {
        // ドラッグ終了時の処理（必要に応じて追加）
        console.log('メモマーカーが移動されました:', event.latLng.toString());
    });
}

// ゲームリセット時にメモマーカーもクリア
function resetMemoFunction() {
    clearAllMemoMarkers();
    memoMode = false;
}

// 祝福エフェクト
function triggerCelebration(score) {
    if (typeof confetti !== 'undefined') {
        if (score >= 400) {
            confetti({
                particleCount: 200,
                spread: 120,
                startVelocity: 45,
                origin: { y: 0.6 },
                colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
            });
        } else if (score >= 300) {
            confetti({
                particleCount: 150,
                spread: 100,
                startVelocity: 40,
                origin: { y: 0.6 }
            });
        } else if (score >= 200) {
            confetti({
                particleCount: 100,
                spread: 70,
                startVelocity: 30,
                origin: { y: 0.6 }
            });
        } else if (score >= 100) {
            confetti({
                particleCount: 75,
                spread: 60,
                startVelocity: 25,
                origin: { y: 0.6 }
            });
        } else {
            confetti({
                particleCount: 50,
                spread: 50,
                startVelocity: 20,
                origin: { y: 0.6 }
            });
        }
    }
}

// 他プレイヤーの位置マーカー更新
function updatePlayerPositionMarker(data) {
    if (!map || !data.userId || data.userId === currentUser.id) return;

    const { userId, username, position } = data;

    // 既存のマーカーを削除
    if (playerPositionMarkers.has(userId)) {
        playerPositionMarkers.get(userId).setMap(null);
    }

    // 現在地マークスタイルのマーカーを作成
    const marker = new google.maps.Marker({
        position: { lat: position.lat, lng: position.lng },
        map: map,
        title: `${username}の現在位置`,
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
                    <!-- 外側の薄い円（精度範囲を表現） -->
                    <circle cx="16" cy="16" r="14" fill="rgba(66, 133, 244, 0.2)" stroke="rgba(66, 133, 244, 0.3)" stroke-width="1">
                        <animate attributeName="r" values="14;16;14" dur="2s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.2;0.1;0.2" dur="2s" repeatCount="indefinite"/>
                    </circle>
                    <!-- 中間の円 -->
                    <circle cx="16" cy="16" r="10" fill="rgba(66, 133, 244, 0.3)" stroke="rgba(66, 133, 244, 0.5)" stroke-width="1">
                        <animate attributeName="r" values="10;12;10" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                    <!-- 内側の濃い青色の中心点 -->
                    <circle cx="16" cy="16" r="6" fill="#4285f4" stroke="white" stroke-width="2"/>
                    <!-- 中央の白い点 -->
                    <circle cx="16" cy="16" r="3" fill="white"/>
                    <!-- ユーザーアイコン -->
                    <text x="16" y="20" text-anchor="middle" font-size="8" fill="#4285f4" font-weight="bold">👤</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        },
        zIndex: 999
    });

    // マーカーに情報ウィンドウを追加
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 8px; text-align: center; min-width: 120px;">
                <div style="font-weight: bold; font-size: 14px; color: #4285f4; margin-bottom: 4px;">
                    👤 ${username}
                </div>
                <div style="font-size: 11px; color: #666; background: #f5f5f5; padding: 3px 6px; border-radius: 12px;">
                    🕐 ${new Date(position.timestamp).toLocaleTimeString()}
                </div>
                <div style="font-size: 10px; color: #999; margin-top: 4px;">
                    リアルタイム位置
                </div>
            </div>
        `
    });

    marker.addListener('click', () => {
        infoWindow.open(map, marker);
    });

    // マーカーを保存
    playerPositionMarkers.set(userId, marker);

    console.log(`🎯 ${username}の位置を更新: (${position.lat.toFixed(6)}, ${position.lng.toFixed(6)})`);
}

// 定期的な位置送信を開始
function startPeriodicPositionUpdate() {
    // 既存の間隔があれば停止
    stopPeriodicPositionUpdate();

    positionUpdateInterval = setInterval(() => {
        if (panorama && socket && socket.connected && roomId) {
            const currentPosition = panorama.getPosition();
            if (currentPosition) {
                const positionData = {
                    roomId: roomId,
                    lat: currentPosition.lat(),
                    lng: currentPosition.lng()
                };

                socket.emit('update-position', positionData);
                console.log('🌍 定期位置更新送信:', {
                    roomId: roomId,
                    lat: currentPosition.lat().toFixed(6),
                    lng: currentPosition.lng().toFixed(6),
                    socketConnected: socket.connected
                });
            } else {
                console.warn('⚠️ 現在位置が取得できません');
            }
        } else {
            console.warn('⚠️ 位置送信スキップ:', {
                panorama: !!panorama,
                socket: !!socket,
                connected: socket?.connected,
                roomId: roomId
            });
        }
    }, 500); // 0.5秒間隔

    console.log('▶️ 定期位置送信開始 (0.5秒間隔)');
}

// 定期的な位置送信を停止
function stopPeriodicPositionUpdate() {
    if (positionUpdateInterval) {
        clearInterval(positionUpdateInterval);
        positionUpdateInterval = null;
        console.log('⏹️ 定期位置送信停止');
    }
}

// 全プレイヤー位置マーカーをクリア
function clearPlayerPositionMarkers() {
    playerPositionMarkers.forEach(marker => {
        marker.setMap(null);
    });
    playerPositionMarkers.clear();
}

// エラー表示
function showError(message) {
    const errorElement = document.getElementById('result');
    if (errorElement) {
        errorElement.style.color = '#dc3545';
        errorElement.textContent = `エラー: ${message}`;
    } else {
        alert(`エラー: ${message}`);
    }
}

// ページ離脱時の処理
window.addEventListener('beforeunload', () => {
    stopGamePolling();

    // インターバルをクリア
    if (hintCountdownInterval) {
        clearInterval(hintCountdownInterval);
    }
});

// Google Maps初期化関数をグローバルに公開
window.initMap = initializeMap;