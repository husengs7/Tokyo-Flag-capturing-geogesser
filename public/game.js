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
let initialPlayerLocation = null; // 初期プレイヤー位置
let retryCount = 0;
let initialPlayerDistance = 0; // 初期位置とフラッグの距離
let gameId = null; // ゲームセッションID
let hintUpdateInterval = null;
let hintTimer = null;
let hintCircle = null; // HINT専用の円を管理
let hintTimeLeft = 10; // HINT機能の残り時間
let hintCountdownInterval = null; // カウントダウン用インターバル
let countdownElement = null; // カウントダウン数字表示要素
let memoMarkers = []; // メモマーカーの配列
let memoMode = false; // メモ設置モードの状態
let longPressTimer = null; // 長押し検出用タイマー
const MAX_RETRIES = 10;
const SCORE_CONSTANT = 3; // スコア計算の定数c


// 外部ライブラリ Canvas Confetti を使った演出
function triggerCelebration(score) {
    // Canvas Confetti ライブラリを使用
    if (typeof confetti !== 'undefined') {
        
        // スコアに応じて演出レベルを決定
        if (score >= 400) {
            // 超高スコア: 豪華な花火演出
            confetti({
                particleCount: 200,
                spread: 120,
                startVelocity: 45,
                origin: { y: 0.6 },
                colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
            });
            // 連続花火
            setTimeout(() => {
                confetti({
                    particleCount: 150,
                    spread: 90,
                    startVelocity: 35,
                    origin: { x: 0.2, y: 0.7 }
                });
            }, 500);
            setTimeout(() => {
                confetti({
                    particleCount: 150,
                    spread: 90,
                    startVelocity: 35,
                    origin: { x: 0.8, y: 0.7 }
                });
            }, 1000);
        } else if (score >= 300) {
            // 高スコア: 連続演出
            confetti({
                particleCount: 150,
                spread: 100,
                startVelocity: 40,
                origin: { y: 0.6 }
            });
            setTimeout(() => {
                confetti({
                    particleCount: 100,
                    spread: 80,
                    startVelocity: 30,
                    origin: { y: 0.7 }
                });
            }, 500);
        } else if (score >= 200) {
            // 中高スコア: 標準演出
            confetti({
                particleCount: 100,
                spread: 70,
                startVelocity: 30,
                origin: { y: 0.6 }
            });
        } else if (score >= 100) {
            // 中スコア: 控えめ演出
            confetti({
                particleCount: 75,
                spread: 60,
                startVelocity: 25,
                origin: { y: 0.6 }
            });
        } else {
            // 低スコア: 最小演出
            confetti({
                particleCount: 50,
                spread: 50,
                startVelocity: 20,
                origin: { y: 0.6 }
            });
        }
    } else {
        console.log('Canvas Confetti ライブラリが読み込まれていません');
    }
}

// テスト用: 各スコアレンジの演出確認関数
function testCelebrations() {
    console.log('🎊 Canvas Confetti 演出テスト開始');
    console.log('📖 使用方法:');
    console.log('  testCelebrations() - 全レベル自動テスト');
    console.log('  testScore(点数) - 指定スコアをテスト');
    console.log('  testLevel(1-5) - レベル別テスト');
    
    setTimeout(() => {
        console.log('🎯 レベル1: スコア 50 (最小演出 - 50粒子)');
        triggerCelebration(50);
    }, 1000);
    
    setTimeout(() => {
        console.log('🎯 レベル2: スコア 150 (控えめ演出 - 75粒子)');
        triggerCelebration(150);
    }, 4000);
    
    setTimeout(() => {
        console.log('🎯 レベル3: スコア 250 (標準演出 - 100粒子)');
        triggerCelebration(250);
    }, 7000);
    
    setTimeout(() => {
        console.log('🎯 レベル4: スコア 350 (連続演出 - 150+100粒子)');
        triggerCelebration(350);
    }, 10000);
    
    setTimeout(() => {
        console.log('🎯 レベル5: スコア 450 (豪華花火演出 - 200+150+150粒子)');
        triggerCelebration(450);
    }, 14000);
    
    setTimeout(() => {
        console.log('✅ 全演出テスト完了！');
    }, 18000);
}

