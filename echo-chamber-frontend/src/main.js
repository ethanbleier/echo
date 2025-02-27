import { Game } from './game/Game.js';

// DOM Elements
const startButton = document.getElementById('start-button');
const settingsButton = document.getElementById('settings-button');
const saveSettingsButton = document.getElementById('save-settings-button');
const backButton = document.getElementById('back-button');
const restartButton = document.getElementById('restart-button');
const startScreen = document.getElementById('start-screen');
const settingsScreen = document.getElementById('settings-screen');
const deathScreen = document.getElementById('death-screen');
const canvas = document.getElementById('game-canvas');
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');
const difficultySelect = document.getElementById('difficulty-select');
const soundVizQuality = document.getElementById('sound-viz-quality');

// Game settings object
const gameSettings = {
    gameMode: "singleplayer",
    difficulty: "medium",
    volume: 75,
    highQualitySoundViz: true
};

// Initialize game
const game = new Game(canvas, gameSettings);

// Event Listeners
startButton.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    game.start();
});

settingsButton.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    settingsScreen.classList.remove('hidden');
    
    // Set UI to match current settings
    document.querySelector(`input[name="gameMode"][value="${gameSettings.gameMode}"]`).checked = true;
    difficultySelect.value = gameSettings.difficulty;
    volumeSlider.value = gameSettings.volume;
    volumeValue.textContent = `${gameSettings.volume}%`;
    soundVizQuality.checked = gameSettings.highQualitySoundViz;
});

saveSettingsButton.addEventListener('click', () => {
    // Save settings from UI
    gameSettings.gameMode = document.querySelector('input[name="gameMode"]:checked').value;
    gameSettings.difficulty = difficultySelect.value;
    gameSettings.volume = parseInt(volumeSlider.value);
    gameSettings.highQualitySoundViz = soundVizQuality.checked;
    
    // Apply settings to game
    game.updateSettings(gameSettings);
    
    // Return to start screen
    settingsScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

backButton.addEventListener('click', () => {
    settingsScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

volumeSlider.addEventListener('input', () => {
    volumeValue.textContent = `${volumeSlider.value}%`;
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