---
title: PHP WebSocket Implementation
description:
  Complete guide to WebSocket servers and clients in PHP using Ratchet and
  ReactPHP
sidebar:
  order: 7
---

This guide covers WebSocket implementation in PHP, including Ratchet, ReactPHP,
Swoole, and Laravel patterns.

## PHP WebSocket Clients

### Using Textalk WebSocket Client

A simple WebSocket client for PHP:

```php
<?php
use WebSocket\Client;

// Basic connection
$client = new Client("ws://echo.websocket.org");
$client->send("Hello WebSocket!");
echo $client->receive(); // Will output "Hello WebSocket!"
$client->close();

// With options
$client = new Client("wss://your-server.com/ws", [
    'timeout' => 60,
    'headers' => [
        'Authorization' => 'Bearer ' . $token,
        'X-Custom-Header' => 'value'
    ],
    'context' => stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true
        ]
    ])
]);

// Send JSON
$client->send(json_encode([
    'type' => 'subscribe',
    'channel' => 'updates'
]));

// Receive with timeout
$response = $client->receive();
$data = json_decode($response, true);

// Binary data
$binaryData = pack('C*', ...array_map('ord', str_split('binary')));
$client->send($binaryData, 'binary');
```

### Persistent Connection Client

Implement a persistent WebSocket client with reconnection:

```php
<?php
namespace App\WebSocket;

use WebSocket\Client;
use WebSocket\ConnectionException;
use WebSocket\TimeoutException;

class PersistentWebSocketClient
{
    private $url;
    private $client;
    private $options;
    private $reconnectAttempts = 0;
    private $maxReconnectAttempts = 10;
    private $reconnectDelay = 1000; // milliseconds
    private $isConnected = false;
    private $messageQueue = [];
    private $callbacks = [];

    public function __construct(string $url, array $options = [])
    {
        $this->url = $url;
        $this->options = array_merge([
            'timeout' => 60,
            'fragment_size' => 4096,
            'headers' => []
        ], $options);
    }

    public function connect(): void
    {
        try {
            $this->client = new Client($this->url, $this->options);
            $this->isConnected = true;
            $this->reconnectAttempts = 0;

            $this->trigger('connected');

            // Send queued messages
            while (!empty($this->messageQueue)) {
                $message = array_shift($this->messageQueue);
                $this->send($message['data'], $message['opcode']);
            }

        } catch (ConnectionException $e) {
            $this->handleConnectionError($e);
        }
    }

    public function send($data, string $opcode = 'text'): void
    {
        if (!$this->isConnected) {
            // Queue message for sending after reconnection
            $this->messageQueue[] = [
                'data' => $data,
                'opcode' => $opcode
            ];
            return;
        }

        try {
            if (is_array($data) || is_object($data)) {
                $data = json_encode($data);
            }

            $this->client->send($data, $opcode);

        } catch (ConnectionException $e) {
            $this->handleConnectionError($e);
            // Re-queue the message
            array_unshift($this->messageQueue, [
                'data' => $data,
                'opcode' => $opcode
            ]);
        }
    }

    public function receive(): ?string
    {
        if (!$this->isConnected) {
            return null;
        }

        try {
            $message = $this->client->receive();

            // Handle different message types
            if ($this->client->getLastOpcode() === 'text') {
                $this->trigger('message', $message);
            } elseif ($this->client->getLastOpcode() === 'binary') {
                $this->trigger('binary', $message);
            } elseif ($this->client->getLastOpcode() === 'ping') {
                $this->client->send('', 'pong');
            }

            return $message;

        } catch (TimeoutException $e) {
            // Timeout is normal, just return null
            return null;
        } catch (ConnectionException $e) {
            $this->handleConnectionError($e);
            return null;
        }
    }

    public function listen(): void
    {
        while (true) {
            if (!$this->isConnected) {
                $this->reconnect();
                usleep($this->reconnectDelay * 1000);
                continue;
            }

            $message = $this->receive();
            if ($message !== null) {
                $this->processMessage($message);
            }

            usleep(10000); // 10ms delay to prevent CPU spinning
        }
    }

    private function processMessage(string $message): void
    {
        try {
            $data = json_decode($message, true);
            if ($data && isset($data['type'])) {
                $this->trigger($data['type'], $data);
            }
        } catch (\Exception $e) {
            // Handle non-JSON messages
            $this->trigger('raw', $message);
        }
    }

    private function handleConnectionError(ConnectionException $e): void
    {
        $this->isConnected = false;
        $this->trigger('error', $e->getMessage());
        $this->trigger('disconnected', $e->getCode());

        if ($this->reconnectAttempts < $this->maxReconnectAttempts) {
            $this->reconnect();
        }
    }

    private function reconnect(): void
    {
        $this->reconnectAttempts++;
        $delay = $this->getReconnectDelay();

        echo "Reconnecting in {$delay}ms (attempt #{$this->reconnectAttempts})\n";

        usleep($delay * 1000);
        $this->connect();
    }

    private function getReconnectDelay(): int
    {
        // Exponential backoff with jitter
        $delay = min(
            $this->reconnectDelay * pow(2, $this->reconnectAttempts),
            30000 // Max 30 seconds
        );

        // Add jitter (±25%)
        $jitter = $delay * 0.25;
        $delay += rand(-$jitter, $jitter);

        return (int)$delay;
    }

    public function on(string $event, callable $callback): void
    {
        if (!isset($this->callbacks[$event])) {
            $this->callbacks[$event] = [];
        }
        $this->callbacks[$event][] = $callback;
    }

    private function trigger(string $event, $data = null): void
    {
        if (isset($this->callbacks[$event])) {
            foreach ($this->callbacks[$event] as $callback) {
                $callback($data);
            }
        }
    }

    public function close(int $code = 1000, string $reason = ''): void
    {
        $this->isConnected = false;
        if ($this->client) {
            $this->client->close($code, $reason);
        }
    }

    public function isConnected(): bool
    {
        return $this->isConnected;
    }
}
```

