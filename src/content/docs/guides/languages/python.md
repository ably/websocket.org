---
title: Python WebSocket Implementation
description:
  Complete guide to WebSocket clients and servers in Python using websockets,
  Django Channels, and FastAPI
sidebar:
  order: 2
---

This guide covers WebSocket implementation in Python using popular libraries and
frameworks, including async patterns, scaling strategies, and production
deployment.

## websockets Library

The `websockets` library is a popular pure-Python implementation with
async/await support.

### Installation

```bash
pip install websockets
```

### Basic Server

Create an async WebSocket server:

```python
import asyncio import websockets import json import
logging

logging.basicConfig(level=logging.INFO) logger = logging.getLogger(**name**)

# Connected clients

clients = set()

async def handler(websocket, path): """Handle a WebSocket connection.""" #
Register client clients.add(websocket) logger.info(f"Client
{websocket.remote_address} connected")

    try:
        # Send welcome message
        await websocket.send(json.dumps({
            "type": "welcome",
            "message": "Connected to WebSocket server"
        }))

        # Handle messages
        async for message in websocket:
            data = json.loads(message)
            logger.info(f"Received: {data}")

            # Echo back to sender
            await websocket.send(json.dumps({
                "type": "echo",
                "data": data
            }))

            # Broadcast to others
            if data.get("broadcast"):
                await broadcast(message, websocket)

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client {websocket.remote_address} disconnected")
    except Exception as e:
        logger.error(f"Error handling client: {e}")
    finally:
        # Unregister client
        clients.remove(websocket)

async def broadcast(message, sender): """Broadcast message to all clients except
sender.""" if clients: await asyncio.gather( \*[client.send(message) for client
in clients if client != sender], return_exceptions=True )

async def main(): async with websockets.serve(handler, "localhost", 8765):
logger.info("Server started on ws://localhost:8765") await asyncio.Future() #
Run forever

if **name** == "**main**": asyncio.run(main())
```

### Client Implementation

Create a WebSocket client with reconnection:

```python
import asyncio import websockets import json import
logging from typing import Optional

class WebSocketClient: def **init**(self, uri: str): self.uri = uri
self.websocket: Optional[websockets.WebSocketClientProtocol] = None self.running
= False self.reconnect_interval = 5 self.logger = logging.getLogger(**name**)

    async def connect(self):
        """Establish WebSocket connection."""
        try:
            self.websocket = await websockets.connect(self.uri)
            self.logger.info(f"Connected to {self.uri}")
            return True
        except Exception as e:
            self.logger.error(f"Connection failed: {e}")
            return False

    async def disconnect(self):
        """Close WebSocket connection."""
        if self.websocket:
            await self.websocket.close()
            self.websocket = None

    async def send(self, data: dict):
        """Send JSON message."""
        if self.websocket:
            try:
                await self.websocket.send(json.dumps(data))
                return True
            except Exception as e:
                self.logger.error(f"Send failed: {e}")
                return False
        return False

    async def receive(self):
        """Receive and parse JSON message."""
        if self.websocket:
            try:
                message = await self.websocket.recv()
                return json.loads(message)
            except websockets.exceptions.ConnectionClosed:
                self.logger.info("Connection closed")
                return None
            except Exception as e:
                self.logger.error(f"Receive error: {e}")
                return None
        return None

    async def run(self):
        """Main client loop with auto-reconnection."""
        self.running = True

        while self.running:
            # Connect
            if not await self.connect():
                self.logger.info(f"Reconnecting in {self.reconnect_interval}s...")
                await asyncio.sleep(self.reconnect_interval)
                continue

            # Handle messages
            try:
                await self.handle_messages()
            except Exception as e:
                self.logger.error(f"Error in message handler: {e}")

            # Disconnected, wait before reconnecting
            await self.disconnect()
            if self.running:
                self.logger.info(f"Reconnecting in {self.reconnect_interval}s...")
                await asyncio.sleep(self.reconnect_interval)

    async def handle_messages(self):
        """Process incoming messages."""
        # Send initial message
        await self.send({"type": "hello", "name": "Python Client"})

        # Receive messages
        while self.websocket and not self.websocket.closed:
            message = await self.receive()
            if message:
                self.logger.info(f"Received: {message}")

                # Handle different message types
                if message.get("type") == "ping":
                    await self.send({"type": "pong"})

    async def stop(self):
        """Stop the client."""
        self.running = False
        await self.disconnect()

# Usage

async def main(): client = WebSocketClient("ws://localhost:8765")

    # Run client in background
    client_task = asyncio.create_task(client.run())

    # Send messages periodically
    for i in range(5):
        await asyncio.sleep(2)
        await client.send({"type": "message", "text": f"Hello {i}"})

    # Stop client
    await client.stop()
    await client_task

if **name** == "**main**": logging.basicConfig(level=logging.INFO)
asyncio.run(main())
```

### Advanced Server Features

Implement authentication, rooms, and broadcasting:

