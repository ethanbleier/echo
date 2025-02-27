// Fix for echo-chamber-frontend/src/utils/controls.js

export function setupControls(camera, canvas) {
    // We'll use a simple event-based system instead of custom PointerLockControls
    let isLocked = false;
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const sensitivity = 0.002;
    
    // Track movement keys
    const keys = {
        forward: false,
        backward: false,
        left: false,
        right: false
    };
    
    // Movement speed
    const movementSpeed = 5.0; // Units per second
    
    // Setup mouse movement handler
    function onMouseMove(event) {
        if (!isLocked) return;
        
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        // Update camera rotation
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= movementX * sensitivity;
        euler.x -= movementY * sensitivity;
        
        // Clamp vertical rotation to avoid flipping
        euler.x = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, euler.x));
        
        camera.quaternion.setFromEuler(euler);
    }
    
    // Keyboard event handlers
    function onKeyDown(event) {
        if (!isLocked) return;
        
        switch(event.code) {
            case 'KeyW':
                keys.forward = true;
                break;
            case 'KeyS':
                keys.backward = true;
                break;
            case 'KeyA':
                keys.left = true;
                break;
            case 'KeyD':
                keys.right = true;
                break;
        }
    }
    
    function onKeyUp(event) {
        if (!isLocked) return;
        
        switch(event.code) {
            case 'KeyW':
                keys.forward = false;
                break;
            case 'KeyS':
                keys.backward = false;
                break;
            case 'KeyA':
                keys.left = false;
                break;
            case 'KeyD':
                keys.right = false;
                break;
        }
    }
    
    // Setup pointer lock event handlers
    function onPointerLockChange() {
        isLocked = document.pointerLockElement === canvas;
    }
    
    function onPointerLockError() {
        console.error('PointerLockControls: Error locking pointer');
    }
    
    // Add event listeners
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    document.addEventListener('pointerlockerror', onPointerLockError, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
    
    // Create controls object with basic methods
    const controls = {
        isLocked: () => isLocked,
        
        lock: () => {
            canvas.requestPointerLock();
        },
        
        unlock: () => {
            document.exitPointerLock();
        },
        
        dispose: () => {
            document.removeEventListener('mousemove', onMouseMove, false);
            document.removeEventListener('pointerlockchange', onPointerLockChange, false);
            document.removeEventListener('pointerlockerror', onPointerLockError, false);
            document.removeEventListener('keydown', onKeyDown, false);
            document.removeEventListener('keyup', onKeyUp, false);
        },
        
        update: (deltaTime) => {
            if (!isLocked) return;
            
            // Calculate movement based on camera direction
            const moveDirection = new THREE.Vector3();
            
            // Forward/backward movement along camera's forward direction
            if (keys.forward) {
                // W key should move forward (in THREE.js forward is -Z)
                moveDirection.z -= 1;
            }
            if (keys.backward) {
                // S key should move backward
                moveDirection.z += 1;
            }
            
            // Left/right movement perpendicular to camera's forward direction
            if (keys.left) {
                moveDirection.x -= 1;
            }
            if (keys.right) {
                moveDirection.x += 1;
            }
            
            // Normalize to prevent faster diagonal movement
            if (moveDirection.length() > 0) {
                moveDirection.normalize();
            }
            
            // Apply camera rotation to movement direction
            moveDirection.applyQuaternion(camera.quaternion);
            
            // Apply movement speed and delta time
            moveDirection.multiplyScalar(movementSpeed * deltaTime);
            
            // Update camera position
            camera.position.add(moveDirection);
        }
    };
    
    return controls;
}