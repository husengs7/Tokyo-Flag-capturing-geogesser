const express = require('express');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// Google Maps JavaScript API スクリプト（APIキーをサーバー側で注入）
app.get('/api/maps-script', (req, res) => {
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
        console.error('Street View API error:', error);
        res.status(500).json({ error: 'Street View API request failed' });
    }
});

// 距離計算プロキシ
app.post('/api/distance', (req, res) => {
    try {
        const { lat1, lng1, lat2, lng2 } = req.body;
        
        // Haversine formula for distance calculation
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        const distance = R * c; // Distance in meters
        
        res.json({ distance: Math.round(distance) });
    } catch (error) {
        console.error('Distance calculation error:', error);
        res.status(500).json({ error: 'Distance calculation failed' });
    }
});

// フロントエンドのルーティング
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;