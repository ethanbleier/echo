import { SonicPulse } from './SonicPulse.js';

export class Player {
    constructor(camera, scene, audioManager) {
        this.camera = camera;
        this.scene = scene;
        this.audioManager = audioManager;
        
        // Player properties
        this.position = new THREE.Vector3(0, 1.7, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.health = 100;
        this.maxHealth = 100;
        this.pulseCount = 5;
        this.maxPulses = 5;
        this.pulseRechargeTime = 1.5; // seconds
        this.pulseRechargeTimer = 0;
        this.fireRate = 0.5; // seconds between shots
        this.nextFireTime = 0;
        
        // Movement properties
        this.moveSpeed = 5;
        this.jumpForce = 8;
        this.gravity = 20;
        this.isGrounded = true;
        
        // Input state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.jump = false;
        this.fire = false;
        
        // Collision detection
        this.height = 1.7;
        this.radius = 0.5;
        
        // Create weapon model
        this.createWeaponModel();
        
        // Set up keyboard events
        this.setupControls();
    }
    
    setupControls() {
        document.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'KeyW':
                    this.moveForward = true;
                    break;
                case 'KeyS':
                    this.moveBackward = true;
                    break;
                case 'KeyA':
                    this.moveLeft = true;
                    break;
                case 'KeyD':
                    this.moveRight = true;
                    break;
                case 'Space':
                    this.jump = true;
                    break;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            switch (event.code) {
                case 'KeyW':
                    this.moveForward = false;
                    break;
                case 'KeyS':
                    this.moveBackward = false;
                    break;
                case 'KeyA':
                    this.moveLeft = false;
                    break;
                case 'KeyD':
                    this.moveRight = false;
                    break;
                case 'Space':
                    this.jump = false;
                    break;
            }
        });
        
        document.addEventListener('mousedown', (event) => {
            if (event.button === 0) { // Left click
                this.fire = true;
            }
        });
        
