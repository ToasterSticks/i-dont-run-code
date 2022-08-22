declare global {
	const CLIENT_ID: string;
	const CLIENT_SECRET: string;
	const PUBLIC_KEY: string;

	let currentEvent: FetchEvent;
}

export interface Runtime {
	language: string;
	version: string;
	aliases: string[];
	runtime?: string;
}

export {};
