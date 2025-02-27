#!/bin/bash

# Define paths
PYTHON_PATH=~/virtualenv/public_html/game/3.10/bin/python3
PIP_PATH=~/virtualenv/public_html/game/3.10/bin/pip3
APP_DIR="/home4/ethanble/public_html/game"

# Navigate to application directory
cd $APP_DIR

echo "Using Python: $PYTHON_PATH"
echo "Using Pip: $PIP_PATH"

echo "Installing dependencies..."
$PIP_PATH install -r requirements.txt

echo "Starting Echo Chamber WebSocket server..."
$PYTHON_PATH server.py &
WS_PID=$!

echo "Echo Chamber WebSocket server is running on port 8765!"
echo "Press Ctrl+C to stop the server"

# Trap SIGINT and SIGTERM signals to properly shut down
trap "echo 'Stopping servers...'; kill $WS_PID; exit" SIGINT SIGTERM

# Keep script running
wait