```python
import asyncio import websockets import json import
jwt import time from typing import Dict, Set from dataclasses import dataclass

@dataclass class Client: websocket: websockets.WebSocketServerProtocol user_id:
str username: str rooms: Set[str]

class WebSocketServer: def **init**(self, secret_key: str): self.secret_key =
secret_key self.clients: Dict[str, Client] = {} self.rooms: Dict[str, Set[str]]
= {}

    async def authenticate(self, websocket, path):
        """Authenticate client using JWT token."""
        # Get token from query parameter or header
        query = websocket.path.split('?')[1] if '?' in websocket.path else ''
        params = dict(p.split('=') for p in query.split('&') if '=' in p)
        token = params.get('token')

        if not token:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "Authentication required"
            }))
            await websocket.close(1008, "Authentication required")
            return None

        try:
            # Verify JWT token
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload
        except jwt.InvalidTokenError as e:
            await websocket.send(json.dumps({
                "type": "error",
                "message": f"Invalid token: {e}"
            }))
            await websocket.close(1008, "Invalid token")
            return None

    async def handler(self, websocket, path):
        """Handle authenticated WebSocket connection."""
        # Authenticate
        auth_data = await self.authenticate(websocket, path)
        if not auth_data:
            return

        # Create client
        client = Client(
            websocket=websocket,
            user_id=auth_data['user_id'],
            username=auth_data['username'],
            rooms=set()
        )

        # Register client
        self.clients[client.user_id] = client

        try:
            # Send success message
            await websocket.send(json.dumps({
                "type": "authenticated",
                "user_id": client.user_id,
                "username": client.username
            }))

            # Handle messages
            async for message in websocket:
                await self.handle_message(client, json.loads(message))

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            # Cleanup
            await self.disconnect_client(client)

    async def handle_message(self, client: Client, data: dict):
        """Route messages to appropriate handlers."""
        message_type = data.get('type')

        handlers = {
            'join_room': self.handle_join_room,
            'leave_room': self.handle_leave_room,
            'room_message': self.handle_room_message,
            'private_message': self.handle_private_message,
            'broadcast': self.handle_broadcast,
            'ping': self.handle_ping
        }

        handler = handlers.get(message_type)
        if handler:
            await handler(client, data)
        else:
            await client.websocket.send(json.dumps({
                "type": "error",
                "message": f"Unknown message type: {message_type}"
            }))

    async def handle_join_room(self, client: Client, data: dict):
        """Join a room."""
        room_name = data.get('room')
        if not room_name:
            return

        # Add to room
        if room_name not in self.rooms:
            self.rooms[room_name] = set()

        self.rooms[room_name].add(client.user_id)
        client.rooms.add(room_name)

        # Notify client
        await client.websocket.send(json.dumps({
            "type": "joined_room",
            "room": room_name
        }))

        # Notify room members
        await self.send_to_room(room_name, {
            "type": "user_joined",
            "room": room_name,
            "user_id": client.user_id,
            "username": client.username
        }, exclude=client.user_id)

    async def handle_leave_room(self, client: Client, data: dict):
        """Leave a room."""
        room_name = data.get('room')
        if not room_name or room_name not in client.rooms:
            return

        # Remove from room
        client.rooms.remove(room_name)
        if room_name in self.rooms:
            self.rooms[room_name].discard(client.user_id)

            # Clean up empty room
            if not self.rooms[room_name]:
                del self.rooms[room_name]

        # Notify room members
        await self.send_to_room(room_name, {
            "type": "user_left",
            "room": room_name,
            "user_id": client.user_id,
            "username": client.username
        })

    async def handle_room_message(self, client: Client, data: dict):
        """Send message to a room."""
        room_name = data.get('room')
        message = data.get('message')

        if not room_name or not message or room_name not in client.rooms:
            return

        await self.send_to_room(room_name, {
            "type": "room_message",
            "room": room_name,
            "user_id": client.user_id,
            "username": client.username,
            "message": message,
            "timestamp": time.time()
        })

    async def handle_private_message(self, client: Client, data: dict):
        """Send private message to user."""
        target_user_id = data.get('to')
        message = data.get('message')

        if not target_user_id or not message:
            return

        target = self.clients.get(target_user_id)
        if target:
            await target.websocket.send(json.dumps({
                "type": "private_message",
                "from_user_id": client.user_id,
                "from_username": client.username,
                "message": message,
                "timestamp": time.time()
            }))

    async def handle_broadcast(self, client: Client, data: dict):
        """Broadcast to all connected clients."""
        message = data.get('message')
        if not message:
            return

        # Check permission (example)
        if not client.user_id.startswith('admin_'):
            await client.websocket.send(json.dumps({
                "type": "error",
                "message": "No broadcast permission"
            }))
            return

        await self.broadcast({
            "type": "broadcast",
            "from_user_id": client.user_id,
            "from_username": client.username,
            "message": message,
            "timestamp": time.time()
        })

    async def handle_ping(self, client: Client, data: dict):
        """Respond to ping."""
        await client.websocket.send(json.dumps({"type": "pong"}))

    async def send_to_room(self, room_name: str, data: dict, exclude: str = None):
        """Send message to all clients in a room."""
        if room_name not in self.rooms:
            return

        tasks = []
        for user_id in self.rooms[room_name]:
            if user_id != exclude and user_id in self.clients:
                client = self.clients[user_id]
                tasks.append(client.websocket.send(json.dumps(data)))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast(self, data: dict, exclude: str = None):
        """Broadcast to all connected clients."""
        tasks = []
        for user_id, client in self.clients.items():
            if user_id != exclude:
                tasks.append(client.websocket.send(json.dumps(data)))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def disconnect_client(self, client: Client):
        """Clean up disconnected client."""
        # Leave all rooms
        for room_name in list(client.rooms):
            await self.handle_leave_room(client, {"room": room_name})

        # Remove client
        if client.user_id in self.clients:
            del self.clients[client.user_id]

    async def start(self, host="localhost", port=8765):
        """Start the WebSocket server."""
        async with websockets.serve(self.handler, host, port):
            print(f"Server started on ws://{host}:{port}")
            await asyncio.Future()  # Run forever

# Usage

async def main(): server = WebSocketServer(secret_key="your-secret-key") await
server.start()

if **name** == "**main**": asyncio.run(main())
```

