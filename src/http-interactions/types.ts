import type {
	APIInteraction,
	APIInteractionResponse,
	APIMessageComponentInteraction,
	APIModalSubmitInteraction,
} from 'discord-api-types/v10';

export interface File {
	name: string;
	data: any;
}

export type InteractionHandlerReturn = APIInteractionResponse & {
	files?: File[];
};

export type InteractionHandler<T extends APIInteraction = APIInteraction> = (
	interaction: T,
	...extra: T extends APIModalSubmitInteraction | APIMessageComponentInteraction
		? [string[], ...any]
		: any[]
) => InteractionHandlerReturn | Promise<InteractionHandlerReturn>;
