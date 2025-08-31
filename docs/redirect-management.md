# Redirect Management Guide

## Overview

URL redirects are managed through the `vercel.json` configuration file. This ensures proper SEO preservation when URLs change and maintains backward compatibility with old links.

## How to Add Redirects

Edit the `vercel.json` file in the root directory:

```json
{
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    }
  ]
}
```

## Redirect Types

### Permanent Redirects (301)
Use `"permanent": true` for:
- Content that has permanently moved
- Old URL structures that won't return
- SEO juice transfer to new URLs

### Temporary Redirects (302)
Use `"permanent": false` for:
- Temporary maintenance redirects
- A/B testing
- Content that may return to original URL

## Best Practices

1. **Always redirect when changing URLs** - Never delete content without redirecting
2. **Use permanent redirects carefully** - They're cached by browsers and hard to undo
3. **Test redirects locally** - Use `vercel dev` to test before deploying
4. **Document major changes** - Add comments in vercel.json for complex redirects
5. **Avoid redirect chains** - Point directly to final destination
6. **Update internal links** - Don't rely on redirects for internal navigation

## Common Redirect Patterns

### Page Moves
```json
{
  "source": "/guides/old-guide-name",
  "destination": "/guides/new-guide-name",
  "permanent": true
}
```

### Category Changes
```json
{
  "source": "/tutorials/:path*",
  "destination": "/guides/:path*",
  "permanent": true
}
```

### External Redirects
```json
{
  "source": "/external-resource",
  "destination": "https://external-site.com/resource",
  "permanent": false
}
```

### Trailing Slash Handling
Vercel automatically handles trailing slashes, but you can enforce consistency:
```json
{
  "source": "/page/",
  "destination": "/page",
  "permanent": true
}
```

## Testing Redirects

1. **Local Testing**
   ```bash
   vercel dev
   # Visit http://localhost:3000/old-path
   ```

2. **Production Testing**
   ```bash
   curl -I https://websocket.org/old-path
   # Check for Location header and status code
   ```

## Current Redirects

See `vercel.json` for the current list of active redirects.

## Monitoring

- Check Google Search Console for 404 errors monthly
- Review analytics for unexpected traffic patterns
- Monitor redirect chains using tools like:
  - Screaming Frog SEO Spider
  - Redirect Path Chrome Extension
  - httpstatus.io

## When to Remove Redirects

Generally, keep redirects indefinitely for:
- High-traffic pages
- Pages with significant backlinks
- Pages indexed in search engines

Consider removing redirects after 2+ years if:
- No traffic through the redirect
- No external links point to old URL
- Search engines have updated their index