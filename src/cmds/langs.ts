import { Command } from 'cloudflare-discord-bot';
import { ApplicationCommandType, InteractionResponseType } from 'discord-api-types/v10';
import { supportedRuntimes } from '../util';

export const command: Command<ApplicationCommandType.ChatInput> = {
	name: 'langs',
	description: 'Display all languages supported by Piston',
	handler: async () => {
		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: { content: `Supported languages: ${supportedRuntimes.languages.join(', ')}` },
		};
	},
};