        document.addEventListener('mouseup', (event) => {
            if (event.button === 0) { // Left click
                this.fire = false;
            }
        });
    }
    
    update(deltaTime, world) {
        // Handle movement input
        this.handleMovement(deltaTime, world);
        
        // Handle firing
        this.handleFiring(deltaTime);
        
        // Recharge sonic pulses
        this.rechargePulses(deltaTime);
        
        // Update ammo counter display
        this.updateAmmoDisplay();
        
        // Update camera position
        this.camera.position.copy(this.position);
        
        // Update weapon position and animation
        this.updateWeapon(deltaTime);
    }
    
    createWeaponModel() {
        // Create a gun group to hold all gun parts
        this.weaponGroup = new THREE.Group();
        
        // Create gun body (simple box)
        const bodyGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.z = -0.25;
        this.weaponGroup.add(body);
        
        // Create gun barrel (cylinder)
        const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 16);
        const barrelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x666666,
            metalness: 0.9,
            roughness: 0.1
        });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.6;
        this.weaponGroup.add(barrel);
        
        // Create emitter at end of barrel (for sonic pulses)
        const emitterGeometry = new THREE.CylinderGeometry(0.04, 0.05, 0.05, 16);
        const emitterMaterial = new THREE.MeshStandardMaterial({
            color: 0x3498db,
            emissive: 0x3498db,
            emissiveIntensity: 0.5
        });
        this.emitter = new THREE.Mesh(emitterGeometry, emitterMaterial);
        this.emitter.rotation.x = Math.PI / 2;
        this.emitter.position.z = -0.85;
        this.weaponGroup.add(this.emitter);
        
        // Create grip
        const gripGeometry = new THREE.BoxGeometry(0.08, 0.18, 0.1);
        const gripMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 0.9
        });
        const grip = new THREE.Mesh(gripGeometry, gripMaterial);
        grip.position.y = -0.14;
        grip.position.z = -0.15;
        this.weaponGroup.add(grip);
        
        // Position the weapon in front of camera
        this.weaponGroup.position.set(0.3, -0.3, -0.5);
        
        // Add weapon animation properties
        this.weaponBob = 0;
        this.weaponRecoil = 0;
        
        // Add weapon to camera (so it moves with camera)
        this.camera.add(this.weaponGroup);
    }
    
    updateWeapon(deltaTime) {
        // Simple weapon bobbing effect based on movement
        if (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight) {
            this.weaponBob += deltaTime * 10;
        } else {
            // Gradually return to neutral when not moving
            this.weaponBob += deltaTime * 2;
        }
        
        // Apply subtle bobbing effect
        const bobAmount = 0.02;
        this.weaponGroup.position.y = -0.3 + Math.sin(this.weaponBob) * bobAmount;
        
        // Handle recoil animation
        if (this.weaponRecoil > 0) {
            this.weaponRecoil -= deltaTime * 5;
            if (this.weaponRecoil < 0) this.weaponRecoil = 0;
        }
        
        // Apply recoil position
        this.weaponGroup.position.z = -0.5 - (this.weaponRecoil * 0.1);
        
        // Animate emitter glow when firing
        if (this.nextFireTime > this.fireRate - 0.1) {
            this.emitter.material.emissiveIntensity = 2;
        } else {
            this.emitter.material.emissiveIntensity = 0.5;
        }
    }
    
    handleMovement(deltaTime, world) {
        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y -= this.gravity * deltaTime;
        }
        
        // Calculate movement direction based on camera orientation
        const moveDirection = new THREE.Vector3(0, 0, 0);
        
        if (this.moveForward) {
            moveDirection.z -= 1;
        }
        if (this.moveBackward) {
            moveDirection.z += 1;
        }
        if (this.moveLeft) {
            moveDirection.x -= 1;
        }
        if (this.moveRight) {
            moveDirection.x += 1;
        }
        
        // Normalize and rotate movement direction based on camera
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
            
            // Get camera's forward direction (excluding Y component)
            const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            cameraDirection.y = 0;
            cameraDirection.normalize();
            
            // Calculate camera's right direction
            const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
            cameraRight.y = 0;
            cameraRight.normalize();
            
            // Calculate final movement velocity
            this.velocity.x = (moveDirection.x * cameraRight.x + moveDirection.z * cameraDirection.x) * this.moveSpeed;
            this.velocity.z = (moveDirection.x * cameraRight.z + moveDirection.z * cameraDirection.z) * this.moveSpeed;
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }
        
        // Handle jumping
        if (this.jump && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
            this.audioManager.playSound('jump');
        }
        
        // Apply velocity with collision detection
        this.applyVelocityWithCollisions(deltaTime, world);
    }
    
    applyVelocityWithCollisions(deltaTime, world) {
        // Simple placeholder for collision detection
        // This would be replaced with more sophisticated physics in a full implementation
        
        // Move in X direction
        this.position.x += this.velocity.x * deltaTime;
        
        // Check for wall collisions in X
        if (world.checkCollision(this.position, this.radius)) {
            this.position.x -= this.velocity.x * deltaTime;
            this.velocity.x = 0;
        }
        
        // Move in Z direction
        this.position.z += this.velocity.z * deltaTime;
        
        // Check for wall collisions in Z
        if (world.checkCollision(this.position, this.radius)) {
            this.position.z -= this.velocity.z * deltaTime;
            this.velocity.z = 0;
        }
        
        // Move in Y direction
        this.position.y += this.velocity.y * deltaTime;
        
        // Check for floor collision
        if (this.position.y < this.height / 2) {
            this.position.y = this.height / 2;
            this.velocity.y = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }
        
        // Check for ceiling collision
        if (world.checkCeilingCollision(this.position, this.height)) {
            // Push down and stop upward velocity
            this.position.y -= 0.1;
            this.velocity.y = 0;
        }
    }
    
    handleFiring(deltaTime) {
        // Update fire timer
        if (this.nextFireTime > 0) {
            this.nextFireTime -= deltaTime;
        }
        
        // Handle firing input
        if (this.fire && this.nextFireTime <= 0 && this.pulseCount > 0) {
            this.fireSonicPulse();
            this.nextFireTime = this.fireRate;
            this.pulseCount--;
        }
    }
    
    fireSonicPulse() {
        // Create a new sonic pulse
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        // Get the position of the gun barrel for pulse starting point
        const pulseStartPosition = new THREE.Vector3();
        this.emitter.getWorldPosition(pulseStartPosition);
        
        const pulse = new SonicPulse(
            pulseStartPosition,     // Start position (gun barrel)
            direction,              // Direction (camera direction)
            15,                     // Speed
            20,                     // Base damage
            3                       // Max bounces
        );
        
        // Add the pulse to the game
        const pulseAddedEvent = new CustomEvent('pulse-added', { detail: { pulse } });
        document.dispatchEvent(pulseAddedEvent);
        
        // Play sound effect
        this.audioManager.playSound('fireWeapon');
        
        // Trigger weapon recoil
        this.weaponRecoil = 1.0;
    }
    
    rechargePulses(deltaTime) {
        if (this.pulseCount < this.maxPulses) {
            this.pulseRechargeTimer += deltaTime;
            
            if (this.pulseRechargeTimer >= this.pulseRechargeTime) {
                this.pulseCount++;
                this.pulseRechargeTimer = 0;
                
                // Play recharge sound
                this.audioManager.playSound('recharge');
            }
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) {
            this.health = 0;
        }
        
        // Play hit sound
        this.audioManager.playSound('takeDamage');
    }
    
    reset() {
        this.health = this.maxHealth;
        this.pulseCount = this.maxPulses;
        this.position.set(0, 1.7, 0);
        this.velocity.set(0, 0, 0);
    }
    
    updateAmmoDisplay() {
        const ammoCounter = document.getElementById('ammo-counter');
        ammoCounter.textContent = `Pulses: ${this.pulseCount}`;
    }
}