## Ratchet WebSocket Server

### Basic Ratchet Server

Create a WebSocket server using Ratchet:

```php
<?php
namespace App\WebSocket;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use SplObjectStorage;

class ChatServer implements MessageComponentInterface
{
    protected $clients;
    protected $users;
    protected $rooms;

    public function __construct()
    {
        $this->clients = new SplObjectStorage;
        $this->users = [];
        $this->rooms = [];
    }

    public function onOpen(ConnectionInterface $conn)
    {
        $this->clients->attach($conn);

        $conn->userId = uniqid();
        $this->users[$conn->userId] = [
            'id' => $conn->userId,
            'conn' => $conn,
            'rooms' => [],
            'metadata' => []
        ];

        echo "New connection: {$conn->resourceId} (User: {$conn->userId})\n";

        // Send welcome message
        $conn->send(json_encode([
            'type' => 'welcome',
            'userId' => $conn->userId,
            'message' => 'Connected to WebSocket server'
        ]));

        // Notify others
        $this->broadcast([
            'type' => 'user_connected',
            'userId' => $conn->userId,
            'totalUsers' => count($this->clients)
        ], $conn);
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        echo "Message from {$from->userId}: {$msg}\n";

        try {
            $data = json_decode($msg, true);
            if (!$data || !isset($data['type'])) {
                throw new \Exception('Invalid message format');
            }

            switch ($data['type']) {
                case 'broadcast':
                    $this->handleBroadcast($from, $data);
                    break;

                case 'private':
                    $this->handlePrivateMessage($from, $data);
                    break;

                case 'join_room':
                    $this->handleJoinRoom($from, $data);
                    break;

                case 'leave_room':
                    $this->handleLeaveRoom($from, $data);
                    break;

                case 'room_message':
                    $this->handleRoomMessage($from, $data);
                    break;

                case 'set_metadata':
                    $this->handleSetMetadata($from, $data);
                    break;

                default:
                    $this->handleCustomMessage($from, $data);
            }

        } catch (\Exception $e) {
            $from->send(json_encode([
                'type' => 'error',
                'message' => $e->getMessage()
            ]));
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->clients->detach($conn);

        // Leave all rooms
        if (isset($this->users[$conn->userId])) {
            foreach ($this->users[$conn->userId]['rooms'] as $roomId) {
                $this->removeFromRoom($conn, $roomId);
            }

            unset($this->users[$conn->userId]);
        }

        echo "Connection closed: {$conn->resourceId}\n";

        // Notify others
        $this->broadcast([
            'type' => 'user_disconnected',
            'userId' => $conn->userId,
            'totalUsers' => count($this->clients)
        ]);
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "Error: {$e->getMessage()}\n";
        $conn->close();
    }

    protected function handleBroadcast(ConnectionInterface $from, array $data)
    {
        $message = [
            'type' => 'broadcast',
            'from' => $from->userId,
            'message' => $data['message'] ?? '',
            'timestamp' => time()
        ];

        $this->broadcast($message, $from);
    }

    protected function handlePrivateMessage(ConnectionInterface $from, array $data)
    {
        $targetUserId = $data['to'] ?? null;

        if (!$targetUserId || !isset($this->users[$targetUserId])) {
            $from->send(json_encode([
                'type' => 'error',
                'message' => 'User not found'
            ]));
            return;
        }

        $message = [
            'type' => 'private_message',
            'from' => $from->userId,
            'message' => $data['message'] ?? '',
            'timestamp' => time()
        ];

        $this->users[$targetUserId]['conn']->send(json_encode($message));

        // Send confirmation to sender
        $from->send(json_encode([
            'type' => 'message_sent',
            'to' => $targetUserId,
            'timestamp' => $message['timestamp']
        ]));
    }

    protected function handleJoinRoom(ConnectionInterface $from, array $data)
    {
        $roomId = $data['room'] ?? null;

        if (!$roomId) {
            throw new \Exception('Room ID required');
        }

        if (!isset($this->rooms[$roomId])) {
            $this->rooms[$roomId] = [];
        }

        // Add user to room
        $this->rooms[$roomId][$from->userId] = $from;
        $this->users[$from->userId]['rooms'][] = $roomId;

        // Notify room members
        $this->broadcastToRoom($roomId, [
            'type' => 'user_joined_room',
            'userId' => $from->userId,
            'room' => $roomId,
            'totalMembers' => count($this->rooms[$roomId])
        ], $from);

        // Send confirmation
        $from->send(json_encode([
            'type' => 'joined_room',
            'room' => $roomId,
            'members' => array_keys($this->rooms[$roomId])
        ]));
    }

    protected function handleLeaveRoom(ConnectionInterface $from, array $data)
    {
        $roomId = $data['room'] ?? null;

        if (!$roomId) {
            throw new \Exception('Room ID required');
        }

        $this->removeFromRoom($from, $roomId);

        // Send confirmation
        $from->send(json_encode([
            'type' => 'left_room',
            'room' => $roomId
        ]));
    }

    protected function handleRoomMessage(ConnectionInterface $from, array $data)
    {
        $roomId = $data['room'] ?? null;
        $message = $data['message'] ?? '';

        if (!$roomId || !isset($this->rooms[$roomId][$from->userId])) {
            throw new \Exception('Not in room');
        }

        $this->broadcastToRoom($roomId, [
            'type' => 'room_message',
            'from' => $from->userId,
            'room' => $roomId,
            'message' => $message,
            'timestamp' => time()
        ]);
    }

    protected function handleSetMetadata(ConnectionInterface $from, array $data)
    {
        $metadata = $data['metadata'] ?? [];

        if (isset($this->users[$from->userId])) {
            $this->users[$from->userId]['metadata'] = array_merge(
                $this->users[$from->userId]['metadata'],
                $metadata
            );

            $from->send(json_encode([
                'type' => 'metadata_updated',
                'metadata' => $this->users[$from->userId]['metadata']
            ]));
        }
    }

    protected function handleCustomMessage(ConnectionInterface $from, array $data)
    {
        // Override in subclass for custom message handling
    }

    protected function broadcast(array $message, ConnectionInterface $exclude = null)
    {
        $json = json_encode($message);

        foreach ($this->clients as $client) {
            if ($client !== $exclude) {
                $client->send($json);
            }
        }
    }

    protected function broadcastToRoom(string $roomId, array $message, ConnectionInterface $exclude = null)
    {
        if (!isset($this->rooms[$roomId])) {
            return;
        }

        $json = json_encode($message);

        foreach ($this->rooms[$roomId] as $userId => $client) {
            if ($client !== $exclude) {
                $client->send($json);
            }
        }
    }

    protected function removeFromRoom(ConnectionInterface $conn, string $roomId)
    {
        if (isset($this->rooms[$roomId][$conn->userId])) {
            unset($this->rooms[$roomId][$conn->userId]);

            // Remove room if empty
            if (empty($this->rooms[$roomId])) {
                unset($this->rooms[$roomId]);
            } else {
                // Notify remaining members
                $this->broadcastToRoom($roomId, [
                    'type' => 'user_left_room',
                    'userId' => $conn->userId,
                    'room' => $roomId,
                    'totalMembers' => count($this->rooms[$roomId])
                ]);
            }

            // Remove from user's room list
            $key = array_search($roomId, $this->users[$conn->userId]['rooms']);
            if ($key !== false) {
                unset($this->users[$conn->userId]['rooms'][$key]);
            }
        }
    }
}

// Server bootstrap
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new ChatServer()
        )
    ),
    8080
);

echo "WebSocket server started on port 8080\n";
$server->run();
```