// 指定スコアでのテスト
function testScore(score) {
    console.log(`🎊 スコア ${score} の演出をテスト中...`);
    triggerCelebration(score);
}

// レベル別テスト
function testLevel(level) {
    const levels = {
        1: { score: 50, name: '最小演出', particles: '50粒子' },
        2: { score: 150, name: '控えめ演出', particles: '75粒子' },
        3: { score: 250, name: '標準演出', particles: '100粒子' },
        4: { score: 350, name: '連続演出', particles: '150+100粒子' },
        5: { score: 450, name: '豪華花火演出', particles: '200+150+150粒子' }
    };
    
    if (levels[level]) {
        const config = levels[level];
        console.log(`🎯 レベル${level}: ${config.name} (${config.particles})`);
        triggerCelebration(config.score);
    } else {
        console.log('❌ レベルは1-5の範囲で指定してください');
        console.log('📖 例: testLevel(3) でレベル3をテスト');
    }
}

// 演出の詳細情報表示
function showCelebrationInfo() {
    console.log('🎊 Canvas Confetti 演出システム詳細:');
    console.log('┌─────────┬──────────────┬─────────────┬──────────────┐');
    console.log('│ スコア  │ 演出レベル   │ 粒子数      │ 特殊効果     │');
    console.log('├─────────┼──────────────┼─────────────┼──────────────┤');
    console.log('│ 0-99    │ レベル1      │ 50粒子      │ 基本演出     │');
    console.log('│ 100-199 │ レベル2      │ 75粒子      │ 控えめ       │');
    console.log('│ 200-299 │ レベル3      │ 100粒子     │ 標準         │');
    console.log('│ 300-399 │ レベル4      │ 150+100粒子 │ 連続発射     │');
    console.log('│ 400+    │ レベル5      │ 200+150x2   │ 豪華花火     │');
    console.log('└─────────┴──────────────┴─────────────┴──────────────┘');
    console.log('');
    console.log('🎮 テストコマンド:');
    console.log('  testCelebrations() - 全レベル順次テスト');
    console.log('  testScore(点数) - 指定スコアテスト (例: testScore(275))');
    console.log('  testLevel(1-5) - レベル別テスト (例: testLevel(4))');
}


// カスタム全画面機能
let isStreetViewFullscreen = false;
let miniMap = null;

function initializeCustomFullscreen() {
    // カスタム全画面ボタンを追加
    const fullscreenButton = document.createElement('button');
    fullscreenButton.id = 'custom-fullscreen-btn';
    fullscreenButton.innerHTML = '⛶';
    fullscreenButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 3px;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 16px;
        color: black;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;
    
    fullscreenButton.addEventListener('click', toggleStreetViewFullscreen);
    document.getElementById('pano').appendChild(fullscreenButton);
}

function toggleStreetViewFullscreen() {
    const panoDiv = document.getElementById('pano');
    const mapDiv = document.getElementById('map');
    const button = document.getElementById('custom-fullscreen-btn');
    
    if (!isStreetViewFullscreen) {
        // ストリートビューを全画面化
        mapDiv.style.display = 'none';
        panoDiv.style.flex = '1';
        panoDiv.style.width = '100%';
        button.innerHTML = '◱';
        isStreetViewFullscreen = true;
        showMiniMap();
    } else {
        // 通常表示に戻す
        mapDiv.style.display = 'flex';
        panoDiv.style.flex = '1';
        panoDiv.style.width = '50%';
        button.innerHTML = '⛶';
        isStreetViewFullscreen = false;
        hideMiniMap();
    }
    
    // Google Mapsのリサイズイベントを発生させる
    setTimeout(() => {
        google.maps.event.trigger(panorama, 'resize');
        google.maps.event.trigger(map, 'resize');
    }, 100);
}

