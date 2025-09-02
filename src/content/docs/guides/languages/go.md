---
title: Go WebSocket Implementation
description:
  Complete guide to WebSocket servers and clients in Go using Gorilla WebSocket
  and nhooyr/websocket
sidebar:
  order: 3
---

This guide covers WebSocket implementation in Go using popular libraries,
concurrent connection handling, and production patterns.

## Gorilla WebSocket

Gorilla WebSocket is the most popular and battle-tested WebSocket library for
Go.

### Installation

```bash
go get github.com/gorilla/websocket
```

### Basic Server

Create a WebSocket server with proper upgrade handling:

```go
package main

import ( "encoding/json" "log" "net/http" "github.com/gorilla/websocket" )

var upgrader = websocket.Upgrader{ ReadBufferSize: 1024, WriteBufferSize: 1024,
CheckOrigin: func(r \*http.Request) bool { // Configure origin checking for
production return true }, }

type Message struct { Type string `json:"type"` Content string `json:"content"`
Data json.RawMessage `json:"data,omitempty"` }

func handleWebSocket(w http.ResponseWriter, r \*http.Request) { // Upgrade HTTP
connection to WebSocket conn, err := upgrader.Upgrade(w, r, nil) if err != nil {
log.Printf("Failed to upgrade connection: %v", err) return } defer conn.Close()

    log.Printf("Client connected from %s", conn.RemoteAddr())

    // Send welcome message
    welcome := Message{
        Type:    "welcome",
        Content: "Connected to WebSocket server",
    }
    if err := conn.WriteJSON(welcome); err != nil {
        log.Printf("Write error: %v", err)
        return
    }

    // Read messages
    for {
        var msg Message
        err := conn.ReadJSON(&msg)
        if err != nil {
            if websocket.IsUnexpectedCloseError(err,
                websocket.CloseGoingAway,
                websocket.CloseAbnormalClosure) {
                log.Printf("WebSocket error: %v", err)
            }
            break
        }

        log.Printf("Received: %+v", msg)

        // Echo message back
        response := Message{
            Type:    "echo",
            Content: msg.Content,
        }

        if err := conn.WriteJSON(response); err != nil {
            log.Printf("Write error: %v", err)
            break
        }
    }

}

func main() { http.HandleFunc("/ws", handleWebSocket)

    log.Println("WebSocket server starting on :8080")
    if err := http.ListenAndServe(":8080", nil); err != nil {
        log.Fatal(err)
    }

}
```

### Concurrent Connection Management

Handle multiple connections with goroutines and channels:

```go
package main

import ( "encoding/json" "log" "net/http" "sync"

    "github.com/gorilla/websocket"

)

// Client represents a WebSocket client type Client struct { ID string conn
*websocket.Conn send chan []byte hub *Hub }

// Hub maintains active clients and broadcasts messages type Hub struct {
clients map[*Client]bool broadcast chan []byte register chan *Client unregister
chan *Client mu sync.RWMutex }

func NewHub() *Hub { return &Hub{ clients: make(map[*Client]bool), broadcast:
make(chan []byte), register: make(chan *Client), unregister: make(chan *Client),
} }

func (h \*Hub) Run() { for { select { case client := <-h.register: h.mu.Lock()
h.clients[client] = true h.mu.Unlock() log.Printf("Client %s registered",
client.ID)

            // Notify others about new client
            notification, _ := json.Marshal(map[string]string{
                "type": "user_joined",
                "id":   client.ID,
            })
            h.broadcastMessage(notification, client)

        case client := <-h.unregister:
            h.mu.Lock()
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
                h.mu.Unlock()

                log.Printf("Client %s unregistered", client.ID)

                // Notify others about disconnection
                notification, _ := json.Marshal(map[string]string{
                    "type": "user_left",
                    "id":   client.ID,
                })
                h.broadcastMessage(notification, nil)
            } else {
                h.mu.Unlock()
            }

        case message := <-h.broadcast:
            h.broadcastMessage(message, nil)
        }
    }

}

func (h *Hub) broadcastMessage(message []byte, exclude *Client) { h.mu.RLock()
defer h.mu.RUnlock()

    for client := range h.clients {
        if client != exclude {
            select {
            case client.send <- message:
            default:
                // Client's send channel is full, close it
                delete(h.clients, client)
                close(client.send)
            }
        }
    }

}

// Client methods func (c \*Client) ReadPump() { defer func() { c.hub.unregister
<- c c.conn.Close() }()

    c.conn.SetReadLimit(512 * 1024) // 512KB max message size

    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            if websocket.IsUnexpectedCloseError(err,
                websocket.CloseGoingAway,
                websocket.CloseAbnormalClosure) {
                log.Printf("WebSocket error: %v", err)
            }
            break
        }

        // Process message
        var msg map[string]interface{}
        if err := json.Unmarshal(message, &msg); err != nil {
            log.Printf("JSON parse error: %v", err)
            continue
        }

        // Handle different message types
        switch msg["type"] {
        case "broadcast":
            c.hub.broadcast <- message
        case "ping":
            pong, _ := json.Marshal(map[string]string{"type": "pong"})
            c.send <- pong
        default:
            // Echo to sender
            c.send <- message
        }
    }

}

func (c \*Client) WritePump() { defer c.conn.Close()

    for {
        select {
        case message, ok := <-c.send:
            if !ok {
                // Hub closed the channel
                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }

            c.conn.WriteMessage(websocket.TextMessage, message)
        }
    }

}

var hub = NewHub()

func handleConnections(w http.ResponseWriter, r \*http.Request) { conn, err :=
upgrader.Upgrade(w, r, nil) if err != nil { log.Printf("Upgrade error: %v", err)
return }

    // Get client ID from query params or generate
    clientID := r.URL.Query().Get("id")
    if clientID == "" {
        clientID = generateID()
    }

    client := &Client{
        ID:   clientID,
        conn: conn,
        send: make(chan []byte, 256),
        hub:  hub,
    }

    hub.register <- client

    // Start goroutines for reading and writing
    go client.WritePump()
    go client.ReadPump()

}

func generateID() string { // Generate unique ID (simplified) return
fmt.Sprintf("client\_%d", time.Now().UnixNano()) }

func main() { go hub.Run()

    http.HandleFunc("/ws", handleConnections)

    log.Println("Server starting on :8080")
    if err := http.ListenAndServe(":8080", nil); err != nil {
        log.Fatal(err)
    }

}
```

