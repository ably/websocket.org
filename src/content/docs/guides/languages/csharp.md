---
title: C# and .NET WebSocket Implementation
description:
  Complete guide to WebSocket clients and servers in C#, .NET, and ASP.NET Core
sidebar:
  order: 6
---

This guide covers WebSocket implementation in C# and .NET, including ASP.NET
Core, SignalR, and Unity patterns.

## .NET Client Implementation

### Using ClientWebSocket

The built-in `ClientWebSocket` class for .NET applications:

```csharp
using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;

public class WebSocketClient
{
    private ClientWebSocket _webSocket;
    private CancellationTokenSource _cancellationTokenSource;
    private readonly Uri _uri;
    private readonly SemaphoreSlim _sendSemaphore = new(1, 1);

    public WebSocketClient(string uri)
    {
        _uri = new Uri(uri);
    }

    public async Task ConnectAsync()
    {
        _webSocket = new ClientWebSocket();
        _cancellationTokenSource = new CancellationTokenSource();

        // Configure WebSocket options
        _webSocket.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
        _webSocket.Options.SetRequestHeader("Authorization", $"Bearer {GetAuthToken()}");
        _webSocket.Options.AddSubProtocol("chat");

        try
        {
            await _webSocket.ConnectAsync(_uri, _cancellationTokenSource.Token);
            Console.WriteLine($"Connected to {_uri}");

            // Start receiving messages
            _ = Task.Run(ReceiveLoop);

            // Send initial message
            await SendMessageAsync(new { type = "subscribe", channel = "updates" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Connection failed: {ex.Message}");
            throw;
        }
    }

    private async Task ReceiveLoop()
    {
        var buffer = new ArraySegment<byte>(new byte[4096]);

        while (_webSocket.State == WebSocketState.Open)
        {
            try
            {
                var result = await _webSocket.ReceiveAsync(
                    buffer,
                    _cancellationTokenSource.Token
                );

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var message = Encoding.UTF8.GetString(
                        buffer.Array, 0, result.Count
                    );
                    await HandleTextMessage(message);
                }
                else if (result.MessageType == WebSocketMessageType.Binary)
                {
                    await HandleBinaryMessage(
                        buffer.Array.Take(result.Count).ToArray()
                    );
                }
                else if (result.MessageType == WebSocketMessageType.Close)
                {
                    await HandleClose(result);
                    break;
                }
            }
            catch (WebSocketException ex)
            {
                Console.WriteLine($"WebSocket error: {ex.Message}");
                await HandleError(ex);
                break;
            }
        }
    }

    public async Task SendMessageAsync(object message)
    {
        if (_webSocket.State != WebSocketState.Open)
        {
            throw new InvalidOperationException("WebSocket is not connected");
        }

        var json = JsonSerializer.Serialize(message);
        var bytes = Encoding.UTF8.GetBytes(json);

        await _sendSemaphore.WaitAsync();
        try
        {
            await _webSocket.SendAsync(
                new ArraySegment<byte>(bytes),
                WebSocketMessageType.Text,
                true,
                _cancellationTokenSource.Token
            );
        }
        finally
        {
            _sendSemaphore.Release();
        }
    }

    public async Task SendBinaryAsync(byte[] data)
    {
        if (_webSocket.State != WebSocketState.Open)
        {
            throw new InvalidOperationException("WebSocket is not connected");
        }

        await _sendSemaphore.WaitAsync();
        try
        {
            await _webSocket.SendAsync(
                new ArraySegment<byte>(data),
                WebSocketMessageType.Binary,
                true,
                _cancellationTokenSource.Token
            );
        }
        finally
        {
            _sendSemaphore.Release();
        }
    }

    public async Task DisconnectAsync()
    {
        if (_webSocket.State == WebSocketState.Open)
        {
            await _webSocket.CloseAsync(
                WebSocketCloseStatus.NormalClosure,
                "Client disconnecting",
                CancellationToken.None
            );
        }

        _cancellationTokenSource?.Cancel();
        _webSocket?.Dispose();
    }

    private async Task HandleTextMessage(string message)
    {
        try
        {
            var json = JsonDocument.Parse(message);
            var type = json.RootElement.GetProperty("type").GetString();

            switch (type)
            {
                case "notification":
                    await HandleNotification(json.RootElement);
                    break;
                case "data":
                    await HandleData(json.RootElement);
                    break;
                default:
                    Console.WriteLine($"Unknown message type: {type}");
                    break;
            }
        }
        catch (JsonException)
        {
            Console.WriteLine($"Plain text message: {message}");
        }
    }

    private async Task HandleBinaryMessage(byte[] data)
    {
        Console.WriteLine($"Received binary data: {data.Length} bytes");
        // Process binary data
    }

    private async Task HandleClose(WebSocketReceiveResult result)
    {
        Console.WriteLine($"Connection closed: {result.CloseStatus} - {result.CloseStatusDescription}");
    }

    private async Task HandleError(Exception ex)
    {
        Console.WriteLine($"Error: {ex.Message}");
        // Implement reconnection logic
    }

    private async Task HandleNotification(JsonElement json)
    {
        var message = json.GetProperty("message").GetString();
        Console.WriteLine($"Notification: {message}");
    }

    private async Task HandleData(JsonElement json)
    {
        var data = json.GetProperty("data");
        Console.WriteLine($"Data received: {data}");
    }

    private string GetAuthToken()
    {
        // Retrieve authentication token
        return "your-auth-token";
    }
}
```