### Authenticated Ratchet Server

Implement authentication with Ratchet:

```php
<?php
namespace App\WebSocket;

use Ratchet\ConnectionInterface;
use Ratchet\MessageComponentInterface;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class AuthenticatedWebSocketServer implements MessageComponentInterface
{
    protected $clients;
    protected $authenticatedUsers;
    protected $jwtSecret;

    public function __construct(string $jwtSecret)
    {
        $this->clients = new \SplObjectStorage;
        $this->authenticatedUsers = [];
        $this->jwtSecret = $jwtSecret;
    }

    public function onOpen(ConnectionInterface $conn)
    {
        // Parse query string for token
        $queryString = $conn->httpRequest->getUri()->getQuery();
        parse_str($queryString, $params);

        if (!isset($params['token'])) {
            $conn->send(json_encode([
                'type' => 'error',
                'message' => 'Authentication required'
            ]));
            $conn->close();
            return;
        }

        try {
            // Verify JWT token
            $decoded = JWT::decode($params['token'], new Key($this->jwtSecret, 'HS256'));

            // Store authenticated user
            $conn->userId = $decoded->sub;
            $conn->userRole = $decoded->role ?? 'user';
            $conn->authenticated = true;

            $this->clients->attach($conn);
            $this->authenticatedUsers[$conn->userId] = $conn;

            echo "Authenticated user connected: {$conn->userId}\n";

            $conn->send(json_encode([
                'type' => 'authenticated',
                'userId' => $conn->userId,
                'role' => $conn->userRole
            ]));

        } catch (\Exception $e) {
            $conn->send(json_encode([
                'type' => 'error',
                'message' => 'Invalid token: ' . $e->getMessage()
            ]));
            $conn->close();
        }
    }

    public function onMessage(ConnectionInterface $from, $msg)
    {
        if (!$from->authenticated) {
            $from->close();
            return;
        }

        try {
            $data = json_decode($msg, true);

            // Check permissions
            if (!$this->hasPermission($from, $data['type'])) {
                $from->send(json_encode([
                    'type' => 'error',
                    'message' => 'Permission denied'
                ]));
                return;
            }

            // Process message based on type
            $this->processMessage($from, $data);

        } catch (\Exception $e) {
            $from->send(json_encode([
                'type' => 'error',
                'message' => $e->getMessage()
            ]));
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        $this->clients->detach($conn);

        if (isset($conn->userId)) {
            unset($this->authenticatedUsers[$conn->userId]);
            echo "User disconnected: {$conn->userId}\n";
        }
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        echo "Error: {$e->getMessage()}\n";
        $conn->close();
    }

    protected function hasPermission(ConnectionInterface $conn, string $action): bool
    {
        $permissions = [
            'user' => ['send_message', 'receive_message'],
            'moderator' => ['send_message', 'receive_message', 'kick_user'],
            'admin' => ['send_message', 'receive_message', 'kick_user', 'ban_user', 'broadcast']
        ];

        $userRole = $conn->userRole ?? 'user';

        return in_array($action, $permissions[$userRole] ?? []);
    }

    protected function processMessage(ConnectionInterface $from, array $data)
    {
        switch ($data['type']) {
            case 'send_message':
                $this->broadcastMessage($from, $data['message']);
                break;

            case 'kick_user':
                $this->kickUser($from, $data['userId']);
                break;

            case 'broadcast':
                $this->broadcastAdmin($from, $data['message']);
                break;
        }
    }

    protected function broadcastMessage(ConnectionInterface $from, string $message)
    {
        $payload = json_encode([
            'type' => 'message',
            'from' => $from->userId,
            'message' => $message,
            'timestamp' => time()
        ]);

        foreach ($this->clients as $client) {
            if ($client->authenticated) {
                $client->send($payload);
            }
        }
    }

    protected function kickUser(ConnectionInterface $from, string $userId)
    {
        if (isset($this->authenticatedUsers[$userId])) {
            $targetConn = $this->authenticatedUsers[$userId];
            $targetConn->send(json_encode([
                'type' => 'kicked',
                'by' => $from->userId
            ]));
            $targetConn->close();
        }
    }

    protected function broadcastAdmin(ConnectionInterface $from, string $message)
    {
        $payload = json_encode([
            'type' => 'admin_broadcast',
            'message' => $message,
            'timestamp' => time()
        ]);

        foreach ($this->clients as $client) {
            if ($client->authenticated) {
                $client->send($payload);
            }
        }
    }
}
```

