import type { APIInteraction, APIInteractionResponse } from 'discord-api-types/v10';

export interface File {
	name: string;
	data: any;
}

export type InteractionHandlerReturn = APIInteractionResponse & {
	files?: File[];
};

export type InteractionHandler<T extends APIInteraction = APIInteraction> = (
	interaction: T,
	...extra: any
) => InteractionHandlerReturn | Promise<InteractionHandlerReturn>;
