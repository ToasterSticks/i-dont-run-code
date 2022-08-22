import { createApplicationCommandHandler, Command } from 'cloudflare-discord-bot';
import { mapFiles } from './util';

const commands = mapFiles<Command>(require.context('./cmds', false, /\.ts$/));

const applicationCommandHandler = createApplicationCommandHandler({
	applicationId: CLIENT_ID,
	applicationSecret: CLIENT_SECRET,
	publicKey: PUBLIC_KEY,
	commands,
});

addEventListener('fetch', async (event) => {
	Object.defineProperty(globalThis, 'currentEvent', { value: event, configurable: true });
	event.respondWith(applicationCommandHandler(event.request));
});
