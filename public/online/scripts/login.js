// オンラインログイン画面のJavaScript - auth.js バックエンド連携版

// DOM要素の取得
document.addEventListener('DOMContentLoaded', function() {
    // フォーム要素
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const submitBtn = document.getElementById('submitBtn');
    const switchModeLink = document.getElementById('switchModeLink');
    
    // 入力フィールド
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
    
    // エラーメッセージ
    const errorMessage = document.getElementById('errorMessage');
    
    // 現在のモード管理
    let isLoginMode = true;
    
    // APIリクエスト用のヘルパー関数
    async function apiRequest(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (data) {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(endpoint, options);
            const result = await response.json();
            
            return {
                success: response.ok,
                status: response.status,
                data: result
            };
        } catch (error) {
            console.error('API リクエストエラー:', error);
            return {
                success: false,
                status: 500,
                data: { message: 'ネットワークエラーが発生しました' }
            };
        }
    }
    
    // エラーメッセージ表示関数
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.style.color = '#e74c3c';
        errorMessage.style.backgroundColor = 'rgba(231, 76, 60, 0.1)';
        errorMessage.style.borderColor = 'rgba(231, 76, 60, 0.3)';
        
        // エラーメッセージを5秒後に自動非表示
        setTimeout(() => {
            hideError();
        }, 5000);
    }
    
    // エラーメッセージ非表示関数
    function hideError() {
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';
    }
    
    // 成功メッセージ表示関数
    function showSuccess(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        errorMessage.style.color = '#27ae60';
        errorMessage.style.backgroundColor = 'rgba(39, 174, 96, 0.1)';
        errorMessage.style.borderColor = 'rgba(39, 174, 96, 0.3)';
        
        // 成功メッセージを3秒後に非表示
        setTimeout(() => {
            hideError();
        }, 3000);
    }
    
    // フォーム入力値をクリア
    function clearForm() {
        usernameInput.value = '';
        passwordInput.value = '';
        confirmPasswordInput.value = '';
        hideError();
    }
    
    // ボタンの状態を制御
    function setButtonLoading(loading) {
        if (loading) {
            submitBtn.disabled = true;
            submitBtn.textContent = '処理中...';
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = isLoginMode ? 'ログイン' : '登録';
        }
    }
    
    // ログインモードと新規作成モードの切り替え
    function toggleMode() {
        isLoginMode = !isLoginMode;
        hideError();
        
        if (isLoginMode) {
            // ログインモード
            authTitle.textContent = 'ログイン';
            submitBtn.textContent = 'ログイン';
            switchModeLink.textContent = '新規作成';
            confirmPasswordGroup.style.display = 'none';
            confirmPasswordInput.required = false;
            usernameInput.placeholder = 'ユーザー名';
        } else {
            // 新規作成モード
            authTitle.textContent = '新規ユーザー作成';
            submitBtn.textContent = '登録';
            switchModeLink.textContent = 'ログインに戻る';
            confirmPasswordGroup.style.display = 'block';
            confirmPasswordGroup.classList.add('fade-in');
            confirmPasswordInput.required = true;
            usernameInput.placeholder = '新しいユーザー名';
        }
        
        clearForm();
    }
    
    // ログイン処理
    async function handleLogin(username, password) {
        setButtonLoading(true);

        const result = await apiRequest('/auth/login', 'POST', {
            username: username,
            password: password
        });

        setButtonLoading(false);

        if (result.success) {
            showSuccess('ログインに成功しました！遷移中...');

            // returnUrlがあればそこに遷移、なければルーム一覧に遷移
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('returnUrl');

            setTimeout(() => {
                if (returnUrl) {
                    window.location.href = decodeURIComponent(returnUrl);
                } else {
                    window.location.href = '/online/views/online_rooms.html';
                }
            }, 1500);

            return true;
        } else {
            showError(result.data.message || 'ログインに失敗しました。');
            return false;
        }
    }
    
    // 新規ユーザー作成処理
    async function handleRegistration(username, password, confirmPassword) {
        // クライアントサイドバリデーション
        if (!username.trim()) {
            showError('ユーザー名を入力してください。');
            return false;
        }
        
        if (username.length < 3) {
            showError('ユーザー名は3文字以上で入力してください。');
            return false;
        }
        
        if (!password) {
            showError('パスワードを入力してください。');
            return false;
        }
        
        if (password.length < 6) {
            showError('パスワードは6文字以上で入力してください。');
            return false;
        }
        
        if (password !== confirmPassword) {
            showError('パスワードが一致しません。');
            return false;
        }
        
        setButtonLoading(true);
        
        const result = await apiRequest('/auth/register', 'POST', {
            username: username,
            password: password
        });
        
        setButtonLoading(false);
        
        if (result.success) {
            showSuccess('新規ユーザーの作成に成功しました！遷移中...');

            // returnUrlがあればそこに遷移、なければルーム一覧に遷移（登録後自動ログイン）
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('returnUrl');

            setTimeout(() => {
                if (returnUrl) {
                    window.location.href = decodeURIComponent(returnUrl);
                } else {
                    window.location.href = '/online/views/online_rooms.html';
                }
            }, 1500);

            return true;
        } else {
            showError(result.data.message || '新規ユーザーの作成に失敗しました。');
            return false;
        }
    }
    
    // フォーム送信イベントリスナー
    authForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        hideError();
        
        if (isLoginMode) {
            await handleLogin(username, password);
        } else {
            await handleRegistration(username, password, confirmPassword);
        }
    });
    
    // モード切り替えリンクのイベントリスナー
    switchModeLink.addEventListener('click', function(event) {
        event.preventDefault();
        toggleMode();
    });
    
    // 入力フィールドフォーカス時にエラーメッセージを非表示
    [usernameInput, passwordInput, confirmPasswordInput].forEach(input => {
        input.addEventListener('focus', hideError);
    });
    
    // Enter キーでの送信をサポート
    [usernameInput, passwordInput, confirmPasswordInput].forEach(input => {
        input.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                authForm.dispatchEvent(new Event('submit'));
            }
        });
    });
    
    // 認証状態チェック（ページロード時）
    async function checkAuthStatus() {
        const result = await apiRequest('/auth/me');
        if (result.success) {
            // 既にログイン済みの場合はreturnUrlがあればそこに、なければルーム一覧に遷移
            console.log('既にログイン済み:', result.data.user);
            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('returnUrl');

            if (returnUrl) {
                window.location.href = decodeURIComponent(returnUrl);
            } else {
                window.location.href = '/rooms';
            }
        }
    }
    
    // 初期化
    checkAuthStatus();
    
    console.log('オンラインログインシステム初期化完了 - auth.js連携版');
});