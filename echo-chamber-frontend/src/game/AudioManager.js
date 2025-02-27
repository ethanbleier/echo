export class AudioManager {
    constructor(camera) {
        this.camera = camera;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        
        // Sound buffer cache
        this.sounds = {};
        
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
        
        // Define sounds to load - updated to match available assets
        const soundFiles = {
            fireWeapon: '../sounds/fire_sonic_pulse.mp3',
            enemyFireWeapon: '../assets/sounds/enemy_fire_sonic_pulse.mp3',
            weaponRecharge: '../assets/sounds/weapon_recharge.mp3',
            weaponEmpty: '../assets/sounds/weapon_empty.mp3',
            // Commented out unavailable sounds:
            // pulseImpact: 'sounds/pulse_impact.mp3',
            pulseRicochet: '../assets/sounds/pulse_ricochet.mp3',
            // takeDamage: 'sounds/take_damage.mp3',
            jump: '../assets/sounds/jump.wav'
        };
        
        // Loop through sound files and load them
        // In a real implementation, we'd use audioLoader.load()
        for (const [name, path] of Object.entries(soundFiles)) {
            // Create an audio object
            const sound = new THREE.Audio(this.listener);
            
            // Store the sound in our cache
            this.sounds[name] = sound;
            
            // In a real implementation, you'd load the sound like this:
            /*
            audioLoader.load(path, (buffer) => {
                sound.setBuffer(buffer);
                sound.setVolume(1.0);
            });
            */
        }
    }
    
    playSound(name, position = null) {
        // Get the sound from our cache
        const sound = this.sounds[name];
        
        if (!sound) {
            console.warn(`Sound "${name}" not found`);
            return;
        }
        
        // If the sound is already playing, stop it
        if (sound.isPlaying) {
            sound.stop();
        }
        
        // If position is provided, create a positional audio source
        if (position) {
            const positionalSound = new THREE.PositionalAudio(this.listener);
            // In a real implementation, you'd set the buffer and play it
            
            // Create a debug sphere to visualize sound source
            this.createSoundVisualizer(position);
        } else {
            // Play the sound directly
            sound.play();
        }
    }
    
    createSoundVisualizer(position) {
        // Create a small sphere to visualize sound source
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.5
        });
        
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(position);
        
        // Add to scene
        // In a full implementation, we'd add this to the game scene
        
        // Remove after a short delay
        setTimeout(() => {
            // Remove from scene
            // In a full implementation, we'd remove this from the game scene
        }, 500);
    }
    
    createPulseRipple(position, intensity) {
        // Create a visual and audio ripple effect for sonic pulses
        // This would be a more complex implementation in a full game
        
        // Commented out as we don't have the pulseRicochet sound yet
        // this.playSound('pulseRicochet', position);
        
        // Scale sound volume based on intensity
        // In a real implementation, you'd adjust the volume
    }
}