### Error Handling and Connection Pooling

Implement robust error handling and connection management:

```python
import asyncio import websockets from typing import
List, Optional from enum import Enum import random import time

class ConnectionState(Enum): DISCONNECTED = "disconnected" CONNECTING =
"connecting" CONNECTED = "connected" RECONNECTING = "reconnecting"

class ConnectionPool: """Manage multiple WebSocket connections with load
balancing."""

    def __init__(self, urls: List[str], pool_size: int = 3):
        self.urls = urls
        self.pool_size = pool_size
        self.connections: List[Optional[websockets.WebSocketClientProtocol]] = []
        self.states: List[ConnectionState] = []
        self.message_counts: List[int] = []

    async def connect(self):
        """Establish all connections in the pool."""
        tasks = []
        for i in range(self.pool_size):
            url = self.urls[i % len(self.urls)]
            tasks.append(self._connect_single(i, url))

        await asyncio.gather(*tasks, return_exceptions=True)

    async def _connect_single(self, index: int, url: str):
        """Connect a single WebSocket."""
        try:
            self.states[index] = ConnectionState.CONNECTING
            ws = await websockets.connect(url)
            self.connections[index] = ws
            self.states[index] = ConnectionState.CONNECTED
            self.message_counts[index] = 0
            return ws
        except Exception as e:
            print(f"Connection {index} failed: {e}")
            self.connections[index] = None
            self.states[index] = ConnectionState.DISCONNECTED
            return None

    async def send(self, message: str):
        """Send message using least loaded connection."""
        # Find best connection
        best_conn = None
        best_index = -1
        min_count = float('inf')

        for i, (conn, state, count) in enumerate(
            zip(self.connections, self.states, self.message_counts)
        ):
            if state == ConnectionState.CONNECTED and conn and count < min_count:
                best_conn = conn
                best_index = i
                min_count = count

        if best_conn:
            try:
                await best_conn.send(message)
                self.message_counts[best_index] += 1
                return True
            except Exception as e:
                print(f"Send failed on connection {best_index}: {e}")
                await self._handle_failed_connection(best_index)
                # Retry with different connection
                return await self.send(message)

        return False

    async def _handle_failed_connection(self, index: int):
        """Handle a failed connection."""
        self.states[index] = ConnectionState.RECONNECTING
        self.connections[index] = None

        # Schedule reconnection
        url = self.urls[index % len(self.urls)]
        asyncio.create_task(self._reconnect(index, url))

    async def _reconnect(self, index: int, url: str, max_retries: int = 5):
        """Reconnect with exponential backoff."""
        for retry in range(max_retries):
            wait_time = min(2 ** retry, 30)  # Max 30 seconds
            await asyncio.sleep(wait_time)

            print(f"Reconnecting connection {index}, attempt {retry + 1}")
            ws = await self._connect_single(index, url)
            if ws:
                print(f"Connection {index} reconnected")
                return

        print(f"Connection {index} failed after {max_retries} attempts")

    async def close_all(self):
        """Close all connections."""
        tasks = []
        for conn in self.connections:
            if conn:
                tasks.append(conn.close())

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

class RobustWebSocketClient: """WebSocket client with comprehensive error
handling."""

    def __init__(self, uri: str):
        self.uri = uri
        self.websocket: Optional[websockets.WebSocketClientProtocol] = None
        self.state = ConnectionState.DISCONNECTED
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.message_queue: List[str] = []
        self.last_ping_time = 0
        self.ping_interval = 30  # seconds

    async def connect(self):
        """Connect with timeout and error handling."""
        self.state = ConnectionState.CONNECTING

        try:
            # Connect with timeout
            self.websocket = await asyncio.wait_for(
                websockets.connect(
                    self.uri,
                    ping_interval=None,  # We'll handle pings manually
                    ping_timeout=10,
                    close_timeout=10
                ),
                timeout=10
            )

            self.state = ConnectionState.CONNECTED
            self.reconnect_attempts = 0

            # Send queued messages
            await self._flush_message_queue()

            # Start ping task
            asyncio.create_task(self._ping_loop())

            return True

        except asyncio.TimeoutError:
            print("Connection timeout")
            self.state = ConnectionState.DISCONNECTED
            return False
        except Exception as e:
            print(f"Connection error: {e}")
            self.state = ConnectionState.DISCONNECTED
            return False

    async def _ping_loop(self):
        """Send periodic pings to keep connection alive."""
        while self.state == ConnectionState.CONNECTED and self.websocket:
            try:
                await asyncio.sleep(self.ping_interval)

                if self.websocket and not self.websocket.closed:
                    pong_waiter = await self.websocket.ping()
                    await asyncio.wait_for(pong_waiter, timeout=10)
                    self.last_ping_time = time.time()

            except asyncio.TimeoutError:
                print("Ping timeout, connection may be dead")
                await self._handle_connection_loss()
                break
            except Exception as e:
                print(f"Ping error: {e}")
                await self._handle_connection_loss()
                break

    async def send(self, message: str):
        """Send message with queueing for disconnected state."""
        if self.state == ConnectionState.CONNECTED and self.websocket:
            try:
                await self.websocket.send(message)
                return True
            except Exception as e:
                print(f"Send error: {e}")
                await self._handle_connection_loss()
                # Queue message for retry
                self.message_queue.append(message)
                return False
        else:
            # Queue message for when we reconnect
            self.message_queue.append(message)
            if len(self.message_queue) > 1000:  # Prevent memory issues
                self.message_queue.pop(0)  # Remove oldest
            return False

    async def _flush_message_queue(self):
        """Send all queued messages."""
        while self.message_queue and self.websocket:
            message = self.message_queue.pop(0)
            try:
                await self.websocket.send(message)
            except Exception as e:
                print(f"Failed to send queued message: {e}")
                self.message_queue.insert(0, message)  # Put it back
                break

    async def _handle_connection_loss(self):
        """Handle unexpected disconnection."""
        self.state = ConnectionState.RECONNECTING
        if self.websocket:
            await self.websocket.close()
        self.websocket = None

        # Start reconnection
        asyncio.create_task(self._reconnect())

    async def _reconnect(self):
        """Reconnect with exponential backoff."""
        while self.reconnect_attempts < self.max_reconnect_attempts:
            wait_time = min(2 ** self.reconnect_attempts, 60)
            print(f"Reconnecting in {wait_time}s (attempt {self.reconnect_attempts + 1})")
            await asyncio.sleep(wait_time)

            self.reconnect_attempts += 1

            if await self.connect():
                print("Reconnected successfully")
                return

        print("Max reconnection attempts reached")
        self.state = ConnectionState.DISCONNECTED
```

