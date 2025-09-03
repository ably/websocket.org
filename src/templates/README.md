# Content Templates

This directory contains templates for creating consistent content across
WebSocket.org.

## Available Templates

```text
templates/
├── guide-template.md         # Educational guides and tutorials
├── reference-template.md     # API and technical reference docs
├── tool-template.md          # Interactive tool documentation
├── resource-template.md      # External resources and libraries
└── component-template.astro  # Reusable Astro components
```

## Template Types

### 📚 Guides (`guide-template.md`)

Use for educational content that teaches concepts or implementations:

- WebSocket protocol explanations
- Implementation tutorials
- Best practices guides
- Architecture patterns

### 📖 Reference (`reference-template.md`)

Use for technical reference documentation:

- API documentation
- Protocol specifications
- Method/function references
- Configuration options

### 🛠️ Tools (`tool-template.md`)

Use for interactive tool documentation:

- Frame inspector
- Connection debugger
- Compression simulator
- Any interactive utilities

### 🔗 Resources (`resource-template.md`)

Use for external resources and libraries:

- WebSocket libraries
- Related specifications
- Third-party tools
- Community resources

### 🧩 Components (`component-template.astro`)

Use for creating reusable Astro components:

- UI components
- Layout components
- Interactive elements
- Shared functionality

## How to Use Templates

1. **Copy the appropriate template** to your content location
2. **Replace placeholder text** (in `{curly braces}`)
3. **Fill in the frontmatter** with accurate metadata
4. **Follow the structure** provided in the template
5. **Remove unused sections** if not applicable

## Template Variables

Common variables to replace:

- `{YYYY-MM-DD}` - Date in ISO format (e.g., 2024-08-31)
- `{Guide Title}` - The main title of your content
- `{url-slug}` - URL-friendly version (lowercase, hyphens)
- `{number}` - Numerical order for sidebar sorting
- `{keyword}` - SEO keywords relevant to content

## Best Practices

1. **Always include complete frontmatter** for SEO
2. **Use Matthew O'Riordan as default author** unless guest post
3. **Test all code examples** before publishing
4. **Include "Common Gotchas"** section in guides
5. **Link to related content** at the end
6. **Follow the content style guide** in `/docs/content-style-guide.md`

## Creating New Content

```bash
# Example: Creating a new guide
cp src/templates/guide-template.md src/content/docs/guides/my-new-guide.md

# Example: Creating a new component
cp src/templates/component-template.astro src/components/MyComponent.astro
```

## Questions?

Refer to the [Content Style Guide](/docs/content-style-guide.md) or open an
issue on GitHub.
