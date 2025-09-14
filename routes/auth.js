// 認証関連のルート
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// ユーザー登録
router.post('/register', authController.register);

// ログイン
router.post('/login', authController.login);

// ログアウト
router.post('/logout', authController.logout);

// 現在のユーザー情報取得
router.get('/me', authController.getMe);

module.exports = router;