### Reconnecting WebSocket Client

Implement automatic reconnection with exponential backoff:

```csharp
using System;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using System.Timers;
using Timer = System.Timers.Timer;

public class ReconnectingWebSocketClient : IDisposable
{
    private ClientWebSocket _webSocket;
    private readonly Uri _uri;
    private CancellationTokenSource _cancellationTokenSource;
    private readonly ConcurrentQueue<byte[]> _messageQueue = new();
    private Timer _reconnectTimer;
    private int _reconnectAttempts = 0;
    private bool _shouldReconnect = true;
    private bool _isDisposed = false;

    // Configuration
    private readonly int _maxReconnectAttempts = 10;
    private readonly TimeSpan _minReconnectDelay = TimeSpan.FromSeconds(1);
    private readonly TimeSpan _maxReconnectDelay = TimeSpan.FromSeconds(30);
    private readonly double _reconnectDecay = 1.5;

    public event EventHandler<string> MessageReceived;
    public event EventHandler<byte[]> BinaryMessageReceived;
    public event EventHandler Connected;
    public event EventHandler<string> Disconnected;
    public event EventHandler<Exception> ErrorOccurred;

    public WebSocketState State => _webSocket?.State ?? WebSocketState.None;
    public bool IsConnected => State == WebSocketState.Open;

    public ReconnectingWebSocketClient(string uri)
    {
        _uri = new Uri(uri);
    }

    public async Task ConnectAsync()
    {
        try
        {
            _webSocket = new ClientWebSocket();
            _cancellationTokenSource = new CancellationTokenSource();

            ConfigureWebSocket();

            await _webSocket.ConnectAsync(_uri, _cancellationTokenSource.Token);

            _reconnectAttempts = 0;
            Connected?.Invoke(this, EventArgs.Empty);

            // Process queued messages
            while (_messageQueue.TryDequeue(out var message))
            {
                await SendInternalAsync(message);
            }

            // Start receive loop
            _ = Task.Run(ReceiveLoopAsync);
        }
        catch (Exception ex)
        {
            ErrorOccurred?.Invoke(this, ex);

            if (_shouldReconnect && !IsMaxReconnectsReached())
            {
                ScheduleReconnect();
            }

            throw;
        }
    }

    private void ConfigureWebSocket()
    {
        _webSocket.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
        _webSocket.Options.SetRequestHeader("User-Agent", "ReconnectingWebSocketClient/1.0");

        // Add any custom headers or sub-protocols
        ConfigureWebSocketOptions(_webSocket.Options);
    }

    protected virtual void ConfigureWebSocketOptions(ClientWebSocketOptions options)
    {
        // Override in derived class to add custom configuration
    }

    private async Task ReceiveLoopAsync()
    {
        var buffer = new ArraySegment<byte>(new byte[4096]);
        var messageBuilder = new List<byte>();

        while (IsConnected && !_cancellationTokenSource.Token.IsCancellationRequested)
        {
            try
            {
                WebSocketReceiveResult result;
                do
                {
                    result = await _webSocket.ReceiveAsync(buffer, _cancellationTokenSource.Token);

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await HandleCloseAsync(result);
                        return;
                    }

                    messageBuilder.AddRange(buffer.Array.Take(result.Count));

                } while (!result.EndOfMessage);

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var message = Encoding.UTF8.GetString(messageBuilder.ToArray());
                    MessageReceived?.Invoke(this, message);
                }
                else if (result.MessageType == WebSocketMessageType.Binary)
                {
                    BinaryMessageReceived?.Invoke(this, messageBuilder.ToArray());
                }

                messageBuilder.Clear();
            }
            catch (WebSocketException ex)
            {
                ErrorOccurred?.Invoke(this, ex);
                await HandleDisconnectAsync(ex.Message);
                break;
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    public async Task SendAsync(string message)
    {
        var bytes = Encoding.UTF8.GetBytes(message);
        await SendAsync(bytes, WebSocketMessageType.Text);
    }

    public async Task SendBinaryAsync(byte[] data)
    {
        await SendAsync(data, WebSocketMessageType.Binary);
    }

    private async Task SendAsync(byte[] data, WebSocketMessageType messageType)
    {
        if (IsConnected)
        {
            await SendInternalAsync(data, messageType);
        }
        else
        {
            // Queue message for sending after reconnection
            _messageQueue.Enqueue(data);
        }
    }

    private async Task SendInternalAsync(byte[] data,
        WebSocketMessageType messageType = WebSocketMessageType.Text)
    {
        try
        {
            await _webSocket.SendAsync(
                new ArraySegment<byte>(data),
                messageType,
                true,
                _cancellationTokenSource.Token
            );
        }
        catch (WebSocketException ex)
        {
            ErrorOccurred?.Invoke(this, ex);
            _messageQueue.Enqueue(data); // Re-queue on failure
            throw;
        }
    }

    private async Task HandleCloseAsync(WebSocketReceiveResult result)
    {
        var reason = result.CloseStatusDescription ?? "No reason provided";
        Disconnected?.Invoke(this, reason);

        if (_shouldReconnect && result.CloseStatus != WebSocketCloseStatus.NormalClosure)
        {
            await HandleDisconnectAsync(reason);
        }
    }

    private async Task HandleDisconnectAsync(string reason)
    {
        Disconnected?.Invoke(this, reason);

        if (_shouldReconnect && !IsMaxReconnectsReached())
        {
            ScheduleReconnect();
        }
    }

    private void ScheduleReconnect()
    {
        var delay = GetReconnectDelay();
        _reconnectAttempts++;

        Console.WriteLine($"Reconnecting in {delay.TotalSeconds:F1} seconds (attempt #{_reconnectAttempts})");

        _reconnectTimer?.Dispose();
        _reconnectTimer = new Timer(delay.TotalMilliseconds);
        _reconnectTimer.Elapsed += async (sender, e) =>
        {
            _reconnectTimer.Dispose();

            if (_shouldReconnect && !_isDisposed)
            {
                await ConnectAsync();
            }
        };
        _reconnectTimer.Start();
    }

    private TimeSpan GetReconnectDelay()
    {
        var delay = TimeSpan.FromMilliseconds(
            _minReconnectDelay.TotalMilliseconds *
            Math.Pow(_reconnectDecay, _reconnectAttempts)
        );

        return delay > _maxReconnectDelay ? _maxReconnectDelay : delay;
    }

    private bool IsMaxReconnectsReached()
    {
        return _reconnectAttempts >= _maxReconnectAttempts;
    }

    public async Task DisconnectAsync()
    {
        _shouldReconnect = false;
        _reconnectTimer?.Dispose();

        if (IsConnected)
        {
            await _webSocket.CloseAsync(
                WebSocketCloseStatus.NormalClosure,
                "Client disconnecting",
                CancellationToken.None
            );
        }

        _cancellationTokenSource?.Cancel();
    }

    public void Dispose()
    {
        if (_isDisposed) return;

        _isDisposed = true;
        _shouldReconnect = false;

        _reconnectTimer?.Dispose();
        _cancellationTokenSource?.Cancel();
        _cancellationTokenSource?.Dispose();
        _webSocket?.Dispose();
    }
}
```

