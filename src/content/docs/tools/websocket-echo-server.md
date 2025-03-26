---
title: WebSocket Echo Server
description: Public free endpoint used for testing Websockets, SSE and HTTP
---

We run a free very simple endpoint server with support for websockets and server-sent events (SSE) so that you can test your websocket and SSE clients easily.

The server is designed for testing HTTP proxies and clients. It echoes information about HTTP request headers and bodies back to the client.

The endpoint is https://echo.websocket.org/

## Behavior

- Any messages sent from a websocket client are echoed as a websocket message.
- Visit https://echo.websocket.org/.ws in a browser for a basic UI to connect and send websocket messages.
- Request https://echo.websocket.org/.sse to receive the echo response via server-sent events.
- Request any other URL to receive the echo response in plain text.

## Sponsored by Ably

This echo server is sponsored by [Ably](https://ably.com/), a realtime data delivery platform that provides scalable, reliable and secure [WebSocket infrastructure](https://ably.com/topic/websockets) for apps and services.
