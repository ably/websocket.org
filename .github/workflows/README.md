# GitHub Actions Workflows

This directory contains automated workflows for the websocket.org repository.

## Workflows

### CI (`ci.yml`)
**Triggers:** Push to main, Pull requests
**Purpose:** Runs continuous integration checks
- Type checking with TypeScript
- Builds the Astro site
- Tests with Node.js 18.x and 20.x
- Checks code formatting with Prettier (non-blocking)
- Lints markdown files (non-blocking)

### Link Checker (`link-checker.yml`)
**Triggers:** Pull requests, Weekly schedule (Mondays 3am UTC), Manual
**Purpose:** Validates all links in the built site
- Builds the site
- Checks all internal and external links
- Excludes social media links (LinkedIn, Twitter) due to rate limiting
- Posts results as PR comment on failure
- Uses Lychee for comprehensive link checking

### Structured Data Validation (`structured-data.yml`)
**Triggers:** Pull requests (when content files change), Manual
**Purpose:** Validates structured data markup
- Validates JSON-LD structured data
- Checks for Open Graph meta tags
- Checks for Twitter Card meta tags
- Non-blocking validation to identify missing metadata

## Adding New Workflows

When adding new workflows:
1. Keep jobs focused and single-purpose
2. Use appropriate triggers (PR, push, schedule)
3. Cache dependencies where possible
4. Use `continue-on-error: true` for non-critical checks
5. Document the workflow in this README

## Manual Workflow Runs

All workflows can be triggered manually from the GitHub Actions tab using the "workflow_dispatch" trigger.