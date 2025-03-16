---
title: The SSE Protocol
description: Key considerations related to the Server-Sent Events (SSE) protocol. You’ll find out how to establish an SSE connection and receive events, what kind of data can be sent over SSE, and how to handle different types of messages.
---

## Introduction to Server-Sent Events (SSE)

Server-Sent Events (SSE) is a technology that allows a server to push real-time updates to the client over a single HTTP connection. Unlike WebSockets, which provide full-duplex communication, SSE is a one-way communication channel from the server to the client. This makes SSE particularly well-suited for applications that require real-time updates without the need for the client to send frequent messages back to the server.

## Establishing an SSE Connection

To establish an SSE connection, the client uses the `EventSource` interface, which is part of the HTML5 specification. The `EventSource` object is used to open a connection to the server and receive events as they are sent.

### Example

```javascript
const eventSource = new EventSource('https://example.com/sse-endpoint');

eventSource.onmessage = function(event) {
  console.log('New message:', event.data);
};

eventSource.onerror = function(error) {
  console.error('Error:', error);
};
```

In this example, the `EventSource` object is created with the URL of the SSE endpoint. The `onmessage` event handler is used to process incoming messages, and the `onerror` event handler is used to handle any errors that occur.

## Event Stream Format

The server sends events to the client using the MIME type `text/event-stream`. Each event is a block of text terminated by a pair of newlines. The event stream format includes several fields:

- `event`: The event type (optional).
- `data`: The event data (required).
- `id`: The event ID (optional).
- `retry`: The reconnection time in milliseconds (optional).

### Example

```
event: update
data: {"message": "New update available"}
id: 12345
retry: 5000

```

In this example, the server sends an event of type `update` with the data `{"message": "New update available"}`, an event ID of `12345`, and a reconnection time of `5000` milliseconds.

## Handling Different Types of Messages

SSE allows the server to send different types of messages, including data-only messages, named events, and mixed messages. The client can handle these messages using the `EventSource` event handlers.

### Data-Only Messages

Data-only messages are the simplest type of SSE message. They contain only the `data` field.

### Example

```
data: {"message": "Hello, world!"}

```

### Named Events

Named events include the `event` field, which specifies the event type. The client can listen for specific event types using the `addEventListener` method.

### Example

```javascript
eventSource.addEventListener('update', function(event) {
  console.log('Update event:', event.data);
});
```

### Mixed Messages

Mixed messages include multiple fields, such as `event`, `data`, and `id`.

### Example

```
event: update
data: {"message": "New update available"}
id: 12345

```

## Error Handling

SSE connections can encounter errors, such as network issues or server errors. The `EventSource` object provides an `onerror` event handler to handle these errors.

### Example

```javascript
eventSource.onerror = function(error) {
  console.error('Error:', error);
};
```

## Closing the SSE Connection

To close the SSE connection, the client can call the `close` method on the `EventSource` object.

### Example

```javascript
eventSource.close();
```

## Browser Compatibility

SSE is supported by most modern browsers, including Chrome, Firefox, Safari, and Edge. However, it is not supported by Internet Explorer. Developers should consider using polyfills or fallback mechanisms for unsupported browsers.

## Conclusion

Server-Sent Events (SSE) is a powerful technology for pushing real-time updates from the server to the client. By understanding the SSE protocol and its key considerations, developers can build efficient and responsive web applications that provide a seamless user experience.
