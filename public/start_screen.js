document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.querySelector('.play-btn');

    if (playButton) {
        playButton.addEventListener('click', () => {
            console.log('PLAY! button clicked, redirecting to rules page');
            window.location.href = '/rules';
        });
    } else {
        console.error('PLAY! button not found');
    }
});