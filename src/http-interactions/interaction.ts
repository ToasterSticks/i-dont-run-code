import nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import {
	InteractionType,
	APIInteraction,
	APIApplicationCommandInteraction,
	APIMessageComponentInteraction,
	APIModalSubmitInteraction,
	RESTPostAPIInteractionFollowupJSONBody,
} from 'discord-api-types/v10';
import { File, InteractionHandler, InteractionHandlerReturn } from './types';
import type { CommandStore } from './handler';

const makeValidator =
		({ publicKey }: { publicKey: string }) =>
		async (request: Request) => {
			const headers = Object.fromEntries(request.headers),
				signature = String(headers['x-signature-ed25519']),
				timestamp = String(headers['x-signature-timestamp']),
				body = await request.json(),
				isValid = nacl.sign.detached.verify(
					Buffer.from(timestamp + JSON.stringify(body)),
					Buffer.from(signature, 'hex'),
					Buffer.from(publicKey, 'hex')
				);

			if (!isValid) throw new Error('Invalid request');
		},
	isFileUpload = (data: InteractionHandlerReturn) => data.files && data.files.length > 0;

export const formDataResponse = (
	data: InteractionHandlerReturn | (RESTPostAPIInteractionFollowupJSONBody & { files?: File[] })
) => {
	const formData = new FormData();

	if (data.files) {
		for (const file of data.files) formData.append(file.name, new Blob([file.data]), file.name);
		delete data.files;
	}

	formData.append('payload_json', JSON.stringify(data));

	return formData;
};

const createResponse = (data: InteractionHandlerReturn) =>
	isFileUpload(data)
		? new Response(formDataResponse(data))
		: new Response(JSON.stringify(data), {
				headers: { 'Content-Type': 'application/json' },
		  });

export const interaction = ({
	publicKey,
	commands,
}: {
	publicKey: string;
	commands: CommandStore;
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
						return createResponse({ type: 1 });
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
				return createResponse(await handler(interaction));
			} catch {
				return new Response(null, { status: 400 });
			}
		} catch {
			return new Response(null, { status: 401 });
		}
	};
};