### Advanced Features with Rooms

Implement chat rooms and broadcasting:

```go
package main

import ( "encoding/json" "fmt" "log" "sync" "time"

    "github.com/gorilla/websocket"

)

// Room represents a chat room type Room struct { ID string Name string clients
map[*Client]bool mu sync.RWMutex }

// Enhanced Hub with room support type EnhancedHub struct { clients
map[string]*Client rooms map[string]*Room broadcast chan BroadcastMessage
register chan *Client unregister chan *Client mu sync.RWMutex }

type BroadcastMessage struct { Room string Message []byte Sender \*Client }

func NewEnhancedHub() *EnhancedHub { return &EnhancedHub{ clients:
make(map[string]*Client), rooms: make(map[string]*Room), broadcast: make(chan
BroadcastMessage), register: make(chan *Client), unregister: make(chan
\*Client), } }

func (h _EnhancedHub) Run() { // Periodic cleanup ticker := time.NewTicker(30 _
time.Second) defer ticker.Stop()

    for {
        select {
        case client := <-h.register:
            h.mu.Lock()
            h.clients[client.ID] = client
            h.mu.Unlock()
            log.Printf("Client %s connected", client.ID)

        case client := <-h.unregister:
            h.mu.Lock()
            if _, ok := h.clients[client.ID]; ok {
                // Leave all rooms
                for roomID := range client.rooms {
                    if room, exists := h.rooms[roomID]; exists {
                        room.RemoveClient(client)
                    }
                }

                delete(h.clients, client.ID)
                close(client.send)
            }
            h.mu.Unlock()
            log.Printf("Client %s disconnected", client.ID)

        case msg := <-h.broadcast:
            h.handleBroadcast(msg)

        case <-ticker.C:
            h.cleanup()
        }
    }

}

func (h \*EnhancedHub) handleBroadcast(msg BroadcastMessage) { if msg.Room == ""
{ // Global broadcast h.mu.RLock() defer h.mu.RUnlock()

        for _, client := range h.clients {
            if client != msg.Sender {
                select {
                case client.send <- msg.Message:
                default:
                    // Client buffer full
                    go h.removeClient(client)
                }
            }
        }
    } else {
        // Room broadcast
        h.mu.RLock()
        room, exists := h.rooms[msg.Room]
        h.mu.RUnlock()

        if exists {
            room.Broadcast(msg.Message, msg.Sender)
        }
    }

}

func (h *EnhancedHub) JoinRoom(client *Client, roomID string) error {
h.mu.Lock() room, exists := h.rooms[roomID] if !exists { room = &Room{ ID:
roomID, Name: roomID, clients: make(map[*Client]bool), } h.rooms[roomID] = room
} h.mu.Unlock()

    room.AddClient(client)
    client.rooms[roomID] = true

    // Notify room members
    notification, _ := json.Marshal(map[string]interface{}{
        "type":   "user_joined_room",
        "room":   roomID,
        "userId": client.ID,
    })

    room.Broadcast(notification, client)

    // Send room info to client
    roomInfo, _ := json.Marshal(map[string]interface{}{
        "type":    "room_joined",
        "room":    roomID,
        "members": room.GetMemberIDs(),
    })

    client.send <- roomInfo

    return nil

}

func (h *EnhancedHub) LeaveRoom(client *Client, roomID string) { h.mu.RLock()
room, exists := h.rooms[roomID] h.mu.RUnlock()

    if !exists {
        return
    }

    room.RemoveClient(client)
    delete(client.rooms, roomID)

    // Notify room members
    notification, _ := json.Marshal(map[string]interface{}{
        "type":   "user_left_room",
        "room":   roomID,
        "userId": client.ID,
    })

    room.Broadcast(notification, nil)

    // Delete empty room
    if room.IsEmpty() {
        h.mu.Lock()
        delete(h.rooms, roomID)
        h.mu.Unlock()
    }

}

func (r *Room) AddClient(client *Client) { r.mu.Lock() defer r.mu.Unlock()
r.clients[client] = true }

func (r *Room) RemoveClient(client *Client) { r.mu.Lock() defer r.mu.Unlock()
delete(r.clients, client) }

func (r *Room) Broadcast(message []byte, exclude *Client) { r.mu.RLock() defer
r.mu.RUnlock()

    for client := range r.clients {
        if client != exclude {
            select {
            case client.send <- message:
            default:
                // Buffer full, skip
            }
        }
    }

}

func (r \*Room) GetMemberIDs() []string { r.mu.RLock() defer r.mu.RUnlock()

    members := make([]string, 0, len(r.clients))
    for client := range r.clients {
        members = append(members, client.ID)
    }
    return members

}

func (r \*Room) IsEmpty() bool { r.mu.RLock() defer r.mu.RUnlock() return
len(r.clients) == 0 }

// Enhanced Client with room support type EnhancedClient struct { ID string conn
*websocket.Conn send chan []byte hub *EnhancedHub rooms map[string]bool mu
sync.RWMutex }

func (c \*EnhancedClient) HandleMessage(message []byte) { var msg
map[string]interface{} if err := json.Unmarshal(message, &msg); err != nil {
c.sendError("Invalid message format") return }

    switch msg["type"] {
    case "join_room":
        if roomID, ok := msg["room"].(string); ok {
            if err := c.hub.JoinRoom(c, roomID); err != nil {
                c.sendError(fmt.Sprintf("Failed to join room: %v", err))
            }
        }

    case "leave_room":
        if roomID, ok := msg["room"].(string); ok {
            c.hub.LeaveRoom(c, roomID)
        }

    case "room_message":
        if roomID, ok := msg["room"].(string); ok {
            if _, inRoom := c.rooms[roomID]; inRoom {
                c.hub.broadcast <- BroadcastMessage{
                    Room:    roomID,
                    Message: message,
                    Sender:  c,
                }
            } else {
                c.sendError("Not in room")
            }
        }

    case "private_message":
        if targetID, ok := msg["to"].(string); ok {
            c.sendPrivateMessage(targetID, message)
        }

    default:
        // Global broadcast
        c.hub.broadcast <- BroadcastMessage{
            Message: message,
            Sender:  c,
        }
    }

}

func (c \*EnhancedClient) sendError(err string) { errMsg, \_ :=
json.Marshal(map[string]string{ "type": "error", "error": err, }) c.send <-
errMsg }

func (c \*EnhancedClient) sendPrivateMessage(targetID string, message []byte) {
c.hub.mu.RLock() target, exists := c.hub.clients[targetID] c.hub.mu.RUnlock()

    if exists {
        target.send <- message
    } else {
        c.sendError("User not found")
    }

}
```

