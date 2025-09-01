# AGENTS.md - AI Coding Assistant Guidelines

## Project Context

WebSocket.org is the canonical resource for WebSocket protocol implementation.
This is an Astro-based static site with strict quality standards.

## Critical Pre-Commit Checklist

**ALWAYS run before considering any task complete:**

```bash
npm run lint        # Check for linting issues
npm run lint:fix    # Auto-fix what's possible
npm run format      # Format code
npm test           # Run tests if applicable
```

## Known Issues & Solutions

### 1. ASCII Diagrams

- **Issue**: Alignment problems in sequence diagrams
- **Solution**: Count exact character positions. Vertical lines must align
  precisely at consistent column positions
- **Testing**: View raw markdown to verify alignment, not just rendered output

### 2. Markdown Linting (MD040, MD036)

- **Issue**: Fenced code blocks need language specifiers
- **Solution**: Always use ` ```text ` for ASCII art, ` ```javascript ` for code
- **Issue**: Bold text interpreted as headings
- **Solution**: Use proper heading levels (####) instead of **bold** for section
  titles

### 3. Content Updates

- **Always verify**: RFC numbers (use RFC 9220 for HTTP/3, not drafts)
- **Always include**: Author attribution to Matt O'Riordan where appropriate
- **Always test**: Code examples with actual WebSocket connections

## Repository Structure

```text
src/
├── content/docs/     # Main documentation (Markdown/MDX)
│   ├── guides/       # How-to guides and tutorials
│   ├── reference/    # API and protocol references
│   └── tools/        # Interactive tools documentation
├── assets/           # Images and static files
└── components/       # Astro components
```

## Task Completion Protocol

1. Read existing code/content first
2. Make minimal, focused changes
3. Run linting and formatting
4. Verify changes work as intended
5. Check rendered output matches expectations
6. Commit with clear, concise message

## WebSocket-Specific Standards

- Use `wss://echo.websocket.org` for examples (working echo server)
- Reference RFC 6455 (base), RFC 8441 (HTTP/2), RFC 9220 (HTTP/3)
- Include error handling and reconnection patterns in examples
- Document browser compatibility accurately

## Content Guidelines

- Practical, production-focused (beyond MDN's API docs)
- Include infrastructure configs (Nginx, AWS ALB, etc.)
- Provide language-specific implementations
- Focus on real-world deployment challenges

## Quality Gates

Before marking complete:

- [ ] Linting passes
- [ ] Formatting applied
- [ ] Links verified
- [ ] Code examples tested
- [ ] ASCII diagrams aligned
- [ ] SEO metadata present

## Common Pitfalls

- Don't assume auto-fix will handle all linting issues
- Don't trust visual rendering for ASCII alignment
- Don't use outdated draft specifications
- Don't skip the pre-commit checklist
- Don't create new files unless absolutely necessary

## Key Documentation Files

### Public Documentation

- `/src/content/docs/` - All public documentation
- `/src/content/docs/guides/` - Implementation guides
- `/src/content/docs/reference/` - API and protocol references

### Development Documentation

- `/docs/content-style-guide.md` - Writing standards and style guidelines
- `/docs/development-setup.md` - Development environment setup
- `/docs/redirect-management.md` - URL redirect configuration
- `package.json` - Available npm scripts

Remember: This site aims to be the #1 canonical WebSocket resource. Quality over
speed.
