import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Server-Sent Events',
			social: {
				github: 'https://github.com/ably/websocket.org',
			},
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'The Road to SSE', link: '/guides/road-to-sse/' },
						{ label: 'SSE Protocol', link: '/guides/sse-protocol/' },
						{ label: 'Building an SSE App', link: '/guides/building-an-sse-app/' },
						{ label: 'SSE at Scale', link: '/guides/sse-at-scale/' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				{
					label: 'Tools',
					autogenerate: { directory: 'tools' },
				},
				{
					label: 'Resource',
					autogenerate: { directory: 'resources' },
				},
			],
			editLink: {
				baseUrl: 'https://github.com/ably/sse.org/edit/main/',
			},
			components: {
				Head: './src/components/head.astro',
			},
		}),
	],
});