### Client Implementation

WebSocket client with reconnection:

```go
package main

import ( "encoding/json" "fmt" "log" "net/url" "sync" "time"

    "github.com/gorilla/websocket"

)

type WebSocketClient struct { URL string conn \*websocket.Conn send chan []byte
receive chan []byte done chan struct{} reconnect bool reconnectDelay
time.Duration maxReconnect time.Duration mu sync.Mutex }

func NewWebSocketClient(serverURL string) _WebSocketClient { return
&WebSocketClient{ URL: serverURL, send: make(chan []byte, 100), receive:
make(chan []byte, 100), done: make(chan struct{}), reconnect: true,
reconnectDelay: 2 _ time.Second, maxReconnect: 30 \* time.Second, } }

func (c \*WebSocketClient) Connect() error { u, err := url.Parse(c.URL) if err
!= nil { return err }

    log.Printf("Connecting to %s", u.String())

    conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
    if err != nil {
        return err
    }

    c.mu.Lock()
    c.conn = conn
    c.mu.Unlock()

    log.Println("Connected successfully")

    // Start read and write pumps
    go c.readPump()
    go c.writePump()

    return nil

}

func (c \*WebSocketClient) readPump() { defer func() { c.mu.Lock() if c.conn !=
nil { c.conn.Close() c.conn = nil } c.mu.Unlock()

        if c.reconnect {
            go c.reconnectLoop()
        }
    }()

    c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    c.conn.SetPongHandler(func(string) error {
        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        return nil
    })

    for {
        _, message, err := c.conn.ReadMessage()
        if err != nil {
            if websocket.IsUnexpectedCloseError(err,
                websocket.CloseGoingAway,
                websocket.CloseAbnormalClosure) {
                log.Printf("WebSocket error: %v", err)
            }
            return
        }

        select {
        case c.receive <- message:
        case <-c.done:
            return
        }
    }

}

func (c _WebSocketClient) writePump() { ticker := time.NewTicker(54 _
time.Second) defer func() { ticker.Stop() c.mu.Lock() if c.conn != nil {
c.conn.Close() } c.mu.Unlock() }()

    for {
        select {
        case message, ok := <-c.send:
            c.mu.Lock()
            conn := c.conn
            c.mu.Unlock()

            if conn == nil {
                return
            }

            conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if !ok {
                conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }

            if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
                log.Printf("Write error: %v", err)
                return
            }

        case <-ticker.C:
            c.mu.Lock()
            conn := c.conn
            c.mu.Unlock()

            if conn == nil {
                return
            }

            conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
            if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                return
            }

        case <-c.done:
            return
        }
    }

}

func (c \*WebSocketClient) reconnectLoop() { delay := c.reconnectDelay

    for c.reconnect {
        log.Printf("Reconnecting in %v...", delay)
        time.Sleep(delay)

        if err := c.Connect(); err != nil {
            log.Printf("Reconnection failed: %v", err)

            // Exponential backoff
            delay *= 2
            if delay > c.maxReconnect {
                delay = c.maxReconnect
            }
        } else {
            return
        }
    }

}

func (c \*WebSocketClient) Send(message interface{}) error { data, err :=
json.Marshal(message) if err != nil { return err }

    select {
    case c.send <- data:
        return nil
    case <-time.After(5 * time.Second):
        return fmt.Errorf("send timeout")
    }

}

func (c _WebSocketClient) Receive() ([]byte, error) { select { case message :=
<-c.receive: return message, nil case <-time.After(30 _ time.Second): return
nil, fmt.Errorf("receive timeout") } }

func (c \*WebSocketClient) Close() { c.reconnect = false close(c.done)

    c.mu.Lock()
    if c.conn != nil {
        c.conn.Close()
    }
    c.mu.Unlock()

}

// Usage example func main() { client :=
NewWebSocketClient("ws://localhost:8080/ws")

    if err := client.Connect(); err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    // Send messages
    go func() {
        for i := 0; i < 10; i++ {
            msg := map[string]interface{}{
                "type":    "message",
                "content": fmt.Sprintf("Hello %d", i),
            }

            if err := client.Send(msg); err != nil {
                log.Printf("Send error: %v", err)
            }

            time.Sleep(2 * time.Second)
        }
    }()

    // Receive messages
    for {
        message, err := client.Receive()
        if err != nil {
            log.Printf("Receive error: %v", err)
            continue
        }

        var msg map[string]interface{}
        if err := json.Unmarshal(message, &msg); err != nil {
            log.Printf("Parse error: %v", err)
            continue
        }

        log.Printf("Received: %+v", msg)
    }

}
```

