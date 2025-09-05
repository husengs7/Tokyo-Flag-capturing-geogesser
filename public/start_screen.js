document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.querySelector('.play-btn');

    if (playButton) {
        playButton.addEventListener('click', () => {
            console.log('PLAY! button clicked, redirecting to game.html');
            window.location.href = 'game.html';
        });
    } else {
        console.error('PLAY! button not found');
    }
});