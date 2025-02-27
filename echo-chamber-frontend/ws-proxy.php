<?php
// WebSocket proxy for Echo Chamber game
// Log access attempts
$logFile = 'ws-proxy.log';
file_put_contents($logFile, date('Y-m-d H:i:s') . " - Request received: " . $_SERVER['REQUEST_METHOD'] . "\n", FILE_APPEND);

// Check if this is a WebSocket handshake request
if (isset($_SERVER['HTTP_UPGRADE']) && strtolower($_SERVER['HTTP_UPGRADE']) == 'websocket') {
    // This is a WebSocket connection - handle the proxy
    $host = '127.0.0.1';  // WebSocket server is running locally
    $port = 8765;         // Port from your server.py

    file_put_contents($logFile, date('Y-m-d H:i:s') . " - WebSocket upgrade requested. Connecting to $host:$port\n", FILE_APPEND);

    // Get WebSocket-specific headers from the client request
    $key = isset($_SERVER['HTTP_SEC_WEBSOCKET_KEY']) ? $_SERVER['HTTP_SEC_WEBSOCKET_KEY'] : '';
    $version = isset($_SERVER['HTTP_SEC_WEBSOCKET_VERSION']) ? $_SERVER['HTTP_SEC_WEBSOCKET_VERSION'] : '';
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    
    // Log key headers for debugging
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - Key: $key, Version: $version\n", FILE_APPEND);

    // Establish connection to the WebSocket server
    $socket = fsockopen($host, $port, $errno, $errstr, 5);
    
    if (!$socket) {
        file_put_contents($logFile, date('Y-m-d H:i:s') . " - Error connecting to WebSocket server: $errstr ($errno)\n", FILE_APPEND);
        http_response_code(502);
        header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => "Backend server unavailable: $errstr"]);
        exit;
    }
    
    // Forward the handshake from client to server
    $handshakeRequest = "GET / HTTP/1.1\r\n" .
                       "Host: $host:$port\r\n" .
                       "Upgrade: websocket\r\n" .
                       "Connection: Upgrade\r\n" .
                       "Sec-WebSocket-Key: $key\r\n" .
                       "Sec-WebSocket-Version: $version\r\n";

    if ($origin) {
        $handshakeRequest .= "Origin: $origin\r\n";
    }
    
    // Add protocol if present
    if (isset($_SERVER['HTTP_SEC_WEBSOCKET_PROTOCOL'])) {
        $handshakeRequest .= "Sec-WebSocket-Protocol: " . $_SERVER['HTTP_SEC_WEBSOCKET_PROTOCOL'] . "\r\n";
    }
    
    $handshakeRequest .= "\r\n";
    
    // Send handshake to server
    fwrite($socket, $handshakeRequest);
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - Handshake sent to server\n", FILE_APPEND);
    
    // Read server response
    $response = '';
    while (($line = fgets($socket)) !== false) {
        $response .= $line;
        if ($line === "\r\n") {
            break;  // End of headers
        }
    }
    
    // Close the connection
    fclose($socket);
    
    // Log the response for debugging
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - Server response: " . str_replace(["\r", "\n"], ['\r', '\n'], $response) . "\n", FILE_APPEND);
    
    // Send response back to client
    $headers = explode("\r\n", $response);
    foreach ($headers as $header) {
        if (!empty($header)) {
            header($header);
        }
    }
    
    // The client needs to establish a new WebSocket connection directly to the backend
    // This proxy only handles the initial handshake
    exit;
} else {
    // Regular HTTP request - provide API or status
    header('Content-Type: application/json');
    
    // Check if server is running
    $host = '127.0.0.1';
    $port = 8765;
    $socketCheck = @fsockopen($host, $port, $errno, $errstr, 1);
    $serverRunning = false;
    
    if ($socketCheck) {
        fclose($socketCheck);
        $serverRunning = true;
        $status = 'WebSocket server is running';
    } else {
        $status = "WebSocket server is not running: $errstr ($errno)";
    }
    
    echo json_encode([
        'status' => $serverRunning ? 'ok' : 'error',
        'message' => $status,
        'server_info' => [
            'time' => date('Y-m-d H:i:s'),
            'php_version' => phpversion(),
            'server_software' => $_SERVER['SERVER_SOFTWARE']
        ]
    ]);
}
?>