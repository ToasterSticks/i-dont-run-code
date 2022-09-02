import {
	ApplicationCommandType,
	InteractionResponseType,
	MessageFlags,
} from 'discord-api-types/v10';

import { Command } from '../../http-interactions';
import { supportedRuntimes } from '../../util';

export const command: Command<ApplicationCommandType.ChatInput> = {
	name: 'langs',
	description: 'Display all languages supported by Piston',
	handler: async () => {
		let list = '';

		for (const lang of supportedRuntimes.languages) list += `\n- ${lang}`;

		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: `Supported languages\`\`\`${list.trim()}\`\`\``,
				flags: MessageFlags.Ephemeral,
			},
		};
	},
};
