import {
	type APIModalSubmitInteraction,
	ApplicationCommandType,
	ComponentType,
	InteractionResponseType,
	MessageFlags,
	Routes,
	TextInputStyle,
} from 'discord-api-types/v10';
import { type Command, type File, formDataResponse } from '../../http-interactions';
import {
	COMMAND_LINE_ARGS,
	getModalValue,
	getPistonResponse,
	languages,
	request,
	supportedMarkdown,
} from '../../util';

export const command: Command<ApplicationCommandType.Message> = {
	type: ApplicationCommandType.Message,
	name: 'Run Piston Job',

	exec: async (interaction) => {
		const apiMessage = interaction.data.resolved.messages[interaction.data.target_id];
		const matches = apiMessage.content.match(/```([^\n]+)\n(.*?)```/s);

		if (!matches)
			return {
				type: InteractionResponseType.ChannelMessageWithSource,
				data: {
					content: 'The message body does not match the required format.',
					flags: MessageFlags.Ephemeral,
				},
			};

		const [, language, body] = matches;

		if (!languages[language])
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
				custom_id: `${command.name}:${language}`,
				title: `Execute ${supportedMarkdown[language] ?? language} program`,
				components: [
					{
						style: TextInputStyle.Paragraph,
						label: 'Script',
						placeholder: 'Code used for execution',
						custom_id: 'code',
						value: body,
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

	modal: async (interaction, args) => {
		followUp(interaction, args);

		const hide = args[3];

		return {
			type: InteractionResponseType.DeferredChannelMessageWithSource,
			data: { flags: hide ? MessageFlags.Ephemeral : 0 },
		};
	},
};

const followUp = async ({ data, token }: APIModalSubmitInteraction, [language]: string[]) => {
	const code = getModalValue(data, 'code');
	const stdin = getModalValue(data, 'stdin');
	const args = [...getModalValue(data, 'args').matchAll(COMMAND_LINE_ARGS)].map(
		(match) => match[1]?.replaceAll('\\"', '"') ?? match[0]
	);

	const result = await getPistonResponse({
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
		const output = (compile ? compile.output + '\n' : '') + run.output;
		let reply = `Executed your ${supportedMarkdown[language] ?? language} (${version}) program; ${
			output ? 'output is below' : 'no output received'
		}`;

		if (output) {
			const charsRemaining = 1993 - reply.length;
			if (output.length > charsRemaining) files.push({ name: 'output.txt', data: output });
			else reply += `\`\`\`\n${output}\`\`\``;
		}

		files.push({
			name: 'script.' + (supportedMarkdown[language]?.toLowerCase() ?? 'txt'),
			data: code,
		});

		if (stdin) files.push({ name: 'stdin.txt', data: stdin });

		body = formDataResponse({ content: reply, files });
	}

	await request(Routes.webhookMessage(CLIENT_ID, token), 'PATCH', body);
	if (followUpBody) await request(Routes.webhook(CLIENT_ID, token), 'POST', followUpBody);
};
