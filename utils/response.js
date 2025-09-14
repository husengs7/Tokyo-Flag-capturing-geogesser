// API レスポンス形式の統一化ユーティリティ

// 成功レスポンス
const successResponse = (res, data = null, message = 'Success', status = 200) => {
    return res.status(status).json({
        success: true,
        message,
        data
    });
};

// エラーレスポンス
const errorResponse = (res, message = 'Error', status = 500, error = null) => {
    const response = {
        success: false,
        message
    };

    // 開発環境の場合のみエラー詳細を含める
    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error;
    }

    return res.status(status).json(response);
};

// バリデーションエラーレスポンス
const validationErrorResponse = (res, errors) => {
    return res.status(400).json({
        success: false,
        message: 'バリデーションエラーが発生しました',
        errors
    });
};

// 認証エラーレスポンス
const unauthorizedResponse = (res, message = 'ログインが必要です') => {
    return res.status(401).json({
        success: false,
        message
    });
};

// 権限エラーレスポンス
const forbiddenResponse = (res, message = 'このリソースへのアクセス権限がありません') => {
    return res.status(403).json({
        success: false,
        message
    });
};

// リソース未発見エラーレスポンス
const notFoundResponse = (res, message = 'リソースが見つかりません') => {
    return res.status(404).json({
        success: false,
        message
    });
};

module.exports = {
    successResponse,
    errorResponse,
    validationErrorResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse
};