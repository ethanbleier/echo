export class RemotePlayer {
    constructor(id, initialPosition, initialHealth) {
        this.id = id;
        this.position = new THREE.Vector3(
            initialPosition.x, 
            initialPosition.y, 
            initialPosition.z
        );
        this.targetPosition = this.position.clone();
        this.rotation = new THREE.Euler(
            initialPosition.rx || 0,
            initialPosition.ry || 0,
            0,
            'YXZ'
        );
        this.targetRotation = this.rotation.clone();
        this.health = initialHealth || 100;
        this.radius = 0.5; // For collision detection
        this.height = 1.7;
        
        // Create 3D model
        this.createModel();
        
        // Position interpolation settings
        this.lerpFactor = 0.3; // Controls how quickly positions are interpolated
    }
    
    createModel() {
        // Create a group to hold all player parts
        this.model = new THREE.Group();
        
        // Create body (cylinder)
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.3, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x2980b9 });
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.body.position.y = 0.65;
        this.model.add(this.body);
        
        // Create head (sphere)
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xecf0f1 });
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.position.y = 1.45;
        this.model.add(this.head);
        
        // Create weapon model
        const gunGroup = new THREE.Group();
        
        // Gun body
        const gunBodyGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const gunBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const gunBody = new THREE.Mesh(gunBodyGeometry, gunBodyMaterial);
        gunBody.position.z = 0.25;
        gunGroup.add(gunBody);
        
        // Gun barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
        const barrelMaterial = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = 0.6;
        gunGroup.add(barrel);
        
        // Position gun in hand
        gunGroup.position.set(0.4, 0.9, 0);
        gunGroup.rotation.set(0, -Math.PI/2, 0);
        this.gunGroup = gunGroup;
        this.model.add(gunGroup);
        
        // Create health bar
        this.createHealthBar();
        
        // Set initial position
        this.model.position.copy(this.position);
        
        // Set up shadows
        this.body.castShadow = true;
        this.body.receiveShadow = true;
        this.head.castShadow = true;
        this.head.receiveShadow = true;
    }
    
    createHealthBar() {
        // Create a container for the health bar
        this.healthBar = new THREE.Group();
        
        // Background bar
        const bgGeometry = new THREE.PlaneGeometry(0.8, 0.1);
        const bgMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            transparent: true,
            opacity: 0.5
        });
        const bgBar = new THREE.Mesh(bgGeometry, bgMaterial);
        this.healthBar.add(bgBar);
        
        // Health fill
        const fillGeometry = new THREE.PlaneGeometry(0.8, 0.1);
        const fillMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x2ecc71
        });
        this.healthFill = new THREE.Mesh(fillGeometry, fillMaterial);
        this.healthFill.position.z = 0.01; // Slightly in front of background
        this.healthBar.add(this.healthFill);
        
        // Position health bar above player's head
        this.healthBar.position.y = 1.9;
        this.healthBar.rotation.x = -Math.PI / 2; // Make it face up
        
        // Add to model
        this.model.add(this.healthBar);
        
        // Update health display
        this.updateHealthDisplay();
    }
    
    updateHealthDisplay() {
        const healthPercent = this.health / 100;
        
        // Scale health fill
        this.healthFill.scale.x = healthPercent;
        this.healthFill.position.x = -0.4 * (1 - healthPercent);
        
        // Change color based on health
        if (healthPercent > 0.6) {
            this.healthFill.material.color.setHex(0x2ecc71); // Green
        } else if (healthPercent > 0.3) {
            this.healthFill.material.color.setHex(0xf39c12); // Orange
        } else {
            this.healthFill.material.color.setHex(0xe74c3c); // Red
        }
    }
    
    update(deltaTime) {
        // Interpolate position
        this.position.lerp(this.targetPosition, this.lerpFactor);
        
        // Interpolate rotation (simple linear interpolation for Euler angles)
        this.rotation.x += (this.targetRotation.x - this.rotation.x) * this.lerpFactor;
        this.rotation.y += (this.targetRotation.y - this.rotation.y) * this.lerpFactor;
        
        // Update model position
        this.model.position.copy(this.position);
        
        // Update model rotation (only Y component for the body rotation)
        this.model.rotation.y = this.rotation.y;
        
        // Update head rotation (X component for looking up/down)
        this.head.rotation.x = this.rotation.x;
        
        // Make health bar face the camera
        if (this.healthBar) {
            // We'll update this in the render loop to face the camera
        }
    }
    
    setPosition(position) {
        this.targetPosition.set(position.x, position.y, position.z);
    }
    
    setRotation(rotation) {
        this.targetRotation.x = rotation.rx || 0;
        this.targetRotation.y = rotation.ry || 0;
    }
    
    setHealth(health) {
        this.health = health;
        this.updateHealthDisplay();
    }
    
    checkPulseCollision(pulse) {
        // Simple distance-based collision detection
        const headPosition = this.position.clone().add(new THREE.Vector3(0, this.height - 0.25, 0));
        const bodyPosition = this.position.clone().add(new THREE.Vector3(0, this.height / 2, 0));
        
        // Check collision with head
        const headDistance = headPosition.distanceTo(pulse.position);
        if (headDistance < (0.25 + pulse.radius)) { // Head radius + pulse radius
            return true;
        }
        
        // Check collision with body (simplify as a vertical line segment)
        const bodyTopY = this.position.y + this.height - 0.5; // Exclude head
        const bodyBottomY = this.position.y;
        
        // Check if pulse is at the right height for body collision
        if (pulse.position.y >= bodyBottomY && pulse.position.y <= bodyTopY) {
            // Check horizontal distance to body center
            const horizontalPos = new THREE.Vector2(this.position.x, this.position.z);
            const pulseHorizontalPos = new THREE.Vector2(pulse.position.x, pulse.position.z);
            
            const horizontalDistance = horizontalPos.distanceTo(pulseHorizontalPos);
            if (horizontalDistance < (this.radius + pulse.radius)) {
                return true;
            }
        }
        
        return false;
    }
    
    alignHealthBarToCamera(camera) {
        if (this.healthBar) {
            // Make the health bar face the camera
            const cameraPosition = camera.position.clone();
            this.healthBar.lookAt(cameraPosition);
            
            // Keep it horizontal
            this.healthBar.rotation.x = -Math.PI / 2;
        }
    }
}