---
title: SSE API
description: A reference for the SSE API — its events, methods, and properties, alongside usage examples for each of them.
---

# The SSE API (Server-Sent Events)

The SSE API is an advanced technology that makes it possible to open a one-way interactive communication session between the user's browser and a server. With this API, you can receive event-driven responses from a server without having to poll the server for a reply.

Note: While an SSE connection is functionally somewhat similar to standard Unix-style sockets, they are not related.

## Interfaces

`EventSource`
The primary interface for connecting to an SSE server and then receiving data on the connection.

`CloseEvent`
The event sent by the EventSource object when the connection closes.

`MessageEvent`
The event sent by the EventSource object when a message is received from the server.

## Further reading

- Read [about reference](https://diataxis.fr/reference/) in the Diátaxis framework
