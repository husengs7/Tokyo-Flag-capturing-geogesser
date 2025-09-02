// グローバル変数
let map;
let panorama;
let streetViewService;
let targetLocation;
let flagMarker;
let retryCount = 0;
const MAX_RETRIES = 10;

// ゲーム初期化
function initMap() {
    // 東京中心座標
    const tokyo = { lat: 35.6895, lng: 139.6917 };
    
    // マップ初期化
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 12,
        center: tokyo
    });
    
    // ストリートビュー初期化
    panorama = new google.maps.StreetViewPanorama(
        document.getElementById("pano"), {
            position: tokyo,
            pov: { heading: 34, pitch: 10 }
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
    
    // 東京都内のランダム座標生成
    const randomLat = 35.53 + Math.random() * 0.35; // 35.53-35.88
    const randomLng = 139.34 + Math.random() * 0.45; // 139.34-139.79
    const randomLocation = { lat: randomLat, lng: randomLng };
    
    // ストリートビューデータ存在確認
    streetViewService.getPanorama({
        location: randomLocation,
        radius: 1000
    }, (data, status) => {
        if (status === 'OK') {
            // ストリートビューが存在する場合
            targetLocation = data.location.latLng;
            
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
            
            // プレイヤーのスタート位置を5km圏内に設定
            setPlayerStartPosition();
            
            retryCount = 0;
        } else {
            // ストリートビューが存在しない場合は再試行
            retryCount++;
            setRandomLocation();
        }
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
        
        // フラッグから5km圏内のランダムな位置を生成
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 5000;
        const startPos = google.maps.geometry.spherical.computeOffset(targetLocation, distance, angle * 180 / Math.PI);
        
        // 東京都内かチェック
        if (startPos.lat() < 35.53 || startPos.lat() > 35.88 || startPos.lng() < 139.34 || startPos.lng() > 139.79) {
            attempts++;
            trySetPosition();
            return;
        }
        
        // ストリートビューが利用可能かチェック
        streetViewService.getPanorama({
            location: startPos,
            radius: 1000
        }, (data, status) => {
            if (status === 'OK') {
                panorama.setPosition(data.location.latLng);
            } else {
                attempts++;
                trySetPosition();
            }
        });
    }
    
    trySetPosition();
}

// 推測実行
function makeGuess() {
    const currentPos = panorama.getPosition();
    if (!currentPos || !targetLocation) return;
    
    // 距離計算（メートル）
    const distance = google.maps.geometry.spherical.computeDistanceBetween(currentPos, targetLocation);
    
    // 結果表示
    document.getElementById('result').innerHTML = `距離: ${Math.round(distance)}m`;
}