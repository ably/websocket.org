---
title: '{Tool Name}'
description: '{Tool description - what it does - 150-160 characters}'
author: "Matt O'Riordan"
authorRole: 'Co-founder & CEO, Ably'
date: { YYYY-MM-DD }
lastModified: { YYYY-MM-DD }
category: 'tool'
tags:
  - websocket
  - tool
  - { tool-type }
seo:
  title: '{Tool Name} - WebSocket {Tool Type}'
  description: '{SEO meta description - 150-160 characters}'
  keywords:
    - websocket {tool-type}
    - { keyword1 }
    - { keyword2 }
  canonicalUrl: '/tools/{url-slug}/'
  ogImage: '/images/og/{tool-name}.png'
toc: true
sidebar:
  order: { number }
  label: '{Tool Name}'
toolConfig:
  interactive: { true/false }
  requiresJS: { true/false }
  apiEndpoint: '{/api/tool-name}'
---

## {Tool Name}

{Brief description of what the tool does and why it's useful.}

## How to Use

1. {Step 1}
2. {Step 2}
3. {Step 3}

## Tool Interface

{Description of the tool interface or embed the actual tool component}

<div id="tool-container">
  <!-- Tool will be mounted here -->
</div>

## Understanding the Results

{Explanation of what the tool outputs mean}

## Use Cases

- **{Use Case 1}**: {Description}
- **{Use Case 2}**: {Description}
- **{Use Case 3}**: {Description}

## Technical Details

{Any technical information about how the tool works}

## API Usage

```bash
# Example API call
curl -X POST https://websocket.org/api/{tool-name} \
  -H "Content-Type: application/json" \
  -d '{"param": "value"}'
```

## Limitations

- {Limitation 1}
- {Limitation 2}

## Related Tools

- [{Related Tool}]({link}) - {brief description}
- [{Related Tool}]({link}) - {brief description}