## Django Channels

Django Channels extends Django to handle WebSockets and other async protocols.

### Installation and Setup

```bash
pip install channels channels-redis
```

Configure Django settings:

```python
# settings.py INSTALLED_APPS = [
'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
'django.contrib.sessions', 'django.contrib.messages',
'django.contrib.staticfiles', 'channels', 'your_app', ]

ASGI_APPLICATION = 'your_project.asgi.application'

# Channel layers for scaling

CHANNEL_LAYERS = { 'default': { 'BACKEND':
'channels_redis.core.RedisChannelLayer', 'CONFIG': { 'hosts': [('127.0.0.1',
6379)], 'capacity': 1500, 'expiry': 10, }, }, }

# WebSocket URL configuration

WEBSOCKET_URL = '/ws/'
```

### ASGI Configuration

```python
# asgi.py import os from django.core.asgi import
get_asgi_application from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack from channels.security.websocket
import AllowedHostsOriginValidator from your_app import routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'your_project.settings')

application = ProtocolTypeRouter({ 'http': get_asgi_application(), 'websocket':
AllowedHostsOriginValidator( AuthMiddlewareStack( URLRouter(
routing.websocket_urlpatterns ) ) ), })
```

### WebSocket Consumer

Create a WebSocket consumer:

```python
# consumers.py from channels.generic.websocket import
AsyncWebsocketConsumer from channels.db import database_sync_to_async from
django.contrib.auth.models import AnonymousUser import json

class ChatConsumer(AsyncWebsocketConsumer): async def connect(self): """Handle
WebSocket connection.""" self.room*name =
self.scope['url_route']['kwargs']['room_name'] self.room_group_name =
f'chat*{self.room_name}' self.user = self.scope['user']

        # Authentication check
        if isinstance(self.user, AnonymousUser):
            await self.close(code=4001)
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send join notification
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_join',
                'username': self.user.username
            }
        )

        # Send room history
        history = await self.get_room_history()
        await self.send(text_data=json.dumps({
            'type': 'history',
            'messages': history
        }))

    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Send leave notification
        if hasattr(self, 'user') and not isinstance(self.user, AnonymousUser):
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_leave',
                    'username': self.user.username
                }
            )

    async def receive(self, text_data):
        """Handle incoming WebSocket message."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'chat_message':
                await self.handle_chat_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
            elif message_type == 'command':
                await self.handle_command(data)
            else:
                await self.send_error('Unknown message type')

        except json.JSONDecodeError:
            await self.send_error('Invalid JSON')
        except Exception as e:
            await self.send_error(f'Error: {str(e)}')

    async def handle_chat_message(self, data):
        """Process chat message."""
        message = data.get('message', '')

        if not message:
            return

        # Save message to database
        await self.save_message(message)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': message,
                'username': self.user.username,
                'timestamp': data.get('timestamp')
            }
        )

    async def handle_typing(self, data):
        """Handle typing indicator."""
        is_typing = data.get('is_typing', False)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'username': self.user.username,
                'is_typing': is_typing
            }
        )

    async def handle_command(self, data):
        """Handle special commands."""
        command = data.get('command')

        commands = {
            'users': self.get_room_users,
            'clear': self.clear_history,
            'kick': self.kick_user,
        }

        handler = commands.get(command)
        if handler:
            await handler(data)
        else:
            await self.send_error(f'Unknown command: {command}')

    # Event handlers for group messages
    async def chat_message(self, event):
        """Send chat message to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'username': event['username'],
            'timestamp': event.get('timestamp')
        }))

    async def user_join(self, event):
        """Send user join notification."""
        await self.send(text_data=json.dumps({
            'type': 'user_joined',
            'username': event['username']
        }))

    async def user_leave(self, event):
        """Send user leave notification."""
        await self.send(text_data=json.dumps({
            'type': 'user_left',
            'username': event['username']
        }))

    async def typing_indicator(self, event):
        """Send typing indicator."""
        if event['username'] != self.user.username:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'username': event['username'],
                'is_typing': event['is_typing']
            }))

    # Database operations
    @database_sync_to_async
    def save_message(self, message):
        """Save message to database."""
        from .models import ChatMessage
        return ChatMessage.objects.create(
            room=self.room_name,
            user=self.user,
            message=message
        )

    @database_sync_to_async
    def get_room_history(self):
        """Get room message history."""
        from .models import ChatMessage
        messages = ChatMessage.objects.filter(
            room=self.room_name
        ).order_by('-created_at')[:50]

        return [
            {
                'message': msg.message,
                'username': msg.user.username,
                'timestamp': msg.created_at.isoformat()
            }
            for msg in reversed(messages)
        ]

    @database_sync_to_async
    def get_room_users(self, data):
        """Get list of users in room."""
        # Implementation depends on how you track active users
        pass

    async def send_error(self, error_message):
        """Send error message to client."""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': error_message
        }))
```