## nhooyr/websocket

A modern, idiomatic WebSocket library for Go with context support.

### Installation

```bash
go get nhooyr.io/websocket
```

### Modern Server Implementation

```go
package main

import ( "context" "encoding/json" "fmt" "log" "net/http" "time"

    "nhooyr.io/websocket"
    "nhooyr.io/websocket/wsjson"

)

type Server struct { // Server state }

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { conn, err
:= websocket.Accept(w, r, &websocket.AcceptOptions{ OriginPatterns:
[]string{"\*"}, // Configure for production CompressionMode:
websocket.CompressionContextTakeover, }) if err != nil { log.Printf("Failed to
accept WebSocket: %v", err) return } defer
conn.Close(websocket.StatusInternalError, "Internal error")

    ctx := r.Context()

    // Handle connection with context
    if err := s.handleConnection(ctx, conn); err != nil {
        log.Printf("Connection error: %v", err)
        return
    }

    conn.Close(websocket.StatusNormalClosure, "")

}

func (s *Server) handleConnection(ctx context.Context, conn *websocket.Conn)
error { // Set connection limits conn.SetReadLimit(32768) // 32KB

    // Send welcome message
    welcome := map[string]string{
        "type":    "welcome",
        "message": "Connected to modern WebSocket server",
    }

    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()

    if err := wsjson.Write(ctx, conn, welcome); err != nil {
        return fmt.Errorf("failed to send welcome: %w", err)
    }

    // Message loop
    for {
        var msg map[string]interface{}

        // Read with timeout
        ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
        err := wsjson.Read(ctx, conn, &msg)
        cancel()

        if err != nil {
            if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
                return nil
            }
            return fmt.Errorf("read error: %w", err)
        }

        // Process message
        response, err := s.processMessage(msg)
        if err != nil {
            response = map[string]string{
                "type":  "error",
                "error": err.Error(),
            }
        }

        // Write response
        ctx, cancel = context.WithTimeout(ctx, 5*time.Second)
        err = wsjson.Write(ctx, conn, response)
        cancel()

        if err != nil {
            return fmt.Errorf("write error: %w", err)
        }
    }

}

func (s \*Server) processMessage(msg map[string]interface{}) (interface{},
error) { msgType, ok := msg["type"].(string) if !ok { return nil,
fmt.Errorf("missing message type") }

    switch msgType {
    case "ping":
        return map[string]string{"type": "pong"}, nil

    case "echo":
        return map[string]interface{}{
            "type": "echo",
            "data": msg["data"],
        }, nil

    default:
        return nil, fmt.Errorf("unknown message type: %s", msgType)
    }

}

// Broadcast server with pub/sub type BroadcastServer struct { subscribers
map[*subscriber]bool subscribe chan *subscriber unsubscribe chan *subscriber
broadcast chan []byte }

type subscriber struct { conn \*websocket.Conn messages chan []byte done chan
struct{} }

func NewBroadcastServer() *BroadcastServer { bs := &BroadcastServer{
subscribers: make(map[*subscriber]bool), subscribe: make(chan *subscriber),
unsubscribe: make(chan *subscriber), broadcast: make(chan []byte), }

    go bs.run()
    return bs

}

func (bs \*BroadcastServer) run() { for { select { case sub := <-bs.subscribe:
bs.subscribers[sub] = true log.Printf("Subscriber added, total: %d",
len(bs.subscribers))

        case sub := <-bs.unsubscribe:
            if _, ok := bs.subscribers[sub]; ok {
                delete(bs.subscribers, sub)
                close(sub.messages)
                log.Printf("Subscriber removed, total: %d", len(bs.subscribers))
            }

        case msg := <-bs.broadcast:
            for sub := range bs.subscribers {
                select {
                case sub.messages <- msg:
                default:
                    // Subscriber slow, skip
                }
            }
        }
    }

}

func (bs *BroadcastServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
conn, err := websocket.Accept(w, r, nil) if err != nil { log.Printf("Accept
error: %v", err) return } defer conn.Close(websocket.StatusInternalError, "")

    sub := &subscriber{
        conn:     conn,
        messages: make(chan []byte, 16),
        done:     make(chan struct{}),
    }

    bs.subscribe <- sub
    defer func() {
        bs.unsubscribe <- sub
    }()

    ctx := r.Context()

    // Start writer
    go sub.writer(ctx)

    // Read messages
    for {
        _, msg, err := conn.Read(ctx)
        if err != nil {
            if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
                return
            }
            log.Printf("Read error: %v", err)
            return
        }

        // Broadcast to all subscribers
        bs.broadcast <- msg
    }

}

func (sub _subscriber) writer(ctx context.Context) { ticker := time.NewTicker(54
_ time.Second) defer ticker.Stop()

    for {
        select {
        case msg := <-sub.messages:
            ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
            err := sub.conn.Write(ctx, websocket.MessageText, msg)
            cancel()

            if err != nil {
                return
            }

        case <-ticker.C:
            ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
            err := sub.conn.Ping(ctx)
            cancel()

            if err != nil {
                return
            }

        case <-sub.done:
            return
        }
    }

}

func main() { // Simple server simpleServer := &Server{} http.Handle("/ws",
simpleServer)

    // Broadcast server
    broadcastServer := NewBroadcastServer()
    http.Handle("/broadcast", broadcastServer)

    log.Println("Server starting on :8080")
    if err := http.ListenAndServe(":8080", nil); err != nil {
        log.Fatal(err)
    }

}
```

