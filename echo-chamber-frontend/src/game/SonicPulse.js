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
            
            // Apply material effects
            this.applyMaterialEffects(collision.material);
            
            // Increment bounce count
            this.bounceCount++;
            
            // Increase damage multiplier based on material properties
            const materialAmplification = collision.material ? 
                collision.material.amplification : this.bounceMultiplier;
            this.damageMultiplier *= materialAmplification;
            
            // Increase size slightly with each bounce
            const sizeFactor = 1 + (this.bounceCount * 0.15);
            this.mesh.scale.set(sizeFactor, sizeFactor, sizeFactor);
            
            // Change color based on bounce count to indicate power
            const colors = [0x3498db, 0x2ecc71, 0xf39c12, 0xe74c3c, 0x9b59b6];
            const colorIndex = Math.min(this.bounceCount, colors.length - 1);
            
            // Update material color
            this.mesh.material.color.setHex(colors[colorIndex]);
            this.light.color.setHex(colors[colorIndex]);
            
            // Increase light intensity
            this.light.intensity = 1 + (this.bounceCount * 0.7);
            
            // Increase light distance
            this.light.distance = 4 + (this.bounceCount * 1.5);
            
            // Create a bounce effect
            this.createBounceEffect(collision.point, collision.normal, collision.material);
            
            // Destroy pulse if it reached max bounces
            if (this.bounceCount >= this.maxBounces) {
                this.createExplosionEffect();
                this.lifeTime = 0;
            }
        }
    }
    
    applyMaterialEffects(material) {
        if (!material) return;
        
        // Different materials have different effects
        switch(true) {
            case material.type === 'metal':
                // Metal increases velocity and creates more intense bounce
                this.speed *= 1.1;
                break;
                
            case material.type === 'glass' && material.breakable:
                // Glass breaks and gives a big one-time boost
                this.damageMultiplier *= 1.5;
                this.speed *= 1.3;
                // Note: In a full implementation, you'd actually break the glass
                break;
                
            case material.type === 'soft':
                // Soft surfaces slow the pulse and reduce its power
                this.speed *= 0.8;
                this.damageMultiplier *= 0.8;
                break;
        }
    }
    
    createBounceEffect(position, normal, material) {
        // Create a temporary flash at bounce point
        const flashGeometry = new THREE.SphereGeometry(0.3 + (this.bounceCount * 0.1), 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: this.mesh.material.color,
            transparent: true,
            opacity: 0.7
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        this.mesh.parent.add(flash);
        
        // Create shockwave ring
        const ringGeometry = new THREE.RingGeometry(0.1, 0.3, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: this.mesh.material.color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        
        // Orient the ring perpendicular to the surface normal
        ring.lookAt(position.clone().add(normal));
        
        this.mesh.parent.add(ring);
        
        // Material-specific effects
        if (material) {
            if (material.type === 'metal') {
                // Metal creates sparks
                this.createSparkEffect(position, normal);
            } else if (material.type === 'glass' && material.breakable) {
                // Glass creates a shatter effect
                this.createShatterEffect(position, normal);
            }
        }
        
        // Animate and remove after a short time
        const startTime = performance.now();
        const animateAndRemove = () => {
            const elapsedTime = (performance.now() - startTime) / 1000;
            
            if (elapsedTime < 0.5) {
                // Scale up the ring
                const scale = 1 + elapsedTime * 6;
                ring.scale.set(scale, scale, scale);
                
                // Fade out both effects
                const opacity = 0.7 * (1 - elapsedTime * 2);
                flash.material.opacity = opacity;
                ring.material.opacity = opacity;
                
                // Continue animation
                requestAnimationFrame(animateAndRemove);
            } else {
                // Remove effects
                if (flash.parent) flash.parent.remove(flash);
                if (ring.parent) ring.parent.remove(ring);
            }
        };
        
        // Start animation
        animateAndRemove();
    }
    
    createSparkEffect(position, normal) {
        // Create a simple particle system for sparks
        const sparkCount = 5 + this.bounceCount * 2;
        const sparkGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const sparkMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFD700,
            transparent: true,
            opacity: 0.9
        });
        
        const sparks = [];
        
        for (let i = 0; i < sparkCount; i++) {
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            spark.position.copy(position);
            
            // Random direction based on surface normal
            const randomDir = new THREE.Vector3(
                normal.x + (Math.random() - 0.5) * 2,
                normal.y + (Math.random() - 0.5) * 2,
                normal.z + (Math.random() - 0.5) * 2
            ).normalize();
            
            // Random speed
            const speed = 2 + Math.random() * 3;
            
            // Store velocity and lifetime
            spark.userData = {
                velocity: randomDir.multiplyScalar(speed),
                lifetime: 0.3 + Math.random() * 0.3
            };
            
            this.mesh.parent.add(spark);
            sparks.push(spark);
        }
        
        // Animate sparks
        const startTime = performance.now();
        const animateSparks = () => {
            const elapsedTime = (performance.now() - startTime) / 1000;
            let allExpired = true;
            
            for (const spark of sparks) {
                if (spark.userData.lifetime > elapsedTime) {
                    allExpired = false;
                    
                    // Move spark
                    spark.position.add(
                        spark.userData.velocity.clone().multiplyScalar(0.016) // Assuming ~60fps
                    );
                    
                    // Add gravity
                    spark.userData.velocity.y -= 9.8 * 0.016;
                    
                    // Fade out
                    const progress = elapsedTime / spark.userData.lifetime;
                    spark.material.opacity = 0.9 * (1 - progress);
                } else if (spark.parent) {
                    // Remove expired spark
                    spark.parent.remove(spark);
                }
            }
            
            if (!allExpired) {
                requestAnimationFrame(animateSparks);
            }
        };
        
        // Start animation
        animateSparks();
    }
    
    createShatterEffect(position, normal) {
        // Create glass shatter effect
        const shardCount = 8 + this.bounceCount * 2;
        const shardMaterial = new THREE.MeshBasicMaterial({
            color: 0x88CCEE,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        const shards = [];
        
        for (let i = 0; i < shardCount; i++) {
            // Create random triangle
            const size = 0.1 + Math.random() * 0.15;
            const shardGeometry = new THREE.BufferGeometry();
            
            // Create triangle vertices around position
            const vertices = new Float32Array([
                0, 0, 0,
                size * (Math.random() - 0.5), size * (Math.random() - 0.5), size * (Math.random() - 0.5),
                size * (Math.random() - 0.5), size * (Math.random() - 0.5), size * (Math.random() - 0.5)
            ]);
            
            shardGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            
            const shard = new THREE.Mesh(shardGeometry, shardMaterial);
            shard.position.copy(position);
            
            // Random direction away from normal
            const randomDir = new THREE.Vector3(
                normal.x + (Math.random() - 0.5) * 1.5,
                normal.y + (Math.random() - 0.5) * 1.5,
                normal.z + (Math.random() - 0.5) * 1.5
            ).normalize();
            
            // Random speed
            const speed = 1 + Math.random() * 2;
            
            // Random rotation
            const rotationSpeed = new THREE.Vector3(
                Math.random() * 10,
                Math.random() * 10,
                Math.random() * 10
            );
            
            // Store velocity, rotation and lifetime
            shard.userData = {
                velocity: randomDir.multiplyScalar(speed),
                rotationSpeed: rotationSpeed,
                lifetime: 0.5 + Math.random() * 0.5
            };
            
            this.mesh.parent.add(shard);
            shards.push(shard);
        }
        
        // Animate shards
        const startTime = performance.now();
        const animateShards = () => {
            const elapsedTime = (performance.now() - startTime) / 1000;
            let allExpired = true;
            
            for (const shard of shards) {
                if (shard.userData.lifetime > elapsedTime) {
                    allExpired = false;
                    
                    // Move shard
                    shard.position.add(
                        shard.userData.velocity.clone().multiplyScalar(0.016) // Assuming ~60fps
                    );
                    
                    // Rotate shard
                    shard.rotation.x += shard.userData.rotationSpeed.x * 0.016;
                    shard.rotation.y += shard.userData.rotationSpeed.y * 0.016;
                    shard.rotation.z += shard.userData.rotationSpeed.z * 0.016;
                    
                    // Add gravity
                    shard.userData.velocity.y -= 9.8 * 0.016;
                    
                    // Fade out
                    const progress = elapsedTime / shard.userData.lifetime;
                    shard.material.opacity = 0.6 * (1 - progress);
                } else if (shard.parent) {
                    // Remove expired shard
                    shard.parent.remove(shard);
                }
            }
            
            if (!allExpired) {
                requestAnimationFrame(animateShards);
            }
        };
        
        // Start animation
        animateShards();
    }
    
    createExplosionEffect() {
        // Create explosion effect when pulse expires after max bounces
        const explosionGeometry = new THREE.SphereGeometry(1 + (this.bounceCount * 0.3), 32, 32);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: this.mesh.material.color,
            transparent: true,
            opacity: 0.8
        });
        
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(this.position);
        this.mesh.parent.add(explosion);
        
        // Create shockwave ring
        const ringGeometry = new THREE.RingGeometry(0.2, 0.4, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: this.mesh.material.color,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(this.position);
        
        // Align ring with camera (always face camera)
        ring.lookAt(this.mesh.parent.getWorldPosition(new THREE.Vector3()));
        
        this.mesh.parent.add(ring);
        
        // Animate explosion
        const startTime = performance.now();
        const animateExplosion = () => {
            const elapsedTime = (performance.now() - startTime) / 1000;
            
            if (elapsedTime < 0.7) {
                // Scale up the explosion and ring
                const explosionScale = 1 + elapsedTime * 10;
                explosion.scale.set(explosionScale, explosionScale, explosionScale);
                
                const ringScale = 1 + elapsedTime * 15;
                ring.scale.set(ringScale, ringScale, 1);
                
                // Fade out
                const opacity = 0.8 * (1 - elapsedTime / 0.7);
                explosion.material.opacity = opacity;
                ring.material.opacity = opacity;
                
                // Continue animation
                requestAnimationFrame(animateExplosion);
            } else {
                // Remove effects
                if (explosion.parent) explosion.parent.remove(explosion);
                if (ring.parent) ring.parent.remove(ring);
            }
        };
        
        // Start animation
        animateExplosion();
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