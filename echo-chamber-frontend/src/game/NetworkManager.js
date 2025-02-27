export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.playerId = null;
        this.connected = false;
        this.serverUrl = `ws://${window.location.hostname}:8765`;
        this.lastPositionUpdate = 0;
        this.positionUpdateInterval = 100; // 100ms = 10 updates per second
    }
    
    connect() {
        this.socket = new WebSocket(this.serverUrl);
        
        this.socket.onopen = () => {
            console.log('Connected to game server');
            this.connected = true;
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from game server');
            this.connected = false;
            this.reconnect();
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.socket.onmessage = (event) => {
            this.handleServerMessage(event.data);
        };
    }
    
    reconnect() {
        // Try to reconnect after 5 seconds
        setTimeout(() => {
            if (!this.connected) {
                console.log('Attempting to reconnect...');
                this.connect();
            }
        }, 5000);
    }
    
    handleServerMessage(message) {
        try {
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'register':
                    this.playerId = data.id;
                    console.log(`Registered with server as player ${this.playerId}`);
                    break;
                
                case 'player_joined':
                    this.game.addRemotePlayer(data.id, data.position, data.health);
                    break;
                
                case 'player_left':
                    this.game.removeRemotePlayer(data.id);
                    break;
                
                case 'positions_update':
                    this.updatePlayerPositions(data.players);
                    break;
                
                case 'new_pulse':
                    // Only add pulses from other players
                    if (data.pulse.player_id !== this.playerId) {
                        this.game.addRemotePulse(data.pulse);
                    }
                    break;
                
                case 'health_update':
                    this.updatePlayerHealth(data.id, data.health);
                    break;
                
                case 'respawn':
                    this.game.respawnLocalPlayer(data.position);
                    break;
            }
        } catch (error) {
            console.error('Error processing server message:', error);
        }
    }
    
    updatePlayerPositions(positions) {
        for (const [id, position] of Object.entries(positions)) {
            // Skip our own player, as we control it locally
            if (id !== this.playerId) {
                this.game.updateRemotePlayerPosition(id, position);
            }
        }
    }
    
    updatePlayerHealth(playerId, health) {
        if (playerId === this.playerId) {
            // Update local player health
            this.game.player.health = health;
            this.game.updateHealthDisplay();
            
            // Check if player died
            if (health <= 0) {
                // The server will send a respawn message
            }
        } else {
            // Update remote player health
            this.game.updateRemotePlayerHealth(playerId, health);
        }
    }
    
    sendPlayerPosition() {
        if (!this.connected || !this.playerId) return;
        
        const now = performance.now();
        
        // Limit position updates to 10 per second
        if (now - this.lastPositionUpdate < this.positionUpdateInterval) {
            return;
        }
        
        this.lastPositionUpdate = now;
        
        // Get player position and camera rotation
        const position = this.game.player.position;
        const rotation = {
            rx: this.game.camera.rotation.x,
            ry: this.game.camera.rotation.y
        };
        
        // Send position update to server
        this.socket.send(JSON.stringify({
            type: 'position',
            x: position.x,
            y: position.y,
            z: position.z,
            rx: rotation.rx,
            ry: rotation.ry
        }));
    }
    
    sendPulseCreated(pulse) {
        if (!this.connected || !this.playerId) return;
        
        // Extract position and direction vectors
        const position = pulse.position;
        const direction = pulse.direction;
        
        this.socket.send(JSON.stringify({
            type: 'pulse',
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            direction: {
                x: direction.x,
                y: direction.y,
                z: direction.z
            },
            speed: pulse.speed,
            damage: pulse.baseDamage,
            bounces: pulse.bounceCount
        }));
    }
    
    sendDamageDealt(targetId, damage) {
        if (!this.connected || !this.playerId) return;
        
        this.socket.send(JSON.stringify({
            type: 'damage',
            target_id: targetId,
            damage: damage
        }));
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}