### Zero-Copy Operations

Optimize performance with zero-copy reads:

```go
package main

import ( "context" "io" "log" "net/http"

    "nhooyr.io/websocket"

)

// Binary protocol handler with zero-copy type BinaryHandler struct { // Handler
state }

func (h *BinaryHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{ CompressionMode:
websocket.CompressionDisabled, // Disable for binary }) if err != nil { return }
defer conn.Close(websocket.StatusInternalError, "")

    ctx := r.Context()

    for {
        // Zero-copy read
        typ, reader, err := conn.Reader(ctx)
        if err != nil {
            if websocket.CloseStatus(err) == websocket.StatusNormalClosure {
                return
            }
            log.Printf("Read error: %v", err)
            return
        }

        if typ != websocket.MessageBinary {
            conn.Close(websocket.StatusUnsupportedData, "Expected binary data")
            return
        }

        // Process binary stream without copying
        if err := h.processBinaryStream(ctx, conn, reader); err != nil {
            log.Printf("Process error: %v", err)
            return
        }
    }

}

func (h *BinaryHandler) processBinaryStream( ctx context.Context, conn
*websocket.Conn, reader io.Reader, ) error { // Read header (example: 4 bytes)
header := make([]byte, 4) if \_, err := io.ReadFull(reader, header); err != nil
{ return err }

    // Parse message type and length
    msgType := header[0]
    length := int(header[1])<<16 | int(header[2])<<8 | int(header[3])

    // Process based on type
    switch msgType {
    case 0x01: // Data message
        // Stream processing without loading all into memory
        writer, err := conn.Writer(ctx, websocket.MessageBinary)
        if err != nil {
            return err
        }
        defer writer.Close()

        // Write response header
        responseHeader := []byte{0x02, byte(length >> 16), byte(length >> 8), byte(length)}
        if _, err := writer.Write(responseHeader); err != nil {
            return err
        }

        // Stream copy
        if _, err := io.CopyN(writer, reader, int64(length)); err != nil {
            return err
        }

    case 0x02: // Control message
        // Read control data
        control := make([]byte, length)
        if _, err := io.ReadFull(reader, control); err != nil {
            return err
        }

        // Process control message
        response := h.processControl(control)

        // Send response
        if err := conn.Write(ctx, websocket.MessageBinary, response); err != nil {
            return err
        }
    }

    return nil

}

func (h \*BinaryHandler) processControl(data []byte) []byte { // Process control
message return []byte{0x00} // ACK }
```

