import {
	APIApplicationCommandInteractionDataBasicOption,
	APIApplicationCommandInteractionDataOption,
	APIApplicationCommandInteractionDataSubcommandOption,
	APIInteractionResponse,
	APIModalSubmission,
	InteractionResponseType,
} from 'discord-api-types/v10';
import { Runtime } from './types';
export const mapFiles = <T>(context: __WebpackModuleApi.RequireContext) =>
	context.keys().map<T>((path) => context(path).command);

export const deferUpdate = (): APIInteractionResponse => ({
	type: InteractionResponseType.DeferredMessageUpdate,
});

export const getOption = <
	T extends
		| string
		| number
		| boolean
		| APIApplicationCommandInteractionDataBasicOption[]
		| APIApplicationCommandInteractionDataSubcommandOption[]
>(
	options: APIApplicationCommandInteractionDataOption[] | undefined,
	name: string
): T | undefined => {
	const option = options?.find((option) => option.name === name);

	// @ts-expect-error
	return option && ('value' in option ? option.value : option.options);
};

export const getModalValue = (data: APIModalSubmission, name: string) => {
	const row = data.components?.find(({ components }) => components[0].custom_id === name);

	return row?.components[0].value;
};

const cachedRuntimes = <{ languages: string[]; aliases: string[] }>{ languages: [], aliases: [] };

export const getSupportedLanguages = async () => {
	if (cachedRuntimes.languages.length) {
		console.log('here');
		return cachedRuntimes;
	}

	const runtimes = (await fetch('https://emkc.org/api/v2/piston/runtimes').then((res) =>
		res.json()
	)) as Runtime[];

	for (const runtime of runtimes) {
		cachedRuntimes.languages.push(runtime.language);
		cachedRuntimes.aliases.push(...runtime.aliases);
	}

	return cachedRuntimes;
};
