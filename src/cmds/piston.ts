import { Command, File } from '../http-interactions';
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

import { PistonExecuteData, PistonReponse } from '../types';
import { API_BASE, getModalValue, getOption, supportedMarkdown, supportedRuntimes } from '../util';

export const command: Command<ApplicationCommandType.ChatInput> = {
	name: 'piston',
	description: 'Execute arbitrary code via Piston',
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
			name: 'mobile-output',
			description: 'Whether to send the source contents as text',
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
		const mobile = getOption<boolean>(options, 'mobile-output') || '';
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
				custom_id: `piston:${language}:${file}:${mobile}:${hide}`,
				title: `Execute ${supportedMarkdown[language] ?? language} program`,
				components: [
					{
						style: TextInputStyle.Paragraph,
						label: 'Script',
						placeholder: 'Code used for execution',
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
		followUp(interaction);

		const hide = interaction.data.custom_id.split(':')[4];

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

	const [, language, file, mobile, hide] = data.custom_id.split(':');

	const result = await retryUntilSuccess({
		language,
		version: '*',
		files: [{ content: code }],
		args,
		stdin,
	});

	let body: FormData | string;
	let followUpBody: FormData | undefined;

	if ('message' in result) body = JSON.stringify({ content: result.message });
	else {
		const { language, version, run, compile } = result;

		const files: File[] = [];

		const joinedOutput = [compile?.output, run.output].join('\n').trim();
		let reply = `Executed your ${
			supportedMarkdown[language] ?? language
		} (${version}) program; output is below`;

		if (file) files.push({ name: 'output.txt', data: joinedOutput });
		else reply += truncateOutputWithCodeblock(joinedOutput, reply.length);

		files.push({ name: language + (supportedMarkdown[language] ? '' : '.txt'), data: code });
		if (stdin) files.push({ name: 'stdin.txt', data: stdin });

		body = formDataResponse({ content: reply, files: mobile ? (file ? [files[0]] : []) : files });

		if (mobile) {
			followUpBody = formDataResponse({
				content: truncateOutputWithCodeblock(code, 0, language),
				files: files.slice(file ? 2 : 1),
				flags: hide ? MessageFlags.Ephemeral : 0,
			});
		}
	}

	await fetch(API_BASE + Routes.webhook(CLIENT_ID, token), {
		method: 'POST',
		body,
	});

	if (followUpBody)
		await fetch(API_BASE + Routes.webhook(CLIENT_ID, token), {
			method: 'POST',
			body: followUpBody,
		});

	return;
};

const getPistonResponse = (data: PistonExecuteData) =>
	fetch('https://emkc.org/api/v2/piston/execute', {
		method: 'POST',
		body: JSON.stringify(data),
	}).then((res) => (res.status === 429 ? null : res.json())) as Promise<PistonReponse | null>;

const retryUntilSuccess = async (data: PistonExecuteData) => {
	let res: PistonReponse | null;

	do {
		res = await getPistonResponse(data);
	} while (!res);

	return res;
};

const formDataResponse = (data: RESTPostAPIInteractionFollowupJSONBody & { files?: File[] }) => {
	const formData = new FormData();

	data.files?.forEach((file) => formData.append(file.name, new Blob([file.data]), file.name));
	delete data.files;

	formData.append('payload_json', JSON.stringify(data));

	return formData;
};

const truncateOutputWithCodeblock = (str: string, charCountUsed = 0, lang = '') => {
	const charsRemaining = 1993 - charCountUsed - lang.length;

	return `\`\`\`${lang}\n${
		str.length > charsRemaining ? str.slice(0, charsRemaining - 3) + '[…]' : str || ' '
	}\`\`\``;
};
