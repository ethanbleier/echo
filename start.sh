#!/bin/bash

# start.sh - Echo Chamber: Resonance Rumble startup script

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
   echo "Python 3 is required but not installed. Please install Python 3."
   exit 1
fi

# Create and activate virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
   echo "Creating virtual environment..."
   python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the WebSocket server
echo "Starting Echo Chamber WebSocket server..."
python server.py &
SERVER_PID=$!

# Start HTTP server for frontend
echo "Starting HTTP server for frontend..."
cd echo-chamber-frontend
python -m http.server 8000 &
HTTP_PID=$!

cd ..

echo "Echo Chamber is running!"
echo "WebSocket server on port 8765"
echo "Frontend available at http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all servers"

# Trap SIGINT to properly stop servers
trap "kill $SERVER_PID $HTTP_PID; exit" INT

# Wait for user to terminate
wait