## ASP.NET Core WebSocket Server

### Basic WebSocket Middleware

Configure WebSocket support in ASP.NET Core:

```csharp
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

public class Startup
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers();

        // Add WebSocket manager service
        services.AddSingleton<WebSocketConnectionManager>();
        services.AddTransient<WebSocketHandler>();
    }

    public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.UseRouting();

        // Enable WebSocket support
        var webSocketOptions = new WebSocketOptions
        {
            KeepAliveInterval = TimeSpan.FromSeconds(120),
            ReceiveBufferSize = 4 * 1024
        };
        app.UseWebSockets(webSocketOptions);

        // Map WebSocket endpoints
        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
            endpoints.Map("/ws", async context =>
            {
                if (context.WebSockets.IsWebSocketRequest)
                {
                    using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                    var handler = context.RequestServices.GetRequiredService<WebSocketHandler>();
                    await handler.HandleAsync(context, webSocket);
                }
                else
                {
                    context.Response.StatusCode = 400;
                }
            });
        });
    }
}

public class WebSocketHandler
{
    private readonly WebSocketConnectionManager _connectionManager;
    private readonly ILogger<WebSocketHandler> _logger;

    public WebSocketHandler(
        WebSocketConnectionManager connectionManager,
        ILogger<WebSocketHandler> logger)
    {
        _connectionManager = connectionManager;
        _logger = logger;
    }

    public async Task HandleAsync(HttpContext context, WebSocket webSocket)
    {
        var connectionId = _connectionManager.AddConnection(webSocket);
        _logger.LogInformation($"WebSocket connection established: {connectionId}");

        try
        {
            await ReceiveAsync(connectionId, webSocket);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error in WebSocket connection {connectionId}");
        }
        finally
        {
            _connectionManager.RemoveConnection(connectionId);
            _logger.LogInformation($"WebSocket connection closed: {connectionId}");
        }
    }

    private async Task ReceiveAsync(string connectionId, WebSocket webSocket)
    {
        var buffer = new ArraySegment<byte>(new byte[4096]);

        while (webSocket.State == WebSocketState.Open)
        {
            var result = await webSocket.ReceiveAsync(buffer, CancellationToken.None);

            switch (result.MessageType)
            {
                case WebSocketMessageType.Text:
                    var message = Encoding.UTF8.GetString(buffer.Array, 0, result.Count);
                    await HandleTextMessage(connectionId, message);
                    break;

                case WebSocketMessageType.Binary:
                    await HandleBinaryMessage(connectionId, buffer.Array.Take(result.Count).ToArray());
                    break;

                case WebSocketMessageType.Close:
                    await webSocket.CloseAsync(
                        result.CloseStatus.Value,
                        result.CloseStatusDescription,
                        CancellationToken.None
                    );
                    break;
            }
        }
    }

    private async Task HandleTextMessage(string connectionId, string message)
    {
        _logger.LogInformation($"Received from {connectionId}: {message}");

        try
        {
            var json = JsonDocument.Parse(message);
            var type = json.RootElement.GetProperty("type").GetString();

            switch (type)
            {
                case "broadcast":
                    await BroadcastMessage(connectionId, message);
                    break;
                case "private":
                    await SendPrivateMessage(connectionId, json.RootElement);
                    break;
                default:
                    await Echo(connectionId, message);
                    break;
            }
        }
        catch (JsonException)
        {
            await Echo(connectionId, message);
        }
    }

    private async Task HandleBinaryMessage(string connectionId, byte[] data)
    {
        _logger.LogInformation($"Received binary from {connectionId}: {data.Length} bytes");
        // Process binary data
    }

    private async Task Echo(string connectionId, string message)
    {
        await _connectionManager.SendAsync(connectionId, $"Echo: {message}");
    }

    private async Task BroadcastMessage(string senderId, string message)
    {
        await _connectionManager.BroadcastAsync(message, senderId);
    }

    private async Task SendPrivateMessage(string senderId, JsonElement json)
    {
        var targetId = json.GetProperty("target").GetString();
        var content = json.GetProperty("content").GetString();

        await _connectionManager.SendAsync(targetId, content);
    }
}

public class WebSocketConnectionManager
{
    private readonly ConcurrentDictionary<string, WebSocket> _connections = new();

    public string AddConnection(WebSocket webSocket)
    {
        var connectionId = Guid.NewGuid().ToString();
        _connections.TryAdd(connectionId, webSocket);
        return connectionId;
    }

    public void RemoveConnection(string connectionId)
    {
        _connections.TryRemove(connectionId, out _);
    }

    public WebSocket GetConnection(string connectionId)
    {
        _connections.TryGetValue(connectionId, out var connection);
        return connection;
    }

    public IEnumerable<string> GetAllConnectionIds()
    {
        return _connections.Keys;
    }

    public async Task SendAsync(string connectionId, string message)
    {
        if (_connections.TryGetValue(connectionId, out var webSocket))
        {
            if (webSocket.State == WebSocketState.Open)
            {
                var bytes = Encoding.UTF8.GetBytes(message);
                await webSocket.SendAsync(
                    new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text,
                    true,
                    CancellationToken.None
                );
            }
        }
    }

    public async Task BroadcastAsync(string message, string excludeConnectionId = null)
    {
        var tasks = new List<Task>();

        foreach (var pair in _connections)
        {
            if (pair.Key != excludeConnectionId && pair.Value.State == WebSocketState.Open)
            {
                tasks.Add(SendAsync(pair.Key, message));
            }
        }

        await Task.WhenAll(tasks);
    }
}
```