### Routing Configuration

```python
# routing.py from django.urls import re_path from .
import consumers

websocket_urlpatterns = [ re_path(r'ws/chat/(?P<room_name>\w+)/$',
consumers.ChatConsumer.as_asgi()), ]
```

### Deployment with Daphne

Deploy Django Channels with Daphne ASGI server:

```bash
# Install Daphne pip install daphne

# Run with Daphne

daphne -b 0.0.0.0 -p 8000 your_project.asgi:application

# Or with uvicorn

pip install uvicorn[standard] uvicorn your_project.asgi:application --host
0.0.0.0 --port 8000 --ws websockets
```

## FastAPI Integration

FastAPI provides native WebSocket support with modern Python features.

### Basic WebSocket Endpoint

```python
from fastapi import FastAPI, WebSocket,
WebSocketDisconnect from fastapi.middleware.cors import CORSMiddleware from
typing import Dict, Set import json

app = FastAPI()

# CORS configuration

app.add_middleware( CORSMiddleware, allow_origins=["*"], allow_credentials=True,
allow_methods=["*"], allow_headers=["*"], )

# Connection manager

class ConnectionManager: def **init**(self): self.active_connections: Dict[str,
WebSocket] = {} self.rooms: Dict[str, Set[str]] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

        # Remove from all rooms
        for room in self.rooms.values():
            room.discard(client_id)

    async def send_personal_message(self, message: str, client_id: str):
        websocket = self.active_connections.get(client_id)
        if websocket:
            await websocket.send_text(message)

    async def broadcast(self, message: str, exclude: str = None):
        for client_id, connection in self.active_connections.items():
            if client_id != exclude:
                await connection.send_text(message)

    async def join_room(self, room_id: str, client_id: str):
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(client_id)

    async def leave_room(self, room_id: str, client_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].discard(client_id)

    async def send_to_room(self, room_id: str, message: str, exclude: str = None):
        if room_id in self.rooms:
            for client_id in self.rooms[room_id]:
                if client_id != exclude and client_id in self.active_connections:
                    await self.active_connections[client_id].send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/{client_id}") async def websocket_endpoint(websocket:
WebSocket, client_id: str): await manager.connect(websocket, client_id)

    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)

            # Handle different message types
            if message['type'] == 'chat':
                await manager.broadcast(
                    json.dumps({
                        'type': 'chat',
                        'client_id': client_id,
                        'message': message['text']
                    }),
                    exclude=client_id
                )

            elif message['type'] == 'join_room':
                room_id = message['room']
                await manager.join_room(room_id, client_id)
                await manager.send_to_room(
                    room_id,
                    json.dumps({
                        'type': 'user_joined',
                        'client_id': client_id
                    })
                )

            elif message['type'] == 'room_message':
                room_id = message['room']
                await manager.send_to_room(
                    room_id,
                    json.dumps({
                        'type': 'room_message',
                        'client_id': client_id,
                        'message': message['text']
                    })
                )

    except WebSocketDisconnect:
        manager.disconnect(client_id)
        await manager.broadcast(
            json.dumps({
                'type': 'user_disconnected',
                'client_id': client_id
            })
        )
```

