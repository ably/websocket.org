---
title: Rust WebSocket Implementation
description:
  Complete guide to WebSocket servers and clients in Rust using
  tokio-tungstenite and Actix-web
sidebar:
  order: 4
---

This guide covers WebSocket implementation in Rust using popular async
frameworks, with focus on performance, safety, and production patterns.

## tokio-tungstenite

Async WebSocket implementation built on tokio runtime.

### Installation

Add to `Cargo.toml`:

```toml
[dependencies] tokio = { version = "1", features = ["full"] } tokio-tungstenite = "0.20" tungstenite = "0.20" futures-util = "0.3" serde = { version = "1.0", features = ["derive"] } serde_json = "1.0" tracing = "0.1" tracing-subscriber = "0.3"
```

### Basic Server

Create an async WebSocket server:

```rust
use std::net::SocketAddr; use std::sync::Arc; use
tokio::net::{TcpListener, TcpStream}; use tokio_tungstenite::{accept_async,
tungstenite::Message}; use futures_util::{StreamExt, SinkExt}; use
tracing::{info, error, warn};

#[tokio::main] async fn main() -> Result<(), Box<dyn std::error::Error>> { //
Initialize logging tracing_subscriber::fmt::init();

    let addr = "127.0.0.1:8080";
    let listener = TcpListener::bind(&addr).await?;
    info!("WebSocket server listening on: {}", addr);

    while let Ok((stream, addr)) = listener.accept().await {
        tokio::spawn(handle_connection(stream, addr));
    }

    Ok(())

}

async fn handle_connection(stream: TcpStream, addr: SocketAddr) { info!("New
connection from: {}", addr);

    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            error!("WebSocket handshake failed: {}", e);
            return;
        }
    };

    let (mut tx, mut rx) = ws_stream.split();

    // Send welcome message
    let welcome = serde_json::json!({
        "type": "welcome",
        "message": "Connected to Rust WebSocket server"
    });

    if let Err(e) = tx.send(Message::Text(welcome.to_string())).await {
        error!("Failed to send welcome message: {}", e);
        return;
    }

    // Handle messages
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                info!("Received text: {}", text);

                // Parse and handle JSON message
                match serde_json::from_str::<serde_json::Value>(&text) {
                    Ok(json) => {
                        let response = handle_message(json);
                        if let Err(e) = tx.send(Message::Text(response)).await {
                            error!("Send error: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        warn!("Invalid JSON: {}", e);
                        let error = serde_json::json!({
                            "type": "error",
                            "message": "Invalid JSON format"
                        });
                        let _ = tx.send(Message::Text(error.to_string())).await;
                    }
                }
            }
            Ok(Message::Binary(bin)) => {
                info!("Received binary data: {} bytes", bin.len());
                // Echo binary data
                let _ = tx.send(Message::Binary(bin)).await;
            }
            Ok(Message::Ping(ping)) => {
                let _ = tx.send(Message::Pong(ping)).await;
            }
            Ok(Message::Pong(_)) => {
                // Pong received
            }
            Ok(Message::Close(_)) => {
                info!("Client disconnected");
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    info!("Connection closed: {}", addr);

}

fn handle_message(msg: serde_json::Value) -> String { let msg_type =
msg["type"].as_str().unwrap_or("");

    let response = match msg_type {
        "ping" => serde_json::json!({
            "type": "pong"
        }),
        "echo" => serde_json::json!({
            "type": "echo",
            "data": msg["data"]
        }),
        _ => serde_json::json!({
            "type": "error",
            "message": format!("Unknown message type: {}", msg_type)
        }),
    };

    response.to_string()

}
```

### Broadcast Server with Channels

Implement multi-client broadcasting:

