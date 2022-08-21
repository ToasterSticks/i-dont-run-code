import { createApplicationCommandHandler, Command } from 'cloudflare-discord-bot';
import { mapFiles } from './util';

const commands = mapFiles<Command>(require.context('./cmds', false, /\.ts$/));

const applicationCommandHandler = createApplicationCommandHandler({
	applicationId: CLIENT_ID,
	applicationSecret: CLIENT_SECRET,
	publicKey: PUBLIC_KEY,
	commands,
});

addEventListener('fetch', (event) => event.respondWith(applicationCommandHandler(event.request)));
