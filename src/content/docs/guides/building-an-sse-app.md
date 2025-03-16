---
title: Building a Web App with SSE
description: Detailed, step-by-step instructions on building a realtime web app with Server-Sent Events (SSE) and Node.js - an interactive cursor position-sharing demo
---

## Introduction

In this guide, we will walk you through the process of building a simple web application that uses Server-Sent Events (SSE) to share cursor positions in real-time. SSE allows servers to push updates to the client over a single HTTP connection, which is a one-way communication from server to client.

## Prerequisites

Before we start, make sure you have the following installed on your machine:

- Node.js (v14 or higher)
- npm (v6 or higher)

## Step 1: Setting Up the Project

First, create a new directory for your project and navigate into it:

```bash
mkdir sse-cursor-sharing
cd sse-cursor-sharing
```

Initialize a new Node.js project:

```bash
npm init -y
```

Install the necessary dependencies:

```bash
npm install express
```

## Step 2: Creating the Server

Create a new file named `server.js` in the root of your project directory and add the following code:

```javascript
const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Simulate cursor position updates
  setInterval(() => {
    const cursorPosition = {
      x: Math.floor(Math.random() * 800),
      y: Math.floor(Math.random() * 600),
    };
    sendEvent(cursorPosition);
  }, 1000);

  req.on('close', () => {
    console.log('Client disconnected');
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
```

This code sets up an Express server that serves static files from the `public` directory and provides an SSE endpoint at `/events`. The server simulates cursor position updates and sends them to connected clients every second.

## Step 3: Creating the Client

Create a new directory named `public` in the root of your project directory. Inside the `public` directory, create an `index.html` file and add the following code:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSE Cursor Sharing</title>
  <style>
    #cursor {
      position: absolute;
      width: 10px;
      height: 10px;
      background-color: red;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div id="cursor"></div>
  <script>
    const cursor = document.getElementById('cursor');
    const eventSource = new EventSource('/events');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      cursor.style.left = `${data.x}px`;
      cursor.style.top = `${data.y}px`;
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
    };
  </script>
</body>
</html>
```

This code creates a simple HTML page with a red dot representing the cursor. It uses the `EventSource` API to connect to the SSE endpoint and updates the cursor position based on the received events.

## Step 4: Running the Application

To run the application, execute the following command in your project directory:

```bash
node server.js
```

Open your browser and navigate to `http://localhost:3000`. You should see a red dot moving around the screen, representing the cursor position updates sent by the server.

## Conclusion

In this guide, we have built a simple web application that uses Server-Sent Events (SSE) to share cursor positions in real-time. This example demonstrates the basics of setting up an SSE connection and handling events on the client side. You can extend this example to build more complex real-time applications using SSE.
