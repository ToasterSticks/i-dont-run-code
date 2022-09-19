import type {
	APIApplicationCommandInteraction,
	APIChatInputApplicationCommandInteraction,
	APIMessageApplicationCommandInteraction,
	APIMessageComponentInteraction,
	APIModalSubmitInteraction,
	APIUserApplicationCommandInteraction,
	ApplicationCommandType,
	RESTPostAPIApplicationCommandsJSONBody,
	RESTPostAPIChatInputApplicationCommandsJSONBody,
	RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord-api-types/v10';
import { Router } from 'itty-router';
import { setup } from './setup';
import { authorize } from './authorize';
import { interaction } from './interaction';
import type { InteractionHandler } from './types';

const router = Router();

type CommandsJSONBody<
	T extends
		| ApplicationCommandType.ChatInput
		| ApplicationCommandType.Message
		| ApplicationCommandType.User
		| unknown
> = T extends ApplicationCommandType.ChatInput
	? RESTPostAPIChatInputApplicationCommandsJSONBody
	: T extends ApplicationCommandType.Message
	? RESTPostAPIContextMenuApplicationCommandsJSONBody & { type: ApplicationCommandType.Message }
	: T extends ApplicationCommandType.User
	? RESTPostAPIContextMenuApplicationCommandsJSONBody & { type: ApplicationCommandType.User }
	: RESTPostAPIApplicationCommandsJSONBody;

export type Command<
	T extends
		| ApplicationCommandType.ChatInput
		| ApplicationCommandType.Message
		| ApplicationCommandType.User
		| unknown = unknown
> = CommandsJSONBody<T> & {
	exec: InteractionHandler<
		T extends ApplicationCommandType.ChatInput
			? APIChatInputApplicationCommandInteraction
			: T extends ApplicationCommandType.Message
			? APIMessageApplicationCommandInteraction
			: T extends ApplicationCommandType.User
			? APIUserApplicationCommandInteraction
			: APIApplicationCommandInteraction
	>;
	modal?: InteractionHandler<APIModalSubmitInteraction>;
	components?: Record<string, InteractionHandler<APIMessageComponentInteraction>>;
};

export interface Application {
	applicationId: string;
	applicationSecret: string;
	publicKey: string;
	guildId?: string;
	commands: Command[];
}

export type CommandStore = Map<string, Command>;

export const createApplicationCommandHandler = (application: Application) => {
	const commands = application.commands.reduce(
		(_commands, command) => _commands.set(command.name, command),
		new Map() as CommandStore
	);

	router.get('/', authorize(application.applicationId));
	router.post('/interaction', interaction({ publicKey: application.publicKey, commands }));
	router.get('/setup', setup(application));

	return router.handle;
};
