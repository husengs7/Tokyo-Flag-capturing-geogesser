// ゲーム関連のユーティリティ関数（距離計算、スコア計算、座標検証）

// 直線距離計算関数（ハバーサイン公式）
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // 地球の半径（メートル単位）
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // 直線距離（メートル単位）
}

// スコア計算関数
function calculateScore(finalDistance, initialDistance, hintWasUsed) {
    const maxScore = 5000;
    const SCORE_CONSTANT = 3;
    const distanceRatio = finalDistance / initialDistance;
    const exponentialTerm = Math.exp(-SCORE_CONSTANT * distanceRatio);
    
    if (hintWasUsed) {
        return Math.round((maxScore / 1.2) * exponentialTerm);
    } else {
        return Math.round(maxScore * exponentialTerm);
    }
}

// 座標検証関数
function validateCoordinates(lat, lng) {
    return lat && lng && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
}

module.exports = {
    calculateDistance,
    calculateScore,
    validateCoordinates
};