## ReactPHP WebSocket Server

### Async WebSocket Server with ReactPHP

```php
<?php
use React\EventLoop\Loop;
use React\Stream\WritableResourceStream;
use React\Http\HttpServer;
use React\Http\Message\Response;
use React\Socket\SocketServer;
use Ratchet\RFC6455\Messaging\MessageInterface;
use Ratchet\RFC6455\Messaging\FrameInterface;

class ReactWebSocketServer
{
    private $loop;
    private $clients;
    private $redis;

    public function __construct()
    {
        $this->loop = Loop::get();
        $this->clients = new \SplObjectStorage();
        $this->setupRedis();
    }

    private function setupRedis()
    {
        // Setup Redis for pub/sub
        $this->redis = new \Clue\React\Redis\Factory($this->loop);
        $client = $this->redis->createLazyClient('redis://localhost:6379');

        $client->subscribe('websocket:broadcast')->then(function () use ($client) {
            $client->on('message', function ($channel, $message) {
                $this->broadcastFromRedis($message);
            });
        });
    }

    public function run()
    {
        $server = new HttpServer(
            $this->loop,
            function (ServerRequestInterface $request) {
                $path = $request->getUri()->getPath();

                if ($path === '/ws') {
                    return $this->handleWebSocket($request);
                }

                return new Response(404, [], 'Not Found');
            }
        );

        $socket = new SocketServer('0.0.0.0:8080', [], $this->loop);
        $server->listen($socket);

        echo "WebSocket server running on ws://localhost:8080/ws\n";

        // Add periodic tasks
        $this->loop->addPeriodicTimer(30, function () {
            $this->sendPing();
        });

        $this->loop->run();
    }

    private function handleWebSocket(ServerRequestInterface $request)
    {
        // WebSocket handshake
        if (!$this->isWebSocketRequest($request)) {
            return new Response(400, [], 'Bad Request');
        }

        $key = $request->getHeaderLine('Sec-WebSocket-Key');
        $accept = base64_encode(sha1($key . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', true));

        $response = new Response(
            101,
            [
                'Upgrade' => 'websocket',
                'Connection' => 'Upgrade',
                'Sec-WebSocket-Accept' => $accept,
                'Sec-WebSocket-Protocol' => 'chat'
            ]
        );

        // Handle connection after upgrade
        $request->getBody()->on('data', function ($data) use ($request) {
            $this->handleMessage($request, $data);
        });

        $request->getBody()->on('close', function () use ($request) {
            $this->handleClose($request);
        });

        return $response;
    }

    private function isWebSocketRequest(ServerRequestInterface $request): bool
    {
        return $request->getHeaderLine('Upgrade') === 'websocket' &&
               $request->hasHeader('Sec-WebSocket-Key');
    }

    private function handleMessage($conn, $data)
    {
        try {
            $message = $this->decodeWebSocketFrame($data);
            $json = json_decode($message, true);

            if ($json) {
                $this->processMessage($conn, $json);
            }
        } catch (\Exception $e) {
            echo "Error handling message: {$e->getMessage()}\n";
        }
    }

    private function processMessage($conn, array $data)
    {
        switch ($data['type'] ?? '') {
            case 'subscribe':
                $this->handleSubscribe($conn, $data);
                break;

            case 'publish':
                $this->handlePublish($conn, $data);
                break;

            case 'presence':
                $this->handlePresence($conn);
                break;
        }
    }

    private function handleSubscribe($conn, array $data)
    {
        $channel = $data['channel'] ?? 'default';

        // Store subscription
        if (!isset($conn->channels)) {
            $conn->channels = [];
        }
        $conn->channels[] = $channel;

        // Subscribe to Redis channel
        $this->redis->createLazyClient('redis://localhost:6379')
            ->subscribe("channel:$channel")
            ->then(function ($client) use ($conn, $channel) {
                $client->on('message', function ($ch, $message) use ($conn) {
                    $this->sendToConnection($conn, $message);
                });
            });

        $this->sendToConnection($conn, json_encode([
            'type' => 'subscribed',
            'channel' => $channel
        ]));
    }

    private function handlePublish($conn, array $data)
    {
        $channel = $data['channel'] ?? 'default';
        $message = $data['message'] ?? '';

        // Publish to Redis
        $this->redis->createLazyClient('redis://localhost:6379')
            ->publish("channel:$channel", json_encode([
                'from' => $conn->id ?? 'unknown',
                'message' => $message,
                'timestamp' => time()
            ]));
    }

    private function handlePresence($conn)
    {
        $presence = [];
        foreach ($this->clients as $client) {
            $presence[] = [
                'id' => $client->id ?? 'unknown',
                'channels' => $client->channels ?? []
            ];
        }

        $this->sendToConnection($conn, json_encode([
            'type' => 'presence',
            'users' => $presence
        ]));
    }

    private function sendPing()
    {
        $pingFrame = $this->encodeWebSocketFrame('', 0x9); // Ping frame

        foreach ($this->clients as $client) {
            try {
                $client->write($pingFrame);
            } catch (\Exception $e) {
                $this->clients->detach($client);
            }
        }
    }

    private function broadcastFromRedis(string $message)
    {
        $frame = $this->encodeWebSocketFrame($message);

        foreach ($this->clients as $client) {
            try {
                $client->write($frame);
            } catch (\Exception $e) {
                $this->clients->detach($client);
            }
        }
    }

    private function sendToConnection($conn, string $message)
    {
        $frame = $this->encodeWebSocketFrame($message);
        $conn->write($frame);
    }

    private function handleClose($conn)
    {
        $this->clients->detach($conn);
        echo "Connection closed\n";
    }

    private function encodeWebSocketFrame(string $payload, int $opcode = 0x1): string
    {
        $length = strlen($payload);

        if ($length <= 125) {
            $header = chr(0x80 | $opcode) . chr($length);
        } elseif ($length <= 65535) {
            $header = chr(0x80 | $opcode) . chr(126) . pack('n', $length);
        } else {
            $header = chr(0x80 | $opcode) . chr(127) . pack('J', $length);
        }

        return $header . $payload;
    }

    private function decodeWebSocketFrame(string $data): string
    {
        // Simplified frame decoding
        $length = ord($data[1]) & 127;

        if ($length == 126) {
            $masks = substr($data, 4, 4);
            $payloadOffset = 8;
        } elseif ($length == 127) {
            $masks = substr($data, 10, 4);
            $payloadOffset = 14;
        } else {
            $masks = substr($data, 2, 4);
            $payloadOffset = 6;
        }

        $payload = '';
        for ($i = $payloadOffset; $i < strlen($data); $i++) {
            $payload .= $data[$i] ^ $masks[($i - $payloadOffset) % 4];
        }

        return $payload;
    }
}

// Run the server
$server = new ReactWebSocketServer();
$server->run();
```