function showMiniMap() {
    const miniMapElement = document.getElementById('mini-map');
    miniMapElement.style.display = 'block';
    
    // ミニマップを初期化（初回のみ）
    if (!miniMap) {
        miniMap = new google.maps.Map(document.getElementById('mini-map-content'), {
            zoom: Math.max(map.getZoom() - 2, 8),
            center: map.getCenter(),
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            disableDefaultUI: true,
            gestureHandling: 'none'
        });
        
        // ミニマップの変更を元のマップに同期するリスナー
        miniMap.addListener('center_changed', () => {
            if (document.getElementById('mini-map').classList.contains('expanded')) {
                map.setCenter(miniMap.getCenter());
            }
        });
        
        miniMap.addListener('zoom_changed', () => {
            if (document.getElementById('mini-map').classList.contains('expanded')) {
                map.setZoom(miniMap.getZoom());
            }
        });
        
        // ミニマップのクリックイベントを追加
        miniMapElement.addEventListener('click', (e) => {
            e.stopPropagation(); // ストリートビューへのクリック伝播を防ぐ
            toggleMiniMapExpansion();
        });
        
        // ドキュメント全体のクリックイベントで縮小
        document.addEventListener('click', (e) => {
            if (miniMapElement.classList.contains('expanded') && 
                !miniMapElement.contains(e.target)) {
                collapseMiniMap();
            }
        });
    }
    
    // マーカーをミニマップに同期
    syncMarkersToMiniMap();
}

function hideMiniMap() {
    const miniMapElement = document.getElementById('mini-map');
    miniMapElement.style.display = 'none';
    // 拡大状態もリセット
    miniMapElement.classList.remove('expanded');
}

function toggleMiniMapExpansion() {
    const miniMapElement = document.getElementById('mini-map');
    
    if (!miniMapElement.classList.contains('expanded')) {
        // 拡大状態にする
        miniMapElement.classList.add('expanded');
        // 拡大時はマップ操作を有効にする
        if (miniMap) {
            miniMap.setOptions({ gestureHandling: 'auto' });
        }
    }
}

function collapseMiniMap() {
    const miniMapElement = document.getElementById('mini-map');
    miniMapElement.classList.remove('expanded');
    // 縮小時はマップ操作を無効にする
    if (miniMap) {
        miniMap.setOptions({ gestureHandling: 'none' });
    }
}

function syncMarkersToMiniMap() {
    if (!miniMap) return;
    
    // ミニマップの中心とズームを同期
    miniMap.setCenter(map.getCenter());
    miniMap.setZoom(Math.max(map.getZoom() - 2, 8));
    
    // フラッグマーカーをミニマップに表示
    if (flagMarker) {
        new google.maps.Marker({
            position: flagMarker.getPosition(),
            map: miniMap,
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                        <polygon points="3,3 3,21 4.5,21 4.5,13.5 19.5,10.5 4.5,7.5 4.5,3" fill="red" stroke="black" stroke-width="0.75"/>
                    </svg>
                `),
                scaledSize: new google.maps.Size(24, 24)
            }
        });
    }
    
    // プレイヤーマーカーをミニマップに表示
    if (playerMarker) {
        new google.maps.Marker({
            position: playerMarker.getPosition(),
            map: miniMap,
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                        <circle fill="blue" cx="12" cy="12" r="8"/>
                        <circle fill="white" cx="12" cy="12" r="4"/>
                    </svg>
                `),
                scaledSize: new google.maps.Size(20, 20),
                anchor: new google.maps.Point(10, 10)
            }
        });
    }
}