## Performance Optimization

### Connection Pooling

```go
package main

import ( "sync" "time"

    "github.com/gorilla/websocket"

)

type ConnectionPool struct { urls []string connections []*PooledConnection
available chan *PooledConnection mu sync.Mutex maxSize int maxIdleTime
time.Duration }

type PooledConnection struct { conn \*websocket.Conn url string lastUsed
time.Time inUse bool }

func NewConnectionPool(urls []string, maxSize int) *ConnectionPool { pool :=
&ConnectionPool{ urls: urls, connections: make([]*PooledConnection, 0, maxSize),
available: make(chan _PooledConnection, maxSize), maxSize: maxSize, maxIdleTime:
5 _ time.Minute, }

    // Start cleanup routine
    go pool.cleanup()

    return pool

}

func (p *ConnectionPool) Get() (*PooledConnection, error) { // Try to get
available connection select { case conn := <-p.available: if conn.isValid() {
conn.inUse = true conn.lastUsed = time.Now() return conn, nil } // Connection
invalid, close it conn.Close()

    default:
        // No available connections
    }

    // Create new connection if under limit
    p.mu.Lock()
    if len(p.connections) < p.maxSize {
        p.mu.Unlock()
        return p.createConnection()
    }
    p.mu.Unlock()

    // Wait for available connection
    conn := <-p.available
    conn.inUse = true
    conn.lastUsed = time.Now()
    return conn, nil

}

func (p *ConnectionPool) Return(conn *PooledConnection) { if conn == nil ||
!conn.isValid() { if conn != nil { conn.Close() } return }

    conn.inUse = false
    conn.lastUsed = time.Now()

    select {
    case p.available <- conn:
        // Returned to pool
    default:
        // Pool full, close connection
        conn.Close()
    }

}

func (p *ConnectionPool) createConnection() (*PooledConnection, error) { //
Round-robin URL selection url := p.urls[len(p.connections)%len(p.urls)]

    dialer := websocket.Dialer{
        HandshakeTimeout: 10 * time.Second,
        ReadBufferSize:   1024,
        WriteBufferSize:  1024,
    }

    conn, _, err := dialer.Dial(url, nil)
    if err != nil {
        return nil, err
    }

    pooled := &PooledConnection{
        conn:     conn,
        url:      url,
        lastUsed: time.Now(),
        inUse:    true,
    }

    p.mu.Lock()
    p.connections = append(p.connections, pooled)
    p.mu.Unlock()

    return pooled, nil

}

func (p _ConnectionPool) cleanup() { ticker := time.NewTicker(1 _ time.Minute)
defer ticker.Stop()

    for range ticker.C {
        p.mu.Lock()
        now := time.Now()

        for i := len(p.connections) - 1; i >= 0; i-- {
            conn := p.connections[i]

            if !conn.inUse && now.Sub(conn.lastUsed) > p.maxIdleTime {
                conn.Close()
                p.connections = append(p.connections[:i], p.connections[i+1:]...)
            }
        }
        p.mu.Unlock()
    }

}

func (pc \*PooledConnection) isValid() bool { if pc.conn == nil { return false }

    // Send ping to check connection
    pc.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
    err := pc.conn.WriteMessage(websocket.PingMessage, nil)
    return err == nil

}

func (pc \*PooledConnection) Close() { if pc.conn != nil { pc.conn.Close()
pc.conn = nil } }
```

### Benchmarking

