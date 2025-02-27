#!/bin/bash

# Define paths - adjust these for your environment
PYTHON_PATH=~/virtualenv/public_html/game/3.10/bin/python3
APP_DIR="/home4/ethanble/public_html/game"
LOG_FILE="$APP_DIR/server.log"

# Navigate to application directory
cd $APP_DIR

# Check if server is already running
if pgrep -f "python.*server.py" > /dev/null; then
    echo "Server already running" >> $LOG_FILE
else
    echo "Starting server at $(date)" >> $LOG_FILE
    
    # Set environment variables
    export HOST="127.0.0.1"
    export PORT="8765"
    
    # Start the server in the background
    nohup $PYTHON_PATH server.py >> $LOG_FILE 2>&1 &
    
    echo "Server started with PID $!" >> $LOG_FILE
fi