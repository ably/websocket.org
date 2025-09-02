---
title: Java WebSocket Implementation
description:
  Complete guide to WebSocket clients and servers in Java with Spring, Jakarta
  EE, and native
sidebar:
  order: 5
---

This guide covers WebSocket implementation in Java, including Spring Boot,
Jakarta EE, native Java, and Android patterns.

## Java Client Implementation

### Using Java-WebSocket Library

The most popular standalone WebSocket client library:

```java
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import java.net.URI;
import java.net.URISyntaxException;

public class SimpleWebSocketClient extends WebSocketClient {

    public SimpleWebSocketClient(URI serverUri) {
        super(serverUri);
    }

    @Override
    public void onOpen(ServerHandshake handshake) {
        System.out.println("Connected to server");
        System.out.println("HTTP Status: " + handshake.getHttpStatus());
        System.out.println("HTTP Message: " + handshake.getHttpStatusMessage());

        // Send initial message
        send("Hello Server!");

        // Send JSON message
        send("{\"type\":\"subscribe\",\"channel\":\"updates\"}");
    }

    @Override
    public void onMessage(String message) {
        System.out.println("Received: " + message);

        // Parse JSON messages
        try {
            JsonObject json = JsonParser.parseString(message).getAsJsonObject();
            String type = json.get("type").getAsString();

            switch (type) {
                case "notification":
                    handleNotification(json);
                    break;
                case "data":
                    handleData(json);
                    break;
                default:
                    System.out.println("Unknown message type: " + type);
            }
        } catch (Exception e) {
            System.out.println("Plain text message: " + message);
        }
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        System.out.println("Connection closed: " + code + " - " + reason);
        System.out.println("Closed by " + (remote ? "server" : "client"));

        if (code != 1000) {
            // Abnormal closure, attempt reconnection
            scheduleReconnection();
        }
    }

    @Override
    public void onError(Exception ex) {
        System.err.println("WebSocket error: " + ex.getMessage());
        ex.printStackTrace();
    }

    // Binary message handling
    @Override
    public void onMessage(ByteBuffer bytes) {
        byte[] data = new byte[bytes.remaining()];
        bytes.get(data);
        System.out.println("Received binary data: " + data.length + " bytes");
        processBinaryData(data);
    }

    private void handleNotification(JsonObject json) {
        String message = json.get("message").getAsString();
        System.out.println("Notification: " + message);
    }

    private void handleData(JsonObject json) {
        JsonObject data = json.getAsJsonObject("data");
        System.out.println("Data received: " + data);
    }

    private void processBinaryData(byte[] data) {
        // Process binary data
    }

    private void scheduleReconnection() {
        // Implement reconnection logic
    }

    public static void main(String[] args) throws URISyntaxException {
        SimpleWebSocketClient client = new SimpleWebSocketClient(
            new URI("wss://echo.websocket.org")
        );

        // Connect with timeout
        client.setConnectionLostTimeout(10);
        client.connect();
    }
}
```

### Reconnecting WebSocket Client

Implement automatic reconnection with exponential backoff:

