import { Command, File } from 'cloudflare-discord-bot';
import {
	APIModalSubmitInteraction,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ComponentType,
	InteractionResponseType,
	MessageFlags,
	RESTPostAPIInteractionFollowupJSONBody,
	Routes,
	TextInputStyle,
} from 'discord-api-types/v10';
import { PistonClient } from 'piston-api-client';
import { getModalValue, getOption, supportedRuntimes } from '../util';

const pistonClient = new PistonClient();

export const command: Command<ApplicationCommandType.ChatInput> = {
	name: 'piston',
	description: 'Execute arbitrary code via Piston API',
	options: [
		{
			name: 'language',
			description: 'The language to use for execution',
			type: ApplicationCommandOptionType.String,
			required: true,
		},
		{
			name: 'file',
			description: 'Whether to send the output contents in a file',
			type: ApplicationCommandOptionType.Boolean,
		},
		{
			name: 'hide',
			description: 'Whether to hide the response',
			type: ApplicationCommandOptionType.Boolean,
		},
	],
	handler: async ({ data: { options } }) => {
		const language = getOption<string>(options, 'language')!.toLowerCase();
		const file = getOption<boolean>(options, 'file') || '';
		const hide = getOption<boolean>(options, 'hide') || '';

		if (![...supportedRuntimes.languages, ...supportedRuntimes.aliases].includes(language))
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: `The language provided is not supported.`,
					flags: MessageFlags.Ephemeral,
				},
			};

		return {
			type: InteractionResponseType.Modal,
			data: {
				custom_id: `piston:${language}:${file}:${hide}`,
				title: `Execute ${language} program`,
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
				].map((textInputData) => ({
					type: ComponentType.ActionRow,
					components: [{ ...textInputData, type: ComponentType.TextInput }],
				})),
			},
		};
	},
	modal: async (interaction) => {
		currentEvent.waitUntil(followUp(interaction));

		const hide = interaction.data.custom_id.split(':')[3];

		return {
			type: InteractionResponseType.DeferredChannelMessageWithSource,
			data: { flags: hide ? MessageFlags.Ephemeral : 0 },
		};
	},
};

const followUp = async ({ data, token }: APIModalSubmitInteraction) => {
	const code = getModalValue(data, 'code')!;
	const stdin = getModalValue(data, 'stdin')!;
	const args = getModalValue(data, 'args')!
		.split(',')
		.map((arg) => arg.trim());

	const [, language, file] = data.custom_id.split(':');

	const result = await pistonClient.execute({
		language,
		version: '*',
		files: [{ content: code }],
		args,
		stdin,
	});

	let body: FormData | string;

	if (result.success && !('message' in result)) {
		const { language, version, run, compile } = result.data;
		const files: File[] = [];

		const joinedOutput = [compile?.output, run.output].join('\n').trim();
		let message = `Ran your ${language} (${version}) program; output below`;

		if (!file)
			message += `\`\`\`\n${
				joinedOutput.length > 1935 ? joinedOutput.slice(0, 1935) + '[…]' : joinedOutput || ' '
			}\`\`\``;
		else files.push({ name: 'output.txt', data: joinedOutput });

		files.push({ name: language, data: code });

		body = formDataResponse({ content: message, files });
	} else {
		body = JSON.stringify({ content: 'Something went wrong… Maybe try again?' });
	}

	return fetch('https://discord.com/api/v10' + Routes.webhook(CLIENT_ID, token), {
		method: 'POST',
		body,
	});
};

const formDataResponse = (data: RESTPostAPIInteractionFollowupJSONBody & { files?: File[] }) => {
	const formData = new FormData();

	data.files?.forEach((file) => formData.append(file.name, new Blob([file.data]), file.name));
	delete data.files;

	formData.append('payload_json', JSON.stringify(data));

	return formData;
};
