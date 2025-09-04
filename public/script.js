// グローバル変数
let map;
let panorama;
let streetViewService;
let targetLocation;
let flagMarker;
let playerMarker;
let connectionLine;
let retryCount = 0;
const MAX_RETRIES = 10;

// 東京23区の境界定義（より正確な範囲）
const TOKYO_23_WARDS_BOUNDS = {
    north: 35.8986,  // 足立区北端
    south: 35.4769,  // 大田区南端
    west: 139.5500,  // 世田谷区西端
    east: 139.9417   // 葛飾区東端
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
        //mapTypeControl: false,
        //fullscreenControl: false
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

    // ゲーム開始
    setRandomLocation();
}

// ランダム地点生成と検証
function setRandomLocation() {
    if (retryCount >= MAX_RETRIES) {
        console.error("ストリートビューが見つかりませんでした");
        return;
    }

    // 東京23区内のランダム座標生成
    const randomLat = TOKYO_23_WARDS_BOUNDS.south + Math.random() * (TOKYO_23_WARDS_BOUNDS.north - TOKYO_23_WARDS_BOUNDS.south);
    const randomLng = TOKYO_23_WARDS_BOUNDS.west + Math.random() * (TOKYO_23_WARDS_BOUNDS.east - TOKYO_23_WARDS_BOUNDS.west);
    const randomLocation = { lat: randomLat, lng: randomLng };

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

                // マップをフラッグ中心に調整（2km圏内が見える縮尺）
                map.setCenter(targetLocation);
                map.setZoom(14);

                // プレイヤーのスタート位置を2km圏内に設定
                setPlayerStartPosition();

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
    const maxAttempts = 20;

    function trySetPosition() {
        if (attempts >= maxAttempts) {
            // 最大試行回数に達した場合はフラッグ位置から開始
            panorama.setPosition(targetLocation);
            return;
        }

        // フラッグから2km圏内のランダムな位置を生成
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 2000;
        const startPos = google.maps.geometry.spherical.computeOffset(targetLocation, distance, angle * 180 / Math.PI);

        // 東京23区内かチェック
        if (startPos.lat() < TOKYO_23_WARDS_BOUNDS.south || startPos.lat() > TOKYO_23_WARDS_BOUNDS.north ||
            startPos.lng() < TOKYO_23_WARDS_BOUNDS.west || startPos.lng() > TOKYO_23_WARDS_BOUNDS.east) {
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
        })
        .catch(error => {
            console.error('距離計算エラー:', error);
            document.getElementById('result').innerHTML = '距離計算エラー';
        });
}