## Swoole WebSocket Server

### High-Performance Swoole Server

```php
<?php
use Swoole\WebSocket\Server;
use Swoole\Http\Request;
use Swoole\WebSocket\Frame;
use Swoole\Table;

class SwooleWebSocketServer
{
    private $server;
    private $connections;
    private $rooms;

    public function __construct(string $host = '0.0.0.0', int $port = 9501)
    {
        $this->server = new Server($host, $port);

        // Configure server
        $this->server->set([
            'worker_num' => 4,
            'task_worker_num' => 4,
            'max_request' => 10000,
            'dispatch_mode' => 2,
            'heartbeat_check_interval' => 60,
            'heartbeat_idle_time' => 600,
            'max_connection' => 10000,
            'buffer_output_size' => 2 * 1024 * 1024, // 2MB
            'enable_coroutine' => true,
        ]);

        // Create shared memory tables
        $this->setupTables();

        // Register event handlers
        $this->registerEventHandlers();
    }

    private function setupTables()
    {
        // Connection table
        $this->connections = new Table(10000);
        $this->connections->column('fd', Table::TYPE_INT);
        $this->connections->column('user_id', Table::TYPE_STRING, 64);
        $this->connections->column('created_at', Table::TYPE_INT);
        $this->connections->create();

        // Room table
        $this->rooms = new Table(1000);
        $this->rooms->column('name', Table::TYPE_STRING, 64);
        $this->rooms->column('members', Table::TYPE_STRING, 1024);
        $this->rooms->create();
    }

    private function registerEventHandlers()
    {
        $this->server->on('start', [$this, 'onStart']);
        $this->server->on('open', [$this, 'onOpen']);
        $this->server->on('message', [$this, 'onMessage']);
        $this->server->on('close', [$this, 'onClose']);
        $this->server->on('task', [$this, 'onTask']);
        $this->server->on('finish', [$this, 'onFinish']);
    }

    public function onStart(Server $server)
    {
        echo "Swoole WebSocket Server started at ws://{$server->host}:{$server->port}\n";
        echo "Master PID: {$server->master_pid}, Manager PID: {$server->manager_pid}\n";
    }

    public function onOpen(Server $server, Request $request)
    {
        $fd = $request->fd;
        $userId = uniqid('user_');

        // Store connection info
        $this->connections->set($fd, [
            'fd' => $fd,
            'user_id' => $userId,
            'created_at' => time()
        ]);

        echo "Connection opened: {$fd} (User: {$userId})\n";

        // Send welcome message
        $server->push($fd, json_encode([
            'type' => 'welcome',
            'user_id' => $userId,
            'server_time' => time()
        ]));

        // Broadcast user joined
        $this->broadcast($server, [
            'type' => 'user_joined',
            'user_id' => $userId,
            'total_users' => $this->connections->count()
        ], $fd);
    }

    public function onMessage(Server $server, Frame $frame)
    {
        $fd = $frame->fd;
        $data = json_decode($frame->data, true);

        if (!$data || !isset($data['type'])) {
            $server->push($fd, json_encode([
                'type' => 'error',
                'message' => 'Invalid message format'
            ]));
            return;
        }

        // Get user info
        $userInfo = $this->connections->get($fd);
        $userId = $userInfo['user_id'] ?? 'unknown';

        switch ($data['type']) {
            case 'broadcast':
                $this->handleBroadcast($server, $fd, $userId, $data);
                break;

            case 'private':
                $this->handlePrivate($server, $fd, $userId, $data);
                break;

            case 'join_room':
                $this->handleJoinRoom($server, $fd, $userId, $data);
                break;

            case 'room_message':
                $this->handleRoomMessage($server, $fd, $userId, $data);
                break;

            case 'task':
                $this->handleTask($server, $fd, $data);
                break;

            default:
                $server->push($fd, json_encode([
                    'type' => 'echo',
                    'data' => $data
                ]));
        }
    }

    public function onClose(Server $server, int $fd)
    {
        $userInfo = $this->connections->get($fd);

        if ($userInfo) {
            $userId = $userInfo['user_id'];
            $this->connections->del($fd);

            echo "Connection closed: {$fd} (User: {$userId})\n";

            // Broadcast user left
            $this->broadcast($server, [
                'type' => 'user_left',
                'user_id' => $userId,
                'total_users' => $this->connections->count()
            ]);
        }
    }

    public function onTask(Server $server, int $taskId, int $reactorId, $data)
    {
        echo "Task {$taskId} started\n";

        // Perform async task
        switch ($data['type'] ?? '') {
            case 'send_email':
                $this->sendEmail($data);
                break;

            case 'process_data':
                $result = $this->processData($data);
                return $result;

            case 'broadcast_delayed':
                sleep($data['delay'] ?? 1);
                $this->broadcast($server, $data['message']);
                break;
        }

        return "Task {$taskId} completed";
    }

    public function onFinish(Server $server, int $taskId, $data)
    {
        echo "Task {$taskId} finished: {$data}\n";
    }

    private function handleBroadcast(Server $server, int $fd, string $userId, array $data)
    {
        $message = [
            'type' => 'broadcast',
            'from' => $userId,
            'message' => $data['message'] ?? '',
            'timestamp' => time()
        ];

        $this->broadcast($server, $message, $fd);
    }

    private function handlePrivate(Server $server, int $fd, string $userId, array $data)
    {
        $targetUserId = $data['to'] ?? null;

        if (!$targetUserId) {
            $server->push($fd, json_encode([
                'type' => 'error',
                'message' => 'Target user required'
            ]));
            return;
        }

        // Find target connection
        $targetFd = null;
        foreach ($this->connections as $conn) {
            if ($conn['user_id'] === $targetUserId) {
                $targetFd = $conn['fd'];
                break;
            }
        }

        if ($targetFd && $server->isEstablished($targetFd)) {
            $server->push($targetFd, json_encode([
                'type' => 'private_message',
                'from' => $userId,
                'message' => $data['message'] ?? '',
                'timestamp' => time()
            ]));

            // Send confirmation
            $server->push($fd, json_encode([
                'type' => 'message_sent',
                'to' => $targetUserId
            ]));
        } else {
            $server->push($fd, json_encode([
                'type' => 'error',
                'message' => 'User not found or offline'
            ]));
        }
    }

    private function handleJoinRoom(Server $server, int $fd, string $userId, array $data)
    {
        $roomName = $data['room'] ?? 'default';

        // Get or create room
        $room = $this->rooms->get($roomName);
        $members = $room ? json_decode($room['members'], true) : [];

        // Add user to room
        $members[$userId] = $fd;

        $this->rooms->set($roomName, [
            'name' => $roomName,
            'members' => json_encode($members)
        ]);

        // Notify room members
        foreach ($members as $memberFd) {
            if ($memberFd != $fd && $server->isEstablished($memberFd)) {
                $server->push($memberFd, json_encode([
                    'type' => 'user_joined_room',
                    'room' => $roomName,
                    'user_id' => $userId
                ]));
            }
        }

        // Send confirmation
        $server->push($fd, json_encode([
            'type' => 'joined_room',
            'room' => $roomName,
            'members' => array_keys($members)
        ]));
    }

    private function handleRoomMessage(Server $server, int $fd, string $userId, array $data)
    {
        $roomName = $data['room'] ?? 'default';
        $room = $this->rooms->get($roomName);

        if (!$room) {
            $server->push($fd, json_encode([
                'type' => 'error',
                'message' => 'Room not found'
            ]));
            return;
        }

        $members = json_decode($room['members'], true);

        // Broadcast to room members
        foreach ($members as $memberFd) {
            if ($server->isEstablished($memberFd)) {
                $server->push($memberFd, json_encode([
                    'type' => 'room_message',
                    'room' => $roomName,
                    'from' => $userId,
                    'message' => $data['message'] ?? '',
                    'timestamp' => time()
                ]));
            }
        }
    }

    private function handleTask(Server $server, int $fd, array $data)
    {
        // Dispatch async task
        $taskId = $server->task($data);

        $server->push($fd, json_encode([
            'type' => 'task_dispatched',
            'task_id' => $taskId
        ]));
    }

    private function broadcast(Server $server, array $message, int $exclude = null)
    {
        $json = json_encode($message);

        foreach ($this->connections as $conn) {
            $fd = $conn['fd'];
            if ($fd != $exclude && $server->isEstablished($fd)) {
                $server->push($fd, $json);
            }
        }
    }

    private function sendEmail(array $data)
    {
        // Simulate email sending
        sleep(2);
        echo "Email sent to: " . ($data['to'] ?? 'unknown') . "\n";
    }

    private function processData(array $data)
    {
        // Simulate data processing
        sleep(1);
        return "Processed: " . json_encode($data);
    }

    public function start()
    {
        $this->server->start();
    }
}

// Start server
$server = new SwooleWebSocketServer('0.0.0.0', 9501);
$server->start();
```

