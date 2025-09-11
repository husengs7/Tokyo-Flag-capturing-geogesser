// 認証チェック用ミドルウェア

// ログイン必須のルートで使用するミドルウェア
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        // 認証済みの場合は次の処理へ
        return next();
    } else {
        // 未認証の場合はエラーを返す
        return res.status(401).json({
            success: false,
            message: 'ログインが必要です'
        });
    }
};

// 未ログイン時のみアクセス可能なルートで使用するミドルウェア（登録・ログインページ等）
const requireGuest = (req, res, next) => {
    if (!req.isAuthenticated()) {
        // 未認証の場合は次の処理へ
        return next();
    } else {
        // 認証済みの場合はエラーを返す
        return res.status(400).json({
            success: false,
            message: '既にログインしています'
        });
    }
};

// オプショナル認証（認証状態に関係なくアクセス可能だが、認証情報を取得したい場合）
const optionalAuth = (req, res, next) => {
    // パスポートでの認証状態に関係なく次の処理へ進む
    // req.isAuthenticated() と req.user でログイン状態を確認可能
    next();
};

module.exports = {
    requireAuth,
    requireGuest,
    optionalAuth
};