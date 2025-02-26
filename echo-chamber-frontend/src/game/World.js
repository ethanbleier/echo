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
            
            // If the wall is breakable (like glass), handle destruction
            if (result.material.breakable) {
                // In a full implementation, this would break the wall
                // For now, we'll just change its appearance
                intersection.object.material.opacity = 0.2;
            }
        }
        
        return result;
    }
}