// 東京23区の詳細な境界ポリゴン定義
const TOKYO_23_WARDS_POLYGON = [
    // 千代田区・中央区・港区エリア
    [35.676, 139.692], [35.690, 139.701], [35.695, 139.715], [35.686, 139.723],
    [35.680, 139.740], [35.670, 139.748], [35.660, 139.752], [35.648, 139.747],
    [35.642, 139.737], [35.639, 139.725], [35.645, 139.710],

    // 新宿区・渋谷区エリア
    [35.658, 139.690], [35.670, 139.685], [35.685, 139.690], [35.693, 139.678],
    [35.702, 139.683], [35.708, 139.695], [35.715, 139.702], [35.720, 139.715],

    // 豊島区・文京区エリア  
    [35.728, 139.720], [35.735, 139.710], [35.742, 139.715], [35.748, 139.725],
    [35.755, 139.735], [35.762, 139.745], [35.768, 139.752],

    // 北区・荒川区・台東区エリア
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

    // 中央区・港区南部（東京湾沿い、水域除外）
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

// 主要な水域の除外ポリゴン
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

// ゲームセッション開始
function startGameSession(targetPos, playerPos) {
    // 初期プレイヤー位置を記録
    initialPlayerLocation = {
        lat: playerPos.lat(),
        lng: playerPos.lng()
    };

    fetch('/api/game/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            targetLat: targetPos.lat(),
            targetLng: targetPos.lng(),
            playerLat: playerPos.lat(),
            playerLng: playerPos.lng()
        })
    })
    .then(response => response.json())
    .then(data => {
        const gameData = data.success ? data.data : data;
        gameId = gameData.gameId;
        initialPlayerDistance = gameData.initialDistance;
    })
    .catch(error => {
        console.error('ゲームセッション開始エラー:', error);
    });
}

// ヒント使用記録
function recordHintUsage() {
    if (!gameId) return;
    
    fetch('/api/game/hint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            gameId: gameId
        })
    })
    .catch(error => {
        console.error('ヒント記録エラー:', error);
    });
}

// ゲーム完了・スコア計算
function completeGame(finalLat, finalLng) {
    if (!gameId) return;
    
    fetch('/api/game/complete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            gameId: gameId,
            finalPlayerLat: finalLat,
            finalPlayerLng: finalLng
        })
    })
    .then(response => response.json())
    .then(data => {
        const resultData = data.success ? data.data : data;
        
        // スコア演出を実行
        if (resultData.score !== undefined) {
            triggerCelebration(resultData.score);
        }
        
        // 結果表示
        document.getElementById('result').innerHTML = `
            距離: ${resultData.distance}m<br>
            スコア: ${resultData.score}p
        `;

        // GUESSボタン、HINTボタン、RESPAWNボタンを非表示
        document.getElementById('guess-button').style.display = 'none';
        document.getElementById('reveal-distance-button').style.display = 'none';
        document.getElementById('respawn-button').style.display = 'none';
        
        // HINT機能のタイマーをクリア
        stopHintRealTimeUpdate();
        
        // RESTARTボタンとEXITボタンを表示
        document.getElementById('restart-button').style.display = 'inline-block';
        document.getElementById('exit-button').style.display = 'inline-block';
        
        // ヒントの距離表示を消去
        document.getElementById('distance-display').innerHTML = '';
    })
    .catch(error => {
        console.error('ゲーム完了エラー:', error);
        document.getElementById('result').innerHTML = 'ゲーム完了エラー';

        // エラー時でもGUESSボタン、HINTボタン、RESPAWNボタンを非表示
        document.getElementById('guess-button').style.display = 'none';
        document.getElementById('reveal-distance-button').style.display = 'none';
        document.getElementById('respawn-button').style.display = 'none';
        
        // HINT機能のタイマーをクリア
        stopHintRealTimeUpdate();
        
        // RESTARTボタンとEXITボタンを表示
        document.getElementById('restart-button').style.display = 'inline-block';
        document.getElementById('exit-button').style.display = 'inline-block';
        
        // ヒントの距離表示を消去
        document.getElementById('distance-display').innerHTML = '';
    });
}