```java
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import java.net.URI;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class ReconnectingWebSocketClient {
    private final URI serverUri;
    private WebSocketClient client;
    private final AtomicBoolean shouldReconnect = new AtomicBoolean(true);
    private final AtomicInteger reconnectAttempts = new AtomicInteger(0);
    private final ConcurrentLinkedQueue<String> messageQueue = new ConcurrentLinkedQueue<>();
    private Timer reconnectTimer;

    // Configuration
    private final int maxReconnectAttempts = 10;
    private final long minReconnectDelay = 1000; // 1 second
    private final long maxReconnectDelay = 30000; // 30 seconds
    private final double reconnectDecay = 1.5;

    public ReconnectingWebSocketClient(URI serverUri) {
        this.serverUri = serverUri;
        connect();
    }

    private void connect() {
        client = new WebSocketClient(serverUri) {
            @Override
            public void onOpen(ServerHandshake handshake) {
                System.out.println("Connected successfully");
                reconnectAttempts.set(0);

                // Send queued messages
                String message;
                while ((message = messageQueue.poll()) != null) {
                    send(message);
                }

                onConnected();
            }

            @Override
            public void onMessage(String message) {
                onMessageReceived(message);
            }

            @Override
            public void onClose(int code, String reason, boolean remote) {
                System.out.println("Connection closed: " + code + " - " + reason);

                if (shouldReconnect.get() && !isMaxReconnectsReached()) {
                    scheduleReconnect();
                }

                onDisconnected(code, reason);
            }

            @Override
            public void onError(Exception ex) {
                System.err.println("WebSocket error: " + ex.getMessage());
                onErrorOccurred(ex);
            }
        };

        // Configure client
        client.setConnectionLostTimeout(10);
        client.setTcpNoDelay(true);
        client.setReuseAddr(true);

        try {
            client.connectBlocking();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Connection interrupted: " + e.getMessage());
        }
    }

    private void scheduleReconnect() {
        long delay = getReconnectDelay();
        int attempt = reconnectAttempts.incrementAndGet();

        System.out.println(String.format(
            "Reconnecting in %d ms (attempt #%d)",
            delay, attempt
        ));

        if (reconnectTimer != null) {
            reconnectTimer.cancel();
        }

        reconnectTimer = new Timer();
        reconnectTimer.schedule(new TimerTask() {
            @Override
            public void run() {
                if (shouldReconnect.get()) {
                    connect();
                }
            }
        }, delay);
    }

    private long getReconnectDelay() {
        long delay = (long) (minReconnectDelay *
            Math.pow(reconnectDecay, reconnectAttempts.get()));
        return Math.min(delay, maxReconnectDelay);
    }

    private boolean isMaxReconnectsReached() {
        return reconnectAttempts.get() >= maxReconnectAttempts;
    }

    public void send(String message) {
        if (client != null && client.isOpen()) {
            client.send(message);
        } else {
            // Queue message for sending after reconnection
            messageQueue.offer(message);
        }
    }

    public void sendBinary(byte[] data) {
        if (client != null && client.isOpen()) {
            client.send(data);
        }
    }

    public void disconnect() {
        shouldReconnect.set(false);
        if (reconnectTimer != null) {
            reconnectTimer.cancel();
        }
        if (client != null) {
            client.close(1000, "Client disconnecting");
        }
    }

    // Override these methods for custom behavior
    protected void onConnected() {}
    protected void onMessageReceived(String message) {}
    protected void onDisconnected(int code, String reason) {}
    protected void onErrorOccurred(Exception ex) {}
}
```

### Jakarta EE WebSocket Client

Using the standard Jakarta EE WebSocket API:

