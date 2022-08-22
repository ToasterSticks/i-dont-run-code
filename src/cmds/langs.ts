import { Command } from 'cloudflare-discord-bot';
import { ApplicationCommandType, InteractionResponseType } from 'discord-api-types/v10';
import { getSupportedLanguages } from '../util';

export const command: Command<ApplicationCommandType.ChatInput> = {
	name: 'langs',
	description: 'Display all supported languages for Piston',
	handler: async () => {
		const runtimes = await getSupportedLanguages();

		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: { content: `Supported languages: ${runtimes.languages.join(', ')}` },
		};
	},
};
