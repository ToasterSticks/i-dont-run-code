export const authorize = (applicationId: string) => async (): Promise<Response> => {
	const urlSearchParams = new URLSearchParams({
		client_id: applicationId,
		scope: 'applications.commands',
	});

	const redirectURL = new URL(`https://discord.com/oauth2/authorize`);
	redirectURL.search = urlSearchParams.toString();

	return new Response(null, {
		status: 302,
		headers: { Location: redirectURL.toString() },
	});
};
