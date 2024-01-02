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
						{ label: 'WebSocket Guide', link: '/guides/websockets/' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
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