## Laravel WebSocket Integration

### Laravel WebSocket Broadcasting

```php
<?php
// config/broadcasting.php
return [
    'default' => env('BROADCAST_DRIVER', 'pusher'),

    'connections' => [
        'pusher' => [
            'driver' => 'pusher',
            'key' => env('PUSHER_APP_KEY'),
            'secret' => env('PUSHER_APP_SECRET'),
            'app_id' => env('PUSHER_APP_ID'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER'),
                'useTLS' => true,
                'host' => '127.0.0.1',
                'port' => 6001,
                'scheme' => 'http'
            ],
        ],
    ],
];

// app/Events/MessageSent.php
namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $user;
    public $message;

    public function __construct($user, $message)
    {
        $this->user = $user;
        $this->message = $message;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('chat');
    }

    public function broadcastAs()
    {
        return 'message.sent';
    }

    public function broadcastWith()
    {
        return [
            'user' => [
                'id' => $this->user->id,
                'name' => $this->user->name
            ],
            'message' => $this->message,
            'timestamp' => now()->toIso8601String()
        ];
    }
}

// app/Http/Controllers/WebSocketController.php
namespace App\Http\Controllers;

use App\Events\MessageSent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class WebSocketController extends Controller
{
    public function sendMessage(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:1000'
        ]);

        $user = Auth::user();
        $message = $request->input('message');

        // Broadcast message
        broadcast(new MessageSent($user, $message))->toOthers();

        return response()->json([
            'status' => 'Message sent',
            'message' => $message
        ]);
    }
}

// routes/channels.php
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat', function ($user) {
    return Auth::check();
});

Broadcast::channel('user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
```

## Best Practices

### Connection Management

- Implement connection pooling for better resource management
- Use persistent connections where appropriate
- Handle connection drops gracefully
- Implement heartbeat/ping-pong mechanism

### Security

- Always use WSS (WebSocket Secure) in production
- Implement proper authentication (JWT, OAuth)
- Validate all incoming messages
- Rate limit connections and messages
- Sanitize user input

### Performance

- Use message queuing for high-throughput scenarios
- Implement proper database connection pooling
- Use Redis or similar for pub/sub across multiple servers
- Consider using Swoole for high-performance requirements

### Scaling

- Use Redis pub/sub for horizontal scaling
- Implement sticky sessions with load balancers
- Consider using message brokers (RabbitMQ, Kafka)
- Use process managers like Supervisor

### Error Handling

- Implement comprehensive error logging
- Handle exceptions gracefully
- Provide meaningful error messages
- Implement retry mechanisms
- Use circuit breakers for external services

### Monitoring

- Track connection metrics
- Monitor message throughput
- Log performance metrics
- Implement health checks
- Use APM tools for production monitoring