```java
import jakarta.websocket.*;
import java.net.URI;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@ClientEndpoint(
    decoders = {MessageDecoder.class},
    encoders = {MessageEncoder.class},
    configurator = ClientConfigurator.class
)
public class JakartaWebSocketClient {
    private Session session;
    private final CountDownLatch connectionLatch = new CountDownLatch(1);
    private final Set<MessageHandler> messageHandlers =
        Collections.synchronizedSet(new HashSet<>());

    @OnOpen
    public void onOpen(Session session, EndpointConfig config) {
        System.out.println("Connected to server: " + session.getId());
        this.session = session;

        // Configure session
        session.setMaxIdleTimeout(60000); // 60 seconds
        session.setMaxTextMessageBufferSize(64 * 1024); // 64KB
        session.setMaxBinaryMessageBufferSize(64 * 1024); // 64KB

        connectionLatch.countDown();

        // Send initial message
        sendMessage(new Message("subscribe", "updates"));
    }

    @OnMessage
    public void onMessage(Message message, Session session) {
        System.out.println("Received message: " + message);

        // Notify all handlers
        synchronized (messageHandlers) {
            for (MessageHandler handler : messageHandlers) {
                handler.handleMessage(message);
            }
        }
    }

    @OnMessage
    public void onBinaryMessage(ByteBuffer buffer, Session session) {
        byte[] data = new byte[buffer.remaining()];
        buffer.get(data);
        System.out.println("Received binary: " + data.length + " bytes");
    }

    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        System.out.println("Connection closed: " + closeReason.getReasonPhrase());
        this.session = null;
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        System.err.println("WebSocket error: " + throwable.getMessage());
        throwable.printStackTrace();
    }

    public void connect(String endpoint) throws Exception {
        WebSocketContainer container = ContainerProvider.getWebSocketContainer();

        // Configure container
        container.setDefaultMaxSessionIdleTimeout(60000);
        container.setDefaultMaxTextMessageBufferSize(64 * 1024);
        container.setDefaultMaxBinaryMessageBufferSize(64 * 1024);

        // Connect with custom configuration
        ClientEndpointConfig config = ClientEndpointConfig.Builder.create()
            .preferredSubprotocols(Arrays.asList("chat", "superchat"))
            .extensions(Arrays.asList(
                new Extension() {
                    public String getName() { return "permessage-deflate"; }
                    public List<Parameter> getParameters() {
                        return Collections.emptyList();
                    }
                }
            ))
            .configurator(new ClientEndpointConfig.Configurator() {
                @Override
                public void beforeRequest(Map<String, List<String>> headers) {
                    headers.put("Authorization",
                        Arrays.asList("Bearer " + getAuthToken()));
                    headers.put("X-Custom-Header",
                        Arrays.asList("custom-value"));
                }
            })
            .build();

        session = container.connectToServer(this, config, URI.create(endpoint));

        // Wait for connection
        if (!connectionLatch.await(10, TimeUnit.SECONDS)) {
            throw new RuntimeException("Connection timeout");
        }
    }

    public void sendMessage(Message message) {
        if (session != null && session.isOpen()) {
            try {
                session.getBasicRemote().sendObject(message);
            } catch (Exception e) {
                System.err.println("Failed to send message: " + e.getMessage());
            }
        }
    }

    public void sendBinary(byte[] data) {
        if (session != null && session.isOpen()) {
            try {
                ByteBuffer buffer = ByteBuffer.wrap(data);
                session.getBasicRemote().sendBinary(buffer);
            } catch (Exception e) {
                System.err.println("Failed to send binary: " + e.getMessage());
            }
        }
    }

    public void sendAsync(Message message) {
        if (session != null && session.isOpen()) {
            session.getAsyncRemote().sendObject(message, new SendHandler() {
                @Override
                public void onResult(SendResult result) {
                    if (result.isOK()) {
                        System.out.println("Message sent successfully");
                    } else {
                        System.err.println("Failed to send: " +
                            result.getException().getMessage());
                    }
                }
            });
        }
    }

    public void addMessageHandler(MessageHandler handler) {
        messageHandlers.add(handler);
    }

    public void removeMessageHandler(MessageHandler handler) {
        messageHandlers.remove(handler);
    }

    public void disconnect() {
        if (session != null && session.isOpen()) {
            try {
                session.close(new CloseReason(
                    CloseReason.CloseCodes.NORMAL_CLOSURE,
                    "Client disconnecting"
                ));
            } catch (Exception e) {
                System.err.println("Error closing connection: " + e.getMessage());
            }
        }
    }

    public interface MessageHandler {
        void handleMessage(Message message);
    }

    private String getAuthToken() {
        // Implement token retrieval
        return "your-auth-token";
    }
}
```

## Spring Boot WebSocket Server

### Basic Spring WebSocket Configuration

Configure WebSocket support in Spring Boot:

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.web.socket.server.standard.ServerEndpointExporter;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new SimpleWebSocketHandler(), "/ws")
            .setAllowedOrigins("*")
            .addInterceptors(new WebSocketHandshakeInterceptor());

        // With SockJS fallback
        registry.addHandler(new SimpleWebSocketHandler(), "/ws-sockjs")
            .setAllowedOrigins("*")
            .withSockJS();
    }

    @Bean
    public ServerEndpointExporter serverEndpointExporter() {
        return new ServerEndpointExporter();
    }
}

// STOMP Configuration
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketMessageBrokerConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws-stomp")
            .setAllowedOriginPatterns("*")
            .withSockJS();
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
            .setMessageSizeLimit(128 * 1024) // 128KB
            .setSendBufferSizeLimit(512 * 1024) // 512KB
            .setSendTimeLimit(20 * 1000); // 20 seconds
    }
}
```

### Spring WebSocket Handler

Implement a WebSocket handler:

```java
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.stereotype.Component;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component
public class SimpleWebSocketHandler extends TextWebSocketHandler {

