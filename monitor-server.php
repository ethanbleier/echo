<?php
// This script checks if the WebSocket server is running and starts it if needed

// Log file for this monitor
$monitorLog = __DIR__ . '/monitor.log';

// Function to log messages
function logMessage($message) {
    global $monitorLog;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($monitorLog, "[$timestamp] $message\n", FILE_APPEND);
}

// Check if server is running
$serverRunning = false;
exec('ps aux | grep server.py | grep -v grep', $output, $returnCode);

if (count($output) > 0) {
    logMessage("WebSocket server is running");
    $serverRunning = true;
} else {
    logMessage("WebSocket server is not running");
}

// Test server connection
$socketOpen = @fsockopen('127.0.0.1', 8765, $errno, $errstr, 1);
if ($socketOpen) {
    fclose($socketOpen);
    logMessage("Successfully connected to WebSocket server");
    $serverRunning = true;
} else {
    logMessage("Failed to connect to WebSocket server: $errstr ($errno)");
    $serverRunning = false;
}

// If server is not running, start it
if (!$serverRunning) {
    logMessage("Attempting to start WebSocket server...");
    
    // Execute the start script
    exec('./start-server.sh 2>&1', $output, $returnCode);
    
    // Log the result
    foreach ($output as $line) {
        logMessage("Start script output: $line");
    }
    
    if ($returnCode === 0) {
        logMessage("WebSocket server started successfully");
    } else {
        logMessage("Failed to start WebSocket server, return code: $returnCode");
    }
}

// Output status as JSON
header('Content-Type: application/json');
echo json_encode([
    'status' => $serverRunning ? 'running' : 'not_running',
    'timestamp' => time(),
    'checked_at' => date('Y-m-d H:i:s')
]);
?>
