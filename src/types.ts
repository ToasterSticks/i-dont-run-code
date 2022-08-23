declare global {
	const CLIENT_ID: string;
	const CLIENT_SECRET: string;
	const PUBLIC_KEY: string;

	let currentEvent: FetchEvent;
}

export {};

declare module 'piston-api-client' {
	interface PistonExecuteResult {
		message?: string;
	}
}
