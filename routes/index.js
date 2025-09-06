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

module.exports = router;