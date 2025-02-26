import { Player } from './Player.js';
import { World } from './World.js';
import { AudioManager } from './AudioManager.js';
import { setupControls } from '../utils/controls.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.isRunning = false;
        this.lastTime = 0;
        
        // Initialize Three.js
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        
        // Create components
        this.audioManager = new AudioManager(this.camera);
        this.world = new World(this.scene);
        this.player = new Player(this.camera, this.scene, this.audioManager);
        
        // Set up controls
        this.controls = setupControls(this.camera, this.canvas);
        
        // Game state
        this.gameObjects = [];
        this.pulses = [];
    }
    
    init() {
        // Set up scene lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 200, 100);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Initialize world
        this.world.create();
        
        // Position player
        this.player.position.set(0, 1.7, 0);
        this.camera.position.copy(this.player.position);
        
        // Listen for pulse-added events
        document.addEventListener('pulse-added', (event) => {
            this.addPulse(event.detail.pulse);
        });
        
        // Setup health display
        this.updateHealthDisplay();
    }
    
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.controls.lock();
            this.lastTime = performance.now();
            requestAnimationFrame(this.gameLoop.bind(this));
        }
    }
    
    restart() {
        // Reset player
        this.player.reset();
        this.updateHealthDisplay();
        
        // Clear pulses
        this.pulses.forEach(pulse => {
            this.scene.remove(pulse.mesh);
        });
        this.pulses = [];
        
        // Start game
        this.start();
    }
    
    gameLoop(currentTime) {
        if (!this.isRunning) return;
        
        // Calculate delta time
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Update controls
        this.controls.update(deltaTime);
        
        // Update player
        this.player.update(deltaTime, this.world);
        
        // Update sonic pulses
        this.updatePulses(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Continue game loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    updatePulses(deltaTime) {
        // Update existing pulses
        for (let i = this.pulses.length - 1; i >= 0; i--) {
            const pulse = this.pulses[i];
            pulse.update(deltaTime, this.world);
            
            // Check for collisions with player
            if (pulse.checkPlayerCollision(this.player)) {
                this.player.takeDamage(pulse.getDamage());
                this.updateHealthDisplay();
                this.scene.remove(pulse.mesh);
                this.pulses.splice(i, 1);
                continue;
            }
            
            // Remove if expired
            if (pulse.lifeTime <= 0) {
                this.scene.remove(pulse.mesh);
                this.pulses.splice(i, 1);
            }
        }
    }
    
    addPulse(pulse) {
        this.pulses.push(pulse);
        this.scene.add(pulse.mesh);
    }
    
    updateHealthDisplay() {
        const healthFill = document.getElementById('health-fill');
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
}