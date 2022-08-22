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
import { getModalValue, getOption, getSupportedLanguages } from '../util';

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
	handler: async ({ data: { options } }) => {
		const language = getOption<string>(options, 'language')!;
		const supported = await getSupportedLanguages();

		if (!supported.languages.includes(language) && supported.aliases.includes(language))
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
	modal: async (interaction) => {
		currentEvent.waitUntil(followUp(interaction));

		return { type: InteractionResponseType.DeferredChannelMessageWithSource };
	},
};

const followUp = async ({ data, token }: APIModalSubmitInteraction) => {
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

	let body: FormData | string;

	if (result.success && !('message' in result)) {
		const { language, version, run, compile } = result.data;
		const message = `Ran your ${language} (${version}) program; output below\n\`\`\`\n${
			[compile?.output, run.output].filter((x) => x).join('\n') || 'No output'
		}\`\`\``;

		body = formDataResponse({ content: message, files: [{ name: language, data: code }] });
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