    private final CopyOnWriteArraySet<WebSocketSession> sessions =
        new CopyOnWriteArraySet<>();
    private final ConcurrentHashMap<String, UserSession> userSessions =
        new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);

        // Extract user information
        String userId = extractUserId(session);
        UserSession userSession = new UserSession(userId, session);
        userSessions.put(session.getId(), userSession);

        System.out.println("New connection: " + session.getId() +
            " from user: " + userId);

        // Send welcome message
        WebSocketMessage message = new WebSocketMessage("welcome",
            "Connected to WebSocket server");
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));

        // Notify other users
        broadcastUserJoined(userId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session,
                                   TextMessage message) throws Exception {
        String payload = message.getPayload();
        System.out.println("Received: " + payload);

        try {
            WebSocketMessage wsMessage = objectMapper.readValue(
                payload, WebSocketMessage.class);

            switch (wsMessage.getType()) {
                case "broadcast":
                    handleBroadcast(session, wsMessage);
                    break;
                case "private":
                    handlePrivateMessage(session, wsMessage);
                    break;
                case "subscribe":
                    handleSubscribe(session, wsMessage);
                    break;
                case "unsubscribe":
                    handleUnsubscribe(session, wsMessage);
                    break;
                default:
                    handleCustomMessage(session, wsMessage);
            }
        } catch (Exception e) {
            sendError(session, "Invalid message format: " + e.getMessage());
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session,
                                      BinaryMessage message) throws Exception {
        byte[] payload = message.getPayload().array();
        System.out.println("Received binary: " + payload.length + " bytes");

        // Process binary data
        processBinaryData(session, payload);
    }

    @Override
    public void handleTransportError(WebSocketSession session,
                                    Throwable exception) throws Exception {
        System.err.println("Transport error for session " +
            session.getId() + ": " + exception.getMessage());

        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session,
                                     CloseStatus status) throws Exception {
        sessions.remove(session);
        UserSession userSession = userSessions.remove(session.getId());

        if (userSession != null) {
            System.out.println("Connection closed for user: " +
                userSession.getUserId() + " - " + status.toString());
            broadcastUserLeft(userSession.getUserId());
        }
    }

    private void handleBroadcast(WebSocketSession sender,
                                WebSocketMessage message) throws Exception {
        UserSession senderSession = userSessions.get(sender.getId());

        WebSocketMessage broadcastMessage = new WebSocketMessage(
            "broadcast",
            message.getPayload(),
            senderSession.getUserId()
        );

        String json = objectMapper.writeValueAsString(broadcastMessage);
        TextMessage textMessage = new TextMessage(json);

        for (WebSocketSession session : sessions) {
            if (session.isOpen() && !session.getId().equals(sender.getId())) {
                session.sendMessage(textMessage);
            }
        }
    }

    private void handlePrivateMessage(WebSocketSession sender,
                                     WebSocketMessage message) throws Exception {
        String targetUserId = message.getTargetUserId();
        UserSession targetSession = findUserSession(targetUserId);

        if (targetSession != null && targetSession.getSession().isOpen()) {
            UserSession senderSession = userSessions.get(sender.getId());

            WebSocketMessage privateMessage = new WebSocketMessage(
                "private",
                message.getPayload(),
                senderSession.getUserId()
            );

            targetSession.getSession().sendMessage(
                new TextMessage(objectMapper.writeValueAsString(privateMessage))
            );
        } else {
            sendError(sender, "User not found or offline: " + targetUserId);
        }
    }

    private void handleSubscribe(WebSocketSession session,
                                WebSocketMessage message) throws Exception {
        String channel = message.getChannel();
        UserSession userSession = userSessions.get(session.getId());
        userSession.subscribe(channel);

        sendSuccess(session, "Subscribed to channel: " + channel);
    }

    private void handleUnsubscribe(WebSocketSession session,
                                  WebSocketMessage message) throws Exception {
        String channel = message.getChannel();
        UserSession userSession = userSessions.get(session.getId());
        userSession.unsubscribe(channel);

        sendSuccess(session, "Unsubscribed from channel: " + channel);
    }

    private void handleCustomMessage(WebSocketSession session,
                                    WebSocketMessage message) throws Exception {
        // Implement custom message handling
    }

    private void processBinaryData(WebSocketSession session,
                                  byte[] data) throws Exception {
        // Process binary data
        // Example: Image processing, file upload, etc.
    }

    private void broadcastUserJoined(String userId) throws Exception {
        WebSocketMessage message = new WebSocketMessage(
            "user_joined", userId);
        broadcastToAll(message);
    }

    private void broadcastUserLeft(String userId) throws Exception {
        WebSocketMessage message = new WebSocketMessage(
            "user_left", userId);
        broadcastToAll(message);
    }

    private void broadcastToAll(WebSocketMessage message) throws Exception {
        String json = objectMapper.writeValueAsString(message);
        TextMessage textMessage = new TextMessage(json);

        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                session.sendMessage(textMessage);
            }
        }
    }

    public void broadcastToChannel(String channel,
                                  WebSocketMessage message) throws Exception {
        String json = objectMapper.writeValueAsString(message);
        TextMessage textMessage = new TextMessage(json);

        for (UserSession userSession : userSessions.values()) {
            if (userSession.isSubscribed(channel) &&
                userSession.getSession().isOpen()) {
                userSession.getSession().sendMessage(textMessage);
            }
        }
    }

    private void sendError(WebSocketSession session,
                          String error) throws Exception {
        WebSocketMessage errorMessage = new WebSocketMessage("error", error);
        session.sendMessage(
            new TextMessage(objectMapper.writeValueAsString(errorMessage))
        );
    }

    private void sendSuccess(WebSocketSession session,
                            String message) throws Exception {
        WebSocketMessage successMessage = new WebSocketMessage("success", message);
        session.sendMessage(
            new TextMessage(objectMapper.writeValueAsString(successMessage))
        );
    }

    private String extractUserId(WebSocketSession session) {
        // Extract user ID from session attributes or headers
        return (String) session.getAttributes().get("userId");
    }

    private UserSession findUserSession(String userId) {
        return userSessions.values().stream()
            .filter(session -> session.getUserId().equals(userId))
            .findFirst()
            .orElse(null);
    }
}
```

### Spring STOMP Controller

Using STOMP protocol with Spring:

```java
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import java.security.Principal;