## SignalR Implementation

### SignalR Hub

Implement real-time communication with SignalR:

```csharp
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using System.Collections.Concurrent;

public class ChatHub : Hub
{
    private static readonly ConcurrentDictionary<string, UserConnection> _connections = new();
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(ILogger<ChatHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        var connectionId = Context.ConnectionId;
        var userId = Context.UserIdentifier ?? "anonymous";

        _connections.TryAdd(connectionId, new UserConnection
        {
            ConnectionId = connectionId,
            UserId = userId,
            ConnectedAt = DateTime.UtcNow
        });

        _logger.LogInformation($"User {userId} connected with ID {connectionId}");

        // Notify others
        await Clients.Others.SendAsync("UserConnected", userId);

        // Send welcome message
        await Clients.Caller.SendAsync("Welcome", new
        {
            message = "Welcome to the chat!",
            connectionId,
            onlineUsers = GetOnlineUsers()
        });

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception exception)
    {
        var connectionId = Context.ConnectionId;

        if (_connections.TryRemove(connectionId, out var connection))
        {
            _logger.LogInformation($"User {connection.UserId} disconnected");
            await Clients.Others.SendAsync("UserDisconnected", connection.UserId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(string message)
    {
        var userId = Context.UserIdentifier ?? "anonymous";
        var timestamp = DateTime.UtcNow;

        var chatMessage = new ChatMessage
        {
            UserId = userId,
            Message = message,
            Timestamp = timestamp
        };

        await Clients.All.SendAsync("ReceiveMessage", chatMessage);
    }

    public async Task SendPrivateMessage(string targetUserId, string message)
    {
        var senderId = Context.UserIdentifier ?? "anonymous";
        var timestamp = DateTime.UtcNow;

        var privateMessage = new PrivateMessage
        {
            SenderId = senderId,
            ReceiverId = targetUserId,
            Message = message,
            Timestamp = timestamp
        };

        // Send to target user
        await Clients.User(targetUserId).SendAsync("ReceivePrivateMessage", privateMessage);

        // Send confirmation to sender
        await Clients.Caller.SendAsync("PrivateMessageSent", privateMessage);
    }

    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        var userId = Context.UserIdentifier ?? "anonymous";
        await Clients.Group(groupName).SendAsync("UserJoinedGroup", new
        {
            groupName,
            userId,
            message = $"{userId} joined the group"
        });
    }

    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);

        var userId = Context.UserIdentifier ?? "anonymous";
        await Clients.Group(groupName).SendAsync("UserLeftGroup", new
        {
            groupName,
            userId,
            message = $"{userId} left the group"
        });
    }

    public async Task SendToGroup(string groupName, string message)
    {
        var userId = Context.UserIdentifier ?? "anonymous";

        await Clients.Group(groupName).SendAsync("ReceiveGroupMessage", new
        {
            groupName,
            userId,
            message,
            timestamp = DateTime.UtcNow
        });
    }

    [Authorize]
    public async Task SendAuthenticatedMessage(string message)
    {
        var userId = Context.UserIdentifier;
        var userName = Context.User?.Identity?.Name;

        await Clients.All.SendAsync("ReceiveAuthenticatedMessage", new
        {
            userId,
            userName,
            message,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task<object> GetConnectionInfo()
    {
        return new
        {
            connectionId = Context.ConnectionId,
            userId = Context.UserIdentifier,
            isAuthenticated = Context.User?.Identity?.IsAuthenticated ?? false,
            claims = Context.User?.Claims?.Select(c => new { c.Type, c.Value })
        };
    }

    public async Task Typing(bool isTyping)
    {
        var userId = Context.UserIdentifier ?? "anonymous";
        await Clients.Others.SendAsync("UserTyping", new { userId, isTyping });
    }

    public async Task<IEnumerable<string>> GetOnlineUsers()
    {
        return _connections.Values.Select(c => c.UserId).Distinct();
    }

    private class UserConnection
    {
        public string ConnectionId { get; set; }
        public string UserId { get; set; }
        public DateTime ConnectedAt { get; set; }
    }

    private class ChatMessage
    {
        public string UserId { get; set; }
        public string Message { get; set; }
        public DateTime Timestamp { get; set; }
    }

    private class PrivateMessage : ChatMessage
    {
        public string SenderId { get; set; }
        public string ReceiverId { get; set; }
    }
}
```

