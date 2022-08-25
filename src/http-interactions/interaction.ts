import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import {
	InteractionType,
	APIInteraction,
	APIApplicationCommandInteraction,
	APIMessageComponentInteraction,
	APIModalSubmitInteraction,
} from 'discord-api-types/v10';
import { InteractionHandler, InteractionHandlerReturn } from './types';
import type { CommandStore } from './handler';

const makeValidator =
	({ publicKey }: { publicKey: string }) =>
	async (request: Request) => {
		const headers = Object.fromEntries(request.headers);
		const signature = String(headers['x-signature-ed25519']);
		const timestamp = String(headers['x-signature-timestamp']);
		const body = await request.json();

		const isValid = nacl.sign.detached.verify(
			Buffer.from(timestamp + JSON.stringify(body)),
			Buffer.from(signature, 'hex'),
			Buffer.from(publicKey, 'hex')
		);

		if (!isValid) throw new Error('Invalid request');
	};

const isFileUpload = (data: InteractionHandlerReturn) => data.files && data.files.length > 0;

const formDataResponse = (data: InteractionHandlerReturn) => {
	const formData = new FormData();

	data.files?.forEach((file) => formData.append(file.name, new Blob([file.data]), file.name));
	delete data.files;

	formData.append('payload_json', JSON.stringify(data));

	return new Response(formData);
};

const jsonResponse = (data: InteractionHandlerReturn) =>
	isFileUpload(data)
		? formDataResponse(data)
		: new Response(JSON.stringify(data), {
				headers: { 'Content-Type': 'application/json' },
		  });

export const interaction = ({
	publicKey,
	commands,
}: {
	publicKey: string;
	commands: CommandStore;
	components?: { [key: string]: InteractionHandler };
}) => {
	return async (request: Request): Promise<Response> => {
		const validateRequest = makeValidator({ publicKey });

		try {
			await validateRequest(request.clone());
			try {
				const interaction = (await request.json()) as APIInteraction;

				let handler:
					| InteractionHandler<APIApplicationCommandInteraction>
					| InteractionHandler<APIMessageComponentInteraction>
					| InteractionHandler<APIModalSubmitInteraction>
					| undefined;

				switch (interaction.type) {
					case InteractionType.Ping: {
						return jsonResponse({ type: 1 });
					}
					case InteractionType.ApplicationCommand: {
						if (!interaction.data?.name) break;
						handler = commands.get(interaction.data.name)?.handler;
						break;
					}
					case InteractionType.MessageComponent: {
						const commandInteraction = interaction.message.interaction;
						if (!commandInteraction) break;
						handler = commands.get(commandInteraction.name.split(' ')[0])?.components?.[
							interaction.data.custom_id
						];
						break;
					}
					case InteractionType.ModalSubmit:
						handler = commands.get(interaction.data.custom_id.split(':')[0])?.modal;
						break;
					case InteractionType.ApplicationCommandAutocomplete:
				}
				if (!handler) return new Response(null, { status: 500 });
				// @ts-expect-error
				return jsonResponse(await handler(interaction));
			} catch {
				return new Response(null, { status: 400 });
			}
		} catch {
			return new Response(null, { status: 401 });
		}
	};
};
