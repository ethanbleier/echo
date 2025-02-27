<?php
// WebSocket proxy for Echo Chamber game
header('Content-Type: application/json');

// Check if this is a WebSocket handshake request
if (isset($_SERVER['HTTP_UPGRADE']) && strtolower($_SERVER['HTTP_UPGRADE']) == 'websocket') {
    // Log the attempt
    file_put_contents('ws-proxy.log', date('Y-m-d H:i:s') . " - WebSocket connection attempt\n", FILE_APPEND);
    
    // This is a WebSocket connection request
    // Forward it to the actual WebSocket server running locally
    $host = 'localhost';
    $port = 8765;
    
    // Create a TCP/IP socket
    $socket = socket_create(AF_INET, SOCK_STREAM, SOL_TCP);
    if ($socket === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create socket: ' . socket_strerror(socket_last_error())]);
        exit;
    }
    
    // Connect to the WebSocket server
    $result = socket_connect($socket, $host, $port);
    if ($result === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to connect to WebSocket server: ' . socket_strerror(socket_last_error($socket))]);
        exit;
    }
    
    // Forward all headers to the WebSocket server
    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (substr($key, 0, 5) === 'HTTP_') {
            $header = str_replace(' ', '-', ucwords(str_replace('_', ' ', strtolower(substr($key, 5)))));
            $headers[] = "$header: $value";
        }
    }
    
    // Send the WebSocket handshake
    $handshake = "GET /ws HTTP/1.1\r\n" .
                 "Host: $host:$port\r\n" .
                 "Upgrade: websocket\r\n" .
                 "Connection: Upgrade\r\n" .
                 implode("\r\n", $headers) . "\r\n\r\n";
    
    socket_write($socket, $handshake, strlen($handshake));
    
    // Read the response
    $response = socket_read($socket, 2048);
    
    // Close the socket
    socket_close($socket);
    
    // Return the response
    echo $response;
} else {
    // Regular HTTP request - use as a fallback
    $action = isset($_GET['action']) ? $_GET['action'] : '';
    
    // Create a response based on the action
    switch ($action) {
        case 'status':
            echo json_encode(['status' => 'ok', 'message' => 'WebSocket proxy is running']);
            break;
        
        case 'test':
            // Try to connect to the WebSocket server and return the result
            $host = 'localhost';
            $port = 8765;
            $socket = @fsockopen($host, $port, $errno, $errstr, 1);
            if ($socket) {
                fclose($socket);
                echo json_encode(['status' => 'ok', 'message' => 'Successfully connected to WebSocket server']);
            } else {
                echo json_encode(['status' => 'error', 'message' => "Failed to connect to WebSocket server: $errstr ($errno)"]);
            }
            break;
            
        default:
            echo json_encode([
                'status' => 'error',
                'message' => 'Invalid request. This endpoint expects WebSocket connection requests or ?action=status',
                'server_info' => [
                    'software' => $_SERVER['SERVER_SOFTWARE'],
                    'php_version' => phpversion(),
                    'time' => date('Y-m-d H:i:s')
                ]
            ]);
    }
}
?>