// ゲーム初期化
function initMap() {
    // 東京中心座標
    const tokyo = { lat: 35.6895, lng: 139.6917 };

    // マップ初期化
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: tokyo,
        streetViewControl: false,
        scaleControl: true, // 標準縮尺コントロールを復活
        mapTypeControl: false,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControlOptions: {
            mapTypeIds: [google.maps.MapTypeId.ROADMAP]
        }
    });


    // ストリートビュー初期化
    panorama = new google.maps.StreetViewPanorama(
        document.getElementById("pano"), {
        position: tokyo,
        pov: { heading: 34, pitch: 10 },
        addressControl: false,
        linksControl: false,
        showRoadLabels: false,
        fullscreenControl: false
    }
    );

    // ストリートビューサービス初期化
    streetViewService = new google.maps.StreetViewService();

    // GUESSボタンイベント
    document.getElementById('guess-button').addEventListener('click', makeGuess);

    // HINTボタンイベント
    document.getElementById('reveal-distance-button').addEventListener('click', revealDistance);

    // RESPAWNボタンイベント
    document.getElementById('respawn-button').addEventListener('click', respawnPlayer);

    // RESTARTボタンイベント
    document.getElementById('restart-button').addEventListener('click', () => {
        window.location.href = '/game';
    });
    
    // EXITボタンイベント
    document.getElementById('exit-button').addEventListener('click', () => {
        window.location.href = '/';
    });

    // メモ機能の初期化
    initializeMemoFunction();

    // カスタム全画面機能の初期化
    initializeCustomFullscreen();

    // ゲーム開始
    setRandomLocation();
}


// ランダム地点生成と検証
function setRandomLocation() {
    if (retryCount >= MAX_RETRIES) {
        console.error("東京23区内の有効な地点が見つかりませんでした");
        return;
    }

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
        randomLocation = { lat: 35.676, lng: 139.692 }; // 東京駅周辺
    }

    // ストリートビューデータ存在確認（プロキシ経由）
    fetch('/api/streetview/check', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            lat: randomLocation.lat,
            lng: randomLocation.lng,
            radius: 500  // 半径を狭めて主要道路に限定
        })
    })
        .then(response => {
            return response.json();
        })
        .then(data => {
            // 新しいレスポンス形式に対応
            const streetViewData = data.success ? data.data : data;
            if (streetViewData.status === 'OK') {
                // ストリートビューが存在する場合
                targetLocation = new google.maps.LatLng(streetViewData.location.lat, streetViewData.location.lng);

                // フラッグマーカー設置
                if (flagMarker) flagMarker.setMap(null);
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

                // プレイヤーのスタート位置を3km圏内に設定
                setPlayerStartPosition();


                // ゲーム状態をリセット
                distanceRevealed = false;
                hintUsed = false;
                respawnCount = 0;
                initialPlayerLocation = null;
                initialPlayerDistance = 0;

                // メモ機能もリセット
                resetMemoFunction();
                
                // HINT機能のタイマーをクリア
                stopHintRealTimeUpdate();
                
                document.getElementById('guess-button').style.display = 'inline-block';
                document.getElementById('reveal-distance-button').style.display = 'inline-block';
                document.getElementById('respawn-button').style.display = 'inline-block';
                document.getElementById('restart-button').style.display = 'none';

                // RESPAWNボタンの状態をリセット
                const respawnButton = document.getElementById('respawn-button');
                respawnButton.disabled = false;
                respawnButton.style.opacity = '1';

                // HINTボタンの状態もリセット
                const hintButton = document.getElementById('reveal-distance-button');
                hintButton.disabled = false;
                hintButton.style.opacity = '1';
                document.getElementById('distance-display').innerHTML = '';
                document.getElementById('distance-display').style.visibility = 'visible';
                document.getElementById('result').innerHTML = '';
                if (distanceCircle) {
                    distanceCircle.setMap(null);
                    distanceCircle = null;
                }
                if (hintCircle) {
                    hintCircle.setMap(null);
                    hintCircle = null;
                }

                retryCount = 0;
            } else {
                // ストリートビューが存在しない場合は再試行
                retryCount++;
                setRandomLocation();
            }
        })
        .catch(error => {
            console.error('ストリートビュー確認エラー:', error);
            retryCount++;
            setRandomLocation();
        });
}

