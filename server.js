const express = require('express');
const path = require('path');
const axios = require('axios');
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// ルーター読み込み
const indexRouter = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイル提供
app.use(express.static(path.join(__dirname, 'public')));

// Google Maps JavaScript API スクリプト（APIキーをサーバー側で注入）
app.get('/api/maps-script', (req, res) => {
    // APIキー確認
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        return res.status(500).send('console.error("Google Maps APIキーが設定されていません");');
    }

    res.type('application/javascript');
    res.send(`
        (function() {
            const script = document.createElement('script');
            script.src = 'https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY}&callback=initMap&libraries=geometry';
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        })();
    `);
});

// Street View Panorama 存在確認プロキシ
app.post('/api/streetview/check', async (req, res) => {
    try {
        const { lat, lng, radius = 1000 } = req.body;

        // 入力値検証
        if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: '無効な座標です' });
        }

        // APIキー確認
        if (!process.env.GOOGLE_MAPS_API_KEY) {
            return res.status(500).json({ error: 'Google Maps APIキーが設定されていません' });
        }

        const response = await axios.get('https://maps.googleapis.com/maps/api/streetview/metadata', {
            params: {
                key: process.env.GOOGLE_MAPS_API_KEY,
                location: `${lat},${lng}`,
                radius: radius
            }
        });

        const data = response.data;

        if (data.status === 'OK') {
            res.json({
                status: 'OK',
                location: {
                    lat: parseFloat(data.location.lat),
                    lng: parseFloat(data.location.lng)
                }
            });
        } else {
            res.json({ status: 'ZERO_RESULTS' });
        }
    } catch (error) {
        console.error('Street View API エラー:', error);
        res.status(500).json({ error: 'Street View API リクエストが失敗しました' });
    }
});

// 直線距離計算プロキシ（ハバーサイン公式）
app.post('/api/distance', (req, res) => {
    try {
        const { lat1, lng1, lat2, lng2 } = req.body;

        // 入力値検証
        if (!lat1 || !lng1 || !lat2 || !lng2 ||
            lat1 < -90 || lat1 > 90 || lng1 < -180 || lng1 > 180 ||
            lat2 < -90 || lat2 > 90 || lng2 < -180 || lng2 > 180) {
            return res.status(400).json({ error: '無効な座標です' });
        }

        // ハバーサイン公式による直線距離計算
        const R = 6371e3; // 地球の半径（メートル単位）
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = R * c; // 直線距離（メートル単位）

        res.json({ distance: Math.round(distance) });
    } catch (error) {
        console.error('距離計算エラー:', error);
        res.status(500).json({ error: '距離計算が失敗しました' });
    }
});

// ルーター使用
app.use('/', indexRouter);

app.listen(PORT, () => {
    console.log(`サーバーが http://localhost:${PORT} で起動しています`);
});

module.exports = app;