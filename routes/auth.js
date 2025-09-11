// 認証関連のルート
const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const User = require('../models/User');

// ユーザー登録 (POST /auth/register)
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // バリデーション
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'ユーザー名とパスワードは必須です'
            });
        }

        // 新しいユーザーを作成
        const newUser = new User({ username });
        
        // passport-local-mongooseのregisterメソッドでパスワードをハッシュ化して保存
        const user = await User.register(newUser, password);
        
        // 登録後自動ログイン
        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'ログインに失敗しました'
                });
            }
            
            res.json({
                success: true,
                message: 'ユーザー登録が完了しました',
                user: {
                    id: user._id,
                    username: user.username,
                    bestScore: user.bestScore
                }
            });
        });
        
    } catch (error) {
        console.error('登録エラー:', error);
        
        // 重複ユーザー名の場合
        if (error.name === 'UserExistsError') {
            return res.status(400).json({
                success: false,
                message: 'そのユーザー名は既に使用されています'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'ユーザー登録に失敗しました'
        });
    }
});

// ログイン (POST /auth/login)
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'ログイン処理でエラーが発生しました'
            });
        }
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'ユーザー名またはパスワードが間違っています'
            });
        }
        
        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'ログインに失敗しました'
                });
            }
            
            res.json({
                success: true,
                message: 'ログイン成功',
                user: {
                    id: user._id,
                    username: user.username,
                    bestScore: user.bestScore
                }
            });
        });
    })(req, res, next);
});

// ログアウト (POST /auth/logout)
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'ログアウトに失敗しました'
            });
        }
        
        res.json({
            success: true,
            message: 'ログアウトしました'
        });
    });
});

// 現在のユーザー情報取得 (GET /auth/me)
router.get('/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                username: req.user.username,
                bestScore: req.user.bestScore
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: '認証されていません'
        });
    }
});

module.exports = router;