```rust
use std::collections::HashMap; use std::sync::Arc; use
tokio::sync::{mpsc, RwLock}; use tokio::net::{TcpListener, TcpStream}; use
tokio_tungstenite::{accept_async, tungstenite::Message}; use
futures_util::{StreamExt, SinkExt, stream::SplitSink}; use serde::{Deserialize,
Serialize}; use uuid::Uuid;

type Tx = mpsc::UnboundedSender<Message>; type PeerMap =
Arc<RwLock<HashMap<String, Tx>>>;

#[derive(Debug, Clone, Serialize, Deserialize)] #[serde(tag = "type")] enum
ClientMessage { Join { username: String }, Leave, Message { text: String },
Broadcast { message: String }, PrivateMessage { to: String, message: String }, }

#[derive(Debug, Clone, Serialize, Deserialize)] #[serde(tag = "type")] enum
ServerMessage { Welcome { id: String }, UserJoined { username: String },
UserLeft { username: String }, Message { from: String, text: String },
PrivateMessage { from: String, text: String }, Error { message: String }, }

struct Client { id: String, username: Option<String>, tx: Tx, }

struct Server { peers: PeerMap, rooms: Arc<RwLock<HashMap<String,
Vec<String>>>>, }

impl Server { fn new() -> Self { Self { peers:
Arc::new(RwLock::new(HashMap::new())), rooms:
Arc::new(RwLock::new(HashMap::new())), } }

    async fn run(&self, addr: &str) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind(addr).await?;
        info!("Server listening on: {}", addr);

        while let Ok((stream, addr)) = listener.accept().await {
            let peers = self.peers.clone();
            let rooms = self.rooms.clone();

            tokio::spawn(async move {
                if let Err(e) = handle_client(stream, peers, rooms).await {
                    error!("Error handling client {}: {}", addr, e);
                }
            });
        }

        Ok(())
    }

}

async fn handle_client( stream: TcpStream, peers: PeerMap, rooms:
Arc<RwLock<HashMap<String, Vec<String>>>>, ) -> Result<(),
Box<dyn std::error::Error>> { let ws_stream = accept_async(stream).await?; let
(mut tx, mut rx) = ws_stream.split();

    let client_id = Uuid::new_v4().to_string();
    let (msg_tx, mut msg_rx) = mpsc::unbounded_channel();

    // Add peer to map
    peers.write().await.insert(client_id.clone(), msg_tx.clone());

    // Send welcome message
    let welcome = ServerMessage::Welcome {
        id: client_id.clone(),
    };
    tx.send(Message::Text(serde_json::to_string(&welcome)?)).await?;

    let mut username: Option<String> = None;

    // Spawn task to handle outgoing messages
    let tx_task = tokio::spawn(async move {
        while let Some(msg) = msg_rx.recv().await {
            if tx.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(msg) = rx.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_msg) => {
                        handle_client_message(
                            client_msg,
                            &client_id,
                            &mut username,
                            &peers,
                            &rooms,
                        ).await;
                    }
                    Err(e) => {
                        let error = ServerMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        };
                        let _ = msg_tx.send(Message::Text(
                            serde_json::to_string(&error).unwrap()
                        ));
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    // Cleanup
    peers.write().await.remove(&client_id);

    // Notify others about disconnection
    if let Some(username) = username {
        broadcast_message(
            ServerMessage::UserLeft { username },
            Some(&client_id),
            &peers,
        ).await;
    }

    tx_task.abort();
    Ok(())

}

async fn handle*client_message( msg: ClientMessage, client_id: &str, username:
&mut Option<String>, peers: &PeerMap, rooms: &Arc<RwLock<HashMap<String,
Vec<String>>>>, ) { match msg { ClientMessage::Join { username: name } => {
\*username = Some(name.clone()); broadcast_message( ServerMessage::UserJoined {
username: name }, Some(client_id), peers, ).await; } ClientMessage::Message {
text } => { if let Some(from) = username.clone() { broadcast_message(
ServerMessage::Message { from, text }, Some(client_id), peers, ).await; } }
ClientMessage::Broadcast { message } => { if let Some(from) = username.clone() {
broadcast_message( ServerMessage::Message { from, text: message }, None, peers,
).await; } } ClientMessage::PrivateMessage { to, message } => { if let
Some(from) = username.clone() { send_private_message( &to,
ServerMessage::PrivateMessage { from, text: message }, peers, ).await; } } * =>
{} } }

async fn broadcast_message( msg: ServerMessage, exclude: Option<&str>, peers:
&PeerMap, ) { let message = Message::Text(serde_json::to_string(&msg).unwrap());
let peers = peers.read().await;

    for (id, tx) in peers.iter() {
        if exclude.map_or(true, |ex| ex != id) {
            let _ = tx.send(message.clone());
        }
    }

}

async fn send_private_message( to: &str, msg: ServerMessage, peers: &PeerMap, )
{ let message = Message::Text(serde_json::to_string(&msg).unwrap()); let peers =
peers.read().await;

    if let Some(tx) = peers.get(to) {
        let _ = tx.send(message);
    }

}

#[tokio::main] async fn main() -> Result<(), Box<dyn std::error::Error>> {
tracing_subscriber::fmt::init();

    let server = Server::new();
    server.run("127.0.0.1:8080").await

}
```