@Controller
public class WebSocketController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage,
                                  SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        System.out.println("Message from session: " + sessionId);
        return chatMessage;
    }

    @MessageMapping("/chat.private")
    @SendToUser("/queue/private")
    public ChatMessage sendPrivateMessage(@Payload ChatMessage chatMessage,
                                         Principal principal) {
        chatMessage.setSender(principal.getName());
        return chatMessage;
    }

    @MessageMapping("/chat.typing")
    public void handleTyping(@Payload TypingMessage typing,
                            SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        String username = (String) headerAccessor.getSessionAttributes().get("username");

        typing.setUsername(username);

        // Send to all except sender
        messagingTemplate.convertAndSend("/topic/typing", typing);
    }

    @MessageMapping("/room.join")
    public void joinRoom(@Payload RoomMessage roomMessage,
                        SimpMessageHeaderAccessor headerAccessor,
                        Principal principal) {
        String roomId = roomMessage.getRoomId();
        String username = principal.getName();

        // Add user to room
        headerAccessor.getSessionAttributes().put("room", roomId);

        // Notify room members
        ChatMessage joinMessage = new ChatMessage();
        joinMessage.setType(ChatMessage.MessageType.JOIN);
        joinMessage.setSender(username);
        joinMessage.setContent(username + " joined the room");

        messagingTemplate.convertAndSend("/topic/room." + roomId, joinMessage);
    }

    @MessageMapping("/room.leave")
    public void leaveRoom(@Payload RoomMessage roomMessage,
                         SimpMessageHeaderAccessor headerAccessor,
                         Principal principal) {
        String roomId = roomMessage.getRoomId();
        String username = principal.getName();

        // Remove user from room
        headerAccessor.getSessionAttributes().remove("room");

        // Notify room members
        ChatMessage leaveMessage = new ChatMessage();
        leaveMessage.setType(ChatMessage.MessageType.LEAVE);
        leaveMessage.setSender(username);
        leaveMessage.setContent(username + " left the room");

        messagingTemplate.convertAndSend("/topic/room." + roomId, leaveMessage);
    }

    @MessageExceptionHandler
    @SendToUser("/queue/errors")
    public String handleException(Throwable exception) {
        return exception.getMessage();
    }

    // Send message to specific user
    public void sendToUser(String username, ChatMessage message) {
        messagingTemplate.convertAndSendToUser(
            username,
            "/queue/private",
            message
        );
    }

    // Broadcast to all connected users
    public void broadcast(ChatMessage message) {
        messagingTemplate.convertAndSend("/topic/public", message);
    }

    // Send to specific room
    public void sendToRoom(String roomId, ChatMessage message) {
        messagingTemplate.convertAndSend("/topic/room." + roomId, message);
    }
}
```

## Android WebSocket Implementation

### OkHttp WebSocket Client

Using OkHttp for Android WebSocket connections:

```java
import okhttp3.*;
import okio.ByteString;
import java.util.concurrent.TimeUnit;
import android.os.Handler;
import android.os.Looper;

