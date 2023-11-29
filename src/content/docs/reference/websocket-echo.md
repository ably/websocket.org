---
title: WebSockets Echo Server
description: Public free endpoint used for testing Websockets, SSE and HTTP
---

# WebSocket Echo Server

We run a free very simple endpoint server with support for websockets and server-sent events (SSE) so that you can test your websocket and SSE clients easily.

The server is designed for testing HTTP proxies and clients. It echoes information about HTTP request headers and bodies back to the client.

The endpoint is https://echo-websocket-org-winter-flower-6700.fly.dev.

## Behavior

- Any messages sent from a websocket client are echoed as a websocket message.
- Visit https://echo-websocket-org-winter-flower-6700.fly.dev/.ws in a browser for a basic UI to connect and send websocket messages.
- Request https://echo-websocket-org-winter-flower-6700.fly.dev/.sse to receive the echo response via server-sent events.
- Request any other URL to receive the echo response in plain text.