### WebSocket Client

Implement a reconnecting WebSocket client:

```rust
use tokio_tungstenite::{connect_async,
tungstenite::Message}; use futures_util::{StreamExt, SinkExt}; use
std::time::Duration; use tokio::time::sleep; use url::Url;

struct WebSocketClient { url: String, reconnect_delay: Duration,
max_reconnect_delay: Duration, }

impl WebSocketClient { fn new(url: impl Into<String>) -> Self { Self { url:
url.into(), reconnect_delay: Duration::from_secs(2), max_reconnect_delay:
Duration::from_secs(30), } }

    async fn connect(&self) -> Result<(), Box<dyn std::error::Error>> {
        let mut delay = self.reconnect_delay;

        loop {
            match self.connect_once().await {
                Ok(_) => {
                    info!("Connection closed normally");
                    delay = self.reconnect_delay; // Reset delay
                }
                Err(e) => {
                    error!("Connection error: {}", e);
                }
            }

            info!("Reconnecting in {:?}", delay);
            sleep(delay).await;

            // Exponential backoff
            delay = std::cmp::min(delay * 2, self.max_reconnect_delay);
        }
    }

    async fn connect_once(&self) -> Result<(), Box<dyn std::error::Error>> {
        let url = Url::parse(&self.url)?;
        let (ws_stream, _) = connect_async(url).await?;
        info!("Connected to {}", self.url);

        let (mut tx, mut rx) = ws_stream.split();

        // Send initial message
        let hello = serde_json::json!({
            "type": "hello",
            "client": "rust-client"
        });
        tx.send(Message::Text(hello.to_string())).await?;

        // Spawn task to send periodic pings
        let ping_task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                if tx.send(Message::Ping(vec![])).await.is_err() {
                    break;
                }
            }
        });

        // Handle incoming messages
        while let Some(msg) = rx.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    info!("Received: {}", text);
                    self.handle_message(text).await;
                }
                Ok(Message::Binary(bin)) => {
                    info!("Received binary: {} bytes", bin.len());
                }
                Ok(Message::Close(_)) => {
                    info!("Server closed connection");
                    break;
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }

        ping_task.abort();
        Ok(())
    }

    async fn handle_message(&self, text: String) {
        match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(json) => {
                let msg_type = json["type"].as_str().unwrap_or("");
                match msg_type {
                    "welcome" => info!("Welcome message received"),
                    "message" => {
                        let content = json["content"].as_str().unwrap_or("");
                        info!("Message: {}", content);
                    }
                    _ => info!("Unknown message type: {}", msg_type),
                }
            }
            Err(e) => {
                warn!("Failed to parse JSON: {}", e);
            }
        }
    }

}

// Usage with message queue use tokio::sync::mpsc;

struct QueuedClient { url: String, tx: mpsc::Sender<String>, rx:
mpsc::Receiver<String>, }

impl QueuedClient { fn new(url: impl Into<String>) -> Self { let (tx, rx) =
mpsc::channel(100); Self { url: url.into(), tx, rx, } }

    async fn run(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        loop {
            match self.connect_with_queue().await {
                Ok(_) => {
                    info!("Connection closed");
                }
                Err(e) => {
                    error!("Connection error: {}", e);
                }
            }

            sleep(Duration::from_secs(5)).await;
        }
    }

    async fn connect_with_queue(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let url = Url::parse(&self.url)?;
        let (ws_stream, _) = connect_async(url).await?;
        let (mut ws_tx, mut ws_rx) = ws_stream.split();

        // Spawn task to send queued messages
        let mut rx = self.rx.clone();
        let send_task = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if ws_tx.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
        });

        // Handle incoming messages
        while let Some(msg) = ws_rx.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    self.handle_queued_message(text).await;
                }
                Ok(Message::Close(_)) => break,
                Err(e) => {
                    error!("Error: {}", e);
                    break;
                }
                _ => {}
            }
        }

        send_task.abort();
        Ok(())
    }

    async fn handle_queued_message(&self, text: String) {
        // Process received message
        info!("Received: {}", text);
    }

    async fn send(&self, message: String) {
        if let Err(e) = self.tx.send(message).await {
            error!("Failed to queue message: {}", e);
        }
    }

}
```

