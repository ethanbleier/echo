// Create a new file: src/game/BotManager.js

import { AIBot } from './AIBot.js';

export class BotManager {
    constructor(scene, world, audioManager) {
        this.scene = scene;
        this.world = world;
        this.audioManager = audioManager;
        this.bots = [];
        this.maxBots = 3; // Default max bots
        this.spawnInterval = 20; // Seconds between bot spawns
        this.spawnTimer = 5; // Initial spawn delay
        this.botDifficulty = 'medium'; // Default difficulty
        this.spawnPoints = [];
        this.active = false;
    }
    
    init() {
        // Create spawn points around the map
        this.createSpawnPoints();
        return this;
    }
    
    createSpawnPoints() {
        // Create a grid of potential spawn points
        const mapSize = 20; // Size of the map
        const spacing = 5;   // Spacing between spawn points
        
        for (let x = -mapSize/2 + spacing; x <= mapSize/2 - spacing; x += spacing) {
            for (let z = -mapSize/2 + spacing; z <= mapSize/2 - spacing; z += spacing) {
                this.spawnPoints.push(new THREE.Vector3(x, 1.7, z));
            }
        }
        
        // Shuffle spawn points for randomness
        this.shuffleSpawnPoints();
    }
    
    shuffleSpawnPoints() {
        // Simple array shuffle
        for (let i = this.spawnPoints.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.spawnPoints[i], this.spawnPoints[j]] = [this.spawnPoints[j], this.spawnPoints[i]];
        }
    }
    
    setDifficulty(difficulty) {
        this.botDifficulty = difficulty;
        
        // Adjust bot count and behavior based on difficulty
        switch(difficulty) {
            case 'easy':
                this.maxBots = 2;
                this.spawnInterval = 30;
                break;
            case 'medium':
                this.maxBots = 3;
                this.spawnInterval = 20;
                break;
            case 'hard':
                this.maxBots = 5;
                this.spawnInterval = 15;
                break;
        }
        
        // Update existing bots
        this.updateBotDifficulty();
    }
    
    updateBotDifficulty() {
        // Modify bot properties based on difficulty
        for (const bot of this.bots) {
            switch(this.botDifficulty) {
                case 'easy':
                    bot.moveSpeed = 2;
                    bot.fireRate = 3;
                    bot.detectionRadius = 15;
                    bot.attackRange = 10;
                    break;
                case 'medium':
                    bot.moveSpeed = 3;
                    bot.fireRate = 2;
                    bot.detectionRadius = 20;
                    bot.attackRange = 15;
                    break;
                case 'hard':
                    bot.moveSpeed = 4;
                    bot.fireRate = 1;
                    bot.detectionRadius = 25;
                    bot.attackRange = 20;
                    break;
            }
        }
    }
    
    update(deltaTime, player) {
        if (!this.active) return;
        
        // Update all existing bots
        for (let i = this.bots.length - 1; i >= 0; i--) {
            const bot = this.bots[i];
            bot.update(deltaTime, this.world, player);
            
            // Check if bot is dead
            if (bot.isDead()) {
                // Add visual effect for bot destruction
                this.createBotDestructionEffect(bot.position);
                
                // Remove bot from scene and array
                this.scene.remove(bot.mesh);
                this.bots.splice(i, 1);
                
                // Play destruction sound
                this.audioManager.playSound('takeDamage', bot.position);
                
                // Grant player a pulse recharge for defeating a bot
                if (player && player.pulseCount < player.maxPulses) {
                    player.pulseCount++;
                    player.updateAmmoDisplay();
                }
            }
        }
        
        // Handle bot spawning
        this.spawnTimer -= deltaTime;
        if (this.spawnTimer <= 0 && this.bots.length < this.maxBots) {
            this.spawnBot();
            this.spawnTimer = this.spawnInterval;
        }
    }
    
    spawnBot() {
        // Find a valid spawn point
        const spawnPosition = this.getValidSpawnPosition();
        if (!spawnPosition) return;
        
        // Create a new bot
        const bot = new AIBot(spawnPosition, this.scene, this.audioManager);
        
        // Apply difficulty settings
        this.configureBotDifficulty(bot);
        
        // Add to bot array
        this.bots.push(bot);
        
        // Add spawn effect
        this.createBotSpawnEffect(spawnPosition);
        
        console.log(`Spawned bot at position ${spawnPosition.x}, ${spawnPosition.y}, ${spawnPosition.z}`);
        return bot;
    }
    
    getValidSpawnPosition() {
        // Shuffle spawn points for variety
        this.shuffleSpawnPoints();
        
        // Try each spawn point until we find a valid one
        for (const point of this.spawnPoints) {
            // Check if point is not colliding with a wall
            if (!this.world.checkCollision(point, 0.5)) {
                return point.clone();
            }
        }
        
        // If no valid points found, create a random position
        const randomPosition = new THREE.Vector3(
            (Math.random() - 0.5) * 15,
            1.7,
            (Math.random() - 0.5) * 15
        );
        
        return randomPosition;
    }
    
    configureBotDifficulty(bot) {
        // Set bot properties based on difficulty
        switch(this.botDifficulty) {
            case 'easy':
                bot.moveSpeed = 2;
                bot.fireRate = 3;
                bot.detectionRadius = 15;
                bot.attackRange = 10;
                
                // Easy bots have less health
                bot.health = 70;
                break;
                
            case 'medium':
                bot.moveSpeed = 3;
                bot.fireRate = 2;
                bot.detectionRadius = 20;
                bot.attackRange = 15;
                
                // Medium bots have normal health
                bot.health = 100;
                break;
                
            case 'hard':
                bot.moveSpeed = 4;
                bot.fireRate = 1;
                bot.detectionRadius = 25;
                bot.attackRange = 20;
                
                // Hard bots have extra health
                bot.health = 130;
                break;
        }
        
        // Randomize bot properties slightly for variety
        bot.moveSpeed *= 0.8 + Math.random() * 0.4; // 80% to 120% of base speed
        bot.fireRate *= 0.9 + Math.random() * 0.2;  // 90% to 110% of base fire rate
    }
    
    createBotSpawnEffect(position) {
        // Create teleport-in effect
        const ringCount = 5;
        
        for (let i = 0; i < ringCount; i++) {
            // Create ring geometry
            const ringGeometry = new THREE.RingGeometry(0.1, 0.2, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0xE74C3C,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            
            // Create ring mesh
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.copy(position);
            ring.position.y = 0.2 + i * 0.3;
            
            // Make ring face up
            ring.rotation.x = -Math.PI / 2;
            
            this.scene.add(ring);
            
            // Animate ring
            const startTime = performance.now();
            const duration = 1.0;
            
            const animateRing = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > duration) {
                    this.scene.remove(ring);
                    return;
                }
                
                const progress = elapsed / duration;
                
                // Shrink the ring
                const scale = 3 * (1 - progress);
                ring.scale.set(scale, scale, scale);
                
                // Fade out at the end
                ring.material.opacity = 0.7 * (1 - Math.pow(progress, 2));
                
                // Move upward
                ring.position.y = position.y - 1 + progress * 4;
                
                requestAnimationFrame(animateRing);
            };
            
            // Start animation with a delay based on index
            setTimeout(() => {
                animateRing();
            }, i * 150);
        }
        
        // Add a flash at the end
        setTimeout(() => {
            const flashGeometry = new THREE.SphereGeometry(1, 16, 16);
            const flashMaterial = new THREE.MeshBasicMaterial({
                color: 0xE74C3C,
                transparent: true,
                opacity: 0.8
            });
            
            const flash = new THREE.Mesh(flashGeometry, flashMaterial);
            flash.position.copy(position);
            this.scene.add(flash);
            
            // Animate flash
            const startTime = performance.now();
            const duration = 0.5;
            
            const animateFlash = () => {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > duration) {
                    this.scene.remove(flash);
                    return;
                }
                
                const progress = elapsed / duration;
                
                // Expand then contract
                const scale = 3 * progress * (1 - progress) * 4 + 0.5;
                flash.scale.set(scale, scale, scale);
                
                // Fade out
                flash.material.opacity = 0.8 * (1 - progress);
                
                requestAnimationFrame(animateFlash);
            };
            
            animateFlash();
        }, ringCount * 150);
    }
    
    createBotDestructionEffect(position) {
        // Create explosion effect when bot is destroyed
        
        // Create fragments
        const fragmentCount = 15;
        const fragments = [];
        
        for (let i = 0; i < fragmentCount; i++) {
            // Create random geometry for each fragment
            const geometryTypes = [
                new THREE.BoxGeometry(0.2, 0.2, 0.2),
                new THREE.SphereGeometry(0.1, 8, 8),
                new THREE.TetrahedronGeometry(0.15)
            ];
            
            const geometry = geometryTypes[Math.floor(Math.random() * geometryTypes.length)];
            const material = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xE74C3C : 0x888888,
                transparent: true,
                opacity: 0.9
            });
            
            const fragment = new THREE.Mesh(geometry, material);
            
            // Position fragment at bot position with small random offset
            fragment.position.copy(position);
            fragment.position.x += (Math.random() - 0.5) * 0.3;
            fragment.position.y += (Math.random() - 0.5) * 0.3 + 0.5;
            fragment.position.z += (Math.random() - 0.5) * 0.3;
            
            // Random rotation
            fragment.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            // Add physics properties
            fragment.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    Math.random() * 5 + 2,
                    (Math.random() - 0.5) * 5
                ),
                rotationSpeed: new THREE.Vector3(
                    Math.random() * 10 - 5,
                    Math.random() * 10 - 5,
                    Math.random() * 10 - 5
                )
            };
            
            this.scene.add(fragment);
            fragments.push(fragment);
        }
        
        // Create central explosion flash
        const flashGeometry = new THREE.SphereGeometry(1, 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF5722,
            transparent: true,
            opacity: 0.8
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        this.scene.add(flash);
        
        // Animate fragments and flash
        const startTime = performance.now();
        const duration = 2.0;
        
        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > duration) {
                // Remove all fragments and flash
                for (const fragment of fragments) {
                    this.scene.remove(fragment);
                }
                this.scene.remove(flash);
                return;
            }
            
            // Update flash
            if (elapsed < 0.5) {
                const flashProgress = elapsed / 0.5;
                const scale = 1 + flashProgress;
                flash.scale.set(scale, scale, scale);
                flash.material.opacity = 0.8 * (1 - flashProgress);
            } else if (flash.parent) {
                this.scene.remove(flash);
            }
            
            // Update fragments
            for (const fragment of fragments) {
                // Apply velocity
                fragment.position.add(fragment.userData.velocity.clone().multiplyScalar(0.016));
                
                // Apply gravity
                fragment.userData.velocity.y -= 9.8 * 0.016;
                
                // Apply rotation
                fragment.rotation.x += fragment.userData.rotationSpeed.x * 0.016;
                fragment.rotation.y += fragment.userData.rotationSpeed.y * 0.016;
                fragment.rotation.z += fragment.userData.rotationSpeed.z * 0.016;
                
                // Fade out
                const fragProgress = elapsed / duration;
                fragment.material.opacity = 0.9 * (1 - fragProgress);
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    setActive(active) {
        this.active = active;
        
        // If deactivating, remove all bots
        if (!active) {
            this.removeAllBots();
        }
    }
    
    removeAllBots() {
        for (const bot of this.bots) {
            this.scene.remove(bot.mesh);
        }
        this.bots = [];
    }
}
