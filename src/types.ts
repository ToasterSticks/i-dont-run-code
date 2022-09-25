declare global {
	const CLIENT_ID: string;
	const CLIENT_SECRET: string;
	const PUBLIC_KEY: string;
}

export interface PistonExecuteData {
	language: string;
	version: string;
	files: {
		name?: string;
		content: string;
		encoding?: 'base64' | 'hex' | 'utf8';
	}[];
	stdin?: string;
	args?: string[];
	compile_timeout?: number;
	run_timeout?: number;
	compile_memory_limit?: number;
	run_memory_limit?: number;
}

export type PistonResponse = PistonExecuteResult | { message: string };

interface PistonExecuteResult {
	language: string;
	version: string;
	run: StageResponse;
	compile?: StageResponse;
}

interface StageResponse {
	stdout: string;
	stderr: string;
	output: string;
	code: number;
	signal: string | null;
}
