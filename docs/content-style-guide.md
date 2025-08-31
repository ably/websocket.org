# WebSocket.org Content Style Guide

## Mission

WebSocket.org is the canonical source for WebSocket information, providing accurate, comprehensive, and accessible documentation for developers at all levels.

## Voice and Tone

### Voice Attributes
- **Authoritative**: We are the definitive source for WebSocket information
- **Technical**: Precise and accurate in technical details
- **Accessible**: Clear explanations for complex concepts
- **Practical**: Focus on real-world applications

### Tone Guidelines
- Professional but approachable
- Confident without being condescending
- Helpful and educational
- Objective and vendor-neutral (except for appropriate Ably mentions)

## Writing Principles

### 1. Clarity First
- Use simple language for complex concepts
- Define technical terms on first use
- Provide examples for abstract concepts
- Use active voice

### 2. Accuracy Matters
- Verify all technical information
- Cite authoritative sources (RFCs, specifications)
- Test all code examples
- Keep content up-to-date

### 3. Structure for Scanning
- Use descriptive headings
- Keep paragraphs short (3-4 sentences)
- Use bullet points for lists
- Include code examples

## Content Types

### Guides
- **Purpose**: Teach concepts and implementation
- **Length**: 1,500-3,000 words
- **Structure**: Introduction → Prerequisites → Content → Summary → Next Steps
- **Examples**: Multiple, progressively complex

### Reference Documentation
- **Purpose**: Quick lookup of technical details
- **Length**: As needed for completeness
- **Structure**: Overview → Syntax → Parameters → Examples → Related
- **Examples**: Concise, focused on specific features

### Tools
- **Purpose**: Interactive utilities for developers
- **Length**: 500-1,000 words of documentation
- **Structure**: Purpose → How to Use → Understanding Results → Technical Details
- **Examples**: Interactive demonstrations

## Formatting Standards

### Headings
```markdown
# Page Title (H1 - one per page)
## Major Section (H2)
### Subsection (H3)
#### Minor Point (H4 - use sparingly)
```

### Code Examples

#### Inline Code
Use backticks for:
- Function names: `WebSocket()`
- File names: `server.js`
- Commands: `npm install ws`
- Short code snippets: `ws.send('Hello')`

#### Code Blocks
```javascript
// Always include language identifier
// Add comments explaining complex parts
const ws = new WebSocket('wss://echo.websocket.org');

ws.onopen = () => {
  console.log('Connected');
};
```

### Lists

#### Unordered Lists
Use for:
- Features
- Requirements
- Related items without hierarchy

#### Ordered Lists
Use for:
- Step-by-step instructions
- Ranked items
- Sequential processes

### Tables
Use for:
- Comparing features
- API parameters
- Compatibility matrices

```markdown
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | WebSocket server URL |
```

## Technical Writing Guidelines

### API Documentation
- Start with purpose/use case
- Show simplest example first
- Document all parameters
- Include error handling
- Note browser compatibility

### Error Messages
- Explain what went wrong
- Suggest how to fix it
- Provide example of correct usage
- Link to relevant documentation

### Security Topics
- Emphasize best practices
- Explain vulnerabilities clearly
- Provide secure implementation examples
- Never show insecure code without warnings

## SEO Guidelines

### Title Tags
- 50-60 characters
- Include primary keyword
- Brand name at end: `| WebSocket.org`

### Meta Descriptions
- 150-160 characters
- Include primary keyword
- Call to action
- Unique for each page

### URL Structure
- Lowercase only
- Hyphens for spaces
- Descriptive but concise
- Logical hierarchy: `/guides/websocket-security`

### Keywords
- Focus on long-tail keywords
- Natural placement in content
- Use variations and synonyms
- Include in headings when relevant

## Author Attribution

All content should include:
```yaml
author: "Matt O'Riordan"
authorRole: "Co-founder & CEO, Ably"
```

For guest contributors:
```yaml
author: "Guest Author Name"
authorRole: "Title, Company"
contributor: true
```

## Code Style

### JavaScript
- ES6+ syntax preferred
- Async/await over callbacks
- Const/let over var
- Meaningful variable names

### Error Handling
Always include:
```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = (event) => {
  console.log('Connection closed:', event.code, event.reason);
};
```

## Common Terms

### Correct Usage
- WebSocket (not Websocket or websocket when referring to the protocol)
- WebSockets (plural)
- Real-time (hyphenated as adjective)
- Server-sent events (not Server Sent Events)

### Avoid
- "Simply" or "just" (can be condescending)
- "Obviously" (not obvious to everyone)
- Unnecessary jargon
- Marketing language in technical content

## Content Checklist

Before publishing:
- [ ] Technical accuracy verified
- [ ] Code examples tested
- [ ] Links checked
- [ ] SEO metadata complete
- [ ] Spelling and grammar checked
- [ ] Formatted consistently
- [ ] Author attribution included
- [ ] Related content linked

## Accessibility

- Use descriptive link text (not "click here")
- Provide alt text for images
- Ensure code examples are screen-reader friendly
- Use semantic HTML in Astro components
- Maintain good color contrast

## Updates and Maintenance

- Review content quarterly
- Update version numbers and compatibility
- Add new examples as standards evolve
- Monitor for broken links
- Respond to community feedback

## Questions?

For style guide clarifications or suggestions, open an issue on GitHub or contact the maintainers.