### SignalR Client

Connect to SignalR hub from C# client:

```csharp
using Microsoft.AspNetCore.SignalR.Client;
using System;
using System.Threading.Tasks;

public class SignalRClient : IAsyncDisposable
{
    private HubConnection _connection;
    private readonly string _hubUrl;
    private readonly ILogger<SignalRClient> _logger;

    public event EventHandler<string> MessageReceived;
    public event EventHandler<string> Connected;
    public event EventHandler<string> Disconnected;

    public HubConnectionState State => _connection?.State ?? HubConnectionState.Disconnected;

    public SignalRClient(string hubUrl, ILogger<SignalRClient> logger)
    {
        _hubUrl = hubUrl;
        _logger = logger;
    }

    public async Task ConnectAsync()
    {
        _connection = new HubConnectionBuilder()
            .WithUrl(_hubUrl, options =>
            {
                options.AccessTokenProvider = () => Task.FromResult(GetAccessToken());
            })
            .WithAutomaticReconnect(new[] {
                TimeSpan.Zero,
                TimeSpan.FromSeconds(2),
                TimeSpan.FromSeconds(10),
                TimeSpan.FromSeconds(30)
            })
            .ConfigureLogging(logging =>
            {
                logging.SetMinimumLevel(LogLevel.Information);
            })
            .Build();

        // Register event handlers
        RegisterHandlers();

        // Handle reconnection
        _connection.Reconnecting += (error) =>
        {
            _logger.LogWarning($"Connection lost. Reconnecting... Error: {error?.Message}");
            return Task.CompletedTask;
        };

        _connection.Reconnected += (connectionId) =>
        {
            _logger.LogInformation($"Reconnected with ID: {connectionId}");
            Connected?.Invoke(this, connectionId);
            return Task.CompletedTask;
        };

        _connection.Closed += async (error) =>
        {
            _logger.LogError($"Connection closed. Error: {error?.Message}");
            Disconnected?.Invoke(this, error?.Message ?? "Connection closed");

            // Manual reconnection if automatic reconnection failed
            await Task.Delay(new Random().Next(0, 5) * 1000);
            await ConnectAsync();
        };

        try
        {
            await _connection.StartAsync();
            _logger.LogInformation("Connected to SignalR hub");
            Connected?.Invoke(this, _connection.ConnectionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to SignalR hub");
            throw;
        }
    }

    private void RegisterHandlers()
    {
        _connection.On<ChatMessage>("ReceiveMessage", (message) =>
        {
            _logger.LogInformation($"Message received: {message.Message}");
            MessageReceived?.Invoke(this, message.Message);
        });

        _connection.On<PrivateMessage>("ReceivePrivateMessage", (message) =>
        {
            _logger.LogInformation($"Private message from {message.SenderId}: {message.Message}");
            HandlePrivateMessage(message);
        });

        _connection.On<string>("UserConnected", (userId) =>
        {
            _logger.LogInformation($"User connected: {userId}");
        });

        _connection.On<string>("UserDisconnected", (userId) =>
        {
            _logger.LogInformation($"User disconnected: {userId}");
        });

        _connection.On<object>("Welcome", (data) =>
        {
            _logger.LogInformation($"Welcome message received: {data}");
        });

        _connection.On<dynamic>("UserTyping", (data) =>
        {
            HandleUserTyping(data.userId, data.isTyping);
        });
    }

    public async Task SendMessageAsync(string message)
    {
        if (_connection.State != HubConnectionState.Connected)
        {
            throw new InvalidOperationException("Not connected to hub");
        }

        await _connection.InvokeAsync("SendMessage", message);
    }

    public async Task SendPrivateMessageAsync(string targetUserId, string message)
    {
        await _connection.InvokeAsync("SendPrivateMessage", targetUserId, message);
    }

    public async Task JoinGroupAsync(string groupName)
    {
        await _connection.InvokeAsync("JoinGroup", groupName);
    }

    public async Task LeaveGroupAsync(string groupName)
    {
        await _connection.InvokeAsync("LeaveGroup", groupName);
    }

    public async Task SendToGroupAsync(string groupName, string message)
    {
        await _connection.InvokeAsync("SendToGroup", groupName, message);
    }

    public async Task<T> InvokeAsync<T>(string methodName, params object[] args)
    {
        return await _connection.InvokeAsync<T>(methodName, args);
    }

    public async Task SendAsync(string methodName, params object[] args)
    {
        await _connection.SendAsync(methodName, args);
    }

    public IDisposable On<T>(string methodName, Action<T> handler)
    {
        return _connection.On(methodName, handler);
    }

    private void HandlePrivateMessage(PrivateMessage message)
    {
        // Handle private message
    }

    private void HandleUserTyping(string userId, bool isTyping)
    {
        // Handle typing indicator
    }

    private string GetAccessToken()
    {
        // Retrieve access token
        return "your-access-token";
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection != null)
        {
            await _connection.DisposeAsync();
        }
    }

    private class ChatMessage
    {
        public string UserId { get; set; }
        public string Message { get; set; }
        public DateTime Timestamp { get; set; }
    }

    private class PrivateMessage : ChatMessage
    {
        public string SenderId { get; set; }
        public string ReceiverId { get; set; }
    }
}
```