// プレイヤーのスタート位置設定
function setPlayerStartPosition() {
    let attempts = 0;
    const maxAttempts = 50;

    function trySetPosition() {
        if (attempts >= maxAttempts) {
            // 最大試行回数に達した場合はフラッグ位置から開始
            panorama.setPosition(targetLocation);
            return;
        }

        // フラッグから300m～3km圏内のランダムな位置を生成
        const angle = Math.random() * 2 * Math.PI;
        const distance = 300 + Math.random() * 2700; // 300m～3000m
        const startPos = google.maps.geometry.spherical.computeOffset(targetLocation, distance, angle * 180 / Math.PI);

        // 東京23区内かつ水域でないかチェック
        if (!isValidLocation(startPos.lat(), startPos.lng())) {
            attempts++;
            trySetPosition();
            return;
        }

        // ストリートビューが利用可能かチェック（プロキシ経由）
        fetch('/api/streetview/check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                lat: startPos.lat(),
                lng: startPos.lng(),
                radius: 300  // スタート位置はより厳しく制限
            })
        })
            .then(response => response.json())
            .then(data => {
                const streetViewData = data.success ? data.data : data;
                if (streetViewData.status === 'OK') {
                    const playerStartPosition = new google.maps.LatLng(streetViewData.location.lat, streetViewData.location.lng);
                    panorama.setPosition(playerStartPosition);
                    
                    // ゲームセッション開始
                    startGameSession(targetLocation, playerStartPosition);
                } else {
                    attempts++;
                    trySetPosition();
                }
            })
            .catch(error => {
                console.error('ストリートビュー確認エラー:', error);
                attempts++;
                trySetPosition();
            });
    }

    trySetPosition();
}

