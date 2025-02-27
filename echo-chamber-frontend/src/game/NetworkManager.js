export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.socket = null;
        this.playerId = null;
        this.connected = false;
        
        // Set up WebSocket URL based on current window location
        this.serverUrl = this.getWebSocketUrl();
        
        this.lastPositionUpdate = 0;
        this.positionUpdateInterval = 100; // 100ms = 10 updates per second
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Connection status element
        this.connectionStatus = document.getElementById('connection-status');
        this.updateConnectionStatus('Connecting to server...');
    }
    
    getWebSocketUrl() {
        // Determine the WebSocket protocol (wss or ws)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        // Try different connection strategies
        // 1. First try direct connection if on localhost for development
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
            return `${protocol}//${host.split(':')[0]}:8765`;
        }
        
        // 2. Otherwise use the PHP proxy
        return `${protocol}//${host}/ws-proxy.php`;
    }
    
    connect() {
        try {
            this.updateConnectionStatus(`Connecting to server at ${this.serverUrl}...`);
            console.log(`Attempting to connect to WebSocket server at: ${this.serverUrl}`);
            
            this.socket = new WebSocket(this.serverUrl);
            
            this.socket.onopen = () => {
                console.log('Connected to game server');
                this.connected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('Connected', true);
                
                // Hide status after 3 seconds if connected
                setTimeout(() => {
                    if (this.connected) {
                        this.hideConnectionStatus();
                    }
                }, 3000);
            };
            
            this.socket.onclose = (event) => {
                console.log('Disconnected from game server', event.code, event.reason);
                this.connected = false;
                
                if (event.code === 1000) {
                    // Normal closure
                    this.updateConnectionStatus('Disconnected from server');
                } else {
                    // Abnormal closure
                    this.updateConnectionStatus('Connection lost. Attempting to reconnect...');
                    this.reconnect();
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(`Connection error: Unable to connect to ${this.serverUrl}`);
            };
            
            this.socket.onmessage = (event) => {
                this.handleServerMessage(event.data);
            };
        } catch (err) {
            console.error('Error creating WebSocket:', err);
            this.updateConnectionStatus('Failed to connect to server');
            this.reconnect();
        }
    }
    
    reconnect() {
        // Try to reconnect after 5 seconds if not at max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            
            const timeout = Math.min(5000 * this.reconnectAttempts, 30000);
            this.updateConnectionStatus(`Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                if (!this.connected) {
                    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    this.connect();
                }
            }, timeout);
        } else {
            this.updateConnectionStatus(`Could not connect to server at ${this.serverUrl}. Please check the server or try again later.`);
        }
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
        this.sendMessage({
            type: 'position',
            x: position.x,
            y: position.y,
            z: position.z,
            rx: rotation.rx,
            ry: rotation.ry
        });
    }
    
    sendPulseCreated(pulse) {
        if (!this.connected || !this.playerId) return;
        
        // Extract position and direction vectors
        const position = pulse.position;
        const direction = pulse.direction;
        
        this.sendMessage({
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
        });
    }
    
    sendDamageDealt(targetId, damage) {
        if (!this.connected || !this.playerId) return;
        
        this.sendMessage({
            type: 'damage',
            target_id: targetId,
            damage: damage
        });
    }
    
    // Helper method to handle message sending with connection check
    sendMessage(data) {
        if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        
        try {
            this.socket.send(JSON.stringify(data));
            return true;
        } catch (err) {
            console.error('Error sending message:', err);
            return false;
        }
    }
    
    disconnect() {
        if (this.socket) {
            // Use a clean close
            try {
                this.socket.close(1000, "Client disconnected normally");
            } catch (err) {
                console.error('Error closing socket:', err);
            }
            this.socket = null;
        }
        this.connected = false;
    }
    
    // Update connection status UI element
    updateConnectionStatus(message, isConnected = false) {
        if (this.connectionStatus) {
            this.connectionStatus.textContent = message;
            this.connectionStatus.style.display = 'block';
            
            if (isConnected) {
                this.connectionStatus.className = 'connection-status connected';
            } else {
                this.connectionStatus.className = 'connection-status';
            }
        }
    }
    
    // Hide connection status UI
    hideConnectionStatus() {
        if (this.connectionStatus) {
            this.connectionStatus.style.display = 'none';
        }
    }
}