public class AndroidWebSocketClient {
    private OkHttpClient client;
    private WebSocket webSocket;
    private WebSocketListener listener;
    private Handler mainHandler;
    private boolean isConnected = false;
    private int reconnectAttempts = 0;
    private static final int MAX_RECONNECT_ATTEMPTS = 5;

    public AndroidWebSocketClient() {
        mainHandler = new Handler(Looper.getMainLooper());
        initializeClient();
    }

    private void initializeClient() {
        client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .pingInterval(20, TimeUnit.SECONDS) // Keep-alive ping
            .retryOnConnectionFailure(true)
            .build();

        listener = new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                isConnected = true;
                reconnectAttempts = 0;

                runOnMainThread(() -> {
                    onConnected();

                    // Send initial message
                    sendMessage("{\"type\":\"authenticate\",\"token\":\"" +
                        getAuthToken() + "\"}");
                });
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                runOnMainThread(() -> onTextMessage(text));
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                runOnMainThread(() -> onBinaryMessage(bytes.toByteArray()));
            }

            @Override
            public void onClosing(WebSocket webSocket, int code, String reason) {
                webSocket.close(1000, null);
                isConnected = false;
                runOnMainThread(() -> onClosing(code, reason));
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                isConnected = false;
                runOnMainThread(() -> {
                    onDisconnected(code, reason);

                    if (shouldReconnect(code)) {
                        scheduleReconnect();
                    }
                });
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                isConnected = false;
                runOnMainThread(() -> {
                    onError(t);

                    if (shouldReconnect(0)) {
                        scheduleReconnect();
                    }
                });
            }
        };
    }

    public void connect(String url) {
        Request request = new Request.Builder()
            .url(url)
            .addHeader("Authorization", "Bearer " + getAuthToken())
            .addHeader("X-Device-Id", getDeviceId())
            .build();

        webSocket = client.newWebSocket(request, listener);
    }

    public void sendMessage(String message) {
        if (isConnected && webSocket != null) {
            webSocket.send(message);
        } else {
            // Queue message or handle offline state
            queueMessage(message);
        }
    }

    public void sendBinary(byte[] data) {
        if (isConnected && webSocket != null) {
            webSocket.send(ByteString.of(data));
        }
    }

    public void disconnect() {
        if (webSocket != null) {
            webSocket.close(1000, "User disconnect");
        }

        // Clean up
        client.dispatcher().executorService().shutdown();
    }

    private void scheduleReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            onReconnectFailed();
            return;
        }

        reconnectAttempts++;
        long delay = getReconnectDelay();

        mainHandler.postDelayed(() -> {
            if (!isConnected) {
                connect(getCurrentUrl());
            }
        }, delay);
    }

    private long getReconnectDelay() {
        // Exponential backoff
        return (long) Math.min(30000, Math.pow(2, reconnectAttempts) * 1000);
    }

    private boolean shouldReconnect(int code) {
        // Don't reconnect for normal closure or going away
        return code != 1000 && code != 1001;
    }

    private void runOnMainThread(Runnable runnable) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            runnable.run();
        } else {
            mainHandler.post(runnable);
        }
    }

    private void queueMessage(String message) {
        // Implement message queuing for offline support
    }

    private String getAuthToken() {
        // Retrieve auth token from SharedPreferences or secure storage
        return "auth-token";
    }

    private String getDeviceId() {
        // Get unique device identifier
        return "device-id";
    }

    private String getCurrentUrl() {
        // Return current WebSocket URL
        return "wss://your-server.com/ws";
    }

    // Override these methods in your implementation
    protected void onConnected() {}
    protected void onTextMessage(String message) {}
    protected void onBinaryMessage(byte[] data) {}
    protected void onClosing(int code, String reason) {}
    protected void onDisconnected(int code, String reason) {}
    protected void onError(Throwable throwable) {}
    protected void onReconnectFailed() {}
}
```

## Testing WebSocket Applications

### JUnit Testing with Mock WebSocket

```java
import org.junit.jupiter.api.*;
import org.mockito.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class WebSocketClientTest {

    @Mock
    private WebSocketClient mockClient;

    @InjectMocks
    private ReconnectingWebSocketClient client;

    private CountDownLatch connectionLatch;
    private CountDownLatch messageLatch;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        connectionLatch = new CountDownLatch(1);
        messageLatch = new CountDownLatch(1);
    }

    @Test
    public void testConnection() throws Exception {
        // Arrange
        URI serverUri = new URI("ws://localhost:8080/ws");
        TestWebSocketClient client = new TestWebSocketClient(serverUri);

        // Act
        client.connect();
        boolean connected = connectionLatch.await(5, TimeUnit.SECONDS);

        // Assert
        assertTrue(connected, "Should connect within 5 seconds");
        assertTrue(client.isOpen(), "Connection should be open");
    }

    @Test
    public void testMessageSending() throws Exception {
        // Arrange
        String testMessage = "{\"type\":\"test\",\"data\":\"hello\"}";
        when(mockClient.isOpen()).thenReturn(true);

        // Act
        client.send(testMessage);

        // Assert
        verify(mockClient, times(1)).send(testMessage);
    }

    @Test
    public void testReconnection() throws Exception {
        // Arrange
        AtomicInteger reconnectCount = new AtomicInteger(0);

        ReconnectingWebSocketClient client = new ReconnectingWebSocketClient(
            new URI("ws://localhost:8080/ws")
        ) {
            @Override
            protected void onConnected() {
                reconnectCount.incrementAndGet();
            }
        };

        // Act - Simulate disconnect
        client.getClient().close(1006, "Network error");
        Thread.sleep(2000); // Wait for reconnection

        // Assert
        assertTrue(reconnectCount.get() > 1,
            "Should have reconnected at least once");
    }

    @Test
    public void testMessageQueuing() {
        // Arrange
        when(mockClient.isOpen()).thenReturn(false);

        // Act
        client.send("message1");
        client.send("message2");
        client.send("message3");

        // Assert
        assertEquals(3, client.getQueuedMessageCount(),
            "Should have 3 queued messages");

        // Simulate connection
        when(mockClient.isOpen()).thenReturn(true);
        client.flushMessageQueue();

        verify(mockClient, times(3)).send(anyString());
    }

    @Test
    public void testBinaryMessage() throws Exception {
        // Arrange
        byte[] testData = "binary data".getBytes();
        when(mockClient.isOpen()).thenReturn(true);

        // Act
        client.sendBinary(testData);

        // Assert
        verify(mockClient, times(1)).send(testData);
    }

    @Test
    public void testErrorHandling() {
        // Arrange
        Exception testException = new IOException("Connection failed");
        AtomicBoolean errorHandled = new AtomicBoolean(false);

        ReconnectingWebSocketClient client = new ReconnectingWebSocketClient(
            new URI("ws://localhost:8080/ws")
        ) {
            @Override
            protected void onErrorOccurred(Exception ex) {
                errorHandled.set(true);
                assertEquals(testException.getMessage(), ex.getMessage());
            }
        };

        // Act
        client.handleError(testException);

        // Assert
        assertTrue(errorHandled.get(), "Error should be handled");
    }

    private class TestWebSocketClient extends WebSocketClient {
        public TestWebSocketClient(URI serverUri) {
            super(serverUri);
        }

        @Override
        public void onOpen(ServerHandshake handshake) {
            connectionLatch.countDown();
        }

        @Override
        public void onMessage(String message) {
            messageLatch.countDown();
        }

        @Override
        public void onClose(int code, String reason, boolean remote) {}

        @Override
        public void onError(Exception ex) {}
    }
}
```

## Best Practices

### Connection Management

- Implement automatic reconnection with exponential backoff
- Use connection pooling for multiple WebSocket connections
- Handle network changes gracefully (especially on mobile)
- Implement heartbeat/ping-pong for connection health

### Security

- Always use WSS (WebSocket Secure) in production
- Implement proper authentication before upgrading connection
- Validate all incoming messages
- Use rate limiting to prevent abuse
- Implement CORS properly

### Performance

- Use binary messages for large data transfers
- Implement message compression (permessage-deflate)
- Batch small messages when possible
- Use async message sending for better throughput
- Configure appropriate buffer sizes

### Error Handling

- Implement comprehensive error handling
- Log errors appropriately
- Provide fallback mechanisms
- Handle partial message failures
- Implement circuit breaker pattern for failing services

### Monitoring

- Track connection metrics (open/close/error rates)
- Monitor message throughput
- Log slow message processing
- Implement health checks
- Use distributed tracing for debugging
