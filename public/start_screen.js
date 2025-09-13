document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.querySelector('.play-btn');
    const battleButton = document.querySelector('.battle-btn');

    if (playButton) {
        playButton.addEventListener('click', () => {
            console.log('PLAY! button clicked, redirecting to rules page');
            window.location.href = '/rules';
        });
    } else {
        console.error('PLAY! button not found');
    }

    if (battleButton) {
        battleButton.addEventListener('click', async () => {
            console.log('BATTLE button clicked, checking login status');

            try {
                // ログイン状態をチェック
                const response = await fetch('/auth/me');
                const data = await response.json();

                if (data.success && data.user) {
                    // ログイン済み：ルーム一覧画面に遷移
                    window.location.href = '/rooms';
                } else {
                    // 未ログイン：ログイン画面に遷移（戻り先をroomsに指定）
                    window.location.href = `/login?returnUrl=${encodeURIComponent('/rooms')}`;
                }
            } catch (error) {
                console.error('ログイン状態の確認に失敗:', error);
                // エラー時もログイン画面に遷移
                window.location.href = `/login?returnUrl=${encodeURIComponent('/rooms')}`;
            }
        });
    } else {
        console.error('BATTLE button not found');
    }
});