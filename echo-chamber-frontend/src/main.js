import { Game } from './game/Game.js';

// DOM Elements
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const startScreen = document.getElementById('start-screen');
const deathScreen = document.getElementById('death-screen');
const canvas = document.getElementById('game-canvas');

// Initialize game
const game = new Game(canvas);

// Event Listeners
startButton.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    game.start();
});

restartButton.addEventListener('click', () => {
    deathScreen.classList.add('hidden');
    game.restart();
});

// Handle window resize
window.addEventListener('resize', () => {
    game.handleResize();
});

// Handle player death
document.addEventListener('player-death', () => {
    deathScreen.classList.remove('hidden');
});

// Initialize game scene
game.init();