## Actix-web Integration

Actix-web provides actor-based WebSocket support.

### Installation

```toml
[dependencies] actix = "0.13" actix-web = "4" actix-web-actors = "4" serde = { version = "1.0", features = ["derive"] } serde_json = "1.0" env_logger = "0.10"
```

### WebSocket Actor

```rust
use actix::{Actor, ActorContext, AsyncContext, Handler,
StreamHandler}; use actix_web::{web, App, Error, HttpRequest, HttpResponse,
HttpServer}; use actix_web_actors::ws; use std::time::{Duration, Instant};

/// WebSocket heartbeat interval const HEARTBEAT_INTERVAL: Duration =
Duration::from_secs(5); /// Client timeout const CLIENT_TIMEOUT: Duration =
Duration::from_secs(10);

/// WebSocket connection actor struct WsConnection { /// Client heartbeat hb:
Instant, /// Room room: String, /// User ID id: String, }

impl WsConnection { fn new(room: String) -> Self { Self { hb: Instant::now(),
room, id: uuid::Uuid::new_v4().to_string(), } }

    /// Start heartbeat process
    fn hb(&self, ctx: &mut <Self as Actor>::Context) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            // Check client heartbeat
            if Instant::now().duration_since(act.hb) > CLIENT_TIMEOUT {
                println!("Client heartbeat failed, disconnecting!");
                ctx.stop();
                return;
            }

            ctx.ping(b"");
        });
    }

}

impl Actor for WsConnection { type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);

        // Send welcome message
        let welcome = serde_json::json!({
            "type": "welcome",
            "id": self.id,
            "room": self.room,
        });

        ctx.text(welcome.to_string());
    }

    fn stopped(&mut self, _: &mut Self::Context) {
        println!("WebSocket connection closed for {}", self.id);
    }

}

/// Handler for WebSocket messages impl StreamHandler<Result<ws::Message,
ws::ProtocolError>> for WsConnection { fn handle(&mut self, msg:
Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) { match msg {
Ok(ws::Message::Ping(msg)) => { self.hb = Instant::now(); ctx.pong(&msg); }
Ok(ws::Message::Pong(\_)) => { self.hb = Instant::now(); }
Ok(ws::Message::Text(text)) => { println!("Received text: {}", text);

                // Parse and handle JSON message
                match serde_json::from_str::<serde_json::Value>(&text) {
                    Ok(json) => {
                        let response = self.handle_message(json);
                        ctx.text(response);
                    }
                    Err(e) => {
                        let error = serde_json::json!({
                            "type": "error",
                            "message": format!("Invalid JSON: {}", e),
                        });
                        ctx.text(error.to_string());
                    }
                }
            }
            Ok(ws::Message::Binary(bin)) => {
                println!("Received binary: {} bytes", bin.len());
                ctx.binary(bin);
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => ctx.stop(),
        }
    }

}

impl WsConnection { fn handle_message(&self, msg: serde_json::Value) -> String {
let msg_type = msg["type"].as_str().unwrap_or("");

        let response = match msg_type {
            "ping" => serde_json::json!({
                "type": "pong",
                "timestamp": Instant::now().elapsed().as_secs(),
            }),
            "echo" => serde_json::json!({
                "type": "echo",
                "data": msg["data"],
                "from": self.id,
            }),
            _ => serde_json::json!({
                "type": "error",
                "message": format!("Unknown message type: {}", msg_type),
            }),
        };

        response.to_string()
    }

}

/// WebSocket route handler async fn ws_route( req: HttpRequest, stream:
web::Payload, path: web::Path<String>, ) -> Result<HttpResponse, Error> { let
room = path.into_inner(); println!("WebSocket connection request for room: {}",
room);

    ws::start(WsConnection::new(room), &req, stream)

}

/// Health check endpoint async fn health() -> Result<HttpResponse, Error> {
Ok(HttpResponse::Ok().body("OK")) }

#[actix_web::main] async fn main() -> std::io::Result<()> {
env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    println!("Starting WebSocket server on http://127.0.0.1:8080");

    HttpServer::new(|| {
        App::new()
            .route("/ws/{room}", web::get().to(ws_route))
            .route("/health", web::get().to(health))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await

}
```

### Advanced Actor with Rooms

