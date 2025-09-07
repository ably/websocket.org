# AGENTS.md - AI Coding Assistant Guidelines

## Project Context

WebSocket.org is the canonical resource for WebSocket protocol implementation.
This is an Astro-based static site with strict quality standards.

## MANDATORY: Pre-Commit Requirements

### 🚨 CRITICAL: ALL Changes MUST Pass These Checks

**These commands MUST ALL pass with ZERO errors before ANY task is complete:**

```bash
# Run in this EXACT order:
npm run lint:fix    # 1. Auto-fix linting issues
npm run lint        # 2. Verify linting passes (MUST show zero errors)
npm run format      # 3. Format all code with Prettier (MUST complete without errors)
npm run lint        # 4. Run lint again to ensure formatting didn't break anything
```

### ⛔ NEVER Consider Work Complete If

- `npm run lint` shows ANY errors
- `npm run format` shows ANY errors
- The pre-commit hook would fail
- You haven't run ALL the above commands

### Common Issues That Block Commits

1. **Linting Errors (MD013, MD009, MD047)**
   - Lines over 120 characters
   - Trailing spaces
   - Missing newline at end of file

2. **Formatting Issues**
   - Prettier formatting not applied
   - Inconsistent indentation
   - Improper line breaks

### The Final Check Before Completion

```bash
# This sequence MUST succeed completely:
npm run lint:fix && npm run format && npm run lint
# If ANY command fails, fix the issues and run the entire sequence again
```

### Testing Infrastructure Guides

When creating or modifying infrastructure guides:

1. **Run prettier on all files:**
   `npx prettier --write "src/content/docs/guides/infrastructure/**/*.md"`
2. **Run markdownlint:**
   `npx markdownlint src/content/docs/guides/infrastructure/**/*.md --fix`
3. **Verify navigation:** Check astro.config.mjs includes new guides in sidebar
4. **Test in dev server:** Ensure all pages load correctly and navigation works
5. **Check code blocks:** Verify all code examples have proper language
   specifiers

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
- **Always include**: Author attribution to Matthew O'Riordan where appropriate
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

### Page Structure

- **IMPORTANT**: Never add a top-level heading (`# Title`) in content pages
- The page title is automatically generated from the frontmatter `title` field
- Start content directly after frontmatter or with `## H2` sections
- Example:

  ```markdown
  ---
  title: Your Page Title
  description: Page description
  ---

  Start content here without # heading.

  ## First Section

  Content...
  ```

### Writing Standards

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
