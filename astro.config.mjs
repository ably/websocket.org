import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'WebSocket.org',
      social: {
        github: 'https://github.com/ably/websocket.org',
      },
      sidebar: [
        {
          label: 'Guides',
          items: [
            {
              label: 'Core Concepts',
              items: [
                { label: 'The Road to WebSockets', link: '/guides/road-to-websockets/' },
                { label: 'WebSocket Protocol', link: '/guides/websocket-protocol/' },
                { label: 'The Future of WebSockets', link: '/guides/future-of-websockets/' },
              ],
            },
            {
              label: 'Implementation',
              items: [
                { label: 'Building a WebSocket App', link: '/guides/building-a-websocket-app/' },
                { label: 'WebSockets at Scale', link: '/guides/websockets-at-scale/' },
              ],
            },
            {
              label: 'Security',
              items: [{ label: 'Security Hardening', link: '/guides/security/' }],
            },
            {
              label: 'Testing',
              items: [{ label: 'Autobahn TestSuite', link: '/guides/testing/autobahn/' }],
            },
            {
              label: 'Infrastructure',
              items: [
                { label: 'Nginx Configuration', link: '/guides/infrastructure/nginx/' },
                { label: 'AWS ALB Configuration', link: '/guides/infrastructure/aws/alb/' },
                { label: 'Cloudflare Configuration', link: '/guides/infrastructure/cloudflare/' },
                { label: 'Kubernetes Ingress', link: '/guides/infrastructure/kubernetes/' },
              ],
            },
            {
              label: 'Languages',
              collapsed: true,
              items: [
                { label: 'JavaScript & Node.js', link: '/guides/languages/javascript/' },
                { label: 'Python', link: '/guides/languages/python/' },
                { label: 'Go', link: '/guides/languages/go/' },
                { label: 'Rust', link: '/guides/languages/rust/' },
                { label: 'Java', link: '/guides/languages/java/' },
                { label: 'C# & .NET', link: '/guides/languages/csharp/' },
                { label: 'PHP', link: '/guides/languages/php/' },
              ],
            },
          ],
        },
        {
          label: 'Reference',
          items: [
            {
              label: 'API Reference',
              items: [
                { label: 'WebSocket API', link: '/reference/websocket-api/' },
                { label: 'Close Codes', link: '/reference/close-codes/' },
              ],
            },
            {
              label: 'Standards',
              items: [{ label: 'Standards Tracker', link: '/standards/' }],
            },
          ],
        },
        {
          label: 'Tools',
          items: [{ label: 'Echo Server', link: '/tools/websocket-echo-server/' }],
        },
        {
          label: 'Resources',
          items: [{ label: 'WebSocket Resources', link: '/resources/websocket-resources/' }],
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/ably/websocket.org/edit/main/',
      },
      components: {
        Head: './src/components/head.astro',
        // Sidebar: './src/components/Sidebar.astro',
        Content: './src/components/ContentWrapper.astro',
        PageFrame: './src/components/PageFrameWrapper.astro',
      },
    }),
  ],
});
