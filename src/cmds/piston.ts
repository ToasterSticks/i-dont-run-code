import {
	APIModalSubmitInteraction,
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ComponentType,
	InteractionResponseType,
	MessageFlags,
	Routes,
	TextInputStyle,
} from 'discord-api-types/v10';
import PQueue from 'p-queue';

import { Command, File, formDataResponse } from '../http-interactions';
import { PistonExecuteData, PistonReponse } from '../types';
import { getModalValue, getOption, supportedMarkdown, supportedRuntimes, request } from '../util';

const queue = new PQueue({
	concurrency: 1,
	interval: 300,
	intervalCap: 1,
});

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
			name: 'file-output',
			description: 'Whether to send the output contents in a file',
			type: ApplicationCommandOptionType.Boolean,
		},
		{
			name: 'mobile-source-output',
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
		const file = getOption<boolean>(options, 'file-output') || '';
		const mobile = getOption<boolean>(options, 'mobile-source-output') || '';
		const hide = getOption<boolean>(options, 'hide') || '';

		if (!supportedRuntimes.aliases.has(language) && !supportedRuntimes.languages.has(language))
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
						placeholder: 'Arguments to pass to the program',
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
	const args = [...getModalValue(data, 'args')!.matchAll(COMMAND_LINE_ARGS)].map(
		(match) => match[1]?.replaceAll('\\"', '"') ?? match[0]
	);

	const [, language, file, mobile, hide] = data.custom_id.split(':');

	const result = await queue.add(() =>
		getPistonResponse({
			language,
			version: '*',
			files: [{ content: code }],
			args,
			stdin,
		})
	);

	let body: FormData | string;
	let followUpBody: FormData | undefined;

	if ('message' in result) body = JSON.stringify({ content: result.message });
	else {
		const { language, version, run, compile } = result;

		const files: File[] = [];

		const joinedOutput = (compile ? compile.output + '\n' : '') + run.output;
		const trimmed = joinedOutput.trim();
		let reply = `Executed your ${supportedMarkdown[language] ?? language} (${version}) program; ${
			joinedOutput ? 'output is below' : 'no output received'
		}`;

		if (joinedOutput) {
			if (file) files.push({ name: 'output.txt', data: trimmed });
			else reply += truncateOutputWithCodeblock(trimmed, reply.length);
		}

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

	await request(Routes.webhook(CLIENT_ID, token), 'POST', body);
	if (followUpBody) await request(Routes.webhook(CLIENT_ID, token), 'POST', followUpBody);
};

const getPistonResponse = (data: PistonExecuteData) =>
	fetch('https://emkc.org/api/v2/piston/execute', {
		method: 'POST',
		body: JSON.stringify(data),
	}).then((res) => res.json()) as Promise<PistonReponse>;

const truncateOutputWithCodeblock = (str: string, charCountUsed = 0, lang = '') => {
	const charsRemaining = 1993 - charCountUsed - lang.length;

	return `\`\`\`${lang}\n${
		str.length > charsRemaining ? str.slice(0, charsRemaining - 3) + '[…]' : str || ' '
	}\`\`\``;
};

const COMMAND_LINE_ARGS = /(?<=^|\s)"((?:\\"|[^"])*)"(?=$|\s)|[^\s]+/g;