```go
package main

import ( "fmt" "sync" "sync/atomic" "testing" "time"

    "github.com/gorilla/websocket"

)

func BenchmarkWebSocketThroughput(b \*testing.B) { // Start test server server
:= startTestServer() defer server.Close()

    // Connect client
    conn, _, err := websocket.DefaultDialer.Dial(server.URL, nil)
    if err != nil {
        b.Fatal(err)
    }
    defer conn.Close()

    message := []byte("benchmark message")

    b.ResetTimer()
    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            // Write message
            if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
                b.Error(err)
            }

            // Read response
            _, _, err := conn.ReadMessage()
            if err != nil {
                b.Error(err)
            }
        }
    })

}

func BenchmarkConcurrentConnections(b \*testing.B) { server := startTestServer()
defer server.Close()

    b.RunParallel(func(pb *testing.PB) {
        for pb.Next() {
            conn, _, err := websocket.DefaultDialer.Dial(server.URL, nil)
            if err != nil {
                b.Error(err)
                continue
            }

            // Send/receive one message
            conn.WriteMessage(websocket.TextMessage, []byte("test"))
            conn.ReadMessage()

            conn.Close()
        }
    })

}

// Load test func LoadTest(url string, numClients int, duration time.Duration) {
var ( connected int64 messages int64 errors int64 totalBytes int64 )

    startTime := time.Now()
    wg := sync.WaitGroup{}

    for i := 0; i < numClients; i++ {
        wg.Add(1)
        go func(clientID int) {
            defer wg.Done()

            conn, _, err := websocket.DefaultDialer.Dial(url, nil)
            if err != nil {
                atomic.AddInt64(&errors, 1)
                return
            }
            defer conn.Close()

            atomic.AddInt64(&connected, 1)

            message := []byte(fmt.Sprintf("Client %d message", clientID))

            for time.Since(startTime) < duration {
                // Send message
                if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
                    atomic.AddInt64(&errors, 1)
                    break
                }

                // Read response
                _, data, err := conn.ReadMessage()
                if err != nil {
                    atomic.AddInt64(&errors, 1)
                    break
                }

                atomic.AddInt64(&messages, 1)
                atomic.AddInt64(&totalBytes, int64(len(data)))

                time.Sleep(100 * time.Millisecond) // Simulate real usage
            }
        }(i)
    }

    wg.Wait()

    elapsed := time.Since(startTime)

    fmt.Printf("Load Test Results:
")
    fmt.Printf("Duration: %v
", elapsed)
    fmt.Printf("Clients: %d
", numClients)
    fmt.Printf("Connected: %d
", connected)
    fmt.Printf("Messages: %d
", messages)
    fmt.Printf("Errors: %d
", errors)
    fmt.Printf("Total Bytes: %d
", totalBytes)
    fmt.Printf("Messages/sec: %.2f
", float64(messages)/elapsed.Seconds())
    fmt.Printf("Bytes/sec: %.2f
", float64(totalBytes)/elapsed.Seconds())

}
```

## Testing

### Unit Testing

```go
package main

import ( "encoding/json" "net/http" "net/http/httptest" "strings" "testing"
"time"

    "github.com/gorilla/websocket"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"

)

func TestWebSocketConnection(t \*testing.T) { // Create test server server :=
httptest.NewServer(http.HandlerFunc(handleWebSocket)) defer server.Close()

    // Convert http:// to ws://
    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

    // Connect
    conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
    require.NoError(t, err)
    defer conn.Close()

    // Test welcome message
    var welcome map[string]string
    err = conn.ReadJSON(&welcome)
    require.NoError(t, err)
    assert.Equal(t, "welcome", welcome["type"])

}

func TestMessageEcho(t \*testing.T) { server :=
httptest.NewServer(http.HandlerFunc(handleWebSocket)) defer server.Close()

    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
    conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
    require.NoError(t, err)
    defer conn.Close()

    // Skip welcome message
    conn.ReadMessage()

    // Send test message
    testMsg := map[string]string{
        "type":    "echo",
        "content": "test message",
    }

    err = conn.WriteJSON(testMsg)
    require.NoError(t, err)

    // Read echo response
    var response map[string]string
    err = conn.ReadJSON(&response)
    require.NoError(t, err)

    assert.Equal(t, "echo", response["type"])
    assert.Equal(t, "test message", response["content"])

}

func TestConcurrentMessages(t \*testing.T) { server :=
httptest.NewServer(http.HandlerFunc(handleWebSocket)) defer server.Close()

    wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"

    numClients := 10
    done := make(chan bool, numClients)

    for i := 0; i < numClients; i++ {
        go func(id int) {
            conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
            assert.NoError(t, err)
            defer conn.Close()

            // Send message
            msg := map[string]interface{}{
                "type": "test",
                "id":   id,
            }

            err = conn.WriteJSON(msg)
            assert.NoError(t, err)

            // Read response
            var response map[string]interface{}
            err = conn.ReadJSON(&response)
            assert.NoError(t, err)

            done <- true
        }(i)
    }

    // Wait for all clients
    for i := 0; i < numClients; i++ {
        select {
        case <-done:
            // Success
        case <-time.After(5 * time.Second):
            t.Fatal("Timeout waiting for clients")
        }
    }

}

// Test with mock WebSocket type MockWebSocket struct { messages [][]byte closed
bool }

func (m \*MockWebSocket) WriteMessage(messageType int, data []byte) error {
m.messages = append(m.messages, data) return nil }

func (m \*MockWebSocket) Close() error { m.closed = true return nil }

func TestBroadcastLogic(t \*testing.T) { hub := NewHub()

    // Create mock clients
    mockClients := make([]*MockWebSocket, 3)
    for i := range mockClients {
        mockClients[i] = &MockWebSocket{}
        // Add to hub (simplified)
    }

    // Test broadcast
    message := []byte(`{"type":"broadcast","message":"test"}`)
    hub.broadcast <- message

    // Verify all clients received message
    time.Sleep(100 * time.Millisecond) // Wait for processing

    for _, mock := range mockClients {
        assert.Len(t, mock.messages, 1)
        assert.Equal(t, message, mock.messages[0])
    }

}
```

