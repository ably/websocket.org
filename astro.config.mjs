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
						// Each item here is one entry in the navigation menu.
						{ label: 'The Road to WebSockets', link: '/guides/road-to-websockets/' },
						{ label: 'WebSocket Protocol', link: '/guides/websocket-protocol/' },
						{ label: 'Building a WebSocket App', link: '/guides/building-a-websocket-app/' },
						{ label: 'WebSockets at Scale', link: '/guides/websockets-at-scale/' },
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
				baseUrl: 'https://github.com/ably/websocket.org/edit/main/',
			},
			components: {
				Head: './src/components/head.astro',
			},
		}),
	],
});