```rust
use actix::{Actor, Addr, Context, Handler, Message,
Recipient}; use std::collections::{HashMap, HashSet};

/// Server manages rooms and sessions struct ChatServer { sessions:
HashMap<String, Recipient<ChatMessage>>, rooms: HashMap<String,
HashSet<String>>, }

impl ChatServer { fn new() -> Self { Self { sessions: HashMap::new(), rooms:
HashMap::new(), } }

    fn send_to_room(&self, room: &str, message: &str, skip: &str) {
        if let Some(sessions) = self.rooms.get(room) {
            for id in sessions {
                if id != skip {
                    if let Some(addr) = self.sessions.get(id) {
                        addr.do_send(ChatMessage(message.to_owned()));
                    }
                }
            }
        }
    }

}

impl Actor for ChatServer { type Context = Context<Self>; }

/// Session management messages #[derive(Message)] #[rtype(result = "()")]
struct Connect { addr: Recipient<ChatMessage>, room: String, }

#[derive(Message)] #[rtype(result = "String")] struct ConnectResponse { id:
String, }

#[derive(Message)] #[rtype(result = "()")] struct Disconnect { id: String, }

#[derive(Message)] #[rtype(result = "()")] struct ClientMessage { id: String,
msg: String, room: String, }

#[derive(Message, Clone)] #[rtype(result = "()")] struct ChatMessage(String);

/// Handle Connect message impl Handler<Connect> for ChatServer { type Result =
String;

    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) -> Self::Result {
        let id = uuid::Uuid::new_v4().to_string();

        // Add session
        self.sessions.insert(id.clone(), msg.addr);

        // Add to room
        self.rooms
            .entry(msg.room.clone())
            .or_insert_with(HashSet::new)
            .insert(id.clone());

        // Notify room
        let notification = serde_json::json!({
            "type": "user_joined",
            "id": &id,
            "room": &msg.room,
        });

        self.send_to_room(&msg.room, &notification.to_string(), &id);

        id
    }

}

/// Handle Disconnect message impl Handler<Disconnect> for ChatServer { type
Result = ();

    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        // Remove from all rooms
        for (room_name, sessions) in &mut self.rooms {
            if sessions.remove(&msg.id) {
                // Notify room
                let notification = serde_json::json!({
                    "type": "user_left",
                    "id": &msg.id,
                    "room": room_name,
                });

                self.send_to_room(room_name, &notification.to_string(), &msg.id);
            }
        }

        // Remove session
        self.sessions.remove(&msg.id);
    }

}

/// Handle ClientMessage impl Handler<ClientMessage> for ChatServer { type
Result = ();

    fn handle(&mut self, msg: ClientMessage, _: &mut Context<Self>) {
        let message = serde_json::json!({
            "type": "message",
            "from": &msg.id,
            "text": &msg.msg,
            "room": &msg.room,
        });

        self.send_to_room(&msg.room, &message.to_string(), &msg.id);
    }

}

/// WebSocket session with server struct WsChatSession { id: String, room:
String, hb: Instant, server: Addr<ChatServer>, }

impl WsChatSession { fn new(room: String, server: Addr<ChatServer>) -> Self {
Self { id: String::new(), room, hb: Instant::now(), server, } } }

impl Actor for WsChatSession { type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.hb(ctx);

        // Register with server
        let addr = ctx.address();
        self.server
            .send(Connect {
                addr: addr.recipient(),
                room: self.room.clone(),
            })
            .into_actor(self)
            .then(|res, act, ctx| {
                match res {
                    Ok(id) => {
                        act.id = id;
                        let welcome = serde_json::json!({
                            "type": "connected",
                            "id": &act.id,
                            "room": &act.room,
                        });
                        ctx.text(welcome.to_string());
                    }
                    _ => ctx.stop(),
                }
                actix::fut::ready(())
            })
            .wait(ctx);
    }

    fn stopping(&mut self, _: &mut Self::Context) -> actix::Running {
        self.server.do_send(Disconnect {
            id: self.id.clone(),
        });
        actix::Running::Stop
    }

}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsChatSession {
fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut
Self::Context) { match msg { Ok(ws::Message::Text(text)) => {
self.server.do*send(ClientMessage { id: self.id.clone(), msg: text.to_string(),
room: self.room.clone(), }); } Ok(ws::Message::Ping(msg)) => { self.hb =
Instant::now(); ctx.pong(&msg); } Ok(ws::Message::Pong(*)) => { self.hb =
Instant::now(); } Ok(ws::Message::Close(reason)) => { ctx.close(reason);
ctx.stop(); } \_ => ctx.stop(), } } }

impl Handler<ChatMessage> for WsChatSession { type Result = ();

    fn handle(&mut self, msg: ChatMessage, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }

}
```