## Unity WebSocket Implementation

### WebSocket Client for Unity

Using WebSocketSharp for Unity games:

```csharp
using UnityEngine;
using WebSocketSharp;
using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using Newtonsoft.Json;

public class UnityWebSocketClient : MonoBehaviour
{
    private WebSocket _webSocket;
    private readonly ConcurrentQueue<Action> _mainThreadActions = new();
    private bool _isConnected = false;

    [SerializeField] private string serverUrl = "wss://your-server.com/ws";
    [SerializeField] private int reconnectDelay = 5;

    public event Action OnConnected;
    public event Action<string> OnMessageReceived;
    public event Action<string> OnDisconnected;
    public event Action<string> OnError;

    private void Start()
    {
        Connect();
    }

    private void Connect()
    {
        try
        {
            _webSocket = new WebSocket(serverUrl);

            // Configure WebSocket
            _webSocket.Compression = CompressionMethod.Deflate;
            _webSocket.WaitTime = TimeSpan.FromSeconds(10);

            // Set up event handlers
            _webSocket.OnOpen += OnWebSocketOpen;
            _webSocket.OnMessage += OnWebSocketMessage;
            _webSocket.OnError += OnWebSocketError;
            _webSocket.OnClose += OnWebSocketClose;

            // Add headers
            _webSocket.SetCookie(new Cookie("sessionId", GetSessionId()));
            _webSocket.CustomHeaders = new Dictionary<string, string>
            {
                { "Authorization", $"Bearer {GetAuthToken()}" },
                { "X-Client-Version", Application.version }
            };

            _webSocket.ConnectAsync();
            Debug.Log($"Connecting to {serverUrl}...");
        }
        catch (Exception ex)
        {
            Debug.LogError($"Failed to create WebSocket: {ex.Message}");
            ScheduleReconnect();
        }
    }

    private void OnWebSocketOpen(object sender, EventArgs e)
    {
        Debug.Log("WebSocket connected!");
        _isConnected = true;

        EnqueueMainThreadAction(() =>
        {
            OnConnected?.Invoke();

            // Send initial message
            SendMessage(new
            {
                type = "register",
                playerId = GetPlayerId(),
                platform = Application.platform.ToString()
            });
        });
    }

    private void OnWebSocketMessage(object sender, MessageEventArgs e)
    {
        if (e.IsText)
        {
            Debug.Log($"Received text: {e.Data}");
            EnqueueMainThreadAction(() => HandleMessage(e.Data));
        }
        else if (e.IsBinary)
        {
            Debug.Log($"Received binary: {e.RawData.Length} bytes");
            EnqueueMainThreadAction(() => HandleBinaryMessage(e.RawData));
        }
    }

    private void OnWebSocketError(object sender, ErrorEventArgs e)
    {
        Debug.LogError($"WebSocket error: {e.Message}");
        EnqueueMainThreadAction(() => OnError?.Invoke(e.Message));
    }

    private void OnWebSocketClose(object sender, CloseEventArgs e)
    {
        Debug.Log($"WebSocket closed: {e.Code} - {e.Reason}");
        _isConnected = false;

        EnqueueMainThreadAction(() =>
        {
            OnDisconnected?.Invoke(e.Reason);

            if (e.Code != 1000) // Not normal closure
            {
                ScheduleReconnect();
            }
        });
    }

    private void HandleMessage(string message)
    {
        try
        {
            var json = JsonConvert.DeserializeObject<Dictionary<string, object>>(message);
            var type = json["type"].ToString();

            switch (type)
            {
                case "game_state":
                    UpdateGameState(json);
                    break;
                case "player_action":
                    HandlePlayerAction(json);
                    break;
                case "chat":
                    HandleChatMessage(json);
                    break;
                default:
                    OnMessageReceived?.Invoke(message);
                    break;
            }
        }
        catch (Exception ex)
        {
            Debug.LogError($"Failed to handle message: {ex.Message}");
        }
    }

    private void HandleBinaryMessage(byte[] data)
    {
        // Handle binary data (e.g., game state snapshots, audio data)
    }

    private void UpdateGameState(Dictionary<string, object> data)
    {
        // Update game state based on server data
    }

    private void HandlePlayerAction(Dictionary<string, object> data)
    {
        // Handle other player's actions
    }

    private void HandleChatMessage(Dictionary<string, object> data)
    {
        var sender = data["sender"].ToString();
        var message = data["message"].ToString();
        Debug.Log($"Chat from {sender}: {message}");
    }

    public void SendMessage(object message)
    {
        if (_isConnected && _webSocket != null)
        {
            var json = JsonConvert.SerializeObject(message);
            _webSocket.SendAsync(json, (success) =>
            {
                if (!success)
                {
                    Debug.LogError("Failed to send message");
                }
            });
        }
        else
        {
            Debug.LogWarning("Cannot send message: not connected");
        }
    }

    public void SendBinary(byte[] data)
    {
        if (_isConnected && _webSocket != null)
        {
            _webSocket.SendAsync(data, (success) =>
            {
                if (!success)
                {
                    Debug.LogError("Failed to send binary data");
                }
            });
        }
    }

    private void ScheduleReconnect()
    {
        Debug.Log($"Scheduling reconnect in {reconnectDelay} seconds...");
        Invoke(nameof(Connect), reconnectDelay);
    }

    private void EnqueueMainThreadAction(Action action)
    {
        _mainThreadActions.Enqueue(action);
    }

    private void Update()
    {
        // Execute actions on main thread
        while (_mainThreadActions.TryDequeue(out var action))
        {
            action?.Invoke();
        }
    }

    private void OnDestroy()
    {
        Disconnect();
    }

    private void OnApplicationPause(bool pauseStatus)
    {
        if (pauseStatus)
        {
            Disconnect();
        }
        else
        {
            Connect();
        }
    }

    private void OnApplicationFocus(bool hasFocus)
    {
        if (!hasFocus && Application.platform == RuntimePlatform.WebGLPlayer)
        {
            // Handle WebGL focus loss
        }
    }

    public void Disconnect()
    {
        if (_webSocket != null)
        {
            _webSocket.Close(CloseStatusCode.Normal, "Client disconnecting");
            _webSocket = null;
        }
        _isConnected = false;
    }

    private string GetSessionId()
    {
        return PlayerPrefs.GetString("SessionId", Guid.NewGuid().ToString());
    }

    private string GetAuthToken()
    {
        return PlayerPrefs.GetString("AuthToken", "");
    }

    private string GetPlayerId()
    {
        return PlayerPrefs.GetString("PlayerId", SystemInfo.deviceUniqueIdentifier);
    }
}
```

