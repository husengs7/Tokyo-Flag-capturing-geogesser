const passport = require('../config/passport');
const User = require('../models/User');
const { successResponse, errorResponse, unauthorizedResponse } = require('../utils/response');

// ユーザー登録
exports.register = async (req, res) => {
    try {
        const { username, password } = req.body;

        // バリデーション
        if (!username || !password) {
            return errorResponse(res, 'ユーザー名とパスワードは必須です', 400);
        }

        // 新しいユーザーを作成
        const newUser = new User({ username });

        // passport-local-mongooseのregisterメソッドでパスワードをハッシュ化して保存
        const user = await User.register(newUser, password);

        // 登録後自動ログイン
        req.login(user, (err) => {
            if (err) {
                return errorResponse(res, 'ログインに失敗しました', 500);
            }

            successResponse(res, {
                id: user._id,
                username: user.username,
                soloStats: user.soloStats || { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: user.multiStats || { totalScore: 0, playCount: 0, bestScore: 0 }
            }, 'ユーザー登録が完了しました');
        });

    } catch (error) {
        console.error('登録エラー:', error);

        // 重複ユーザー名の場合
        if (error.name === 'UserExistsError') {
            return errorResponse(res, 'そのユーザー名は既に使用されています', 400);
        }

        errorResponse(res, 'ユーザー登録に失敗しました', 500);
    }
};

// ログイン
exports.login = (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return errorResponse(res, 'ログイン処理でエラーが発生しました', 500);
        }

        if (!user) {
            return unauthorizedResponse(res, 'ユーザー名またはパスワードが間違っています');
        }

        req.login(user, (err) => {
            if (err) {
                return errorResponse(res, 'ログインに失敗しました', 500);
            }

            successResponse(res, {
                id: user._id,
                username: user.username,
                soloStats: user.soloStats || { totalScore: 0, playCount: 0, bestScore: 0 },
                multiStats: user.multiStats || { totalScore: 0, playCount: 0, bestScore: 0 }
            }, 'ログイン成功');
        });
    })(req, res, next);
};

// ログアウト
exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            return errorResponse(res, 'ログアウトに失敗しました', 500);
        }

        successResponse(res, null, 'ログアウトしました');
    });
};

// 現在のユーザー情報取得
exports.getMe = (req, res) => {
    if (req.isAuthenticated()) {
        successResponse(res, {
            id: req.user._id,
            username: req.user.username,
            soloStats: req.user.soloStats || { totalScore: 0, playCount: 0, bestScore: 0 },
            multiStats: req.user.multiStats || { totalScore: 0, playCount: 0, bestScore: 0 }
        });
    } else {
        unauthorizedResponse(res, '認証されていません');
    }
};