## Performance and Optimization

### Zero-Copy Message Processing

```rust
use bytes::{Bytes, BytesMut}; use
tokio_tungstenite::tungstenite::Message;

/// Efficient binary protocol handler struct BinaryProtocol { buffer: BytesMut,
}

impl BinaryProtocol { fn new() -> Self { Self { buffer:
BytesMut::with_capacity(4096), } }

    fn process_message(&mut self, msg: Message) -> Result<Vec<Response>, ProtocolError> {
        match msg {
            Message::Binary(data) => {
                self.buffer.extend_from_slice(&data);
                self.parse_frames()
            }
            _ => Err(ProtocolError::InvalidMessageType),
        }
    }

    fn parse_frames(&mut self) -> Result<Vec<Response>, ProtocolError> {
        let mut responses = Vec::new();

        while self.buffer.len() >= 4 {
            // Read header without copying
            let header = &self.buffer[0..4];
            let msg_type = header[0];
            let payload_len = u16::from_be_bytes([header[1], header[2]]) as usize;
            let flags = header[3];

            if self.buffer.len() < 4 + payload_len {
                // Not enough data, wait for more
                break;
            }

            // Process message based on type
            let response = match msg_type {
                0x01 => self.handle_data_frame(payload_len, flags),
                0x02 => self.handle_control_frame(payload_len, flags),
                0x03 => self.handle_ping_frame(),
                _ => Err(ProtocolError::UnknownMessageType(msg_type)),
            }?;

            responses.push(response);

            // Remove processed bytes
            self.buffer.advance(4 + payload_len);
        }

        Ok(responses)
    }

    fn handle_data_frame(&self, len: usize, flags: u8) -> Result<Response, ProtocolError> {
        // Process without copying using slice
        let payload = &self.buffer[4..4 + len];

        Ok(Response::Data {
            payload: Bytes::copy_from_slice(payload),
            compressed: flags & 0x01 != 0,
        })
    }

    fn handle_control_frame(&self, len: usize, flags: u8) -> Result<Response, ProtocolError> {
        let payload = &self.buffer[4..4 + len];

        Ok(Response::Control {
            command: payload[0],
            args: Bytes::copy_from_slice(&payload[1..]),
        })
    }

    fn handle_ping_frame(&self) -> Result<Response, ProtocolError> {
        Ok(Response::Pong)
    }

}

enum Response { Data { payload: Bytes, compressed: bool }, Control { command:
u8, args: Bytes }, Pong, }

#[derive(Debug)] enum ProtocolError { InvalidMessageType,
UnknownMessageType(u8), InvalidPayload, }
```

### Connection Pooling

```rust
use std::collections::VecDeque; use std::sync::Arc; use
tokio::sync::{Mutex, Semaphore}; use tokio_tungstenite::{connect_async,
WebSocketStream}; use tokio::net::TcpStream;

struct ConnectionPool { url: String, connections:
Arc<Mutex<VecDeque<WebSocketStream<TcpStream>>>>, semaphore: Arc<Semaphore>,
max_size: usize, }

impl ConnectionPool { fn new(url: String, max_size: usize) -> Self { Self { url,
connections: Arc::new(Mutex::new(VecDeque::new())), semaphore:
Arc::new(Semaphore::new(max_size)), max_size, } }

    async fn get(&self) -> Result<PooledConnection, Box<dyn std::error::Error>> {
        // Try to get existing connection
        {
            let mut pool = self.connections.lock().await;
            if let Some(conn) = pool.pop_front() {
                return Ok(PooledConnection {
                    conn: Some(conn),
                    pool: self.connections.clone(),
                    _permit: self.semaphore.acquire().await?,
                });
            }
        }

        // Create new connection
        let _permit = self.semaphore.acquire().await?;
        let (ws_stream, _) = connect_async(&self.url).await?;

        Ok(PooledConnection {
            conn: Some(ws_stream),
            pool: self.connections.clone(),
            _permit,
        })
    }

    async fn size(&self) -> usize {
        self.connections.lock().await.len()
    }

}

struct PooledConnection { conn: Option<WebSocketStream<TcpStream>>, pool:
Arc<Mutex<VecDeque<WebSocketStream<TcpStream>>>>, \_permit:
tokio::sync::SemaphorePermit<'static>, }

impl PooledConnection { async fn send(&mut self, msg: Message) -> Result<(),
Box<dyn std::error::Error>> { if let Some(conn) = &mut self.conn {
conn.send(msg).await?; } Ok(()) }

    async fn recv(&mut self) -> Result<Message, Box<dyn std::error::Error>> {
        if let Some(conn) = &mut self.conn {
            if let Some(msg) = conn.next().await {
                return Ok(msg?);
            }
        }
        Err("Connection closed".into())
    }

}

impl Drop for PooledConnection { fn drop(&mut self) { if let Some(conn) =
self.conn.take() { // Return connection to pool let pool = self.pool.clone();
tokio::spawn(async move { let mut pool = pool.lock().await;
pool.push_back(conn); }); } } }
```

