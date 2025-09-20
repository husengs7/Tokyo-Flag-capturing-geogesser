document.addEventListener('DOMContentLoaded', async () => {
    const playButton = document.querySelector('.play-btn');
    const battleButton = document.querySelector('.battle-btn');
    const authButton = document.querySelector('#loginBtn');

    if (!authButton) {
        console.error('Auth button not found');
        return;
    }

    // ログイン状態をチェックしてボタンを更新
    await updateAuthButton();

    if (playButton) {
        playButton.addEventListener('click', () => {
            window.location.href = '/rules';
        });
    }

    if (battleButton) {
        battleButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/auth/me');
                const data = await response.json();

                if (data.success && data.data) {
                    window.location.href = '/rooms';
                } else {
                    window.location.href = `/login?returnUrl=${encodeURIComponent('/rooms')}`;
                }
            } catch (error) {
                window.location.href = `/login?returnUrl=${encodeURIComponent('/rooms')}`;
            }
        });
    }

    // 認証ボタンのクリックイベント
    if (authButton) {
        authButton.addEventListener('click', handleAuthButtonClick);
    }

    // ログイン状態をチェックしてボタンを更新する関数
    async function updateAuthButton() {
        try {
            const response = await fetch('/auth/me');
            const data = await response.json();

            if (data.success && data.data) {
                setupLogoutButton();
            } else {
                setupLoginButton();
            }
        } catch (error) {
            setupLoginButton();
        }
    }

    // ログインボタンの設定
    function setupLoginButton() {
        authButton.className = 'Btn login-btn';
        authButton.innerHTML = `
            <div class="sign">
                <svg viewBox="0 0 512 512">
                    <path d="M217.9 105.9L340.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L217.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1L32 320c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM352 416l64 0c17.7 0 32-14.3 32-32l0-256c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0c53 0 96 43 96 96l0 256c0 53-43 96-96 96l-64 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z"></path>
                </svg>
            </div>
            <div class="text">Login</div>
        `;
    }

    // ログアウトボタンの設定
    function setupLogoutButton() {
        authButton.className = 'Btn logout-btn';
        authButton.innerHTML = `
            <div class="sign">
                <svg viewBox="0 0 512 512">
                    <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z"></path>
                </svg>
            </div>
            <div class="text">Logout</div>
        `;
    }

    // 認証ボタンのクリックハンドラー
    async function handleAuthButtonClick() {
        if (authButton.classList.contains('login-btn')) {
            window.location.href = `/login?returnUrl=${encodeURIComponent('/')}`;
        } else if (authButton.classList.contains('logout-btn')) {
            await logout();
        }
    }

    // ログアウト処理
    async function logout() {
        try {
            const response = await fetch('/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                alert('ログアウトしました。');
                setupLoginButton();
            } else {
                alert('ログアウトに失敗しました。');
            }
        } catch (error) {
            alert('ログアウト中にエラーが発生しました。');
        }
    }
});