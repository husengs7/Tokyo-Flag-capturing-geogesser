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
let retryCount = 0;
const MAX_RETRIES = 10;

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

// ゲーム初期化
function initMap() {
    // 東京中心座標
    const tokyo = { lat: 35.6895, lng: 139.6917 };

    // マップ初期化
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: tokyo,
        streetViewControl: false,
        scaleControl: true,
    });

    // ストリートビュー初期化
    panorama = new google.maps.StreetViewPanorama(
        document.getElementById("pano"), {
        position: tokyo,
        pov: { heading: 34, pitch: 10 },
        addressControl: false,
        linksControl: false,
        showRoadLabels: false
    }
    );

    // ストリートビューサービス初期化
    streetViewService = new google.maps.StreetViewService();

    // GUESSボタンイベント
    document.getElementById('guess-button').addEventListener('click', makeGuess);

    // Reveal Distanceボタンイベント
    document.getElementById('reveal-distance-button').addEventListener('click', revealDistance);

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
        // 東京23区の境界内でランダム座標生成
        const randomLat = 35.53 + Math.random() * 0.35; // 35.53-35.88
        const randomLng = 139.34 + Math.random() * 0.54; // 139.34-139.88

        if (isValidLocation(randomLat, randomLng)) {
            randomLocation = { lat: randomLat, lng: randomLng };
            validLocationFound = true;
        }
        locationAttempts++;
    }

    if (!validLocationFound) {
        console.log("有効な地点が見つからないため、デフォルト地点を使用");
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
            radius: 1000
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'OK') {
                // ストリートビューが存在する場合
                targetLocation = new google.maps.LatLng(data.location.lat, data.location.lng);

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
                document.getElementById('reveal-distance-button').disabled = false;
                document.getElementById('reveal-distance-button').style.opacity = '1';
                document.getElementById('distance-display').innerHTML = '';
                if (distanceCircle) {
                    distanceCircle.setMap(null);
                    distanceCircle = null;
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

        // フラッグから3km圏内のランダムな位置を生成
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 3000;
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
                radius: 1000
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'OK') {
                    panorama.setPosition(new google.maps.LatLng(data.location.lat, data.location.lng));
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
            // 結果表示
            document.getElementById('result').innerHTML = `距離: ${data.distance}m`;

            // GUESSボタンを押したらReveal Distanceボタンを無効化
            document.getElementById('reveal-distance-button').disabled = true;
            document.getElementById('reveal-distance-button').style.opacity = '0.5';
        })
        .catch(error => {
            console.error('距離計算エラー:', error);
            document.getElementById('result').innerHTML = '距離計算エラー';

            // エラー時でもReveal Distanceボタンを無効化
            document.getElementById('reveal-distance-button').disabled = true;
            document.getElementById('reveal-distance-button').style.opacity = '0.5';
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
            // 距離を表示
            document.getElementById('distance-display').innerHTML = `目的地までの距離: ${data.distance}m`;

            // 赤い円を描画（フラッグを中心とする）
            if (distanceCircle) distanceCircle.setMap(null);
            distanceCircle = new google.maps.Circle({
                strokeColor: '#FF0000',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: '#FF0000',
                fillOpacity: 0.1,
                map: map,
                center: targetLocation,
                radius: data.distance
            });

            // ボタンを無効化
            const button = document.getElementById('reveal-distance-button');
            button.disabled = true;
            button.style.opacity = '0.5';
            distanceRevealed = true;
        })
        .catch(error => {
            console.error('距離計算エラー:', error);
            document.getElementById('distance-display').innerHTML = '距離計算エラー';
        });
}