### Advanced FastAPI WebSocket with Dependencies

```python
from fastapi import FastAPI, WebSocket, Depends,
HTTPException, status from fastapi.security import HTTPBearer,
HTTPAuthorizationCredentials from typing import Optional import jwt from
datetime import datetime, timedelta

app = FastAPI() security = HTTPBearer()

# JWT configuration

SECRET_KEY = "your-secret-key" ALGORITHM = "HS256"

# Dependency for authentication

async def get_current_user( websocket: WebSocket, token: Optional[str] = None )
-> dict: """Extract and verify user from token.""" if not token: # Try to get
token from query params token = websocket.query_params.get("token")

    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

class WebSocketManager: """Enhanced WebSocket manager with rooms and
authentication."""

    def __init__(self):
        self.connections: Dict[str, Dict] = {}
        self.rooms: Dict[str, Set[str]] = {}
        self.user_rooms: Dict[str, Set[str]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        user: dict
    ) -> str:
        """Connect authenticated user."""
        await websocket.accept()

        connection_id = f"{user['user_id']}_{datetime.now().timestamp()}"
        self.connections[connection_id] = {
            'websocket': websocket,
            'user': user,
            'connected_at': datetime.now()
        }

        # Initialize user rooms tracking
        if user['user_id'] not in self.user_rooms:
            self.user_rooms[user['user_id']] = set()

        return connection_id

    async def disconnect(self, connection_id: str):
        """Disconnect user and cleanup."""
        if connection_id in self.connections:
            user_id = self.connections[connection_id]['user']['user_id']

            # Leave all rooms
            if user_id in self.user_rooms:
                for room in list(self.user_rooms[user_id]):
                    await self.leave_room(connection_id, room)

            # Remove connection
            del self.connections[connection_id]

    async def join_room(self, connection_id: str, room_name: str) -> bool:
        """Join a room with permission check."""
        if connection_id not in self.connections:
            return False

        user = self.connections[connection_id]['user']

        # Check room permissions (example)
        if not self.check_room_permission(user, room_name):
            return False

        # Add to room
        if room_name not in self.rooms:
            self.rooms[room_name] = set()

        self.rooms[room_name].add(connection_id)
        self.user_rooms[user['user_id']].add(room_name)

        # Notify room members
        await self.send_to_room(
            room_name,
            {
                'type': 'user_joined',
                'user': user['username'],
                'room': room_name
            },
            exclude=connection_id
        )

        return True

    async def leave_room(self, connection_id: str, room_name: str):
        """Leave a room."""
        if room_name in self.rooms:
            self.rooms[room_name].discard(connection_id)

            if connection_id in self.connections:
                user = self.connections[connection_id]['user']
                self.user_rooms[user['user_id']].discard(room_name)

                # Notify room members
                await self.send_to_room(
                    room_name,
                    {
                        'type': 'user_left',
                        'user': user['username'],
                        'room': room_name
                    }
                )

    async def send_to_room(
        self,
        room_name: str,
        message: dict,
        exclude: str = None
    ):
        """Send message to all connections in a room."""
        if room_name not in self.rooms:
            return

        disconnected = []

        for connection_id in self.rooms[room_name]:
            if connection_id != exclude and connection_id in self.connections:
                try:
                    websocket = self.connections[connection_id]['websocket']
                    await websocket.send_json(message)
                except Exception:
                    disconnected.append(connection_id)

        # Clean up disconnected clients
        for conn_id in disconnected:
            await self.disconnect(conn_id)

    def check_room_permission(self, user: dict, room_name: str) -> bool:
        """Check if user has permission to join room."""
        # Implement your permission logic
        return True

manager = WebSocketManager()

@app.websocket("/ws") async def websocket_with_auth( websocket: WebSocket, user:
dict = Depends(get_current_user) ): """Authenticated WebSocket endpoint."""
connection_id = await manager.connect(websocket, user)

    try:
        while True:
            data = await websocket.receive_json()

            # Route message types
            if data['type'] == 'join_room':
                success = await manager.join_room(
                    connection_id,
                    data['room']
                )
                await websocket.send_json({
                    'type': 'join_result',
                    'success': success,
                    'room': data['room']
                })

            elif data['type'] == 'leave_room':
                await manager.leave_room(connection_id, data['room'])

            elif data['type'] == 'room_message':
                await manager.send_to_room(
                    data['room'],
                    {
                        'type': 'message',
                        'user': user['username'],
                        'text': data['text'],
                        'timestamp': datetime.now().isoformat()
                    }
                )

    except WebSocketDisconnect:
        await manager.disconnect(connection_id)

# HTTP endpoint to get JWT token

@app.post("/token") async def login(username: str, password: str): """Get
authentication token.""" # Verify credentials (simplified) if username == "test"
and password == "test": token_data = { "user_id": "123", "username": username,
"exp": datetime.utcnow() + timedelta(hours=24) } token = jwt.encode(token_data,
SECRET_KEY, algorithm=ALGORITHM) return {"access_token": token, "token_type":
"bearer"}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials"
    )
```

