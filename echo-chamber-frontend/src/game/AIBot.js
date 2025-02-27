import { SonicPulse } from './SonicPulse.js';

export class AIBot {
    constructor(position, scene, audioManager) {
        this.position = position.clone();
        this.scene = scene;
        this.audioManager = audioManager;
        
        // Bot properties
        this.health = 100;
        this.moveSpeed = 3;
        this.turnSpeed = 2;
        this.fireRate = 2; // seconds between shots
        this.fireTimer = Math.random() * this.fireRate; // Randomize initial fire time
        this.detectionRadius = 20;
        this.attackRange = 15;
        this.height = 1.8;
        this.radius = 0.5;
        
        // State
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3(0, 0, -1);
        this.targetPosition = null;
        this.isMoving = false;
        this.lastSeenPlayerPosition = null;
        this.state = 'patrolling'; // patrolling, chasing, attacking
        this.patrolPoint = null;
        this.patrolWaitTime = 0;
        
        // Create 3D model
        this.createModel();
    }
    
    createModel() {
        // Create a group to hold all parts
        this.mesh = new THREE.Group();
        
        // Create body
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xE74C3C,
            metalness: 0.7,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.6;
        this.mesh.add(body);
        
        // Create head
        const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xE74C3C,
            metalness: 0.8,
            roughness: 0.2
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.35;
        this.mesh.add(head);
        
        // Create eye visor
        const visorGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.2);
        const visorMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x3498DB,
            transparent: true,
            opacity: 0.8
        });
        const visor = new THREE.Mesh(visorGeometry, visorMaterial);
        visor.position.y = 1.35;
        visor.position.z = 0.2;
        this.mesh.add(visor);
        
        // Create weapon
        const weaponGroup = new THREE.Group();
        
        const gunBodyGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
        const gunBodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.9,
            roughness: 0.1
        });
        const gunBody = new THREE.Mesh(gunBodyGeometry, gunBodyMaterial);
        weaponGroup.add(gunBody);
        
        // Gun barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
        const barrel = new THREE.Mesh(gunBodyMaterial, barrelGeometry);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.4;
        weaponGroup.add(barrel);
        
        // Add weapon to body
        weaponGroup.position.set(0.3, 0.8, 0.2);
        this.mesh.add(weaponGroup);
        this.weapon = weaponGroup;
        
        // Add glowing emitter at barrel end
        const emitterGeometry = new THREE.SphereGeometry(0.04, 8, 8);
        const emitterMaterial = new THREE.MeshBasicMaterial({
            color: 0x3498DB,
            emissive: 0x3498DB,
            emissiveIntensity: 0.5
        });
        this.emitter = new THREE.Mesh(emitterGeometry, emitterMaterial);
        this.emitter.position.set(0.3, 0.8, -0.4);
        this.mesh.add(this.emitter);
        
        // Add to scene at position
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        
        // Add shadow casting
        this.mesh.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }
    
    update(deltaTime, world, player) {
        // Update AI state
        this.updateAIState(player);
        
        // Handle movement based on state
        switch (this.state) {
            case 'patrolling':
                this.handlePatrolling(deltaTime, world);
                break;
            case 'chasing':
                this.chasePlayer(deltaTime, world, player);
                break;
            case 'attacking':
                this.attackPlayer(deltaTime, player);
                break;
        }
        
        // Apply velocity
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.mesh.position.copy(this.position);
        
        // Update weapon rotation to point at player if in attack mode
        if (this.state === 'attacking' && player) {
            this.lookAtPlayer(player);
        }
        
        // Update emitter glow when firing
        if (this.fireTimer < 0.1) {
            this.emitter.material.emissiveIntensity = 2;
        } else {
            this.emitter.material.emissiveIntensity = 0.5;
        }
    }
    
    updateAIState(player) {
        // Distance to player
        const distanceToPlayer = this.position.distanceTo(player.position);
        
        // Check if player is visible
        const canSeePlayer = this.canSeePlayer(player);
        
        if (canSeePlayer) {
            this.lastSeenPlayerPosition = player.position.clone();
            
            if (distanceToPlayer < this.attackRange) {
                this.state = 'attacking';
            } else {
                this.state = 'chasing';
            }
        } else {
            // Lost sight of player
            if (this.state === 'chasing' || this.state === 'attacking') {
                // If we were chasing or attacking, go to last seen position
                if (this.lastSeenPlayerPosition && 
                    this.position.distanceTo(this.lastSeenPlayerPosition) > 1) {
                    this.targetPosition = this.lastSeenPlayerPosition;
                } else {
                    // Reached last seen position, go back to patrolling
                    this.state = 'patrolling';
                    this.patrolPoint = null;
                }
            }
        }
    }
    
    canSeePlayer(player) {
        // Check if player is within detection radius
        const distanceToPlayer = this.position.distanceTo(player.position);
        if (distanceToPlayer > this.detectionRadius) {
            return false;
        }
        
        // Check if there's a wall between bot and player
        const direction = player.position.clone().sub(this.position).normalize();
        const ray = new THREE.Raycaster(
            this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), // Start slightly above bot position
            direction,
            0,
            distanceToPlayer
        );
        
        const intersects = ray.intersectObjects(this.scene.children, true);
        
        // Check if any intersections are walls
        for (const intersection of intersects) {
            if (intersection.object.userData && 
                intersection.object.userData.type === 'wall') {
                return false; // Wall blocks line of sight
            }
        }
        
        return true;
    }
    
    handlePatrolling(deltaTime, world) {
        // If no patrol point or reached current one, pick a new one
        if (!this.patrolPoint || this.position.distanceTo(this.patrolPoint) < 1) {
            if (this.patrolWaitTime > 0) {
                // Wait at current position
                this.patrolWaitTime -= deltaTime;
                this.velocity.set(0, 0, 0);
                return;
            }
            
            // Pick a new patrol point
            this.patrolPoint = this.getRandomPatrolPoint(world);
            this.patrolWaitTime = 2 + Math.random() * 3; // 2-5 seconds wait time
        }
        
        // Move towards patrol point
        this.moveTowardsTarget(this.patrolPoint, deltaTime, 0.5); // Move at half speed when patrolling
    }
    
    getRandomPatrolPoint(world) {
        // Get a random point within a certain radius of current position
        const patrolRadius = 10;
        const maxAttempts = 10;
        
        for (let i = 0; i < maxAttempts; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 3 + Math.random() * patrolRadius;
            
            const x = this.position.x + Math.cos(angle) * distance;
            const z = this.position.z + Math.sin(angle) * distance;
            
            const testPos = new THREE.Vector3(x, this.position.y, z);
            
            // Check if position is valid (not inside a wall)
            if (!world.checkCollision(testPos, this.radius)) {
                return testPos;
            }
        }
        
        // If all attempts failed, just return current position
        return this.position.clone();
    }
    
    chasePlayer(deltaTime, world, player) {
        // Simple chase - move directly towards player
        this.moveTowardsTarget(player.position, deltaTime);
    }
    
    moveTowardsTarget(target, deltaTime, speedMultiplier = 1.0) {
        // Calculate direction to target
        const directionToTarget = new THREE.Vector3().subVectors(target, this.position).normalize();
        
        // Calculate velocity
        this.velocity.x = directionToTarget.x * this.moveSpeed * speedMultiplier;
        this.velocity.z = directionToTarget.z * this.moveSpeed * speedMultiplier;
        
        // Keep Y velocity at 0 (no flying)
        this.velocity.y = 0;
        
        // Rotate bot mesh to face movement direction
        if (this.velocity.length() > 0.1) {
            const targetRotation = Math.atan2(directionToTarget.x, directionToTarget.z);
            
            // Get current rotation
            const currentRotation = this.mesh.rotation.y;
            
            // Calculate shortest rotation path
            let rotationDiff = targetRotation - currentRotation;
            while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
            while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
            
            // Apply smooth rotation with turn speed
            const rotation = currentRotation + rotationDiff * Math.min(this.turnSpeed * deltaTime, 1);
            this.mesh.rotation.y = rotation;
        }
    }
    
    lookAtPlayer(player) {
        // Make weapon point at player
        const directionToPlayer = new THREE.Vector3().subVectors(player.position, this.position).normalize();
        
        // Calculate target angles for weapon
        const horizontalDistance = Math.sqrt(
            directionToPlayer.x * directionToPlayer.x + 
            directionToPlayer.z * directionToPlayer.z
        );
        const verticalAngle = Math.atan2(directionToPlayer.y, horizontalDistance);
        
        // Apply smooth rotation to weapon (pitch only)
        this.weapon.rotation.x = verticalAngle;
    }
    
    attackPlayer(deltaTime, player) {
        // Face player
        this.lookAtPlayer(player);
        
        // Stop moving when attacking
        this.velocity.set(0, 0, 0);
        
        // Fire at player
        this.fireTimer -= deltaTime;
        if (this.fireTimer <= 0) {
            this.fireSonicPulse(player.position);
            this.fireTimer = this.fireRate;
        }
    }
    
    fireSonicPulse(targetPosition) {
        // Calculate direction to target
        const direction = new THREE.Vector3().subVectors(targetPosition, this.position).normalize();
        
        // Add some inaccuracy based on distance
        const inaccuracy = 0.05; // Lower is more accurate
        direction.x += (Math.random() - 0.5) * inaccuracy;
        direction.y += (Math.random() - 0.5) * inaccuracy;
        direction.z += (Math.random() - 0.5) * inaccuracy;
        direction.normalize();
        
        // Get position of emitter in world space
        const pulseStartPosition = new THREE.Vector3();
        this.emitter.getWorldPosition(pulseStartPosition);
        
        // Create pulse
        const pulse = new SonicPulse(
            pulseStartPosition,
            direction,
            15, // Speed
            15, // Base damage (less than player)
            2   // Max bounces (less than player)
        );
        
        // Set pulse as enemy pulse (to not hit this enemy)
        pulse.isEnemyPulse = true;
        pulse.sourceEnemy = this;
        
        // Add to game
        const pulseAddedEvent = new CustomEvent('pulse-added', { detail: { pulse } });
        document.dispatchEvent(pulseAddedEvent);
        
        // Play sound
        this.audioManager.playSound('fireWeapon', this.position);
    }
    
    takeDamage(amount) {
        this.health -= amount;
        
        // Visual feedback - flash red
        this.mesh.traverse(child => {
            if (child.isMesh && child.material && child.material.color) {
                // Store original color
                const originalColor = child.material.color.clone();
                
                // Flash red
                child.material.color.set(0xff0000);
                
                // Restore original color after a short delay
                setTimeout(() => {
                    child.material.color.copy(originalColor);
                }, 100);
            }
        });
        
        // Play hit sound
        this.audioManager.playSound('takeDamage', this.position);
    }
    
    isDead() {
        return this.health <= 0;
    }
}