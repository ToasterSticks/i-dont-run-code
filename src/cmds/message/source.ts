import {
	ApplicationCommandType,
	InteractionResponseType,
	MessageFlags,
} from 'discord-api-types/v10';

import { Command } from '../../http-interactions';

export const command: Command<ApplicationCommandType.Message> = {
	type: ApplicationCommandType.Message,
	name: 'Source',
	handler: async (interaction) => {
		const json = interaction.data.resolved.messages[interaction.data.target_id];
		const formatted = JSON.stringify(json, null, 2);

		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			files: [{ name: 'message.json', data: formatted }],
			data: { flags: MessageFlags.Ephemeral },
		};
	},
};