## Testing WebSocket Applications

### Unit Testing with pytest

```python
import pytest import asyncio import json from
unittest.mock import AsyncMock, MagicMock import websockets

@pytest.fixture def mock_websocket(): """Create a mock WebSocket for testing."""
ws = AsyncMock() ws.send = AsyncMock() ws.recv = AsyncMock() ws.close =
AsyncMock() ws.closed = False return ws

@pytest.mark.asyncio async def test_websocket_connection(mock_websocket):
"""Test WebSocket connection handling.""" # Test connection await
mock_websocket.send(json.dumps({"type": "connect"}))
mock_websocket.send.assert_called_once()

    # Test message sending
    message = {"type": "message", "text": "Hello"}
    await mock_websocket.send(json.dumps(message))
    assert mock_websocket.send.call_count == 2

@pytest.mark.asyncio async def test_message_handler(): """Test message
processing.""" from your_module import MessageHandler

    handler = MessageHandler()

    # Test valid message
    result = await handler.process({
        "type": "chat",
        "message": "Hello World"
    })
    assert result["status"] == "success"

    # Test invalid message
    result = await handler.process({
        "type": "unknown"
    })
    assert result["status"] == "error"

@pytest.mark.asyncio async def test_broadcast(): """Test broadcasting to
multiple clients.""" from your_module import WebSocketManager

    manager = WebSocketManager()

    # Create mock clients
    clients = [AsyncMock() for _ in range(3)]
    for i, client in enumerate(clients):
        manager.connections[f"client_{i}"] = client

    # Broadcast message
    await manager.broadcast({"type": "announcement", "text": "Hello All"})

    # Verify all clients received message
    for client in clients:
        client.send.assert_called_once()

# Integration test with real WebSocket server

@pytest.mark.asyncio async def test_real_websocket_server(): """Test against
actual WebSocket server.""" # Start test server async def echo_server(websocket,
path): async for message in websocket: await websocket.send(f"Echo: {message}")

    # Start server in background
    server = await websockets.serve(echo_server, "localhost", 8765)

    try:
        # Connect client
        async with websockets.connect("ws://localhost:8765") as ws:
            # Send message
            await ws.send("Hello")

            # Receive echo
            response = await ws.recv()
            assert response == "Echo: Hello"

    finally:
        server.close()
        await server.wait_closed()
```

### Load Testing

```python
import asyncio import websockets import time import
statistics from typing import List

class LoadTester: """WebSocket load testing utility."""

    def __init__(self, url: str, num_clients: int):
        self.url = url
        self.num_clients = num_clients
        self.results = {
            'connections': [],
            'messages': [],
            'errors': []
        }

    async def client_task(self, client_id: int):
        """Individual client simulation."""
        start_time = time.time()

        try:
            async with websockets.connect(self.url) as ws:
                connect_time = time.time() - start_time
                self.results['connections'].append(connect_time)

                # Send messages
                for i in range(10):
                    msg_start = time.time()
                    await ws.send(f"Message {i} from client {client_id}")
                    response = await ws.recv()
                    msg_time = time.time() - msg_start
                    self.results['messages'].append(msg_time)

                    # Simulate think time
                    await asyncio.sleep(0.1)

        except Exception as e:
            self.results['errors'].append(str(e))

    async def run(self):
        """Run load test with all clients."""
        print(f"Starting load test with {self.num_clients} clients...")

        tasks = [
            self.client_task(i)
            for i in range(self.num_clients)
        ]

        start_time = time.time()
        await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.time() - start_time

        # Calculate statistics
        self.print_results(total_time)

    def print_results(self, total_time: float):
        """Print load test results."""
        print(f"
Load Test Results:")
        print(f"Total time: {total_time:.2f}s")
        print(f"Clients: {self.num_clients}")

        if self.results['connections']:
            print(f"
Connection times:")
            print(f"  Min: {min(self.results['connections']):.3f}s")
            print(f"  Max: {max(self.results['connections']):.3f}s")
            print(f"  Avg: {statistics.mean(self.results['connections']):.3f}s")
            print(f"  Median: {statistics.median(self.results['connections']):.3f}s")

        if self.results['messages']:
            print(f"
Message round-trip times:")
            print(f"  Min: {min(self.results['messages']):.3f}s")
            print(f"  Max: {max(self.results['messages']):.3f}s")
            print(f"  Avg: {statistics.mean(self.results['messages']):.3f}s")
            print(f"  Median: {statistics.median(self.results['messages']):.3f}s")
            print(f"  Total messages: {len(self.results['messages'])}")

        if self.results['errors']:
            print(f"
Errors: {len(self.results['errors'])}")
            for error in self.results['errors'][:5]:
                print(f"  - {error}")

# Run load test

async def main(): tester = LoadTester("ws://localhost:8765", num_clients=100)
await tester.run()

if **name** == "**main**": asyncio.run(main())
```

## Production Deployment

### Deployment Checklist