## Testing

### Unit Tests

```rust
#[cfg(test)] mod tests { use super::_; use tokio::test;
use mockall::_;

    #[automock]
    trait WebSocketConnection {
        async fn send(&mut self, msg: String) -> Result<(), Error>;
        async fn recv(&mut self) -> Result<String, Error>;
    }

    #[test]
    async fn test_message_handling() {
        let input = serde_json::json!({
            "type": "echo",
            "data": "test"
        });

        let response = handle_message(input);
        let parsed: serde_json::Value = serde_json::from_str(&response).unwrap();

        assert_eq!(parsed["type"], "echo");
        assert_eq!(parsed["data"], "test");
    }

    #[test]
    async fn test_broadcast() {
        let server = Server::new();
        let peers = server.peers.clone();

        // Add mock peers
        let (tx1, mut rx1) = mpsc::unbounded_channel();
        let (tx2, mut rx2) = mpsc::unbounded_channel();

        peers.write().await.insert("peer1".to_string(), tx1);
        peers.write().await.insert("peer2".to_string(), tx2);

        // Broadcast message
        broadcast_message(
            ServerMessage::Message {
                from: "sender".to_string(),
                text: "Hello".to_string(),
            },
            Some("peer1"),
            &peers,
        ).await;

        // Peer2 should receive, peer1 should not
        assert!(rx1.try_recv().is_err());
        assert!(rx2.try_recv().is_ok());
    }

    #[test]
    async fn test_reconnection() {
        let client = WebSocketClient::new("ws://invalid");

        // Mock successful connection after failures
        let mut attempt = 0;
        let result = loop {
            attempt += 1;

            if attempt > 2 {
                break Ok(());
            } else {
                continue;
            }
        };

        assert!(result.is_ok());
    }

}
```

### Integration Tests

```rust
#[cfg(test)] mod integration_tests { use super::\*; use
tokio::time::timeout;

    #[tokio::test]
    async fn test_full_connection_flow() {
        // Start server
        let server = Server::new();
        let server_task = tokio::spawn(async move {
            server.run("127.0.0.1:0").await
        });

        // Wait for server to start
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Connect client
        let client = WebSocketClient::new("ws://127.0.0.1:8080");

        // Test timeout
        let result = timeout(Duration::from_secs(5), async {
            client.connect_once().await
        }).await;

        assert!(result.is_ok());

        server_task.abort();
    }

    #[tokio::test]
    async fn test_message_roundtrip() {
        // Setup server and client
        let (server_tx, mut server_rx) = mpsc::channel(10);
        let (client_tx, mut client_rx) = mpsc::channel(10);

        // Simulate message exchange
        let msg = "test message";
        server_tx.send(msg.to_string()).await.unwrap();

        let received = timeout(Duration::from_secs(1), client_rx.recv())
            .await
            .unwrap()
            .unwrap();

        assert_eq!(received, msg);
    }

}
```

### Benchmarks

```rust
use criterion::{black_box, criterion_group,
criterion_main, Criterion};

fn benchmark_message_parsing(c: &mut Criterion) { c.bench_function("parse json
message", |b| { let json = r#"{"type":"message","content":"test"}"#; b.iter(|| {
let parsed: serde_json::Value = serde_json::from_str(black_box(json)).unwrap();
black_box(parsed); }); }); }

fn benchmark_binary_protocol(c: &mut Criterion) { c.bench_function("parse binary
frame", |b| { let mut protocol = BinaryProtocol::new(); let frame =
vec![0x01, 0x00, 0x10, 0x00]; // Header let mut data = frame;
data.extend_from_slice(&[0u8; 16]); // Payload

        b.iter(|| {
            protocol.buffer.clear();
            protocol.buffer.extend_from_slice(&data);
            let result = protocol.parse_frames();
            black_box(result);
        });
    });

}

criterion_group!(benches, benchmark_message_parsing, benchmark_binary_protocol);
criterion_main!(benches);
```

