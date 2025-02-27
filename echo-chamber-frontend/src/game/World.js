export class World {
    constructor(scene) {
        this.scene = scene;
        this.walls = [];
        this.materials = {
            // Different materials affect sonic pulses differently
            metal: {
                color: 0x7f8c8d,
                amplification: 1.3,  // Increases bounce damage multiplier
                absorption: 0.1      // Reduces sound propagation
            },
            glass: {
                color: 0x58D3F7,
                amplification: 2.0,   // High amplification (one-time boost)
                absorption: 0.3,      // Moderate sound absorption
                breakable: true       // Can be shattered
            },
            soft: {
                color: 0x27AE60,
                amplification: 0.5,   // Reduces bounce damage
                absorption: 0.8       // High sound absorption (dampens shots)
            }
        };
        
        // Visual effects settings
        this.highQualityEffects = true;
        this.soundWaves = [];
        this.navGrid = null;
    }
    
    enableHighQualityEffects() {
        this.highQualityEffects = true;
    }
    
    disableHighQualityEffects() {
        this.highQualityEffects = false;
        
        // Remove any existing high-quality effects
        this.cleanupHighQualityEffects();
    }
    
    cleanupHighQualityEffects() {
        // Remove any existing sound wave visualizations
        for (const wave of this.soundWaves) {
            this.scene.remove(wave);
        }
        this.soundWaves = [];
    }
    
    create() {
        // Create simple test level
        this.createTestLevel();
        
        // Add floor
        this.createFloor();
        
        // Return the world for chaining
        return this;
    }
    
    createFloor() {
        // Create a simple floor with grid pattern for better visual reference
        const floorGeometry = new THREE.PlaneGeometry(50, 50, 50, 50);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x444444,
            roughness: 0.8,
            metalness: 0.2,
            wireframe: false
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        floor.receiveShadow = true;
        
        this.scene.add(floor);
        
        // Add grid helper for better spatial reference
        const gridHelper = new THREE.GridHelper(50, 50, 0x000000, 0x888888);
        gridHelper.position.y = 0.01; // Slightly above floor to avoid z-fighting
        this.scene.add(gridHelper);
    }
    
    createTestLevel() {
        // Create a simple room with various material walls for testing
        
        // Room dimensions
        const roomSize = 20;
        const wallHeight = 5;
        
        // Create room walls
        this.createWall(
            new THREE.Vector3(-roomSize/2, wallHeight/2, 0), 
            new THREE.Vector3(0.5, wallHeight, roomSize), 
            this.materials.metal
        );
        
        this.createWall(
            new THREE.Vector3(roomSize/2, wallHeight/2, 0), 
            new THREE.Vector3(0.5, wallHeight, roomSize), 
            this.materials.metal
        );
        
        this.createWall(
            new THREE.Vector3(0, wallHeight/2, -roomSize/2), 
            new THREE.Vector3(roomSize, wallHeight, 0.5), 
            this.materials.glass
        );
        
        this.createWall(
            new THREE.Vector3(0, wallHeight/2, roomSize/2), 
            new THREE.Vector3(roomSize, wallHeight, 0.5), 
            this.materials.soft
        );
        
        // Add some internal obstacles
        
        // Metal column
        this.createWall(
            new THREE.Vector3(-5, wallHeight/2, -5),
            new THREE.Vector3(1, wallHeight, 1),
            this.materials.metal
        );
        
        // Glass wall
        this.createWall(
            new THREE.Vector3(0, wallHeight/2, 2),
            new THREE.Vector3(10, wallHeight, 0.3),
            this.materials.glass
        );
        
        // Soft wall (sound dampening)
        this.createWall(
            new THREE.Vector3(5, wallHeight/2, -3),
            new THREE.Vector3(3, wallHeight, 3),
            this.materials.soft
        );
    }
    
    createWall(position, size, material) {
        // Create a wall with the given properties
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const meshMaterial = new THREE.MeshStandardMaterial({
            color: material.color,
            transparent: material.type === 'glass',
            opacity: material.type === 'glass' ? 0.5 : 1.0,
            roughness: 0.7,
            metalness: material.type === 'metal' ? 0.7 : 0.1
        });
        
        const wall = new THREE.Mesh(geometry, meshMaterial);
        wall.position.copy(position);
        wall.castShadow = true;
        wall.receiveShadow = true;
        
        // Store material properties with the wall
        wall.userData = {
            type: 'wall',
            material: material
        };
        
        // Add to scene and walls array
        this.scene.add(wall);
        this.walls.push(wall);
        
        return wall;
    }
    
    checkCollision(position, radius) {
        // Simple collision check for player
        for (const wall of this.walls) {
            const box = new THREE.Box3().setFromObject(wall);
            
            // Create a sphere for the player
            const sphere = new THREE.Sphere(position, radius);
            
            // Check for collision
            if (box.intersectsSphere(sphere)) {
                return true;
            }
        }
        
        return false;
    }
    
    checkCeilingCollision(position, height) {
        // Check if player's head hits a ceiling
        const headPosition = position.clone();
        headPosition.y += height / 2;
        
        // Check each wall for ceiling collision
        for (const wall of this.walls) {
            const box = new THREE.Box3().setFromObject(wall);
            
            // Create a small sphere for the head
            const sphere = new THREE.Sphere(headPosition, 0.2);
            
            // Check for collision
            if (box.intersectsSphere(sphere)) {
                return true;
            }
        }
        
        return false;
    }
    
    checkPulseCollision(position, direction, radius) {
        // Initialize result object
        const result = {
            hit: false,
            point: null,
            normal: null,
            material: null
        };
        
        // Convert direction to raycaster direction
        const ray = new THREE.Raycaster(
            position.clone(),
            direction.clone(),
            0,
            radius * 2
        );
        
        // Check for intersections with walls
        const intersects = ray.intersectObjects(this.walls);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            
            result.hit = true;
            result.point = intersection.point;
            result.normal = intersection.face.normal;
            result.material = intersection.object.userData.material;
            
            // Create sound wave visualization at impact point
            if (this.highQualityEffects) {
                this.createSoundWaveVisualization(
                    intersection.point, 
                    result.normal,
                    result.material
                );
            }
            
            // If the wall is breakable (like glass), handle destruction
            if (result.material.breakable) {
                // In a full implementation, this would break the wall
                // For now, we'll just change its appearance
                intersection.object.material.opacity = 0.2;
            }
        }
        
        return result;
    }
    
    createSoundWaveVisualization(position, normal, material) {
        // Create a sound wave ripple effect that propagates along surfaces
        
        // Parameters based on material
        let maxRadius = 10;
        let duration = 2.0;
        let color = 0x3498db;
        let intensity = 0.7;
        
        // Adjust based on material properties
        if (material) {
            if (material.type === 'metal') {
                maxRadius = 15;
                duration = 3.0;
                color = 0x7f8c8d;
                intensity = 0.9;
            } else if (material.type === 'glass') {
                maxRadius = 8;
                duration = 1.5;
                color = 0x58D3F7;
                intensity = 0.6;
            } else if (material.type === 'soft') {
                maxRadius = 5;
                duration = 1.0;
                color = 0x27AE60;
                intensity = 0.4;
            }
        }
        
        // Create a ring for the sound wave
        const segments = 64;
        const ringGeometry = new THREE.RingGeometry(0.1, 0.2, segments);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: intensity,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        
        // Orient the ring perpendicular to the surface
        ring.lookAt(position.clone().add(normal));
        
        // Add a slight offset to avoid z-fighting with the surface
        ring.position.add(normal.clone().multiplyScalar(0.01));
        
        // Add to scene and tracking array
        this.scene.add(ring);
        this.soundWaves.push(ring);
        
        // Animate the sound wave
        const startTime = performance.now();
        
        const animateSoundWave = () => {
            const elapsedTime = (performance.now() - startTime) / 1000;
            
            if (elapsedTime < duration) {
                // Calculate progress
                const progress = elapsedTime / duration;
                
                // Scale the ring based on progress
                const currentRadius = maxRadius * progress;
                ring.scale.set(currentRadius, currentRadius, 1);
                
                // Fade out as it expands
                ring.material.opacity = intensity * (1 - Math.pow(progress, 2));
                
                // Continue animation
                requestAnimationFrame(animateSoundWave);
            } else {
                // Remove the ring
                this.scene.remove(ring);
                
                // Remove from tracking array
                const index = this.soundWaves.indexOf(ring);
                if (index > -1) {
                    this.soundWaves.splice(index, 1);
                }
            }
        };
        
        // Start animation
        animateSoundWave();
        
        // Add secondary effects based on material
        if (material) {
            // Add unique secondary effects for different materials
            if (material.type === 'metal') {
                this.createMetalResonance(position, normal);
            } else if (material.type === 'glass' && material.breakable) {
                this.createGlassResonance(position, normal);
            }
        }
    }
    
    createMetalResonance(position, normal) {
        // Create a more intense, focused secondary wave for metal
        
        // Create a series of ripple waves
        const waveCount = 5;
        const waveDuration = 1.5;
        const maxRadius = 8;
        
        for (let i = 0; i < waveCount; i++) {
            // Delay each wave
            setTimeout(() => {
                // Create wave
                const innerRadius = 0.1;
                const thickness = 0.05 + Math.random() * 0.1;
                const ringGeometry = new THREE.RingGeometry(
                    innerRadius, 
                    innerRadius + thickness, 
                    32
                );
                
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: 0xCCCCCC,
                    transparent: true,
                    opacity: 0.6,
                    side: THREE.DoubleSide
                });
                
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.position.copy(position);
                
                // Orient perpendicular to surface
                ring.lookAt(position.clone().add(normal));
                
                // Add slight offset
                ring.position.add(normal.clone().multiplyScalar(0.02 + i * 0.005));
                
                // Add to scene
                this.scene.add(ring);
                this.soundWaves.push(ring);
                
                // Animate
                const startTime = performance.now();
                
                const animateRing = () => {
                    const elapsedTime = (performance.now() - startTime) / 1000;
                    
                    if (elapsedTime < waveDuration) {
                        // Calculate progress
                        const progress = elapsedTime / waveDuration;
                        
                        // Scale based on progress
                        const currentRadius = maxRadius * Math.pow(progress, 0.8);
                        ring.scale.set(currentRadius, currentRadius, 1);
                        
                        // Oscillating intensity creates a pulse effect
                        const pulseFrequency = 10;
                        const pulseIntensity = 0.4 * (1 - progress);
                        const oscillation = Math.sin(elapsedTime * pulseFrequency) * pulseIntensity + 0.6;
                        
                        ring.material.opacity = oscillation * (1 - Math.pow(progress, 1.5));
                        
                        // Continue animation
                        requestAnimationFrame(animateRing);
                    } else {
                        // Remove ring
                        this.scene.remove(ring);
                        
                        // Remove from tracking array
                        const index = this.soundWaves.indexOf(ring);
                        if (index > -1) {
                            this.soundWaves.splice(index, 1);
                        }
                    }
                };
                
                // Start animation
                animateRing();
                
            }, i * 100); // 100ms delay between waves
        }
    }
    
    createGlassResonance(position, normal) {
        // Create a high-frequency vibration effect for glass
        
        // Create a grid of small ripple points
        const gridSize = 5;
        const spacing = 0.2;
        const halfGrid = Math.floor(gridSize / 2);
        
        for (let x = -halfGrid; x <= halfGrid; x++) {
            for (let z = -halfGrid; z <= halfGrid; z++) {
                // Skip some points for a more random pattern
                if (Math.random() > 0.7) continue;
                
                // Calculate position on the surface
                const offset = new THREE.Vector3(
                    x * spacing + (Math.random() - 0.5) * 0.1,
                    0,
                    z * spacing + (Math.random() - 0.5) * 0.1
                );
                
                // Create local coordinate system on the surface
                const tangent = new THREE.Vector3(normal.y, normal.z, -normal.x).normalize();
                const bitangent = new THREE.Vector3().crossVectors(normal, tangent);
                
                // Transform offset to surface-local coordinates
                const localPos = position.clone().add(
                    tangent.clone().multiplyScalar(offset.x)
                ).add(
                    bitangent.clone().multiplyScalar(offset.z)
                );
                
                // Create small pulse
                const size = 0.03 + Math.random() * 0.02;
                const geometry = new THREE.CircleGeometry(size, 8);
                const material = new THREE.MeshBasicMaterial({
                    color: 0x88CCEE,
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });
                
                const pulse = new THREE.Mesh(geometry, material);
                pulse.position.copy(localPos);
                
                // Orient perpendicular to surface
                pulse.lookAt(localPos.clone().add(normal));
                
                // Add slight offset
                pulse.position.add(normal.clone().multiplyScalar(0.01));
                
                // Add to scene
                this.scene.add(pulse);
                this.soundWaves.push(pulse);
                
                // Animate with a short vibration
                const startTime = performance.now();
                const duration = 0.3 + Math.random() * 0.3;
                
                const animatePulse = () => {
                    const elapsedTime = (performance.now() - startTime) / 1000;
                    
                    if (elapsedTime < duration) {
                        // Vibrate with a high frequency
                        const vibrationFreq = 30;
                        const vibrationAmp = 0.2 * (1 - Math.pow(elapsedTime / duration, 2));
                        const scale = 1 + Math.sin(elapsedTime * vibrationFreq) * vibrationAmp;
                        
                        pulse.scale.set(scale, scale, 1);
                        
                        // Fade out
                        pulse.material.opacity = 0.7 * (1 - Math.pow(elapsedTime / duration, 2));
                        
                        // Continue animation
                        requestAnimationFrame(animatePulse);
                    } else {
                        // Remove pulse
                        this.scene.remove(pulse);
                        
                        const index = this.soundWaves.indexOf(pulse);
                        if (index > -1) {
                            this.soundWaves.splice(index, 1);
                        }
                    }
                };
                
                // Start with a random delay
                setTimeout(() => {
                    animatePulse();
                }, Math.random() * 200);
            }
        }
    }
}