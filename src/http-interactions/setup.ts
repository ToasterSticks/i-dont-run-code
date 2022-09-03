import { Buffer } from 'buffer';
import {
	OAuth2Routes,
	RESTPostAPIApplicationCommandsJSONBody,
	RouteBases,
	Routes,
} from 'discord-api-types/v10';
import type { Application } from './handler';

const btoa = (value: string) => Buffer.from(value, 'binary').toString('base64'),
	getAuthorizationCode = async (authedFetch: any) => {
		const request = new Request(OAuth2Routes.tokenURL, {
				method: 'POST',
				body: new URLSearchParams({
					grant_type: 'client_credentials',
					scope: 'applications.commands.update',
				}).toString(),
				headers: {
					...authedFetch,
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			}),
			response = await fetch(request);
		if (!response.ok) throw new Error('Failed to request an Authorization code.');

		try {
			const data: any = await response.json();
			return data.access_token;
		} catch {
			throw new Error('Failed to parse the Authorization code response.');
		}
	},
	resolveCommandsEndpoint = (applicationId: string, guildId?: string): string => {
		if (guildId) return RouteBases.api + Routes.applicationGuildCommands(applicationId, guildId);
		return RouteBases.api + Routes.applicationCommands(applicationId);
	},
	createCommands = async (
		{
			applicationId,
			guildId,
			commands,
		}: {
			applicationId: string;
			guildId?: string;
			commands: RESTPostAPIApplicationCommandsJSONBody[];
		},
		bearer: string
	): Promise<Response> => {
		const url = resolveCommandsEndpoint(applicationId, guildId),
			request = new Request(url, {
				method: 'PUT',
				body: JSON.stringify(commands),
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
			});

		return fetch(request)
			.then(() => new Response('OK'))
			.catch((e) => new Response(e.message, { status: 502 }));
	};

export const setup = ({ applicationId, applicationSecret, guildId, commands }: Application) => {
	const authorization = btoa(unescape(encodeURIComponent(applicationId + ':' + applicationSecret))),
		headers = {
			Authorization: `Basic ${authorization}`,
		};

	return async (): Promise<Response> => {
		try {
			const bearer = await getAuthorizationCode(headers);

			return createCommands(
				{
					applicationId,
					guildId,
					// eslint-disable-next-line
					commands: commands.map(({ handler: _, components: __, ...c }) => c),
				},
				bearer
			);
		} catch {
			return new Response(
				'Failed to authenticate with Discord. Are the Application ID and secret set correctly?',
				{ status: 407 }
			);
		}
	};
};
