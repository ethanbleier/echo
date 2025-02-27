import asyncio
import json
import logging
import websockets
import uuid
import time
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    format="%(asctime)s %(message)s",
    level=logging.INFO,
)

# Server configuration
PORT = int(os.getenv("PORT", "8765"))

# Game state
connected_players = {}
player_positions = {}
player_health = {}
player_pulses = []

async def register_player(websocket):
    """Register a new player with the game."""
    player_id = str(uuid.uuid4())
    connected_players[player_id] = websocket
    player_positions[player_id] = {
        "x": 0, 
        "y": 1.7, 
        "z": 0, 
        "rx": 0,  # rotation x (pitch)
        "ry": 0   # rotation y (yaw)
    }
    player_health[player_id] = 100
    
    # Inform the player of their ID
    await websocket.send(json.dumps({
        "type": "register",
        "id": player_id
    }))
    
    # Inform the player about existing players
    for existing_id, pos in player_positions.items():
        if existing_id != player_id:
            await websocket.send(json.dumps({
                "type": "player_joined",
                "id": existing_id,
                "position": pos,
                "health": player_health[existing_id]
            }))
    
    # Inform other players about the new player
    for existing_id, ws in connected_players.items():
        if existing_id != player_id:
            await ws.send(json.dumps({
                "type": "player_joined",
                "id": player_id,
                "position": player_positions[player_id],
                "health": player_health[player_id]
            }))
    
    logging.info(f"Player {player_id} connected. Total players: {len(connected_players)}")
    return player_id

async def unregister_player(player_id):
    """Remove a player from the game."""
    if player_id in connected_players:
        del connected_players[player_id]
        del player_positions[player_id]
        del player_health[player_id]
        
        # Inform other players about the disconnection
        for existing_id, ws in connected_players.items():
            await ws.send(json.dumps({
                "type": "player_left",
                "id": player_id
            }))
        
        logging.info(f"Player {player_id} disconnected. Remaining players: {len(connected_players)}")

async def broadcast_game_state():
    """Broadcast player positions to all clients."""
    while True:
        if connected_players:
            # Create a single message with all player positions
            positions_message = {
                "type": "positions_update",
                "players": player_positions
            }
            positions_json = json.dumps(positions_message)
            
            # Send to all connected players
            websockets_tasks = [
                ws.send(positions_json) for ws in connected_players.values()
            ]
            await asyncio.gather(*websockets_tasks, return_exceptions=True)
            
            # Clear pulses that are over 5 seconds old
            current_time = time.time()
            global player_pulses
            player_pulses = [p for p in player_pulses if current_time - p["timestamp"] < 5]
        
        # Send updates 10 times per second
        await asyncio.sleep(0.1)

async def handle_message(websocket, player_id, message):
    """Process incoming messages from clients."""
    try:
        data = json.loads(message)
        message_type = data.get("type")
        
        if message_type == "position":
            # Update player position
            player_positions[player_id] = {
                "x": data.get("x", 0),
                "y": data.get("y", 1.7),
                "z": data.get("z", 0),
                "rx": data.get("rx", 0),
                "ry": data.get("ry", 0)
            }
        
        elif message_type == "pulse":
            # Create a new sonic pulse and add it to the list
            pulse = {
                "id": str(uuid.uuid4()),
                "player_id": player_id,
                "position": {
                    "x": data.get("position", {}).get("x", 0),
                    "y": data.get("position", {}).get("y", 0),
                    "z": data.get("position", {}).get("z", 0)
                },
                "direction": {
                    "x": data.get("direction", {}).get("x", 0),
                    "y": data.get("direction", {}).get("y", 0),
                    "z": data.get("direction", {}).get("z", 0)
                },
                "speed": data.get("speed", 15),
                "damage": data.get("damage", 20),
                "bounces": data.get("bounces", 0),
                "timestamp": time.time()
            }
            player_pulses.append(pulse)
            
            # Broadcast the pulse to all players
            for ws in connected_players.values():
                await ws.send(json.dumps({
                    "type": "new_pulse",
                    "pulse": pulse
                }))
        
        elif message_type == "damage":
            # Apply damage to a player
            target_id = data.get("target_id")
            damage = data.get("damage", 0)
            
            if target_id in player_health:
                player_health[target_id] -= damage
                
                # Ensure health doesn't go below 0
                if player_health[target_id] < 0:
                    player_health[target_id] = 0
                
                # Broadcast health update
                for ws in connected_players.values():
                    await ws.send(json.dumps({
                        "type": "health_update",
                        "id": target_id,
                        "health": player_health[target_id]
                    }))
                
                # If player is dead, respawn them
                if player_health[target_id] <= 0:
                    # Reset player health
                    player_health[target_id] = 100
                    
                    # Move player to a random respawn location
                    player_positions[target_id] = {
                        "x": (uuid.uuid4().int % 10) - 5,  # Random position between -5 and 5
                        "y": 1.7,
                        "z": (uuid.uuid4().int % 10) - 5,
                        "rx": 0,
                        "ry": 0
                    }
                    
                    # Notify the specific player about respawn
                    if target_id in connected_players:
                        await connected_players[target_id].send(json.dumps({
                            "type": "respawn",
                            "position": player_positions[target_id]
                        }))
    
    except json.JSONDecodeError:
        logging.error(f"Invalid JSON from player {player_id}")
    except Exception as e:
        logging.error(f"Error processing message: {e}")

async def game_server(websocket):
    """Handle a connection from a client."""
    player_id = await register_player(websocket)
    
    try:
        async for message in websocket:
            await handle_message(websocket, player_id, message)
    except websockets.exceptions.ConnectionClosedError:
        pass
    finally:
        await unregister_player(player_id)

async def main():
    """Start the server."""
    # Start the game state broadcaster
    asyncio.create_task(broadcast_game_state())
    
    # Start the websocket server
    async with websockets.serve(game_server, "0.0.0.0", PORT):
        logging.info(f"Echo Chamber multiplayer server started on port {PORT}")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())