- [ ] Use WSS (WebSocket Secure) with valid SSL certificates
- [ ] Implement authentication and authorization
- [ ] Set connection and message size limits
- [ ] Configure timeouts and heartbeat intervals
- [ ] Implement rate limiting
- [ ] Set up monitoring and logging
- [ ] Configure auto-scaling
- [ ] Implement graceful shutdown
- [ ] Set up Redis or similar for horizontal scaling
- [ ] Configure reverse proxy (Nginx, HAProxy)

### Monitoring and Logging

```python
import logging import time from dataclasses import
dataclass, field from typing import Dict import json

@dataclass class WebSocketMetrics: """Track WebSocket server metrics."""
connections_total: int = 0 connections_current: int = 0 messages_sent: int = 0
messages_received: int = 0 bytes_sent: int = 0 bytes_received: int = 0 errors:
int = 0 connection_durations: List[float] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'connections_total': self.connections_total,
            'connections_current': self.connections_current,
            'messages_sent': self.messages_sent,
            'messages_received': self.messages_received,
            'bytes_sent': self.bytes_sent,
            'bytes_received': self.bytes_received,
            'errors': self.errors,
            'avg_connection_duration': (
                statistics.mean(self.connection_durations)
                if self.connection_durations else 0
            )
        }

class MonitoredWebSocketServer: """WebSocket server with monitoring."""

    def __init__(self):
        self.metrics = WebSocketMetrics()
        self.logger = self.setup_logging()

    def setup_logging(self):
        """Configure structured logging."""
        logger = logging.getLogger('websocket_server')
        logger.setLevel(logging.INFO)

        # JSON formatter for structured logs
        class JSONFormatter(logging.Formatter):
            def format(self, record):
                log_obj = {
                    'timestamp': time.time(),
                    'level': record.levelname,
                    'message': record.getMessage(),
                    'module': record.module,
                    'function': record.funcName
                }
                if hasattr(record, 'extra'):
                    log_obj.update(record.extra)
                return json.dumps(log_obj)

        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)

        return logger

    async def handle_connection(self, websocket, path):
        """Handle connection with monitoring."""
        connection_start = time.time()
        client_id = f"{websocket.remote_address}_{connection_start}"

        # Update metrics
        self.metrics.connections_total += 1
        self.metrics.connections_current += 1

        self.logger.info(
            "Connection established",
            extra={
                'client_id': client_id,
                'remote_address': str(websocket.remote_address)
            }
        )

        try:
            async for message in websocket:
                # Update metrics
                self.metrics.messages_received += 1
                self.metrics.bytes_received += len(message)

                # Process message
                response = await self.process_message(message)

                # Send response
                await websocket.send(response)
                self.metrics.messages_sent += 1
                self.metrics.bytes_sent += len(response)

        except Exception as e:
            self.metrics.errors += 1
            self.logger.error(
                "Connection error",
                extra={
                    'client_id': client_id,
                    'error': str(e)
                }
            )
        finally:
            # Update metrics
            self.metrics.connections_current -= 1
            duration = time.time() - connection_start
            self.metrics.connection_durations.append(duration)

            self.logger.info(
                "Connection closed",
                extra={
                    'client_id': client_id,
                    'duration': duration
                }
            )

    async def metrics_endpoint(self):
        """Expose metrics for monitoring systems."""
        # Prometheus format example
        return f"""# HELP websocket_connections_total Total WebSocket connections

# TYPE websocket_connections_total counter

websocket_connections_total {self.metrics.connections_total}

# HELP websocket_connections_current Current WebSocket connections

# TYPE websocket_connections_current gauge

websocket_connections_current {self.metrics.connections_current}

# HELP websocket_messages_total Total messages sent and received

# TYPE websocket_messages_total counter

websocket_messages_sent_total {self.metrics.messages_sent}
websocket_messages_received_total {self.metrics.messages_received}

# HELP websocket_bytes_total Total bytes transferred

# TYPE websocket_bytes_total counter

websocket_bytes_sent_total {self.metrics.bytes_sent}
websocket_bytes_received_total {self.metrics.bytes_received}

# HELP websocket_errors_total Total WebSocket errors

# TYPE websocket_errors_total counter

websocket_errors_total {self.metrics.errors} """
```

## Best Practices

### Security

- Always validate and sanitize input
- Implement rate limiting per connection
- Use authentication tokens with expiration
- Validate Origin headers to prevent CSWSH attacks
- Implement message size limits
- Use TLS/SSL in production

### Performance

- Use binary frames for large data
- Implement message batching
- Use compression wisely
- Pool database connections
- Implement caching where appropriate
- Monitor memory usage

### Reliability

- Implement automatic reconnection
- Use heartbeat/ping-pong mechanisms
- Handle network interruptions gracefully
- Implement message queueing for offline clients
- Use Redis or similar for scaling

## Resources

- [websockets Documentation](https://websockets.readthedocs.io/)
- [Django Channels Documentation](https://channels.readthedocs.io/)
- [FastAPI WebSocket Documentation](https://fastapi.tiangolo.com/advanced/websockets/)
- [Python asyncio Documentation](https://docs.python.org/3/library/asyncio.html)
- [Autobahn Python](https://github.com/crossbario/autobahn-python)