## Production Deployment

### Graceful Shutdown

```go
package main

import ( "context" "log" "net/http" "os" "os/signal" "sync" "syscall" "time"

    "github.com/gorilla/websocket"

)

type GracefulServer struct { server *http.Server hub *Hub connections sync.Map
// thread-safe map shutdownCh chan struct{} }

func NewGracefulServer(addr string) \*GracefulServer { gs := &GracefulServer{
hub: NewHub(), shutdownCh: make(chan struct{}), }

    mux := http.NewServeMux()
    mux.HandleFunc("/ws", gs.handleWebSocket)
    mux.HandleFunc("/health", gs.healthCheck)

    gs.server = &http.Server{
        Addr:           addr,
        Handler:        mux,
        ReadTimeout:    15 * time.Second,
        WriteTimeout:   15 * time.Second,
        IdleTimeout:    60 * time.Second,
        MaxHeaderBytes: 1 << 20, // 1MB
    }

    return gs

}

func (gs \*GracefulServer) Start() error { // Start hub go gs.hub.Run()

    // Setup signal handling
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

    go func() {
        <-sigChan
        log.Println("Shutdown signal received")
        gs.Shutdown()
    }()

    log.Printf("Server starting on %s", gs.server.Addr)
    return gs.server.ListenAndServe()

}

func (gs \*GracefulServer) Shutdown() { log.Println("Starting graceful
shutdown...")

    // Signal shutdown
    close(gs.shutdownCh)

    // Stop accepting new connections
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // Notify all clients
    gs.notifyShutdown()

    // Wait for connections to close
    done := make(chan struct{})
    go func() {
        gs.waitForConnections()
        close(done)
    }()

    select {
    case <-done:
        log.Println("All connections closed")
    case <-ctx.Done():
        log.Println("Shutdown timeout, forcing close")
        gs.forceCloseConnections()
    }

    // Shutdown HTTP server
    if err := gs.server.Shutdown(ctx); err != nil {
        log.Printf("Server shutdown error: %v", err)
    }

    log.Println("Server stopped")

}

func (gs \*GracefulServer) notifyShutdown() { message := map[string]string{
"type": "server_shutdown", "message": "Server is shutting down", }

    data, _ := json.Marshal(message)

    gs.connections.Range(func(key, value interface{}) bool {
        if conn, ok := value.(*websocket.Conn); ok {
            conn.WriteMessage(websocket.TextMessage, data)
            conn.WriteMessage(
                websocket.CloseMessage,
                websocket.FormatCloseMessage(websocket.CloseGoingAway, "Server shutdown"),
            )
        }
        return true
    })

}

func (gs _GracefulServer) waitForConnections() { ticker := time.NewTicker(1 _
time.Second) defer ticker.Stop()

    timeout := time.After(25 * time.Second)

    for {
        select {
        case <-ticker.C:
            count := 0
            gs.connections.Range(func(_, _ interface{}) bool {
                count++
                return true
            })

            if count == 0 {
                return
            }

            log.Printf("Waiting for %d connections to close", count)

        case <-timeout:
            return
        }
    }

}

func (gs *GracefulServer) forceCloseConnections() {
gs.connections.Range(func(key, value interface{}) bool { if conn, ok :=
value.(*websocket.Conn); ok { conn.Close() } gs.connections.Delete(key) return
true }) }

func (gs *GracefulServer) healthCheck(w http.ResponseWriter, r *http.Request) {
select { case <-gs.shutdownCh: // Server is shutting down
w.WriteHeader(http.StatusServiceUnavailable) w.Write([]byte("Shutting down"))
default: // Server is healthy w.WriteHeader(http.StatusOK) w.Write([]byte("OK"))
} }
```

## Best Practices

### Security

- Always validate Origin headers
- Implement rate limiting per connection
- Use TLS in production
- Validate and sanitize all input
- Implement authentication before upgrade
- Set appropriate buffer sizes and timeouts

### Performance

- Use goroutines for concurrent connections
- Implement connection pooling for clients
- Use buffered channels appropriately
- Consider using sync.Pool for object reuse
- Profile and benchmark your application
- Use binary frames for large data

### Error Handling

- Always check for specific close codes
- Implement exponential backoff for reconnection
- Log errors with context
- Handle panics in goroutines
- Implement circuit breakers for external services

## Resources

- [Gorilla WebSocket Documentation](https://github.com/gorilla/websocket)
- [nhooyr/websocket Documentation](https://github.com/nhooyr/websocket)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)
- [Effective Go](https://go.dev/doc/effective_go)
- [Go WebSocket Tutorial](https://github.com/golang-standards/project-layout)
