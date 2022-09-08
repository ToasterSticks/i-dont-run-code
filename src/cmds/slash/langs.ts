import type { ApplicationCommandType } from 'discord-api-types/v10';
import { InteractionResponseType, MessageFlags } from 'discord-api-types/v10';

import type { Command } from '../../http-interactions';
import { languages } from '../../util';

const unique = new Set(Object.values(languages));

export const command: Command<ApplicationCommandType.ChatInput> = {
	name: 'langs',
	description: 'Display all languages supported by Piston',
	handler: async () => {
		let list = '';

		for (const lang of unique) list += `\n- ${lang}`;

		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: `Supported languages\`\`\`${list.trim()}\`\`\``,
				flags: MessageFlags.Ephemeral,
			},
		};
	},
};
