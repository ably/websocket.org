---
title: WebSockets API Reference
description: Reference API for WebSockets in a browser
---

# The WebSocket API (WebSockets)

The WebSocket API is an advanced technology that makes it possible to open a two-way interactive communication session between the user's browser and a server. With this API, you can send messages to a server and receive event-driven responses without having to poll the server for a reply.

Note: While a WebSocket connection is functionally somewhat similar to standard Unix-style sockets, they are not related.

## Interfaces

`WebSocket`
The primary interface for connecting to a WebSocket server and then sending and receiving data on the connection.

`CloseEvent`
The event sent by the WebSocket object when the connection closes.

`MessageEvent`
The event sent by the WebSocket object when a message is received from the server.

## Further reading

- Read [about reference](https://diataxis.fr/reference/) in the Diátaxis framework
