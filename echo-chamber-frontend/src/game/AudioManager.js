export class AudioManager {
    constructor(camera) {
        this.camera = camera;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        
        // Sound buffer cache
        this.sounds = {};
        this.buffers = {};
        
        // Set default volume
        this.masterVolume = 0.75; // 75%
        
        // Load sound files
        this.preloadSounds();
    }
    
    setVolume(volume) {
        // Set master volume (0-1)
        this.masterVolume = Math.max(0, Math.min(1, volume));
        
        // Apply to all sounds
        for (const sound of Object.values(this.sounds)) {
            sound.setVolume(this.masterVolume);
        }
    }
    
    preloadSounds() {
        // Create a sound loader
        const audioLoader = new THREE.AudioLoader();
        
        // Define sounds to load with correct paths
        const soundFiles = {
            fireWeapon: 'src/assets/sounds/fire.mp3',
            enemyFireWeapon: 'src/assets/sounds/enemy_fire.mp3',
            weaponEmpty: 'src/assets/sounds/empty.mp3',
            pulseRicochet: 'src/assets/sounds/ricochet.mp3',
            takeDamage: 'src/assets/sounds/damage.wav',
            jump: 'src/assets/sounds/jump.wav'
        };
        
        // Log the base path to help diagnose issues
        console.log("Audio loading from base path:", window.location.href);
        
        // Track loading progress
        this.totalSounds = Object.keys(soundFiles).length;
        this.loadedSounds = 0;
        
        // Loop through sound files and load them
        for (const [name, path] of Object.entries(soundFiles)) {
            // Check if file exists before loading (using fetch head request)
            fetch(path, { method: 'HEAD' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`File not found: ${path} (status: ${response.status})`);
                    }
                    
                    // File exists, proceed with loading
                    audioLoader.load(
                        path,
                        (buffer) => {
                            // Store the buffer for later use
                            this.buffers[name] = buffer;
                            this.loadedSounds++;
                            console.log(`Loaded sound: ${name} (${this.loadedSounds}/${this.totalSounds})`);
                        },
                        (xhr) => {
                            // Progress tracking - silent to reduce console noise
                        },
                        (error) => {
                            console.error(`Failed to load sound "${name}" from path "${path}": ${error}`);
                            // Create fallback sound as the file exists but couldn't be loaded
                            this.createFallbackSound(name);
                        }
                    );
                })
                .catch(error => {
                    console.error(`Error checking sound file: ${error}`);
                    console.log(`Creating fallback sound for: ${name}`);
                    this.createFallbackSound(name);
                });
        }
    }
    
    createFallbackSound(name) {
        // Create an audio context
        const context = this.listener.context;
        
        // Create a buffer for fallback sounds
        const sampleRate = context.sampleRate;
        const buffer = context.createBuffer(1, sampleRate * 0.5, sampleRate);
        const channel = buffer.getChannelData(0);
        
        // Generate sound based on the name
        if (name.includes('fire') || name.includes('pulse')) {
            // Create a pulse-like sound
            for (let i = 0; i < channel.length; i++) {
                channel[i] = Math.sin(i * 0.01) * Math.exp(-4 * i / channel.length);
            }
        } else if (name.includes('jump')) {
            // Create a short upward sweep
            for (let i = 0; i < channel.length; i++) {
                channel[i] = Math.sin(i * (0.01 + i * 0.00001)) * Math.exp(-6 * i / channel.length);
            }
        } else if (name.includes('empty')) {
            // Create a dull thud
            for (let i = 0; i < channel.length; i++) {
                channel[i] = Math.sin(i * 0.03) * Math.exp(-12 * i / channel.length);
            }
        } else if (name.includes('damage')) {
            // Create a damage sound
            for (let i = 0; i < channel.length; i++) {
                channel[i] = (Math.random() * 2 - 1) * Math.exp(-6 * i / channel.length);
                // Add some low frequency components
                channel[i] += Math.sin(i * 0.05) * Math.exp(-8 * i / channel.length) * 0.5;
            }
        } else {
            // Generic sound for other effects
            for (let i = 0; i < channel.length; i++) {
                channel[i] = Math.random() * 2 - 1;
                channel[i] *= Math.exp(-10 * i / channel.length); // Fade out
            }
        }
        
        // Store the fallback buffer
        this.buffers[name] = buffer;
        console.log(`Created fallback sound for: ${name}`);
    }
    
    playSound(name, position = null) {
        // Check if the buffer exists
        if (!this.buffers[name]) {
            console.error(`Sound "${name}" not found or not loaded yet.`);
            return null;
        }
        
        let sound;
        
        // If position is provided, create a positional audio source
        if (position) {
            // Create a positional audio object
            sound = new THREE.PositionalAudio(this.listener);
            sound.setVolume(this.masterVolume);
            sound.setBuffer(this.buffers[name]);
            sound.setRefDistance(5);
            sound.setRolloffFactor(2);
            sound.setDistanceModel('exponential');
            
            // Create a temporary mesh to hold the sound
            const mesh = new THREE.Object3D();
            mesh.position.copy(position);
            mesh.add(sound);
            this.scene.add(mesh);
            
            // Play the sound
            sound.play();
            
            // Remove the mesh after the sound finishes playing
            sound.onEnded = () => {
                this.scene.remove(mesh);
            };
            
            // Create visual sound indicator (optional)
            this.createSoundVisualizer(position);
        } else {
            // If no position is provided, use a regular audio object
            sound = this.sounds[name] || new THREE.Audio(this.listener);
            this.sounds[name] = sound;
            
            // If the sound is already playing, stop it
            if (sound.isPlaying) {
                sound.stop();
            }
            
            // Set the buffer and play the sound
            sound.setBuffer(this.buffers[name]);
            sound.setVolume(this.masterVolume);
            sound.play();
        }
    }
    
    createSoundVisualizer(position) {
        // Create a small sphere to visualize sound source
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x3498db,
            transparent: true,
            opacity: 0.5
        });
        
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(position);
        
        // Create a group to animate
        const group = new THREE.Group();
        group.add(sphere);
        this.scene.add(group);
        
        // Animate the sound visualizer
        const startTime = performance.now();
        
        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > 0.5) {
                this.scene.remove(group);
                return;
            }
            
            const scale = 1 + elapsed * 4;
            sphere.scale.set(scale, scale, scale);
            sphere.material.opacity = 0.5 * (1 - elapsed / 0.5);
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    createPulseRipple(position, intensity) {
        // Create visual effect for sonic pulse impacts
        const ringCount = 3;
        
        for (let i = 0; i < ringCount; i++) {
            // Staggered creation of rings
            setTimeout(() => {
                this.createRippleRing(position, intensity, i);
            }, i * 100);
        }
        
        // Play ricochet sound
        this.playSound('pulseRicochet', position);
    }
    
    createRippleRing(position, intensity, index) {
        // Create a ring geometry
        const innerRadius = 0.1;
        const outerRadius = 0.2;
        const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
        
        // Create material with glow effect
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x3498db,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        // Create ring mesh
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        
        // Random orientation for variety
        ring.rotation.x = Math.random() * Math.PI;
        ring.rotation.y = Math.random() * Math.PI;
        ring.rotation.z = Math.random() * Math.PI;
        
        this.scene.add(ring);
        
        // Animate the ring
        const startTime = performance.now();
        const duration = 1.0 + (index * 0.2);
        const maxRadius = 2.0 + (intensity * 0.5) + (index * 0.5);
        
        const animateRing = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            if (elapsed > duration) {
                this.scene.remove(ring);
                return;
            }
            
            const progress = elapsed / duration;
            const scale = 1 + (progress * maxRadius);
            ring.scale.set(scale, scale, scale);
            
            // Fade out as it expands
            ring.material.opacity = 0.7 * (1 - progress);
            
            requestAnimationFrame(animateRing);
        };
        
        animateRing();
    }
    
    // Store scene reference for visualizations
    setScene(scene) {
        this.scene = scene;
    }
}