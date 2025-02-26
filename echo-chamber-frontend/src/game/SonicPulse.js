export class SonicPulse {
    constructor(position, direction, speed, baseDamage, maxBounces) {
        this.position = position;
        this.direction = direction.normalize();
        this.speed = speed;
        this.baseDamage = baseDamage;
        this.maxBounces = maxBounces;
        this.bounceCount = 0;
        this.radius = 0.2;
        this.lifeTime = 5; // seconds
        
        // Pulse grows stronger with each bounce
        this.damageMultiplier = 1;
        this.bounceMultiplier = 1.5; // 50% damage increase per bounce
        
        // Create the pulse mesh
        this.createMesh();
        
        // Sound wave ripple effect
        this.rippleEffects = [];
    }
    
    createMesh() {
        // Increase the radius for better visibility
        this.radius = 0.3;
        
        // Create a sphere geometry for the pulse
        const geometry = new THREE.SphereGeometry(this.radius, 16, 16);
        
        // Create material with glow effect
        const material = new THREE.MeshBasicMaterial({
            color: 0x3498db,
            transparent: true,
            opacity: 0.9,
            emissive: 0x3498db,
            emissiveIntensity: 1
        });
        
        // Create the mesh
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        
        // Add a point light to create a glow effect
        this.light = new THREE.PointLight(0x3498db, 2, 5);
        this.light.position.copy(this.position);
        this.mesh.add(this.light);
        
        // Add a larger, more transparent outer sphere for a glow effect
        const glowGeometry = new THREE.SphereGeometry(this.radius * 1.5, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x3498db,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.mesh.add(glowMesh);
    }
    
    update(deltaTime, world) {
        // Decrease lifetime
        this.lifeTime -= deltaTime;
        
        // Move pulse
        const movement = this.direction.clone().multiplyScalar(this.speed * deltaTime);
        this.position.add(movement);
        this.mesh.position.copy(this.position);
        
        // Pulse effect animation
        this.animatePulse(deltaTime);
        
        // Check for collisions with walls
        this.checkWallCollisions(world);
        
        // Create sound ripple effects
        this.createRippleEffect(deltaTime);
        
        // Update existing ripple effects
        this.updateRippleEffects(deltaTime);
    }
    
    checkWallCollisions(world) {
        // Get collision result with world
        const collision = world.checkPulseCollision(this.position, this.direction, this.radius);
        
        if (collision.hit) {
            // Calculate reflection direction
            this.direction.reflect(collision.normal);
            
            // Increment bounce count
            this.bounceCount++;
            
            // Increase damage multiplier
            this.damageMultiplier *= this.bounceMultiplier;
            
            // Change color based on bounce count to indicate power
            const colors = [0x3498db, 0x2ecc71, 0xf39c12, 0xe74c3c, 0x9b59b6];
            const colorIndex = Math.min(this.bounceCount, colors.length - 1);
            
            // Update material color
            this.mesh.material.color.setHex(colors[colorIndex]);
            this.light.color.setHex(colors[colorIndex]);
            
            // Increase light intensity
            this.light.intensity = 1 + (this.bounceCount * 0.5);
            
            // Create a bounce effect
            this.createBounceEffect(collision.point, collision.normal);
            
            // Destroy pulse if it reached max bounces
            if (this.bounceCount >= this.maxBounces) {
                this.lifeTime = 0;
            }
        }
    }
    
    createBounceEffect(position, normal) {
        // This would create a visual effect at the bounce point
        // For simplicity, we're just creating a placeholder
        
        // In a full implementation, you'd create particle effects
        // and play a sound at the bounce location
    }
    
    createRippleEffect(deltaTime) {
        // Create ripple effect along pulse path to show sound waves
        // This is a simplified version - a full implementation would use
        // more sophisticated particle systems
        
        // Create ripple at random intervals
        if (Math.random() < deltaTime * 5) {
            // Create a ripple geometry
            const rippleGeometry = new THREE.RingGeometry(0.1, 0.2, 16);
            const rippleMaterial = new THREE.MeshBasicMaterial({
                color: this.mesh.material.color,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            });
            
            const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
            ripple.position.copy(this.position);
            
            // Orient the ring perpendicular to movement
            ripple.lookAt(this.position.clone().add(this.direction));
            
            // Add properties for animation
            ripple.userData = {
                lifetime: 1,
                maxLifetime: 1,
                maxRadius: 2 + (this.bounceCount * 0.5)
            };
            
            // Add to scene and tracking array
            this.mesh.add(ripple);
            this.rippleEffects.push(ripple);
        }
    }
    
    updateRippleEffects(deltaTime) {
        // Update existing ripple effects
        for (let i = this.rippleEffects.length - 1; i >= 0; i--) {
            const ripple = this.rippleEffects[i];
            
            // Decrease lifetime
            ripple.userData.lifetime -= deltaTime;
            
            // Scale up the ripple
            const progress = 1 - (ripple.userData.lifetime / ripple.userData.maxLifetime);
            const scale = 1 + (progress * ripple.userData.maxRadius);
            ripple.scale.set(scale, scale, scale);
            
            // Fade out
            ripple.material.opacity = 0.7 * (1 - progress);
            
            // Remove if expired
            if (ripple.userData.lifetime <= 0) {
                this.mesh.remove(ripple);
                this.rippleEffects.splice(i, 1);
            }
        }
    }
    
    animatePulse(deltaTime) {
        // Pulse effect (grow and shrink slightly)
        const pulseFactor = 1 + 0.1 * Math.sin(performance.now() * 0.01);
        this.mesh.scale.set(pulseFactor, pulseFactor, pulseFactor);
    }
    
    checkPlayerCollision(player) {
        // Calculate distance between pulse and player
        const distance = this.position.distanceTo(player.position);
        
        // Check if collision occurred
        return distance < (this.radius + player.radius);
    }
    
    getDamage() {
        // Calculate damage based on base damage and multiplier
        return this.baseDamage * this.damageMultiplier;
    }
}