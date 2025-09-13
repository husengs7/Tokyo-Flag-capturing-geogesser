const express = require('express');
const path = require('path');
const router = express.Router();

// フロントエンドのルーティング
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

router.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'game.html'));
});

router.get('/rules', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'rules.html'));
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'online', 'views', 'online_login.html'));
});

router.get('/rooms', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'online', 'views', 'online_rooms.html'));
});

module.exports = router;