import { Command } from 'cloudflare-discord-bot';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ComponentType,
	InteractionResponseType,
	MessageFlags,
	TextInputStyle,
} from 'discord-api-types/v10';
import { PistonClient } from 'piston-api-client';
import { getModalValue, getOption } from '../util';

const pistonClient = new PistonClient();

export const command: Command<ApplicationCommandType.ChatInput> = {
	name: 'piston',
	description: 'Execute arbitrary via Piston API',
	options: [
		{
			name: 'language',
			description: 'The language to use for execution',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	],
	handler: ({ data: { options } }) => {
		const language = getOption<string>(options, 'language')!;

		return {
			type: InteractionResponseType.Modal,
			data: {
				custom_id: 'piston',
				title: `Running ${language}`,
				components: [
					{
						style: TextInputStyle.Paragraph,
						label: 'Code',
						placeholder: 'Code of the program to run',
						custom_id: 'code',
						required: true,
					},
					{
						style: TextInputStyle.Paragraph,
						label: 'Stdin',
						placeholder: 'Text to pass as standard input to the program',
						custom_id: 'stdin',
						required: false,
					},
					{
						style: TextInputStyle.Short,
						label: 'Args',
						placeholder: 'Arguments to pass to the program (comma separated)',
						custom_id: 'args',
						required: false,
					},
					{
						style: TextInputStyle.Short,
						label: 'Language (Prefilled)',
						placeholder: "Language to use for execution (don't change this)",
						custom_id: 'language',
						value: language,
						required: true,
					},
				].map((textInputData) => ({
					type: ComponentType.ActionRow,
					components: [{ ...textInputData, type: ComponentType.TextInput }],
				})),
			},
		};
	},
	modal: async ({ data }) => {
		const code = getModalValue(data, 'code')!;
		const stdin = getModalValue(data, 'stdin')!;
		const args = getModalValue(data, 'args')!
			.split(',')
			.map((arg) => arg.trim());

		const language = getModalValue(data, 'language')!;

		const result = await pistonClient.execute({
			language,
			version: '*',
			files: [{ content: code }],
			args,
			stdin,
		});

		if (result.success && !('message' in result)) {
			const { language, version, run } = result.data;
			const message = `Ran your ${language} (${version}) program; output below\n\`\`\`\n${run.output}\`\`\``;

			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				files: [{ name: language, data: code }],
				data: { content: message },
			};
		}

		return {
			type: InteractionResponseType.ChannelMessageWithSource,
			data: {
				content: 'Something went wrong… Maybe try again?',
				flags: MessageFlags.Ephemeral,
			},
		};
	},
};