## Testing

### xUnit Testing

Test WebSocket functionality with xUnit:

```csharp
using Xunit;
using System;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Hosting;

public class WebSocketTests : IAsyncLifetime
{
    private TestServer _server;
    private ClientWebSocket _client;

    public async Task InitializeAsync()
    {
        _server = new TestServer(new WebHostBuilder()
            .UseStartup<Startup>());
        _client = new ClientWebSocket();
    }

    public async Task DisposeAsync()
    {
        _client?.Dispose();
        _server?.Dispose();
    }

    [Fact]
    public async Task CanConnect()
    {
        // Arrange
        var uri = new Uri(_server.BaseAddress, "/ws");

        // Act
        await _client.ConnectAsync(uri, CancellationToken.None);

        // Assert
        Assert.Equal(WebSocketState.Open, _client.State);
    }

    [Fact]
    public async Task CanSendAndReceiveMessage()
    {
        // Arrange
        await ConnectAsync();
        var message = "Hello, WebSocket!";

        // Act
        await SendMessageAsync(message);
        var received = await ReceiveMessageAsync();

        // Assert
        Assert.Contains(message, received);
    }

    [Fact]
    public async Task HandlesReconnection()
    {
        // Arrange
        var client = new ReconnectingWebSocketClient("ws://localhost:5000/ws");
        var reconnected = false;

        client.Connected += (sender, args) =>
        {
            if (reconnected) return;
            reconnected = true;
        };

        // Act
        await client.ConnectAsync();
        await client.DisconnectAsync();
        await Task.Delay(2000); // Wait for reconnection

        // Assert
        Assert.True(reconnected);
    }

    [Theory]
    [InlineData("text message")]
    [InlineData("{\"type\":\"json\",\"data\":123}")]
    public async Task ProcessesDifferentMessageTypes(string message)
    {
        // Arrange
        await ConnectAsync();

        // Act
        await SendMessageAsync(message);
        var received = await ReceiveMessageAsync();

        // Assert
        Assert.NotNull(received);
    }

    private async Task ConnectAsync()
    {
        var uri = new Uri(_server.BaseAddress, "/ws");
        await _client.ConnectAsync(uri, CancellationToken.None);
    }

    private async Task SendMessageAsync(string message)
    {
        var bytes = Encoding.UTF8.GetBytes(message);
        await _client.SendAsync(
            new ArraySegment<byte>(bytes),
            WebSocketMessageType.Text,
            true,
            CancellationToken.None
        );
    }

    private async Task<string> ReceiveMessageAsync()
    {
        var buffer = new ArraySegment<byte>(new byte[4096]);
        var result = await _client.ReceiveAsync(buffer, CancellationToken.None);
        return Encoding.UTF8.GetString(buffer.Array, 0, result.Count);
    }
}
```

## Best Practices

### Connection Management

- Implement automatic reconnection with exponential backoff
- Handle network state changes appropriately
- Use connection pooling for multiple connections
- Implement proper connection lifecycle management

### Security

- Always use WSS (WebSocket Secure) in production
- Implement proper authentication and authorization
- Validate all incoming messages
- Use rate limiting and throttling
- Implement CORS properly

### Performance

- Use binary messages for large data transfers
- Implement message compression
- Batch small messages when possible
- Use async/await properly to avoid blocking
- Configure appropriate buffer sizes

### Error Handling

- Implement comprehensive error handling
- Log errors with appropriate detail levels
- Provide graceful degradation
- Handle partial message failures
- Implement circuit breaker pattern

### Monitoring

- Track connection metrics
- Monitor message throughput
- Log performance metrics
- Implement health checks
- Use distributed tracing for debugging
