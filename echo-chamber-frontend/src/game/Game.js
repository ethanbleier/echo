import { Player } from './Player.js';
import { RemotePlayer } from './RemotePlayer.js';
import { World } from './World.js';
import { AudioManager } from './AudioManager.js';
import { NetworkManager } from './NetworkManager.js';
import { SonicPulse } from './SonicPulse.js';
import { setupControls } from '../utils/controls.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.isRunning = false;
        this.lastTime = 0;
        
        // FPS tracking
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.fps = 0;
        
        // Ensure THREE is imported properly
        this.initThreeJS();
        
        // Create components
        this.audioManager = new AudioManager(this.camera);
        this.world = new World(this.scene);
        this.player = new Player(this.camera, this.scene, this.audioManager);
        this.networkManager = new NetworkManager(this);
        
        // Set up controls
        this.controls = setupControls(this.camera, this.canvas);
        
        // Game state
        this.remotePlayers = {};
        this.pulses = [];
        
        // Game settings
        this.difficulty = 'medium';
        this.gameMode = 'multiplayer'; // Set default to multiplayer
        
        // Create UI overlay
        this.createUIOverlay();
        
        // Pulse event listener
        this.pulseAddedListener = this.handlePulseAdded.bind(this);
        document.addEventListener('pulse-added', this.pulseAddedListener);
    }
    
    // Handle pulse added event
    handlePulseAdded(event) {
        const pulse = event.detail.pulse;
        this.addPulse(pulse);
        
        // Notify server about new pulse
        this.networkManager.sendPulseCreated(pulse);
    }
    
    initThreeJS() {
        // Initialize Three.js
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        
        // Set scene background color (sky)
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // Add fog for distance effect
        this.scene.fog = new THREE.Fog(0x87CEEB, 30, 50);
    }
    
    init() {
        // Set up scene lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 200, 100);
        directionalLight.castShadow = true;
        
        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        
        this.scene.add(directionalLight);
        
        // Initialize world
        this.world.create();
        
        // Position player
        this.player.position.set(0, 1.7, 0);
        this.camera.position.copy(this.player.position);
        
        // Initialize AudioManager with scene (needed for visualizations)
        this.audioManager.setScene(this.scene);
        
        // Setup health display
        this.updateHealthDisplay();
        
        // Set initial FPS display
        this.updateFPSDisplay();
        
        // Connect to server
        this.networkManager.connect();
        
        // Start animation loop
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    }
    
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.controls.lock();
            this.lastTime = performance.now();
        }
    }
    
    restart() {
        // Reset player
        this.player.reset();
        this.updateHealthDisplay();
        
        // Clear pulses
        this.pulses.forEach(pulse => {
            if (pulse.mesh && pulse.mesh.parent) {
                this.scene.remove(pulse.mesh);
            }
        });
        this.pulses = [];
        
        // Start game
        this.start();
    }
    
    animate(timestamp) {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        
        const currentTime = performance.now();
        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap delta time
        this.lastTime = currentTime;
        
        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate > 1000) {
            this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
            this.updateFPSDisplay();
        }
        
        if (this.isRunning) {
            this.gameLoop(deltaTime);
        }
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    gameLoop(deltaTime) {
        // Update controls
        if (this.controls.isLocked()) {
            this.controls.update(deltaTime);
        }
        
        // Update player
        this.player.update(deltaTime, this.world);
        
        // Send player position to server
        this.networkManager.sendPlayerPosition();
        
        // Update remote players
        for (const id in this.remotePlayers) {
            const player = this.remotePlayers[id];
            if (player) {
                player.update(deltaTime);
                player.alignHealthBarToCamera(this.camera);
            }
        }
        
        // Update sonic pulses
        this.updatePulses(deltaTime);
    }
    
    updatePulses(deltaTime) {
        // Update existing pulses
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            const pulse = this.pulses[i];
            
            // Skip invalid pulses
            if (!pulse || !pulse.position) {
                this.pulses.splice(i, 1);
                continue;
            }
            
            pulse.update(deltaTime, this.world);
            
            // Check for collisions with local player
            if (pulse.player_id !== this.networkManager.playerId && 
                pulse.checkPlayerCollision(this.player)) {
                
                // Local player hit by remote pulse
                this.player.takeDamage(pulse.getDamage());
                this.updateHealthDisplay();
                
                // Remove pulse
                if (pulse.mesh && pulse.mesh.parent) {
                    this.scene.remove(pulse.mesh);
                }
                this.pulses.splice(i, 1);
                continue;
            }
            
            // Check for collisions with remote players
            for (const id in this.remotePlayers) {
                // Skip the player who fired the pulse
                if (id === pulse.player_id) continue;
                
                const remotePlayer = this.remotePlayers[id];
                if (remotePlayer && remotePlayer.checkPulseCollision(pulse)) {
                    // Notify server about damage
                    this.networkManager.sendDamageDealt(id, pulse.getDamage());
                    
                    // Remove pulse
                    if (pulse.mesh && pulse.mesh.parent) {
                        this.scene.remove(pulse.mesh);
                    }
                    this.pulses.splice(i, 1);
                    break;
                }
            }
            
            // Remove if expired
            if (pulse.lifeTime <= 0) {
                if (pulse.mesh && pulse.mesh.parent) {
                    this.scene.remove(pulse.mesh);
                }
                this.pulses.splice(i, 1);
            }
        }
    }
    
    addPulse(pulse) {
        // Store the player ID who created this pulse
        pulse.player_id = this.networkManager.playerId;
        
        // Add to pulses array and scene
        this.pulses.push(pulse);
        this.scene.add(pulse.mesh);
    }
    
    addRemotePulse(pulseData) {
        // Create a new pulse from network data
        const position = new THREE.Vector3(
            pulseData.position.x,
            pulseData.position.y,
            pulseData.position.z
        );
        
        const direction = new THREE.Vector3(
            pulseData.direction.x,
            pulseData.direction.y,
            pulseData.direction.z
        ).normalize();
        
        const pulse = new SonicPulse(
            position,
            direction,
            pulseData.speed || 15,
            pulseData.damage || 20,
            3 // Max bounces
        );
        
        // Set player ID
        pulse.player_id = pulseData.player_id;
        
        // Set current bounces
        pulse.bounceCount = pulseData.bounces || 0;
        
        // Add to scene and pulses array
        this.scene.add(pulse.mesh);
        this.pulses.push(pulse);
    }
    
    updateHealthDisplay() {
        const healthFill = document.getElementById('health-fill');
        if (healthFill) {
            healthFill.style.width = `${this.player.health}%`;
            
            // Change color based on health
            if (this.player.health > 60) {
                healthFill.style.backgroundColor = '#2ecc71';
            } else if (this.player.health > 30) {
                healthFill.style.backgroundColor = '#f39c12';
            } else {
                healthFill.style.backgroundColor = '#e74c3c';
            }
            
            // Check if player is dead
            if (this.player.health <= 0) {
                this.playerDead();
            }
        }
    }
    
    playerDead() {
        this.isRunning = false;
        this.controls.unlock();
        
        // Dispatch death event
        const deathEvent = new Event('player-death');
        document.dispatchEvent(deathEvent);
    }
    
    handleResize() {
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // Remote player management
    addRemotePlayer(id, position, health) {
        // Create a new remote player
        const remotePlayer = new RemotePlayer(id, position, health);
        
        // Add to scene and store in dictionary
        this.scene.add(remotePlayer.model);
        this.remotePlayers[id] = remotePlayer;
        
        console.log(`Added remote player ${id}`);
    }
    
    updateRemotePlayerPosition(id, position) {
        const remotePlayer = this.remotePlayers[id];
        if (remotePlayer) {
            remotePlayer.setPosition(position);
            remotePlayer.setRotation(position);
        }
    }
    
    updateRemotePlayerHealth(id, health) {
        const remotePlayer = this.remotePlayers[id];
        if (remotePlayer) {
            remotePlayer.setHealth(health);
        }
    }
    
    removeRemotePlayer(id) {
        const remotePlayer = this.remotePlayers[id];
        if (remotePlayer) {
            // Remove from scene
            this.scene.remove(remotePlayer.model);
            
            // Remove from dictionary
            delete this.remotePlayers[id];
            
            console.log(`Removed remote player ${id}`);
        }
    }
    
    respawnLocalPlayer(position) {
        // Reset player
        this.player.reset();
        
        // Set new position
        this.player.position.set(position.x, position.y, position.z);
        this.camera.position.copy(this.player.position);
        
        // Update health display
        this.updateHealthDisplay();
        
        // Resume game
        this.isRunning = true;
    }
    
    createUIOverlay() {
        // Create container for game overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'game-overlay';
        this.overlay.style.position = 'absolute';
        this.overlay.style.top = '10px';
        this.overlay.style.left = '10px';
        this.overlay.style.color = 'white';
        this.overlay.style.fontFamily = 'monospace';
        this.overlay.style.fontSize = '16px';
        this.overlay.style.textShadow = '1px 1px 2px black';
        this.overlay.style.zIndex = '100';
        document.body.appendChild(this.overlay);
        
        // Create FPS display
        this.fpsDisplay = document.createElement('div');
        this.fpsDisplay.style.color = 'white';
        this.fpsDisplay.textContent = 'FPS: 0';
        this.overlay.appendChild(this.fpsDisplay);
        
        // Create players online display
        this.playersDisplay = document.createElement('div');
        this.playersDisplay.style.color = 'white';
        this.playersDisplay.textContent = 'Players Online: 0';
        this.overlay.appendChild(this.playersDisplay);
        
        // Create controls info
        this.controlsDisplay = document.createElement('div');
        this.controlsDisplay.style.marginTop = '20px';
        this.controlsDisplay.innerHTML = `
            <div>W/S - Move Forward/Back</div>
            <div>A/D - Move Left/Right</div>
            <div>SPACE - Jump</div>
            <div>MOUSE - Look Around</div>
            <div>LEFT CLICK - Fire Sonic Pulse</div>
            <div>ESC - Unlock Mouse</div>
        `;
        this.overlay.appendChild(this.controlsDisplay);
    }
    
    updateFPSDisplay() {
        if (this.fpsDisplay) {
            this.fpsDisplay.textContent = `FPS: ${this.fps}`;
        }
        
        if (this.playersDisplay) {
            // Calculate players online (including local player)
            const playersCount = Object.keys(this.remotePlayers).length + 1;
            this.playersDisplay.textContent = `Players Online: ${playersCount}`;
        }
    }

    updateSettings(settings) {
        this.gameMode = settings.gameMode;
        this.difficulty = settings.difficulty;
        
        // Update audio volume
        this.audioManager.setVolume(settings.volume / 100);
        
        // Update world settings
        if (settings.highQualitySoundViz) {
            this.world.enableHighQualityEffects();
        } else {
            this.world.disableHighQualityEffects();
        }
        
        console.log("Game settings updated:", settings);
    }
    
    // Cleanup method to prevent memory leaks and animation loop issues
    cleanup() {
        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Remove event listeners
        document.removeEventListener('pulse-added', this.pulseAddedListener);
        
        // Dispose controls
        if (this.controls && this.controls.dispose) {
            this.controls.dispose();
        }
        
        // Clean up audio manager visualizations
        if (this.audioManager) {
            this.audioManager.clearVisualizations();
        }
        
        // Remove pulses
        this.pulses.forEach(pulse => {
            if (pulse.mesh && pulse.mesh.parent) {
                this.scene.remove(pulse.mesh);
            }
        });
        this.pulses = [];
        
        // Remove remote players
        for (const id in this.remotePlayers) {
            this.removeRemotePlayer(id);
        }
        this.remotePlayers = {};
        
        // Disconnect from server
        if (this.networkManager) {
            this.networkManager.disconnect();
        }
        
        // Remove UI overlay
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        
        console.log("Game cleaned up");
    }
}