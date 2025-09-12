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
        battleButton.addEventListener('click', () => {
            console.log('BATTLE button clicked, redirecting to online login page');
            window.location.href = '/online/views/online_login.html';
        });
    } else {
        console.error('BATTLE button not found');
    }
});