// 推測実行
function makeGuess() {
    const currentPos = panorama.getPosition();
    if (!currentPos || !targetLocation) return;

    // プレイヤー位置マーカーを表示
    if (playerMarker) playerMarker.setMap(null);
    playerMarker = new google.maps.Marker({
        position: currentPos,
        map: map,
        title: "あなたの位置",
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="12" fill="blue" stroke="white" stroke-width="3"/>
                    <circle cx="16" cy="16" r="6" fill="white"/>
                </svg>
            `),
            scaledSize: new google.maps.Size(32, 32)
        }
    });

    // フラッグとプレイヤー位置を結ぶ破線を描画
    if (connectionLine) connectionLine.setMap(null);
    connectionLine = new google.maps.Polyline({
        path: [currentPos, targetLocation],
        geodesic: true,
        strokeColor: '#000000',
        strokeOpacity: 0.1,
        strokeWeight: 2,
        icons: [{
            icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 1,
                scale: 4
            },
            offset: '0',
            repeat: '20px'
        }]
    });
    connectionLine.setMap(map);

    // マップビューを両点が見えるように調整
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(currentPos);
    bounds.extend(targetLocation);
    map.fitBounds(bounds);
    map.setZoom(Math.min(map.getZoom(), 15));

    // HINT機能の距離表示をクリア（RESPAWN後でも確実に消去）
    document.getElementById('distance-display').innerHTML = '';
    document.getElementById('distance-display').style.visibility = 'hidden';

    // HINT機能のリアルタイム更新を停止
    stopHintRealTimeUpdate();

    // ゲーム完了・スコア計算
    completeGame(currentPos.lat(), currentPos.lng());

    // GUESSボタン押下後、3つのボタンを同時に非表示
    const guessButton = document.getElementById('guess-button');
    const hintButton = document.getElementById('reveal-distance-button');
    const respawnButton = document.getElementById('respawn-button');

    // DOM更新をバッチで実行（3つのボタンを完全に同時に消去）
    requestAnimationFrame(() => {
        guessButton.style.display = 'none';
        hintButton.style.display = 'none';
        respawnButton.style.display = 'none';
    });

}

// 距離表示機能
function revealDistance() {
    // 1回だけ使用可能
    if (distanceRevealed) {
        return;
    }

    // ヒント使用を記録
    hintUsed = true;
    recordHintUsage();

    const currentPos = panorama.getPosition();
    if (!currentPos || !targetLocation) {
        return;
    }

    // 距離表示要素を表示状態にして、初回の距離計算とリアルタイム更新開始
    document.getElementById('distance-display').style.visibility = 'visible';
    
    // HINT機能のカウントダウンを開始
    hintTimeLeft = 10;
    startHintCountdown();
    
    // 既存の円があれば色を元に戻す
    if (hintCircle) {
        hintCircle.setOptions({
            strokeOpacity: 0.8,
            fillOpacity: 0.1
        });
    }
    
    updateDistanceDisplay();
    startHintRealTimeUpdate();

    // ボタンを無効化
    const button = document.getElementById('reveal-distance-button');
    button.disabled = true;
    button.style.opacity = '0.5';
    distanceRevealed = true;

    // 20秒後に更新を停止し表示を非表示
    hintTimer = setTimeout(() => {
        stopHintRealTimeUpdate();
        document.getElementById('distance-display').style.visibility = 'hidden';
        // 赤い円を透明にして非表示
        if (hintCircle) {
            hintCircle.setOptions({
                strokeOpacity: 0,
                fillOpacity: 0
            });
        }
    }, 20000);
}

// 距離表示を更新する関数
function updateDistanceDisplay() {
    const currentPos = panorama.getPosition();
    if (!currentPos || !targetLocation) {
        return;
    }

    // 距離計算（プロキシ経由）
    fetch('/api/distance', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            lat1: currentPos.lat(),
            lng1: currentPos.lng(),
            lat2: targetLocation.lat(),
            lng2: targetLocation.lng()
        })
    })
        .then(response => response.json())
        .then(data => {
            const distanceData = data.success ? data.data : data;
            // 距離を表示
            document.getElementById('distance-display').innerHTML = `目的地までの距離: ${distanceData.distance}m`;

            // 赤い円を描画（フラッグを中心とする）- 初回のみ
            if (!hintCircle) {
                hintCircle = new google.maps.Circle({
                    strokeColor: '#FF0000',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: '#FF0000',
                    fillOpacity: 0.1,
                    map: map,
                    center: targetLocation,
                    radius: distanceData.distance
                });
            } else {
                // 円の半径を更新
                hintCircle.setRadius(distanceData.distance);
            }
        })
        .catch(error => {
            console.error('距離計算エラー:', error);
            document.getElementById('distance-display').innerHTML = '距離計算エラー';
        });
}

// HINT機能のリアルタイム更新を開始
function startHintRealTimeUpdate() {
    // 0.5秒間隔で距離を更新
    hintUpdateInterval = setInterval(updateDistanceDisplay, 500);
}

// HINT機能のリアルタイム更新を停止
function stopHintRealTimeUpdate() {
    if (hintUpdateInterval) {
        clearInterval(hintUpdateInterval);
        hintUpdateInterval = null;
    }
    if (hintTimer) {
        clearTimeout(hintTimer);
        hintTimer = null;
    }
    if (hintCountdownInterval) {
        clearInterval(hintCountdownInterval);
        hintCountdownInterval = null;
    }
    // カウントダウン数字を削除
    if (countdownElement) {
        countdownElement.remove();
        countdownElement = null;
    }
    // 円の点滅を停止
    if (hintCircle) {
        hintCircle.setOptions({
            strokeOpacity: 0.8 // 通常の透明度に戻す
        });
    }
}

// HINT機能のカウントダウン開始
function startHintCountdown() {
    hintCountdownInterval = setInterval(() => {
        hintTimeLeft--;
        
        // 残り3秒で円を点滅させる
        if (hintTimeLeft === 3) {
            startCircleBlinking();
        }
        
        // 残り3秒以下で数字カウントダウンを表示
        if (hintTimeLeft <= 3 && hintTimeLeft > 0) {
            showCountdownNumber(hintTimeLeft);
        }
        
        // 時間切れでHINT機能を停止
        if (hintTimeLeft <= 0) {
            stopHintRealTimeUpdate();
            // HINTボタンを無効化
            const hintButton = document.getElementById('reveal-distance-button');
            hintButton.disabled = true;
            hintButton.style.opacity = '0.5';
            document.getElementById('distance-display').innerHTML = '';
            if (hintCircle) {
                hintCircle.setMap(null);
                hintCircle = null;
            }
        }
    }, 1000);
}


// 円の点滅を開始
function startCircleBlinking() {
    if (hintCircle) {
        // 点滅アニメーションを追加
        let blinkState = true;
        const blinkInterval = setInterval(() => {
            if (hintTimeLeft <= 0) {
                clearInterval(blinkInterval);
                return;
            }
            
            if (blinkState) {
                hintCircle.setOptions({
                    strokeOpacity: 0.2
                });
            } else {
                hintCircle.setOptions({
                    strokeOpacity: 0.8
                });
            }
            blinkState = !blinkState;
        }, 500); // 0.5秒間隔で点滅
    }
}

// 円の中心にカウントダウン数字を表示
function showCountdownNumber(number) {
    // 既存のカウントダウン要素を削除
    if (countdownElement) {
        countdownElement.remove();
    }
    
    if (hintCircle) {
        // 円の中心座標を取得
        const center = hintCircle.getCenter();
        
        // 地図上の座標を画面上の座標に変換
        const overlay = new google.maps.OverlayView();
        
        overlay.onAdd = function() {
            // カウントダウン数字要素を作成
            countdownElement = document.createElement('div');
            countdownElement.className = 'hint-countdown-overlay';
            countdownElement.textContent = number;
            
            // オーバーレイに追加
            const panes = this.getPanes();
            panes.overlayLayer.appendChild(countdownElement);
        };
        
        overlay.draw = function() {
            const overlayProjection = this.getProjection();
            const pos = overlayProjection.fromLatLngToDivPixel(center);
            
            if (countdownElement) {
                countdownElement.style.left = (pos.x - 30) + 'px';  // 中央揃え調整
                countdownElement.style.top = (pos.y - 40) + 'px';   // 中央揃え調整
            }
        };
        
        overlay.onRemove = function() {
            if (countdownElement) {
                countdownElement.parentNode.removeChild(countdownElement);
                countdownElement = null;
            }
        };
        
        overlay.setMap(map);
        
        // 1秒後に削除（次の数字表示の準備）
        setTimeout(() => {
            if (overlay) {
                overlay.setMap(null);
            }
        }, 1000);
    }
}

// RESPAWN機能
function respawnPlayer() {
    // 既に1回使用済みかチェック（将来的に複数回対応のため数値で管理）
    if (respawnCount >= 1) {
        return;
    }

    if (!gameId || !initialPlayerLocation) {
        console.error('ゲームセッションまたは初期位置が無効です');
        return;
    }

    // RESPAWN使用回数を増やす
    respawnCount++;

    // RESPAWN使用をサーバーに記録
    recordRespawnUsage();

    // 初期位置にプレイヤーを戻す
    const startPos = new google.maps.LatLng(
        initialPlayerLocation.lat,
        initialPlayerLocation.lng
    );
    panorama.setPosition(startPos);

    // 既存のプレイヤーマーカーと接続線を削除
    if (playerMarker) {
        playerMarker.setMap(null);
        playerMarker = null;
    }
    if (connectionLine) {
        connectionLine.setMap(null);
        connectionLine = null;
    }

    // ボタンを無効化
    const button = document.getElementById('respawn-button');
    button.disabled = true;
    button.style.opacity = '0.5';
}

// RESPAWN使用記録
function recordRespawnUsage() {
    if (!gameId) return;

    fetch('/api/game/respawn', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            gameId: gameId
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('リスポーン使用を記録しました');
        } else {
            console.error('リスポーン記録エラー:', data.message);
        }
    })
    .catch(error => {
        console.error('リスポーン記録リクエストエラー:', error);
    });
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

// Dark Mode Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    const darkModeToggle = document.getElementById('input');

    if (darkModeToggle) {
        // 初期状態設定（チェック状態でダークモード）
        const isChecked = darkModeToggle.checked;
        if (isChecked) {
            document.body.classList.add('dark-mode');
        }

        // トグルスイッチのイベントリスナー
        darkModeToggle.addEventListener('change', function() {
            if (this.checked) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        });
    }
});