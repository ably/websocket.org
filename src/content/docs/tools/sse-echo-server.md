---
title: SSE Echo Server
description: Public free endpoint used for testing SSE and HTTP
---

# SSE Echo Server

We run a free very simple endpoint server with support for server-sent events (SSE) so that you can test your SSE clients easily.

The server is designed for testing HTTP proxies and clients. It echoes information about HTTP request headers and bodies back to the client.

The endpoint is https://echo.sse.org/

## Behavior

- Any messages sent from an SSE client are echoed as an SSE message.
- Visit https://echo.sse.org/.sse in a browser for a basic UI to connect and send SSE messages.
- Request https://echo.sse.org/.sse to receive the echo response via server-sent events.
- Request any other URL to receive the echo response in plain text.