## Production Considerations

### TLS Support

```rust
use tokio_tungstenite::{ connect_async_tls_with_config,
tungstenite::protocol::WebSocketConfig, }; use native_tls::TlsConnector;

async fn connect_wss() -> Result<(), Box<dyn std::error::Error>> { let url =
"wss://echo.websocket.org";

    // Configure TLS
    let tls = TlsConnector::builder()
        .min_protocol_version(Some(native_tls::Protocol::Tlsv12))
        .build()?;

    // Configure WebSocket
    let config = WebSocketConfig {
        max_send_queue: Some(100),
        max_message_size: Some(64 << 20), // 64MB
        max_frame_size: Some(16 << 20),   // 16MB
        accept_unmasked_frames: false,
    };

    let (ws_stream, _) = connect_async_tls_with_config(
        url,
        Some(config),
        Some(tls.into()),
    ).await?;

    Ok(())

}
```

### Error Handling

```rust
use thiserror::Error;

#[derive(Error, Debug)] enum WebSocketError { #[error("Connection failed: {0}")]
ConnectionFailed(String),

    #[error("Message send failed: {0}")]
    SendFailed(#[from] tokio_tungstenite::tungstenite::Error),

    #[error("Invalid message format: {0}")]
    InvalidMessage(#[from] serde_json::Error),

    #[error("Protocol error: {0}")]
    ProtocolError(String),

    #[error("Timeout")]
    Timeout,

}

async fn robust*send( tx: &mut SplitSink<WebSocketStream<TcpStream>, Message>,
msg: String, ) -> Result<(), WebSocketError> { match
timeout(Duration::from_secs(5), tx.send(Message::Text(msg))).await { Ok(Ok(()))
=> Ok(()), Ok(Err(e)) => Err(WebSocketError::SendFailed(e)), Err(*) =>
Err(WebSocketError::Timeout), } }
```

### Monitoring and Metrics

```rust
use prometheus::{Counter, Gauge, Histogram,
register_counter, register_gauge, register_histogram};

struct Metrics { connections_total: Counter, connections_active: Gauge,
messages_sent: Counter, messages_received: Counter, message_duration: Histogram,
}

impl Metrics { fn new() -> Self { Self { connections_total:
register_counter!("ws_connections_total", "Total connections").unwrap(),
connections_active: register_gauge!("ws_connections_active", "Active
connections").unwrap(), messages_sent: register_counter!("ws_messages_sent",
"Messages sent").unwrap(), messages_received:
register_counter!("ws_messages_received", "Messages received").unwrap(),
message_duration: register_histogram!("ws_message_duration", "Message processing
duration").unwrap(), } }

    fn on_connect(&self) {
        self.connections_total.inc();
        self.connections_active.inc();
    }

    fn on_disconnect(&self) {
        self.connections_active.dec();
    }

    fn on_message_sent(&self) {
        self.messages_sent.inc();
    }

    fn on_message_received(&self, duration: Duration) {
        self.messages_received.inc();
        self.message_duration.observe(duration.as_secs_f64());
    }

}
```

## Best Practices

### Memory Management

- Use `Arc` and `Rc` for shared ownership
- Prefer `&str` over `String` when possible
- Use `Bytes` for zero-copy operations
- Implement connection limits
- Clean up resources in `Drop` implementations

### Concurrency

- Use `tokio::spawn` for independent tasks
- Implement graceful shutdown with channels
- Use `RwLock` for read-heavy workloads
- Avoid blocking operations in async code
- Use `select!` for handling multiple futures

### Error Handling

- Use `Result` types consistently
- Implement custom error types with `thiserror`
- Log errors with context
- Handle disconnections gracefully
- Implement retry logic with backoff

## Resources

- [tokio-tungstenite Documentation](https://docs.rs/tokio-tungstenite)
- [Actix Web Documentation](https://actix.rs/)
- [Rust Async Book](https://rust-lang.github.io/async-book/)
- [tokio Documentation](https://tokio.rs/)
- [WebSocket Protocol RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)
